// Moteur de l'API publique de Gestion de compétition sportive (/api/competition/*), sans dépendance à Node
// ni au navigateur. Utilisé par la fonction Netlify (Netlify Blobs, node:crypto), le serveur local et les tests.
//
// L'organisateur (jeton de template CMP, en-tête X-Code) publie un instantané du classement et du programme ;
// les spectateurs le lisent sans compte, par un identifiant non devinable. Rien d'autre n'est stocké.
//  PUT    /api/competition/public            { sel, instantane } → { id, expire }
//  DELETE /api/competition/public?sel=…      retire la publication
//  GET    /api/competition/public/<id>       instantané (lecture seule, mis en cache 15 s par le CDN)
//
// Dépendances injectées :
//  stockage : get(cle) → objet|null, set(cle, objet), supprimer(cle), lister(prefixe) → [cles]
//  hmac(texte) → chaîne ; verifierOrganisateur(jeton) → identifiant stable, ou null ; maintenant() → Date
//
// RGPD : l'instantané est reconstruit champ par champ (aucun champ inconnu, donc aucune coordonnée même si
// un client modifié en envoyait) et effacé 30 jours après la date de fin (90 jours après publication sans date).

export const TAILLE_MAX = 300_000;
export const LIMITES = { categories: 40, lignes: 400, epreuves: 30, vagues: 400, couloirs: 40, texte: 80 };
const JOURS_APRES_FIN = 30;
const JOURS_SANS_DATE = 90;

const json = (statut, corps, entetes = {}) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...entetes },
});
const txt = (v, max = LIMITES.texte) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const date = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const heure = (v) => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : null);
const liste = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const ajoutJours = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// Reconstruit l'instantané avec les seuls champs attendus ; null si la forme est fausse.
export function nettoyerInstantane(i) {
  if (!i || typeof i !== 'object' || i.v !== 1 || !Array.isArray(i.categories)) return null;
  return {
    v: 1, nom: txt(i.nom, 100), lieu: txt(i.lieu, 100), dateDebut: date(i.dateDebut), dateFin: date(i.dateFin),
    methode: i.methode === 'bareme' ? 'bareme' : 'rang',
    epreuves: liste(i.epreuves, LIMITES.epreuves).map((e) => ({ id: txt(e?.id, 24), nom: txt(e?.nom), type: ['temps', 'reps', 'charge', 'points'].includes(e?.type) ? e.type : 'temps', coefficient: num(e?.coefficient) ?? 1 })),
    categories: liste(i.categories, LIMITES.categories).map((c) => ({
      id: txt(c?.id, 24), nom: txt(c?.nom, 60), provisoire: Boolean(c?.provisoire),
      epreuves: liste(c?.epreuves, LIMITES.epreuves).map((x) => txt(x, 24)),
      lignes: liste(c?.lignes, LIMITES.lignes).map((l) => ({
        rang: num(l?.rang), nom: txt(l?.nom), club: txt(l?.club), total: num(l?.total) ?? 0,
        resultats: liste(l?.resultats, LIMITES.epreuves).map((r) => (Array.isArray(r) ? [num(r[0]), num(r[1]) ?? 0, txt(r[2], 40)] : [null, 0, ''])),
      })),
    })),
    programme: liste(i.programme, LIMITES.vagues).map((v) => ({
      epreuve: txt(v?.epreuve, 24), numero: num(v?.numero), date: date(v?.date), debut: heure(v?.debut), fin: heure(v?.fin), categorie: txt(v?.categorie, 60),
      couloirs: liste(v?.couloirs, LIMITES.couloirs).map((x) => (x ? txt(x) : null)),
    })),
  };
}

// Date d'effacement : 30 jours après la fin (ou le début) de la compétition, sinon 90 jours après publication.
export function dateExpiration(instantane, aujourdhui) {
  const fin = instantane.dateFin || instantane.dateDebut;
  const max = ajoutJours(aujourdhui, 400);
  if (fin) { const e = ajoutJours(fin, JOURS_APRES_FIN); return e < aujourdhui ? ajoutJours(aujourdhui, 1) : (e > max ? max : e); }
  return ajoutJours(aujourdhui, JOURS_SANS_DATE);
}

export async function traiterCompetition(requete, { stockage, hmac, verifierOrganisateur, maintenant = () => new Date() }) {
  const url = new URL(requete.url);
  const morceaux = url.pathname.replace(/^\/api\/competition/, '').split('/').filter(Boolean);
  const methode = requete.method;
  const auj = () => maintenant().toISOString().slice(0, 10);
  const idPublic = (proprio, sel) => hmac(`competition-public:${proprio}:${sel}`).replace(/[^0-9a-zA-Z]/g, '').slice(0, 20);
  const cle = (id) => `pub/${id}`;
  const selValide = (s) => typeof s === 'string' && /^[0-9A-Z]{8,32}$/.test(s);

  if (morceaux[0] !== 'public') return json(404, { erreur: 'Introuvable.' });

  // Lecture publique.
  if (morceaux.length === 2) {
    if (methode !== 'GET') return json(405, { erreur: 'Méthode non permise.' });
    const id = morceaux[1];
    if (!/^[0-9a-zA-Z]{12,32}$/.test(id)) return json(404, { erreur: 'Ce classement n\'est pas publié.' });
    const d = await stockage.get(cle(id));
    if (!d) return json(404, { erreur: 'Ce classement n\'est pas publié.' });
    if (d.expire < auj()) { await stockage.supprimer(cle(id)); return json(404, { erreur: 'Ce classement n\'est plus publié.' }); }
    return json(200, { ...d.instantane, publieLe: d.publieLe, expire: d.expire }, {
      'cache-control': 'public, max-age=10',
      'netlify-cdn-cache-control': 'public, durable, max-age=15, stale-while-revalidate=30',
    });
  }
  if (morceaux.length !== 1) return json(404, { erreur: 'Introuvable.' });

  // Publication et retrait par l'organisateur.
  const proprio = verifierOrganisateur(requete.headers.get('x-code'));
  if (!proprio) return json(401, { erreur: 'Code d\'accès invalide.' });
  if (methode === 'DELETE') {
    const sel = url.searchParams.get('sel');
    if (!selValide(sel)) return json(400, { erreur: 'Lien inconnu.' });
    await stockage.supprimer(cle(idPublic(proprio, sel)));
    return json(200, { ok: true });
  }
  if (methode !== 'PUT') return json(405, { erreur: 'Méthode non permise.' });
  const t = await requete.text();
  if (t.length > TAILLE_MAX) return json(413, { erreur: 'Classement trop volumineux pour être publié.' });
  let corps;
  try { corps = JSON.parse(t || '{}') || {}; } catch { return json(400, { erreur: 'JSON invalide.' }); }
  if (!selValide(corps.sel)) return json(400, { erreur: 'Lien inconnu.' });
  const instantane = nettoyerInstantane(corps.instantane);
  if (!instantane) return json(400, { erreur: 'Instantané illisible.' });
  const id = idPublic(proprio, corps.sel);
  const publieLe = maintenant().toISOString();
  const expire = dateExpiration(instantane, auj());
  await stockage.set(cle(id), { instantane, publieLe, expire });
  return json(200, { id, publieLe, expire });
}

// Effacement quotidien des publications expirées (même si personne ne les lit plus).
export async function purgerExpires({ stockage, maintenant = () => new Date() }) {
  const auj = maintenant().toISOString().slice(0, 10);
  let n = 0;
  for (const c of await stockage.lister('pub/')) {
    const d = await stockage.get(c);
    if (!d || d.expire < auj) { await stockage.supprimer(c); n++; }
  }
  return n;
}
