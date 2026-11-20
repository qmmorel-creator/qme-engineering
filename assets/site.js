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

/* Catalogue des templates (décision de Quentin, 14/11/2026). Les cartes du HTML (.vitrine-piste pour les
   templates en vente, .liste-bientot pour ceux en préparation) et les puces de thème restent la source : sans
   JS, elles s'affichent telles quelles. Avec JS, elles sont relues pour construire deux vues :
   - « Par thème » : accordéon, « Disponibles maintenant » ouvert, puis un volet par thème (groupés Pro /
     Perso), templates en vente en tête de chaque volet ;
   - « Sommaire » : tout le catalogue en colonnes, un bloc par thème.
   Recherche et filtre Pro / Perso s'appliquent aux deux. Templates en préparation masqués par défaut
   (réorganisation du 20/11/2026), affichés au clic (?avenir=1) ou dès qu'une recherche est saisie.
   État dans l'adresse (?pour=pro&q=…&vue=sommaire&avenir=1 ;
   ?theme=… ouvre un volet) ; jamais dans le # (le script de tête redirige les # inconnus vers /catalogue/). */
(()=>{const cat=document.querySelector('[data-catalogue]');if(!cat)return;
 const $=(sel,el=cat)=>el.querySelector(sel),$$=(sel,el=cat)=>[...el.querySelectorAll(sel)];
 const filtres=$('[data-filtres]'),champ=$('#catalogue-recherche'),compte=$('[data-compte]'),vues=$('[data-vues]'),vide=$('[data-vide]');
 const segs=$$('.segment:not(.vues) button'),boutonsVue=$$('.segment.vues button');
 const norm=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
 const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const texte=(el,sel)=>el.querySelector(sel)?.textContent.trim()||'';
 const themes=$$('.puce').map(b=>({id:b.dataset.theme,pour:b.dataset.pour,nom:b.firstChild.textContent.trim(),c:b.style.getPropertyValue('--c')}));
 const items=$$('.carte').map(c=>{const a=c.querySelector('a'),prochaine=c.classList.contains('prochaine');
  const it={slug:c.dataset.slug,pour:c.dataset.pour,theme:c.dataset.theme,href:a.getAttribute('href'),nom:texte(c,'b'),phrase:texte(c,'.phrase'),vente:!prochaine,prix:prochaine?'':texte(c,'.pied em')};
  it._t=norm(it.nom+' '+it.phrase+' '+(themes.find(t=>t.id===it.theme)?.nom||''));return it;});
 const dispoDabord=l=>[...l].sort((a,b)=>b.vente-a.vente);
 const total=items.length,enVente=items.filter(t=>t.vente).length;
 const s={pour:'',q:'',vue:'themes',theme:'',avenir:false};
 const p=new URLSearchParams(location.search),h=location.hash.slice(1);
 if(['pro','perso'].includes(p.get('pour')))s.pour=p.get('pour');else if(h==='pro'||h==='perso')s.pour=h;
 if(themes.some(t=>t.id===p.get('theme')))s.theme=p.get('theme');
 if(p.get('vue')==='sommaire')s.vue='sommaire';
 if(p.get('avenir')==='1')s.avenir=true;
 s.q=(p.get('q')||'').slice(0,80);champ.value=s.q;
 const compter=(chemin,titre)=>{try{window.goatcounter?.count?.({path:chemin,title:titre,event:true});}catch(e){}};
 function adresse(){const q=new URLSearchParams();if(s.pour)q.set('pour',s.pour);if(s.q)q.set('q',s.q);if(s.vue!=='themes')q.set('vue',s.vue);if(s.avenir)q.set('avenir','1');
  const qs=q.toString();history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+(qs||h==='tous'?'#tous':''));}
 /* Construction des deux vues, une seule fois */
 const etat=t=>t.vente?`<em class="tarif">${esc(t.prix)}</em>`:'<em class="bientot">Bientôt</em>';
 const ligne=t=>`<li class="${t.vente?'':'prochaine'}" data-slug="${esc(t.slug)}"><a href="${esc(t.href)}"><b>${esc(t.nom)}</b>${etat(t)}<span class="phrase">${esc(t.phrase)}</span></a></li>`;
 const volet=(cle,titre,c,liste,ouvert)=>`<details class="volet" data-volet="${cle}" style="--c:${c}"${ouvert?' open':''}><summary><span class="titre"><b>${titre}</b><span class="cpt" data-cpt></span></span><span class="apercu" aria-hidden="true">${liste.slice(0,4).map(t=>esc(t.nom)).join(' · ')}…</span><span class="chevron" aria-hidden="true"></span></summary><ul class="lignes">${liste.map(ligne).join('')}</ul></details>`;
 const groupes=[['pro','Professionnel'],['perso','Vie personnelle']];
 const parTheme=id=>dispoDabord(items.filter(t=>t.theme===id));
 const blocSommaire=t=>`<section class="bloc-sommaire" data-volet="${t.id}" style="--c:${t.c}"><h4>${esc(t.nom)}</h4><ul>${parTheme(t.id).map(x=>`<li class="${x.vente?'':'prochaine'}" data-slug="${esc(x.slug)}"><a href="${esc(x.href)}"><span>${esc(x.nom)}</span><span>${x.vente?esc(x.prix):'bientôt'}</span></a></li>`).join('')}</ul></section>`;
 vues.innerHTML=`<div class="vue-themes" data-vue-panneau="themes">${volet('dispo','Disponibles maintenant','var(--jaune)',items.filter(t=>t.vente),true)}`
  +groupes.map(([g,nom])=>`<div class="groupe-volets" data-groupe="${g}"><h3>${nom}</h3>${themes.filter(t=>t.pour===g).map(t=>volet(t.id,esc(t.nom),t.c,parTheme(t.id),t.id===s.theme)).join('')}</div>`).join('')
  +`</div><div class="vue-sommaire" data-vue-panneau="sommaire"><p class="legende-sommaire"><b>En gras</b> : disponibles, avec leur prix. En gris : en préparation.</p>`
  +groupes.map(([g,nom])=>`<div class="groupe-sommaire" data-groupe="${g}"><h3>${nom}</h3><div class="colonnes-sommaire">${themes.filter(t=>t.pour===g).map(blocSommaire).join('')}</div></div>`).join('')+`</div>`;
 $$('.vitrine,.a-venir-catalogue,.puces').forEach(el=>el.hidden=true);
 const parSlug={};items.forEach(t=>parSlug[t.slug]=t);
 const volets=$$('.volet',vues),blocs=$$('.bloc-sommaire',vues);
 volets.forEach(v=>v.addEventListener('toggle',()=>{if(v.open&&!s.q&&v.dataset.volet!=='dispo')compter('catalogue-theme-'+v.dataset.volet,'Catalogue : thème '+texte(v,'summary b'));}));
 function rendre(){
  const actif=!!(s.pour||s.q),mots=norm(s.q).split(/\s+/).filter(Boolean),avenir=s.avenir||mots.length>0;
  const ok=t=>(avenir||t.vente)&&(!s.pour||t.pour===s.pour)&&mots.every(m=>t._t.includes(m));
  segs.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pour===s.pour)));
  boutonsVue.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.vue===s.vue)));
  $$('[data-vue-panneau]',vues).forEach(el=>el.hidden=el.dataset.vuePanneau!==s.vue);
  $$('li[data-slug]',vues).forEach(li=>li.hidden=!ok(parSlug[li.dataset.slug]));
  for(const v of volets){const lis=$$('li[data-slug]',v),vis=lis.filter(li=>!li.hidden),n=vis.length,nv=vis.filter(li=>!li.classList.contains('prochaine')).length;
   v.hidden=!n;
   v.querySelector('[data-cpt]').textContent=v.dataset.volet==='dispo'?`${n} template${n>1?'s':''} · achat unique`:!avenir?`${nv} disponible${nv>1?'s':''}`:`${mots.length?`${n} sur ${lis.length}`:`${n} templates`} · ${nv} disponible${nv>1?'s':''}`;
   if(mots.length)v.open=true;}
  for(const b of blocs)b.hidden=!$$('li[data-slug]',b).some(li=>!li.hidden);
  for(const g of $$('.groupe-volets,.groupe-sommaire',vues))g.hidden=!$$('.volet,.bloc-sommaire',g).some(x=>!x.hidden);
  let nVente=0,nBientot=0;items.forEach(t=>{if(ok(t))t.vente?nVente++:nBientot++;});
  cat.classList.toggle('filtre',actif);vide.hidden=nVente+nBientot>0;vues.hidden=!(nVente+nBientot);
  const bascule=mots.length?'':` · <button type="button" data-avenir>${s.avenir?'Masquer les templates en préparation':`Afficher aussi les ${total-enVente} en préparation`}</button>`;
  compte.innerHTML=actif?`<b>${nVente+nBientot}</b> sur ${total} · ${nVente} en vente${avenir?`, ${nBientot} en préparation`:''}${bascule} · <button type="button" data-effacer>Effacer les filtres</button>`
   :`<b>${enVente}</b> templates en vente${s.avenir?`, ${total-enVente} en préparation`:''}${bascule}`;
 }
 /* Fin d'une recherche : retour à l'état de départ (« Disponibles maintenant » seul ouvert). */
 let qPrec=s.q;
 function finRecherche(){if(qPrec&&!s.q)volets.forEach(v=>v.open=v.dataset.volet==='dispo');qPrec=s.q;}
 function effacer(){s.pour='';s.q='';champ.value='';finRecherche();rendre();adresse();}
 segs.forEach(b=>b.addEventListener('click',()=>{s.pour=b.dataset.pour;rendre();adresse();if(s.pour)compter('catalogue-filtre-'+s.pour,'Catalogue : filtre '+b.textContent);}));
 boutonsVue.forEach(b=>b.addEventListener('click',()=>{if(s.vue===b.dataset.vue)return;s.vue=b.dataset.vue;rendre();adresse();compter('catalogue-vue-'+s.vue,'Catalogue : vue '+b.textContent);}));
 let attente;champ.addEventListener('input',()=>{s.q=champ.value.slice(0,80);finRecherche();rendre();clearTimeout(attente);attente=setTimeout(adresse,400);});
 cat.addEventListener('click',e=>{if(e.target.closest('[data-effacer]')){effacer();champ.focus();}
  else if(e.target.closest('[data-avenir]')){s.avenir=!s.avenir;rendre();adresse();$('[data-avenir]')?.focus();if(s.avenir)compter('catalogue-avenir','Catalogue : templates en préparation affichés');}});
 filtres.hidden=false;rendre();
 const cible=s.theme&&volets.find(x=>x.dataset.volet===s.theme&&!x.hidden);
 if(cible)requestAnimationFrame(()=>cible.scrollIntoView({block:'start'}));
 else if(s.pour||s.q||s.vue!=='themes')requestAnimationFrame(()=>cat.scrollIntoView({block:'start'}));
})();
