// Secret Santa QME : l'organisateur crée ses échanges, les participants s'inscrivent par un lien,
// le tirage est fait par le serveur et l'organisateur ne le voit jamais. Aucun e-mail n'est envoyé.
import { LIMITES, tirer, MESSAGES_TIRAGE, emailValide } from './regles.js';
import { traiterSecretSanta } from './moteur.js';

const B = window.BASE;
const API_T = '/api/templates';
const API = '/api/secret-santa';
const PRODUIT = 'SNT';
const CLE_CODE = 'qme-snt-code';
const CLE_CACHE = 'qme-snt-cache';
const CLE_DEMO = 'qme-snt-demo';
const CLE_PARTICIPATIONS = 'qme-snt-participations';
const CLE_ACCUEIL = 'qme-snt-ecran-accueil';
const CODE_DEMO = 'DEMO';
const JETON_DEMO = 'DEMO-ORGANISATEUR';

// ---------- Outils ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const insec = (s) => esc(s).replace(/ /g, '&nbsp;'); // budget « 30 € » jamais coupé
const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || `${s}s`) : s}`;
const stock = {
  lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
  ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
};
const deux = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
const auj = () => iso(new Date());
const versDate = (s) => { const [a, m, j] = s.slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j); };
const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
const fmt = (s, o = { weekday: 'long', day: 'numeric', month: 'long' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '');
const prochainNoel = () => { const t = auj(); const n = `${t.slice(0, 4)}-12-24`; return t <= n ? n : `${Number(t.slice(0, 4)) + 1}-12-24`; };
const compteARebours = (date) => {
  if (!date) return '';
  const n = ecart(auj(), date);
  return n > 1 ? `dans ${n} jours` : n === 1 ? 'demain' : n === 0 ? 'aujourd\'hui' : 'passé';
};

// ---------- Décor : charte QME de base + couche Noël ----------
const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
// Guirlande : une ficelle et des boules aux formes Bauhaus (rond, carré, triangle).
const GUIRLANDE = `<svg class="guirlande" viewBox="0 0 1200 34" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 4 Q150 26 300 6 T600 6 T900 6 T1200 4" fill="none" stroke="var(--trait-noel)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
</svg><div class="boules" aria-hidden="true">${['rond rouge', 'carre bleu', 'tri jaune', 'rond sapin', 'carre rouge', 'rond jaune', 'tri bleu', 'carre sapin', 'rond rouge', 'tri jaune', 'carre bleu', 'rond sapin'].map((c) => `<i class="${c}"></i>`).join('')}</div>`;
const SAPIN = (taille = 120) => `<svg class="sapin" viewBox="0 0 120 150" width="${taille}" height="${taille * 1.25}" aria-hidden="true">
  <path d="M60 18 100 70H20Z" fill="var(--sapin)"/><path d="M60 44 108 104H12Z" fill="var(--sapin)"/><path d="M60 72 116 136H4Z" fill="var(--sapin)"/>
  <rect x="50" y="136" width="20" height="14" fill="var(--encre)"/>
  <path d="M60 2l4.7 9.6 10.6 1.5-7.7 7.5 1.8 10.5L60 26.2l-9.4 4.9 1.8-10.5-7.7-7.5 10.6-1.5Z" fill="#E8B93A" stroke="#FBF7F1" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="44" cy="92" r="5" fill="#E58C74"/><rect x="72" y="62" width="9" height="9" fill="#2E5A88"/><circle cx="82" cy="118" r="5" fill="#E8B93A"/><rect x="30" y="118" width="9" height="9" fill="#E58C74"/>
</svg>`;
const FLOCON = '<svg class="flocon" viewBox="0 0 60 60" width="56" height="56" aria-hidden="true"><g stroke="var(--bleu)" stroke-width="3" stroke-linecap="round"><path d="M30 4v52M7.5 17l45 26M7.5 43l45-26"/><path d="M30 12l-6-6M30 12l6-6M30 48l-6 6M30 48l6 6"/></g><circle cx="30" cy="30" r="5" fill="#E8B93A"/></svg>';
const CADEAU = '<svg class="cadeau" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><rect x="14" y="44" width="92" height="70" rx="10" fill="#E58C74"/><rect x="8" y="30" width="104" height="22" rx="8" fill="#B84A34"/><rect x="52" y="30" width="16" height="84" fill="#E8B93A"/><circle cx="46" cy="22" r="13" fill="none" stroke="#E8B93A" stroke-width="7"/><circle cx="74" cy="22" r="13" fill="none" stroke="#E8B93A" stroke-width="7"/></svg>';
const NEIGE = `<div class="neige" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${6 + (i % 5)}s;--r:${(i * 0.7) % 5}s;--t:${4 + (i % 3) * 2}px"></i>`).join('')}</div>`;
const ICONES = {
  reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  retour: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M10 5 3 12l7 7 1.4-1.4L6.8 13H21v-2H6.8l4.6-4.6Z" fill="currentColor"/></svg>',
};

// ---------- Transport : réseau, ou moteur local en démo ----------
const session = { code: null, jeton: null, demo: false, memoriser: true };
let demoMemoire = null;
const hash = (s) => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36); };
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
// Démo : même moteur que le serveur, avec un stockage gardé dans ce navigateur et un chiffrement factice.
const depsDemo = () => ({
  stockage: {
    get: async (c) => (c in demoMemoire ? structuredClone(demoMemoire[c]) : null),
    set: async (c, v) => { demoMemoire[c] = structuredClone(v); stock.ecrire(CLE_DEMO, demoMemoire); },
    supprimer: async (c) => { delete demoMemoire[c]; stock.ecrire(CLE_DEMO, demoMemoire); },
    lister: async (p) => Object.keys(demoMemoire).filter((c) => c.startsWith(p)),
  },
  crypto: {
    hmac: (t) => hash(`demo:${t}`) + hash(`${t}:demo`),
    aleatoire: (n) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * 32)]).join(''),
    hacher: async (code, sel) => hash(`${sel}:${code}`),
    egal: (a, b) => a === b,
  },
  verifierAdmin: (j) => (j === JETON_DEMO ? 'DEMO' : null),
});

async function appel(methode, chemin, corps, entetes = {}) {
  const init = { method: methode, headers: { 'content-type': 'application/json', ...entetes }, body: corps ? JSON.stringify(corps) : undefined };
  const r = session.demo && chemin.startsWith(API)
    ? await traiterSecretSanta(new Request(location.origin + chemin, init), depsDemo())
    : await fetch(chemin, init);
  let c = null;
  try { c = await r.json(); } catch { /* corps vide */ }
  return { statut: r.status, corps: c };
}
const appelAdmin = (methode, chemin, corps) => appel(methode, API + chemin, corps, { 'x-code': session.jeton });
const messageErreur = (x) => (x?.message === 'Failed to fetch' || x instanceof TypeError ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x?.message || 'Le service ne répond pas. Réessaie dans un instant.');

// ---------- Toast et modales ----------
let minuterieToast = null;
function toast(texte) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(texte)}</span>`;
  el.hidden = false;
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => { el.hidden = true; }, 4500);
}
const modale = () => $('#modale');
function ouvrirModale(titre, corps, pied, auValider) {
  const d = modale();
  d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
  d.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (e.submitter?.value === 'annuler') return d.close();
    const bouton = e.submitter;
    if (bouton) bouton.disabled = true;
    const err = await auValider?.(new FormData(e.target), e.submitter?.value);
    if (bouton) bouton.disabled = false;
    if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) p.textContent = err; return; }
    if (err !== false) d.close();
  });
  if (!d.open) d.showModal();
  d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
}
// Confirmation dans une modale (confirm() n'est pas fiable dans toutes les vues intégrées).
const confirmer = (titre, texte, libelle, danger = false) => new Promise((resoudre) => {
  ouvrirModale(titre, `<p>${texte}</p>`, `<button class="btn ${danger ? 'danger' : 'primaire'}" value="ok">${libelle}</button><button class="btn" value="annuler">Annuler</button>`, () => { resoudre(true); });
  modale().addEventListener('close', () => resoudre(false), { once: true });
});
async function copier(texte, message = 'Copié.') {
  try { await navigator.clipboard.writeText(texte); toast(message); } catch {
    ouvrirModale('Copier', `<p class="aide">La copie automatique est refusée par ce navigateur : sélectionne le texte et copie-le.</p><textarea class="a-copier" readonly rows="6">${esc(texte)}</textarea>`, '<button class="btn primaire" value="ok">Fermer</button>');
    $('.a-copier')?.select();
  }
}

// ======================================================================
// Espace organisateur
// ======================================================================
let echanges = [];
let courant = null;       // échange ouvert (vue organisateur)
let etatReseau = 'ok';

function formaterCode(v) {
  const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
  for (const p of [PRODUIT, 'ADM']) if (n.startsWith(p)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
  const l = n.slice(0, 32);
  return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
}
const codeComplet = (c) => { const n = c.replace(/-/g, ''); return ((n.startsWith(PRODUIT) || n.startsWith('ADM')) && n.length === 19) || /^[0-9A-F]{32}$/.test(n); };

async function connecter(code, memoriser) {
  if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
  const { statut, corps } = await appel('POST', `${API_T}/connexion`, { code, produit: PRODUIT });
  if (statut === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu de Gumroad.');
  if (statut !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
  if (corps.produit !== PRODUIT) throw new Error('Cette clé ouvre un autre template QME : utilise la page qm-engineering.fr/connexion/.');
  Object.assign(session, { code, jeton: corps.jeton, demo: false, memoriser });
  stock.suppr(CLE_CODE);
  stock.ecrire(CLE_CODE, code, !memoriser);
  await demarrer();
}

function ouvrirDemo(memoriser = true) {
  Object.assign(session, { demo: true, code: null, jeton: JETON_DEMO });
  if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
  demoMemoire = stock.lire(CLE_DEMO);
  return (demoMemoire ? Promise.resolve() : creerDemo()).then(demarrer);
}

function deconnecter(message) {
  stock.suppr(CLE_CODE);
  stock.suppr(CLE_CACHE);
  Object.assign(session, { code: null, jeton: null, demo: false });
  echanges = []; courant = null;
  document.body.classList.remove('app');
  ecranConnexion(message);
}

// Données de démonstration, relatives à aujourd'hui : un échange tiré (famille), un échange à tirer
// (bureau, avec un couple à exclure), un échange qui démarre (amis).
async function creerDemo() {
  demoMemoire = {};
  session.demo = true; session.jeton = JETON_DEMO;
  const D = B.demo;
  const creer = async (modele, date, noms, exclure = []) => {
    const m = B.modeles.find((x) => x.id === modele);
    const { corps } = await appelAdmin('POST', '/echanges', { nom: m.titre, date, budget: m.budget, message: m.message });
    const e = corps.echange;
    for (const n of noms) await appel('POST', `${API}/inscription`, { e: e.id, k: e.invitation, nom: n, email: `${n.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}@exemple.fr`, code: D.code, souhaits: D.souhaits[n] ?? 'Une surprise !' });
    if (exclure.length) {
      const v = (await appelAdmin('GET', `/echanges/${e.id}`)).corps.echange;
      const id = (n) => v.participants.find((p) => p.nom === n).id;
      await appelAdmin('PUT', `/echanges/${e.id}`, { exclusions: exclure.map(([a, b]) => [id(a), id(b)]) });
    }
    return e;
  };
  const noel = prochainNoel();
  const famille = await creer('famille', noel, D.famille, [['Camille', 'Hugo'], ['Rose', 'Yanis']]);
  await appelAdmin('POST', `/echanges/${famille.id}/tirage`, {});
  // Quatre participants ont déjà découvert leur tirage.
  for (const n of D.famille.slice(0, 4)) {
    const r = await appel('POST', `${API}/participant/connexion`, { e: famille.id, email: `${n.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}@exemple.fr`, code: D.code });
    await appel('GET', `${API}/participant`, null, { 'x-participant': r.corps.jeton });
  }
  await creer('bureau', ajout(noel, -5), D.bureau, [['Sarah', 'Thomas']]);
  await creer('amis', ajout(noel, 3), D.amis);
  stock.ecrire(CLE_DEMO, demoMemoire);
}

// ---------- Rendu : connexion ----------
function ecranConnexion(message = '') {
  document.title = 'Secret Santa · QME';
  $('#racine').innerHTML = `
  <div class="connexion">
    <section class="composition" aria-label="Présentation">
      ${NEIGE}
      <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
      <div class="formes-noel" aria-hidden="true">
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet">
          <circle cx="130" cy="150" r="130" fill="#D9302A"/>
          <circle cx="130" cy="150" r="48" fill="#141414"/>
          <rect x="290" y="20" width="260" height="260" fill="#1D4E89"/>
          <path d="M290 280 A260 260 0 0 1 550 20 V280 Z" fill="#F5B400"/>
          <rect x="250" y="262" width="40" height="18" fill="#F0EDE6"/>
        </svg>
        ${SAPIN(130)}
      </div>
      <div class="accroche">
        <p class="surtitre">Secret Santa · édition Noël</p>
        <h1>Un tirage au sort que même l'organisateur ne voit pas.</h1>
        <p>Tu crées l'échange, chacun s'inscrit par un lien et découvre sur sa page à qui il offre, avec la liste d'idées de la personne.</p>
      </div>
    </section>
    <section class="formulaire-acces">
      <div><p class="surtitre">Espace organisateur</p><h2>Ouvre tes échanges</h2></div>
      <p>Saisis la clé de licence reçue par e-mail de Gumroad. Les participants n'en ont pas besoin : ils passent par ton lien d'invitation.</p>
      <form id="form-code" novalidate>
        <label class="champ code-saisie">Clé de licence ou code d'accès
          <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" required>
        </label>
        <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
        <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
        <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes échanges</button>
      </form>
      <div class="separateur">ou</div>
      <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
      <p class="mention">Tu as reçu un lien d'invitation ? Ouvre-le directement : il mène à ta page d'inscription. La démo reste sur cet appareil et n'envoie rien. <a href="/templates/">Voir l'offre</a>.</p>
    </section>
  </div>`;
  const champ = $('#code');
  champ.addEventListener('input', () => { const fin = champ.selectionStart === champ.value.length; champ.value = formaterCode(champ.value); if (fin) champ.setSelectionRange(champ.value.length, champ.value.length); });
  $('#form-code').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = formaterCode(champ.value);
    const err = $('#erreur-code');
    const bouton = e.target.querySelector('button[type=submit]');
    if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = 'Clé incomplète : elle compte 4 blocs de 8 caractères (copie-la depuis l\'e-mail de Gumroad).'; champ.focus(); return; }
    bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
    try { await connecter(code, $('#memoriser').checked); } catch (x) {
      err.textContent = messageErreur(x);
      bouton.disabled = false; bouton.textContent = 'Ouvrir mes échanges'; champ.focus();
    }
  });
}

// ---------- Rendu : application organisateur ----------
async function demarrer() {
  document.body.classList.add('app');
  $('#racine').innerHTML = `
    ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple, gardées sur cet appareil. Le tirage et les pages participants fonctionnent comme en vrai.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai une clé</button></div></div>' : ''}
    <header class="barre"><div class="barre-int">
      <span class="marque">${MARQUE}</span>
      <span class="titre-produit">Secret Santa<small>Édition Noël</small></span>
      <span class="sync" data-etat="${session.demo ? 'demo' : 'ok'}" role="status"><i></i><b>${session.demo ? 'Démo locale' : 'En ligne'}</b></span>
      <button class="btn-icone" data-action="reglages" aria-label="Réglages" title="Réglages">${ICONES.reglages}</button>
    </div>${GUIRLANDE}</header>
    <main class="vue" id="vue" tabindex="-1"><p class="chargement">Chargement…</p></main>`;
  await route();
  proposerEcranAccueil();
}

function majReseau(etat) {
  etatReseau = etat;
  const el = $('.sync');
  if (!el || session.demo) return;
  el.dataset.etat = etat === 'ok' ? 'ok' : 'horsligne';
  el.querySelector('b').textContent = etat === 'ok' ? 'En ligne' : 'Hors ligne';
}

async function chargerListe() {
  try {
    const { statut, corps } = await appelAdmin('GET', '/echanges');
    if (statut === 401) return deconnecter('Ce code d\'accès n\'est plus valide.');
    if (statut !== 200) throw new Error(corps?.erreur);
    echanges = corps.echanges;
    if (!session.demo) stock.ecrire(CLE_CACHE, { code: session.code, echanges }, !session.memoriser);
    majReseau('ok');
  } catch {
    const c = stock.lire(CLE_CACHE);
    if (c?.code === session.code) echanges = c.echanges;
    majReseau('horsligne');
  }
}

async function chargerEchange(id) {
  const { statut, corps } = await appelAdmin('GET', `/echanges/${id}`);
  if (statut === 401) { deconnecter('Ce code d\'accès n\'est plus valide.'); return null; }
  if (statut === 404) { toast(corps?.erreur || 'Échange introuvable.'); return null; }
  if (statut !== 200) throw new Error(corps?.erreur);
  return corps.echange;
}

async function route() {
  const id = new URLSearchParams(location.hash.slice(1)).get('e');
  if (id) {
    try { courant = await chargerEchange(id); majReseau('ok'); } catch { courant = null; majReseau('horsligne'); toast('Pas de connexion : la liste affichée est la dernière connue.'); }
    if (courant) return rendreEchange();
    history.replaceState(null, '', location.pathname);
  }
  courant = null;
  await chargerListe();
  rendreListe();
}
const allerA = (id) => { history.pushState(null, '', id ? `#e=${id}` : location.pathname); route().then(() => { window.scrollTo({ top: 0 }); $('#vue')?.focus({ preventScroll: true }); }); };

function rendreListe() {
  document.title = 'Mes échanges · Secret Santa';
  const cartes = echanges.map((e) => {
    const etape = e.tirage ? (e.nbVus === e.nbInscrits ? 'Tout le monde a découvert son tirage' : `Tirage fait · ${e.nbVus}/${e.nbInscrits} l'ont découvert`) : e.ouvert ? 'Inscriptions ouvertes' : 'Inscriptions fermées';
    const classe = e.tirage ? 'sapin' : e.ouvert ? 'beurre' : 'ciel';
    return `<button class="echange-carte" data-action="ouvrir" data-id="${e.id}">
      <span class="echange-forme ${classe}" aria-hidden="true"></span>
      <span class="echange-corps"><b>${esc(e.nom)}</b><span>${e.date ? `${esc(fmt(e.date))} · ${compteARebours(e.date)}` : 'Date à fixer'}${e.budget ? ` · ${insec(e.budget)}` : ''}</span>
      <span class="etiquette ${classe}">${esc(etape)}</span></span>
      <span class="echange-nb"><b>${e.nbInscrits}</b><small>${e.nbInscrits > 1 ? 'inscrits' : 'inscrit'}</small></span>
    </button>`;
  }).join('');
  $('#vue').innerHTML = `
    <div class="vue-tete"><div><p class="surtitre">Organisateur</p><h1>${echanges.length ? `<mark>${pluriel(echanges.length, 'échange')}</mark> en cours` : 'Crée ton premier échange'}</h1>
      <p>Un échange par groupe : la famille, les amis, le bureau. Chacun a son lien d'invitation et son propre tirage.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus} Nouvel échange</button></div></div>
    ${echanges.length ? `<div class="echanges">${cartes}</div>` : `<div class="vide-etat">${FLOCON}<h3>Aucun échange pour l'instant</h3><p>Choisis un modèle (famille, amis, collègues) : le message d'invitation et un budget sont proposés, tout reste modifiable.</p><div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus} Nouvel échange</button></div></div>`}
    <section class="comment"><h2 class="titre-section">Comment ça marche</h2><ol class="etapes-noel">
      <li><b>Crée l'échange</b><span>Nom, date, budget et un message pour les participants.</span></li>
      <li><b>Partage le lien</b><span>Chacun s'inscrit avec son e-mail, un code personnel et ses idées de cadeaux.</span></li>
      <li><b>Lance le tirage</b><span>Le serveur tire au sort en respectant tes exclusions. Tu ne vois pas le résultat.</span></li>
      <li><b>Chacun découvre</b><span>Sur sa page : à qui il offre, ses idées, le budget et la date. Aucun e-mail n'est envoyé.</span></li>
    </ol></section>`;
}

const lienInvitation = (e) => `${location.origin}${location.pathname}?e=${e.id}&k=${e.invitation}`;
const texteInvitation = (e) => `Tu es invité(e) au Secret Santa « ${e.nom} »${e.date ? `, le ${fmt(e.date)}` : ''}${e.budget ? `, budget ${e.budget}` : ''}.\nInscris-toi ici : ${lienInvitation(e)}\nTu découvriras sur ta page à qui tu offres un cadeau, une fois le tirage fait.`;

function rendreEchange() {
  const e = courant;
  document.title = `${e.nom} · Secret Santa`;
  const nb = e.participants.length;
  const nomDe = (id) => e.participants.find((p) => p.id === id)?.nom || '?';
  const essai = nb >= 3 ? tirer(e.participants.map((p) => p.id), e.exclusions) : { ok: false, raison: 'trop-peu' };
  const vus = e.participants.filter((p) => p.aVu).length;
  const etape = e.tirage ? 4 : nb >= 3 ? 3 : nb ? 2 : 1;
  const etapes = ['Inviter', 'Inscriptions', 'Tirage', 'Découverte'];

  const participants = nb ? `<ul class="participants">${e.participants.map((p) => `
      <li><span class="initiale" aria-hidden="true">${esc(p.nom.slice(0, 1).toUpperCase())}</span>
        <span class="p-nom"><b>${esc(p.nom)}</b><small>${esc(p.email)}</small></span>
        <span class="p-etats">${p.aSouhaits ? '<span class="etiquette beurre">Idées notées</span>' : '<span class="etiquette sable">Pas d\'idées</span>'}${e.tirage ? (p.aVu ? '<span class="etiquette sapin">A découvert</span>' : '<span class="etiquette ciel">Pas encore vu</span>') : ''}</span>
        <span class="p-actions">${session.demo ? `<button class="btn petit lien" data-action="voir-comme" data-nom="${esc(p.nom)}">Voir sa page</button>` : ''}<button class="btn-icone petit" data-action="retirer" data-id="${p.id}" aria-label="Retirer ${esc(p.nom)}" title="Retirer">×</button></span>
      </li>`).join('')}</ul>`
    : `<div class="vide-etat compact">${FLOCON}<p>Personne n'est encore inscrit. Envoie le lien d'invitation au groupe.</p></div>`;

  const exclusions = e.exclusions.length ? `<ul class="exclusions">${e.exclusions.map(([a, b], i) => `<li><b>${esc(nomDe(a))}</b><span aria-label="et">×</span><b>${esc(nomDe(b))}</b><small>ne se tirent pas</small>${e.tirage ? '' : `<button class="btn-icone petit" data-action="exclusion-retirer" data-i="${i}" aria-label="Retirer cette exclusion">×</button>`}</li>`).join('')}</ul>` : '<p class="aide">Aucune exclusion. Ajoute-en une pour qu\'un couple ou deux personnes d\'un même foyer ne se tirent pas.</p>';

  const tirage = e.tirage
    ? `<div class="tirage-fait">${CADEAU}<div><p class="surtitre">Tirage fait le ${esc(fmt(e.tirage.le.slice(0, 10), { day: 'numeric', month: 'long' }))}</p>
        <h3><mark>${vus} sur ${nb}</mark> ont découvert à qui ils offrent.</h3>
        <div class="jauge" role="img" aria-label="${vus} sur ${nb}"><i style="width:${nb ? Math.round((vus / nb) * 100) : 0}%"></i></div>
        <p class="aide">Tu ne vois pas les résultats : seul chaque participant voit le sien, sur sa page. Relance ceux qui ne l'ont pas encore ouverte.</p>
        <div class="rang"><button class="btn petit" data-action="copier-relance">Copier un message de rappel</button><button class="btn petit lien" data-action="refaire">Refaire le tirage</button></div></div></div>`
    : `<div class="tirage-attente"><p>${nb < 3 ? `Il faut au moins 3 participants (encore ${3 - nb}).` : essai.ok ? `Tout est prêt pour ${pluriel(nb, 'participant')}. Le tirage ferme les inscriptions.` : esc(MESSAGES_TIRAGE[essai.raison])}</p>
        <button class="btn primaire jaune-noel" data-action="tirer" ${essai.ok ? '' : 'disabled'}>Lancer le tirage</button>
        <p class="aide">Le serveur tire au sort et garde le résultat. Ni toi ni personne d'autre ne peut voir qui a tiré qui, à part chaque participant pour lui-même.</p></div>`;

  $('#vue').innerHTML = `
    <button class="btn lien retour" data-action="liste">${ICONES.retour} Mes échanges</button>
    <div class="vue-tete"><div><p class="surtitre">${e.date ? `${esc(fmt(e.date))} · ${compteARebours(e.date)}` : 'Date à fixer'}${e.budget ? ` · budget ${insec(e.budget)}` : ''}</p><h1>${esc(e.nom)}</h1>
      ${e.message ? `<p class="message">${esc(e.message)}</p>` : ''}</div>
      <div class="actions"><button class="btn" data-action="modifier">Modifier</button></div></div>
    <ol class="progression-noel" aria-label="Étape ${etape} sur 4">${etapes.map((t, i) => `<li class="${i + 1 < etape ? 'fait' : i + 1 === etape ? 'actuel' : ''}"><i></i>${t}</li>`).join('')}</ol>
    <div class="grille-echange"><div class="col">
      <section class="bloc invitation"><h2>Lien d'invitation</h2>
        ${e.tirage ? '<p class="aide">Inscriptions closes : le tirage est fait.</p>' : `
        <label class="champ">À envoyer au groupe<input readonly value="${esc(lienInvitation(e))}" id="lien-invitation" aria-label="Lien d'invitation"></label>
        <div class="rang"><button class="btn primaire" data-action="copier-lien">Copier le lien</button><button class="btn" data-action="copier-message">Copier le message</button></div>
        <label class="interrupteur"><input type="checkbox" data-action="ouvrir-inscriptions" ${e.ouvert ? 'checked' : ''}> Inscriptions ${e.ouvert ? 'ouvertes' : 'fermées'}</label>
        <p class="aide">Toi aussi tu participes ? <a href="${esc(lienInvitation(e))}" target="_blank" rel="noopener">Inscris-toi par le lien</a>, comme les autres. <button class="btn lien petit" data-action="nouveau-lien">Changer de lien</button> (l'ancien ne marchera plus).</p>`}
      </section>
      <section class="bloc participants-bloc"><h2>Participants <span class="compte-pastille">${nb}</span></h2>${participants}</section>
    </div><div class="col">
      <section class="bloc tirage"><h2>Tirage</h2>${tirage}</section>
      <section class="bloc exclusions-bloc"><h2>Exclusions</h2>${exclusions}
        ${!e.tirage && nb >= 2 ? `<button class="btn petit" data-action="exclusion-ajouter">${ICONES.plus} Ajouter une exclusion</button>` : ''}
        ${e.tirage && e.exclusions.length ? '<p class="aide">Pour changer les exclusions, refais le tirage.</p>' : ''}</section>
    </div></div>
    <p class="effacement">Données effacées automatiquement le ${esc(fmt(e.effacement, { day: 'numeric', month: 'long', year: 'numeric' }))}. <button class="btn lien petit" data-action="supprimer">Supprimer l'échange maintenant</button></p>`;
}

// ---------- Actions organisateur ----------
async function action(fn, okMessage) {
  try {
    const { statut, corps } = await fn();
    if (statut === 401) { deconnecter('Ce code d\'accès n\'est plus valide.'); return null; }
    if (statut >= 400) { toast(corps?.erreur || 'Action impossible.'); return null; }
    if (corps?.echange) { courant = corps.echange; rendreEchange(); }
    if (okMessage) toast(okMessage);
    majReseau('ok');
    return corps;
  } catch (x) { majReseau('horsligne'); toast(messageErreur(x)); return null; }
}

function modaleEchange(e) {
  const nouveau = !e;
  const v = e || { nom: '', date: prochainNoel(), budget: '', message: '' };
  const corps = `
    ${nouveau ? `<fieldset class="modeles"><legend>Partir d'un modèle</legend><div class="rang">${B.modeles.map((m) => `<button type="button" class="puce" data-action="modele" data-id="${m.id}">${esc(m.nom)}</button>`).join('')}</div><p class="aide" id="conseil"></p></fieldset>` : ''}
    <label class="champ">Nom de l'échange<input name="nom" required maxlength="${LIMITES.titre}" value="${esc(v.nom)}" placeholder="Ex. : Noël en famille"></label>
    <div class="deux">
      <label class="champ">Date de l'échange<small>Facultative.</small><input type="date" name="date" value="${esc(v.date || '')}"></label>
      <label class="champ">Budget conseillé<small>Ex. : 20 €</small><input name="budget" maxlength="${LIMITES.budget}" value="${esc(v.budget)}"></label>
    </div>
    <label class="champ">Message pour les participants<small>Affiché sur la page d'inscription et sur la page de chacun.</small><textarea name="message" maxlength="${LIMITES.message}" rows="4">${esc(v.message)}</textarea></label>
    <p class="erreur" role="alert"></p>`;
  ouvrirModale(nouveau ? 'Nouvel échange' : 'Modifier l\'échange', corps, `<button class="btn primaire" value="ok">${nouveau ? 'Créer' : 'Enregistrer'}</button><button class="btn" value="annuler">Annuler</button>`, async (f) => {
    const donnees = { nom: f.get('nom'), date: f.get('date') || null, budget: f.get('budget'), message: f.get('message') };
    if (!String(donnees.nom).trim()) return 'Donne un nom à l\'échange.';
    const r = await action(() => (nouveau ? appelAdmin('POST', '/echanges', donnees) : appelAdmin('PUT', `/echanges/${e.id}`, donnees)), nouveau ? 'Échange créé. Copie le lien d\'invitation et envoie-le au groupe.' : 'Échange enregistré.');
    if (!r) return '';
    if (nouveau) { modale().close(); allerA(r.echange.id); }
  });
}

function modaleExclusion() {
  const ps = courant.participants;
  const options = ps.map((p) => `<option value="${p.id}">${esc(p.nom)}</option>`).join('');
  ouvrirModale('Ajouter une exclusion', `
    <p class="aide">Ces deux personnes ne pourront pas se tirer l'une l'autre (dans un sens comme dans l'autre).</p>
    <div class="deux"><label class="champ">Personne<select name="a">${options}</select></label>
    <label class="champ">Et<select name="b">${ps.map((p, i) => `<option value="${p.id}" ${i === 1 ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label></div>
    <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', async (f) => {
    const a = f.get('a'), b = f.get('b');
    if (a === b) return 'Choisis deux personnes différentes.';
    const exclusions = [...courant.exclusions, [a, b]];
    const essai = tirer(ps.map((p) => p.id), exclusions);
    if (!essai.ok && ps.length >= 3) return `Avec cette exclusion, ${MESSAGES_TIRAGE[essai.raison].charAt(0).toLowerCase()}${MESSAGES_TIRAGE[essai.raison].slice(1)}`;
    if (!await action(() => appelAdmin('PUT', `/echanges/${courant.id}`, { exclusions }), 'Exclusion ajoutée.')) return '';
  });
}

// ---------- Réglages ----------
function modaleReglages() {
  const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
  ouvrirModale('Réglages', `
    <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
      <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
    <div class="groupe"><h3>Sauvegarde</h3><p class="aide">Tes échanges sont enregistrés en ligne. Tu peux télécharger la liste des échanges et des inscrits (jamais le tirage, que personne ne peut exporter).</p>
      <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger la liste</button></div></div>
    <div class="groupe"><h3>Données des participants</h3><p class="aide">Prénom, e-mail, liste d'idées et code personnel (enregistré sous forme d'empreinte irréversible, jamais en clair, illisible même pour QME). Hébergées en Europe, utilisées seulement pour l'échange et effacées automatiquement 60 jours après sa date (180 jours sans date). Aucun e-mail n'est envoyé. Tu peux tout effacer plus tôt en supprimant l'échange. Préviens les participants que tu utilises cet outil.</p></div>
    <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
      <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`,
  '<button class="btn primaire" value="ok">Fermer</button>');
}

async function exporter() {
  const complets = [];
  for (const e of echanges) { const d = await chargerEchange(e.id).catch(() => null); if (d) complets.push({ nom: d.nom, date: d.date, budget: d.budget, message: d.message, participants: d.participants.map((p) => ({ nom: p.nom, email: p.email, inscritLe: p.inscritLe })) }); }
  const blob = new Blob([JSON.stringify({ exporteLe: new Date().toISOString(), echanges: complets }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `secret-santa-${auj()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ======================================================================
// Espace participant (lien d'invitation ou lien personnel)
// ======================================================================
const participations = () => stock.lire(CLE_PARTICIPATIONS) || {};
const memoriserParticipation = (eid, jeton) => { const p = participations(); p[eid] = jeton; stock.ecrire(CLE_PARTICIPATIONS, p); };
const oublierParticipation = (eid) => { const p = participations(); delete p[eid]; stock.ecrire(CLE_PARTICIPATIONS, p); };
const lienPersonnel = (jeton) => `${location.origin}${location.pathname}?p=${encodeURIComponent(jeton)}`;
let ctxParticipant = null; // { e, k, jeton, demo, retour }
let revele = false;

function coqueParticipant(contenu) {
  document.body.classList.add('app', 'participant');
  $('#racine').innerHTML = `
    ${ctxParticipant?.demo ? `<div class="bandeau-demo"><div><b>Démo · page participant</b><span>Ce que voit un participant sur son téléphone.</span><button data-action="retour-organisateur">Revenir à l'organisateur</button></div></div>` : ''}
    <header class="barre"><div class="barre-int"><span class="marque">${MARQUE}</span><span class="titre-produit">Secret Santa<small>Édition Noël</small></span></div>${GUIRLANDE}</header>
    <main class="vue etroite" id="vue" tabindex="-1">${contenu}</main>
    <footer class="pied-participant"><p>Outil proposé par l'organisateur de l'échange, conçu par <a href="/">QME</a>. Données hébergées en Europe, effacées 60 jours après la date de l'échange. Aucun e-mail envoyé.</p></footer>`;
}

async function ouvrirParticipant(ctx) {
  ctxParticipant = ctx; revele = false;
  if (ctx.demo) { session.demo = true; demoMemoire = demoMemoire || stock.lire(CLE_DEMO); }
  document.title = 'Secret Santa';
  if (!ctx.jeton && ctx.e && !ctx.demo) ctx.jeton = participations()[ctx.e] || null;
  if (ctx.jeton) return pagePersonnelle();
  return pageInvitation();
}

const carteEchange = (inv) => `<section class="carte-noel">
    ${SAPIN(70)}
    <div><p class="surtitre">${inv.date ? `${esc(fmt(inv.date))} · ${compteARebours(inv.date)}` : 'Date à venir'}${inv.budget ? ` · budget ${insec(inv.budget)}` : ''}</p>
    <h1>${esc(inv.nom)}</h1>${inv.message ? `<p class="message">${esc(inv.message)}</p>` : ''}
    <p class="aide">${pluriel(inv.nbInscrits, 'personne inscrite', 'personnes inscrites')}${inv.tirage ? ' · tirage fait' : ''}</p></div></section>`;

async function pageInvitation(message = '', dejaInscrit = false) {
  coqueParticipant('<p class="chargement">Chargement…</p>');
  let inv;
  try {
    const { statut, corps } = await appel('GET', `${API}/invitation?e=${encodeURIComponent(ctxParticipant.e)}&k=${encodeURIComponent(ctxParticipant.k || '')}`);
    if (statut !== 200) return coqueParticipant(`<div class="vide-etat">${FLOCON}<h3>Lien invalide</h3><p>${esc(corps?.erreur || 'Ce lien ne fonctionne plus.')}</p></div>`);
    inv = corps.invitation;
  } catch (x) { return coqueParticipant(`<div class="vide-etat">${FLOCON}<h3>Pas de connexion</h3><p>${esc(messageErreur(x))}</p></div>`); }
  const formulaire = inv.ouvert && !dejaInscrit ? `
    <section class="bloc"><h2>Je participe</h2>
      <form id="form-inscription" novalidate class="pile">
        <label class="champ">Prénom (ou nom)<small>Celui que verra la personne qui te tire.</small><input name="nom" required maxlength="${LIMITES.nom}" autocomplete="given-name"></label>
        <label class="champ">E-mail<small>Sert seulement à te reconnecter. Aucun e-mail ne t'est envoyé.</small><input type="email" name="email" required maxlength="${LIMITES.email}" autocomplete="email" inputmode="email"></label>
        <label class="champ">Code personnel<small>${LIMITES.codeMin} caractères minimum. Avec ton e-mail, il te permet de retrouver ta page depuis n'importe quel appareil.</small><input type="password" name="code" required minlength="${LIMITES.codeMin}" maxlength="${LIMITES.codeMax}" autocomplete="new-password"></label>
        <label class="champ">Mes idées de cadeaux<small>Facultatif, modifiable jusqu'au jour J. Une idée par ligne.</small><textarea name="souhaits" rows="4" maxlength="${LIMITES.souhaits}" placeholder="${esc(B.idees.slice(0, 3).join('\n'))}"></textarea></label>
        <p class="aide">En t'inscrivant, tu acceptes que ton prénom, ton e-mail et tes idées soient enregistrés pour cet échange, puis effacés automatiquement après sa date. L'organisateur voit ton prénom et ton e-mail, pas tes idées ni le tirage.</p>
        <p class="erreur" role="alert">${esc(message)}</p>
        <button class="btn primaire" type="submit">Je m'inscris</button>
      </form></section>`
    : `<section class="bloc"><p>${inv.tirage ? 'Le tirage est fait.' : 'Les inscriptions sont fermées.'} Déjà inscrit ? Retrouve ta page ci-dessous.</p></section>`;
  coqueParticipant(`${carteEchange(inv)}${formulaire}
    <section class="bloc"><h2>Déjà inscrit ?</h2>
      <form id="form-retour" novalidate class="pile">
        <div class="deux"><label class="champ">E-mail<input type="email" name="email" required autocomplete="email" inputmode="email"></label>
        <label class="champ">Code personnel<input type="password" name="code" required autocomplete="current-password"></label></div>
        <p class="erreur" role="alert">${dejaInscrit ? esc(message) : ''}</p>
        <button class="btn" type="submit">Retrouver ma page</button>
      </form></section>`);
  $('#form-inscription')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target), err = ev.target.querySelector('.erreur'), b = ev.submitter;
    if (!String(f.get('nom')).trim()) { err.textContent = 'Indique ton prénom.'; return; }
    if (!emailValide(f.get('email'))) { err.textContent = 'Adresse e-mail invalide.'; return; }
    if (String(f.get('code')).length < LIMITES.codeMin) { err.textContent = `Ton code personnel doit faire au moins ${LIMITES.codeMin} caractères.`; return; }
    b.disabled = true; b.textContent = 'Inscription…';
    try {
      const { statut, corps } = await appel('POST', `${API}/inscription`, { e: ctxParticipant.e, k: ctxParticipant.k, nom: f.get('nom'), email: f.get('email'), code: f.get('code'), souhaits: f.get('souhaits') });
      if (statut !== 201) { if (corps?.dejaInscrit) return pageInvitation(corps.erreur, true); err.textContent = corps?.erreur || 'Inscription impossible.'; b.disabled = false; b.textContent = 'Je m\'inscris'; return; }
      ctxParticipant.jeton = corps.jeton;
      if (!ctxParticipant.demo) { memoriserParticipation(ctxParticipant.e, corps.jeton); history.replaceState(null, '', `?p=${encodeURIComponent(corps.jeton)}`); }
      await pagePersonnelle(true);
    } catch (x) { err.textContent = messageErreur(x); b.disabled = false; b.textContent = 'Je m\'inscris'; }
  });
  $('#form-retour').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target), err = ev.target.querySelector('.erreur');
    try {
      const { statut, corps } = await appel('POST', `${API}/participant/connexion`, { e: ctxParticipant.e, email: f.get('email'), code: f.get('code') });
      if (statut !== 200) { err.textContent = corps?.erreur || 'Connexion impossible.'; return; }
      ctxParticipant.jeton = corps.jeton;
      if (!ctxParticipant.demo) { memoriserParticipation(ctxParticipant.e, corps.jeton); history.replaceState(null, '', `?p=${encodeURIComponent(corps.jeton)}`); }
      await pagePersonnelle();
    } catch (x) { err.textContent = messageErreur(x); }
  });
}

async function pagePersonnelle(bienvenue = false) {
  coqueParticipant('<p class="chargement">Chargement…</p>');
  let d;
  try {
    const { statut, corps } = await appel('GET', `${API}/participant`, null, { 'x-participant': ctxParticipant.jeton });
    if (statut === 401) {
      const eid = ctxParticipant.jeton.split('.')[0];
      oublierParticipation(eid);
      ctxParticipant.jeton = null;
      if (ctxParticipant.k) return pageInvitation(corps?.erreur);
      return coqueParticipant(`<div class="vide-etat">${FLOCON}<h3>Page introuvable</h3><p>${esc(corps?.erreur || 'Ce lien personnel ne fonctionne plus.')}</p></div>`);
    }
    if (statut !== 200) throw new Error(corps?.erreur);
    d = corps;
  } catch (x) { return coqueParticipant(`<div class="vide-etat">${FLOCON}<h3>Pas de connexion</h3><p>${esc(messageErreur(x))}</p></div>`); }
  ctxParticipant.e = ctxParticipant.jeton.split('.')[0];
  const souhaitsListe = (s) => (s ? `<ul class="souhaits">${s.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="aide">Pas d\'idée notée pour l\'instant : sa liste peut encore changer, repasse plus tard. Sinon, reste dans le budget et fais simple.</p>');
  const resultat = d.destinataire
    ? `<section class="revelation ${revele ? 'ouverte' : ''}" aria-live="polite">
        ${CADEAU}
        <p class="surtitre">Ton tirage</p>
        ${revele ? `<h2>Tu offres un cadeau à <mark>${esc(d.destinataire.nom)}</mark></h2>
          <h3 class="titre-section">Ses idées</h3>${souhaitsListe(d.destinataire.souhaits)}
          <p class="aide">Garde le secret jusqu'au jour J${d.echange.date ? ` (${esc(fmt(d.echange.date))})` : ''}${d.echange.budget ? `, et reste autour de ${insec(d.echange.budget)}` : ''}.</p>`
          : `<h2>Le tirage est fait.</h2><p>Personne ne regarde par-dessus ton épaule ?</p><button class="btn primaire jaune-noel" data-action="reveler">Découvrir à qui j'offre</button>`}
      </section>`
    : `<section class="revelation attente">${FLOCON}<p class="surtitre">Ton tirage</p><h2>Pas encore de tirage.</h2><p>L'organisateur le lancera quand tout le monde sera inscrit. Reviens sur cette page : le nom s'affichera ici.</p></section>`;
  coqueParticipant(`
    ${bienvenue ? `<div class="alerte succes"><b>C'est noté, ${esc(d.moi.nom)} !</b> Garde le lien de ta page (bouton ci-dessous) ou retiens ton e-mail et ton code.</div>` : ''}
    ${carteEchange(d.echange)}
    ${resultat}
    <section class="bloc"><h2>Mes idées de cadeaux</h2>
      <form id="form-souhaits" class="pile"><label class="champ"><span class="sr-only">Mes idées</span><small>Visibles seulement par la personne qui te tire. Une idée par ligne.</small><textarea name="souhaits" rows="4" maxlength="${LIMITES.souhaits}">${esc(d.moi.souhaits)}</textarea></label>
      <button class="btn" type="submit">Enregistrer mes idées</button></form></section>
    <section class="bloc"><h2>Ma page</h2>
      <p class="aide">Inscrit comme <b>${esc(d.moi.nom)}</b> (${esc(d.moi.email)}). Ce lien ouvre ta page sans code : ne le partage pas, il montre ton tirage.</p>
      <div class="rang"><button class="btn petit" data-action="copier-lien-perso">Copier le lien de ma page</button>${d.destinataire ? '' : '<button class="btn petit lien" data-action="quitter-echange">Me désinscrire</button>'}</div></section>`);
  $('#form-souhaits').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const { statut, corps } = await appel('PUT', `${API}/participant`, { souhaits: new FormData(ev.target).get('souhaits') }, { 'x-participant': ctxParticipant.jeton });
      toast(statut === 200 ? 'Idées enregistrées.' : corps?.erreur || 'Enregistrement impossible.');
    } catch (x) { toast(messageErreur(x)); }
  });
}

// ---------- Ajout à l'écran d'accueil (socle commun) ----------
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
  ouvrirModale('Comme une application', `
    <p>Enregistre cet outil sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
    ${installable ? '<div class="rang"><button class="btn primaire" type="button" data-action="installer">Ajouter à l\'écran d\'accueil</button></div><p class="aide">Ou à la main :</p>' : ''}
    ${blocs}
    <p class="aide">Tes données restent les mêmes : l'icône ouvre cette page avec ta clé déjà enregistrée sur cet appareil.${a === 'autre' ? ' Sur ordinateur, la page fonctionne aussi directement dans le navigateur.' : ''}</p>`,
  auto ? '<button class="btn primaire" value="plus-tard">Plus tard</button><button class="btn" value="jamais">Ne plus afficher</button>' : '<button class="btn primaire" value="ok">Fermer</button>',
  (_, choix) => { if (choix === 'jamais') stock.ecrire(CLE_ACCUEIL, 'masque'); });
}
function proposerEcranAccueil() {
  if (dejaInstalle() || stock.lire(CLE_ACCUEIL)) return;
  if (appareil() === 'autre' && !matchMedia('(max-width:720px)').matches) return;
  setTimeout(() => { if (!modale().open && !dejaInstalle() && !ctxParticipant) modaleEcranAccueil(true); }, 900);
}
async function installer() {
  if (!inviteInstallation) return;
  const invite = inviteInstallation; inviteInstallation = null;
  if (modale().open) modale().close();
  invite.prompt();
  const { outcome } = await invite.userChoice.catch(() => ({}));
  if (outcome === 'accepted') stock.ecrire(CLE_ACCUEIL, 'installe');
}

// ---------- Délégation des clics ----------
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.tagName === 'INPUT') return;
  const { action: a, id } = el.dataset;
  switch (a) {
    case 'demo': ouvrirDemo(); break;
    case 'demo-reinit': if (await confirmer('Recommencer la démo', 'Effacer les données de démo et repartir de l\'exemple ?', 'Recommencer')) { stock.suppr(CLE_DEMO); demoMemoire = null; history.replaceState(null, '', location.pathname); await creerDemo(); demarrer(); } break;
    case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
    case 'fermer': modale().close(); break;
    case 'reglages': modaleReglages(); break;
    case 'ecran-accueil': modaleEcranAccueil(); break;
    case 'installer': installer(); break;
    case 'exporter': exporter(); break;
    case 'nouveau': modaleEchange(); break;
    case 'ouvrir': allerA(id); break;
    case 'liste': allerA(null); break;
    case 'modifier': modaleEchange(courant); break;
    case 'modele': {
      const m = B.modeles.find((x) => x.id === id);
      const f = el.closest('form');
      f.nom.value = m.titre; f.budget.value = m.budget; f.message.value = m.message;
      $('#conseil').textContent = m.conseil;
      f.querySelectorAll('.puce').forEach((p) => p.setAttribute('aria-pressed', String(p === el)));
      break;
    }
    case 'copier-lien': copier(lienInvitation(courant), 'Lien copié : colle-le dans le message au groupe.'); break;
    case 'copier-message': copier(texteInvitation(courant), 'Message d\'invitation copié.'); break;
    case 'copier-relance': copier(`Rappel Secret Santa « ${courant.nom} » : le tirage est fait ! Ouvre ta page pour découvrir à qui tu offres (ton lien personnel, ou ${lienInvitation(courant)} puis « Retrouver ma page » avec ton e-mail et ton code).`, 'Message de rappel copié.'); break;
    case 'nouveau-lien': if (await confirmer('Changer de lien', 'L\'ancien lien d\'invitation ne fonctionnera plus. Les personnes déjà inscrites gardent leur page.', 'Changer de lien')) action(() => appelAdmin('POST', `/echanges/${courant.id}/invitation`), 'Nouveau lien créé : envoie-le aux retardataires.'); break;
    case 'tirer': if (await confirmer('Lancer le tirage', `Tirage pour ${pluriel(courant.participants.length, 'participant')}. Les inscriptions seront fermées et tu ne verras pas le résultat.`, 'Lancer le tirage')) {
      const r = await action(() => appelAdmin('POST', `/echanges/${courant.id}/tirage`, {}));
      if (r) toast('Tirage fait ! Chacun peut maintenant découvrir à qui il offre sur sa page.');
    } break;
    case 'refaire': if (await confirmer('Refaire le tirage', 'Un nouveau tirage remplace l\'ancien : ceux qui ont déjà découvert leur résultat devront revenir voir le nouveau. À faire seulement en cas d\'erreur.', 'Refaire le tirage', true)) action(() => appelAdmin('POST', `/echanges/${courant.id}/tirage`, { refaire: true }), 'Nouveau tirage fait. Préviens le groupe.'); break;
    case 'retirer': {
      const p = courant.participants.find((x) => x.id === id);
      if (await confirmer('Retirer un participant', `Retirer ${esc(p.nom)} de l'échange ?${courant.tirage ? ' <b>Le tirage sera annulé</b> : il faudra le refaire.' : ''}`, 'Retirer', true)) {
        const r = await action(() => appelAdmin('DELETE', `/echanges/${courant.id}/participants/${id}`));
        if (r) toast(r.tirageAnnule ? `${p.nom} retiré. Le tirage est annulé : relance-le.` : `${p.nom} retiré.`);
      }
      break;
    }
    case 'exclusion-ajouter': modaleExclusion(); break;
    case 'exclusion-retirer': { const ex = courant.exclusions.filter((_, i) => i !== Number(el.dataset.i)); action(() => appelAdmin('PUT', `/echanges/${courant.id}`, { exclusions: ex }), 'Exclusion retirée.'); break; }
    case 'supprimer': if (await confirmer('Supprimer l\'échange', `Supprimer « ${esc(courant.nom)} », ses inscrits et son tirage ? Les pages des participants ne fonctionneront plus.`, 'Supprimer', true)) {
      if (await action(() => appelAdmin('DELETE', `/echanges/${courant.id}`), 'Échange supprimé.')) allerA(null);
    } break;
    case 'voir-comme': {
      const r = await appel('POST', `${API}/participant/connexion`, { e: courant.id, email: `${el.dataset.nom.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}@exemple.fr`, code: B.demo.code });
      if (r.statut === 200) { window.scrollTo({ top: 0 }); ouvrirParticipant({ demo: true, jeton: r.corps.jeton, e: courant.id, k: courant.invitation, retour: courant.id }); }
      break;
    }
    case 'retour-organisateur': { const r = ctxParticipant?.retour; ctxParticipant = null; document.body.classList.remove('participant'); await demarrer(); if (r) allerA(r); break; }
    case 'reveler': revele = true; pagePersonnelle(); break;
    case 'copier-lien-perso': copier(lienPersonnel(ctxParticipant.jeton), 'Lien de ta page copié. Garde-le pour toi.'); break;
    case 'quitter-echange': if (await confirmer('Me désinscrire', 'Te retirer de cet échange ? Tes idées seront effacées.', 'Me désinscrire', true)) {
      const { statut, corps } = await appel('DELETE', `${API}/participant`, null, { 'x-participant': ctxParticipant.jeton });
      if (statut === 200) { if (!ctxParticipant.demo) oublierParticipation(ctxParticipant.e); ctxParticipant.jeton = null; toast('Tu es désinscrit.'); pageInvitation(); } else toast(corps?.erreur || 'Impossible pour le moment.');
    } break;
    default: break;
  }
});
document.addEventListener('change', (ev) => {
  if (ev.target.dataset.action === 'ouvrir-inscriptions') action(() => appelAdmin('PUT', `/echanges/${courant.id}`, { ouvert: ev.target.checked }), ev.target.checked ? 'Inscriptions ouvertes.' : 'Inscriptions fermées.');
});
document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
window.addEventListener('popstate', () => { if (!ctxParticipant && session.jeton) route(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && courant && !modale().open && !ctxParticipant) route(); });

// ---------- Démarrage ----------
async function init() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  const q = new URLSearchParams(location.search);
  // Participant : lien personnel (?p=) ou lien d'invitation (?e=&k=). Aucune clé nécessaire.
  if (q.get('p')) { const jeton = q.get('p'); memoriserParticipation(jeton.split('.')[0], jeton); return ouvrirParticipant({ jeton, e: jeton.split('.')[0] }); }
  if (q.get('e')) return ouvrirParticipant({ e: q.get('e'), k: q.get('k') });
  const code = stock.lire(CLE_CODE);
  if (q.has('demo')) { history.replaceState(null, '', location.pathname + location.hash); if (!code || code === CODE_DEMO) return ouvrirDemo(!code ? false : true); }
  if (!code) return ecranConnexion();
  if (code === CODE_DEMO) return ouvrirDemo();
  session.code = code;
  try { session.memoriser = localStorage.getItem(CLE_CODE) !== null; } catch { session.memoriser = false; }
  try {
    const { statut, corps } = await appel('POST', `${API_T}/connexion`, { code, produit: PRODUIT });
    if (statut === 401 || statut === 403) return deconnecter(corps?.erreur || 'Ce code d\'accès n\'est plus valide.');
    if (statut !== 200) throw new Error();
    if (corps.produit !== PRODUIT) return deconnecter('Cette clé ouvre un autre template QME.');
    session.jeton = corps.jeton;
  } catch {
    const c = stock.lire(CLE_CACHE);
    if (!c || c.code !== code) return ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
  }
  await demarrer();
}

// Exposé pour les tests automatisés uniquement (aucune donnée sensible).
window.__santa = { session: () => ({ demo: session.demo }), echanges: () => echanges };
init();
