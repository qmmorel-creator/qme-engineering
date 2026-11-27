// Campagne ciblée « ecoles-hors-contrat » (27/11/2026, lancée depuis la session « Audit campagnes ciblées ») : pack
// « Écoles et formateurs » (PNS, 111 € au lieu de 149 € au 27/11/2026, lu sur /packs/enseignant/) présenté aux écoles
// privées hors contrat et aux centres de soutien scolaire indépendants. L'outil d'auto-école du pack (AEC) n'est pas mis
// en avant ; les quatre outils utiles sont aussi proposés un par un (prix de outils/packs/donnees.mjs et de la page du
// pack : PRG 15 €, QZZ 19 €, CSE 25 €, EDT 45 €). Structure : docs/prospection/mail-type-packs-niches.md.
// Page : /concepts/ecoles-hors-contrat/. Texte validé par Quentin avant tout envoi
// (docs/prospection/campagne-ecoles-hors-contrat.md). Le serveur ajoute la signature « Bandeau » et la mention
// d'opposition : ne jamais les écrire ici.

export const campagne = {
  id: 'ecoles-hors-contrat',
  nom: 'Écoles hors contrat · pack Écoles et formateurs',
  vague: 'cible-ecoles-hors-contrat',
  segment: 'Écoles hors contrat et soutien scolaire',
  produit: { code: 'PNS', nom: 'Pack Écoles et formateurs', pack: 'enseignant' },
  concept: 'https://qm-engineering.fr/concepts/ecoles-hors-contrat/',
  demo: 'https://qm-engineering.fr/templates/gestion-classe/?demo',
};

// Lien traçable par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=ehc-<id>.
const code = (p) => `ehc-${String(p.id).slice(0, 50)}`;
const lien = (p) => `${campagne.concept}?utm_campaign=${code(p)}`;
const pack = (p) => `https://qm-engineering.fr/packs/enseignant/?utm_campaign=${code(p)}`;
// Le fait relevé sur le site, en fin de phrase, sans point final en double.
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');

// « le site de l'École… », « du Cours Hamon », « du Collège… », « des Ateliers… », « d'Alpha », « de La Clé ».
const de = (nom) => {
  const n = String(nom).trim();
  if (/^(école|ecole|association|atelier|académie|institut|institution|ensemble|espace)\b/i.test(n)) return `de l'${n}`;
  if (/^maison\b/i.test(n)) return `de la ${n}`;
  if (/^(centre|cours|collège|college|lycée|lycee|campus|groupe)\b/i.test(n)) return `du ${n}`;
  if (/^le\s/i.test(n)) return `du ${n.slice(3)}`;
  if (/^les\s/i.test(n)) return `des ${n.slice(4)}`;
  if (/^l['’]/i.test(n)) return `de l'${n.slice(2)}`;
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(n) ? `d'${n}` : `de ${n}`;
};

// « à Lyon », « au Havre », « aux Sables-d'Olonne ».
const a = (ville) => {
  const v = String(ville || '').trim();
  if (/^le\s/i.test(v)) return `au ${v.slice(3)}`;
  if (/^les\s/i.test(v)) return `aux ${v.slice(4)}`;
  return `à ${v}`;
};

export const objet = (p) => `${p.nom} : notes, bulletins et emploi du temps au même endroit`;

export const texte = (p) => `Bonjour,

Je suis Quentin Morel, ingénieur : je conçois des outils de gestion pour les petites structures (QME).

J'ai consulté le site ${de(p.nom)}, ${a(p.ville)}${fait(p) ? ` : ${fait(p)}` : ''}. Dans une école indépendante, les notes vivent souvent dans le tableur de chaque enseignant, les appréciations se recopient à la main dans les bulletins, la progression de chaque classe tient dans un classeur et l'emploi du temps se refait à chaque changement de salle. C'est le soir du conseil de classe qu'on recalcule les moyennes.

J'ai réuni des outils prêts à l'emploi dans un pack « Écoles et formateurs », en ligne, sur ordinateur comme sur téléphone :
- Gestion de classe : notes et moyennes pondérées, compétences sur quatre échelons, appréciations et bulletins imprimés pour toute la classe ;
- Progression pédagogique : séquences et séances de chaque classe sur l'année, le prévu face au réalisé, le retard visible avant la fin du trimestre ;
- Banque de questions et quiz : questions étiquetées par thème et difficulté, quiz générés avec leur corrigé, réussite par question ;
- Emploi du temps d'établissement : classes, enseignants et salles, chaque conflit signalé au moment où vous posez le cours.

Vous pouvez les essayer tout de suite, sans inscription, sur des données fictives :
${lien(p)}

Le pack coûte 111 € au lieu de 149 €. C'est un achat unique, sans abonnement ni renouvellement. Il contient aussi un outil de gestion d'auto-école qui ne vous servira pas : chaque outil s'achète donc aussi seul, de 15 à 45 € (progression 15 €, quiz 19 €, gestion de classe 25 €, emploi du temps 45 €), soit 104 € pour les quatre. Chacun a 14 jours d'essai gratuit avec vos propres données, sans carte bancaire :
${pack(p)}

C'est un ensemble tout prêt. Si votre école demande autre chose (votre propre modèle de bulletin, plusieurs enseignants sur les mêmes classes, le suivi des élèves par stage pour du soutien scolaire), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui vous ferait gagner le plus de temps.

Bien à vous,`;

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet des outils pour les notes, les bulletins, la progression et l'emploi du temps que je vous ai présentés la semaine dernière :
${lien(p)}

Si les moyennes, les bulletins ou l'emploi du temps de vos classes vous prennent du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus de temps, avec les outils tels quels ou adaptés sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
