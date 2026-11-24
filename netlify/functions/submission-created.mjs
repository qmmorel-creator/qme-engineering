// Événement Netlify « submission-created » : un formulaire du site vient d'être reçu. Les formulaires suivis (idée,
// concours) sont gardés pour Nexora Optim › QME (netlify/lib/formulaires.mjs) ; les autres sont ignorés.
import { getStore } from '@netlify/blobs';
import { storeEssais } from '../lib/essais-store.mjs';
import { enregistrerFormulaire } from '../lib/formulaires.mjs';

export default async (req) => {
  let corps = null;
  try { corps = await req.json(); } catch { return new Response('ignoré', { status: 200 }); }
  const ok = await enregistrerFormulaire(storeEssais(getStore), corps?.payload);
  return new Response(ok ? 'enregistré' : 'ignoré', { status: 200 });
};
