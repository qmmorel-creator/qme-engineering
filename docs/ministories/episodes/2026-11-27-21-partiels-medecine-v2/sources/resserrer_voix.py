#!/usr/bin/env python3
"""Resserre les silences de la prise ElevenLabs unique (coupes dans les silences seulement, fondus 10 ms)."""
import wave, numpy as np, json
SR=48000
w=wave.open('audio/elevenlabs/voix-brute.wav'); x=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(np.float32)
# silences relevés (silencedetect -40 dB, 0,18 s) et durée gardée
S=[(1.356,1.792,.22),(3.034,3.467,.28),(6.461,6.915,.28),(9.243,9.931,.34),(10.749,11.155,.22),(12.314,12.839,.28),
   (13.709,14.032,.2),(14.900,15.304,.22),(15.926,16.427,.30),(17.261,17.742,.28),(18.171,18.512,.22)]
out=[];prev=0;carte=[]  # carte : (t brut, t resserré)
cur=0.
for a,b,k in S:
    seg=x[int(prev*SR):int((a+k/2)*SR)]; out.append(seg); cur+=len(seg)/SR
    carte.append((a+k/2,cur)); prev=b-k/2
seg=x[int(prev*SR):int(18.98*SR)]; out.append(seg)
f=int(.01*SR)
for s in out: s[:f]*=np.linspace(0,1,f); s[-f:]*=np.linspace(1,0,f)
y=np.concatenate(out)
o=wave.open('audio/elevenlabs/voix-elevenlabs.wav','wb'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR); o.writeframes(y.astype('<i2').tobytes())
print(len(y)/SR)
def m(t):
    d=0
    for a,b,k in S:
        if t>=b-k/2: d+=(b-k/2)-(a+k/2)
    return round(t-d,3)
print(json.dumps({k:[m(a),m(b)] for k,(a,b) in {'v01':(0.0,3.034),'v02':(3.467,6.461),'v03':(6.915,9.243),'v04':(9.931,12.314),'v05':(12.839,15.926),'v06':(16.427,17.261),'v07':(17.742,18.96)}.items()}))
