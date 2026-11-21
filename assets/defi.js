// Défi 7 jours entre potes (/defi/) : interface. Logique et règles côté serveur : netlify/lib/defi.mjs (/api/defi).
// Le jeton personnel est gardé dans le navigateur (localStorage, simple commodité) et affiché comme lien perso ;
// il est retiré de la barre d'adresse pour ne pas être partagé par erreur.
(function () {
  'use strict';
  const SITE = 'https://qm-engineering.fr/defi/';
  const $ = (s, el = document) => el.querySelector(s);
  const zone = $('[data-defi]');
  if (!zone) return;

  const compter = (chemin, titre) => { try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: chemin, title: titre, event: true }); } catch (e) { /* facultatif */ } };
  const lireJeton = (id) => { try { return localStorage.getItem(`qme-defi-${id}`); } catch (e) { return null; } };
  const garderJeton = (id, j) => { try { localStorage.setItem(`qme-defi-${id}`, j); } catch (e) { /* lien perso affiché */ } };
  const oublierJeton = (id) => { try { localStorage.removeItem(`qme-defi-${id}`); } catch (e) { /* rien */ } };
  const dateCourte = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
  const jourMoins1 = (j) => { const d = new Date(`${j}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

  const prm = new URLSearchParams(location.search);
  let id = (prm.get('d') || '').toUpperCase();
  let jeton = null, defi = null, moi = null;
  if (prm.get('j')) {
    jeton = prm.get('j');
    if (id) garderJeton(id, jeton);
    history.replaceState(null, '', `${location.pathname}?d=${id}`);
  } else if (id) jeton = lireJeton(id);

  function erreur(t) { const e = $('[data-erreur]'); e.textContent = t || ''; e.hidden = !t; }
  function ecran(nom) { zone.querySelectorAll('[data-ecran]').forEach((s) => { s.hidden = s.dataset.ecran !== nom; }); }

  async function api(corps, get) {
    const r = get ? await fetch(`/api/defi?id=${encodeURIComponent(get)}`) : await fetch('/api/defi', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
    let d = {};
    try { d = await r.json(); } catch (e) { /* réponse vide */ }
    if (!r.ok) throw new Error(d.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
    return d;
  }

  // Suggestions en un clic.
  zone.querySelectorAll('[data-idees]').forEach((p) => p.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const champ = p.closest('form').querySelector(`[name=${p.dataset.idees}]`);
    champ.value = b.textContent; champ.focus();
  }));

  function afficher() {
    ecran('tableau');
    const d = defi;
    const nomDe = (pid) => d.joueurs.find((j) => j.pid === pid)?.pseudo || '';
    $('[data-titre]').textContent = d.pari ? `Qui tient le plus longtemps ? Le perdant paie ${d.pari}.` : 'Qui tient le plus longtemps ?';
    let etat;
    if (d.etat === 'a-venir') etat = `Le défi commence demain, ${dateCourte(d.debut)}. Invite tes potes d'ici là.`;
    else if (d.etat === 'en-cours') etat = `Jour ${d.jourNumero} sur 7 · fin le ${dateCourte(d.fin)}.`;
    else if (d.joueurs.length < 2) etat = 'Défi terminé, mais personne ne t\'a rejoint.';
    else if (!d.perdants.length) etat = `Égalité parfaite entre ${d.gagnants.map(nomDe).join(' et ')} : personne ne paie… ou tout le monde. À vous de voir.`;
    else etat = `${d.gagnants.map(nomDe).join(' et ')} ${d.gagnants.length > 1 ? 'gagnent' : 'gagne'} ! ${d.pari ? `${d.perdants.map(nomDe).join(' et ')} ${d.perdants.length > 1 ? 'paient' : 'paie'} ${d.pari}.` : `${d.perdants.map(nomDe).join(' et ')} ${d.perdants.length > 1 ? 'ont' : 'a'} lâché le plus.`}`;
    $('[data-etat]').textContent = etat;

    // Tableau : une ligne par participant, 7 cases.
    const t = $('[data-tableau]');
    t.innerHTML = '';
    const tete = document.createElement('div'); tete.className = 'defi-ligne defi-tete';
    tete.innerHTML = '<span></span>' + d.jours.map((j, i) => `<span class="${j === d.aujourdhui ? 'auj' : ''}" title="${dateCourte(j)}">J${i + 1}</span>`).join('') + '<span>Total</span>';
    t.appendChild(tete);
    for (const j of d.joueurs) {
      const l = document.createElement('div'); l.className = 'defi-ligne' + (j.pid === moi ? ' moi' : '') + (d.gagnants.includes(j.pid) ? ' gagnant' : '');
      const nom = document.createElement('span'); nom.className = 'defi-nom';
      const b = document.createElement('b'); b.textContent = j.pseudo; if (j.pid === moi) { b.title = 'toi'; b.setAttribute('aria-label', `${j.pseudo} (toi)`); }
      const h = document.createElement('small'); h.textContent = j.habitude;
      nom.append(b, h); l.appendChild(nom);
      for (const jour of d.jours) {
        const c = document.createElement('span');
        const fait = j.jours.includes(jour);
        c.className = 'case' + (fait ? ' fait' : jour < d.aujourdhui && d.etat !== 'a-venir' ? ' rate' : '') + (jour === d.aujourdhui ? ' auj' : '');
        c.textContent = fait ? '✓' : jour < d.aujourdhui && jour >= d.debut ? '✗' : '';
        c.setAttribute('aria-label', `${dateCourte(jour)} : ${fait ? 'tenu' : jour < d.aujourdhui ? 'raté' : 'à venir'}`);
        l.appendChild(c);
      }
      const tot = document.createElement('span'); tot.className = 'total'; tot.textContent = `${j.total}/7`;
      l.appendChild(tot);
      t.appendChild(l);
    }

    // Mes boutons du jour.
    const zoneMoi = $('[data-moi]');
    const moiJ = d.joueurs.find((j) => j.pid === moi);
    zoneMoi.hidden = !(moiJ && d.etat === 'en-cours');
    if (moiJ && d.etat === 'en-cours') {
      const fait = moiJ.jours.includes(d.aujourdhui);
      const b = $('[data-cocher="aujourdhui"]');
      b.textContent = fait ? 'Tenu aujourd\'hui ✓ (annuler)' : 'J\'ai tenu aujourd\'hui';
      b.classList.toggle('fait', fait);
      const hier = jourMoins1(d.aujourdhui);
      const bh = $('[data-cocher="hier"]');
      bh.hidden = !(d.jours.includes(hier) && !moiJ.jours.includes(hier));
      bh.textContent = `J'ai oublié de cocher hier (${dateCourte(hier)})`;
    }

    const places = 6 - d.joueurs.length;
    $('[data-inviter]').hidden = !d.rejoindrePossible;
    $('[data-places]').textContent = `${d.joueurs.length} participant${d.joueurs.length > 1 ? 's' : ''}, encore ${places} place${places > 1 ? 's' : ''}.`;
    $('[data-fin]').hidden = d.etat !== 'termine';
    $('[data-perso]').hidden = !moiJ;
    if (moiJ) $('[data-lien-perso]').textContent = `${SITE}?d=${d.id}&j=${jeton}`;
  }

  async function charger() {
    $('[data-chargement]').hidden = false;
    try {
      if (jeton) {
        const r = await api({ action: 'moi', jeton });
        defi = r.defi; moi = r.moi;
      } else {
        defi = (await api(null, id)).defi;
      }
      erreur('');
      if (!moi && defi.rejoindrePossible) {
        ecran('rejoindre');
        $('[data-invitation]').textContent = `${defi.joueurs.map((j) => j.pseudo).join(', ')} ${defi.joueurs.length > 1 ? 'te défient' : 'te défie'} pendant 7 jours, à partir du ${dateCourte(defi.debut)}${defi.pari ? `. Le perdant paie ${defi.pari}` : ''}. Choisis ton habitude.`;
        compter('defi-recu', 'Défi : invitation ouverte');
      } else afficher();
    } catch (e) {
      if (jeton) { oublierJeton(id); jeton = null; }
      erreur(e.message);
      ecran('creer');
    } finally { $('[data-chargement]').hidden = true; }
  }

  $('[data-form-creer]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const r = await api({ action: 'creer', pseudo: f.get('pseudo'), habitude: f.get('habitude'), pari: f.get('pari') });
      defi = r.defi; jeton = r.jeton; id = defi.id; moi = jeton.split('.')[1];
      garderJeton(id, jeton);
      history.replaceState(null, '', `${location.pathname}?d=${id}`);
      erreur(''); afficher();
      compter('defi-cree', 'Défi : créé');
      $('[data-partager-invitation]').focus();
    } catch (err) { erreur(err.message); }
  });

  $('[data-form-rejoindre]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const r = await api({ action: 'rejoindre', id, pseudo: f.get('pseudo'), habitude: f.get('habitude') });
      defi = r.defi; jeton = r.jeton; moi = jeton.split('.')[1];
      garderJeton(id, jeton);
      erreur(''); afficher();
      compter('defi-rejoint', 'Défi : rejoint');
    } catch (err) { erreur(err.message); }
  });

  zone.querySelectorAll('[data-cocher]').forEach((b) => b.addEventListener('click', async () => {
    const jour = b.dataset.cocher === 'hier' ? jourMoins1(defi.aujourdhui) : defi.aujourdhui;
    const deja = defi.joueurs.find((j) => j.pid === moi).jours.includes(jour);
    b.disabled = true;
    try {
      const r = await api({ action: 'cocher', jeton, jour, fait: !deja });
      defi = r.defi; erreur(''); afficher();
      if (!deja) compter('defi-coche', 'Défi : journée cochée');
    } catch (err) { erreur(err.message); } finally { b.disabled = false; }
  }));

  async function partager(texte, url, note) {
    try { if (navigator.share) { await navigator.share({ text: texte, url }); return true; } } catch (e) { if (e && e.name === 'AbortError') return false; }
    try { await navigator.clipboard.writeText(`${texte} ${url}`); note.textContent = 'Lien copié : colle-le à tes potes.'; } catch (e) { note.textContent = url; }
    note.hidden = false; return true;
  }
  $('[data-partager-invitation]').addEventListener('click', async () => {
    const url = `${SITE}?d=${defi.id}&utm_source=defi&utm_medium=partage&utm_campaign=defi`;
    const texte = `Défi 7 jours : je tiens « ${defi.joueurs.find((j) => j.pid === moi)?.habitude || 'mon habitude'} ».${defi.pari ? ` Le perdant paie ${defi.pari}.` : ''} T'es capable de tenir plus que moi ?`;
    if (await partager(texte, url, $('[data-copie-invitation]'))) compter('defi-invite', 'Défi : invitation envoyée');
  });
  $('[data-copier-perso]').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText($('[data-lien-perso]').textContent); e.target.textContent = 'Lien perso copié'; } catch (err) { /* le lien reste affiché */ }
  });
  $('[data-quitter]').addEventListener('click', async () => {
    if (!confirm('Quitter le défi ? Ton pseudo, ton habitude et tes jours cochés seront effacés.')) return;
    try { await api({ action: 'quitter', jeton }); oublierJeton(id); location.href = '/defi/'; } catch (err) { erreur(err.message); }
  });

  if (id) charger(); else ecran('creer');
})();
