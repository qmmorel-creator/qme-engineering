// Signature e-mail de Quentin, variante C « Bandeau » validée le 21/11/2026.
// Le filet tricolore est une image : certaines messageries mobiles suppriment les cellules vides colorées (test du 21/11).
// HTML pour e-mail : tableaux, styles en ligne, images PNG absolues (assets/signature/, 3× la taille affichée),
// chacune avec un texte de remplacement. Le site reste lisible en texte quand les images sont bloquées.
// Utilisée par les e-mails de l'essai (essais.mjs) ; le même bloc se colle dans Gmail
// (docs/templates/communication/signature/).
const SITE = 'https://qm-engineering.fr';
const IMG = `${SITE}/assets/signature`;
const F = 'font-family:Arial,Helvetica,sans-serif';

export const RESEAUX = [
  ['instagram', 'Instagram', 'https://www.instagram.com/qmengineering/'],
  ['linkedin', 'LinkedIn', 'https://www.linkedin.com/company/qme-qm-engineering/'],
  ['tiktok', 'TikTok', 'https://www.tiktok.com/@qme.qm.engineering'],
  ['youtube', 'YouTube', 'https://www.youtube.com/channel/UCZTdaekWbJG8_RekBbaecvA'],
];

const icone = ([cle, nom, url]) => `<td style="padding-left:8px"><a href="${url}" title="${nom}" style="text-decoration:none"><img src="${IMG}/${cle}.png" width="20" height="20" alt="${nom}" style="display:block;border:0"></a></td>`;

export const SIGNATURE_HTML = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${F};width:380px;max-width:100%">
<tr>
<td style="padding:0 0 10px;vertical-align:middle"><div style="font-size:16px;font-weight:bold;color:#141414">Quentin Morel</div><div style="font-size:13px;color:#45413A;margin-top:2px">Outils sur mesure · templates</div></td>
<td style="padding:0 0 10px;vertical-align:middle;text-align:right"><a href="${SITE}" style="text-decoration:none"><img src="${IMG}/qme-logo.png" width="48" height="48" alt="QME" style="display:inline-block;border:0"></a></td>
</tr>
<tr><td colspan="2" style="padding:0;line-height:4px;font-size:0"><img src="${IMG}/filet.png" width="380" height="4" alt="" style="display:block;width:100%;max-width:380px;height:4px;border:0"></td></tr>
<tr>
<td style="padding:10px 0 0;font-size:13px;vertical-align:middle"><a href="${SITE}" style="color:#141414;font-weight:bold;text-decoration:none">qm-engineering.fr</a></td>
<td style="padding:10px 0 0;vertical-align:middle" align="right"><table cellpadding="0" cellspacing="0" border="0" align="right"><tr>${RESEAUX.map(icone).join('')}</tr></table></td>
</tr>
</table>`;
