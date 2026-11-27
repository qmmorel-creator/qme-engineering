// Générateur des relances de prospection sur mesure (brouillons Gmail dans le fil d'origine).
// Reconstruit le 27/11/2026 à partir des scripts de session utilisés du 02 au 24/11/2026 (build.py modes A et B).
//
// Deux modes :
//  - B : première relance, avec un paragraphe propre au prospect (« Pour être plus concret : … ») ;
//  - A : dernière relance, courte, qui clôt poliment.
// Chaque mail porte la signature graphique « Bandeau » (version HTML, images cid:att0 à att5 jointes) et, en dernier
// paragraphe, la mention d'opposition personnelle (docs/templates/communication/REGLES-PROSPECTION.md § 2).
//
// Usage (depuis la racine du dépôt) :
//   node docs/prospection/relances/relance.mjs entrees.json > brouillons.json
// entrees.json : liste de { email, cc?, objet, vague, premierMail: "AAAA-MM-JJ", mode: "A"|"B", lang?: "fr"|"en",
//                           paragraphe? (mode B, sans « Pour être plus concret : »), threadId?, replyToMessageId? }
// Sortie : liste de { email, to, cc, subject, body, htmlBody, attachments, threadId, replyToMessageId } prête pour
// create_draft (attachments = les six images de la signature, à transmettre telles quelles).
//
// Avant tout envoi : exclure docs/prospection/desinscrits.md, les fiches Nexora « oppose » ou « perdu », et vérifier la
// liste d'opposition (GET /api/compte/opposition). Rien ne part sans le feu vert de Quentin.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SIGNATURE_HTML } from '../../../netlify/lib/signature.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const IMAGES = ['qme-logo', 'filet', 'instagram', 'linkedin', 'tiktok', 'youtube'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PS = '<p style="margin:0 0 12px">';
const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function signatureCid() {
  let html = SIGNATURE_HTML.replace(/\n/g, '');
  IMAGES.forEach((nom, i) => { html = html.replace(`https://qm-engineering.fr/assets/signature/${nom}.png`, `cid:att${i}`); });
  if (/https:\/\/qm-engineering\.fr\/assets\/signature\//.test(html)) throw new Error('Image de signature non convertie en cid');
  const attachments = IMAGES.map((nom) => {
    const chemin = resolve(RACINE, 'assets/signature', `${nom}.png`);
    const sha = createHash('sha256').update(readFileSync(chemin)).digest('hex');
    return { content: `sha256:${sha}:${chemin}`, filename: `${nom}.png`, mimeType: 'image/png', inline: true };
  });
  return { html, attachments };
}

export const lienOpposition = (email, en = false) =>
  `https://qm-engineering.fr/ne-plus-recevoir/?${en ? 'lang=en&' : ''}email=${encodeURIComponent(String(email).trim())}`;

export function mention(email, en = false) {
  const l = lienOpposition(email, en);
  if (en) return {
    texte: `—\nDon't want to hear from QME again? Stop receiving information: ${l} (or just reply "stop").`,
    html: `<p style="margin:24px 0 0;font:12px/1.5 Arial,Helvetica,sans-serif;color:#6b6660">Don't want to hear from QME again? <a href="${echapper(l)}" style="color:#6b6660">Stop receiving information</a> (or just reply "stop").</p>`,
  };
  return {
    texte: `—\nVous ne souhaitez plus recevoir d'informations de QME ? Ne plus recevoir les informations : ${l} (ou répondez simplement « stop »).`,
    html: `<p style="margin:24px 0 0;font:12px/1.5 Arial,Helvetica,sans-serif;color:#6b6660">Vous ne souhaitez plus recevoir d’informations de QME&nbsp;? <a href="${echapper(l)}" style="color:#6b6660">Ne plus recevoir les informations</a> (ou répondez simplement «&nbsp;stop&nbsp;»).</p>`,
  };
}

export function dateLongue(iso, en = false) {
  const [, m, j] = iso.split('-').map(Number);
  return en ? `${j} ${MONTHS[m - 1]}` : `${j === 1 ? '1er' : j} ${MOIS[m - 1]}`;
}

const SIG_TEXTE = 'Quentin Morel\nQME · Quentin Morel Engineering\nquentin.morel@qm-engineering.fr · https://qm-engineering.fr';

function paragraphes(e) {
  const en = e.lang === 'en', date = dateLongue(e.premierMail, en);
  const mode = e.mode === 'B' ? 'B' : 'A';
  const url = `https://qm-engineering.fr/?utm_campaign=${mode === 'A' ? 'derniere-relance' : 'relance'}-v${e.vague}#documents`;
  if (mode === 'A') return en ? {
    bonjour: 'Hello,', fin: 'Best regards,', url,
    p: [`I'm sending one last message about my proposal of ${date}. If it isn't relevant for you right now, that's completely fine: I won't follow up again.`,
      ['Should the topic come up one day, my brochure and examples of tools are still available here: ', url],
      'I wish you a great end of the year.'],
  } : {
    bonjour: 'Bonjour,', fin: 'Bien cordialement,', url,
    p: [`Je me permets un dernier message au sujet de ma proposition du ${date}. Si le sujet n'est pas d'actualité pour vous, c'est tout à fait compris : je ne vous relancerai plus.`,
      ['Si la question revient un jour, ma plaquette et des exemples d\'outils restent disponibles ici : ', url],
      'Je vous souhaite une bonne fin d\'année.'],
  };
  if (!e.paragraphe) throw new Error(`Mode B sans paragraphe pour ${e.email}`);
  return en ? {
    bonjour: 'Hi,', fin: 'Best regards,', url,
    p: [`I'm following up on my message of ${date}, in case it slipped through.`, `To be more concrete: ${e.paragraphe.trim()}`,
      'I can also prepare, with no commitment, a short mock-up of what this tool would look like for you, as I have just done for other organisations that replied to me.',
      ['If this sounds useful, 30 minutes by video call or phone would be enough to talk it through. My brochure and examples of tools are here: ', url],
      'If now is not the right time, just let me know and I won\'t follow up again.'],
  } : {
    bonjour: 'Bonjour,', fin: 'Bien cordialement,', url,
    p: [`Je reviens vers vous au sujet de mon message du ${date}, au cas où il serait passé inaperçu.`, `Pour être plus concret : ${e.paragraphe.trim()}`,
      'Je peux aussi vous préparer, sans engagement, une courte maquette de ce que donnerait cet outil chez vous, comme je viens de le faire pour d\'autres entreprises qui m\'ont répondu.',
      ['Si cela vous parle, 30 minutes en visio ou au téléphone suffisent pour en parler. Ma plaquette et des exemples d\'outils sont ici : ', url],
      'Si ce n\'est pas le moment, dites-le-moi simplement : je ne vous relancerai plus.'],
  };
}

export function construire(e, sig = signatureCid()) {
  if (!e.email || !e.objet || !e.vague || !/^\d{4}-\d{2}-\d{2}$/.test(e.premierMail || '')) throw new Error(`Entrée incomplète : ${JSON.stringify(e)}`);
  const en = e.lang === 'en', t = paragraphes(e), m = mention(e.email, en);
  const texte = t.p.map((x) => (Array.isArray(x) ? x[0] + x[1] : x));
  const html = t.p.map((x) => (Array.isArray(x)
    ? `${PS}${echapper(x[0])}<a href="${echapper(x[1])}">qm-engineering.fr/#documents</a></p>`
    : `${PS}${echapper(x)}</p>`)).join('');
  const objet = String(e.objet).replace(/^(re|RE|Re)\s*:\s*/, '');
  return {
    email: e.email, to: [e.email], cc: e.cc ? [].concat(e.cc) : [],
    subject: `Re: ${objet}`,
    body: [t.bonjour, ...texte, t.fin, SIG_TEXTE, m.texte].join('\n\n'),
    htmlBody: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${PS}${t.bonjour}</p>${html}${PS}${t.fin}</p>${sig.html}${m.html}</div>`,
    attachments: sig.attachments,
    threadId: e.threadId || null, replyToMessageId: e.replyToMessageId || null,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fichier = process.argv[2];
  if (!fichier) { console.error('Usage : node docs/prospection/relances/relance.mjs entrees.json > brouillons.json'); process.exit(1); }
  const sig = signatureCid();
  const sortie = JSON.parse(readFileSync(fichier, 'utf8')).map((e) => construire(e, sig));
  process.stdout.write(JSON.stringify(sortie, null, 1) + '\n');
}
