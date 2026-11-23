import { writeFileSync } from 'node:fs';
const E='#141414',R='#D9302A',J='#F5B400',B='#1D4E89',P='#F0EDE6',G='#45413A';
const LANES=[['Client','navigateur, téléphone',E],['Gumroad','paiement, clés',R],['Site QME','fonctions Netlify',B],['Données','Netlify Blobs, Francfort',G],['E-mails','SMTP OVH, qm-engineering.fr','#9A7300']];
const W=1640, X0=200, LW=280, BW=236;
const lx=(i)=>X0+i*LW+LW/2;
let s='', fond='';
const esc=(t)=>t.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const t=(x,y,txt,{size=15,w=400,fill=E,anchor='middle',ls=0}={})=>{s+=`<text x="${x}" y="${y}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${esc(txt)}</text>`;};
const fleche=(x1,y1,x2,y2,c=E,both=false)=>{s+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2.5"/>`;
  const tete=(xa,ya,xb,yb)=>{const a=Math.atan2(yb-ya,xb-xa),L=11;s+=`<polygon points="${xb},${yb} ${xb-L*Math.cos(a-0.45)},${yb-L*Math.sin(a-0.45)} ${xb-L*Math.cos(a+0.45)},${yb-L*Math.sin(a+0.45)}" fill="${c}"/>`;};
  tete(x1,y1,x2,y2); if(both) tete(x2,y2,x1,y1);};
const boite=(lane,yc,lignes,{h=78,c=LANES[lane][2],fill='#fff',titre=true}={})=>{const x=lx(lane)-BW/2,y=yc-h/2;
  s+=`<rect x="${x}" y="${y}" width="${BW}" height="${h}" fill="${fill}" stroke="${c}" stroke-width="2.5"/><rect x="${x}" y="${y}" width="6" height="${h}" fill="${c}"/>`;
  const n=lignes.length, y0=yc-(n-1)*9+5; lignes.forEach((l,i)=>t(lx(lane)+3,y0+i*18,l,{size:i==0&&titre?15:13.5,w:i==0&&titre?700:400,fill:i==0?E:G}));
  return {g:x,d:x+BW,yc};};
const lien=(a,b,yc,lab,{c=E,both=false,dy=0}={})=>{const x1=a.d,x2=b.g;fleche(x1+2,yc+dy,x2-3,yc+dy,c,both);if(lab)t((x1+x2)/2,yc+dy-8,lab,{size:12.5,w:700,fill:c});};
// En-tête
t(48,58,'Essai et achat des templates · circuit technique',{size:32,w:700,anchor:'start'});
t(48,88,'Qui fait quoi, du formulaire d’essai à l’activation de la clé achetée (état au 21/11/2026)',{size:17,fill:G,anchor:'start'});
s+=`<rect x="48" y="104" width="120" height="6" fill="${E}"/><rect x="168" y="104" width="44" height="6" fill="${R}"/><rect x="212" y="104" width="33" height="6" fill="${J}"/><rect x="245" y="104" width="22" height="6" fill="${B}"/>`;
// Couloirs
const YT=140, rows=[['1','ESSAI',178],['2','UTILISATION',150],['3','CHAQUE MATIN',170],['4','ACHAT',210],['5','ACTIVATION',190]];
let H=YT+70; const ry=[]; for(const r of rows){ry.push(H);H+=r[2];}
LANES.forEach(([n,sub,c],i)=>{const x=X0+i*LW;fond+=`<rect x="${x+6}" y="${YT}" width="${LW-12}" height="${H-YT}" fill="${i%2?'#FAF8F4':'#F4F1EA'}"/>`;
  fond+=`<rect x="${x+6}" y="${YT}" width="${LW-12}" height="56" fill="${c}"/><text x="${x+LW/2}" y="${YT+25}" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">${n}</text><text x="${x+LW/2}" y="${YT+45}" font-size="13" fill="#fff" text-anchor="middle">${sub}</text>`;});
rows.forEach(([num,nom,h],i)=>{const y=ry[i];fond+=`<line x1="48" y1="${y}" x2="${W-40}" y2="${y}" stroke="#d6d1c7" stroke-width="1.5"/>`;
  fond+=`<rect x="48" y="${y+14}" width="44" height="44" fill="${E}"/><text x="70" y="${y+44}" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">${num}</text><text x="48" y="${y+80}" font-size="14" font-weight="700" fill="${E}" letter-spacing="1">${nom}</text>`;});
const mid=(i)=>ry[i]+rows[i][2]/2;
// 1 ESSAI
{const y=mid(0);const a=boite(0,y,['Formulaire /essai/','template, prénom, e-mail']);const b=boite(2,y,['POST /api/essai','code daté et signé (14 j)'],{h:86});
 const c=boite(3,y,['Registre de l’essai','essai/<id>, e-mail → empreinte']);const d=boite(4,y,['✉ Merci d’essayer','+ « Nouvel essai » à Quentin'],{h:86});
 lien(a,b,y,'');lien(b,c,y,'');lien(c,d,y,'');}
// 2 UTILISATION
{const y=mid(1);const a=boite(0,y,['Template ?essai=CODE','bandeau « encore N jours »']);const b=boite(2,y,['/api/templates','écriture refusée après la fin']);
 const c=boite(3,y,['Données de l’essai','gardées 30 j après la fin']);lien(a,b,y,'lit / enregistre',{both:true});lien(b,c,y,'',{both:true});}
// 3 CHAQUE MATIN
{const y=mid(2);const b=boite(2,y,['Tâche 9:10 (Paris)','essais-quotidien'],{h:86});const c=boite(3,y,['Lit chaque essai','efface à fin + 30 j'],{h:86});
 const d=boite(4,y,['✉ Relances d’essai','J+2 · J−3 · fin · effacement −7 j','sauf si payé, acheté ou arrêté'],{h:96,titre:true});lien(b,c,y,'');lien(c,d,y,'');}
// 4 ACHAT
{const y=mid(3);const a=boite(0,y,['Paiement','sur la fiche Gumroad']);const g=boite(1,y-34,['Reçu + clé','envoyés par Gumroad'],{h:66});
 const g2=boite(1,y+52,['licenses/verify','vente réelle ?'],{h:62});
 const b=boite(2,y-34,['POST /api/achat','ping de vente'],{h:66});const c=boite(3,y,['achat/<empreinte>','essai marqué « payé »'],{h:86});
 const d=boite(4,y,['✉ Merci pour l’achat','direct ou après essai','+ « Nouvelle vente » à Quentin'],{h:96});
 lien(a,g,y-34,'');lien(g,b,y-34,'ping');fleche(b.g+40,y-1,g2.d+3,y+52,R);t(b.g+62,y+30,'vérifie la licence',{size:12.5,w:700,fill:R,anchor:'start'});
 fleche(b.d+2,y-34,c.g-3,y-10,E);lien(c,d,y,'');}
// 5 ACTIVATION
{const y=mid(4);const a=boite(0,y-30,['Clé saisie','« J’ai acheté » ou /connexion/']);const b=boite(2,y-30,['/api/templates/connexion','clé → espace acheté'],{h:78});
 const g=boite(1,y+50,['licenses/verify','e-mail de l’acheteur'],{h:62});const c=boite(3,y-30,['Reprise de l’essai','copié dans l’espace acheté'],{h:78});
 fleche(a.d+2,y-30,b.g-3,y-30,E);t((a.d+b.g)/2,y-38,'',{});fleche(b.g+40,y+9,g.d+3,y+50,R);t(b.g+62,y+36,'vérifie la licence',{size:12.5,w:700,fill:R,anchor:'start'});
 lien(b,c,y-30,'');}
// Légende
const yl=H+28;
s+=`<rect x="48" y="${yl}" width="${W-88}" height="128" fill="${P}"/><rect x="48" y="${yl}" width="8" height="128" fill="${E}"/>`;
t(76,yl+34,'À retenir',{size:19,w:700,anchor:'start'});
['Une vente n’est traitée qu’une fois : un ping renvoyé par Gumroad (ou le bouton de test, qui rejoue la dernière vente) ne renvoie pas d’e-mail.',
 'Le paiement arrête la séquence d’essai (même adresse que l’essai) ; la reprise des données se fait à la saisie de la clé, avant l’effacement.',
 'Code : netlify/lib/essais.mjs, achats.mjs, templates-acces.mjs · doc : docs/templates/essai-gratuit.md'].forEach((l,i)=>t(76,yl+64+i*24,l,{size:14,anchor:'start',fill:i==2?G:E}));
H=yl+160;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Outfit, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>${fond}${s}</svg>`;
writeFileSync(new URL('./workflow.html',import.meta.url),`<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:Outfit;src:url(file:///home/user/qme-engineering/assets/fonts/outfit-latin.woff2) format('woff2');font-weight:100 900}@font-face{font-family:Outfit;src:url(file:///home/user/qme-engineering/assets/fonts/outfit-latin-ext.woff2) format('woff2');font-weight:100 900}body{margin:0}</style></head><body>${svg}</body></html>`);
console.log(W,H);
