const header=document.querySelector('.topbar');
const menu=document.querySelector('.menu');
menu.addEventListener('click',()=>{const open=header.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
document.querySelectorAll('.topbar a').forEach(a=>a.addEventListener('click',()=>{header.classList.remove('open');menu.setAttribute('aria-expanded','false');}));
document.querySelectorAll('.accordions details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('.accordions details').forEach(o=>{if(o!==d)o.open=false;});}));
document.getElementById('year').textContent=new Date().getFullYear();

function mailtoFallback(data){
  const subject=`Projet QME — ${data.get('need')}`;
  const body=[`Bonjour Quentin,`,``,`Je vous contacte au sujet de : ${data.get('need')}.`,``,`Organisation : ${data.get('company')||'Non précisée'}`,`Nom : ${data.get('name')}`,`Email : ${data.get('email')}`,``,`Contexte :`,` ${data.get('message')}`].join('\n');
  return `mailto:qm.morel@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
  // Rien à signaler côté formulaire (même message que succès attendu par
  // le relais), on abandonne simplement l'envoi côté client aussi.
  const data=new FormData(e.currentTarget);
  if((data.get('company_website')||'').toString().trim()!==''){
    setNote('Votre demande a bien été transmise. QME reviendra vers vous après analyse.','success');
    form.reset();
    return;
  }

  submitButton.disabled=true;
  submitButton.textContent='Envoi en cours…';
  setNote('Envoi en cours…',null);

  const requestId=(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const payload={
    requestId,
    name:(data.get('name')||'').toString(),
    email:(data.get('email')||'').toString(),
    organization:(data.get('company')||'').toString(),
    need:(data.get('need')||'').toString(),
    message:(data.get('message')||'').toString(),
    submittedAt:new Date().toISOString(),
    sourceUrl:window.location.href,
    company_website:'',
  };

  try{
    const response=await fetch('/api/contact',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload),
    });
    const result=await response.json().catch(()=>({ok:false}));
    if(response.ok&&result.ok){
      setNote('Votre demande a bien été transmise. QME reviendra vers vous après analyse.','success');
      form.reset();
    }else if(response.status===429){
      setNote('Trop de demandes pour le moment. Réessayez dans quelques minutes, ou écrivez directement à qm.morel@gmail.com.','error');
    }else{
      setNote('L’envoi a échoué. Réessayez, ou écrivez directement à qm.morel@gmail.com.','error');
    }
  }catch{
    setNote('L’envoi a échoué (connexion). Réessayez, ou écrivez directement à qm.morel@gmail.com.','error');
  }finally{
    submitButton.disabled=false;
    submitButton.textContent=submitLabel;
  }
});

// Solution de repli accessible : un visiteur peut toujours préparer un
// courriel prérempli sans dépendre du BFF (lien mailto, jamais retiré).
const fallbackLink=document.getElementById('contact-fallback');
if(fallbackLink){
  fallbackLink.addEventListener('click',e=>{
    e.preventDefault();
    window.location.href=mailtoFallback(new FormData(form));
  });
}
