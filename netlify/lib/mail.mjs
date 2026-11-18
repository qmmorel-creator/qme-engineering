// Envoi des e-mails d'essai depuis la boîte de Quentin (SMTP authentifié : Gmail par défaut).
//
// Variables Netlify (jamais dans le dépôt) :
//  - ESSAI_SMTP_UTILISATEUR : identifiant de la boîte d'envoi (l'adresse Gmail de Quentin) ;
//  - ESSAI_SMTP_MOT_DE_PASSE : mot de passe d'application Google (16 caractères, compte avec validation en deux étapes) ;
//  - ESSAI_EXPEDITEUR : « Quentin Morel <quentin.morel@qm-engineering.fr> » (adresse « Envoyer en tant que » de la boîte) ;
//  - ESSAI_SMTP_HOTE / ESSAI_SMTP_PORT : facultatifs, smtp.gmail.com et 465 par défaut.
// Sans identifiant ni mot de passe, aucun e-mail ne part (l'essai fonctionne quand même) : renvoie null.
// Les e-mails envoyés par Gmail en SMTP apparaissent dans « Messages envoyés » ; les réponses arrivent dans la boîte.
import nodemailer from 'nodemailer';

export function envoyeurDepuisEnv(env = process.env) {
  const utilisateur = env.ESSAI_SMTP_UTILISATEUR, motDePasse = env.ESSAI_SMTP_MOT_DE_PASSE;
  if (!utilisateur || !motDePasse) return null;
  const port = Number(env.ESSAI_SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: env.ESSAI_SMTP_HOTE || 'smtp.gmail.com', port, secure: port === 465,
    auth: { user: utilisateur, pass: motDePasse.replace(/\s+/g, '') },
  });
  const de = env.ESSAI_EXPEDITEUR || utilisateur;
  return async ({ a, objet, texte, html }) => {
    await transport.sendMail({ from: de, replyTo: de, to: a, subject: objet, text: texte, html });
  };
}
