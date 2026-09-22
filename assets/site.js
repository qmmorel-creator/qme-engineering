const header=document.querySelector('.topbar');
const menu=document.querySelector('.menu');
menu.addEventListener('click',()=>{const open=header.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
document.querySelectorAll('.topbar a').forEach(a=>a.addEventListener('click',()=>{header.classList.remove('open');menu.setAttribute('aria-expanded','false');}));
document.querySelectorAll('.accordions details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('.accordions details').forEach(o=>{if(o!==d)o.open=false;});}));
document.getElementById('year').textContent=new Date().getFullYear();
document.getElementById('contact-form').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.currentTarget);const subject=`Projet QME — ${data.get('need')}`;const body=[`Bonjour Quentin,`,``,`Je vous contacte au sujet de : ${data.get('need')}.`,``,`Organisation : ${data.get('company')||'Non précisée'}`,`Nom : ${data.get('name')}`,`Email : ${data.get('email')}`,``,`Contexte :`,` ${data.get('message')}`].join('\n');document.getElementById('form-note').textContent='Votre messagerie va s’ouvrir avec un message prérempli.';document.getElementById('form-note').classList.add('success');window.location.href=`mailto:qm.morel@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;});
