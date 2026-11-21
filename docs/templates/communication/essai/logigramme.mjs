import { writeFileSync } from 'node:fs';
const E='#141414',R='#D9302A',J='#F5B400',B='#1D4E89',P='#F0EDE6',G='#45413A';
const W=1160, CX=340;
let s='';
const t=(x,y,txt,{size=18,w=500,fill=E,anchor='middle',ls=0}={})=>{s+=`<text x="${x}" y="${y}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${txt}</text>`;};
const fleche=(x1,y1,x2,y2,c=E)=>{s+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="3"/>`;
  const a=Math.atan2(y2-y1,x2-x1),L=12;s+=`<polygon points="${x2},${y2} ${x2-L*Math.cos(a-0.45)},${y2-L*Math.sin(a-0.45)} ${x2-L*Math.cos(a+0.45)},${y2-L*Math.sin(a+0.45)}" fill="${c}"/>`;};
const mail=(y,n,titre,date,couleur)=>{s+=`<rect x="${CX-170}" y="${y}" width="340" height="74" fill="#fff" stroke="${E}" stroke-width="3"/><rect x="${CX-170}" y="${y}" width="74" height="74" fill="${couleur}"/>`;
  t(CX-133,y+48,n,{size:30,w:700,fill:couleur===J?E:'#fff'});t(CX-80,y+32,titre,{size:19,w:700,anchor:'start'});t(CX-80,y+58,date,{size:16,fill:G,anchor:'start'});return y+74;};
const losange=(y,l1,l2)=>{const h=110,w=320;s+=`<polygon points="${CX},${y} ${CX+w/2},${y+h/2} ${CX},${y+h} ${CX-w/2},${y+h/2}" fill="${P}" stroke="${E}" stroke-width="3"/>`;
  t(CX,y+h/2-4,l1,{size:16,w:600});t(CX,y+h/2+18,l2,{size:16,w:600});return {bas:y+h,milieu:y+h/2,droite:CX+w/2};};
const oui=(x,y)=>t(x+30,y-10,'oui',{size:15,w:700,fill:B});
const non=(y)=>t(CX+14,y+22,'non',{size:15,w:700,fill:R,anchor:'start'});
// Titre
t(48,62,'Essai gratuit · séquence d’e-mails',{size:34,w:700,anchor:'start'});
t(48,94,'Exemple : Floriane, « Suivi de lecture », essai du 20/11 au 4/12',{size:18,fill:G,anchor:'start'});
s+=`<rect x="48" y="112" width="120" height="6" fill="${E}"/><rect x="168" y="112" width="44" height="6" fill="${R}"/><rect x="212" y="112" width="33" height="6" fill="${J}"/><rect x="245" y="112" width="22" height="6" fill="${B}"/>`;
// Départ
s+=`<rect x="${CX-150}" y="150" width="300" height="50" rx="25" fill="${E}"/>`;t(CX,182,'20/11 · inscription à l’essai',{size:18,w:700,fill:'#fff'});
fleche(CX,200,CX,214);
let y=mail(216,'1','Merci d’essayer','20/11 · immédiat : code + lien',E);
fleche(CX,y,CX,344);
const d1=losange(344,'Achat sur Gumroad','avant le 22/11 ?');non(d1.bas);fleche(CX,d1.bas,CX,d1.bas+30);
y=mail(d1.bas+32,'2','Par où commencer','22/11 · J+2, conseils du template',B);
fleche(CX,y,CX,y+24);
const d2=losange(y+26,'Achat','avant le 1/12 ?');non(d2.bas);fleche(CX,d2.bas,CX,d2.bas+30);
y=mail(d2.bas+32,'3','Plus que 3 jours','1/12 · rappel, prix, reprise',B);
fleche(CX,y,CX,y+24);
const d3=losange(y+26,'Achat avant','le 4/12 au soir ?');non(d3.bas);const y4=d3.bas+64;fleche(CX,d3.bas,CX,y4-2);
y=mail(y4,'4','Essai terminé','5/12 · lecture seule, « pourquoi ? »',J);
fleche(CX,y,CX,y+24);
const d4=losange(y+26,'Achat','avant le 27/12 ?');non(d4.bas);fleche(CX,d4.bas,CX,d4.bas+30);
y=mail(d4.bas+32,'5','Effacement le 3/1','27/12 · dernier e-mail',J);
fleche(CX,y,CX,y+24);
const d5=losange(y+26,'Achat','avant le 3/1 ?');non(d5.bas);fleche(CX,d5.bas,CX,d5.bas+42);
// Bandes de phase (dessinées derrière)
let fond=`<rect x="110" y="300" width="560" height="${d3.bas+14-300}" fill="#E3EAF2"/><rect x="110" y="300" width="10" height="${d3.bas+14-300}" fill="${B}"/>`;
fond+=`<text x="${CX+30}" y="326" font-size="14" font-weight="700" fill="${B}" letter-spacing="1">ESSAI ACTIF · 20/11 → 4/12</text>`;
const yj=d3.bas+24;
fond+=`<rect x="110" y="${yj}" width="560" height="${d5.bas+14-yj}" fill="#FBF0CF"/><rect x="110" y="${yj}" width="10" height="${d5.bas+14-yj}" fill="${J}"/>`;
fond+=`<text x="${CX+30}" y="${yj+24}" font-size="14" font-weight="700" fill="#7A5A00" letter-spacing="1">LECTURE SEULE · 5/12 → 3/1</text>`;
s=fond+s;
// Fin
const yf=d5.bas+44;s+=`<rect x="${CX-170}" y="${yf}" width="340" height="96" fill="${R}"/>`;
t(CX,yf+34,'4/1 · données effacées',{size:20,w:700,fill:'#fff'});t(CX,yf+60,'plus aucun e-mail d’essai ; un achat ensuite',{size:15,fill:'#fff'});t(CX,yf+80,'= « achat direct », template vide',{size:15,fill:'#fff'});
// Bus achat pendant l'essai
const BX=740;
for(const d of [d1,d2,d3]){s+=`<line x1="${d.droite}" y1="${d.milieu}" x2="${BX}" y2="${d.milieu}" stroke="${B}" stroke-width="3"/>`;oui(d.droite,d.milieu);}
s+=`<line x1="${BX}" y1="${d1.milieu}" x2="${BX}" y2="${d3.milieu}" stroke="${B}" stroke-width="3"/>`;
const yA=(d1.milieu+d3.milieu)/2;fleche(BX,yA,BX+40,yA,B);
s+=`<rect x="${BX+42}" y="${yA-110}" width="330" height="220" fill="#fff" stroke="${B}" stroke-width="3"/><rect x="${BX+42}" y="${yA-110}" width="330" height="48" fill="${B}"/>`;
t(BX+207,yA-78,'ACHAT PENDANT L’ESSAI',{size:17,w:700,fill:'#fff',ls:1});
['✉ « Merci : … est à vous »','tout de suite, + reçu Gumroad','✖ Séquence d’essai arrêtée','Clé saisie → données reprises','(bouton « J’ai acheté »)'].forEach((l,i)=>t(BX+64,yA-28+i*28,l,{size:16,anchor:'start',w:i==0||i==2?700:400,fill:i==1||i==4?G:E}));
// Bus achat après
for(const d of [d4,d5]){s+=`<line x1="${d.droite}" y1="${d.milieu}" x2="${BX}" y2="${d.milieu}" stroke="${'#9A7300'}" stroke-width="3"/>`;t(d.droite+30,d.milieu-10,'oui',{size:15,w:700,fill:'#9A7300'});}
s+=`<line x1="${BX}" y1="${d4.milieu}" x2="${BX}" y2="${d5.milieu}" stroke="#9A7300" stroke-width="3"/>`;
const yB=(d4.milieu+d5.milieu)/2;fleche(BX,yB,BX+40,yB,'#9A7300');
s+=`<rect x="${BX+42}" y="${yB-110}" width="330" height="220" fill="#fff" stroke="${J}" stroke-width="3"/><rect x="${BX+42}" y="${yB-110}" width="330" height="48" fill="${J}"/>`;
t(BX+207,yB-78,'ACHAT APRÈS L’ESSAI',{size:17,w:700,fill:E,ls:1});
['✉ « Merci : … est à vous »','+ date limite de reprise (3/1)','✖ Séquence d’essai arrêtée','Clé saisie → données reprises,','modification rouverte'].forEach((l,i)=>t(BX+64,yB-28+i*28,l,{size:16,anchor:'start',w:i==0||i==2?700:400,fill:i==1||i==4?G:E}));
// Achat direct (sans essai)
s+=`<rect x="${BX+42}" y="150" width="330" height="150" fill="#fff" stroke="${E}" stroke-width="3"/><rect x="${BX+42}" y="150" width="330" height="48" fill="${E}"/>`;
t(BX+207,182,'ACHAT DIRECT (SANS ESSAI)',{size:17,w:700,fill:'#fff',ls:1});
['✉ « Merci pour votre achat »','lien de connexion + clé,','premier pas du template'].forEach((l,i)=>t(BX+64,228+i*26,l,{size:16,anchor:'start',w:i==0?700:400,fill:i?G:E}));
// Règles
const yr=yf+130;
s+=`<rect x="48" y="${yr}" width="${W-96}" height="200" fill="${P}"/><rect x="48" y="${yr}" width="8" height="200" fill="${E}"/>`;
t(76,yr+36,'Règles valables à chaque étape',{size:20,w:700,anchor:'start'});
[['Achat = paiement Gumroad avec la même adresse que l’essai : merci immédiat, séquence arrêtée.',''],
 ['Achat avec une autre adresse : merci « achat direct » ; la séquence s’arrête à la saisie de la clé.',''],
 ['« Ne plus recevoir de rappel » (bas de chaque e-mail) : plus aucun e-mail d’essai, données effacées aux mêmes dates.',''],
 ['Un seul e-mail d’essai par jour ; « par où commencer » sauté s’il n’est pas parti avant le 25/11.','']].forEach(([a,b],i)=>{t(76,yr+72+i*32,'■',{size:12,fill:[B,R,E,J][i],anchor:'start'});t(98,yr+72+i*32,a+(b?' '+b:''),{size:15,anchor:'start',w:i==0?700:400,fill:E});});
const H=yr+240;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Outfit, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>${s}</svg>`;
writeFileSync(new URL('./logigramme.svg',import.meta.url),svg);
writeFileSync(new URL('./logigramme.html',import.meta.url),`<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:Outfit;src:url(file:///home/user/qme-engineering/assets/fonts/outfit-latin.woff2) format('woff2');font-weight:100 900}@font-face{font-family:Outfit;src:url(file:///home/user/qme-engineering/assets/fonts/outfit-latin-ext.woff2) format('woff2');font-weight:100 900}body{margin:0}</style></head><body>${svg}</body></html>`);
console.log(W,H);
