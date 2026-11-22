// Packs QME : calcul du pack sur mesure (/packs/composer/) et tableau de bord de l'acheteur (/packs/espace/).
// Remise : barème de netlify/lib/packs.mjs, prix arrondi à l'euro inférieur (même calcul que le serveur).
(() => {
  const euros = (c) => (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €';
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // --- Pack sur mesure -----------------------------------------------------------------------------
  const composer = document.querySelector('[data-composer]');
  if (composer) {
    const D = JSON.parse(document.getElementById('donnees-composer').textContent);
    const remise = (n) => { for (const [min, pct] of D.remises) if (n >= min) return pct; return 0; };
    const prixPack = (prix) => {
      const valeur = prix.reduce((s, p) => s + p, 0), pct = remise(prix.length);
      return { valeur, pct, prix: pct ? Math.floor(valeur * (100 - pct) / 100 / 100) * 100 : valeur };
    };
    const parPre = Object.fromEntries(D.templates.map((t) => [t.pre, t]));
    const cases = [...composer.querySelectorAll('input[type=checkbox]')];
    const $ = (s) => composer.querySelector(s);
    const commander = $('[data-commander]');

    const choisis = () => cases.filter((c) => c.checked).map((c) => parPre[c.value]);
    function majAdresse(liste) {
      const u = new URL(location.href);
      if (liste.length) u.searchParams.set('t', liste.map((t) => t.pre).join(',')); else u.searchParams.delete('t');
      history.replaceState(null, '', u);
    }
    function maj() {
      const liste = choisis(), p = prixPack(liste.map((t) => t.prix));
      $('[data-vide]').hidden = liste.length > 0;
      $('[data-choisis]').innerHTML = liste.map((t) => `<li><span>${esc(t.nom)}</span><span>${euros(t.prix)}</span></li>`).join('');
      $('[data-valeur]').textContent = euros(p.valeur);
      $('[data-remise]').textContent = p.pct ? `−${p.pct} % (−${euros(p.valeur - p.prix)})` : '—';
      $('[data-total]').textContent = euros(p.prix);
      $('[data-barre-texte]').textContent = liste.length ? `${liste.length} template${liste.length > 1 ? 's' : ''} · ${euros(p.prix)}${p.pct ? ` (−${p.pct} %)` : ''}` : 'Aucun template choisi';
      // Conseils : palier suivant, pack existant moins cher, templates pas encore en vente.
      const conseils = [];
      const suivant = [...D.remises].reverse().find(([min]) => min > liste.length);
      if (liste.length < 2) conseils.push('La remise commence à deux templates.');
      else if (suivant) conseils.push(`Encore ${suivant[0] - liste.length} template${suivant[0] - liste.length > 1 ? 's' : ''} pour passer à −${suivant[1]} %.`);
      const pres = new Set(liste.map((t) => t.pre));
      const pack = D.packs.filter((k) => liste.length >= 2 && [...pres].every((x) => k.produits.includes(x)) && k.prix <= p.prix).sort((a, b) => a.prix - b.prix)[0];
      if (pack) conseils.push(`Le ${pack.nom} contient tout votre choix${pack.produits.length > liste.length ? ', et plus encore,' : ''} pour ${euros(pack.prix)}. <a href="/packs/${pack.slug}/">Voir ce pack</a>.`);
      if (liste.some((t) => t.statut !== 'vente')) conseils.push('Certains templates choisis sont en mise en vente prochaine : leur démo est déjà ouverte.');
      $('[data-conseil]').innerHTML = conseils.join(' ');
      // Achat en ligne réservé aux templates déjà en vente (règle : pas de bouton Acheter avant la mise en vente).
      const bientot = liste.filter((t) => t.statut !== 'vente');
      if (D.achat && bientot.length) conseils.push(`Pour acheter maintenant, retirez ${bientot.length > 1 ? 'les templates marqués « Bientôt »' : 'le template marqué « Bientôt »'}, ou cliquez sur « Je suis intéressé(e) ».`);
      $('[data-conseil]').innerHTML = conseils.join(' ');
      const ok = liste.length >= 2 && !(D.achat && bientot.length);
      commander.setAttribute('aria-disabled', String(!ok));
      const corps = `Bonjour,\n\nJe souhaite commander un pack sur mesure :\n${liste.map((t) => `- ${t.nom} (${euros(t.prix)})`).join('\n')}\n\nAchat séparé : ${euros(p.valeur)}\nRemise : ${p.pct} %\nPrix du pack : ${euros(p.prix)}\n\nMerci de m'envoyer le lien de paiement.\n`;
      if (D.achat) {
        // Prix libre et champ « Templates » pré-remplis ; le serveur recontrôle le montant à la connexion.
        const u = new URL(D.achat.url);
        u.searchParams.set('wanted', 'true');
        u.searchParams.set('price', String(p.prix / 100));
        u.searchParams.set(D.achat.champ, liste.map((t) => t.pre).join(','));
        commander.href = u.href;
      } else commander.href = `mailto:quentin.morel@qm-engineering.fr?subject=${encodeURIComponent(`Pack sur mesure (${liste.length} templates, ${euros(p.prix)})`)}&body=${encodeURIComponent(corps)}`;
      majAdresse(liste);
    }
    const depart = (new URLSearchParams(location.search).get('t') || '').split(',');
    for (const c of cases) { if (depart.includes(c.value)) c.checked = true; c.addEventListener('change', maj); }
    maj();
  }

  // --- Espace de l'acheteur d'un pack -----------------------------------------------------------------
  // Les templates de tous les packs enregistrés sur l'appareil passent par le composant commun assets/espace.js
  // (recherche, épinglés, récents, thèmes), comme /connexion/ ; chaque tuile garde son code de partage.
  const espace = document.querySelector('[data-espace]');
  if (espace && window.QMEEspace && typeof PRODUITS !== 'undefined') {
    const CLE = 'qme-packs';
    const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || '[]'); } catch { return []; } };
    const ecrire = (l) => { try { localStorage.setItem(CLE, JSON.stringify(l)); } catch {} };
    const $ = (s) => espace.querySelector(s);
    const zone = $('[data-mes-packs]'), corps = $('[data-espace-corps]'), gerer = $('[data-gerer]'), alerte = $('[data-alerte]'), copie = $('[data-copie]');
    const form = document.getElementById('espace-form'), champ = document.getElementById('espace-cle'), erreur = document.getElementById('espace-erreur');
    const COPIER = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';
    const COPIE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    let acces = {}; // préfixe → { code, url, nom } (premier pack qui contient le template)
    const produits = { ...PRODUITS };
    const vue = QMEEspace.creer(corps, {
      produits, themes: THEMES,
      // Le template lit son code dans qme-<préfixe>-code : il s'ouvre comme après une connexion normale.
      avantOuverture: (k) => { if (acces[k]) try { localStorage.setItem(`qme-${k.toLowerCase()}-code`, JSON.stringify(acces[k].code)); } catch {} },
      actions: (k) => acces[k] ? `<button type="button" data-copier="${esc(acces[k].code)}" aria-label="Copier le code de partage : ${esc(produits[k].nom)}" title="Copier le code de partage">${COPIER}</button>` : '',
    });

    async function ouvrirPack(code) {
      const r = await fetch('/api/templates/connexion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? 'Clé inconnue. Vérifiez-la dans l’e-mail reçu après l’achat.' : (j.erreur || 'Le service ne répond pas. Réessayez dans un instant.'));
      if (!j.pack) throw new Error('Cette clé ouvre un seul template : utilisez la page Connexion.');
      return j;
    }
    function rendre(packs) {
      acces = {};
      for (const p of packs) for (const t of p.templates) {
        if (acces[t.produit]) continue;
        acces[t.produit] = t;
        // Template absent des données générées (ajout récent) : affiché sous « Autres » avec le nom donné par l'API.
        if (!produits[t.produit]) produits[t.produit] = { nom: t.nom, url: t.url, theme: 'autres', phrase: '', img: '' };
      }
      const n = Object.keys(acces).length;
      $('[data-nb]').textContent = packs.length ? `${n} template${n > 1 ? 's' : ''} · ${packs.length} pack${packs.length > 1 ? 's' : ''}` : '';
      $('[data-intro]').hidden = !!packs.length;
      $('[data-ajouter]').hidden = !packs.length;
      $('[data-titre-ajout]').hidden = !packs.length;
      corps.hidden = gerer.hidden = !packs.length;
      vue.maj(Object.keys(acces));
      zone.innerHTML = packs.map((p, i) => `<div class="pack-gere"><div><b>${esc(p.nom)}</b><span>${p.templates.length} template${p.templates.length > 1 ? 's' : ''}</span></div><button class="lien-discret" type="button" data-oublier="${i}">Oublier ce pack sur cet appareil</button></div>`).join('');
      form.querySelector('button').textContent = packs.length ? 'Ajouter ce pack' : 'Ouvrir mon pack';
    }
    corps.addEventListener('click', (e) => {
      const c = e.target.closest('[data-copier]');
      if (!c) return;
      const code = c.dataset.copier;
      const fait = () => { c.innerHTML = COPIE; copie.textContent = 'Code de partage copié.'; setTimeout(() => { c.innerHTML = COPIER; copie.textContent = ''; }, 2500); };
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(fait, () => { window.prompt('Code de partage :', code); });
      else window.prompt('Code de partage :', code);
    });
    zone.addEventListener('click', (e) => {
      const o = e.target.closest('[data-oublier]');
      if (o) { const l = lire(); l.splice(Number(o.dataset.oublier), 1); ecrire(l); charger(); }
    });
    async function charger() {
      const codes = lire();
      alerte.textContent = '';
      if (!codes.length) { rendre([]); return; }
      $('[data-nb]').textContent = 'Chargement de vos packs…';
      const res = await Promise.allSettled(codes.map(ouvrirPack));
      rendre(res.filter((r) => r.status === 'fulfilled').map((r) => r.value));
      if (res.some((r) => r.status === 'rejected')) alerte.textContent = 'Un pack n’a pas pu être chargé. Vérifiez votre connexion, puis rechargez la page.';
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = champ.value.trim();
      if (!code) { champ.focus(); return; }
      const bouton = form.querySelector('button');
      bouton.disabled = true; erreur.textContent = '';
      try {
        const j = await ouvrirPack(code);
        const l = lire().filter((c) => c !== j.code);
        l.push(j.code); ecrire(l); champ.value = '';
        await charger();
        espace.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (x) { erreur.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessayez une fois en ligne.' : x.message; }
      bouton.disabled = false;
    });
    charger();
  }
  // --- Page /packs/ : filtre « Je suis… » sur les cartes des packs ---------------------------------------
  const filtre = document.querySelector('[data-filtre-packs]');
  if (filtre) {
    const blocs = [...document.querySelectorAll('.pack-carte')];
    const compte = document.querySelector('[data-compte-packs]');
    const appliquer = (cible) => {
      for (const b of filtre.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.cible === cible));
      let n = 0;
      for (const bl of blocs) { const ok = !cible || bl.dataset.cibles.split(' ').includes(cible); bl.hidden = !ok; if (ok) n++; }
      for (const g of document.querySelectorAll('.groupe-packs')) g.hidden = !blocs.some((bl) => !bl.hidden && bl.dataset.pour === g.dataset.groupe);
      compte.textContent = cible ? `${n} pack${n > 1 ? 's' : ''} pour ce public` : '';
    };
    filtre.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) appliquer(b.dataset.cible); });
    // Anciens liens /packs/#slug (carte des prix du catalogue, publications) : ouverture de la page du pack.
    const ouvrir = () => { if (blocs.some((x) => '#' + x.id === location.hash)) location.replace(`/packs/${location.hash.slice(1)}/`); };
    window.addEventListener('hashchange', ouvrir);
    ouvrir();
  }
})();
