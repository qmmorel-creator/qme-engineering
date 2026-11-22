// Annonce « Il y a du nouveau » du 22/11/2026 (demande de Quentin) : comptes acheteurs (connexion par e-mail),
// espace « Mes applications » personnalisé, retour rapide depuis chaque application.
// Deux publics, deux pieds de message :
//  - testeurs inscrits aux nouveautés (case facultative du formulaire d'essai, contact/<empreinte>) ;
//  - acheteurs (compte avec un achat) : information sur le service acheté.
// Un seul lien en pied, « Ne plus recevoir les informations » (/api/compte/stop) : liste d'opposition (preferences.mjs).
// Les testeurs qui n'ont pas coché la case ne reçoivent rien : ils n'ont consenti qu'aux e-mails de leur essai.
// Envoi : POST /api/compte/annonce (comptes.mjs), images servies par le site (assets/mail/nouveautes-2026-11/).
import { SIGNATURE, SITE } from './essais.mjs';
import { SIGNATURE_HTML } from './signature.mjs';

export const CAMPAGNE = 'nouveautes-2026-11';
const IMG = `${SITE}/assets/mail/${CAMPAGNE}`;
const lien = (chemin) => `${SITE}${chemin}${chemin.includes('?') ? '&' : '?'}utm_source=email&utm_medium=annonce&utm_campaign=${CAMPAGNE}`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const BLOCS = [
  { image: 'espace.jpg', titre: 'Votre espace « Mes applications »',
    texte: 'Une fois acheté, un template devient une application. Elles sont toutes réunies sur une même page : recherche instantanée, rangement par thème, applications épinglées et récemment ouvertes. Un badge indique ce qui est acheté et ce qui est en essai, avec les jours restants.' },
  { image: 'connexion.jpg', titre: 'Connectez-vous avec votre adresse e-mail',
    texte: 'Plus besoin de recoller votre clé de licence sur chaque appareil : saisissez votre adresse, vous recevez un lien, et toutes vos applications vous attendent, sur votre téléphone comme sur votre ordinateur. Sans mot de passe. Vos prochains achats y sont rangés automatiquement.' },
  { image: 'panneau.jpg', titre: 'Passez d’une application à l’autre',
    texte: 'Dans chaque application, touchez le logo QME en haut à gauche : la liste de vos autres applications s’ouvre, et vous changez en un geste.' },
  { image: 'personnaliser.jpg', titre: 'Un espace à votre main',
    texte: 'Bouton « Personnaliser » : donnez à chaque application le nom qui vous parle (« Budget maison »), masquez celles que vous n’utilisez plus, choisissez l’ordre de vos favorites. Vos réglages vous suivent sur tous vos appareils.' },
];

// type : 'acheteur' ou 'testeur' ; stop : lien de désinscription propre au destinataire.
export function contenuAnnonce({ type, prenom = '', stop }) {
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const intro = type === 'acheteur'
    ? 'Votre espace QME change, et je voulais vous montrer ce que ça vous apporte, en une minute.'
    : 'Vous avez essayé un template QME et souhaité recevoir les nouveautés : en voici une de taille, en une minute.';
  const cta = lien('/connexion/');
  const objet = 'Il y a du nouveau : vos applications QME vous suivent partout';
  const pied = type === 'acheteur'
    ? 'Vous recevez cet e-mail parce que vous avez acheté un template QME : il présente les nouveautés du service que vous utilisez.'
    : 'Vous recevez cet e-mail parce que vous avez demandé à recevoir les nouveautés QME lors d’un essai gratuit.';
  const libelleStop = 'Ne plus recevoir les informations';

  const texte = `${bonjour}

${intro}

${BLOCS.map((b) => `${b.titre}\n${b.texte}`).join('\n\n')}

Pour en profiter : ouvrez ${cta} et connectez-vous avec cette adresse e-mail.

Une idée, un réglage qui vous manque ? Répondez simplement à cet e-mail : c'est moi qui le lis.

${SIGNATURE}

—
${pied}
${libelleStop} : ${stop}`;

  const bloc = (b, i) => `<tr><td style="padding:${i ? 28 : 8}px 0 0">
      <img src="${IMG}/${b.image}" width="560" alt="${esc(b.titre)}" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:14px">
      <h2 style="margin:16px 0 6px;font:700 19px/1.3 Arial,Helvetica,sans-serif;color:#141414">${insec(b.titre)}</h2>
      <p style="margin:0;font:15px/1.55 Arial,Helvetica,sans-serif;color:#3d3a35">${insec(b.texte)}</p>
    </td></tr>`;
  // Guillemets français : espaces insécables, pour qu'un guillemet ne finisse jamais seul en bout de ligne.
  const insec = (x) => esc(x).replace(/« /g, '«&nbsp;').replace(/ »/g, '&nbsp;»').replace(/ ([:;?!])/g, '&nbsp;$1');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(objet)}</title></head>
<body style="margin:0;padding:0;background:#FBF7F1">
<div style="display:none;max-height:0;overflow:hidden">Connexion par e-mail, espace personnalisé, retour rapide entre vos applications.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF7F1"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px">
  <tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="33%" height="10" style="background:#D9302A;border-radius:18px 0 0 0;font-size:0;line-height:0">&nbsp;</td>
    <td width="34%" height="10" style="background:#F5B400;font-size:0;line-height:0">&nbsp;</td>
    <td width="33%" height="10" style="background:#1D4E89;border-radius:0 18px 0 0;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>
  <tr><td style="padding:28px 20px 8px">
    <p style="margin:0 0 6px;font:700 12px/1.3 Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6b6660">Il y a du nouveau</p>
    <h1 style="margin:0 0 16px;font:700 26px/1.2 Arial,Helvetica,sans-serif;color:#141414">Vos applications QME vous suivent partout</h1>
    <p style="margin:0 0 10px;font:15px/1.55 Arial,Helvetica,sans-serif;color:#141414">${esc(bonjour)}</p>
    <p style="margin:0;font:15px/1.55 Arial,Helvetica,sans-serif;color:#141414">${insec(intro)}</p>
  </td></tr>
  <tr><td style="padding:0 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${BLOCS.map(bloc).join('')}</table></td></tr>
  <tr><td align="center" style="padding:32px 20px 8px">
    <a href="${cta}" style="display:inline-block;background:#141414;color:#FBF7F1;font:700 16px/1 Arial,Helvetica,sans-serif;text-decoration:none;padding:16px 28px;border-radius:999px">Ouvrir mon espace</a>
    <p style="margin:12px 0 0;font:13px/1.5 Arial,Helvetica,sans-serif;color:#6b6660">Connectez-vous avec cette adresse e-mail : un lien vous est envoyé.</p>
  </td></tr>
  <tr><td style="padding:24px 20px 8px">
    <p style="margin:0 0 14px;font:15px/1.55 Arial,Helvetica,sans-serif;color:#141414">Une idée, un réglage qui vous manque ? Répondez simplement à cet e-mail : c’est moi qui le lis.</p>
    ${SIGNATURE_HTML}
  </td></tr>
  <tr><td style="padding:20px 20px 24px"><p style="margin:0;font:12px/1.5 Arial,Helvetica,sans-serif;color:#6b6660">${esc(pied)} <a href="${esc(stop)}" style="color:#6b6660">${libelleStop}</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
  return { objet, texte, html };
}
