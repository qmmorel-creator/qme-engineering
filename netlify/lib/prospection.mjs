// Campagnes ciblées de prospection envoyées par le site, via la boîte OVH (décision de Quentin du 25/11/2026 :
// vague auto-écoles, du lundi au samedi, espacés régulièrement entre 8 h et 18 h, heure de Paris, avec copie cachée
// vers sa boîte pro, redirigée vers son Gmail). Plafond global de 50 par jour supprimé le 25/11/2026 à la demande de
// Quentin : rythme d'un mail toutes les 2 minutes (300 par jour au plus) ; plafond par campagne seulement s'il est demandé.
//
// La session qui pilote la campagne (skill .claude/skills/campagne-ciblee-pack/) prépare, vérifie et fait valider
// les mails, puis les met en file ; la tâche planifiée prospection-envoi.mjs (toutes les 2 minutes) en envoie UN à
// chaque passage, dans la fenêtre d'envoi (et sous le plafond de la campagne, s'il en a un). Les relances J+7 ne sont pas
// mises en file automatiquement : la session les ajoute seulement après avoir vérifié, dans Gmail, qu'aucune réponse
// n'est arrivée.
//
// Garde-fous, appliqués ici quel que soit le contenu reçu (REGLES-PROSPECTION.md) :
//  - liste d'opposition (adresse et domaine) relue juste avant chaque envoi : opposé = écarté, jamais envoyé ;
//  - signature graphique « Bandeau » et mention « Ne plus recevoir les informations » ajoutées par le serveur ;
//  - une adresse ne reçoit jamais deux premiers mails d'une même campagne ; une relance suit un premier mail envoyé ;
//  - campagne en pause : rien ne part.
//
// Stockage (store des essais, Francfort), préfixe prospection/ :
//  campagne/<c>                 { id, nom, parJour?, pause, cree }
//  file/<c>/<rang>              message en attente ; rang = « 0-<pasAvant>-<n> » (relances, d'abord) ou « 1-<n> »
//  fait/<c>/<id>                message traité : envoye | ecarte | erreur, messageId, envoyeLe
//  adresse/<c>/<empreinte>      id du premier mail de cette adresse dans la campagne
//  jour/<AAAA-MM-JJ>            { envoyes, journal: [{ heure, campagne, id, type, statut }] } (toutes campagnes)
//
// Routes (en-tête X-Prospection-Token : jeton PROSPECTION_TOKEN, 32 caractères au moins, injecté par le proxy des
// sessions de prospection ; ou en-tête X-Admin : code administrateur), préfixe /api/prospection :
//  GET    /                         → campagnes et compteurs
//  GET    /campagne?c=&details=1    → file et messages traités (sans le corps des mails)
//  POST   /campagne   { id, nom, parJour?, pause = true }           → crée ou modifie (pause / reprise) ; parJour
//                     facultatif, sans plafond global ; parJour: 0 ou null retire le plafond de la campagne
//  POST   /file       { campagne, messages: [{ id, email, objet, texte, type?, relanceDe?, pasAvant? }] }
//                     → { ajoutes, refuses: [{ id, raison }] } ; texte = corps sans signature ni mention
//  POST   /apercu     { email, objet, texte }                        → { objet, texte, html } tels qu'ils partiraient
//  POST   /retirer    { campagne, ids }                              → retire de la file (réponse reçue, « stop »)
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cleEmail, jourParis } from './templates-acces.mjs';
import { estAdmin } from './interets.mjs';
import { oppositionDe } from './preferences.mjs';
import { corpsHtml, enveloppeHtml, SIGNATURE } from './essais.mjs';

export const FENETRE = { debut: 8 * 60, fin: 18 * 60 }; // minutes depuis minuit, heure de Paris
export const JOURS_ENVOI = new Set([1, 2, 3, 4, 5, 6]); // lundi à samedi
const SITE = 'https://qm-engineering.fr';
const P = 'prospection/';

const json = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const normEmail = (e) => String(e || '').trim().toLowerCase();
const emailValide = (e) => e.length <= 254 && /^[^\s@"<>,;]{1,64}@[^\s@"<>,;]{1,190}\.[a-z]{2,24}$/i.test(e);
const idValide = (s) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(String(s || ''));

// Heure de Paris : jour de la semaine (0 = dimanche) et minutes depuis minuit.
export function horlogeParis(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).map((p) => [p.type, p.value]));
  const jours = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { jourSemaine: jours[parts.weekday], minutes: Number(parts.hour) * 60 + Number(parts.minute), jour: jourParis(date) };
}
export const dansFenetre = (h) => JOURS_ENVOI.has(h.jourSemaine) && h.minutes >= FENETRE.debut && h.minutes < FENETRE.fin;

// Mention d'opposition (REGLES-PROSPECTION.md § 2), adresse encodée.
export const lienOpposition = (email) => `${SITE}/ne-plus-recevoir/?email=${encodeURIComponent(normEmail(email))}`;

// Mail tel qu'il part : corps + signature (texte et graphique) + mention d'opposition.
export function composer({ email, objet, texte }) {
  const corps = String(texte || '').trim();
  const lien = lienOpposition(email);
  const texteFinal = `${corps}\n\n${SIGNATURE}\n\n—\nVous ne souhaitez plus recevoir d'informations de QME ? Ne plus recevoir les informations : ${lien} (ou répondez simplement « stop »).`;
  const html = enveloppeHtml(`${corpsHtml(`${corps}\n\n${SIGNATURE}`)}<p style="margin:24px 0 0;font:12px/1.5 Arial,Helvetica,sans-serif;color:#6b6660">Vous ne souhaitez plus recevoir d’informations de QME&nbsp;? <a href="${lien}" style="color:#6b6660">Ne plus recevoir les informations</a> (ou répondez simplement «&nbsp;stop&nbsp;»).</p>`);
  return { objet: String(objet || '').trim(), texte: texteFinal, html };
}

const verifierMessage = (m) => {
  const email = normEmail(m.email);
  if (!idValide(m.id)) return 'id invalide (minuscules, chiffres, tirets)';
  if (!emailValide(email)) return 'adresse invalide';
  if (!String(m.objet || '').trim() || String(m.objet).length > 200) return 'objet manquant ou trop long';
  const t = String(m.texte || '');
  if (t.trim().length < 80 || t.length > 6000) return 'texte trop court ou trop long';
  if (/ne-plus-recevoir/.test(t)) return 'texte : la mention d\'opposition est ajoutée par le serveur';
  if (m.type === 'relance' && !idValide(m.relanceDe)) return 'relance sans relanceDe';
  if (m.pasAvant && !/^\d{4}-\d{2}-\d{2}$/.test(m.pasAvant)) return 'pasAvant attendu au format AAAA-MM-JJ';
  return null;
};

export async function mettreEnFile({ store, secret, campagne, messages, maintenant = Date.now }) {
  if (!(await store.get(`${P}campagne/${campagne}`))) return { erreur: 'campagne inconnue' };
  const ajoutes = [], refuses = [];
  let n = maintenant();
  for (const m of messages || []) {
    const raison = verifierMessage(m);
    if (raison) { refuses.push({ id: m.id, raison }); continue; }
    const email = normEmail(m.email);
    const relance = m.type === 'relance';
    if (await store.get(`${P}fait/${campagne}/${m.id}`)) { refuses.push({ id: m.id, raison: 'id déjà traité' }); continue; }
    if (await oppositionDe(store, secret, email)) { refuses.push({ id: m.id, raison: 'liste d\'opposition' }); continue; }
    let premier = null;
    if (relance) {
      premier = await store.get(`${P}fait/${campagne}/${m.relanceDe}`);
      if (!premier || premier.statut !== 'envoye' || premier.email !== email) { refuses.push({ id: m.id, raison: 'premier mail non envoyé à cette adresse' }); continue; }
    } else {
      const deja = await store.get(`${P}adresse/${campagne}/${cleEmail(secret, email)}`);
      if (deja) { refuses.push({ id: m.id, raison: `adresse déjà dans la campagne (${deja.id})` }); continue; }
    }
    const rang = relance ? `0-${m.pasAvant || jourParis(new Date(n))}-${n}` : `1-${n}`;
    n += 1;
    const message = { id: m.id, campagne, email, objet: String(m.objet).trim(), texte: String(m.texte).trim(), type: relance ? 'relance' : 'premier',
      ...(relance ? { relanceDe: m.relanceDe, inReplyTo: premier.messageId } : {}), ...(m.pasAvant ? { pasAvant: m.pasAvant } : {}), rang, ajoute: new Date(maintenant()).toISOString() };
    await store.set(`${P}file/${campagne}/${rang}`, message);
    if (!relance) await store.set(`${P}adresse/${campagne}/${cleEmail(secret, email)}`, { id: m.id });
    ajoutes.push(m.id);
  }
  return { ajoutes, refuses };
}

// Un passage de la tâche planifiée : au plus un mail, toutes campagnes actives confondues.
export async function envoyerSuivant({ store, secret, envoyer, maintenant = Date.now, forcer = false }) {
  const date = new Date(maintenant());
  const h = horlogeParis(date);
  if (!forcer && !dansFenetre(h)) return { statut: 'hors-fenetre' };
  if (!envoyer) return { statut: 'envoi-non-configure' };
  const cleJour = `${P}jour/${h.jour}`;
  const jour = (await store.get(cleJour)) || { envoyes: 0, journal: [] };
  const campagnes = (await Promise.all((await store.lister(`${P}campagne/`)).map((k) => store.get(k)))).filter((c) => c && !c.pause);
  for (const c of campagnes) {
    const envoyesCampagne = jour.journal.filter((j) => j.campagne === c.id && j.statut === 'envoye').length;
    if (c.parJour > 0 && envoyesCampagne >= c.parJour) continue;
    const cles = (await store.lister(`${P}file/${c.id}/`)).sort();
    for (const cle of cles) {
      const m = await store.get(cle);
      if (!m) continue;
      if (m.pasAvant && m.pasAvant > h.jour) continue;
      const trace = (statut, extra = {}) => ({ ...m, statut, traite: date.toISOString(), ...extra });
      const fin = async (statut, extra) => {
        await store.set(`${P}fait/${c.id}/${m.id}`, trace(statut, extra));
        await store.supprimer(cle);
        jour.journal.push({ heure: date.toISOString(), campagne: c.id, id: m.id, type: m.type, statut });
        if (statut === 'envoye') jour.envoyes += 1;
        await store.set(cleJour, jour);
      };
      const opposition = await oppositionDe(store, secret, m.email);
      if (opposition) { await fin('ecarte', { raison: 'liste d\'opposition' }); continue; }
      const { objet, texte, html } = composer(m);
      const messageId = `<${randomBytes(12).toString('hex')}.prospection@qm-engineering.fr>`;
      try {
        await envoyer({ a: m.email, objet: m.type === 'relance' && !/^re\s*:/i.test(objet) ? `Re: ${objet}` : objet, texte, html, copieCachee: true, messageId,
          ...(m.inReplyTo ? { inReplyTo: m.inReplyTo, references: m.inReplyTo } : {}) });
      } catch (e) {
        const tentatives = (m.tentatives || 0) + 1;
        if (tentatives >= 3) await fin('erreur', { erreur: String(e?.message || e).slice(0, 300), tentatives });
        else await store.set(cle, { ...m, tentatives, derniereErreur: String(e?.message || e).slice(0, 300) });
        return { statut: 'erreur', id: m.id };
      }
      await fin('envoye', { messageId, envoyeLe: date.toISOString() });
      return { statut: 'envoye', campagne: c.id, id: m.id };
    }
  }
  return { statut: 'rien-a-envoyer' };
}

async function etatCampagne(store, c, details) {
  const file = await store.lister(`${P}file/${c.id}/`);
  const faits = await store.lister(`${P}fait/${c.id}/`);
  const etat = { ...c, enFile: file.length, traites: faits.length };
  if (details) {
    const sans = ({ texte, ...r }) => r;
    etat.file = (await Promise.all(file.sort().map((k) => store.get(k)))).filter(Boolean).map(sans);
    etat.faits = (await Promise.all(faits.map((k) => store.get(k)))).filter(Boolean).map(sans);
  }
  return etat;
}

const jetonValide = (saisi, attendu) => {
  const a = Buffer.from(String(saisi || '').trim()), b = Buffer.from(String(attendu || ''));
  return b.length >= 32 && a.length === b.length && timingSafeEqual(a, b);
};

export async function traiterProspection(requete, { secret, store, admin = '', jeton = '', maintenant = Date.now }) {
  if (!jetonValide(requete.headers.get('x-prospection-token'), jeton) && !estAdmin(requete.headers.get('x-admin') || '', { secret, admin })) {
    return json(401, { erreur: 'Jeton de prospection ou code administrateur requis.' });
  }
  const url = new URL(requete.url);
  const chemin = url.pathname.replace(/^\/api\/prospection/, '') || '/';
  const methode = requete.method;
  const corps = methode === 'POST' ? await requete.json().catch(() => null) : null;
  if (methode === 'POST' && !corps) return json(400, { erreur: 'JSON attendu.' });

  if (chemin === '/' && methode === 'GET') {
    const campagnes = (await Promise.all((await store.lister(`${P}campagne/`)).map((k) => store.get(k)))).filter(Boolean);
    const h = horlogeParis(new Date(maintenant()));
    return json(200, { maintenant: h, dansFenetre: dansFenetre(h), jour: (await store.get(`${P}jour/${h.jour}`)) || { envoyes: 0, journal: [] },
      campagnes: await Promise.all(campagnes.map((c) => etatCampagne(store, c, false))) });
  }
  if (chemin === '/campagne' && methode === 'GET') {
    const c = await store.get(`${P}campagne/${url.searchParams.get('c')}`);
    return c ? json(200, await etatCampagne(store, c, url.searchParams.get('details') === '1')) : json(404, { erreur: 'campagne inconnue' });
  }
  if (chemin === '/campagne' && methode === 'POST') {
    if (!idValide(corps.id)) return json(400, { erreur: 'id invalide' });
    const cle = `${P}campagne/${corps.id}`;
    const avant = (await store.get(cle)) || { id: corps.id, cree: new Date(maintenant()).toISOString(), pause: true };
    const c = { ...avant, ...(corps.nom ? { nom: String(corps.nom).slice(0, 120) } : {}),
      ...(Number(corps.parJour) >= 1 ? { parJour: Math.floor(Number(corps.parJour)) } : {}),
      ...(typeof corps.pause === 'boolean' ? { pause: corps.pause } : {}), modifie: new Date(maintenant()).toISOString() };
    if ('parJour' in corps && !(Number(corps.parJour) >= 1)) delete c.parJour; // 0 ou null : plus de plafond
    await store.set(cle, c);
    return json(200, c);
  }
  if (chemin === '/file' && methode === 'POST') {
    if (!idValide(corps.campagne) || !Array.isArray(corps.messages) || corps.messages.length > 500) return json(400, { erreur: 'campagne et messages (500 au plus) attendus' });
    const r = await mettreEnFile({ store, secret, campagne: corps.campagne, messages: corps.messages, maintenant });
    return r.erreur ? json(404, r) : json(200, r);
  }
  if (chemin === '/apercu' && methode === 'POST') {
    const raison = verifierMessage({ id: 'apercu', ...corps });
    return raison ? json(400, { erreur: raison }) : json(200, composer(corps));
  }
  if (chemin === '/retirer' && methode === 'POST') {
    if (!idValide(corps.campagne) || !Array.isArray(corps.ids)) return json(400, { erreur: 'campagne et ids attendus' });
    const ids = new Set(corps.ids);
    const retires = [];
    for (const cle of await store.lister(`${P}file/${corps.campagne}/`)) {
      const m = await store.get(cle);
      if (m && ids.has(m.id)) {
        await store.set(`${P}fait/${corps.campagne}/${m.id}`, { ...m, texte: undefined, statut: 'ecarte', raison: String(corps.raison || 'retiré').slice(0, 200), traite: new Date(maintenant()).toISOString() });
        await store.supprimer(cle); retires.push(m.id);
      }
    }
    return json(200, { retires });
  }
  return json(404, { erreur: 'Route inconnue.' });
}
