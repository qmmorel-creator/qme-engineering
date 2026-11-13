// Règles du Secret Santa : fonctions pures, sans DOM, réseau ni stockage.
// Module partagé par l'application (navigateur), le moteur de l'API (templates/secret-santa/moteur.js,
// utilisé côté serveur et en démo) et les tests (outils/templates/secret-santa.test.mjs).

export const LIMITES = { participants: 100, echanges: 30, nom: 60, email: 120, souhaits: 1000, message: 600, budget: 30, titre: 80, codeMin: 6, codeMax: 64 };

export const normaliserEmail = (s) => String(s ?? '').trim().toLowerCase();
export const emailValide = (s) => {
  const e = normaliserEmail(s);
  return e.length <= LIMITES.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
};
export const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

// Paire d'exclusion normalisée (ordre alphabétique) : [a, b] et [b, a] sont la même exclusion.
export const paire = (a, b) => (a < b ? [a, b] : [b, a]);
export function nettoyerExclusions(exclusions, ids) {
  const connus = new Set(ids);
  const vues = new Set();
  const sortie = [];
  for (const e of Array.isArray(exclusions) ? exclusions : []) {
    if (!Array.isArray(e) || e.length !== 2) continue;
    const [a, b] = e.map(String);
    if (a === b || !connus.has(a) || !connus.has(b)) continue;
    const p = paire(a, b), cle = p.join('|');
    if (!vues.has(cle)) { vues.add(cle); sortie.push(p); }
  }
  return sortie;
}

// Tirage : chaque participant offre à un autre, personne ne s'offre à lui-même, chacun reçoit une fois,
// et aucune paire exclue (dans un sens comme dans l'autre). Recherche avec retour arrière, en commençant
// par les participants les plus contraints et en essayant les candidats dans un ordre aléatoire :
// toutes les solutions possibles peuvent sortir, et le tirage échoue seulement s'il est impossible.
// Renvoie { ok: true, attributions: { donneur: receveur } } ou { ok: false, raison }.
export function tirer(ids, exclusions = [], alea = Math.random, maxEtapes = 200000) {
  const liste = [...new Set((ids || []).map(String))];
  if (liste.length < 3) return { ok: false, raison: 'trop-peu' };
  const interdits = new Map(liste.map((id) => [id, new Set([id])]));
  for (const [a, b] of nettoyerExclusions(exclusions, liste)) { interdits.get(a).add(b); interdits.get(b).add(a); }
  const melanger = (t) => {
    const c = [...t];
    for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(alea() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
    return c;
  };
  const candidats = new Map(liste.map((id) => [id, melanger(liste.filter((r) => !interdits.get(id).has(r)))]));
  if ([...candidats.values()].some((c) => !c.length)) return { ok: false, raison: 'impossible' };
  // Les plus contraints d'abord ; à égalité, ordre aléatoire.
  const ordre = melanger(liste).sort((a, b) => candidats.get(a).length - candidats.get(b).length);
  const pris = new Set();
  const attributions = {};
  let etapes = 0;
  const placer = (k) => {
    if (k === ordre.length) return true;
    if (++etapes > maxEtapes) return false;
    const donneur = ordre[k];
    for (const r of candidats.get(donneur)) {
      if (pris.has(r)) continue;
      pris.add(r); attributions[donneur] = r;
      if (placer(k + 1)) return true;
      pris.delete(r); delete attributions[donneur];
    }
    return false;
  };
  if (placer(0)) return { ok: true, attributions };
  return { ok: false, raison: etapes > maxEtapes ? 'trop-contraint' : 'impossible' };
}

// Vérifie qu'un tirage respecte toutes les règles (tests, contrôle avant enregistrement).
export function tirageValide(ids, exclusions, attributions) {
  const liste = [...new Set(ids.map(String))];
  const exclues = new Set(nettoyerExclusions(exclusions, liste).map((p) => p.join('|')));
  const recus = new Set();
  for (const d of liste) {
    const r = attributions?.[d];
    if (!r || r === d || !liste.includes(r) || recus.has(r) || exclues.has(paire(d, r).join('|'))) return false;
    recus.add(r);
  }
  return recus.size === liste.length && Object.keys(attributions).length === liste.length;
}

export const MESSAGES_TIRAGE = {
  'trop-peu': 'Il faut au moins 3 participants pour faire le tirage.',
  impossible: 'Tirage impossible avec ces exclusions : retire-en une ou attends d\'autres inscriptions.',
  'trop-contraint': 'Trop d\'exclusions pour trouver un tirage : retire-en quelques-unes.',
};

// Date d'effacement automatique : 60 jours après l'échange, ou 180 jours après la création sans date.
export const RETENTION = { apresDate: 60, sansDate: 180 };
export function dateEffacement(echange) {
  const base = echange.date || String(echange.creeLe || '').slice(0, 10);
  if (!estDate(base)) return null;
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (echange.date ? RETENTION.apresDate : RETENTION.sansDate));
  return d.toISOString().slice(0, 10);
}

if (typeof globalThis !== 'undefined') {
  globalThis.REGLES_SANTA = { LIMITES, normaliserEmail, emailValide, estDate, paire, nettoyerExclusions, tirer, tirageValide, MESSAGES_TIRAGE, RETENTION, dateEffacement };
}
