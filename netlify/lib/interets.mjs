// Compteur « Je suis intéressé(e) » des templates en mise en vente prochaine, sans dépendance à Netlify :
// le stockage est injecté (Netlify Blobs en production, mémoire en local et en test).
//
// Chaque clic est une entrée distincte dont la clé porte le module et l'heure : aucune écriture
// concurrente sur un même compteur, aucune donnée personnelle (ni IP, ni cookie, ni e-mail).
// Lecture réservée à l'administrateur : code ADM-… dérivé de TEMPLATES_SECRET (voir codeAdmin), ou
// valeur de la variable INTERETS_ADMIN si elle est définie sur Netlify.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ALPHABET, PRODUITS, normaliser, codeAdmin } from './templates-acces.mjs';
export { codeAdmin };

const base32 = (octets) => { let v = 0n; for (const o of octets) v = v * 256n + BigInt(o); let s = ''; for (let i = octets.length * 8 / 5 - 1; i >= 0; i--) s += ALPHABET[Number((v >> BigInt(5 * i)) & 31n)]; return s; };

// Modules : slug de l'application → nom de vente.
export const MODULES = Object.fromEntries(Object.values(PRODUITS).map((p) => [p.url.split('/')[2], p.nom]));

const egal = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function estAdmin(saisie, { secret, admin }) {
  const n = normaliser(saisie);
  if (!n) return false;
  if (admin && admin.length >= 16 && egal(String(saisie).trim(), admin)) return true;
  return Boolean(secret && secret.length >= 32) && egal(n, normaliser(codeAdmin(secret)));
}

// Clé d'un clic : clic/<module>/<horodatage ISO>~<aléa>
export const cleClic = (module, date, alea = base32(randomBytes(5))) => `clic/${module}/${date.toISOString()}~${alea}`;
export function lireCle(cle) {
  const m = /^clic\/([a-z0-9-]+)\/([^~]+)~/.exec(cle);
  return m && MODULES[m[1]] ? { module: m[1], date: new Date(m[2]) } : null;
}

// Synthèse par module : total, 7 derniers jours, dernier clic ; triée du plus demandé au moins demandé.
export function synthese(cles, maintenant = new Date()) {
  const il7j = maintenant.getTime() - 7 * 86400000;
  const par = {};
  for (const c of cles) {
    const k = lireCle(c);
    if (!k) continue;
    const m = (par[k.module] ||= { module: k.module, nom: MODULES[k.module], total: 0, septJours: 0, dernier: null });
    m.total++;
    if (k.date.getTime() >= il7j) m.septJours++;
    if (!m.dernier || k.date > new Date(m.dernier)) m.dernier = k.date.toISOString();
  }
  const modules = Object.values(par).sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, 'fr'));
  return { total: modules.reduce((s, m) => s + m.total, 0), modules, majLe: maintenant.toISOString() };
}

// CSV (séparateur ;, compatible Excel en français) : un clic par ligne, heure de Paris.
export function csv(cles) {
  const lignes = cles.map(lireCle).filter(Boolean).sort((a, b) => a.date - b.date).map((k) => {
    const d = k.date.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const [jour, heure] = d.split(' ');
    return `${jour};${heure};${k.module};"${MODULES[k.module].replace(/"/g, '""')}"`;
  });
  return '﻿date;heure;module;template\r\n' + lignes.join('\r\n') + (lignes.length ? '\r\n' : '');
}

const json = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// Routes :
//  POST /api/interets { module }                      → { ok }
//  GET  /api/interets (en-tête X-Admin)               → synthèse JSON
//  GET  /api/interets?format=csv (en-tête X-Admin)    → CSV de tous les clics
// Le stockage expose ajouter(cle) et lister(prefixe) → [cles].
export async function traiterInterets(requete, { secret, admin, stockage, maintenant = () => new Date() }) {
  const url = new URL(requete.url);
  if (requete.method === 'POST') {
    const texte = await requete.text();
    if (texte.length > 200) return json(413, { erreur: 'Requête trop longue.' });
    let module;
    try { ({ module } = JSON.parse(texte)); } catch { return json(400, { erreur: 'Requête illisible.' }); }
    if (typeof module !== 'string' || !MODULES[module]) return json(400, { erreur: 'Template inconnu.' });
    await stockage.ajouter(cleClic(module, maintenant()));
    return json(200, { ok: true });
  }
  if (requete.method === 'GET') {
    if (!estAdmin(requete.headers.get('x-admin') || '', { secret, admin })) return json(401, { erreur: 'Code administrateur requis.' });
    const cles = await stockage.lister('clic/');
    if (url.searchParams.get('format') === 'csv') {
      return new Response(csv(cles), { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store',
        'content-disposition': `attachment; filename="interets-templates-${maintenant().toISOString().slice(0, 10)}.csv"` } });
    }
    return json(200, synthese(cles, maintenant()));
  }
  return json(405, { erreur: 'Méthode non prise en charge.' });
}
