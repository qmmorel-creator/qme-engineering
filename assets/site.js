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

/* Catalogue des templates : filtres (usage, thème, recherche), vitrine défilante des templates en vente,
   liste compacte des templates en préparation. Sans JS, tout reste visible. État dans l'adresse
   (?pour=pro&theme=argent&q=…) ; jamais dans le # (le script de tête redirige les # inconnus vers /catalogue/). */
(()=>{const cat=document.querySelector('[data-catalogue]');if(!cat)return;
 const filtres=cat.querySelector('[data-filtres]'),champ=cat.querySelector('#catalogue-recherche'),compte=cat.querySelector('[data-compte]'),
  vitrine=cat.querySelector('[data-vitrine]'),piste=vitrine.querySelector('.vitrine-piste'),titreVit=cat.querySelector('[data-vitrine-titre]'),sousVit=cat.querySelector('[data-vitrine-sous]'),
  aVenir=cat.querySelector('[data-a-venir]'),vide=cat.querySelector('[data-vide]'),
  segs=[...cat.querySelectorAll('.segment button')],puces=[...cat.querySelectorAll('.puce')],cartes=[...cat.querySelectorAll('.carte')];
 const norm=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
 cartes.forEach(c=>c._texte=norm(c.textContent));
 const sousInit=sousVit.textContent,total=cartes.length,enVente=cartes.filter(c=>!c.classList.contains('prochaine')).length;
 const s={pour:'',theme:'',q:''};
 const p=new URLSearchParams(location.search),h=location.hash.slice(1);
 if(['pro','perso'].includes(p.get('pour')))s.pour=p.get('pour');else if(h==='pro'||h==='perso')s.pour=h;
 if(p.get('theme')&&puces.some(b=>b.dataset.theme===p.get('theme')&&(!s.pour||b.dataset.pour===s.pour))){s.theme=p.get('theme');s.pour=puces.find(b=>b.dataset.theme===s.theme).dataset.pour;}
 s.q=(p.get('q')||'').slice(0,80);champ.value=s.q;
 const compter=(chemin,titre)=>{try{window.goatcounter?.count?.({path:chemin,title:titre,event:true});}catch(e){}};
 function adresse(){const q=new URLSearchParams();if(s.pour)q.set('pour',s.pour);if(s.theme)q.set('theme',s.theme);if(s.q)q.set('q',s.q);
  const qs=q.toString();history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+(qs||h==='tous'?'#tous':''));}
 function rendre(){
  const actif=!!(s.pour||s.theme||s.q),mots=norm(s.q).split(/\s+/).filter(Boolean);
  segs.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pour===s.pour)));
  puces.forEach(b=>{b.hidden=!!s.pour&&b.dataset.pour!==s.pour;b.setAttribute('aria-pressed',String(b.dataset.theme===s.theme&&b.dataset.pour===(s.pour||b.dataset.pour)));});
  let nVente=0,nBientot=0;
  cartes.forEach(c=>{const ok=(!s.pour||c.dataset.pour===s.pour)&&(!s.theme||c.dataset.theme===s.theme)&&mots.every(m=>c._texte.includes(m));
   c.hidden=!ok;if(ok)c.classList.contains('prochaine')?nBientot++:nVente++;});
  cat.classList.toggle('filtre',actif);
  vitrine.hidden=actif&&!nVente;aVenir.hidden=!nBientot;vide.hidden=nVente+nBientot>0;
  titreVit.textContent=actif?'Disponibles':'Disponibles maintenant';
  sousVit.textContent=actif?nVente+' en vente':sousInit;
  compte.innerHTML=actif?`<b>${nVente+nBientot}</b> sur ${total} · ${nVente} en vente, ${nBientot} en préparation · <button type="button" data-effacer>Effacer les filtres</button>`:`${total} templates · ${enVente} en vente, ${total-enVente} en préparation`;
  majFleches();
 }
 function effacer(){s.pour='';s.theme='';s.q='';champ.value='';rendre();adresse();}
 segs.forEach(b=>b.addEventListener('click',()=>{s.pour=b.dataset.pour;s.theme='';rendre();adresse();if(s.pour)compter('catalogue-filtre-'+s.pour,'Catalogue : filtre '+b.textContent);}));
 puces.forEach(b=>b.addEventListener('click',()=>{const meme=s.theme===b.dataset.theme;s.theme=meme?'':b.dataset.theme;if(!meme)s.pour=b.dataset.pour;rendre();adresse();if(!meme)compter('catalogue-theme-'+b.dataset.theme,'Catalogue : thème '+b.firstChild.textContent.trim());}));
 let attente;champ.addEventListener('input',()=>{s.q=champ.value.slice(0,80);rendre();clearTimeout(attente);attente=setTimeout(adresse,400);});
 cat.addEventListener('click',e=>{if(e.target.closest('[data-effacer]')){effacer();champ.focus();}});
 /* Flèches de la vitrine */
 const fl=vitrine.querySelector('[data-fleches]'),[g,d]=fl.querySelectorAll('.fleche');
 function majFleches(){g.disabled=piste.scrollLeft<4;d.disabled=piste.scrollLeft+piste.clientWidth>=piste.scrollWidth-4;fl.hidden=cat.classList.contains('filtre')||(g.disabled&&d.disabled);}
 const doux=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
 [g,d].forEach(b=>b.addEventListener('click',()=>piste.scrollBy({left:+b.dataset.dir*piste.clientWidth*.9,behavior:doux()})));
 piste.addEventListener('scroll',majFleches,{passive:true});
 if('ResizeObserver' in window)new ResizeObserver(majFleches).observe(piste);
 filtres.hidden=false;rendre();
 if(s.pour||s.theme||s.q)requestAnimationFrame(()=>cat.scrollIntoView({block:'start'}));
})();
