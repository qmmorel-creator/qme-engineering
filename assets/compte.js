// Compte acheteur QME côté navigateur (API /api/compte, netlify/lib/comptes.mjs) : connexion par lien e-mail,
// synchronisation des clés et des préférences de l'espace entre l'appareil et le compte.
//  - clés du compte → appareil : qme-<pre>-code (et qme-<pre>-essai pour un essai), qme-packs ; un code déjà
//    présent sur l'appareil n'est jamais remplacé ;
//  - clés de l'appareil → compte : envoyées à chaque synchronisation si le compte ne les a pas ;
//  - préférences (prénom, noms, masquées, épinglées) : la version la plus récente l'emporte.
// Session : localStorage qme-compte { jeton, email, cles }. Événement « qme-compte » après chaque synchronisation.
// Requiert assets/espace.js (QMEEspace) et la constante globale PRODUITS de la page.
(() => {
  const CLE = 'qme-compte', API = '/api/compte';
  const E = window.QMEEspace;
  const lire = (c) => { try { const v = localStorage.getItem(c); return v ? JSON.parse(v) : null; } catch { return null; } };
  const garder = (c, v) => { try { if (v === null) localStorage.removeItem(c); else localStorage.setItem(c, JSON.stringify(v)); } catch { /* indisponible */ } };
  const norm = (s) => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  let compte = null, envoiPrefs = null;

  const session = () => lire(CLE);
  async function api(chemin, { methode = 'GET', corps } = {}) {
    const s = session();
    const r = await fetch(API + chemin, {
      method: methode,
      headers: { ...(corps ? { 'content-type': 'application/json' } : {}), ...(s?.jeton ? { authorization: `Bearer ${s.jeton}` } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    // Session refusée : seulement sur les routes qui l'exigent (un vieux lien refusé ne déconnecte pas).
    if (r.status === 401 && s && chemin !== '/session' && chemin !== '/lien') { garder(CLE, null); compte = null; signaler(); }
    if (!r.ok) { const x = new Error(j.erreur || 'Le service ne répond pas. Réessayez dans un instant.'); x.statut = r.status; throw x; }
    return j;
  }
  const signaler = () => window.dispatchEvent(new CustomEvent('qme-compte', { detail: { compte } }));

  // Clés présentes sur l'appareil (applications, essais, packs), au format attendu par POST /cles.
  function clesAppareil() {
    const l = [];
    // PRODUITS est déclaré par la page avec const : global, mais pas propriété de window.
    const produits = typeof PRODUITS !== 'undefined' ? PRODUITS : {}; // eslint-disable-line no-undef
    for (const [p, d] of Object.entries(produits)) {
      const c = E.lire(d.cle);
      if (typeof c === 'string' && c !== 'DEMO' && !norm(c).startsWith('ADM')) l.push({ p, code: c });
    }
    for (const c of lire('qme-packs') || []) if (typeof c === 'string') l.push({ p: 'PACK', code: c });
    return l;
  }

  async function synchroniser(c) {
    compte = c;
    // Clés du compte gardées avec la session : « retirer de cet appareil » fonctionne même hors ligne.
    const s = session();
    if (s) garder(CLE, { ...s, cles: c.cles.map(({ type, p, code }) => ({ type, p, code })) });
    // Compte → appareil
    const packs = lire('qme-packs') || [];
    for (const k of c.cles) {
      if (k.type === 'pack') { if (!packs.some((x) => norm(x) === norm(k.code))) packs.push(k.code); continue; }
      const cle = `qme-${k.p.toLowerCase()}-code`, actuel = E.lire(cle);
      // Un code présent n'est jamais remplacé, sauf un code d'essai quand le compte a l'achat : la clé achetée prend
      // sa place et le code d'essai reste dans qme-<pre>-essai, qu'essai.js joint à la connexion suivante pour que
      // le serveur reprenne les données de l'essai (même chemin que « J'ai acheté »).
      const essaiLocal = E.lire(`qme-${k.p.toLowerCase()}-essai`);
      const remplacerEssai = k.type === 'template' && actuel && essaiLocal && norm(actuel) === norm(essaiLocal);
      if (actuel && actuel !== 'DEMO' && !remplacerEssai) continue;
      garder(cle, k.code);
      if (k.type === 'essai') garder(`qme-${k.p.toLowerCase()}-essai`, k.code);
    }
    for (const e of c.essais || []) {
      const cle = `qme-${e.p.toLowerCase()}-code`, actuel = E.lire(cle);
      if (!actuel || actuel === 'DEMO') { garder(cle, e.code); garder(`qme-${e.p.toLowerCase()}-essai`, e.code); }
    }
    garder('qme-packs', packs);
    // Préférences : la plus récente l'emporte.
    const majLocale = E.lire(E.CLE_MAJ);
    if (c.prefsMaj && (!majLocale || c.prefsMaj > majLocale)) {
      E.changerPrefs({ ...c.prefs, prenom: c.prenom || E.prenom() }, { depuisCompte: true, maj: c.prefsMaj });
    } else if (majLocale && (!c.prefsMaj || majLocale > c.prefsMaj)) {
      envoyerPrefs(true);
    } else if (c.prenom && !E.prenom()) {
      E.changerPrefs({ prenom: c.prenom }, { depuisCompte: true, maj: majLocale || c.prefsMaj || new Date(0).toISOString() });
    }
    // Appareil → compte
    const connues = new Set(c.cles.map((k) => `${k.type === 'pack' ? 'PACK' : k.p}:${norm(k.code)}`));
    const nouvelles = clesAppareil().filter((k) => !connues.has(`${k.p === 'PACK' ? 'PACK' : k.p}:${norm(k.code)}`)
      && !(c.essais || []).some((e) => e.p === k.p && norm(e.code) === norm(k.code)));
    if (nouvelles.length) {
      try { compte = (await api('/cles', { methode: 'POST', corps: { cles: nouvelles } })).compte; } catch { /* nouvel essai plus tard */ }
    }
    signaler();
    return compte;
  }

  // Préférences envoyées au compte, regroupées (800 ms) ; immédiatement si demandé.
  function envoyerPrefs(tout = false) {
    if (!session()) return;
    clearTimeout(envoiPrefs);
    envoiPrefs = setTimeout(async () => {
      const p = E.prefs();
      try {
        const r = await api('/prefs', { methode: 'PUT', corps: { prenom: E.prenom(), prefs: { noms: p.noms, masques: p.masques, epingles: p.epingles } } });
        compte = r.compte;
        if (r.compte.prefsMaj) E.garder(E.CLE_MAJ, r.compte.prefsMaj);
      } catch { /* réessayé au prochain changement */ }
    }, tout ? 0 : 800);
  }
  window.addEventListener('qme-espace-prefs', (e) => { if (!e.detail?.depuisCompte) envoyerPrefs(); });

  async function ouvrirSession(corps) {
    const r = await api('/session', { methode: 'POST', corps });
    garder(CLE, { jeton: r.jeton, email: r.compte.email });
    return synchroniser(r.compte);
  }

  window.QMECompte = {
    session, get compte() { return compte; },
    async demanderLien(email) { return api('/lien', { methode: 'POST', corps: { email } }); },
    async ouvrir(lien) { return ouvrirSession({ lien }); },
    // Code à 6 chiffres de l'e-mail, saisi dans la page où le lien a été demandé (le lien a pu s'ouvrir ailleurs).
    async ouvrirCode(email, code) { return ouvrirSession({ email, code }); },
    async charger() { if (!session()) return null; return synchroniser((await api('/')).compte); },
    // Déconnexion de cet appareil ; « retirer » enlève aussi les applications du compte de cet appareil.
    deconnecter({ retirer = false } = {}) {
      const cles = compte?.cles || session()?.cles || [];
      if (retirer) {
        for (const k of cles) {
          if (k.type === 'pack') { garder('qme-packs', (lire('qme-packs') || []).filter((x) => norm(x) !== norm(k.code))); continue; }
          const cle = `qme-${k.p.toLowerCase()}-code`;
          if (norm(E.lire(cle)) === norm(k.code)) { garder(cle, null); garder(`qme-${k.p.toLowerCase()}-essai`, null); garder(`qme-${k.p.toLowerCase()}-cache`, null); }
        }
      }
      garder(CLE, null); compte = null; signaler();
    },
    // Interrupteur « Recevoir les informations QME » (liste d'opposition côté serveur).
    async informations(on) { compte = (await api('/prefs', { methode: 'PUT', corps: { informations: Boolean(on) } })).compte; signaler(); return compte.informations; },
    async deconnecterPartout() { await api('/deconnexion', { methode: 'POST' }); this.deconnecter(); },
    async supprimer() { await api('/', { methode: 'DELETE' }); this.deconnecter(); },
  };
})();
