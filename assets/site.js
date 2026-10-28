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
const submitButton=form.querySelector('button[type="submit"]');
const submitLabel=submitButton.textContent;

function setNote(text,status){
  note.textContent=text;
  note.classList.remove('success','error');
  if(status)note.classList.add(status);
}

form.addEventListener('submit',async e=>{
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
if(fallbackLink){
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
