#!/usr/bin/env python3
"""Mini-story « Qui a payé les croissants ? » : construit la piste voix, les bruitages et le mix final.

Usage : python3 sources/audio.py   (depuis le dossier de l'épisode)
Entrées : sources/timeline.json, audio/voix/vNN.wav, audio/musique-*.mp3
Sorties : audio/piste-voix.wav, audio/piste-bruitages.wav, audio/bruitages/*.wav, audio/mix-final.wav
Les bruitages sont synthétisés ici (aucun échantillon tiers, donc aucun droit à vérifier).
"""
import json, subprocess, wave, glob, os, re
import numpy as np

SR = 48000
ICI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ICI)
TL = json.load(open('sources/timeline.json'))
DUREE = TL['duree']
N = int(round(DUREE * SR))
rng = np.random.default_rng(7)


def ecrire(chemin, x, canaux=1):
    x = np.clip(x, -1, 1)
    with wave.open(chemin, 'wb') as w:
        w.setnchannels(canaux); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())


def lire(chemin):
    with wave.open(chemin) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1
        return np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32767


def env(n, a=0.005, r=0.1):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / r)


def ton(f, d, r=0.15, forme='sin'):
    t = np.arange(int(d * SR)) / SR
    ph = 2 * np.pi * np.cumsum(np.broadcast_to(f, t.shape) if np.ndim(f) else np.full(t.shape, f)) / SR
    s = np.sin(ph) if forme == 'sin' else np.sign(np.sin(ph)) * 0.5
    return s * env(len(t), 0.003, r)


def bruit(d, r=0.1):
    return rng.standard_normal(int(d * SR)) * env(int(d * SR), 0.002, r)


def passe_bas(x, k):
    return np.convolve(x, np.ones(k) / k, mode='same')


def glisse(f0, f1, d):
    return np.geomspace(f0, f1, int(d * SR))


def som(*xs):
    out = np.zeros(max(len(x) for x in xs))
    for x in xs: out[:len(x)] += x
    return out


# Bruitages (tous synthétisés)
S = {}
k = som(ton(1568, .5, .18), ton(2093, .5, .22) * .8, ton(3136, .5, .12) * .4)
k[:int(.03 * SR)] += bruit(.03, .01) * .6
S['kaching'] = k * .5
S['pop'] = som(bruit(.05, .008) * .9, ton(glisse(900, 300, .08), .08, .03) * .6)
f = bruit(.9, .5) * .25
S['fizz'] = f - passe_bas(f, 8)  # souffle aigu (pschitt)
w = bruit(.45, 1)
S['whoosh'] = passe_bas(w, 6) * np.sin(np.linspace(0, np.pi, len(w))) * .7
c = np.concatenate([bruit(.06, .02) * .9, np.zeros(int(.03 * SR)), bruit(.07, .03) * .8])
grave = ton(glisse(220, 90, .16), .16, .06) * .5
S['chomp'] = passe_bas(c, 4)
S['chomp'][:len(grave)] += grave[:len(S['chomp'])]
S['zap'] = ton(glisse(1800, 200, .22), .22, .1, 'carre') * .5
b = np.zeros(int(1.3 * SR))
for i, t0 in enumerate(np.linspace(0, 1.15, 11)):
    s = ton(880 + 110 * (i % 4), .07, .03, 'carre') * .35
    j = int(t0 * SR); b[j:j + len(s)] += s
S['blips'] = b
tk = np.zeros(int(1.2 * SR))
for i, t0 in enumerate(np.arange(0, 1.2, .3)):
    s = ton(2400 if i % 2 == 0 else 1800, .03, .01) * .5
    j = int(t0 * SR); tk[j:j + len(s)] += s
S['tick'] = tk
S['chute'] = ton(glisse(700, 90, .9), .9, .6, 'carre') * .35
a = np.zeros(int(1.4 * SR))
for i in range(4):
    s = ton(glisse(900, 1300, .3), .3, .3, 'carre') * .22
    j = int(i * .33 * SR); a[j:j + len(s)] += s
S['alarme'] = a
S['pose'] = som(ton(523, .12, .06), bruit(.12, .01) * .15) * .5
m = som(ton(glisse(160, 60, .25), .25, .08) * .9, bruit(.04, .01) * .7)
S['marteau'] = m * .8  # coup de marteau de juge (synthétisé)
S['ding'] = som(ton(1319, .9, .35), ton(1976, .9, .25) * .5) * .45

os.makedirs('audio/bruitages', exist_ok=True)
for nom, x in S.items():
    ecrire(f'audio/bruitages/{nom}.wav', x)

# Piste bruitages
sfx = np.zeros(N)
for e in TL['bruitages']:
    x = S[e['son']]; j = int(e['t'] * SR); sfx[j:j + len(x)] += x[:N - j]
ecrire('audio/piste-bruitages.wav', sfx)

# Piste voix : chaque réplique normalisée à -16 LUFS (mesure ffmpeg ebur128) puis placée.
def lufs(chemin):
    out = subprocess.run(['ffmpeg', '-nostdin', '-i', chemin, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])

voix = np.zeros(N)
if TL.get('voix_source'):  # prise continue (ElevenLabs) : placée telle quelle, fins des répliques mesurées à part
    vs = TL['voix_source']; x = lire(vs['fichier']); j = int(vs['decalage'] * SR)
    voix[j:j + len(x)] += x[:N - j]
for v in ([] if TL.get('voix_source') else TL['voix']):
    p = f"audio/voix/{v['id']}.wav"
    g = 10 ** ((-16 - lufs(p)) / 20)
    x = lire(p) * g
    x *= min(1, 0.79 / max(1e-9, np.abs(x).max()))  # crête de réplique ≤ -2 dBFS
    x[:240] *= np.linspace(0, 1, 240); x[-480:] *= np.linspace(1, 0, 480)  # anti-clics
    j = int(v['t'] * SR); voix[j:j + len(x)] += x
    v['fin'] = round(v['t'] + len(x) / SR, 3)
ecrire('audio/piste-voix-brute.wav', voix)
subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', 'audio/piste-voix-brute.wav', '-af',
                'acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-15.5:TP=-2:LRA=7,aresample=48000',
                '-ac', '1', 'audio/piste-voix.wav'], check=True)
json.dump(TL, open('sources/timeline.json', 'w'), ensure_ascii=False, indent=2)

# Mix : musique en boucle si besoin, ducking déclenché par la voix, bruitages, limiteur -1,5 dBTP.
musique = glob.glob('audio/musique-*.mp3')[0]
c = TL['carton']['debut']
filtre = (
    # La musique (24,96 s) est plus courte que l'épisode : au lieu d'une boucle qui reprendrait n'importe où,
    # elle repart du début au carton final (fondu croisé de 0,3 s), la reprise devient la ponctuation du carton.
    f"[0:a]aformat=sample_rates={SR}:channel_layouts=stereo,asplit=2[ma][mb];"
    f"[ma]atrim=0:{c + 0.3},afade=t=out:st={c}:d=0.3[m1];"
    f"[mb]atrim=0:{DUREE - c},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,adelay={int(c * 1000)}:all=1[m2];"
    f"[m1][m2]amix=inputs=2:normalize=0:duration=longest,apad,atrim=0:{DUREE},asetpts=PTS-STARTPTS,"
    f"volume=0.22,afade=t=in:d=0.2,volume='if(gte(t,{c}),1.6,1)':eval=frame,afade=t=out:st={DUREE - 1.6}:d=1.6[m];"
    f"[1:a]aformat=sample_rates={SR}:channel_layouts=stereo,asplit=2[v][vs];"
    f"[m][vs]sidechaincompress=threshold=0.015:ratio=10:attack=15:release=350:makeup=1[md];"
    f"[2:a]aformat=sample_rates={SR}:channel_layouts=stereo,volume=0.55[s];"
    f"[v][md][s]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.78:level=false,apad,atrim=0:{DUREE}[out]"
)
subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', musique, '-i', 'audio/piste-voix.wav', '-i', 'audio/piste-bruitages.wav',
                '-filter_complex', filtre, '-map', '[out]', '-ar', str(SR), '-ac', '2', 'audio/mix-final.wav'], check=True)
print('ok : audio/mix-final.wav')
