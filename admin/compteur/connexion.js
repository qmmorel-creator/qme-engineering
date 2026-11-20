/* Accès par mot de passe : vérifié par /api/compteur, gardé sur l'appareil (ou pour la session). */
(() => {
  const CLE = 'qme-compteur-mdp';
  const $ = (s) => document.querySelector(s);
  const lire = () => { try { return localStorage.getItem(CLE) || sessionStorage.getItem(CLE) || ''; } catch (e) { return ''; } };
  const garder = (m, durable) => { try { localStorage.removeItem(CLE); sessionStorage.removeItem(CLE); if (m) (durable ? localStorage : sessionStorage).setItem(CLE, m); } catch (e) {} };
  const montrer = (connecte) => {
    $('#acces-bloc').hidden = connecte;
    $('#barre').hidden = !connecte;
    $('#tableau').hidden = !connecte;
  };
  const message = (t) => { const p = $('#acces-msg'); p.textContent = t || ''; p.hidden = !t; };

  async function charger() {
    const mdp = lire();
    if (!mdp) { montrer(false); return; }
    $('#ouvrir').disabled = true; $('#actualiser').disabled = true;
    try {
      const r = await fetch('/api/compteur', {headers: {'x-mot-de-passe': mdp}, cache: 'no-store'});
      const corps = await r.json().catch(() => ({}));
      if (r.status === 401) { garder(''); montrer(false); message('Mot de passe incorrect.'); return; }
      if (!r.ok) { montrer(false); message(corps.erreur || `Le compteur ne répond pas (erreur ${r.status}). Réessaie dans un instant.`); return; }
      montrer(true); message('');
      const lu = new Date(corps.lu);
      const manquants = Object.keys(corps.erreurs || {});
      $('#lu').textContent = 'Données lues le ' + lu.toLocaleString('fr-FR', {dateStyle: 'short', timeStyle: 'short'})
        + (manquants.length ? ` · onglets indisponibles : ${manquants.join(', ')}` : '');
      await window.dash._charger(corps);
    } catch (e) {
      montrer(false); message('Connexion impossible. Vérifie ta connexion internet et réessaie.');
    } finally {
      $('#ouvrir').disabled = false; $('#actualiser').disabled = false;
    }
  }

  $('#acces').addEventListener('submit', (e) => {
    e.preventDefault();
    garder($('#mdp').value.trim(), $('#souvenir').checked);
    $('#mdp').value = '';
    charger();
  });
  $('#actualiser').addEventListener('click', charger);
  $('#deconnexion').addEventListener('click', () => { garder(''); montrer(false); message(''); $('#mdp').focus(); });
  montrer(false);
  if (lire()) charger();
})();
