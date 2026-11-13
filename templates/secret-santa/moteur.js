// Moteur de l'API du Secret Santa (/api/secret-santa/*), sans dépendance à Node ni au navigateur.
// Utilisé tel quel par la fonction Netlify (stockage Netlify Blobs, chiffrement node:crypto) et par la
// démo de l'application (stockage local, chiffrement factice) : la démo se comporte comme le service.
//
// Deux publics :
//  - l'organisateur, identifié par son jeton de template (en-tête X-Code, vérifié par verifierAdmin) ;
//  - les participants, sans compte : lien d'invitation (e + k), puis jeton personnel (en-tête
//    X-Participant) ou reconnexion par e-mail et code personnel.
// Règle centrale : l'organisateur ne reçoit JAMAIS les attributions du tirage ni les listes de souhaits.
//
// Dépendances injectées :
//  stockage : get(cle) → objet|null, set(cle, objet), supprimer(cle), lister(prefixe) → [cles]
//  crypto   : hmac(texte) → chaîne, aleatoire(n) → chaîne base 32 de n caractères,
//             hacher(code, sel) → Promise<chaîne>, egal(a, b) → booléen (temps constant)
//  verifierAdmin(jeton) → identifiant stable de l'organisateur, ou null
//  maintenant() → Date
import { LIMITES, normaliserEmail, emailValide, estDate, nettoyerExclusions, tirer, MESSAGES_TIRAGE, dateEffacement } from './regles.js';

const ESSAIS_MAX = 5;          // codes personnels faux avant blocage
const BLOCAGE_MINUTES = 15;

const json = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const texte = (v, max) => String(v ?? '').replace(/\s+/g, (m) => (m.includes('\n') ? m : ' ')).trim().slice(0, max);
const ligne = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function traiterSecretSanta(requete, { stockage, crypto, verifierAdmin, maintenant = () => new Date() }) {
  const url = new URL(requete.url);
  const chemin = url.pathname.replace(/^\/api\/secret-santa/, '').replace(/\/$/, '') || '/';
  const morceaux = chemin.split('/').filter(Boolean);
  const methode = requete.method;
  let corps = {};
  if (methode === 'POST' || methode === 'PUT') {
    const t = await requete.text();
    if (t.length > 20000) return json(413, { erreur: 'Requête trop volumineuse.' });
    try { corps = JSON.parse(t || '{}') || {}; } catch { return json(400, { erreur: 'JSON invalide.' }); }
  }
  const auj = () => maintenant().toISOString().slice(0, 10);
  const horodatage = () => maintenant().toISOString();

  // ---------- Stockage ----------
  const cleEchange = (eid) => `ech/${eid}`;
  const cleParticipant = (eid, pid) => `par/${eid}/${pid}`;
  const cleAdmin = (proprio) => `adm/${proprio}`;
  const idValide = (s) => typeof s === 'string' && /^[0-9A-Z]{6,32}$/.test(s);

  async function supprimerEchange(e) {
    for (const cle of await stockage.lister(`par/${e.id}/`)) await stockage.supprimer(cle);
    await stockage.supprimer(cleEchange(e.id));
    const a = (await stockage.get(cleAdmin(e.proprio))) || { echanges: [] };
    a.echanges = a.echanges.filter((x) => x !== e.id);
    await stockage.set(cleAdmin(e.proprio), a);
  }
  // Lit un échange ; l'efface s'il a dépassé sa date d'effacement automatique.
  async function lireEchange(eid) {
    if (!idValide(eid)) return null;
    const e = await stockage.get(cleEchange(eid));
    if (!e) return null;
    const fin = dateEffacement(e);
    if (fin && fin < auj()) { await supprimerEchange(e); return null; }
    return e;
  }
  async function participants(eid) {
    const cles = await stockage.lister(`par/${eid}/`);
    const liste = (await Promise.all(cles.map((c) => stockage.get(c)))).filter(Boolean);
    return liste.sort((a, b) => a.inscritLe.localeCompare(b.inscritLe));
  }
  const pidDe = (eid, email) => crypto.hmac(`santa-email:${eid}:${normaliserEmail(email)}`).replace(/[^0-9a-zA-Z]/g, '').slice(0, 16).toUpperCase();
  const jetonDe = (eid, pid) => `${eid}.${pid}.${crypto.hmac(`santa-participant:${eid}:${pid}`).replace(/[^0-9a-zA-Z]/g, '').slice(0, 24)}`;

  // ---------- Vues ----------
  // Ce que voit l'organisateur : jamais les attributions, jamais les souhaits.
  function vueAdmin(e, liste) {
    return {
      id: e.id, nom: e.nom, date: e.date, budget: e.budget, message: e.message, ouvert: e.ouvert,
      invitation: e.invitation, creeLe: e.creeLe, effacement: dateEffacement(e),
      exclusions: e.exclusions,
      tirage: e.tirage ? { le: e.tirage.le, nb: Object.keys(e.tirage.attributions).length } : null,
      mode: e.mode || 'lien',
      participants: liste.map((p) => ({ id: p.id, nom: p.nom, email: p.email || null, inscritLe: p.inscritLe, aVu: Boolean(p.vuLe && e.tirage), aSouhaits: Boolean(p.souhaits), reclame: Boolean(p.hache), bloque: Boolean(p.bloque) })),
    };
  }
  const resume = (e, liste) => ({ id: e.id, mode: e.mode || 'lien', nbReclames: liste.filter((p) => p.hache).length, nom: e.nom, date: e.date, budget: e.budget, ouvert: e.ouvert, nbInscrits: liste.length, tirage: Boolean(e.tirage), nbVus: e.tirage ? liste.filter((p) => p.vuLe).length : 0 });
  const vueInvitation = (e, liste) => ({ nom: e.nom, date: e.date, budget: e.budget, message: e.message, ouvert: e.ouvert && !e.tirage, nbInscrits: liste.length, tirage: Boolean(e.tirage) });

  function lireChampsEchange(c, actuel = {}) {
    const nom = c.nom !== undefined ? ligne(c.nom, LIMITES.titre) : actuel.nom;
    if (!nom) return { erreur: 'Donne un nom à l\'échange.' };
    const date = c.date !== undefined ? (c.date || null) : (actuel.date ?? null);
    if (date && !estDate(date)) return { erreur: 'Date de l\'échange invalide.' };
    return {
      nom, date,
      budget: c.budget !== undefined ? ligne(c.budget, LIMITES.budget) : (actuel.budget ?? ''),
      message: c.message !== undefined ? texte(c.message, LIMITES.message) : (actuel.message ?? ''),
      ouvert: c.ouvert !== undefined ? Boolean(c.ouvert) : (actuel.ouvert ?? true),
    };
  }

  // Ajoute des prénoms saisis par l'organisateur (mode borne) : identifiant aléatoire, sans e-mail ni code.
  async function ajouterNoms(e, noms, liste) {
    const propres = [...new Set((Array.isArray(noms) ? noms : String(noms || '').split('\n')).map((n) => ligne(n, LIMITES.nom)).filter(Boolean))];
    const pris = new Set(liste.map((p) => p.nom.toLowerCase()));
    const nouveaux = propres.filter((n) => !pris.has(n.toLowerCase()));
    if (!nouveaux.length && propres.length) return { erreur: 'Ces prénoms sont déjà dans la liste.' };
    if (liste.length + nouveaux.length > LIMITES.participants) return { erreur: `${LIMITES.participants} participants au maximum.` };
    let k = 0;
    for (const nom of nouveaux) {
      const id = crypto.aleatoire(16);
      const inscritLe = new Date(maintenant().getTime() + k++).toISOString(); // garde l'ordre de saisie
      await stockage.set(cleParticipant(e.id, id), { id, nom, email: null, souhaits: '', sel: null, hache: null, inscritLe, vuLe: null, echecs: 0, bloque: false, bloqueJusque: null });
    }
    return { n: nouveaux.length };
  }

  // ======================= Routes de l'organisateur =======================
  if (morceaux[0] === 'echanges') {
    const proprio = verifierAdmin(requete.headers.get('x-code'));
    if (!proprio) return json(401, { erreur: 'Code d\'accès invalide.' });
    const index = (await stockage.get(cleAdmin(proprio))) || { echanges: [] };

    // Liste et création
    if (morceaux.length === 1 && methode === 'GET') {
      const sortie = [];
      for (const eid of index.echanges) {
        const e = await lireEchange(eid);
        if (e && e.proprio === proprio) sortie.push(resume(e, await participants(eid)));
      }
      return json(200, { echanges: sortie });
    }
    if (morceaux.length === 1 && methode === 'POST') {
      if (index.echanges.length >= LIMITES.echanges) return json(400, { erreur: `${LIMITES.echanges} échanges au maximum : supprimes-en un terminé.` });
      const champs = lireChampsEchange(corps);
      if (champs.erreur) return json(400, { erreur: champs.erreur });
      const mode = corps.mode === 'borne' ? 'borne' : 'lien';
      const e = { id: crypto.aleatoire(10), proprio, mode, ...champs, invitation: crypto.aleatoire(20), exclusions: [], tirage: null, creeLe: horodatage(), majLe: horodatage() };
      if (mode === 'borne') {
        const r = await ajouterNoms(e, corps.noms, []);
        if (r.erreur) return json(400, { erreur: r.erreur });
      }
      await stockage.set(cleEchange(e.id), e);
      const a = (await stockage.get(cleAdmin(proprio))) || { echanges: [] };
      a.echanges = [...a.echanges.filter((x) => x !== e.id), e.id];
      await stockage.set(cleAdmin(proprio), a);
      return json(201, { echange: vueAdmin(e, await participants(e.id)) });
    }

    const e = await lireEchange(morceaux[1]);
    if (!e || e.proprio !== proprio) return json(404, { erreur: 'Échange introuvable (supprimé ou effacé après sa date).' });
    const enregistrer = async () => { e.majLe = horodatage(); await stockage.set(cleEchange(e.id), e); };

    if (morceaux.length === 2 && methode === 'GET') return json(200, { echange: vueAdmin(e, await participants(e.id)) });

    if (morceaux.length === 2 && methode === 'PUT') {
      const champs = lireChampsEchange(corps, e);
      if (champs.erreur) return json(400, { erreur: champs.erreur });
      const liste = await participants(e.id);
      if (corps.exclusions !== undefined) {
        const exclusions = nettoyerExclusions(corps.exclusions, liste.map((p) => p.id));
        if (e.tirage && JSON.stringify(exclusions) !== JSON.stringify(e.exclusions)) {
          return json(409, { erreur: 'Le tirage est déjà fait : refais-le pour appliquer d\'autres exclusions.' });
        }
        e.exclusions = exclusions;
      }
      Object.assign(e, champs);
      await enregistrer();
      return json(200, { echange: vueAdmin(e, liste) });
    }

    if (morceaux.length === 2 && methode === 'DELETE') {
      await supprimerEchange(e);
      return json(200, { ok: true });
    }

    if (morceaux[2] === 'invitation' && methode === 'POST') {
      e.invitation = crypto.aleatoire(20);
      await enregistrer();
      return json(200, { echange: vueAdmin(e, await participants(e.id)) });
    }

    // Tirage : fait par le serveur, enregistré sans être renvoyé à l'organisateur.
    if (morceaux[2] === 'tirage' && methode === 'POST') {
      if (e.tirage && !corps.refaire) return json(409, { erreur: 'Le tirage est déjà fait.' });
      const liste = await participants(e.id);
      const ids = liste.map((p) => p.id);
      const r = tirer(ids, e.exclusions);
      if (!r.ok) return json(422, { erreur: MESSAGES_TIRAGE[r.raison] });
      e.tirage = { le: horodatage(), attributions: r.attributions };
      e.ouvert = false;
      for (const p of liste) { if (p.vuLe) { p.vuLe = null; await stockage.set(cleParticipant(e.id, p.id), p); } }
      await enregistrer();
      return json(200, { echange: vueAdmin(e, await participants(e.id)) });
    }

    // Mode « ordinateur commun » : l'organisateur ajoute des prénoms, remet un code à zéro, débloque.
    if (morceaux[2] === 'participants' && !morceaux[3] && methode === 'POST') {
      if (e.mode !== 'borne') return json(400, { erreur: 'Dans ce mode, les participants s\'inscrivent eux-mêmes par le lien.' });
      if (e.tirage) return json(409, { erreur: 'Le tirage est déjà fait : refais-le après avoir ajouté des participants (retire puis ajoute, ou supprime l\'échange).' });
      const r = await ajouterNoms(e, corps.noms, await participants(e.id));
      if (r.erreur) return json(400, { erreur: r.erreur });
      await enregistrer();
      return json(200, { echange: vueAdmin(e, await participants(e.id)), ajoutes: r.n });
    }
    if (morceaux[2] === 'participants' && morceaux[3] && (morceaux[4] === 'reinitialiser' || morceaux[4] === 'debloquer') && methode === 'POST') {
      const p = await stockage.get(cleParticipant(e.id, morceaux[3]));
      if (!p) return json(404, { erreur: 'Participant introuvable.' });
      p.echecs = 0; p.bloque = false; p.bloqueJusque = null;
      if (morceaux[4] === 'reinitialiser') { p.hache = null; p.sel = null; p.vuLe = null; p.souhaits = ''; }
      await stockage.set(cleParticipant(e.id, p.id), p);
      return json(200, { echange: vueAdmin(e, await participants(e.id)) });
    }

    // Retrait d'un participant : après le tirage, celui-ci est annulé (à refaire).
    if (morceaux[2] === 'participants' && morceaux[3] && methode === 'DELETE') {
      const p = await stockage.get(cleParticipant(e.id, morceaux[3]));
      if (!p) return json(404, { erreur: 'Participant introuvable.' });
      await stockage.supprimer(cleParticipant(e.id, p.id));
      e.exclusions = e.exclusions.filter(([a, b]) => a !== p.id && b !== p.id);
      const annule = Boolean(e.tirage);
      e.tirage = null;
      await enregistrer();
      return json(200, { echange: vueAdmin(e, await participants(e.id)), tirageAnnule: annule });
    }
    return json(404, { erreur: 'Route inconnue.' });
  }

  // ======================= Borne (ordinateur commun, mode sans e-mail) =======================
  // Le lien de la borne (e + k) donne seulement la liste des prénoms et l'état de chacun.
  // Réclamer un prénom = choisir un code de 4 à 8 chiffres (gardé haché). Voir son tirage = prénom + code.
  // 5 codes faux bloquent le prénom jusqu'à ce que l'organisateur le débloque.
  if (chemin.startsWith('/borne')) {
    const src = methode === 'GET' ? { e: url.searchParams.get('e'), k: url.searchParams.get('k') } : corps;
    const e = await lireEchange(src.e);
    if (!e || e.mode !== 'borne' || !crypto.egal(String(src.k || ''), e.invitation)) return json(404, { erreur: 'Lien de la borne invalide ou expiré. Demande le nouveau lien à l\'organisateur.' });
    const liste = await participants(e.id);
    const info = () => ({ nom: e.nom, date: e.date, budget: e.budget, message: e.message, tirage: Boolean(e.tirage),
      participants: liste.map((p) => ({ id: p.id, nom: p.nom, reclame: Boolean(p.hache), bloque: Boolean(p.bloque) })) });
    if (chemin === '/borne' && methode === 'GET') return json(200, { borne: info() });
    const p = liste.find((x) => x.id === String(corps.pid || ''));
    if (!p) return json(404, { erreur: 'Prénom introuvable.' });
    const code = String(corps.code ?? '');
    if (chemin === '/borne/reclamer' && methode === 'POST') {
      if (p.hache) return json(409, { erreur: 'Ce prénom a déjà un code. Si ce n\'est pas toi qui l\'as choisi, préviens l\'organisateur.' });
      if (!/^\d{4,8}$/.test(code)) return json(400, { erreur: 'Ton code doit compter de 4 à 8 chiffres.' });
      p.sel = crypto.aleatoire(16); p.hache = await crypto.hacher(code, p.sel);
      p.souhaits = texte(corps.souhaits, LIMITES.souhaits); p.reclameLe = horodatage();
      await stockage.set(cleParticipant(e.id, p.id), p);
      return json(200, { ok: true, tirage: Boolean(e.tirage) });
    }
    if ((chemin === '/borne/voir' || chemin === '/borne/souhaits') && methode === 'POST') {
      if (!p.hache) return json(409, { erreur: 'Ce prénom n\'a pas encore de code : choisis-en un d\'abord.' });
      if (p.bloque) return json(423, { erreur: 'Prénom bloqué après plusieurs codes faux : demande à l\'organisateur de le débloquer.' });
      if (!crypto.egal(await crypto.hacher(code, p.sel), p.hache)) {
        p.echecs = (p.echecs || 0) + 1;
        if (p.echecs >= ESSAIS_MAX) { p.bloque = true; p.echecs = 0; }
        await stockage.set(cleParticipant(e.id, p.id), p);
        return json(p.bloque ? 423 : 401, { erreur: p.bloque ? 'Prénom bloqué après 5 codes faux : demande à l\'organisateur de le débloquer.' : `Code incorrect. Encore ${ESSAIS_MAX - p.echecs} essai${ESSAIS_MAX - p.echecs > 1 ? 's' : ''}.` });
      }
      if (p.echecs) p.echecs = 0;
      if (chemin === '/borne/souhaits') {
        p.souhaits = texte(corps.souhaits, LIMITES.souhaits);
        await stockage.set(cleParticipant(e.id, p.id), p);
        return json(200, { ok: true });
      }
      let destinataire = null;
      const cible = e.tirage?.attributions?.[p.id];
      if (cible) { const d = liste.find((x) => x.id === cible); destinataire = d ? { nom: d.nom, souhaits: d.souhaits } : null; if (!p.vuLe) p.vuLe = horodatage(); }
      await stockage.set(cleParticipant(e.id, p.id), p);
      return json(200, { moi: { nom: p.nom, souhaits: p.souhaits }, destinataire, echange: { nom: e.nom, date: e.date, budget: e.budget } });
    }
    return json(404, { erreur: 'Route inconnue.' });
  }

  // ======================= Routes des participants =======================
  // Invitation : informations publiques de l'échange (sans la liste des inscrits).
  if (chemin === '/invitation' && methode === 'GET') {
    const e = await lireEchange(url.searchParams.get('e'));
    if (!e || e.mode === 'borne' || !crypto.egal(String(url.searchParams.get('k') || ''), e.invitation)) return json(404, { erreur: 'Lien d\'invitation invalide ou expiré. Demande un nouveau lien à l\'organisateur.' });
    return json(200, { invitation: vueInvitation(e, await participants(e.id)) });
  }

  if (chemin === '/inscription' && methode === 'POST') {
    const e = await lireEchange(corps.e);
    if (!e || !crypto.egal(String(corps.k || ''), e.invitation)) return json(404, { erreur: 'Lien d\'invitation invalide ou expiré. Demande un nouveau lien à l\'organisateur.' });
    if (e.mode === 'borne') return json(404, { erreur: 'Cet échange se fait sur l\'ordinateur commun, sans inscription en ligne.' });
    if (e.tirage) return json(409, { erreur: 'Le tirage est déjà fait : les inscriptions sont closes. Préviens l\'organisateur.' });
    if (!e.ouvert) return json(409, { erreur: 'Les inscriptions sont fermées par l\'organisateur.' });
    const nom = ligne(corps.nom, LIMITES.nom);
    const email = normaliserEmail(corps.email);
    const code = String(corps.code ?? '');
    if (!nom) return json(400, { erreur: 'Indique ton prénom (ou ton nom).' });
    if (!emailValide(email)) return json(400, { erreur: 'Adresse e-mail invalide.' });
    if (code.length < LIMITES.codeMin || code.length > LIMITES.codeMax) return json(400, { erreur: `Ton code personnel doit faire au moins ${LIMITES.codeMin} caractères.` });
    const liste = await participants(e.id);
    if (liste.length >= LIMITES.participants) return json(400, { erreur: `Cet échange a atteint ${LIMITES.participants} participants.` });
    const pid = pidDe(e.id, email);
    if (await stockage.get(cleParticipant(e.id, pid))) return json(409, { erreur: 'Cette adresse est déjà inscrite : reconnecte-toi avec ton e-mail et ton code.', dejaInscrit: true });
    if (liste.some((p) => p.nom.toLowerCase() === nom.toLowerCase())) return json(409, { erreur: 'Ce nom est déjà pris dans cet échange : ajoute une initiale pour qu\'on vous distingue.' });
    const sel = crypto.aleatoire(16);
    const p = { id: pid, nom, email, souhaits: texte(corps.souhaits, LIMITES.souhaits), sel, hache: await crypto.hacher(code, sel), inscritLe: horodatage(), vuLe: null, echecs: 0, bloqueJusque: null };
    await stockage.set(cleParticipant(e.id, pid), p);
    return json(201, { jeton: jetonDe(e.id, pid) });
  }

  if (chemin === '/participant/connexion' && methode === 'POST') {
    const e = await lireEchange(corps.e);
    const refus = json(401, { erreur: 'E-mail ou code personnel incorrect.' });
    if (!e) return json(404, { erreur: 'Échange introuvable (supprimé ou effacé après sa date).' });
    const email = normaliserEmail(corps.email);
    if (!emailValide(email)) return refus;
    const p = await stockage.get(cleParticipant(e.id, pidDe(e.id, email)));
    if (!p) return refus;
    if (p.bloqueJusque && p.bloqueJusque > horodatage()) return json(429, { erreur: `Trop d'essais : réessaie dans ${BLOCAGE_MINUTES} minutes.` });
    if (!crypto.egal(await crypto.hacher(String(corps.code ?? ''), p.sel), p.hache)) {
      p.echecs = (p.echecs || 0) + 1;
      if (p.echecs >= ESSAIS_MAX) { p.echecs = 0; p.bloqueJusque = new Date(maintenant().getTime() + BLOCAGE_MINUTES * 60000).toISOString(); }
      await stockage.set(cleParticipant(e.id, p.id), p);
      return refus;
    }
    if (p.echecs || p.bloqueJusque) { p.echecs = 0; p.bloqueJusque = null; await stockage.set(cleParticipant(e.id, p.id), p); }
    return json(200, { jeton: jetonDe(e.id, p.id) });
  }

  if (chemin === '/participant') {
    const [eid, pid] = String(requete.headers.get('x-participant') || '').split('.');
    const e = idValide(eid) ? await lireEchange(eid) : null;
    if (!e || !idValide(pid) || !crypto.egal(String(requete.headers.get('x-participant')), jetonDe(eid, pid))) return json(401, { erreur: 'Lien personnel invalide, ou échange effacé.' });
    const p = await stockage.get(cleParticipant(eid, pid));
    if (!p) return json(401, { erreur: 'Tu ne fais plus partie de cet échange.' });

    if (methode === 'GET') {
      const liste = await participants(eid);
      let destinataire = null;
      const cible = e.tirage?.attributions?.[pid];
      if (cible) {
        const d = liste.find((x) => x.id === cible);
        destinataire = d ? { nom: d.nom, souhaits: d.souhaits } : null;
        if (!p.vuLe) { p.vuLe = horodatage(); await stockage.set(cleParticipant(eid, pid), p); }
      }
      return json(200, { echange: vueInvitation(e, liste), moi: { nom: p.nom, email: p.email, souhaits: p.souhaits }, destinataire, effacement: dateEffacement(e) });
    }
    if (methode === 'PUT') {
      p.souhaits = texte(corps.souhaits, LIMITES.souhaits);
      await stockage.set(cleParticipant(eid, pid), p);
      return json(200, { ok: true, moi: { nom: p.nom, email: p.email, souhaits: p.souhaits } });
    }
    if (methode === 'DELETE') {
      if (e.tirage) return json(409, { erreur: 'Le tirage est fait : demande à l\'organisateur de te retirer (il devra refaire le tirage).' });
      await stockage.supprimer(cleParticipant(eid, pid));
      e.exclusions = e.exclusions.filter(([a, b]) => a !== pid && b !== pid);
      await stockage.set(cleEchange(eid), e);
      return json(200, { ok: true });
    }
  }
  return json(404, { erreur: 'Route inconnue.' });
}

// Effacement planifié (fonction Netlify quotidienne) : supprime tout échange dont la date d'effacement
// est passée, avec ses participants, même s'il n'est plus jamais consulté. Renvoie le nombre d'échanges effacés.
export async function purgerExpires({ stockage, maintenant = () => new Date() }) {
  const auj = maintenant().toISOString().slice(0, 10);
  let n = 0;
  for (const cle of await stockage.lister('ech/')) {
    const e = await stockage.get(cle);
    if (!e) continue;
    const fin = dateEffacement(e);
    if (!fin || fin >= auj) continue;
    for (const c of await stockage.lister(`par/${e.id}/`)) await stockage.supprimer(c);
    await stockage.supprimer(cle);
    const a = await stockage.get(`adm/${e.proprio}`);
    if (a) { a.echanges = a.echanges.filter((x) => x !== e.id); await stockage.set(`adm/${e.proprio}`, a); }
    n++;
  }
  return n;
}
