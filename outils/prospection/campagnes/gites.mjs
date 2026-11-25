// Campagne ciblée « gîtes » (demande de Quentin du 25/11/2026) : template Location saisonnière (T64, SJR, 25 €, en vente)
// présenté comme prêt à l'emploi aux gîtes, chambres d'hôtes et meublés de tourisme de 1 à 10 logements, avec
// l'ouverture sur du sur-mesure. Page : /concepts/gites/ ; démo : /templates/location-saisonniere/?demo.
// Template du catalogue « perso » : le lien de fin de mail pointe vers le pack Propriétaire, pas vers /pro/.
// Texte validé par Quentin avant tout envoi (voir docs/prospection/campagne-gites.md).
// Le serveur ajoute la signature « Bandeau » et la mention d'opposition : ne jamais les écrire ici.

export const campagne = {
  id: 'gites',
  nom: 'Gîtes et chambres d\'hôtes · location saisonnière prête à l\'emploi',
  vague: 'cible-gites',
  segment: 'Gîtes, chambres d\'hôtes et meublés de tourisme (1 à 10 logements)',
  produit: { code: 'SJR', nom: 'Location saisonnière', template: 'location-saisonniere' },
  concept: 'https://qm-engineering.fr/concepts/gites/',
  demo: 'https://qm-engineering.fr/templates/location-saisonniere/?demo',
};

// Lien court et traçable par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=gi-<id>.
const ref = (p) => `gi-${String(p.id)}`.slice(0, 64);
const lien = (p) => `${campagne.concept}?utm_campaign=${ref(p)}`;
// Pack Propriétaire (catalogue perso) : Location saisonnière, Entretien de la maison, Pilote de travaux… (en vente).
const autres = (p) => `https://qm-engineering.fr/packs/proprietaire/?utm_campaign=${ref(p)}`;
// Le fait relevé sur le site, en fin de phrase, sans point final en double.
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');

// « de » élidé devant une voyelle ou un h : « le site d'Orée du Bois », « le site de La Grange… ».
const de = (nom) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(String(nom).trim()) ? `d'${nom}` : `de ${nom}`);

export const objet = (p) => `${p.nom} : vos réservations sans double réservation, prêt à l'emploi`;

export const texte = (p) => `Bonjour,

Je suis Quentin Morel : je conçois des outils de gestion pour les petites entreprises (QME).

J'ai consulté le site ${de(p.nom)}, à ${p.ville}${fait(p) ? ` : ${fait(p)}` : ''}. Un calendrier à tenir à jour pour chaque canal, le ménage à caler entre deux séjours, la taxe de séjour à déclarer, les commissions qui réduisent la recette : c'est souvent là que le temps se perd quand tout tient dans plusieurs agendas et un tableur.

J'ai conçu un outil de gestion de location saisonnière prêt à l'emploi, en ligne, sur ordinateur comme sur téléphone, pour 1 à 10 logements :
- un seul calendrier pour tous vos canaux, qui refuse les doubles réservations ;
- le ménage créé après chaque départ, à faire avant la prochaine arrivée ;
- la taxe de séjour calculée pour chaque séjour, au tarif de votre commune ;
- ce qui vous reste vraiment, canal par canal et mois par mois, après commissions.

Vous pouvez l'essayer tout de suite, sans inscription, sur un exemple fictif :
${lien(p)}

C'est un template tout prêt. Si votre activité demande autre chose (tarifs par saison, petits-déjeuners ou table d'hôtes, vos contrats et vos factures), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui vous ferait gagner le plus de temps.

D'autres outils prêts à l'emploi peuvent aussi vous servir, réunis dans le Pack Propriétaire (Entretien de la maison, Pilote de travaux…) : ${autres(p)}

Bien à vous,`;

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet de l'outil de gestion de location saisonnière que je vous ai présenté la semaine dernière :
${lien(p)}

Si le calendrier de vos différents canaux, le ménage entre deux séjours ou le calcul de la taxe de séjour vous prennent du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus de temps, avec l'outil tel quel ou adapté sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
