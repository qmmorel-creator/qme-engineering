// IG-219 · F9 · Fin du régime simplifié de TVA au 1er janvier 2027 (loi de finances pour 2025, art. 38 ;
// impots.gouv.fr, actualité du 22/09/2026). Cas fictif : Léa, graphiste, 8 000 € de TVA nette par an, stable.
// Ancien régime (RSI) : acomptes de 55 % (juillet) et 40 % (décembre) de la TVA de l'exercice précédent,
// solde à la CA12 en mai. Nouveau (réel normal trimestriel) : la TVA de chaque trimestre payée le mois suivant.
const TVA = 8000;
const acJuillet = 0.55 * TVA, acDecembre = 0.40 * TVA, solde = TVA - acJuillet - acDecembre;
const trimestre = TVA / 4;
const ancien2027 = [['mai 2027 (solde 2026)', solde], ['juillet 2027 (acompte)', acJuillet], ['décembre 2027 (acompte)', acDecembre]];
const nouveau2027 = [['avril 2027 (T1)', trimestre], ['mai 2027 (solde 2026, dernière CA12)', solde], ['juillet 2027 (T2)', trimestre], ['octobre 2027 (T3)', trimestre]];
const somme = (l) => l.reduce((s, [, v]) => s + v, 0);
console.log({ acJuillet, acDecembre, solde, trimestre });
console.log('Ancien régime, sorties en 2027 :', ancien2027, '=', somme(ancien2027));
console.log('Nouveau régime, sorties en 2027 :', nouveau2027, '=', somme(nouveau2027), '; janvier 2028 (T4) :', trimestre);
console.log('Écart 2027 :', somme(ancien2027) - somme(nouveau2027), '(T4 2027 payé en janvier 2028 :', trimestre, ', moins le solde 2027 de mai 2028 dans l\'ancien régime :', solde, ')');
console.log('Décembre 2026, dernier acompte (40 % de la TVA 2025) :', acDecembre);
