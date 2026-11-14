// Génère des codes d'accès aux templates et aux packs.
// Usage : TEMPLATES_SECRET=… node outils/templates/generer-code.mjs [PRODUIT|PACK] [NOMBRE]
//         TEMPLATES_SECRET=… node outils/templates/generer-code.mjs SMP TJM,PRX,DVS   (pack sur mesure)
//         TEMPLATES_SECRET=… node outils/templates/generer-code.mjs PFG+ 1   (pack avec l'option « Pack évolutif »)
// Exemples : npm run code -- REV 5 ; npm run code -- PFG ; npm run code -- SMP BDG,ABN,DTT
// Le secret doit être identique à la variable TEMPLATES_SECRET du site Netlify.
import { genererCode, genererCodePack, PRODUITS, PACKS, SUR_MESURE } from '../../netlify/lib/templates-acces.mjs';

const [saisie = 'REV', arg = '1'] = process.argv.slice(2);
const option = saisie.endsWith('+'), cible = saisie.replace(/\+$/, '');
const secret = process.env.TEMPLATES_SECRET;
try {
  if (cible === SUR_MESURE) {
    console.log(genererCodePack(secret, SUR_MESURE, arg.split(/[,\s]+/).filter(Boolean)));
  } else if (PACKS[cible]) {
    for (let i = 0; i < Number(arg); i++) console.log(genererCodePack(secret, cible, [], { option }));
  } else if (PRODUITS[cible]) {
    for (let i = 0; i < Number(arg); i++) console.log(genererCode(secret, cible));
  } else {
    console.error(`Inconnu « ${cible} ». Templates : ${Object.keys(PRODUITS).join(', ')}. Packs : ${Object.keys(PACKS).join(', ')}, ${SUR_MESURE}.`);
    process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
