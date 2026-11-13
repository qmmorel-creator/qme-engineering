// Compteur « Je suis intéressé(e) » des templates en mise en vente prochaine, sans dépendance à Netlify :
// le stockage est injecté (Netlify Blobs en production, mémoire en local et en test).
//
// Chaque clic est une entrée distincte dont la clé porte le module et l'heure : aucune écriture
// concurrente sur un même compteur, aucune donnée personnelle (ni IP, ni cookie).
// E-mail facultatif, donné séparément après le clic pour être prévenu de la mise en vente : entrée
// email/<module>/<heure>~<aléa> dont la valeur est l'adresse ; lecture et suppression par l'administrateur.
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
export const cleClic = (module, date, alea = base32(randomBytes(5)), type = 'clic') => `${type}/${module}/${date.toISOString()}~${alea}`;
export const cleEmail = (module, date, alea) => cleClic(module, date, alea, 'email');
export function lireCle(cle) {
  const m = /^(?:clic|email)\/([a-z0-9-]+)\/([^~]+)~/.exec(cle);
  return m && MODULES[m[1]] ? { module: m[1], date: new Date(m[2]) } : null;
}

// Synthèse par module : total, 7 derniers jours, dernier clic ; triée du plus demandé au moins demandé.
export function synthese(cles, maintenant = new Date(), clesEmails = []) {
  const il7j = maintenant.getTime() - 7 * 86400000;
  const par = {};
  for (const c of cles) {
    const k = lireCle(c);
    if (!k) continue;
    const m = (par[k.module] ||= { module: k.module, nom: MODULES[k.module], total: 0, septJours: 0, dernier: null, emails: 0 });
    m.total++;
    if (k.date.getTime() >= il7j) m.septJours++;
    if (!m.dernier || k.date > new Date(m.dernier)) m.dernier = k.date.toISOString();
  }
  for (const c of clesEmails) { const k = lireCle(c); if (k && par[k.module]) par[k.module].emails++; }
  const modules = Object.values(par).sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, 'fr'));
  return { total: modules.reduce((s, m) => s + m.total, 0), emails: modules.reduce((s, m) => s + m.emails, 0), modules, majLe: maintenant.toISOString() };
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

// Adresses (CSV) : date, heure de Paris, module, template, e-mail.
export function csvEmails(entrees) {
  const lignes = entrees.map(({ cle, email }) => ({ k: lireCle(cle), email })).filter((e) => e.k && e.email).sort((a, b) => a.k.date - b.k.date).map(({ k, email }) => {
    const d = k.date.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const [jour, heure] = d.split(' ');
    return `${jour};${heure};${k.module};"${MODULES[k.module].replace(/"/g, '""')}";${email}`;
  });
  return '\uFEFFdate;heure;module;template;email\r\n' + lignes.join('\r\n') + (lignes.length ? '\r\n' : '');
}
export const emailValide = (e) => typeof e === 'string' && e.length <= 254 && /^[^\s@";<>,]+@[^\s@";<>,]+\.[^\s@";<>,]{2,}$/.test(e.trim());

const json = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// Routes :
//  POST /api/interets { module }                      → { ok }  (un clic)
//  POST /api/interets { module, email }               → { ok }  (adresse pour être prévenu, facultative)
//  GET  /api/interets?format=emails (X-Admin)         → CSV des adresses
//  DELETE /api/interets?email=… (X-Admin)             → efface toutes les entrées de cette adresse
//  GET  /api/interets (en-tête X-Admin)               → synthèse JSON
//  GET  /api/interets?format=csv (en-tête X-Admin)    → CSV de tous les clics
// Le stockage expose ajouter(cle, valeur), lire(cle), supprimer(cle) et lister(prefixe) → [cles].
export async function traiterInterets(requete, { secret, admin, stockage, maintenant = () => new Date() }) {
  const url = new URL(requete.url);
  if (requete.method === 'POST') {
    const texte = await requete.text();
    if (texte.length > 400) return json(413, { erreur: 'Requête trop longue.' });
    let module, email;
    try { ({ module, email } = JSON.parse(texte)); } catch { return json(400, { erreur: 'Requête illisible.' }); }
    if (typeof module !== 'string' || !MODULES[module]) return json(400, { erreur: 'Template inconnu.' });
    if (email !== undefined) {
      if (!emailValide(email)) return json(400, { erreur: 'Adresse e-mail invalide.' });
      await stockage.ajouter(cleEmail(module, maintenant()), email.trim().toLowerCase());
      return json(200, { ok: true });
    }
    await stockage.ajouter(cleClic(module, maintenant()), '1');
    return json(200, { ok: true });
  }
  if (requete.method === 'GET' || requete.method === 'DELETE') {
    if (!estAdmin(requete.headers.get('x-admin') || '', { secret, admin })) return json(401, { erreur: 'Code administrateur requis.' });
    const clesEmails = await stockage.lister('email/');
    const entrees = async () => Promise.all(clesEmails.map(async (cle) => ({ cle, email: await stockage.lire(cle) })));
    if (requete.method === 'DELETE') {
      const cible = String(url.searchParams.get('email') || '').trim().toLowerCase();
      if (!cible) return json(400, { erreur: 'Adresse à effacer manquante.' });
      const aEffacer = (await entrees()).filter((e) => e.email === cible);
      await Promise.all(aEffacer.map((e) => stockage.supprimer(e.cle)));
      return json(200, { ok: true, effaces: aEffacer.length });
    }
    if (url.searchParams.get('format') === 'emails') {
      return new Response(csvEmails(await entrees()), { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store',
        'content-disposition': `attachment; filename="emails-interets-${maintenant().toISOString().slice(0, 10)}.csv"` } });
    }
    const cles = await stockage.lister('clic/');
    if (url.searchParams.get('format') === 'csv') {
      return new Response(csv(cles), { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store',
        'content-disposition': `attachment; filename="interets-templates-${maintenant().toISOString().slice(0, 10)}.csv"` } });
    }
    return json(200, synthese(cles, maintenant(), clesEmails));
  }
  return json(405, { erreur: 'Méthode non prise en charge.' });
}
