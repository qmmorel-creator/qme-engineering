// Comptes acheteurs (connexion par lien e-mail) : POST /api/compte/lien, /session, /cles, /deconnexion ;
// GET et DELETE /api/compte ; PUT /api/compte/prefs. Logique dans netlify/lib/comptes.mjs ; ici, seulement
// le branchement sur Netlify Blobs (store des essais, Francfort) et l'envoi d'e-mails.
import { getStore } from '@netlify/blobs';
import { traiterCompte } from '../lib/comptes.mjs';
import { revoquesDepuis } from '../lib/templates-acces.mjs';
import { envoyeurDepuisEnv } from '../lib/mail.mjs';
import { storeEssais } from '../lib/essais-store.mjs';

export default async (requete) => traiterCompte(requete, {
  secret: process.env.TEMPLATES_SECRET,
  store: storeEssais(getStore),
  envoyer: envoyeurDepuisEnv(),
  revoques: revoquesDepuis(process.env.TEMPLATES_CODES_REVOQUES),
  admin: process.env.INTERETS_ADMIN, // code administrateur facultatif (sinon le code ADM-… dérivé du secret)
  lecture: process.env.QME_LECTURE_TOKEN, // jeton de lecture seule (Nexora Optim › QME)
  testeurs: process.env.ESSAI_TESTEURS || '', // adresses de test, exclues de l'annonce
  jetonOpposition: process.env.OPPOSITION_TOKEN || '', // lecture seule de la liste d'opposition (en-tête X-Opposition-Token)
});

// Francfort : adresses e-mail et comptes restent dans l'UE.
export const config = { path: ['/api/compte', '/api/compte/*'], region: 'fra' };
