// Envoi des e-mails du site (essai, achat, connexion, annonces) par le SMTP d'OVH, boîte quentin.morel@qm-engineering.fr
// (depuis le 23/11/2026 ; avant, par le Gmail de Quentin). Passer par OVH aligne SPF, DKIM (ovhmo-selector-1) et DMARC
// sur qm-engineering.fr : voir docs/templates/communication/DELIVRABILITE.md.
//
// Variables Netlify (jamais dans le dépôt) :
//  - ESSAI_SMTP_UTILISATEUR : identifiant de la boîte OVH (quentin.morel@qm-engineering.fr) ;
//  - ESSAI_SMTP_MOT_DE_PASSE : mot de passe de cette boîte OVH ;
//  - ESSAI_EXPEDITEUR : nom affiché puis l'adresse de la boîte entre chevrons (quentin.morel@qm-engineering.fr) ;
//  - ESSAI_SMTP_HOTE / ESSAI_SMTP_PORT : ssl0.ovh.net et 465 par défaut.
// Sans identifiant ni mot de passe, aucun e-mail ne part (l'essai fonctionne quand même) : renvoie null.
// Ces e-mails n'apparaissent pas dans « Messages envoyés » de Gmail ; les réponses arrivent sur la boîte OVH, redirigée
// vers le Gmail de Quentin. Une variable modifiée sur Netlify ne s'applique qu'au déploiement suivant.
//
// Copie cachée (règle de Quentin, 24/11/2026) : tout e-mail des séquences automatiques (essai, achat, accompagnement
// après achat) part avec Quentin en copie cachée, sur son adresse pro, pour garder la trace de ce qui sort par OVH.
// Adresse : ESSAI_COPIE_CACHEE (« non » pour couper), quentin.morel@qm-engineering.fr par défaut. Pas de copie pour
// un envoi marqué `copieCachee: false` : codes et liens de connexion (ils ouvrent le compte d'un client), notifications
// adressées à Quentin, annonces envoyées en nombre ; ni quand le destinataire est déjà l'adresse de copie.
import nodemailer from 'nodemailer';

export const COPIE_CACHEE = 'quentin.morel@qm-engineering.fr';

// Options de nodemailer pour un envoi (sans le transport) : expéditeur, réponse, destinataire, copie cachée.
export function optionsEnvoi({ a, objet, texte, html, copieCachee = true }, { de, env = process.env }) {
  const copie = String(env.ESSAI_COPIE_CACHEE ?? COPIE_CACHEE).trim();
  const avecCopie = copieCachee && copie && copie.toLowerCase() !== 'non' && copie.toLowerCase() !== String(a || '').trim().toLowerCase();
  return { from: de, replyTo: de, to: a, ...(avecCopie ? { bcc: copie } : {}), subject: objet, text: texte, html };
}

export function envoyeurDepuisEnv(env = process.env) {
  const utilisateur = env.ESSAI_SMTP_UTILISATEUR, motDePasse = env.ESSAI_SMTP_MOT_DE_PASSE;
  if (!utilisateur || !motDePasse) return null;
  const port = Number(env.ESSAI_SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: env.ESSAI_SMTP_HOTE || 'ssl0.ovh.net', port, secure: port === 465,
    auth: { user: utilisateur, pass: motDePasse.replace(/\s+/g, '') },
  });
  const de = env.ESSAI_EXPEDITEUR || utilisateur;
  return async (message) => {
    await transport.sendMail(optionsEnvoi(message, { de, env }));
  };
}
