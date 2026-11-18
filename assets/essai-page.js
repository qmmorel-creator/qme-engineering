// Page /essai/ : lance un essai gratuit (POST /api/essai) puis ouvre le template avec le code d'essai.
// ?t=<slug> présélectionne le template. Le code est aussi envoyé par e-mail (boîte de Quentin).
(() => {
  'use strict';
  const form = document.getElementById('essai-form');
  if (!form) return;
  const note = document.getElementById('essai-note');
  const select = form.produit;
  const voulu = new URLSearchParams(location.search).get('t');
  if (voulu && [...select.options].some((o) => o.value === voulu)) select.value = voulu;
  const dateLongue = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/ 1 /, ' 1er ');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bouton = form.querySelector('button[type=submit]');
    const email = form.email.value.trim();
    const erreur = (texte, champ) => { note.textContent = texte; note.classList.add('erreur'); champ?.focus(); };
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return erreur('Saisissez une adresse e-mail valide.', form.email);
    if (!form.consentement.checked) return erreur('Cochez la case pour recevoir votre code et les e-mails de l\'essai.', form.consentement);
    bouton.disabled = true; bouton.textContent = 'Préparation de votre essai…'; note.classList.remove('erreur');
    note.textContent = '';
    try {
      const r = await fetch('/api/essai', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ produit: select.value, email, prenom: form.prenom.value.trim(), consentement: true, site_web: form.site_web.value }),
      });
      const corps = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corps.erreur || 'Le service ne répond pas. Réessayez dans un instant.');
      try { window.goatcounter?.count?.({ path: `essai-cree-${select.value}`, title: 'Essai gratuit lancé', event: true }); } catch { /* mesure facultative */ }
      const lien = `${corps.url}?essai=${encodeURIComponent(corps.code)}`;
      document.getElementById('essai-code').textContent = corps.code;
      document.getElementById('essai-fin').textContent = dateLongue(corps.fin);
      document.getElementById('essai-ouvrir').href = lien;
      form.hidden = true;
      const pret = document.getElementById('essai-pret');
      pret.hidden = false;
      pret.focus();
    } catch (x) {
      erreur(x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessayez une fois en ligne.' : x.message);
      bouton.disabled = false; bouton.textContent = 'Lancer mon essai gratuit';
    }
  });
})();
