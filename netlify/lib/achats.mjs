// E-mail de remerciement après un achat Gumroad (demande de Quentin, 21/11/2026).
//
// Gumroad prévient le site à chaque vente (« Ping », Gumroad → Settings → Advanced → Ping endpoint :
// https://qm-engineering.fr/api/achat). Le corps du ping n'est pas signé : la vente est donc vérifiée auprès de
// Gumroad avec sa clé de licence (verifierLicenceGumroad), et l'adresse utilisée est celle que Gumroad renvoie.
// Un ping inventé ne peut au pire que remercier un vrai acheteur, une seule fois.
//
// Deux e-mails, pour un template ou un pack :
//  - achat-essai : l'adresse de l'achat a un essai en cours ou terminé d'un template acheté. L'essai est marqué
//    « payé » : la séquence d'essai s'arrête dès le paiement. Les données restent reprises à la saisie de la clé
//    (reporterEssai, qui ne regarde que « achete », posé à ce moment-là) ;
//  - achat-direct : aucun essai ; premier pas du template quand il en a un (essais-prise-en-main.mjs).
// Une vente n'est traitée qu'une fois (achat/<empreinte de la clé>, sans adresse ni nom).
// Rien n'est envoyé pour un remboursement, une licence inconnue ou un produit qui n'est ni template ni pack.
//
// Accompagnement après achat (demande de Quentin, 24/11/2026), comme la « prise en main » de l'essai : un seul e-mail,
// SUIVI_ACHAT.jours jours après l'achat (rattrapage jusqu'à SUIVI_ACHAT.rattrapage jours de plus), envoyé par la tournée
// quotidienne (essais-quotidien.mjs → tournerSuivisAchat). Template : deux astuces et une aide au réglage ; pack : ses
// templates en une ligne chacun et par lequel commencer. File : suivi-achat/<empreinte de la clé> (adresse, prénom,
// produit, date d'achat, date prévue, date d'envoi). Après l'envoi, l'entrée reste SUIVI_ACHAT.conservation jours pour
// /admin/suivi/, puis elle est effacée ; non envoyée à la fin du rattrapage, effacée aussitôt. Rien pour une adresse sur
// la liste d'opposition.
import { createHmac } from 'node:crypto';
import { PRODUITS, PACKS, verifierLicenceGumroad, cleEmail, jourParis, decalerJour } from './templates-acces.mjs';
import { ficheEssai, corpsHtml, enveloppeHtml, SIGNATURE, SITE } from './essais.mjs';
import { PRISE_EN_MAIN } from './essais-prise-en-main.mjs';
import { ajouterAchat } from './comptes.mjs';
import { oppositionDe } from './preferences.mjs';
import { TEMPLATES } from '../../outils/packs/donnees.mjs';

export const SUIVI_ACHAT = { jours: 3, rattrapage: 4, conservation: 30 };

const CONNEXION = `${SITE}/connexion/`;
const json = (statut, corps) => new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json; charset=utf-8' } });
const dateFr = (jour) => new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).replace(/ 1 /, ' 1er ');
const cleAchat = (secret, licence) => `achat/${createHmac('sha256', secret).update(`achat:${String(licence).trim().toUpperCase()}`).digest('hex').slice(0, 32)}`;

// Produit Gumroad → template ou pack vendu.
export function produitVendu(idGumroad) {
  if (!idGumroad) return null;
  const t = Object.keys(PRODUITS).find((p) => PRODUITS[p].gumroad === idGumroad);
  if (t) return { type: 'template', code: t, nom: PRODUITS[t].nom, produits: [t] };
  const k = Object.keys(PACKS).find((p) => PACKS[p].gumroad === idGumroad);
  if (k) return { type: 'pack', code: k, nom: PACKS[k].nom, produits: PACKS[k].produits.filter((p) => PRODUITS[p]) };
  return null;
}

// Prénom : celui de l'essai, sinon le premier mot du nom saisi sur Gumroad (lettres seulement), sinon rien.
const prenomDe = (essai, nomComplet) => {
  if (essai?.prenom) return essai.prenom;
  const m = String(nomComplet || '').trim().split(/\s+/)[0] || '';
  return /^[\p{L}][\p{L}'-]{1,30}$/u.test(m) ? m.charAt(0).toUpperCase() + m.slice(1) : '';
};

export function contenuMailAchat({ vente, essais = [], prenom = '', aujourdhui }) {
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const nom = `« ${vente.nom} »`;
  const pack = vente.type === 'pack';
  let objet, texte;
  if (essais.length) {
    const e = essais[0], f = ficheEssai(e.produit);
    const ouvrir = `${f.app}?essai=${encodeURIComponent(e.code)}`;
    const termine = aujourdhui > e.fin;
    objet = pack ? `Merci : ${vente.nom} est à vous` : `Merci : ${nom} est à vous`;
    texte = `${bonjour}

Merci d'avoir acheté ${pack ? `le ${vente.nom}` : `le template ${nom}`} après ${pack ? `votre essai de « ${f.nom} »` : 'l\'avoir essayé'}. C'est un achat unique : ${pack ? 'les templates du pack sont' : 'il est'} à vous, sans abonnement, sur tous vos appareils.

Dernière étape pour retrouver votre essai : ouvrez ${pack ? `« ${f.nom} »` : 'le template'} (${ouvrir}), cliquez sur « J'ai acheté » dans le bandeau, puis collez la clé de licence reçue dans le reçu Gumroad (4 blocs de 8 caractères). Tout ce que vous avez saisi pendant l'essai est repris, rien à ressaisir.${termine ? ` Vos données d'essai sont gardées jusqu'au ${dateFr(e.effacement)} : faites-le avant cette date.` : ''}

Sur un autre appareil, ouvrez ${CONNEXION} et connectez-vous avec cette adresse e-mail : vos applications vous y attendent, sans recoller de clé.

Vous ne recevrez plus de rappel d'essai.

Qu'est-ce qui vous a décidé ? Une ligne en réponse m'aide beaucoup à améliorer les templates.

Merci encore,
${SIGNATURE}`;
  } else {
    const g = !pack && PRISE_EN_MAIN[vente.code];
    const liste = pack ? vente.produits.map((p) => `– ${PRODUITS[p].nom}`).join('\n') : '';
    objet = `Merci pour votre achat : ${vente.nom}`;
    texte = `${bonjour}

Merci d'avoir acheté ${pack ? `le ${vente.nom}` : `le template ${nom}`}. C'est un achat unique : ${pack ? 'les templates du pack sont' : 'il est'} à vous, sans abonnement, sur tous vos appareils.

Pour ${pack ? 'les ' : 'l\''}ouvrir : allez sur ${CONNEXION} et connectez-vous avec cette adresse e-mail (vous recevez un lien de connexion), ou collez la clé de licence reçue dans le reçu Gumroad (4 blocs de 8 caractères). ${pack ? 'Le tableau de bord du pack s\'ouvre, avec ses templates :' : 'Le template s\'ouvre ; sur vos autres appareils, la même clé retrouve les mêmes données.'}${pack ? `\n${liste}` : ''}
${g ? `
Pour démarrer, en quelques minutes : ${g.commencer}
` : ''}
Une question, un réglage qui ne colle pas à votre cas ? Répondez simplement à cet e-mail : c'est moi qui le lis, et les templates évoluent avec vos retours.

Merci encore,
${SIGNATURE}`;
  }
  const pied = '\n\n—\nVous recevez cet e-mail parce que vous avez acheté un template QME sur Gumroad.';
  return {
    type: essais.length ? 'achat-essai' : 'achat-direct', objet, texte: texte + pied,
    html: enveloppeHtml(`${corpsHtml(texte)}<p style="margin:24px 0 0;font-size:12px;color:#6b6660">Vous recevez cet e-mail parce que vous avez acheté un template QME sur Gumroad.</p>`),
  };
}

// POST /api/achat (ping Gumroad, application/x-www-form-urlencoded). Répond toujours 200, sauf échec d'envoi
// (500 : Gumroad renvoie alors le ping, et la vente n'est pas marquée traitée).
export async function traiterAchat(requete, { secret, essais, envoyer = null, notifier = '', maintenant = Date.now, verifierLicence = verifierLicenceGumroad }) {
  if (requete.method !== 'POST') return json(405, { erreur: 'POST attendu' });
  if (!secret || !essais) return json(503, { erreur: 'Service non configuré' });
  const f = new URLSearchParams(await requete.text());
  const vente = produitVendu(f.get('product_id'));
  const licence = f.get('license_key');
  if (!vente || !licence) return json(200, { ok: true, ignore: 'produit ou licence absent' });
  const cle = cleAchat(secret, licence);
  if (await essais.get(cle)) return json(200, { ok: true, deja: true });
  const produitGumroad = vente.type === 'pack' ? PACKS[vente.code].gumroad : PRODUITS[vente.code].gumroad;
  const v = await verifierLicence(produitGumroad, licence);
  if (!v.ok || !v.achat?.email) return json(200, { ok: true, ignore: v.raison || 'adresse absente' });
  const email = v.achat.email;
  const aujourdhui = jourParis(new Date(maintenant()));
  const date = new Date(maintenant()).toISOString();

  // Essais de cette adresse sur les templates achetés, encore conservés et pas déjà achetés.
  const trouves = [];
  for (const p of vente.produits) {
    const ref = await essais.get(`email/${cleEmail(secret, email)}/${p}`);
    const reg = ref?.id ? await essais.get(`essai/${ref.id}`) : null;
    if (reg && !reg.achete && aujourdhui <= reg.effacement) trouves.push(reg);
  }
  const m = contenuMailAchat({ vente, essais: trouves, prenom: prenomDe(trouves[0], f.get('full_name')), aujourdhui });
  if (envoyer) {
    try { await envoyer({ a: email, objet: m.objet, texte: m.texte, html: m.html }); } catch (x) {
      console.error('E-mail d\'achat impossible', x);
      return json(500, { erreur: 'Envoi impossible' });
    }
  }
  for (const reg of trouves) await essais.set(`essai/${reg.id}`, { ...reg, paye: date });
  // Accompagnement J+3 (tournerSuivisAchat). Un échec n'empêche jamais le ping.
  if (envoyer) {
    try { await essais.set(`suivi-${cle}`, { email, prenom: prenomDe(trouves[0], f.get('full_name')), type: vente.type, code: vente.code, achat: aujourdhui, du: decalerJour(aujourdhui, SUIVI_ACHAT.jours) }); }
    catch (x) { console.error('Mise en file de l\'accompagnement impossible', x); }
  }
  // Compte acheteur (comptes.mjs) : la licence rejoint le compte de cette adresse. Un échec n'empêche jamais le ping.
  try { await ajouterAchat({ secret, store: essais, email, vente, licence, nomComplet: f.get('full_name'), maintenant }); } catch (x) { console.error('Ajout au compte impossible', x); }
  await essais.set(cle, { produit: vente.code, date, mail: envoyer ? m.type : null, essai: trouves.map((r) => r.id) });
  if (envoyer && notifier) {
    await envoyer({ a: notifier, objet: `Nouvelle vente : ${vente.nom} · ${trouves.length ? 'après essai' : 'directe'}`,
      texte: `Vente notifiée par Gumroad.\n\nProduit : ${vente.nom}\nAcheteur : ${email}\n${trouves.length ? `Essai : ${trouves.map((r) => `${PRODUITS[r.produit].nom} (début ${r.debut})`).join(', ')} · séquence d'essai arrêtée` : 'Sans essai'}\nE-mail de remerciement : ${m.objet}\n\nAccompagnement prévu le ${dateFr(decalerJour(aujourdhui, SUIVI_ACHAT.jours))}.\n\nTous les essais : ${SITE}/admin/essais/`, copieCachee: false })
      .catch((x) => console.error('Notification de vente impossible', x));
  }
  return json(200, { ok: true, mail: m.type, essais: trouves.length });
}


// E-mail d'accompagnement, quelques jours après l'achat (un seul, sans relance).
export function contenuMailSuivi({ type, code, prenom = '', achat }) {
  const pack = type === 'pack';
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  let objet, texte;
  if (pack) {
    const p = PACKS[code];
    const produits = p.produits.filter((c) => PRODUITS[c]);
    const premier = produits.find((c) => PRISE_EN_MAIN[c]) || produits[0];
    const g = PRISE_EN_MAIN[premier];
    const liste = produits.map((c) => `– ${PRODUITS[c].nom}${TEMPLATES[c]?.phrase ? ` : ${TEMPLATES[c].phrase}` : ''}`).join('\n');
    objet = `Par où continuer avec le ${p.nom}`;
    texte = `${bonjour}

Vous avez acheté le ${p.nom} le ${dateFr(achat)}. ${produits.length} templates d'un coup, c'est beaucoup à découvrir : voici comment en tirer parti sans tout ouvrir le même jour.

Ce que contient votre pack :
${liste}

Si vous ne savez pas par lequel commencer, prenez « ${PRODUITS[premier].nom} ».${g ? ` Pour démarrer, en quelques minutes : ${g.commencer}` : ''}

Tous les templates du pack s'ouvrent depuis ${CONNEXION}, avec cette adresse e-mail : un seul compte, sur tous vos appareils.

Un template du pack ne colle pas tout à fait à votre façon de faire ? Répondez simplement à cet e-mail : je regarde avec vous comment le régler.

${SIGNATURE}`;
  } else {
    const nom = `« ${PRODUITS[code].nom} »`;
    const g = PRISE_EN_MAIN[code];
    objet = `${PRODUITS[code].nom} : tout se passe bien ?`;
    texte = `${bonjour}

Vous avez acheté le template ${nom} le ${dateFr(achat)}. Je reviens vers vous pour vérifier que tout fonctionne${g ? ', et vous montrer deux choses utiles' : ''}.
${g ? `
Deux fonctions qu'on ne remarque pas toujours au premier coup d'œil :
– ${g.astuces[0]}
– ${g.astuces[1]}
` : ''}
Sur un autre appareil, ouvrez ${CONNEXION} et connectez-vous avec cette adresse e-mail : vos données vous y attendent.

${g ? g.aide : 'Un réglage ne colle pas à votre façon de faire ?'} Répondez simplement à cet e-mail : je regarde avec vous comment le régler.

Et si le template vous rend service, une ligne pour me dire ce qui vous plaît, ou ce qui manque, m'aide beaucoup à le faire évoluer.

${SIGNATURE}`;
  }
  const pied = 'Vous recevez cet e-mail parce que vous avez acheté un template QME sur Gumroad. C\'est le seul e-mail de suivi après votre achat.';
  return { objet, texte: `${texte}\n\n—\n${pied}`, html: enveloppeHtml(`${corpsHtml(texte)}<p style="margin:24px 0 0;font-size:12px;color:#6b6660">${pied}</p>`) };
}

// Tournée quotidienne : envoie les accompagnements dus, purge la file. Renvoie { envoyes, expires, opposition, purges, erreurs }.
export async function tournerSuivisAchat({ secret, essais, envoyer = null, maintenant = Date.now }) {
  const aujourdhui = jourParis(new Date(maintenant()));
  const bilan = { envoyes: 0, expires: 0, opposition: 0, purges: 0, erreurs: 0 };
  for (const cle of await essais.lister('suivi-achat/')) {
    const s = await essais.get(cle);
    if (s?.envoye) {
      if (aujourdhui > decalerJour(jourParis(new Date(s.envoye)), SUIVI_ACHAT.conservation)) { await essais.supprimer(cle); bilan.purges++; }
      continue;
    }
    const connu = s && (s.type === 'pack' ? PACKS[s.code] : PRODUITS[s.code]);
    if (!connu || aujourdhui > decalerJour(s.du, SUIVI_ACHAT.rattrapage)) { await essais.supprimer(cle); bilan.expires++; continue; }
    if (aujourdhui < s.du || !envoyer) continue;
    if (await oppositionDe(essais, secret, s.email)) { await essais.supprimer(cle); bilan.opposition++; continue; }
    const m = contenuMailSuivi(s);
    try {
      await envoyer({ a: s.email, objet: m.objet, texte: m.texte, html: m.html });
      await essais.set(cle, { ...s, envoye: new Date(maintenant()).toISOString(), objet: m.objet });
      bilan.envoyes++;
    } catch (x) {
      bilan.erreurs++; // nouvel essai le lendemain, jusqu'à la fin du rattrapage
      console.error('E-mail d\'accompagnement impossible', x);
    }
  }
  return bilan;
}
