// API du défi 7 jours entre potes (/api/defi) : branchement de netlify/lib/defi.mjs sur Netlify Blobs et node:crypto.
// Données hébergées dans l'Union européenne (Francfort, eu-central-1), comme les autres templates.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { traiterDefi } from '../lib/defi.mjs';
import { ALPHABET } from '../lib/templates-acces.mjs';
import { stockageDefi } from '../lib/defi-store.mjs';

export default async (requete) => {
  const secret = process.env.TEMPLATES_SECRET;
  if (!secret) return new Response(JSON.stringify({ erreur: 'Service non configuré' }), { status: 503, headers: { 'content-type': 'application/json' } });
  return traiterDefi(requete, {
    stockage: stockageDefi(),
    crypto: {
      hmac: (texte) => createHmac('sha256', secret).update(texte).digest('base64url'),
      aleatoire: (n) => [...randomBytes(n)].map((o) => ALPHABET[o & 31]).join(''),
      egal: (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); },
    },
  });
};

export const config = { path: '/api/defi', region: 'fra' };
