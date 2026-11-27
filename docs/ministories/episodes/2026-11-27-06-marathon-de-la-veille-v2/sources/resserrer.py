# Resserre les pauses de la prise ElevenLabs unique (coupes dans le silence, fondus 5 ms) ; imprime la table ancien->nouveau temps.
import wave,numpy as np
SR=48000
w=wave.open('audio/elevenlabs/voix-elevenlabs.wav');x=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(np.float32)
sil=[(1.547,1.864,.20),(2.644,3.146,.22),(3.670,3.978,.12),(4.966,5.391,.20),(5.950,6.171,.12),(7.416,7.877,.20),(8.525,8.823,.12),
     (9.944,10.431,.22),(11.795,12.211,.32),(12.826,13.280,.20),(14.071,14.495,.20),(15.057,15.448,.14),(16.930,17.388,.20),(17.971,18.313,.16),
     (19.269,19.726,.20),(20.253,20.673,.20)]
out=[];p=0;tab=[(0,0)];n=0
for s,e,L in sil:
    a=int((s+L/2)*SR);b=int((e-L/2)*SR)
    seg=x[p:a].copy();seg[-240:]*=np.linspace(1,0,240)
    if p: seg[:240]*=np.linspace(0,1,240)
    out.append(seg);n+=len(seg);p=b;tab.append((round(e-L/2,3),round(n/SR,3)))
seg=x[p:int(21.12*SR)].copy();seg[:240]*=np.linspace(0,1,240);out.append(seg)
y=np.concatenate(out)
o=wave.open('audio/elevenlabs/voix-elevenlabs-resserree.wav','wb');o.setnchannels(1);o.setsampwidth(2);o.setframerate(SR);o.writeframes(y.astype('<i2').tobytes())
print(len(y)/SR);print(tab)
