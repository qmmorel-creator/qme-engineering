// Défi 7 jours entre potes (/defi/, API /api/defi) : chacun choisit une habitude, coche chaque jour où il l'a tenue,
// et le tableau commun montre les séries. Le perdant paie le pari. Décision de Quentin du 21/11/2026.
//
// Logique pure, sans dépendance à Netlify : le stockage, le chiffrement et l'horloge sont injectés (Netlify Blobs et
// node:crypto en production, mémoire dans outils/templates/defi.test.mjs).
//
// Données : un pseudo, une habitude et un pari facultatif, rien d'autre (ni compte, ni e-mail, ni IP).
//   defi/<id>/meta        { id, creeLe, debut, pari }
//   defi/<id>/j/<pid>     { pid, pseudo, habitude, jours: ['AAAA-MM-JJ', …], rejointLe }
// Un fichier par participant : deux potes qui cochent en même temps n'écrivent jamais au même endroit.
// Jeton personnel : <id>.<pid>.<hmac> (rien à stocker, vérifié par recalcul), à garder dans le lien perso.
// Effacement automatique 30 jours après la fin (purgerDefis, tâche quotidienne defi-purge).

export const DUREE = 7;
export const MAX_JOUEURS = 6;
export const CONSERVATION_JOURS = 30;

const json = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// Jour civil à Paris (AAAA-MM-JJ) et arithmétique de dates sur ces chaînes.
export function jourParis(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function ajouterJours(jour, n) {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const ecartJours = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
export const joursDuDefi = (debut) => Array.from({ length: DUREE }, (_, i) => ajouterJours(debut, i));

// Texte libre affiché aux autres participants : une ligne, sans balise, longueur bornée.
export function texte(v, max) {
  return String(v ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Vue publique d'un défi : ce que voit tout porteur du lien d'invitation (jamais les jetons).
export function vue(meta, joueurs, aujourdhui) {
  const jours = joursDuDefi(meta.debut);
  const fin = jours[DUREE - 1];
  const termine = aujourdhui > fin;
  const liste = joueurs
    .map((j) => ({ pid: j.pid, pseudo: j.pseudo, habitude: j.habitude, jours: j.jours.filter((d) => jours.includes(d)).sort() }))
    .map((j) => ({ ...j, total: j.jours.length, serie: serieEnCours(j.jours, termine ? fin : aujourdhui) }))
    .sort((a, b) => b.total - a.total || a.pseudo.localeCompare(b.pseudo, 'fr'));
  const max = liste.length ? liste[0].total : 0;
  const gagnants = termine && liste.length > 1 ? liste.filter((j) => j.total === max).map((j) => j.pid) : [];
  const perdants = termine && liste.length > 1 ? liste.filter((j) => j.total === liste[liste.length - 1].total && j.total < max).map((j) => j.pid) : [];
  return {
    id: meta.id, pari: meta.pari, debut: meta.debut, fin, jours, aujourdhui,
    etat: aujourdhui < meta.debut ? 'a-venir' : termine ? 'termine' : 'en-cours',
    jourNumero: Math.min(DUREE, Math.max(0, ecartJours(meta.debut, aujourdhui) + 1)),
    rejoindrePossible: aujourdhui <= meta.debut && liste.length < MAX_JOUEURS,
    joueurs: liste, gagnants, perdants,
  };
}

// Série en cours : jours cochés d'affilée jusqu'à la veille de `jour` inclus, ou jusqu'à `jour` s'il est coché.
export function serieEnCours(cochés, jour) {
  const s = new Set(cochés);
  let d = s.has(jour) ? jour : ajouterJours(jour, -1), n = 0;
  while (s.has(d)) { n += 1; d = ajouterJours(d, -1); }
  return n;
}

// Routes (corps JSON, 600 octets au plus) :
//  GET  /api/defi?id=…                                         → vue publique
//  POST { action: 'creer', pseudo, habitude, pari }            → { jeton, defi }
//  POST { action: 'rejoindre', id, pseudo, habitude }          → { jeton, defi }
//  POST { action: 'cocher', jeton, jour, fait }                → { defi }   (aujourd'hui ou la veille)
//  POST { action: 'quitter', jeton }                           → { ok }     (efface ses données)
// stockage : get(cle) → objet | null, set(cle, objet), supprimer(cle), lister(prefixe) → [cles]
// crypto   : hmac(texte) → chaîne, aleatoire(n) → chaîne base 32, egal(a, b) → booléen (temps constant)
export async function traiterDefi(requete, { stockage, crypto, maintenant = () => new Date() }) {
  const aujourdhui = jourParis(maintenant());
  const signer = (id, pid) => crypto.hmac(`defi:${id}:${pid}`).replace(/[^0-9a-zA-Z]/g, '').slice(0, 24);
  const jetonDe = (id, pid) => `${id}.${pid}.${signer(id, pid)}`;
  function lireJeton(j) {
    const m = /^([A-Z0-9]{10})\.([A-Z0-9]{8})\.([0-9a-zA-Z]{24})$/.exec(String(j || ''));
    return m && crypto.egal(m[3], signer(m[1], m[2])) ? { id: m[1], pid: m[2] } : null;
  }
  const idValide = (id) => /^[A-Z0-9]{10}$/.test(String(id || ''));
  async function charger(id) {
    const meta = await stockage.get(`defi/${id}/meta`);
    if (!meta) return null;
    const cles = await stockage.lister(`defi/${id}/j/`);
    const joueurs = (await Promise.all(cles.map((c) => stockage.get(c)))).filter(Boolean);
    return { meta, joueurs };
  }
  const reponseDefi = async (id, extra = {}) => { const d = await charger(id); return json(200, { ...extra, defi: vue(d.meta, d.joueurs, aujourdhui) }); };

  if (requete.method === 'GET') {
    const id = new URL(requete.url).searchParams.get('id');
    if (!idValide(id)) return json(400, { erreur: 'Lien de défi invalide.' });
    const d = await charger(id);
    if (!d) return json(404, { erreur: 'Ce défi n\'existe pas ou a été effacé.' });
    return json(200, { defi: vue(d.meta, d.joueurs, aujourdhui) });
  }
  if (requete.method !== 'POST') return json(405, { erreur: 'Méthode non prise en charge.' });

  const brut = await requete.text();
  if (brut.length > 600) return json(413, { erreur: 'Requête trop longue.' });
  let c;
  try { c = JSON.parse(brut); } catch { return json(400, { erreur: 'Requête illisible.' }); }
  if (!c || typeof c !== 'object') return json(400, { erreur: 'Requête illisible.' });

  const pseudo = texte(c.pseudo, 20), habitude = texte(c.habitude, 40);
  const joueurNeuf = (pid) => ({ pid, pseudo, habitude, jours: [], rejointLe: maintenant().toISOString() });

  if (c.action === 'creer' || c.action === 'rejoindre') {
    if (!pseudo) return json(400, { erreur: 'Indique un pseudo.' });
    if (!habitude) return json(400, { erreur: 'Indique l\'habitude que tu veux tenir.' });
  }

  if (c.action === 'creer') {
    const id = crypto.aleatoire(10), pid = crypto.aleatoire(8);
    const meta = { id, creeLe: maintenant().toISOString(), debut: ajouterJours(aujourdhui, 1), pari: texte(c.pari, 40) };
    await stockage.set(`defi/${id}/meta`, meta);
    await stockage.set(`defi/${id}/j/${pid}`, joueurNeuf(pid));
    return reponseDefi(id, { jeton: jetonDe(id, pid) });
  }

  if (c.action === 'rejoindre') {
    if (!idValide(c.id)) return json(400, { erreur: 'Lien de défi invalide.' });
    const d = await charger(c.id);
    if (!d) return json(404, { erreur: 'Ce défi n\'existe pas ou a été effacé.' });
    if (aujourdhui > d.meta.debut) return json(409, { erreur: 'Trop tard : le défi a déjà commencé. Lance le tien !' });
    if (d.joueurs.length >= MAX_JOUEURS) return json(409, { erreur: `Le défi est complet (${MAX_JOUEURS} participants).` });
    const pid = crypto.aleatoire(8);
    await stockage.set(`defi/${c.id}/j/${pid}`, joueurNeuf(pid));
    return reponseDefi(c.id, { jeton: jetonDe(c.id, pid) });
  }

  const moi = lireJeton(c.jeton);
  if (!moi) return json(403, { erreur: 'Lien personnel invalide.' });
  const cle = `defi/${moi.id}/j/${moi.pid}`;
  const joueur = await stockage.get(cle);
  const meta = joueur && await stockage.get(`defi/${moi.id}/meta`);
  if (!joueur || !meta) return json(404, { erreur: 'Ce défi n\'existe pas ou a été effacé.' });

  if (c.action === 'cocher') {
    const jour = String(c.jour || '');
    const autorises = [aujourdhui, ajouterJours(aujourdhui, -1)].filter((d) => joursDuDefi(meta.debut).includes(d));
    if (!autorises.includes(jour)) return json(400, { erreur: 'On ne coche que le jour même, ou la veille en rattrapage, pendant les 7 jours du défi.' });
    const s = new Set(joueur.jours);
    if (c.fait === false) s.delete(jour); else s.add(jour);
    joueur.jours = [...s].sort();
    await stockage.set(cle, joueur);
    return reponseDefi(moi.id, { moi: moi.pid });
  }

  if (c.action === 'moi') return reponseDefi(moi.id, { moi: moi.pid });

  if (c.action === 'quitter') {
    await stockage.supprimer(cle);
    const restants = await stockage.lister(`defi/${moi.id}/j/`);
    if (!restants.length) await stockage.supprimer(`defi/${moi.id}/meta`);
    return json(200, { ok: true });
  }

  return json(400, { erreur: 'Action inconnue.' });
}

// Effacement automatique : tout défi terminé depuis plus de CONSERVATION_JOURS jours est supprimé avec ses
// participants. Renvoie le nombre de défis effacés.
export async function purgerDefis({ stockage, maintenant = () => new Date() }) {
  const aujourdhui = jourParis(maintenant());
  const metas = (await stockage.lister('defi/')).filter((c) => c.endsWith('/meta'));
  let n = 0;
  for (const cleMeta of metas) {
    const meta = await stockage.get(cleMeta);
    const id = cleMeta.split('/')[1];
    const fin = meta ? ajouterJours(meta.debut, DUREE - 1) : null;
    if (meta && ecartJours(fin, aujourdhui) <= CONSERVATION_JOURS) continue;
    for (const c of await stockage.lister(`defi/${id}/`)) await stockage.supprimer(c);
    n += 1;
  }
  return n;
}
