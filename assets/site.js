const header=document.querySelector('.topbar');
const menu=document.querySelector('.menu');
menu.addEventListener('click',()=>{const open=header.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
document.querySelectorAll('.topbar a').forEach(a=>a.addEventListener('click',()=>{header.classList.remove('open');menu.setAttribute('aria-expanded','false');}));
document.querySelectorAll('.accordions details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('.accordions details').forEach(o=>{if(o!==d)o.open=false;});}));
document.getElementById('year').textContent=new Date().getFullYear();

// Textes selon la langue de la page (<html lang>). Les valeurs du formulaire (dont `need`)
// restent en français sur les deux pages : seul l'affichage change.
const EN=document.documentElement.lang==='en';
const T=EN?{
  success:'Your request has been sent. QME will get back to you after reviewing it.',
  sending:'Sending…',
  tooMany:'Too many requests right now. Try again in a few minutes, or write directly to quentin.morel@qm-engineering.fr.',
  failed:'Sending failed. Try again, or write directly to quentin.morel@qm-engineering.fr.',
  offline:'Sending failed (connection). Try again, or write directly to quentin.morel@qm-engineering.fr.',
  soundOn:'Turn sound on',soundOff:'Turn sound off',
}:{
  success:'Votre demande a bien été transmise. QME reviendra vers vous après analyse.',
  sending:'Envoi en cours…',
  tooMany:'Trop de demandes pour le moment. Réessayez dans quelques minutes, ou écrivez directement à quentin.morel@qm-engineering.fr.',
  failed:'L’envoi a échoué. Réessayez, ou écrivez directement à quentin.morel@qm-engineering.fr.',
  offline:'L’envoi a échoué (connexion). Réessayez, ou écrivez directement à quentin.morel@qm-engineering.fr.',
  soundOn:'Activer le son',soundOff:'Couper le son',
};

function mailtoFallback(data){
  const needLabel=form.elements.need.selectedOptions[0]?.textContent||data.get('need');
  const subject=EN?`QME project — ${needLabel}`:`Projet QME — ${needLabel}`;
  const body=(EN
    ?[`Hello Quentin,`,``,`I am contacting you about: ${needLabel}.`,``,`Organization: ${data.get('company')||'Not specified'}`,`Name: ${data.get('name')}`,`Email: ${data.get('email')}`,``,`Context:`,` ${data.get('message')}`]
    :[`Bonjour Quentin,`,``,`Je vous contacte au sujet de : ${needLabel}.`,``,`Organisation : ${data.get('company')||'Non précisée'}`,`Nom : ${data.get('name')}`,`Email : ${data.get('email')}`,``,`Contexte :`,` ${data.get('message')}`]).join('\n');
  return `mailto:quentin.morel@qm-engineering.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const form=document.getElementById('contact-form');
const note=document.getElementById('form-note');
const submitButton=form?.querySelector('button[type="submit"]');
const submitLabel=submitButton?.textContent;

function setNote(text,status){
  note.textContent=text;
  note.classList.remove('success','error');
  if(status)note.classList.add(status);
}

if(form)form.addEventListener('submit',async e=>{
  e.preventDefault();
  // Honeypot : un visiteur humain ne remplit jamais ce champ masqué.
  // On affiche le message de succès sans rien envoyer (Netlify filtre aussi
  // ce champ côté serveur grâce à l'attribut netlify-honeypot).
  const data=new FormData(e.currentTarget);
  if((data.get('company_website')||'').toString().trim()!==''){
    setNote(T.success,'success');
    form.reset();
    return;
  }

  submitButton.disabled=true;
  submitButton.textContent=T.sending;
  setNote(T.sending,null);

  try{
    // Netlify Forms : envoi encodé comme un formulaire HTML classique vers la racine du site.
    const response=await fetch('/',{
      method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams(data).toString(),
    });
    if(response.ok){
      setNote(T.success,'success');
      form.reset();
    }else if(response.status===429){
      setNote(T.tooMany,'error');
    }else{
      setNote(T.failed,'error');
    }
  }catch{
    setNote(T.offline,'error');
  }finally{
    submitButton.disabled=false;
    submitButton.textContent=submitLabel;
  }
});

// Solution de repli accessible : un visiteur peut toujours préparer un
// courriel prérempli sans dépendre de l'envoi du formulaire (lien mailto, jamais retiré).
const fallbackLink=document.getElementById('contact-fallback');
if(fallbackLink&&form){
  fallbackLink.addEventListener('click',e=>{
    e.preventDefault();
    window.location.href=mailtoFallback(new FormData(form));
  });
}

// Vidéo de présentation : lecture sans son quand elle est visible, son à la demande
(()=>{const v=document.getElementById('film');const b=document.getElementById('film-sound');if(!v||!b)return;
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!reduce&&'IntersectionObserver' in window){new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){v.play().catch(()=>{});}else{v.pause();}}),{threshold:.4}).observe(v);}
 const sync=()=>{b.setAttribute('aria-pressed',String(!v.muted));b.textContent=v.muted?T.soundOn:T.soundOff;};
 b.addEventListener('click',()=>{v.muted=!v.muted;if(!v.muted){v.play().catch(()=>{});}sync();});
 v.addEventListener('volumechange',sync);})();

// Formulaire « Soumettre une idée » (page Templates), envoyé à Netlify Forms comme le contact
(()=>{const d=document.getElementById('modale-idee');const f=document.getElementById('idee-form');if(!d||!f)return;
 const n=document.getElementById('idee-note');const b=f.querySelector('button[type="submit"]');const lib=b.textContent;const noteInit=n.innerHTML;
 const etat=(t,c)=>{n.textContent=t;n.classList.remove('success','error');if(c)n.classList.add(c);};
 document.querySelectorAll('[data-ouvrir-idee]').forEach(x=>x.addEventListener('click',()=>{n.innerHTML=noteInit;n.classList.remove('success','error');d.showModal();}));
 d.querySelectorAll('[data-fermer-idee]').forEach(x=>x.addEventListener('click',()=>d.close()));
 d.addEventListener('click',e=>{if(e.target===d)d.close();});
 f.addEventListener('submit',async e=>{e.preventDefault();const data=new FormData(f);
  if((data.get('site_web')||'').toString().trim()!==''){etat('Merci, votre idée a bien été transmise.','success');f.reset();return;}
  b.disabled=true;b.textContent='Envoi…';
  try{const r=await fetch('/',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data).toString()});
   if(r.ok){etat('Merci, votre idée a bien été transmise.','success');f.reset();}
   else etat(r.status===429?'Trop d’envois pour le moment. Réessayez dans quelques minutes.':'L’envoi a échoué. Réessayez dans un instant.','error');}
  catch{etat('L’envoi a échoué (connexion). Réessayez dans un instant.','error');}
  finally{b.disabled=false;b.textContent=lib;}});})();

// Bouton « Je suis intéressé(e) » (templates en mise en vente prochaine) : un clic compté par navigateur.
// Seuls le template et l'heure sont enregistrés ; le navigateur retient qu'il a déjà cliqué.
// Après le clic, champ e-mail facultatif pour être prévenu de la mise en vente.
(()=>{document.querySelectorAll('[data-interet]').forEach(b=>{
 const m=b.dataset.interet,objet=m.startsWith('pack-')?'ce pack':'ce template',cle='qme-interet-'+m,cleMail='qme-interet-email-'+m,note=document.querySelector(`[data-interet-note="${m}"]`);
 const lireLS=(k)=>{try{return localStorage.getItem(k)==='1';}catch{return false;}};
 const ecrireLS=(k)=>{try{localStorage.setItem(k,'1');}catch{}};
 const formulaire=()=>{
  if(lireLS(cleMail)||document.getElementById('interet-email-'+m))return;
  const f=document.createElement('form');f.className='interet-email';f.id='interet-email-'+m;f.noValidate=true;
  f.innerHTML=`<label for="interet-champ-${m}">Être prévenu par e-mail à la mise en vente <small>(facultatif)</small></label>
   <div class="interet-ligne"><input id="interet-champ-${m}" type="email" autocomplete="email" inputmode="email" maxlength="254" placeholder="vous@exemple.fr" required><button class="btn" type="submit">M'avertir</button></div>
   <p class="interet-mention">Adresse utilisée uniquement pour vous prévenir de la mise en vente de ${objet}, puis effacée. Voir la <a href="/confidentialite/">politique de confidentialité</a>.</p>`;
  (note||b).after(f);
  const champ=f.querySelector('input'),envoi=f.querySelector('button'),mention=f.querySelector('.interet-mention');
  f.addEventListener('submit',async(e)=>{e.preventDefault();
   const email=champ.value.trim();
   if(!/^[^\s@";<>,]+@[^\s@";<>,]+\.[^\s@";<>,]{2,}$/.test(email)){mention.textContent='Adresse e-mail invalide.';mention.classList.add('erreur');champ.focus();return;}
   envoi.disabled=true;
   try{const r=await fetch('/api/interets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({module:m,email})});
    if(!r.ok)throw new Error();
    ecrireLS(cleMail);
    f.innerHTML='<p class="interet-merci">C’est noté : vous recevrez un e-mail à la mise en vente.</p>';
   }catch{envoi.disabled=false;mention.textContent='L’envoi a échoué. Réessayez dans un instant.';mention.classList.add('erreur');}
  });
 };
 const fait=(t)=>{b.disabled=true;b.textContent='Intérêt enregistré';b.classList.add('fait');if(note)note.textContent=t;formulaire();};
 if(lireLS(cle))fait(lireLS(cleMail)?'Votre intérêt est déjà compté, et vous serez prévenu à la mise en vente. Merci !':'Votre intérêt est déjà compté. Merci !');
 b.addEventListener('click',async()=>{
  if(lireLS(cle))return;
  b.disabled=true;
  try{const r=await fetch('/api/interets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({module:m})});
   if(!r.ok)throw new Error();
   ecrireLS(cle);
   fait(`Merci, c’est noté : ${objet} passe en priorité quand l’intérêt est là.`);
  }catch{b.disabled=false;if(note)note.textContent='L’envoi a échoué. Réessayez dans un instant.';}
 });});})();

/* Catalogue des templates (simplifié le 20/11/2026). Les cartes du HTML (.vitrine-piste pour les templates en
   vente, .liste-bientot pour ceux en préparation) et les puces de thème restent la source : sans JS, elles
   s'affichent telles quelles. Avec JS, une seule façon de parcourir :
   - par défaut, une tuile par thème (nombre d'outils, prix d'entrée, exemples), groupées Pro / Perso ;
   - un clic sur une tuile affiche les outils de ce thème (?theme=…), avec la vignette de chacun (data-vignette des
     cartes, écrit par outils/templates/vignettes.mjs ; chargée seulement quand le thème est ouvert),
     « Tous les thèmes » ramène aux tuiles ;
   - une recherche affiche directement les outils trouvés, tous thèmes confondus.
   Filtre Pro / Perso sur les deux. Templates en préparation masqués par défaut (?avenir=1 les affiche),
   toujours montrés pendant une recherche. Jamais d'état dans le # (le script de tête redirige les # inconnus). */
(()=>{const cat=document.querySelector('[data-catalogue]');if(!cat)return;
 const $=(sel,el=cat)=>el.querySelector(sel),$$=(sel,el=cat)=>[...el.querySelectorAll(sel)];
 const filtres=$('[data-filtres]'),champ=$('#catalogue-recherche'),compte=$('[data-compte]'),vues=$('[data-vues]'),vide=$('[data-vide]');
 const segs=$$('.segment button');
 const norm=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
 const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const texte=(el,sel)=>el.querySelector(sel)?.textContent.trim()||'';
 const themes=$$('.puce').map(b=>({id:b.dataset.theme,pour:b.dataset.pour,nom:b.firstChild.textContent.trim(),c:b.style.getPropertyValue('--c')}));
 /* Un template générique peut appartenir aux deux parties : data-pour="pro perso" et un thème par partie
    (data-theme="organisation-et-etudes clients-et-prospection"), lus comme des listes. */
 const items=$$('.carte').map(c=>{const a=c.querySelector('a'),prochaine=c.classList.contains('prochaine');
  const it={slug:c.dataset.slug,pours:(c.dataset.pour||'').split(/\s+/).filter(Boolean),themes:(c.dataset.theme||'').split(/\s+/).filter(Boolean),href:a.getAttribute('href'),nom:texte(c,'b'),phrase:texte(c,'.phrase'),vente:!prochaine,prix:prochaine?'':texte(c,'.pied em'),vignette:c.dataset.vignette||''};
  it.euros=parseFloat(it.prix.replace(',','.'));it._t=norm(it.nom+' '+it.phrase+' '+it.themes.map(id=>themes.find(t=>t.id===id)?.nom||'').join(' '));return it;});
 const s={pour:'',q:'',theme:'',avenir:false};
 /* Pages /pro/ et /perso/ : la partie est fixée par la page (data-pour-fixe), pas par l'adresse ; les compteurs ne comptent qu'elle. */
 const fixe=document.querySelector('[data-catalogue]')?.dataset.pourFixe||'';
 const partie=items.filter(t=>!fixe||t.pours.includes(fixe));
 const total=partie.length,enVente=partie.filter(t=>t.vente).length;
 const p=new URLSearchParams(location.search),h=location.hash.slice(1);
 if(fixe)s.pour=fixe;else if(['pro','perso'].includes(p.get('pour')))s.pour=p.get('pour');else if(h==='pro'||h==='perso')s.pour=h;
 if(themes.some(t=>t.id===p.get('theme')))s.theme=p.get('theme');
 if(p.get('avenir')==='1')s.avenir=true;
 s.q=(p.get('q')||'').slice(0,80);champ.value=s.q;
 const compter=(chemin,titre)=>{try{window.goatcounter?.count?.({path:chemin,title:titre,event:true});}catch(e){}};
 function adresse(){const q=new URLSearchParams();if(s.pour&&!fixe)q.set('pour',s.pour);if(s.q)q.set('q',s.q);if(s.theme&&!s.q)q.set('theme',s.theme);if(s.avenir)q.set('avenir','1');
  const qs=q.toString();history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+(qs||h==='tous'?'#tous':''));}
 /* Construction, une seule fois : tuiles des thèmes, puis la liste de tous les outils (filtrée à l'affichage) */
 const groupes=[['pro','Professionnel'],['perso','Vie personnelle']].filter(g=>!fixe||g[0]===fixe);
 const couleur=id=>themes.find(x=>x.id===id)?.c||'var(--trait)';
 /* Thème affiché d'un outil : celui de la partie fixée par la page, sinon le premier. */
 const themeDe=t=>t.themes.find(id=>!fixe||themes.find(x=>x.id===id)?.pour===fixe)||t.themes[0];
 const tuile=t=>`<button type="button" class="tuile" data-tuile="${t.id}" style="--c:${t.c}"><b>${esc(t.nom)}</b><span class="tuile-cpt" data-cpt></span><span class="tuile-ex" data-ex></span></button>`;
 const outil=t=>`<li class="outil${t.vente?'':' prochaine'}" data-slug="${esc(t.slug)}" data-pour="${esc(t.pour)}" style="--c:${couleur(themeDe(t))}"><a href="${esc(t.href)}">${t.vignette?`<img src="${esc(t.vignette)}" width="480" height="300" loading="lazy" alt="">`:''}<b>${esc(t.nom)}</b><span class="phrase">${esc(t.phrase)}</span><em>${t.vente?esc(t.prix):'Bientôt'}</em></a></li>`;
 vues.innerHTML=`<div class="tuiles" data-tuiles>`+groupes.map(([g,nom])=>`<div class="groupe-tuiles" data-groupe="${g}"><h3>${nom}</h3><div class="grille-tuiles">${themes.filter(t=>t.pour===g).map(tuile).join('')}</div></div>`).join('')+`</div>`
  +`<div class="liste-outils" data-liste><div class="liste-tete"><button type="button" class="retour" data-retour>← Tous les thèmes</button><h3 data-liste-titre tabindex="-1"></h3></div><ul class="grille-outils">${[...items].sort((a,b)=>b.vente-a.vente).map(outil).join('')}</ul></div>`;
 $$('.vitrine,.a-venir-catalogue,.puces').forEach(el=>el.hidden=true);
 const parSlug={};items.forEach(t=>parSlug[t.slug]=t);
 const tuiles=$$('.tuile',vues),lis=$$('.outil',vues),liste=$('[data-liste]',vues),blocTuiles=$('[data-tuiles]',vues),titre=$('[data-liste-titre]',vues);
 function rendre(){
  const mots=norm(s.q).split(/\s+/).filter(Boolean),avenir=s.avenir||mots.length>0,actif=!!(s.pour||mots.length);
  const ok=t=>(avenir||t.vente)&&(!s.pour||t.pours.includes(s.pour))&&mots.every(m=>t._t.includes(m));
  segs.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pour===s.pour)));
  const enListe=!!(s.theme||mots.length);
  blocTuiles.hidden=enListe;liste.hidden=!enListe;
  let n=0;
  if(enListe){for(const li of lis){const t=parSlug[li.dataset.slug],v=ok(t)&&(mots.length>0||t.themes.includes(s.theme));li.hidden=!v;if(v)n++;}
   titre.textContent=mots.length?`Résultats pour « ${s.q.trim()} »`:themes.find(t=>t.id===s.theme).nom;}
  else{for(const b of tuiles){const l=items.filter(t=>t.themes.includes(b.dataset.tuile)&&ok(t)),prix=l.filter(t=>t.vente).map(t=>t.euros).filter(x=>x>0);
    b.hidden=!l.length;n+=l.length;
    b.querySelector('[data-cpt]').textContent=`${l.length} outil${l.length>1?'s':''}${prix.length?` · dès ${Math.min(...prix).toLocaleString('fr-FR')} €`:''}`;
    b.querySelector('[data-ex]').textContent=l.slice(0,3).map(t=>t.nom).join(' · ');}
   for(const g of $$('.groupe-tuiles',vues))g.hidden=!$$('.tuile',g).some(x=>!x.hidden);}
  vide.hidden=n>0;vues.hidden=!n;
  const bascule=mots.length?'':` · <button type="button" data-avenir>${s.avenir?'Masquer les templates en préparation':`Afficher aussi les ${total-enVente} en préparation`}</button>`;
  const effacer=actif?' · <button type="button" data-effacer>Effacer les filtres</button>':'';
  compte.innerHTML=`<b>${enVente}</b> templates en vente${s.avenir?`, ${total-enVente} en préparation`:''}${bascule}${effacer}`;
 }
 segs.forEach(b=>b.addEventListener('click',()=>{s.pour=b.dataset.pour;rendre();adresse();if(s.pour)compter('catalogue-filtre-'+s.pour,'Catalogue : filtre '+b.textContent);}));
 let attente;champ.addEventListener('input',()=>{s.q=champ.value.slice(0,80);rendre();clearTimeout(attente);attente=setTimeout(adresse,400);});
 cat.addEventListener('click',e=>{const t=e.target.closest('[data-tuile]');
  if(t){s.theme=t.dataset.tuile;rendre();adresse();cat.scrollIntoView({block:'start'});titre.focus({preventScroll:true});compter('catalogue-theme-'+s.theme,'Catalogue : thème '+texte(t,'b'));}
  else if(e.target.closest('[data-retour]')){const id=s.theme;s.theme='';s.q='';champ.value='';rendre();adresse();$(`[data-tuile="${id}"]`,vues)?.focus();}
  else if(e.target.closest('[data-effacer]')){s.pour=fixe;s.q='';champ.value='';rendre();adresse();champ.focus();}
  else if(e.target.closest('[data-avenir]')){s.avenir=!s.avenir;rendre();adresse();$('[data-avenir]')?.focus();if(s.avenir)compter('catalogue-avenir','Catalogue : templates en préparation affichés');}});
 filtres.hidden=false;rendre();
 if(s.theme||(s.pour&&!fixe)||s.q)requestAnimationFrame(()=>cat.scrollIntoView({block:'start'}));
})();

/* Attribution des achats Gumroad (20/11/2026) : les UTM d'arrivée sur le site (lien d'une publication, d'un Short…)
   sont gardés pour toute la visite dans l'onglet, puis ajoutés à chaque lien Gumroad au moment du clic, avec la page
   de départ en utm_content. Sans UTM, la source est le site référent, sinon « qm-engineering.fr ». Gumroad les
   restitue sur chaque vente (compteur réseaux : ventes par source). */
(()=>{
 const CLES=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'],MEMO='qme-utm';
 let m={};try{m=JSON.parse(sessionStorage.getItem(MEMO)||'{}')||{};}catch(e){m={};}
 const garder=()=>{try{sessionStorage.setItem(MEMO,JSON.stringify(m));}catch(e){}};
 const p=new URLSearchParams(location.search);
 if(CLES.some(k=>p.get(k))){m={};CLES.forEach(k=>{const v=p.get(k);if(v)m[k]=v.slice(0,100);});garder();}
 else if(!m.utm_source&&document.referrer){
  try{const r=new URL(document.referrer);if(r.hostname&&r.hostname!==location.hostname){m={utm_source:r.hostname.replace(/^www\./,'').slice(0,100),utm_medium:'referral'};garder();}}catch(e){}
 }
 const marquer=a=>{
  try{
   const u=new URL(a.href);
   if(!/(^|\.)gumroad\.com$/.test(u.hostname)||!u.pathname.startsWith('/l/'))return;
   const v=m.utm_source?{...m}:{utm_source:'qm-engineering.fr',utm_medium:'site'};
   if(!v.utm_content)v.utm_content=(location.pathname.replace(/\/+$/,'')||'/').slice(0,100);
   Object.entries(v).forEach(([k,x])=>{if(!u.searchParams.has(k))u.searchParams.set(k,x);});
   a.href=u.toString();
  }catch(e){}
 };
 const surLien=e=>{const a=e.target.closest?.('a[href*="gumroad.com/l/"]');if(a)marquer(a);};
 ['pointerdown','click','auxclick','contextmenu','keydown'].forEach(t=>document.addEventListener(t,surLien,true));
})();

// « Mon espace » dans le menu dès qu'un compte est connecté sur l'appareil (session qme-compte, assets/compte.js) :
// initiale du prénom (ou de l'adresse) et libellé. Rien ne change pour un visiteur non connecté.
function menuMonEspace(){try{
  const s=JSON.parse(localStorage.getItem('qme-compte')||'null'),en=document.documentElement.lang==='en';
  for(const a of document.querySelectorAll('.topbar a.login')){
    if(!a.dataset.libelle)a.dataset.libelle=a.textContent;
    if(!s||!s.jeton){a.classList.remove('mon-espace');a.textContent=a.dataset.libelle;a.removeAttribute('title');a.style.display=a.style.alignItems=a.style.gap='';continue;}
    const p=JSON.parse(localStorage.getItem('qme-espace-prenom')||'""')||'';
    const ini=String(p||s.email||'?').trim().charAt(0).toUpperCase().replace(/[^\p{L}\p{N}?]/gu,'');
    // Styles en ligne : la pastille s'affiche même si une ancienne feuille de style est encore en cache.
    a.classList.add('mon-espace');a.title=s.email||'';a.style.display='inline-flex';a.style.alignItems='center';a.style.gap='8px';
    a.innerHTML=`<span class="ini" aria-hidden="true" style="width:24px;height:24px;border-radius:50%;display:inline-grid;place-items:center;background:#24221F;color:#FBF7F1;font:700 12px/1 Outfit,system-ui,sans-serif;flex:none">${ini}</span>${en?'My space':'Mon espace'}`;
  }
}catch{/* stockage indisponible : menu inchangé */}}
menuMonEspace();
