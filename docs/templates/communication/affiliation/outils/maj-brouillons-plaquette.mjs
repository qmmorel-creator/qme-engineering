// Transforme un brouillon d'affiliation (JSON de get_draft FULL_CONTENT) en nouveau brouillon conforme :
// liens directs (sans redirection Google), lien de la plaquette qm-engineering.fr/partenariat/,
// signature graphique « Bandeau », mention d'opposition avec lien personnel. Texte du mail inchangé sinon.
// Usage : node transformer.mjs <brouillon.json> > nouveau.json
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const sig = JSON.parse(execFileSync('node', ['docs/templates/communication/signature/brouillon-gmail.mjs', '--json'], { cwd: '/home/user/qme-engineering' }));
const dest = d.toRecipients[0];
const enc = encodeURIComponent(dest);
let h = d.htmlBody;

// 1. Liens directs : https://www.google.com/url?q=<url encodée>&amp;source=...  → <url>
h = h.replace(/https:\/\/www\.google\.com\/url\?q=([^"&]+)(?:&amp;[^"]*)?/g, (_, q) => decodeURIComponent(q).replace(/&/g, '&amp;'));
if (h.includes('google.com/url')) throw new Error('redirection restante');

// 2. Paragraphe de la plaquette, avant l'appel à répondre (créateurs) ou la question (agences)
const plaquette = '<p>Tout le fonctionnement du partenariat tient en une page : <a href="https://qm-engineering.fr/partenariat/" style="color:#1a4fd6">qm-engineering.fr/partenariat</a>.</p>';
const ancres = ['<p>Si l&#39;idée vous intéresse', '<p>Auriez-vous', '<p style="font-size:12px;color:#666">'];
const a = ancres.find((x) => h.includes(x));
if (!a) throw new Error('ancre introuvable');
h = h.replace(a, plaquette + a);

// 3. Ancienne mention « stop » et ancienne signature texte → salutation, signature Bandeau, mention d'opposition
const debutStop = h.indexOf('<p style="font-size:12px;color:#666">');
if (debutStop < 0) throw new Error('mention stop introuvable');
const fin = h.lastIndexOf('</div>');
const queue = h.slice(debutStop, fin);
const salut = /<p>(Bonne journée|Belle journée|Bien à vous|Cordialement)[^<]*,?<br>/.exec(queue);
if (!salut) throw new Error('salutation introuvable');
const formule = salut[1];
h = h.slice(0, debutStop) + `<p>${formule},<br>Quentin</p></div>\n${sig.html}\n<p style="margin:24px 0 0;font-size:12px;color:#6b6660">Vous ne souhaitez plus recevoir d'informations de QME&nbsp;? <a href="https://qm-engineering.fr/ne-plus-recevoir/?email=${enc}" style="color:#6b6660">Ne plus recevoir les informations</a> (ou répondez simplement «&nbsp;stop&nbsp;»).</p>`;

// 4. Version texte brut, dérivée du HTML du corps
const corps = h.slice(0, h.indexOf(sig.html));
const texte = corps
  .replace(/<li[^>]*>/g, '- ').replace(/<\/li>/g, '\n').replace(/<\/ul>/g, '\n')
  .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, (_, u, t) => `${t} (${u.replace(/&amp;/g, '&')})`)
  .replace(/<br>/g, '\n').replace(/<\/p>/g, '\n\n').replace(/<[^>]+>/g, '')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  + `\n\nQuentin Morel\nQME · Quentin Morel Engineering\nqm-engineering.fr\n\nNe plus recevoir les informations : https://qm-engineering.fr/ne-plus-recevoir/?email=${enc} (ou répondez simplement « stop »).`;

process.stdout.write(JSON.stringify({ to: [dest], subject: d.subject, htmlBody: h, body: texte, attachments: sig.attachments }));
