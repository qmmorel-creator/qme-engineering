// Serveur local de test : sert le site statique et l'API des templates avec un stockage en mémoire.
// Usage : npm run dev:templates  → http://localhost:8888/templates/revision/
// Secret de développement fixe ; affiche un code valide au démarrage.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { traiter, genererCode, PRODUITS } from '../../netlify/lib/templates-acces.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const SECRET = process.env.TEMPLATES_SECRET || 'secret-de-developpement-local-uniquement-0123456789';
const PORT = Number(process.env.PORT || 8888);
const memoire = new Map();
const stockage = { get: async (c) => memoire.get(c) ?? null, set: async (c, v) => { memoire.set(c, structuredClone(v)); } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/templates/')) {
    const morceaux = [];
    for await (const m of req) morceaux.push(m);
    const corps = ['POST', 'PUT'].includes(req.method) ? Buffer.concat(morceaux) : undefined;
    const reponse = await traiter(new Request(url, { method: req.method, headers: req.headers, body: corps }), { secret: SECRET, stockage });
    res.writeHead(reponse.status, Object.fromEntries(reponse.headers));
    return res.end(await reponse.text());
  }
  let chemin = normalize(join(RACINE, decodeURIComponent(url.pathname)));
  if (!chemin.startsWith(RACINE)) { res.writeHead(403); return res.end(); }
  try {
    if ((await stat(chemin)).isDirectory()) chemin = join(chemin, 'index.html');
    const contenu = await readFile(chemin);
    res.writeHead(200, { 'content-type': TYPES[extname(chemin)] || 'application/octet-stream' });
    res.end(contenu);
  } catch { res.writeHead(404); res.end('Introuvable'); }
}).listen(PORT, () => {
  for (const [p, { url }] of Object.entries(PRODUITS)) console.log(`http://localhost:${PORT}${url}  code de test : ${genererCode(SECRET, p)}`);
});
