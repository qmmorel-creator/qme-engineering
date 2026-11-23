// Envoi des e-mails du site (essai, achat, connexion, annonces) par le SMTP d'OVH, boîte quentin.morel@qm-engineering.fr
// (depuis le 23/11/2026 ; avant, par le Gmail de Quentin). Passer par OVH aligne SPF, DKIM (ovhmo-selector-1) et DMARC
// sur qm-engineering.fr : voir docs/templates/communication/DELIVRABILITE.md.
//
// Variables Netlify (jamais dans le dépôt) :
//  - ESSAI_SMTP_UTILISATEUR : identifiant de la boîte OVH (quentin.morel@qm-engineering.fr) ;
//  - ESSAI_SMTP_MOT_DE_PASSE : mot de passe de cette boîte OVH ;
//  - ESSAI_EXPEDITEUR : « Quentin MOREL <quentin.morel@qm-engineering.fr> » (même adresse que la boîte) ;
//  - ESSAI_SMTP_HOTE / ESSAI_SMTP_PORT : ssl0.ovh.net et 465 par défaut.
// Sans identifiant ni mot de passe, aucun e-mail ne part (l'essai fonctionne quand même) : renvoie null.
// Ces e-mails n'apparaissent pas dans « Messages envoyés » de Gmail ; les réponses arrivent sur la boîte OVH, redirigée
// vers le Gmail de Quentin. Une variable modifiée sur Netlify ne s'applique qu'au déploiement suivant.
import nodemailer from 'nodemailer';

export function envoyeurDepuisEnv(env = process.env) {
  const utilisateur = env.ESSAI_SMTP_UTILISATEUR, motDePasse = env.ESSAI_SMTP_MOT_DE_PASSE;
  if (!utilisateur || !motDePasse) return null;
  const port = Number(env.ESSAI_SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: env.ESSAI_SMTP_HOTE || 'ssl0.ovh.net', port, secure: port === 465,
    auth: { user: utilisateur, pass: motDePasse.replace(/\s+/g, '') },
  });
  const de = env.ESSAI_EXPEDITEUR || utilisateur;
  return async ({ a, objet, texte, html }) => {
    await transport.sendMail({ from: de, replyTo: de, to: a, subject: objet, text: texte, html });
  };
}
