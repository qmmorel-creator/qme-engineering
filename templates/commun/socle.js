// Socle commun des applications QME de la gamme T69–T77 : accès par clé de licence Gumroad ou code
// d'accès, mode découverte (démo locale), synchronisation /api/templates (cache local, hors ligne,
// conflit 409), modales, toast avec « Annuler », réglages (export / import JSON, déconnexion),
// fenêtre « Comme une application ». Repris du socle des templates en vente (templates/abonnements/),
// sans changement de comportement : le moteur de licence côté serveur n'est pas modifié.
// Chaque application fournit sa configuration (métier, vues, actions) à QME_SOCLE.creer().
(function () {
  'use strict';
  const O = window.QME_OUTILS;
  const API = '/api/templates';
  const CODE_DEMO = 'DEMO';

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${O.fmtNombre(n)} ${Math.abs(n) > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); return true; } catch { return false; } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* stockage indisponible */ } },
  };
  const MQ_TEL = matchMedia('(max-width: 720px)');

  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  const ICONE_REGLAGES = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>';
  const ICONES = {
    rond: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    lignes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    grille: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    barres: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    triangle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    quart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    carre: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    droite: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="34" cy="34" r="34" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';

  function creer(C) {
    const PRODUIT = C.produit;
    const CLE_CODE = `qme-${C.prefixe}-code`;
    const CLE_CACHE = `qme-${C.prefixe}-cache`;
    const CLE_DEMO = `qme-${C.prefixe}-demo`;
    const CLE_ACCUEIL = `qme-${C.prefixe}-ecran-accueil`;
    let E = null;
    const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
    let vue = C.vueParDefaut || C.onglets[0].id;
    let annulation = null;
    let minuterie = null, envoiEnCours = false, aRenvoyer = false, etatSync = 'ok';

    const api = {
      $, esc, pluriel, O, ICONES, FORME_VIDE, MARQUE, stock, session,
      auj: () => O.iso(new Date()),
      estTel: () => MQ_TEL.matches,
      get E() { return E; },
      set E(v) { E = v; },
      get vue() { return vue; },
      modale: () => $('#modale'),
    };

    // ---------- Annuler ----------
    api.retenir = () => { annulation = structuredClone(E); };
    api.annuler = () => {
      if (!annulation) return;
      E = annulation; annulation = null;
      api.sauver(); api.rendre();
      api.toast('Modification annulée.');
    };

    // ---------- Stockage et synchronisation ----------
    function cache(nonEnvoye = false) {
      if (session.demo) { if (!stock.ecrire(CLE_DEMO, E)) api.toast('Le navigateur refuse d\'enregistrer la démo (stockage plein ou privé).'); return; }
      stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, nonEnvoye }, !session.memoriser);
    }
    // Contrôle de taille avant enregistrement : renvoie false (et prévient) si l'état dépasse la limite.
    api.tailleOk = (etat = E) => O.tailleJson(etat) <= O.TAILLE_MAX;
    api.sauver = () => {
      if (!api.tailleOk()) { api.toast('Données trop volumineuses pour être enregistrées (limite de 880 Ko). Supprime des photos ou des éléments anciens.'); return false; }
      cache(true);
      if (session.demo) return true;
      majSync('attente');
      clearTimeout(minuterie);
      minuterie = setTimeout(envoyer, 600);
      return true;
    };

    async function appel(chemin, options = {}) {
      const r = await fetch(API + chemin, { ...options, headers: { 'content-type': 'application/json', ...(session.jeton ? { 'x-code': session.jeton } : {}), ...(options.headers || {}) } });
      let corps = null;
      try { corps = await r.json(); } catch { /* corps vide */ }
      return { statut: r.status, corps };
    }

    async function envoyer() {
      if (session.demo) return;
      if (envoiEnCours) { aRenvoyer = true; return; }
      envoiEnCours = true;
      majSync('envoi');
      try {
        const { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
        if (statut === 409) {
          E = C.normaliser(corps.donnees);
          session.base = corps.donnees.majLe;
          cache(false);
          api.rendre();
          api.toast('Un autre appareil a modifié tes données entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
        } else if (statut === 401) {
          deconnecter('Ce code d\'accès n\'est plus valide.');
          return;
        } else if (statut === 413) {
          api.toast('Données trop volumineuses pour le stockage en ligne. Supprime des photos ou des éléments anciens.');
          throw new Error('413');
        } else if (statut !== 200) {
          throw new Error(String(statut));
        } else {
          session.base = corps.majLe;
          cache(false);
        }
        majSync('ok');
      } catch {
        majSync('horsligne');
      } finally {
        envoiEnCours = false;
        if (aRenvoyer) { aRenvoyer = false; envoyer(); }
      }
    }

    async function rafraichir() {
      if (session.demo || !session.code || etatSync !== 'ok' || envoiEnCours) return;
      try {
        const { statut, corps } = await appel('/donnees');
        if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
          E = C.normaliser(corps.donnees);
          session.base = corps.donnees.majLe;
          cache(false);
          if (!api.modale().open) api.rendre();
        }
      } catch { majSync('horsligne'); }
    }

    function majSync(etat) {
      etatSync = etat;
      const el = $('.sync');
      if (!el) return;
      const libelles = { ok: 'Enregistré', attente: 'Modifié', envoi: 'Enregistrement…', horsligne: 'Hors ligne', demo: 'Découverte' };
      el.dataset.etat = etat;
      el.querySelector('b').textContent = libelles[etat];
      el.title = etat === 'horsligne' ? 'Pas de connexion : tes modifications sont gardées sur cet appareil et seront envoyées au retour du réseau.'
        : etat === 'demo' ? 'Mode découverte : données gardées dans ce navigateur uniquement.' : libelles[etat];
    }
    api.etatSync = () => etatSync;

    // ---------- Connexion ----------
    // Code interne (3 lettres dont au moins une hors de A–F) ou clé Gumroad (32 caractères hexadécimaux).
    const estCodeInterne = (n) => /^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3));
    function formaterCode(v) {
      const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
      if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
      if (estCodeInterne(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
      const l = n.slice(0, 32);
      return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
    }
    const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCodeInterne(n) && n.length === 19) || /^[0-9A-F]{32}$/.test(n); };
    api.formaterCode = formaterCode;
    api.codeComplet = codeComplet;

    async function connecter(code, memoriser) {
      if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
      const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
      if (statut === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après ton achat.');
      if (statut === 403) throw new Error(corps?.erreur || 'Cet achat a été remboursé ou contesté : l\'accès est fermé.');
      if (statut !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
      if (corps.produit !== PRODUIT) throw new Error('Cette clé ouvre un autre template QME : utilise la page qm-engineering.fr/connexion/.');
      session.code = code; session.jeton = corps.jeton; session.demo = false; session.memoriser = memoriser;
      stock.suppr(CLE_CODE);
      stock.ecrire(CLE_CODE, code, !memoriser);
      chargerDepuisServeur(corps.donnees);
    }

    function chargerDepuisServeur(donnees) {
      const c = stock.lire(CLE_CACHE);
      if (c && c.code === session.code && c.nonEnvoye && (!donnees || c.base === donnees.majLe)) {
        E = C.normaliser(c.etat); session.base = donnees?.majLe ?? null;
        demarrer(); envoyer();
        return;
      }
      E = donnees ? C.normaliser(donnees) : null;
      session.base = donnees?.majLe ?? null;
      if (E) { cache(false); demarrer(); } else premierLancement();
    }

    function ouvrirDemo(memoriser = true) {
      session.demo = true; session.code = null; session.jeton = null;
      if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
      const d = stock.lire(CLE_DEMO);
      E = d ? C.normaliser(d) : C.donneesDemo();
      cache();
      demarrer();
    }

    function deconnecter(message) {
      stock.suppr(CLE_CODE);
      if (!session.demo) stock.suppr(CLE_CACHE);
      session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null;
      document.body.classList.remove('app');
      ecranConnexion(message);
    }
    api.deconnecter = deconnecter;

    function ecranConnexion(message = '') {
      const K = C.connexion;
      document.title = `${C.nom} · QME`;
      $('#racine').innerHTML = `
      <div class="connexion">
        <section class="composition" aria-label="Présentation">
          <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
          <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
            <circle cx="80" cy="80" r="60" fill="#F5B400"/>
            <rect x="160" y="20" width="120" height="120" fill="#1D4E89"/>
            <rect x="20" y="160" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
            <path d="M160 280 L160 160 A120 120 0 0 1 280 280 Z" fill="#D9302A"/>
            <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
            <path d="M430 150 L430 20 A130 130 0 0 1 560 150 Z" fill="#141414"/>
            <rect x="410" y="130" width="40" height="40" fill="#F5B400"/>
          </svg>
          <div class="accroche">
            <p class="surtitre">${esc(C.nom)}</p>
            <h1>${K.titre}</h1>
            <p>${K.texte}</p>
          </div>
        </section>
        <section class="formulaire-acces">
          <div><p class="surtitre">Accès acheteur</p><h2>${esc(K.ouvrir || 'Ouvre ton application')}</h2></div>
          <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes données sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
          <form id="form-code" class="formulaire-acces-form" novalidate>
            <label class="champ code-saisie">Clé de licence ou code d'accès
              <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
            </label>
            <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
            <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
            <button class="btn primaire" type="submit" style="width:100%">${esc(K.bouton)}</button>
          </form>
          <div class="separateur">ou</div>
          <button class="btn" type="button" data-action="demo">Découvrir avec des données d'exemple</button>
          <p class="mention"><b>Découverte gratuite</b> : toutes les fonctions, avec un exemple fictif, gardé sur cet appareil seulement. <b>Version complète</b> (achat unique) : tes propres données, enregistrées en ligne et synchronisées entre tes appareils. Pas encore de licence ? <a href="/templates/">Voir l'offre</a>. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
        </section>
      </div>`;
      const champ = $('#code');
      champ.addEventListener('input', () => {
        const fin = champ.selectionStart === champ.value.length;
        champ.value = formaterCode(champ.value);
        if (fin) champ.setSelectionRange(champ.value.length, champ.value.length);
      });
      $('#form-code').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = formaterCode(champ.value);
        const err = $('#erreur-code');
        const bouton = e.target.querySelector('button[type=submit]');
        if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = 'Clé incomplète : elle compte 4 blocs de 8 caractères (copie-la depuis l\'e-mail de Gumroad).'; champ.focus(); return; }
        bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
        try { await connecter(code, $('#memoriser').checked); } catch (x) {
          err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x.message;
          bouton.disabled = false; bouton.textContent = K.bouton; champ.focus();
        }
      });
    }

    // ---------- Premier lancement ----------
    function premierLancement() {
      if (!C.accueil) { api.terminerAccueil(C.etatVide()); return; }
      api.ecranAccueil();
    }
    api.ecranAccueil = () => {
      document.body.classList.remove('app');
      $('#racine').innerHTML = `<div class="accueil"><div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="mini">${esc(C.nom)}</span></div>${C.accueil()}</div>`;
      C.apresAccueil?.();
    };
    api.terminerAccueil = (etat, { vue: v, message } = {}) => {
      E = etat;
      if (v) vue = v;
      api.sauver();
      demarrer();
      if (message) api.toast(message);
    };

    // ---------- Application ----------
    function demarrer() {
      document.body.classList.add('app');
      const depuisUrl = location.hash.slice(1);
      if (C.onglets.some((o) => o.id === depuisUrl)) vue = depuisUrl;
      $('#racine').innerHTML = `
        ${session.demo ? `<div class="bandeau-demo"><div><b>Découverte</b><span>Exemple fictif, gardé dans ce navigateur. La version complète enregistre tes données en ligne.</span><button data-action="demo-reinit">Recommencer l'exemple</button><button data-action="demo-vide">Partir d'une page vide</button><button data-action="deconnexion">J'ai une clé de licence</button></div></div>` : ''}
        <header class="barre"><div class="barre-int">
          <span class="marque">${MARQUE}</span>
          <span class="titre-produit">${C.titreBarre || esc(C.nom)}</span>
          <nav class="onglets" aria-label="Sections">${C.onglets.map((o) => `<button class="onglet" data-action="vue" data-vue="${o.id}">${ICONES[o.icone] || o.icone || ICONES.rond}<span>${esc(o.nom)}</span></button>`).join('')}</nav>
          <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
          <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONE_REGLAGES}</button>
        </div></header>
        <main class="vue" id="vue" tabindex="-1"></main>`;
      majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
      api.rendre();
      proposerEcranAccueil();
    }

    api.rendre = () => {
      if (!E || !$('#vue')) return;
      document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
      const o = C.onglets.find((x) => x.id === vue) || C.onglets[0];
      document.title = `${o.nom} · ${C.nom}`;
      const el = $('#vue');
      el.className = `vue vue-${o.id}`;
      // Garder la saisie d'un champ de recherche pendant le re-rendu.
      const actif = document.activeElement;
      const idActif = actif && actif.id && el.contains(actif) ? actif.id : null;
      const pos = idActif && 'selectionStart' in actif ? actif.selectionStart : null;
      try {
        el.innerHTML = C.vues[o.id]();
      } catch (x) {
        console.error(x);
        el.innerHTML = `<div class="vide-etat"><div><h3>Affichage impossible</h3><p>Une donnée inattendue empêche d'afficher cette page. Tes données ne sont pas perdues : télécharge une copie depuis les réglages et écris à quentin.morel@qm-engineering.fr.</p></div></div>`;
      }
      if (idActif) { const n = document.getElementById(idActif); if (n) { n.focus(); if (pos !== null && n.setSelectionRange) try { n.setSelectionRange(pos, pos); } catch { /* type sans sélection */ } } }
      brancherInfobulles();
      C.apresRendu?.();
    };

    api.changerVue = (v) => {
      vue = v;
      history.replaceState(null, '', `#${v}`);
      api.rendre();
      window.scrollTo({ top: 0 });
      $('#vue')?.focus({ preventScroll: true });
    };

    function brancherInfobulles() {
      document.querySelectorAll('.graphique').forEach((fig) => {
        const bulle = fig.querySelector('.infobulle');
        if (!bulle) return;
        const montrer = (el) => {
          fig.querySelectorAll('[data-info]').forEach((x) => x.classList.toggle('survol', x === el));
          bulle.innerHTML = el.dataset.info;
          bulle.hidden = false;
          const re = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
          let x = re.left - rf.left + Math.min(re.width / 2, 220) + 12;
          if (x + bulle.offsetWidth > rf.width - 8) x = Math.max(8, rf.width - bulle.offsetWidth - 8);
          bulle.style.left = `${x}px`;
          bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight - 8)}px`;
        };
        const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
        fig.querySelectorAll('[data-info]').forEach((el) => {
          el.addEventListener('pointerenter', () => montrer(el));
          el.addEventListener('click', () => montrer(el));
          el.addEventListener('focus', () => montrer(el));
          el.addEventListener('blur', cacher);
        });
        fig.addEventListener('pointerleave', cacher);
      });
    }

    // ---------- Modales ----------
    // auValider(FormData, valeurDuBouton) : renvoie un message d'erreur (la modale reste ouverte) ou rien.
    api.ouvrirModale = (titre, corps, pied, auValider, { large = false } = {}) => {
      const d = api.modale();
      d.classList.toggle('large', large);
      d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
      d.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (e.submitter?.value === 'annuler') return d.close();
        let err;
        try { err = auValider?.(new FormData(e.target), e.submitter?.value); } catch (x) { console.error(x); err = 'Erreur inattendue : rien n\'a été enregistré.'; }
        if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) { p.textContent = err; p.scrollIntoView({ block: 'nearest' }); } return; }
        if (d.dataset.garder) { delete d.dataset.garder; return; }
        d.close();
      });
      if (!d.open) d.showModal();
      if (!api.estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]),select,textarea')?.focus();
      return d;
    };
    // Garder la modale ouverte après validation (enchaînement vers une autre modale).
    api.garderModale = () => { api.modale().dataset.garder = '1'; };
    api.confirmer = (texte) => window.confirm(texte);

    // ---------- Réglages ----------
    function modaleReglages() {
      const R = C.reglages || {};
      const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
      const taille = O.tailleJson(E);
      const corps = `
        ${R.corps ? R.corps() : ''}
        <p class="erreur" role="alert"></p>
        <div class="groupe"><h3>Exporter et imprimer</h3><p class="aide">Aucun envoi automatique : imprime, ou exporte en tableur (CSV) ou en sauvegarde complète (JSON).</p>
          <div class="rang">${(R.exports || []).map(([a, l]) => `<button class="btn petit" type="button" data-action="${a}">${esc(l)}</button>`).join('')}<button class="btn petit" type="button" data-action="exporter-json">Sauvegarde complète (JSON)</button></div></div>
        <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En découverte, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'} Taille actuelle : ${O.fmtNombre(Math.ceil(taille / 1024))} Ko sur ${O.fmtNombre(Math.round(O.TAILLE_MAX / 1024))} Ko.</p>
          <div class="rang"><label class="btn petit" style="cursor:pointer">Restaurer une sauvegarde (JSON)<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
        <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode découverte : rien n\'est envoyé en ligne.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
          <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la découverte' : 'Se déconnecter de cet appareil'}</button></div></div>
        <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cette application à ton écran d'accueil pour l'ouvrir d'un geste, même hors connexion.</p>
          <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
        ${R.aPropos ? `<div class="groupe"><h3>À propos</h3>${R.aPropos()}</div>` : ''}`;
      api.ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
        if (!R.valider) return undefined;
        api.retenir();
        const err = R.valider(f);
        if (typeof err === 'string') return err;
        api.sauver(); api.rendre(); api.toast('Réglages enregistrés.');
        return undefined;
      }, { large: !!R.large });
      $('#import').addEventListener('change', async (e) => {
        const fichier = e.target.files[0];
        if (!fichier) return;
        try {
          const d = JSON.parse(await fichier.text());
          if (!C.importValide(d)) throw new Error('format');
          if (!api.confirmer(`Remplacer toutes tes données actuelles par cette sauvegarde (${C.resumeImport ? C.resumeImport(d) : fichier.name}) ?`)) return;
          api.retenir();
          E = C.normaliser(d); delete E.majLe;
          api.modale().close();
          if (api.sauver()) { api.rendre(); api.toast('Sauvegarde restaurée.', { libelle: 'Annuler', faire: api.annuler }); }
        } catch { api.toast('Ce fichier n\'est pas une sauvegarde valide de cette application.'); }
      });
    }
    api.modaleReglages = modaleReglages;

    api.telecharger = (contenu, type, nom) => {
      const blob = new Blob([contenu], { type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nom;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    api.exporterCsv = (lignes, nom) => api.telecharger(O.versCsv(lignes), 'text/csv;charset=utf-8', `${nom}-${api.auj()}.csv`);
    const exporterJson = () => api.telecharger(JSON.stringify({ application: C.nom, produit: PRODUIT, exporteLe: new Date().toISOString(), ...E }, null, 2), 'application/json', `${C.fichier}-${api.auj()}.json`);
    api.imprimer = (avant) => { if (api.modale().open) api.modale().close(); avant?.(); setTimeout(() => window.print(), 80); };

    // ---------- Ajout à l'écran d'accueil ----------
    const appareil = () => {
      const ua = navigator.userAgent;
      if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
      if (/Android/.test(ua)) return 'android';
      return 'autre';
    };
    const dejaInstalle = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    let inviteInstallation = null;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); inviteInstallation = e; });
    window.addEventListener('appinstalled', () => { inviteInstallation = null; stock.ecrire(CLE_ACCUEIL, 'installe'); });
    const ETAPES_IOS = `<ol class="etapes-accueil">
        <li>Ouvre cette page dans <b>Safari</b>.</li>
        <li>Touche le bouton <b>Partager</b> (carré avec une flèche vers le haut). S'il n'est pas visible, touche d'abord <b>···</b>.</li>
        <li>Fais défiler et choisis <b>Sur l'écran d'accueil</b>.</li>
        <li>Laisse <b>Ouvrir comme app web</b> activé si l'option s'affiche, puis touche <b>Ajouter</b>.</li>
      </ol>`;
    const ETAPES_ANDROID = `<ol class="etapes-accueil">
        <li>Ouvre cette page dans <b>Chrome</b>.</li>
        <li>Touche le menu <b>⋮</b> en haut à droite.</li>
        <li>Choisis <b>Ajouter à l'écran d'accueil</b> (ou <b>Installer l'application</b>), puis <b>Installer</b>.</li>
      </ol>
      <p class="aide">Autre navigateur : cherche la même option dans son menu.</p>`;
    function modaleEcranAccueil(auto = false) {
      const a = appareil();
      const installable = a !== 'ios' && inviteInstallation;
      const blocs = a === 'ios' ? ETAPES_IOS : a === 'android' ? ETAPES_ANDROID
        : `<h3 class="titre-etapes">Sur iPhone ou iPad</h3>${ETAPES_IOS}<h3 class="titre-etapes">Sur Android</h3>${ETAPES_ANDROID}`;
      const corps = `
        <p>Enregistre cette application sur ton écran d'accueil : elle s'ouvre ensuite d'un geste, en plein écran, sans rien télécharger dans un magasin d'applications.</p>
        ${installable ? '<div class="rang"><button class="btn primaire" type="button" data-action="installer">Ajouter à l\'écran d\'accueil</button></div><p class="aide">Ou à la main :</p>' : ''}
        ${blocs}
        <p class="aide">Tes données restent les mêmes : l'icône ouvre cette page avec ta clé déjà enregistrée sur cet appareil.${a === 'autre' ? ' Sur ordinateur, la page fonctionne aussi directement dans le navigateur.' : ''}</p>`;
      const pied = auto ? '<button class="btn primaire" value="plus-tard">Plus tard</button><button class="btn" value="jamais">Ne plus afficher</button>' : '<button class="btn primaire" value="ok">Fermer</button>';
      api.ouvrirModale('Comme une application', corps, pied, (_, choix) => { if (choix === 'jamais') stock.ecrire(CLE_ACCUEIL, 'masque'); });
    }
    function proposerEcranAccueil() {
      if (dejaInstalle() || stock.lire(CLE_ACCUEIL)) return;
      if (appareil() === 'autre' && !MQ_TEL.matches) return;
      setTimeout(() => { if (!api.modale().open && !dejaInstalle()) modaleEcranAccueil(true); }, 900);
    }
    async function installer() {
      if (!inviteInstallation) return;
      const invite = inviteInstallation; inviteInstallation = null;
      if (api.modale().open) api.modale().close();
      invite.prompt();
      const { outcome } = await invite.userChoice.catch(() => ({}));
      if (outcome === 'accepted') stock.ecrire(CLE_ACCUEIL, 'installe');
    }

    // ---------- Toast ----------
    let minuterieToast = null;
    api.toast = (texte, action) => {
      const el = $('#toast');
      el.innerHTML = `<span>${esc(texte)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
      el.hidden = false;
      if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
      clearTimeout(minuterieToast);
      minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4500);
    };

    // ---------- Actions ----------
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const { action } = el.dataset;
      switch (action) {
        case 'demo': ouvrirDemo(); return;
        case 'demo-reinit': if (api.confirmer('Effacer tes changements et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = C.donneesDemo(); cache(); api.rendre(); api.toast('Exemple rechargé.'); } return;
        case 'demo-vide': if (api.confirmer('Vider l\'exemple pour essayer avec tes propres données (toujours gardées dans ce navigateur seulement) ?')) { E = C.etatVide(); cache(); api.rendre(); api.toast('Page vide : à toi de jouer.'); } return;
        case 'deconnexion': if (api.modale().open) api.modale().close(); deconnecter(); return;
        case 'vue': if (api.modale().open) api.modale().close(); api.changerVue(el.dataset.vue); return;
        case 'reglages': modaleReglages(); return;
        case 'ecran-accueil': modaleEcranAccueil(); return;
        case 'installer': installer(); return;
        case 'exporter-json': exporterJson(); return;
        case 'fermer': api.modale().close(); return;
        default: break;
      }
      const f = C.actions?.[action];
      if (f) {
        try { f(el, e); } catch (x) { console.error(x); api.toast('Action impossible : une donnée est inattendue. Rien n\'a été modifié.'); }
      }
    });
    document.addEventListener('click', (e) => { if (e.target === api.modale()) api.modale().close(); });
    window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !E) return;
      rafraichir();
      if (!api.modale().open) api.rendre();
    });
    window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

    // ---------- Démarrage ----------
    api.lancer = async () => {
      if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
      const code = stock.lire(CLE_CODE);
      const parDemo = new URLSearchParams(location.search).has('demo');
      if (parDemo) history.replaceState(null, '', location.pathname + location.hash);
      // Lien ?demo : jamais d'écrasement du code d'un acheteur enregistré ; démo non mémorisée.
      if (parDemo && !code) return ouvrirDemo(false);
      if (!code) return ecranConnexion();
      if (code === CODE_DEMO) return ouvrirDemo();
      session.code = code;
      try { session.memoriser = localStorage.getItem(CLE_CODE) !== null; } catch { session.memoriser = false; }
      try {
        const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
        if (statut === 401 || statut === 403) return deconnecter(corps?.erreur || 'Ce code d\'accès n\'est plus valide.');
        if (statut !== 200) throw new Error();
        if (corps.produit !== PRODUIT) return deconnecter('Cette clé ouvre un autre template QME.');
        session.jeton = corps.jeton;
        chargerDepuisServeur(corps.donnees);
      } catch {
        const c = stock.lire(CLE_CACHE);
        if (c && c.code === code && c.etat && c.jeton) {
          E = C.normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
          demarrer(); majSync('horsligne');
        } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
      }
    };

    // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
    window[`__${C.fichier.replace(/-/g, '_')}`] = { etat: () => E, api };
    return api;
  }

  window.QME_SOCLE = { creer, esc, pluriel, ICONES, FORME_VIDE };
})();
