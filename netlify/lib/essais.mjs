// Essai gratuit des templates (vie personnelle le 18/11/2026, professionnels le 21/11/2026 ; décisions de Quentin).
//
// Parcours : formulaire /essai/ → POST /api/essai → code d'essai (14 jours, sans carte) → l'application
// s'ouvre avec ce code. À la fin : lecture seule 30 jours, puis effacement. À l'achat, la clé Gumroad saisie
// dans l'application reprend les données de l'essai (templates-acces.mjs, reporterEssai).
//
// E-mails envoyés depuis quentin.morel@qm-engineering.fr (SMTP OVH, voir netlify/lib/mail.mjs) :
//  - merci : tout de suite, avec le code ;
//  - prise-en-main : 2 jours après le début (jusqu'à J+5 en rattrapage), personnalisé par template
//    (essais-prise-en-main.mjs) ;
//  - rappel : 3 jours avant la fin ;
//  - fin : le lendemain de la fin (lecture seule, données gardées 30 jours) ;
//  - effacement : 7 jours avant l'effacement.
// Aucun rappel après un achat ou une demande d'arrêt (lien en bas de chaque e-mail).
//
// Registre (store « templates-essais ») :
//  essai/<id>                      → { id, produit, code, email, prenom, cree, debut, fin, effacement, mails, stop, achete }
//  email/<hmac e-mail>/<produit>   → { id }   (un essai par adresse et par template)
//  ip/<hmac ip>/<jour>             → { n }    (limite de créations par jour et par adresse IP)
import { createHmac, timingSafeEqual } from 'node:crypto';
import { statEssai } from './templates-acces.mjs';
import { PRODUITS, ESSAI, genererCodeEssai, verifierCodeEssai, etatEssai, jourParis, decalerJour, cleDonneesEssai, cleEmail } from './templates-acces.mjs';
import { TEMPLATES, publics } from '../../outils/packs/donnees.mjs';
import { estAdmin } from './interets.mjs';
import { PRISE_EN_MAIN } from './essais-prise-en-main.mjs';
import { enregistrerOpposition, leverOpposition } from './preferences.mjs';
import { SIGNATURE_HTML } from './signature.mjs';

export const SITE = 'https://qm-engineering.fr';

// Base de contacts « Nouveautés QME » (demande de Quentin, 19/11/2026) : case FACULTATIVE du formulaire d'essai,
// non cochée par défaut (consentement libre, distinct de l'essai, exigé par le RGPD pour la prospection par e-mail).
// Registre : contact/<empreinte e-mail> → { email, prenom, templates, consenti, maj, texte }. Conservation : 3 ans après
// le dernier échange (recommandation CNIL pour les prospects), effacement par la tâche quotidienne. Désinscription en un
// clic (lien signé, colonne du CSV et pied des e-mails d'essai). Export : /admin/contacts/ (code administrateur).
export const CONSENTEMENT_NOUVEAUTES = 'Recevoir aussi les nouveautés QME (nouveaux templates, offres). Désinscription en un clic dans chaque e-mail.';
export const CONSERVATION_CONTACTS_JOURS = 3 * 365;
export const signerDesinscription = (secret, cle) => createHmac('sha256', secret).update(`contact-stop:${cle}`).digest('hex').slice(0, 24);
export const lienDesinscription = (secret, email) => {
  const e = cleEmail(secret, email);
  return `https://qm-engineering.fr/api/essai/desinscription?e=${e}&s=${signerDesinscription(secret, e)}`;
};

async function enregistrerContact(essais, secret, { email, prenom, slug, date }) {
  // Nouveau consentement explicite (case cochée) : une désinscription passée est levée (preferences.mjs).
  await leverOpposition(essais, cleEmail(secret, email));
  const cle = `contact/${cleEmail(secret, email)}`;
  const c = await essais.get(cle);
  const templates = [...new Set([...(c?.templates || []), slug])];
  await essais.set(cle, {
    email, prenom: prenom || c?.prenom || '', templates, source: 'essai gratuit',
    consenti: c?.consenti || date.toISOString(), maj: date.toISOString(), texte: CONSENTEMENT_NOUVEAUTES,
  });
}

const csvCellule = (v) => { const t = String(v ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function csvContacts(contacts, secret) {
  const lignes = [['email', 'prenom', 'templates_essayes', 'consentement_le', 'dernier_echange', 'lien_desinscription']];
  for (const c of contacts) lignes.push([c.email, c.prenom, c.templates.join(' '), c.consenti.slice(0, 10), c.maj.slice(0, 10), lienDesinscription(secret, c.email)]);
  return '\ufeff' + lignes.map((l) => l.map(csvCellule).join(';')).join('\r\n') + '\r\n';
}
// ---------- Suivi des essais par Quentin (demande du 19/11/2026) ----------
// Notification à chaque essai lancé (adresse ESSAI_NOTIFICATION, sinon l'expéditeur) et page /admin/essais/.
export function mailNotification(reg) {
  const f = ficheEssai(reg.produit);
  const dateFr = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const objet = `Nouvel essai : ${f.nom}${reg.prenom ? ` · ${reg.prenom}` : ''}`;
  const texte = `Nouvel essai gratuit lancé sur qm-engineering.fr.

Template : ${f.nom} (${(f.prix / 100).toLocaleString('fr-FR')} €)
Prénom : ${reg.prenom || '(non donné)'}
E-mail : ${reg.email}
Nouveautés QME : ${reg.nouveautes ? 'oui, inscrit(e) à la liste' : 'non'}
Fin de l'essai : ${dateFr(reg.fin)} · effacement des données : ${dateFr(reg.effacement)}
E-mail de remerciement : ${reg.mails?.merci ? 'envoyé' : 'non envoyé'}

Tous les essais : ${SITE}/admin/essais/`;
  return { objet, texte };
}

function vueEssai(reg, aujourdhui) {
  const etat = etatEssai(reg, aujourdhui);
  const f = ficheEssai(reg.produit);
  return {
    id: reg.id, template: f.nom, slug: f.slug, prenom: reg.prenom || '', email: reg.email, cree: reg.cree,
    debut: reg.debut, fin: reg.fin, effacement: reg.effacement, joursRestants: etat.joursRestants,
    statut: reg.achete || reg.paye ? 'acheté' : etat.termine ? 'terminé (lecture seule)' : 'en cours',
    achete: reg.achete || null, reporte: Boolean(reg.reporte), nouveautes: Boolean(reg.nouveautes), rappelsArretes: Boolean(reg.stop),
    mails: Object.entries(reg.mails || {}).filter(([, v]) => v && v !== 'saute').map(([k]) => k),
    // Pour /admin/suivi/ (21/11/2026) : date de chaque e-mail parti (« saute » : rattrapé par un e-mail plus avancé
    // le même jour), date du paiement notifié par Gumroad, code produit et prix.
    envois: { ...(reg.mails || {}) }, paye: reg.paye || null, produit: reg.produit, prix: f.prix,
  };
}
export function csvEssais(vues) {
  const lignes = [['email', 'prenom', 'template', 'statut', 'debut', 'fin', 'jours_restants', 'achete_le', 'donnees_reprises', 'nouveautes', 'emails_envoyes']];
  for (const v of vues) lignes.push([v.email, v.prenom, v.template, v.statut, v.debut, v.fin, v.joursRestants, v.achete ? v.achete.slice(0, 10) : '', v.reporte ? 'oui' : 'non', v.nouveautes ? 'oui' : 'non', v.mails.join(' ')]);
  return '\ufeff' + lignes.map((l) => l.map(csvCellule).join(';')).join('\r\n') + '\r\n';
}
async function lireEssais(essais, aujourdhui) {
  const vues = [];
  for (const cle of await essais.lister('essai/')) { const r = await essais.get(cle); if (r) vues.push(vueEssai(r, aujourdhui)); }
  return vues.sort((a, b) => String(b.cree).localeCompare(String(a.cree)));
}

async function lireContacts(essais) {
  const contacts = [];
  for (const cle of await essais.lister('contact/')) { const c = await essais.get(cle); if (c) contacts.push(c); }
  return contacts.sort((a, b) => b.maj.localeCompare(a.maj));
}
export const CREATIONS_PAR_IP_ET_PAR_JOUR = 5;
const TAILLE_MAX = 4000;

// Templates ouverts à l'essai : vie personnelle (18/11/2026) et professionnels (extension préparée le 21/11/2026),
// en vente (identifiant Gumroad et lien d'achat), payants.
export const POUR_ESSAI = ['perso', 'pro'];
export const PRODUITS_ESSAI = Object.keys(PRODUITS).filter((p) => publics(TEMPLATES[p]).some((x) => POUR_ESSAI.includes(x)) && PRODUITS[p].gumroad && TEMPLATES[p].permalien && TEMPLATES[p].prix > 0);

export function ficheEssai(produit) {
  const t = TEMPLATES[produit], p = PRODUITS[produit];
  return {
    produit, nom: p.nom, slug: t.slug, prix: t.prix,
    app: `${SITE}${p.url}`, catalogue: `${SITE}/catalogue/${t.slug}/`,
    achat: `https://qmengineering.gumroad.com/l/${t.permalien}`,
  };
}

// Produit désigné par son préfixe (BDG) ou son slug (budget).
export function produitEssai(saisie) {
  const s = String(saisie || '').trim();
  const p = PRODUITS_ESSAI.find((x) => x === s.toUpperCase() || TEMPLATES[x].slug === s.toLowerCase());
  return p || null;
}

const json = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export const emailValide = (e) => typeof e === 'string' && e.length <= 254 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(e.trim());
const nettoyerPrenom = (p) => String(p || '').replace(/[\r\n<>"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

// Lien d'arrêt des rappels : signé, il ne révèle rien et ne s'invente pas.
export const signerStop = (secret, id) => createHmac('sha256', secret).update(`essai-stop:${id}`).digest('hex').slice(0, 24);
export const lienStop = (secret, id) => `${SITE}/api/essai/stop?id=${id}&s=${signerStop(secret, id)}`;

const dateFr = (jour) => new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).replace(/ 1 /, ' 1er ');
const euros = (c) => `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0 })} €`;

// ---------- E-mails ----------
// Ton : Quentin écrit lui-même, vouvoiement, phrases courtes, aucune pression commerciale.
export const SIGNATURE = 'Quentin Morel\nQM Engineering · qm-engineering.fr';

// Mise en forme HTML commune (e-mails d'essai et d'achat) : paragraphes, liens cliquables (ponctuation finale
// exclue) et, si le texte se termine par la signature texte, signature graphique à sa place (signature.mjs).
export function corpsHtml(texte) {
  const echapper = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const avecSignature = texte.endsWith(SIGNATURE);
  const corps = avecSignature ? texte.slice(0, -SIGNATURE.length).trimEnd() : texte;
  return echapper(corps).split('\n\n').map((b) => `<p style="margin:0 0 14px">${b.replace(/\n/g, '<br>').replace(/https:\/\/[^\s<]*[^\s<.,;:!?)»]/g, (u) => `<a href="${u}" style="color:#1D4E89">${u}</a>`)}</p>`).join('')
    + (avecSignature ? `<div style="margin:18px 0 0">${SIGNATURE_HTML}</div>` : '');
}
export const enveloppeHtml = (interieur) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#141414;max-width:560px">${interieur}</div>`;

function habiller(texte, { secret, id, email = null }) {
  const nouv = email ? `\nVous êtes aussi inscrit(e) aux nouveautés QME. Se désinscrire : ${lienDesinscription(secret, email)}` : '';
  const pied = `\n\n—\nVous recevez cet e-mail parce que vous avez lancé un essai gratuit sur qm-engineering.fr. Plus aucun rappel : ${lienStop(secret, id)}${nouv}`;
  const html = enveloppeHtml(`${corpsHtml(texte)}<p style="margin:24px 0 0;font-size:12px;color:#6b6660">Vous recevez cet e-mail parce que vous avez lancé un essai gratuit sur qm-engineering.fr. <a href="${lienStop(secret, id)}" style="color:#6b6660">Ne plus recevoir de rappel</a>.${email ? ` Vous êtes aussi inscrit(e) aux nouveautés QME : <a href="${lienDesinscription(secret, email)}" style="color:#6b6660">se désinscrire</a>.` : ''}</p>`);
  return { texte: texte + pied, html };
}

export function contenuMail(type, reg, secret) {
  const f = ficheEssai(reg.produit);
  const bonjour = reg.prenom ? `Bonjour ${reg.prenom},` : 'Bonjour,';
  const ouvrir = `${f.app}?essai=${encodeURIComponent(reg.code)}`;
  const nom = `« ${f.nom} »`; // guillemets : aucun article à accorder (« le Budget », « la Capacité », « les Notes »)
  let objet, texte;
  if (type === 'merci' || type === 'renvoi') {
    objet = type === 'merci' ? `Merci d'essayer ${nom}` : `Votre code d'essai : ${f.nom}`;
    texte = `${bonjour}

${type === 'merci' ? `Merci d'avoir lancé l'essai gratuit du template ${nom}. Je suis content que vous le testiez.` : `Vous avez demandé à nouveau votre essai gratuit du template ${nom} : le voici.`}

Vous avez accès à tout, sans carte bancaire, jusqu'au ${dateFr(reg.fin)} inclus.

Votre code d'essai : ${reg.code}
Pour ouvrir le template : ${ouvrir}
Sur un autre appareil, ouvrez ${f.app} et saisissez ce code : vos données vous suivent.

Si vous continuez : achetez le template (${euros(f.prix)}, achat unique, à vie) sur ${f.achat}, puis saisissez dans l'application la clé reçue par e-mail. Tout ce que vous aurez saisi pendant l'essai est conservé.

Si vous ne continuez pas : vous n'avez rien à faire, aucun prélèvement. Vos données restent consultables 30 jours après l'essai, puis elles sont effacées.

Une question, un manque, une idée ? Répondez simplement à cet e-mail : c'est moi qui le lis, et le template évolue avec vos retours.

Bon essai,
${SIGNATURE}`;
  } else if (type === 'prise-en-main') {
    const g = PRISE_EN_MAIN[reg.produit];
    if (!g) throw new Error(`Prise en main absente pour ${reg.produit}`);
    objet = `${f.nom} : par où commencer`;
    texte = `${bonjour}

Vous avez lancé l'essai du template ${nom} le ${dateFr(reg.debut)}. Si vous n'avez pas encore trouvé par où commencer, voici ce que je ferais à votre place.

Pour démarrer, en quelques minutes : ${g.commencer}

Deux choses qu'on ne remarque pas toujours au premier coup d'œil :
– ${g.astuces[0]}
– ${g.astuces[1]}

Ouvrir le template : ${ouvrir}

${g.aide} Répondez simplement à cet e-mail : je regarde avec vous comment le régler.

Votre essai continue jusqu'au ${dateFr(reg.fin)} inclus. Si vous décidez de garder le template (${euros(f.prix)}, achat unique, sur ${f.achat}), tout ce que vous aurez saisi est repris.

${SIGNATURE}`;
  } else if (type === 'rappel') {
    objet = `Plus que 3 jours d'essai : ${f.nom}`;
    texte = `${bonjour}

Votre essai gratuit du template ${nom} se termine le ${dateFr(reg.fin)} au soir.

Si le template vous rend service, vous pouvez le garder : ${euros(f.prix)}, achat unique, sur ${f.achat}. Saisissez ensuite la clé reçue dans l'application : vos données d'essai sont reprises telles quelles.

Sinon, rien à faire : aucun prélèvement. Après l'essai, vos données restent consultables (sans modification) pendant 30 jours.

Si quelque chose vous a manqué ou gêné, dites-le-moi en répondant : ça m'aide vraiment.

${SIGNATURE}`;
  } else if (type === 'fin') {
    objet = `Votre essai gratuit est terminé : ${f.nom}`;
    texte = `${bonjour}

Votre essai gratuit du template ${nom} est terminé. Merci de l'avoir testé.

Vos données sont gardées, en lecture seule, jusqu'au ${dateFr(reg.effacement)} : ${ouvrir}

Pour continuer avec elles : achetez le template (${euros(f.prix)}, achat unique) sur ${f.achat}, puis saisissez la clé reçue dans l'application (bouton « J'ai acheté »). Tout est repris, rien à ressaisir.

Si vous ne continuez pas, j'aimerais savoir pourquoi : une réponse d'une ligne me suffit.

${SIGNATURE}`;
  } else if (type === 'effacement') {
    objet = `Vos données d'essai seront effacées le ${dateFr(reg.effacement).replace(/^\S+ /, '')}`;
    texte = `${bonjour}

Les données saisies pendant votre essai du template ${nom} seront effacées après le ${dateFr(reg.effacement)}.

Pour les garder : achetez le template (${euros(f.prix)}) sur ${f.achat} et saisissez la clé dans l'application avant cette date. Vous pouvez aussi en télécharger une copie depuis les réglages de l'application : ${ouvrir}

Sans action de votre part, elles seront supprimées, comme prévu. C'est mon dernier e-mail à ce sujet.

${SIGNATURE}`;
  } else throw new Error(`E-mail inconnu : ${type}`);
  return { objet, ...habiller(texte, { secret, id: reg.id, email: reg.nouveautes ? reg.email : null }) };
}

async function envoyerMail(type, reg, { secret, envoyer }) {
  if (!envoyer || !reg.email) return false;
  const m = contenuMail(type, reg, secret);
  await envoyer({ a: reg.email, objet: m.objet, texte: m.texte, html: m.html });
  return true;
}

// ---------- API /api/essai ----------
//  POST /api/essai        { produit, email, prenom?, consentement, site_web (pot de miel) } → { ok, code, url, fin }
//  GET  /api/essai/stop   ?id=&s=  → arrêt des rappels (page HTML)
export async function traiterEssai(requete, { secret, essais, envoyer = null, maintenant = Date.now, ip = '', admin = '', notifier = '', testeurs = '' }) {
  if (!secret || !essais) return json(503, { erreur: 'Service non configuré' });
  const url = new URL(requete.url);
  const chemin = url.pathname.replace(/^\/api\/essai/, '').replace(/\/$/, '');

  if (chemin === '/stop' && requete.method === 'GET') {
    const id = String(url.searchParams.get('id') || ''), s = String(url.searchParams.get('s') || '');
    const attendu = signerStop(secret, id);
    const ok = s.length === attendu.length && timingSafeEqual(Buffer.from(s), Buffer.from(attendu));
    const reg = ok ? await essais.get(`essai/${id}`) : null;
    if (reg) await essais.set(`essai/${id}`, { ...reg, stop: true });
    const message = reg ? 'C\'est noté : vous ne recevrez plus aucun rappel pour cet essai.' : 'Lien invalide ou essai déjà effacé.';
    return new Response(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Rappels d'essai · QME</title><body style="font-family:Arial,sans-serif;max-width:520px;margin:15vh auto;padding:0 16px;color:#141414;background:#FBF7F1"><h1 style="font-size:22px">Rappels d'essai</h1><p>${message}</p><p><a href="/templates/" style="color:#1D4E89">Retour aux templates</a></p></body></html>`,
      { status: reg ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  // Désinscription des nouveautés (lien signé) : le contact est effacé.
  if (chemin === '/desinscription' && requete.method === 'GET') {
    const e = String(url.searchParams.get('e') || ''), s = String(url.searchParams.get('s') || '');
    const attendu = signerDesinscription(secret, e);
    const ok = /^[0-9a-f]{32}$/.test(e) && s.length === attendu.length && timingSafeEqual(Buffer.from(s), Buffer.from(attendu));
    // Liste d'opposition (preferences.mjs) : fiche « nouveautés » effacée, plus aucune annonce QME.
    if (ok) await enregistrerOpposition(essais, e, { source: 'lien des e-mails d\'essai', date: new Date(maintenant()).toISOString() });
    const message = ok ? 'C\'est fait : vous ne recevrez plus les informations QME (nouveautés, annonces), et votre adresse a été retirée de la liste.' : 'Lien invalide.';
    return new Response(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Désinscription · QME</title><body style="font-family:Arial,sans-serif;max-width:520px;margin:15vh auto;padding:0 16px;color:#141414;background:#FBF7F1"><h1 style="font-size:22px">Nouveautés QME</h1><p>${message}</p><p><a href="/templates/" style="color:#1D4E89">Retour aux templates</a></p></body></html>`,
      { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  // Contacts « nouveautés » : lecture, export CSV et effacement réservés à l'administrateur (code ADM-…).
  // Tous les essais (administrateur) : liste JSON ou CSV.
  if (chemin === '/essais') {
    if (!estAdmin(requete.headers.get('x-admin') || '', { secret, admin })) return json(401, { erreur: 'Code administrateur requis.' });
    if (requete.method !== 'GET') return json(405, { erreur: 'Méthode non permise' });
    const vues = await lireEssais(essais, jourParis(new Date(maintenant())));
    if (url.searchParams.get('format') === 'csv') {
      return new Response(csvEssais(vues), { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store',
        'content-disposition': `attachment; filename="essais-qme-${new Date(maintenant()).toISOString().slice(0, 10)}.csv"` } });
    }
    const compte = (s) => vues.filter((v) => v.statut === s).length;
    return json(200, { total: vues.length, enCours: compte('en cours'), termines: compte('terminé (lecture seule)'), achetes: compte('acheté'), essais: vues });
  }

  if (chemin === '/contacts') {
    if (!estAdmin(requete.headers.get('x-admin') || '', { secret, admin })) return json(401, { erreur: 'Code administrateur requis.' });
    if (requete.method === 'DELETE') {
      const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
      if (!emailValide(email)) return json(400, { erreur: 'Adresse e-mail invalide.' });
      const cle = `contact/${cleEmail(secret, email)}`;
      const existe = Boolean(await essais.get(cle));
      if (existe) await essais.supprimer(cle);
      return json(200, { ok: true, effaces: existe ? 1 : 0 });
    }
    if (requete.method !== 'GET') return json(405, { erreur: 'Méthode non permise' });
    const contacts = await lireContacts(essais);
    if (url.searchParams.get('format') === 'csv') {
      return new Response(csvContacts(contacts, secret), { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store',
        'content-disposition': `attachment; filename="contacts-qme-${new Date(maintenant()).toISOString().slice(0, 10)}.csv"` } });
    }
    const depuis = new Date(maintenant() - 30 * 86_400_000).toISOString();
    return json(200, { total: contacts.length, trenteJours: contacts.filter((c) => c.consenti >= depuis).length,
      contacts: contacts.map((c) => ({ email: c.email, prenom: c.prenom, templates: c.templates, consenti: c.consenti, maj: c.maj })) });
  }

  if (chemin !== '' || requete.method !== 'POST') return json(404, { erreur: 'Route inconnue' });
  const texte = await requete.text();
  if (texte.length > TAILLE_MAX) return json(413, { erreur: 'Requête trop volumineuse' });
  let corps;
  try { corps = JSON.parse(texte || '{}'); } catch { return json(400, { erreur: 'JSON invalide' }); }

  if (corps.site_web) return json(400, { erreur: 'Demande refusée.' }); // pot de miel rempli : robot
  const produit = produitEssai(corps.produit);
  if (!produit) return json(400, { erreur: 'Ce template n\'est pas proposé à l\'essai gratuit.' });
  const email = String(corps.email || '').trim().toLowerCase();
  if (!emailValide(email)) return json(400, { erreur: 'Adresse e-mail invalide.' });
  if (corps.consentement !== true) return json(400, { erreur: 'Merci d\'accepter de recevoir les e-mails liés à votre essai.' });

  const date = new Date(maintenant());
  const aujourdhui = jourParis(date);
  // Case facultative « nouveautés » : seule une case cochée (true) inscrit l'adresse dans la base de contacts.
  const nouveautes = corps.nouveautes === true;
  if (nouveautes) await enregistrerContact(essais, secret, { email, prenom: nettoyerPrenom(corps.prenom), slug: TEMPLATES[produit].slug, date });

  // Un essai par adresse et par template : on renvoie le code par e-mail, jamais dans la réponse
  // (sinon n'importe qui pourrait ouvrir les données d'un autre en tapant son adresse).
  const cleIndex = `email/${cleEmail(secret, email)}/${produit}`;
  const deja = await essais.get(cleIndex);
  const ancien = deja?.id ? await essais.get(`essai/${deja.id}`) : null;
  if (ancien) {
    if (ancien.achete) return json(409, { erreur: 'Vous avez déjà acheté ce template : ouvrez-le avec votre clé de licence.', deja: true });
    let envoye = false;
    try { envoye = await envoyerMail('renvoi', ancien, { secret, envoyer }); } catch (e) { console.error('Renvoi du code impossible', e); }
    return json(409, {
      deja: true, envoye,
      erreur: envoye
        ? 'Un essai existe déjà pour cette adresse : je vous ai renvoyé votre code par e-mail.'
        : 'Un essai existe déjà pour cette adresse. Votre code est dans l\'e-mail reçu au début de l\'essai ; sinon, écrivez à quentin.morel@qm-engineering.fr.',
    });
  }

  // Limite de créations par adresse IP (stockée sous forme d'empreinte).
  if (ip) {
    const cleIp = `ip/${createHmac('sha256', secret).update(`essai-ip:${ip}`).digest('hex').slice(0, 24)}/${aujourdhui}`;
    const compte = (await essais.get(cleIp))?.n || 0;
    if (compte >= CREATIONS_PAR_IP_ET_PAR_JOUR) return json(429, { erreur: 'Trop d\'essais lancés aujourd\'hui depuis cette connexion. Réessayez demain.' });
    await essais.set(cleIp, { n: compte + 1, jour: aujourdhui });
  }

  const code = genererCodeEssai(secret, produit, date);
  const e = verifierCodeEssai(secret, code);
  const reg = {
    id: e.id, produit, code, email, prenom: nettoyerPrenom(corps.prenom), cree: date.toISOString(),
    debut: e.debut, fin: e.fin, effacement: e.effacement, mails: {}, stop: false, achete: null, nouveautes,
  };
  try { if (await envoyerMail('merci', reg, { secret, envoyer })) reg.mails.merci = date.toISOString(); } catch (x) { console.error('E-mail de remerciement impossible', x); }
  // Notification à Quentin : un échec n'empêche jamais l'essai.
  if (envoyer && notifier) {
    try { const n = mailNotification(reg); await envoyer({ a: notifier, objet: n.objet, texte: n.texte }); } catch (x) { console.error('Notification d\'essai impossible', x); }
  }
  await essais.set(`essai/${e.id}`, reg);
  await essais.set(cleIndex, { id: e.id });
  await essais.set(`stat/${e.id}`, statEssai(reg, testeurs)); // compteur : trace anonyme, jamais effacée
  return json(200, { ok: true, code, produit, url: PRODUITS[produit].url, fin: e.fin, jours: ESSAI.jours, mail: Boolean(reg.mails.merci) });
}

// ---------- Tâche quotidienne : rappels et effacement ----------
// Renvoie le bilan { essais, envoyes: { type: n }, effaces }.
export async function tournerEssais({ secret, essais, stockage, envoyer = null, maintenant = Date.now, testeurs = '' }) {
  const aujourdhui = jourParis(new Date(maintenant()));
  const bilan = { essais: 0, envoyes: {}, effaces: 0, erreurs: 0 };
  // Anciennes limites par IP : inutiles au-delà du jour même.
  for (const cle of await essais.lister('ip/')) {
    if (cle.slice(-10) < aujourdhui) await essais.supprimer(cle);
  }
  // Contacts « nouveautés » : effacés 3 ans après le dernier échange.
  const limite = new Date(maintenant() - CONSERVATION_CONTACTS_JOURS * 86_400_000).toISOString();
  bilan.contactsEffaces = 0;
  for (const cle of await essais.lister('contact/')) {
    const c = await essais.get(cle);
    if (c && c.maj < limite) { await essais.supprimer(cle); bilan.contactsEffaces++; }
  }
  for (const cle of await essais.lister('essai/')) {
    const reg = await essais.get(cle);
    if (!reg) continue;
    bilan.essais++;
    // Essais créés avant la statistique anonyme : trace ajoutée avant tout effacement.
    if (!(await essais.get(`stat/${reg.id}`))) await essais.set(`stat/${reg.id}`, statEssai(reg, testeurs));
    const etat = etatEssai(reg, aujourdhui);
    if (etat.efface) {
      await stockage.supprimer(cleDonneesEssai(secret, reg.produit, reg.id));
      if (reg.email) {
        const index = `email/${cleEmail(secret, reg.email)}/${reg.produit}`;
        if ((await essais.get(index))?.id === reg.id) await essais.supprimer(index);
      }
      await essais.supprimer(cle);
      bilan.effaces++;
      continue;
    }
    if (reg.stop || reg.achete || reg.paye || !envoyer) continue; // paye : vente notifiée par Gumroad (achats.mjs)
    const mails = { ...(reg.mails || {}) };
    const dus = [];
    if (!mails.merci && aujourdhui <= decalerJour(reg.debut, 1)) dus.push('merci');
    if (!mails['prise-en-main'] && aujourdhui >= decalerJour(reg.debut, 2) && aujourdhui <= decalerJour(reg.debut, 5)) dus.push('prise-en-main');
    if (!mails.rappel && aujourdhui >= decalerJour(reg.fin, -3) && aujourdhui <= reg.fin) dus.push('rappel');
    if (!mails.fin && etat.termine && aujourdhui <= decalerJour(reg.fin, 7)) dus.push('fin');
    if (!mails.effacement && aujourdhui >= decalerJour(reg.effacement, -7)) dus.push('effacement');
    // Un seul e-mail par jour et par essai, le plus récent dû (les autres sont marqués « sautés »).
    const type = dus.at(-1);
    if (!type) continue;
    try {
      await envoyerMail(type, reg, { secret, envoyer });
      for (const t of dus) mails[t] = t === type ? new Date(maintenant()).toISOString() : 'saute';
      bilan.envoyes[type] = (bilan.envoyes[type] || 0) + 1;
      await essais.set(cle, { ...reg, mails });
    } catch (x) {
      bilan.erreurs++;
      console.error(`E-mail « ${type} » impossible pour l'essai ${reg.id}`, x);
    }
  }
  return bilan;
}
