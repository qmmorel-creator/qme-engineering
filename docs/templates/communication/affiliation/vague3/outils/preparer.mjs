// Prépare la file du bloc 1 : ordre, id Nexora, brouillon conforme par créateur (out/<id>.json).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { construire } from '../brouillon.mjs';
const V = '/tmp/claude-0/-home-user-qme-engineering/398edc15-27ed-5f53-ab37-06c82a4aa80b/scratchpad/vague3';
const sig = JSON.parse(execFileSync('node', ['docs/templates/communication/signature/brouillon-gmail.mjs', '--json'], { cwd: '/home/user/qme-engineering' }));
const [debut, ...lots] = process.argv.slice(2); // ordre de départ, puis lots "fichier:Segment"
const listes = lots.map((l) => { const [f, seg] = l.split(':'); return { f, seg, a: JSON.parse(readFileSync(`${V}/${f}.json`, 'utf8')) }; });
const ech = JSON.parse(readFileSync(`${V}/echantillon/drafts.json`, 'utf8'));
const vus = new Set(); const file = []; let ordre = +debut;
mkdirSync(`${V}/file/out`, { recursive: true });
for (let k = 0; listes.some((L) => k < L.a.length); k++) {
  for (const L of listes) {
    const c = L.a[k]; if (!c) continue;
    const em = c.email.trim().toLowerCase();
    if (vus.has(em)) { console.error('doublon', em); continue; } vus.add(em);
    const o = construire(c, sig); const id = `a-${ordre}`;
    writeFileSync(`${V}/file/out/${id}.json`, JSON.stringify(o));
    const e = ech.find((x) => x.to.toLowerCase?.() === em || (Array.isArray(x.to) && x.to[0].toLowerCase() === em));
    file.push({ id, ordre, nom: c.nom, email: c.email.trim(), segment: `Vague 3 · ${L.seg}`, objet: o.subject, aVerifier: c.aVerifier || '', url: c.url, abonnes: c.abonnes, draftId: e?.draftId || null });
    ordre++;
  }
}
writeFileSync(`${V}/file/file.json`, JSON.stringify(file, null, 1));
console.log(file.length, 'créateurs, ordres', file[0].ordre, 'à', file.at(-1).ordre, '; brouillons déjà créés :', file.filter((x) => x.draftId).length);
