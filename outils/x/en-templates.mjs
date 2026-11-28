// node outils/x/en-templates.mjs → met à jour l'état de vente des cartes de en/templates/index.html
// (prix et bouton d'achat si le produit est en vente dans PRODUITS, « Coming soon » sinon). Voir etat-vente.mjs.
// À relancer après toute mise en vente ; outils/templates/en-vente.test.mjs échoue si la page n'est pas à jour.
import fs from 'node:fs';
import path from 'node:path';
import { cartesEnTemplates, racine } from './etat-vente.mjs';

const fichier = path.join(racine, 'en/templates/index.html');
const avant = fs.readFileSync(fichier, 'utf8');
const apres = cartesEnTemplates(avant);
fs.writeFileSync(fichier, apres);
const n = (s) => (s.match(/Coming soon/g) || []).length;
console.log(`en/templates/index.html : « Coming soon » ${n(avant)} → ${n(apres)}`);
