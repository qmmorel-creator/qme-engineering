// Génère des codes d'accès aux templates.
// Usage : TEMPLATES_SECRET=… node outils/templates/generer-code.mjs [PRODUIT] [NOMBRE]
// Exemple : TEMPLATES_SECRET=… npm run code -- REV 5
// Le secret doit être identique à la variable TEMPLATES_SECRET du site Netlify.
import { genererCode, PRODUITS } from '../../netlify/lib/templates-acces.mjs';

const [produit = 'REV', nombre = '1'] = process.argv.slice(2);
if (!PRODUITS[produit]) {
  console.error(`Produit inconnu « ${produit} ». Produits : ${Object.keys(PRODUITS).join(', ')}`);
  process.exit(1);
}
try {
  for (let i = 0; i < Number(nombre); i++) console.log(genererCode(process.env.TEMPLATES_SECRET, produit));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
