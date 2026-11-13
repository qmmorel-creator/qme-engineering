# « Jingle Bells » (J. L. Pierpont, 1857, domaine public), arrangement et synthèse originaux.
import numpy as np, wave, sys
SR = 44100
BPM = 126
B = 60 / BPM
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def f(n):  # 'E5', 'D#4'
    o = int(n[-1]); k = NOTE[n[0]] + (1 if '#' in n else 0)
    return 440 * 2 ** ((k + 12 * (o + 1) - 69) / 12)
INTRO = 4  # mesure de grelots
# Refrain : (note, temps)
M = [('E5',1),('E5',1),('E5',2),('E5',1),('E5',1),('E5',2),('E5',1),('G5',1),('C5',1.5),('D5',.5),('E5',4),
     ('F5',1),('F5',1),('F5',1.5),('F5',.5),('F5',1),('E5',1),('E5',1),('E5',.5),('E5',.5),('E5',1),('D5',1),('D5',1),('E5',1),('D5',2),('G5',2),
     ('E5',1),('E5',1),('E5',2),('E5',1),('E5',1),('E5',2),('E5',1),('G5',1),('C5',1.5),('D5',.5),('E5',4),
     ('F5',1),('F5',1),('F5',1.5),('F5',.5),('F5',1),('E5',1),('E5',1),('E5',.5),('E5',.5),('G5',1),('G5',1),('F5',1),('D5',1),('C5',4)]
assert abs(sum(d for _, d in M) - 64) < 1e-9
ACC = ['C','C','C','C','F','C','D7','G','C','C','C','C','F','C','G7','C']
ACCORDS = {'C': ['C3','E3','G3'], 'F': ['F3','A3','C4'], 'G': ['G2','B2','D3'], 'D7': ['D3','F#3','C4'], 'G7': ['G2','B2','F3']}
BASSE = {'C': ('C2','G2'), 'F': ('F2','C3'), 'G': ('G2','D2'), 'D7': ('D2','A2'), 'G7': ('G2','D2')}
duree = (INTRO + 64) * B + 2.6
N = int(duree * SR)
G = np.zeros(N); D = np.zeros(N)
def ajouter(sig, t0, pan=0.0, gain=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig)); s = sig[: j - i] * gain
    G[i:j] += s * (1 - pan) / 1.0 if pan > 0 else s
    D[i:j] += s * (1 + pan) if pan < 0 else s
def cloche(fr, dur):  # célesta / glockenspiel : partiels inharmoniques à décroissance rapide
    t = np.arange(int((dur + 1.2) * SR)) / SR
    s = (np.sin(2*np.pi*fr*t) * np.exp(-t*3.2) + .45*np.sin(2*np.pi*fr*2.0*t)*np.exp(-t*5)
         + .25*np.sin(2*np.pi*fr*3.01*t)*np.exp(-t*8) + .12*np.sin(2*np.pi*fr*5.4*t)*np.exp(-t*14))
    att = np.minimum(1, t / 0.004)
    return s * att
def basse(fr, dur):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2*np.pi*fr*t) + .3*np.sin(2*np.pi*2*fr*t)
    env = np.minimum(1, t/0.01) * np.exp(-t*2.2)
    return s * env
def nappe(frs, dur):
    t = np.arange(int(dur * SR)) / SR
    s = sum(np.sin(2*np.pi*fr*t) + .5*np.sin(2*np.pi*fr*1.003*t) for fr in frs) / len(frs)
    env = np.minimum(1, t/0.35) * np.minimum(1, (dur - t)/0.3).clip(0, 1)
    return s * env
rng = np.random.default_rng(1857)
def grelot(dur=0.09):
    n = int(dur * SR); x = rng.standard_normal(n)
    x = np.diff(np.concatenate([[0], x]))       # passe-haut
    x = np.diff(np.concatenate([[0], x]))
    t = np.arange(n) / SR
    return x * np.exp(-t * 45) * 0.35
t0 = INTRO * B
# Mélodie
t = t0
for n, d in M:
    ajouter(cloche(f(n), d*B), t, pan=0.1, gain=0.55)
    ajouter(cloche(f(n)*2, d*B), t + 0.012, pan=-0.2, gain=0.08)  # éclat
    t += d * B
# Accords, nappe et basse
for k, a in enumerate(ACC):
    ts = t0 + k * 4 * B
    ajouter(nappe([f(x) for x in ACCORDS[a]], 4 * B), ts, gain=0.10)
    r, q = BASSE[a]
    for beat, note in ((0, r), (2, q)):
        ajouter(basse(f(note), 1.8 * B), ts + beat * B, gain=0.32)
    for beat in (1, 3):  # accords piqués « contretemps »
        for x in ACCORDS[a]: ajouter(cloche(f(x)*2, .3*B), ts + beat*B, pan=-0.3, gain=0.05)
ajouter(nappe([f('C3'), f('E3'), f('G3'), f('C4')], 2.6), t0 + 64*B, gain=0.12)
ajouter(cloche(f('C6'), 2), t0 + 64*B, gain=0.25)
# Grelots : croches, accent sur les temps, dès l'intro
total_croches = int((INTRO + 64) * 2)
for i in range(total_croches):
    acc = 1.0 if i % 2 == 0 else 0.55
    ajouter(grelot(), i * B / 2, pan=(0.35 if i % 4 < 2 else -0.35), gain=acc)
# Réverbération simple (quelques réflexions)
for g, d in ((0.28, 0.031), (0.2, 0.053), (0.14, 0.079), (0.09, 0.113)):
    k = int(d * SR)
    G[k:] += G[:-k] * g; D[k:] += D[:-k] * g * 0.95
st = np.stack([G, D], 1)
st /= np.abs(st).max() * 1.05
fin = int(1.2 * SR); st[-fin:] *= np.linspace(1, 0, fin)[:, None]
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print(f'durée {duree:.2f} s ; refrain de {t0:.2f} s à {t0 + 64*B:.2f} s ; temps = {B:.4f} s')
