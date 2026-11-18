// Essai gratuit des templates QME (décision de Quentin, 18/11/2026) : module commun, chargé par chaque
// application « vie personnelle » AVANT son app.js :
//   <script src="/assets/essai.js?v=…" data-produit="BDG" data-slug="budget"></script>
//
// Le module ne touche pas au code de l'application. Il s'appuie sur le socle commun (clés qme-<pre>-code et
// qme-<pre>-cache, API /api/templates) :
//  - ?essai=CODE dans l'adresse (lien de l'e-mail ou de la page /essai/) : le code est enregistré, l'application
//    s'ouvre avec ;
//  - réponses de l'API qui portent « essai » : bandeau (jours restants, Acheter, J'ai acheté) ;
//  - essai terminé : lecture seule. Les actions qui modifient sont arrêtées au clic, et tout enregistrement est
//    bloqué ici (le serveur le refuse aussi) ; la fenêtre « Lecture seule » propose l'achat ;
//  - « J'ai acheté » : la clé Gumroad est envoyée avec le code d'essai, le serveur reprend les données ;
//  - écran de connexion : lien « Essayer 14 jours gratuitement ».
(() => {
  'use strict';
  const script = document.currentScript;
  const PRODUIT = script?.dataset.produit;
  const SLUG = script?.dataset.slug || '';
  if (!PRODUIT) return;
  const pre = PRODUIT.toLowerCase();
  const CLE_CODE = `qme-${pre}-code`, CLE_CACHE = `qme-${pre}-cache`, CLE_ESSAI = `qme-${pre}-essai`;
  const API = '/api/templates';
  const LICENCE = /^[0-9A-F]{8}-?[0-9A-F]{8}-?[0-9A-F]{8}-?[0-9A-F]{8}$/i;

  const lire = (cle) => { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } };
  const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } };
  const suppr = (cle) => { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dateCourte = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }).replace(/^1 /, '1er ');
  const euros = (c) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0 }) + ' €';

  // ---------- Lien d'essai : ?essai=CODE ----------
  const params = new URLSearchParams(location.search);
  const depuisLien = params.get('essai');
  if (depuisLien) {
    const code = depuisLien.trim().toUpperCase();
    if (code.replace(/-/g, '').startsWith(PRODUIT) && lire(CLE_CODE) !== code) {
      // Un autre code (achat) déjà ouvert sur cet appareil n'est pas remplacé par un lien d'essai.
      const actuel = lire(CLE_CODE);
      if (!actuel || actuel === 'DEMO' || actuel === lire(CLE_ESSAI)) {
        suppr(CLE_CODE); suppr(CLE_CACHE);
        ecrire(CLE_CODE, code);
        ecrire(CLE_ESSAI, code);
      }
    }
    params.delete('essai');
    history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : '') + location.hash);
  }

  // ---------- État de l'essai ----------
  let essai = null;        // infos renvoyées par le serveur (debut, fin, effacement, joursRestants, termine, prix, achat)
  let base = null;         // dernière version des données connue du serveur (majLe)
  let modificationBloquee = false;

  const urlDe = (entree) => { try { return new URL(typeof entree === 'string' ? entree : entree.url, location.href); } catch { return null; } };

  // ---------- Interception des appels à l'API ----------
  const fetchOrigine = window.fetch.bind(window);
  window.fetch = async (entree, options = {}) => {
    const url = urlDe(entree);
    if (!url || url.origin !== location.origin || !url.pathname.startsWith(API)) return fetchOrigine(entree, options);
    const chemin = url.pathname.slice(API.length);
    const methode = (options.method || (typeof entree !== 'string' && entree.method) || 'GET').toUpperCase();

    // Connexion avec une clé de licence : on joint le code d'essai pour reprendre ses données.
    let avecLicence = false;
    if (chemin === '/connexion' && methode === 'POST' && typeof options.body === 'string') {
      try {
        const corps = JSON.parse(options.body);
        if (LICENCE.test(String(corps.code || '').trim())) {
          avecLicence = true;
          const codeEssai = lire(CLE_ESSAI);
          if (codeEssai && !corps.essai) options = { ...options, body: JSON.stringify({ ...corps, essai: codeEssai }) };
        }
      } catch { /* corps non JSON : inchangé */ }
    }

    // Essai terminé : aucun enregistrement ne part.
    if (chemin === '/donnees' && methode === 'PUT' && essai?.termine) {
      signalerLectureSeule(true);
      return new Response(JSON.stringify({ ok: true, majLe: base }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    const reponse = await fetchOrigine(entree, options);
    if (!['/connexion', '/donnees'].includes(chemin)) return reponse;
    let corps = null;
    try { corps = await reponse.clone().json(); } catch { return reponse; }
    if (!corps) return reponse;

    if (corps.essai) {
      if (corps.jeton) ecrire(CLE_ESSAI, corps.jeton);
      majEssai(corps.essai);
    } else if (reponse.ok && chemin === '/connexion' && corps.produit === PRODUIT) {
      // Espace acheté (ou code QME) : plus d'essai sur cet appareil.
      if (avecLicence) suppr(CLE_ESSAI);
      majEssai(null);
    }
    if (corps.donnees?.majLe) base = corps.donnees.majLe;
    if (methode === 'PUT' && reponse.ok && corps.majLe) base = corps.majLe;

    // Le serveur a refusé un enregistrement (essai terminé entre-temps) : même traitement que ci-dessus.
    if (methode === 'PUT' && reponse.status === 403 && corps.essaiTermine) {
      majEssai(corps.essai || { ...(essai || {}), termine: true });
      signalerLectureSeule(true);
      return new Response(JSON.stringify({ ok: true, majLe: base }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return reponse;
  };

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
  .qme-essai{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:9px max(14px,env(safe-area-inset-left));background:#1D4E89;color:#fff;font:500 14px/1.35 Outfit,system-ui,sans-serif;position:relative;z-index:30}
  .qme-essai[data-etat="termine"]{background:#141414}
  .qme-essai b{font-weight:700}
  .qme-essai .qme-essai-txt{flex:1 1 220px;min-width:0}
  .qme-essai .qme-essai-actions{display:flex;gap:8px;flex-wrap:wrap}
  .qme-essai a,.qme-essai button,.qme-essai-dlg .qme-btn{font:600 14px/1 Outfit,system-ui,sans-serif;border-radius:999px;padding:9px 14px;border:1px solid currentColor;cursor:pointer;text-decoration:none;white-space:nowrap;min-height:36px;display:inline-flex;align-items:center}
  .qme-essai a{background:#F5B400;color:#141414;border-color:#F5B400}
  .qme-essai button{background:transparent;color:#fff}
  .qme-essai a:focus-visible,.qme-essai button:focus-visible,.qme-essai-dlg :focus-visible{outline:3px solid #F5B400;outline-offset:2px}
  .qme-essai-dlg{border:1px solid #141414;border-radius:20px;padding:0;max-width:min(440px,calc(100vw - 32px));background:#FBF7F1;color:#141414;font:15px/1.5 Outfit,system-ui,sans-serif}
  .qme-essai-dlg::backdrop{background:rgba(20,20,20,.45)}
  .qme-essai-dlg form,.qme-essai-dlg .qme-corps{padding:22px 22px 18px;display:grid;gap:12px}
  .qme-essai-dlg h2{margin:0;font-size:20px;line-height:1.25}
  .qme-essai-dlg p{margin:0}
  .qme-essai-dlg label{display:grid;gap:6px;font-weight:600}
  .qme-essai-dlg input{font:16px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;padding:11px 12px;border:1px solid #141414;border-radius:12px;background:#fff;color:#141414;width:100%;box-sizing:border-box;text-transform:uppercase}
  .qme-essai-dlg .qme-erreur{color:#B3241F;min-height:1.2em;font-weight:600}
  .qme-essai-dlg .qme-rang{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
  .qme-essai-dlg .qme-btn{background:#fff;color:#141414}
  .qme-essai-dlg .qme-btn.qme-primaire{background:#141414;color:#fff;border-color:#141414}
  .qme-essai-dlg .qme-btn.qme-jaune{background:#F5B400;border-color:#F5B400}
  .qme-essai-lien{margin:10px 0 0;padding:12px 14px;border:1px solid #1D4E89;border-radius:14px;background:rgba(29,78,137,.07);font-size:15px;line-height:1.45}
  .qme-essai-lien a{font-weight:700;color:#1D4E89}
  body.qme-essai-lecture [data-qme-bloque]{cursor:not-allowed}
  @media print{.qme-essai{display:none}}`;
  document.head.appendChild(style);

  // ---------- Bandeau ----------
  function bandeau() {
    let el = document.querySelector('.qme-essai');
    if (!essai) { el?.remove(); document.body.classList.remove('qme-essai-lecture'); return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'qme-essai';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Essai gratuit');
      document.body.prepend(el);
    }
    const acheter = essai.achat ? `<a href="${esc(essai.achat)}" target="_blank" rel="noopener" data-goatcounter-click="essai-achat-${esc(SLUG)}">Acheter${essai.prix ? ` · ${euros(essai.prix)}` : ''}</a>` : '';
    if (essai.termine) {
      el.dataset.etat = 'termine';
      el.innerHTML = `<span class="qme-essai-txt"><b>Essai terminé</b> · vos données sont en lecture seule jusqu'au ${dateCourte(essai.effacement)}. Achetez pour les garder et continuer.</span><span class="qme-essai-actions">${acheter}<button type="button" data-qme="achete">J'ai acheté</button></span>`;
    } else {
      el.dataset.etat = 'actif';
      const n = essai.joursRestants;
      const reste = n === 0 ? 'dernier jour' : `encore ${n} jour${n > 1 ? 's' : ''}`;
      el.innerHTML = `<span class="qme-essai-txt"><b>Essai gratuit</b> · ${reste}, jusqu'au ${dateCourte(essai.fin)} inclus. Vos données seront reprises si vous achetez.</span><span class="qme-essai-actions">${acheter}<button type="button" data-qme="achete">J'ai acheté</button></span>`;
    }
    document.body.classList.toggle('qme-essai-lecture', !!essai.termine);
  }

  function majEssai(info) {
    essai = info;
    if (document.body) bandeau(); else document.addEventListener('DOMContentLoaded', bandeau, { once: true });
  }

  // ---------- Fenêtres ----------
  function dialogue(html) {
    document.querySelector('.qme-essai-dlg')?.remove();
    const d = document.createElement('dialog');
    d.className = 'qme-essai-dlg';
    d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.showModal();
    return d;
  }

  // modif : une modification a été faite à l'écran mais pas enregistrée (rechargement à la fermeture).
  function signalerLectureSeule(modif = false) {
    if (modif) modificationBloquee = true;
    if (document.querySelector('.qme-essai-dlg')) return;
    const d = dialogue(`<div class="qme-corps" role="document">
      <h2 id="qme-ls-titre">Lecture seule</h2>
      <p>Votre essai gratuit est terminé : vous pouvez consulter et exporter vos données jusqu'au ${essai?.effacement ? dateCourte(essai.effacement) : 'leur effacement'}, mais plus les modifier.</p>
      <p>Achetez le template pour continuer : <b>tout ce que vous avez saisi est repris</b>, rien à refaire.</p>
      <div class="qme-rang">
        <button type="button" class="qme-btn" data-qme="fermer">Fermer</button>
        <button type="button" class="qme-btn" data-qme="achete">J'ai acheté</button>
        ${essai?.achat ? `<a class="qme-btn qme-jaune" href="${esc(essai.achat)}" target="_blank" rel="noopener" data-goatcounter-click="essai-achat-ls-${esc(SLUG)}">Acheter${essai.prix ? ` · ${euros(essai.prix)}` : ''}</a>` : ''}
      </div></div>`);
    d.setAttribute('aria-labelledby', 'qme-ls-titre');
    d.addEventListener('close', () => {
      // Une modification a été faite à l'écran mais pas enregistrée : on réaffiche la version enregistrée.
      if (modificationBloquee && !document.querySelector('.qme-essai-dlg[data-achat]')) { modificationBloquee = false; location.reload(); }
    });
  }

  function fenetreAchat() {
    const d = dialogue(`<form method="dialog" novalidate>
      <h2 id="qme-achat-titre">J'ai acheté</h2>
      <p>Saisissez la clé de licence reçue par e-mail après votre achat sur Gumroad. Les données de votre essai sont reprises telles quelles.</p>
      <label>Clé de licence
        <input name="cle" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" required>
      </label>
      <p class="qme-erreur" role="alert"></p>
      <div class="qme-rang">
        <button type="button" class="qme-btn" data-qme="fermer">Annuler</button>
        <button type="submit" class="qme-btn qme-primaire">Ouvrir avec ma clé</button>
      </div></form>`);
    d.dataset.achat = '1';
    d.setAttribute('aria-labelledby', 'qme-achat-titre');
    const form = d.querySelector('form'), champ = form.cle, err = form.querySelector('.qme-erreur'), bouton = form.querySelector('[type=submit]');
    champ.addEventListener('input', () => {
      const n = champ.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 32);
      champ.value = [n.slice(0, 8), n.slice(8, 16), n.slice(16, 24), n.slice(24, 32)].filter(Boolean).join('-');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cle = champ.value.trim();
      if (!LICENCE.test(cle)) { err.textContent = 'Clé incomplète : 4 blocs de 8 caractères, à copier depuis l\'e-mail de Gumroad.'; champ.focus(); return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
      try {
        const r = await fetchOrigine(`${API}/connexion`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: cle, produit: PRODUIT, essai: lire(CLE_ESSAI) }) });
        const corps = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(corps.erreur || 'Clé inconnue. Vérifiez-la dans l\'e-mail reçu après l\'achat.');
        // Clé du template, ou clé d'un pack qui le contient.
        let code = null;
        if (corps.produit === PRODUIT) code = cle;
        else if (Array.isArray(corps.templates)) code = corps.templates.find((t) => t.produit === PRODUIT)?.code || null;
        if (!code) throw new Error('Cette clé ouvre un autre template QME : elle ne correspond pas à celui-ci.');
        suppr(CLE_CODE); suppr(CLE_CACHE); suppr(CLE_ESSAI);
        ecrire(CLE_CODE, code);
        modificationBloquee = false;
        d.innerHTML = '<div class="qme-corps"><h2>Merci pour votre achat</h2><p>Vos données d\'essai sont reprises. Ouverture…</p></div>';
        setTimeout(() => location.reload(), 900);
      } catch (x) {
        err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessayez une fois en ligne.' : x.message;
        bouton.disabled = false; bouton.textContent = 'Ouvrir avec ma clé'; champ.focus();
      }
    });
    champ.focus();
  }

  // ---------- Lecture seule : actions qui modifient arrêtées au clic ----------
  const PERMIS = /^(vue|sous-vue|onglet|tutoriel|reglages|installer|fermer|exporter|exporter-photos|ecran-accueil|deconnexion|csv.*|imprimer.*|lancer-impression|fiche-imprimer|copier.*|partager|ics|agenda|mois-(suiv|prec|auj|courant)|jour-(suiv|prec|auj)|jour|semaine-(suiv|prec|auj)|annee-(suiv|prec|auj)|trim-(suiv|prec|auj)|bilan-(suiv|prec|auj)|revue-(suiv|prec)|filtre.*|filtres-effacer|voir-.*|photo-voir|detail.*|deplier|periode|prog-periode|historique.*|journal-tout|toutes.*|sous-planning|sous-budget|mois|annee|semaine|demo.*|methode|jauge-info|phase-infos|ouvrir-analyse|grille|listes|lignes|catalogue|bibliotheque|groupes|base|source|conditions|hypotheses|en-retard|dans-les-temps|sans-date|jetes|actives|prevus|recap|idees|artisans|essentiels|semaines-types|aller-.*|suggestion-location|test-reglages|copier-cle|cle)$/;
  function bloque(el) {
    const action = el.dataset.action;
    if (!action) return false;
    if (PERMIS.test(action)) return false;
    return true; // toute autre action est traitée comme une modification (prudence : lecture seule)
  }

  document.addEventListener('click', (e) => {
    const qme = e.target.closest?.('[data-qme]');
    if (qme) {
      e.preventDefault();
      if (qme.dataset.qme === 'achete') fenetreAchat();
      else if (qme.dataset.qme === 'fermer') qme.closest('dialog')?.close();
      return;
    }
    if (!essai?.termine) return;
    if (e.target.closest?.('.qme-essai, .qme-essai-dlg')) return;
    const el = e.target.closest?.('[data-action]');
    const caseACocher = e.target.closest?.('input[type=checkbox], input[type=radio]');
    if ((el && bloque(el)) || (caseACocher && !caseACocher.closest('nav, [role=tablist], .filtres, .filtre'))) {
      e.preventDefault(); e.stopImmediatePropagation();
      signalerLectureSeule();
    }
  }, true);
  document.addEventListener('submit', (e) => {
    if (!essai?.termine || e.target.closest?.('.qme-essai-dlg')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    signalerLectureSeule();
  }, true);
  document.addEventListener('dragstart', (e) => { if (essai?.termine) { e.preventDefault(); signalerLectureSeule(); } }, true);

  // ---------- Écran de connexion : lien vers l'essai ----------
  function lienEssai() {
    const zone = document.querySelector('.formulaire-acces');
    if (!zone || zone.querySelector('.qme-essai-lien') || essai) return;
    const p = document.createElement('p');
    p.className = 'qme-essai-lien';
    p.innerHTML = `<b>Pas encore de clé ?</b> Essayez gratuitement pendant 14 jours, sans carte bancaire : vos données vous suivent si vous achetez. <a href="/essai/?t=${encodeURIComponent(SLUG)}" data-goatcounter-click="essai-depuis-app-${esc(SLUG)}">Lancer l'essai gratuit</a>`;
    const form = zone.querySelector('form');
    (form || zone.lastElementChild)?.after(p);
  }
  const observer = new MutationObserver(lienEssai);
  const brancher = () => { observer.observe(document.body, { childList: true, subtree: true }); lienEssai(); bandeau(); };
  if (document.body) brancher(); else document.addEventListener('DOMContentLoaded', brancher, { once: true });

  // Pour les tests automatisés uniquement.
  window.__qmeEssai = { etat: () => essai };
})();
