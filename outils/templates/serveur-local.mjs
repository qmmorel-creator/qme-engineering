// Serveur local de test : sert le site statique et l'API des templates avec un stockage en mémoire.
// Usage : npm run dev:templates  → http://localhost:8888/templates/revision/
// Secret de développement fixe ; affiche un code valide au démarrage.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { traiter, genererCode, PRODUITS } from '../../netlify/lib/templates-acces.mjs';
import { traiterInterets, codeAdmin } from '../../netlify/lib/interets.mjs';
import { traiterSecretSanta } from '../../templates/secret-santa/moteur.js';
import { dependancesServeur } from '../../netlify/lib/secret-santa.mjs';
import { traiterCompetition } from '../../templates/competition/moteur.js';
import { dependancesCompetition } from '../../netlify/lib/competition.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const SECRET = process.env.TEMPLATES_SECRET || 'secret-de-developpement-local-uniquement-0123456789';
const PORT = Number(process.env.PORT || 8888);
const memoire = new Map();
const clics = new Map();
const stockageInterets = { ajouter: async (c, v) => { clics.set(c, v); }, lire: async (c) => clics.get(c) ?? null, supprimer: async (c) => { clics.delete(c); }, lister: async (p) => [...clics.keys()].filter((c) => c.startsWith(p)) };
const santa = new Map();
const stockageSanta = { get: async (c) => santa.get(c) ?? null, set: async (c, v) => { santa.set(c, structuredClone(v)); }, supprimer: async (c) => { santa.delete(c); }, lister: async (p) => [...santa.keys()].filter((c) => c.startsWith(p)) };
const publics = new Map();
const stockageCompetition = { get: async (c) => publics.get(c) ?? null, set: async (c, v) => { publics.set(c, structuredClone(v)); }, supprimer: async (c) => { publics.delete(c); }, lister: async (p) => [...publics.keys()].filter((c) => c.startsWith(p)) };
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
  if (url.pathname.startsWith('/api/secret-santa/')) {
    const morceaux = [];
    for await (const m of req) morceaux.push(m);
    const corps = ['POST', 'PUT'].includes(req.method) ? Buffer.concat(morceaux) : undefined;
    const reponse = await traiterSecretSanta(new Request(url, { method: req.method, headers: req.headers, body: corps }), { stockage: stockageSanta, ...dependancesServeur(SECRET) });
    res.writeHead(reponse.status, Object.fromEntries(reponse.headers));
    return res.end(await reponse.text());
  }
  if (url.pathname.startsWith('/api/competition/')) {
    const morceaux = [];
    for await (const m of req) morceaux.push(m);
    const corps = ['POST', 'PUT', 'DELETE'].includes(req.method) && morceaux.length ? Buffer.concat(morceaux) : undefined;
    const reponse = await traiterCompetition(new Request(url, { method: req.method, headers: req.headers, body: corps }), { stockage: stockageCompetition, ...dependancesCompetition(SECRET) });
    res.writeHead(reponse.status, Object.fromEntries(reponse.headers));
    return res.end(await reponse.text());
  }
  if (url.pathname === '/api/interets') {
    const morceaux = [];
    for await (const m of req) morceaux.push(m);
    const corps = req.method === 'POST' ? Buffer.concat(morceaux) : undefined;
    const reponse = await traiterInterets(new Request(url, { method: req.method, headers: req.headers, body: corps }), { secret: SECRET, stockage: stockageInterets });
    res.writeHead(reponse.status, Object.fromEntries(reponse.headers));
    return res.end(Buffer.from(await reponse.arrayBuffer()));
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
  console.log(`http://localhost:${PORT}/admin/interets/  code administrateur : ${codeAdmin(SECRET)}`);
  for (const [p, { url }] of Object.entries(PRODUITS)) console.log(`http://localhost:${PORT}${url}  code de test : ${genererCode(SECRET, p)}`);
});
