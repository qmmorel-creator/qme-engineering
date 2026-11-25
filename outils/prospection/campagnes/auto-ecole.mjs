// Campagne ciblée « auto-écoles » (décision de Quentin du 25/11/2026) : template Gestion d'auto-école (T57, AEC)
// présenté comme prêt à l'emploi, avec l'ouverture sur du sur-mesure. Page : /concepts/auto-ecole/ ; démo :
// /templates/auto-ecole/?demo. Texte validé par Quentin avant tout envoi (voir docs/prospection/campagne-auto-ecole.md).
// Le serveur ajoute la signature « Bandeau » et la mention d'opposition : ne jamais les écrire ici.

export const campagne = {
  id: 'auto-ecole',
  nom: 'Auto-écoles · gestion prête à l\'emploi',
  vague: 'cible-auto-ecole',
  segment: 'Auto-écoles indépendantes',
  produit: { code: 'AEC', nom: 'Gestion d\'auto-école', template: 'auto-ecole' },
  concept: 'https://qm-engineering.fr/concepts/auto-ecole/',
  demo: 'https://qm-engineering.fr/templates/auto-ecole/?demo',
};

// Lien court et traçable par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=ae-<id sans « auto-ecole- »>.
const lien = (p) => `${campagne.concept}?utm_campaign=ae-${String(p.id).replace(/^(auto-ecole|ecole-de-conduite)-/, '')}`;
// Catalogue des templates pour les pros (fin du mail, ajout validé par Quentin le 25/11/2026). Templates cités : en vente.
const autres = (p) => `https://qm-engineering.fr/pro/?utm_campaign=ae-${String(p.id).replace(/^(auto-ecole|ecole-de-conduite)-/, '')}`;
// Le fait relevé sur le site, en fin de phrase, sans point final en double.
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');

// « de » élidé devant une voyelle ou un h : « le site d'Auto-école… », « le site de La Conduite… ».
const de = (nom) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(String(nom).trim()) ? `d'${nom}` : `de ${nom}`);

export const objet = (p) => `${p.nom} : un planning sans double réservation, prêt à l'emploi`;

export const texte = (p) => `Bonjour,

Je suis Quentin Morel : je conçois des outils de gestion pour les petites entreprises (QME).

J'ai consulté le site ${de(p.nom)}, à ${p.ville}${fait(p) ? ` : ${fait(p)}` : ''}. Planning des moniteurs et des véhicules, heures restantes de chaque élève, paiements, contrôle technique : c'est souvent là que le temps se perd quand tout tient sur papier ou dans plusieurs tableurs.

J'ai conçu un outil de gestion d'auto-école prêt à l'emploi, en ligne, sur ordinateur comme sur téléphone :
- il refuse les doubles réservations d'un moniteur, d'un véhicule ou d'un élève ;
- il donne pour chaque élève les heures restantes et le reste à payer ;
- il prévient avant le contrôle technique et l'entretien des véhicules ;
- il résume le mois dans un bilan, avec des exports pour la comptabilité.

Vous pouvez l'essayer tout de suite, sans inscription, sur une auto-école fictive :
${lien(p)}

C'est un template tout prêt. Si votre organisation demande autre chose (plusieurs agences, vos forfaits et financements, vos documents), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui vous ferait gagner le plus de temps.

D'autres outils prêts à l'emploi peuvent aussi vous servir (trésorerie, TVA, planning d'équipe, gestion de flotte, document unique…) : ${autres(p)}

Bien à vous,`;

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet de l'outil de gestion d'auto-école que je vous ai présenté la semaine dernière :
${lien(p)}

Si le planning, le suivi des heures des élèves ou celui des véhicules vous prennent du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus de temps, avec l'outil tel quel ou adapté sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
