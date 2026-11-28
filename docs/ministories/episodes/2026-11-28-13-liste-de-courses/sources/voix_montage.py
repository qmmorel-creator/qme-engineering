#!/usr/bin/env python3
"""Resserre la prise ElevenLabs unique (silences > 0,3 s ramenés à 0,2 s), puis tempo x1,06 sans changer la hauteur.
Entrée : audio/elevenlabs/voix-brute.wav (MP3 ElevenLabs converti 48 kHz mono). Sortie : audio/elevenlabs/voix-elevenlabs.wav.
Aucune syllabe n'est coupée : seules les plages sous -40 dB relevées par silencedetect sont raccourcies."""
import os, re, subprocess, wave
import numpy as np
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SR = 48000
with wave.open('audio/elevenlabs/voix-brute.wav') as w:
    x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32)
out = subprocess.run(['ffmpeg', '-nostdin', '-i', 'audio/elevenlabs/voix-brute.wav', '-af', 'silencedetect=noise=-40dB:d=0.3', '-f', 'null', '-'], capture_output=True, text=True).stderr
deb = [float(v) for v in re.findall(r'silence_start: ([\d.]+)', out)]
fin = [float(v) for v in re.findall(r'silence_end: ([\d.]+)', out)]
garde, pos = [], 0
for a, b in zip(deb, fin):
    if b >= len(x) / SR - 0.01: break
    m = (a + b) / 2
    garde.append(x[pos:int((a + 0.1) * SR)]); pos = int((b - 0.1) * SR)
garde.append(x[pos:])
y = np.concatenate(garde)
y[-2400:] *= np.linspace(1, 0, 2400)
with wave.open('audio/elevenlabs/voix-serree.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.astype('<i2').tobytes())
subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', 'audio/elevenlabs/voix-serree.wav', '-af', 'atempo=1.06', '-ar', '48000', '-ac', '1', 'audio/elevenlabs/voix-elevenlabs.wav'], check=True)
print(len(x) / SR, len(y) / SR)
