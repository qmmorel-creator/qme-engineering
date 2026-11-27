// Campagne ciblée « artisans-boutique » (sous-campagne lancée le 27/11/2026 depuis la session « Audit campagnes
// ciblées ») : Pack Commerçant et artisan (PCA, 95 € au lieu de 127 € au 27/11/2026, 5 templates en vente : STK 25 €,
// DVS 29 €, MCE 25 €, TRS 29 €, TVA 19 €) présenté aux artisans qui fabriquent et vendent. Page :
// /concepts/artisans-boutique/. Structure du mail : docs/prospection/mail-type-packs-niches.md.
// Trois profils (champ `profil` du lot), un problème d'entrée par profil :
//  - « fleuriste » : fleuristes indépendants (stocks périssables, devis de mariage et de deuil) ;
//  - « brasserie » : micro-brasseries et brasseries artisanales (matières premières, conditionnement, TVA) ;
//  - « atelier » : ateliers-boutiques (céramistes, savonniers, ébénistes, maroquiniers).
// Prix relus sur https://qm-engineering.fr/packs/commercant-artisan/ et outils/packs/donnees.mjs le 27/11/2026 :
// à revérifier avant chaque lot si un prix change.
// Texte validé par Quentin avant tout envoi (docs/prospection/campagne-artisans-boutique.md). Le serveur ajoute la
// signature « Bandeau » et la mention d'opposition : ne jamais les écrire ici. Aucun logiciel concurrent cité.

export const campagne = {
  id: 'artisans-boutique',
  nom: 'Artisans qui fabriquent et vendent · pack Commerçant et artisan',
  vague: 'cible-artisans-boutique',
  segment: 'Fleuristes, micro-brasseries et ateliers-boutiques',
  produit: { code: 'PCA', nom: 'Pack Commerçant et artisan', pack: 'commercant-artisan' },
  concept: 'https://qm-engineering.fr/concepts/artisans-boutique/',
  demo: 'https://qm-engineering.fr/templates/stocks/?demo',
};

const SITE = 'https://qm-engineering.fr';
// Lien traçable par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=ab-<id>.
const ref = (p) => `ab-${String(p.id)}`.slice(0, 64);
const page = (p) => `${campagne.concept}?utm_campaign=${ref(p)}`;
const pack = (p) => `${SITE}/packs/commercant-artisan/?utm_campaign=${ref(p)}`;
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');

// « le site de La Maison… », « d'Atelier… », « du Grenier… » (Le), « des Fleurs… » (Les).
const de = (nom) => {
  const n = String(nom).trim();
  if (/^Le\s/.test(n)) return `du ${n.slice(3)}`;
  if (/^Les\s/.test(n)) return `des ${n.slice(4)}`;
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(n) ? `d'${n}` : `de ${n}`;
};
const a = (ville) => {
  const v = String(ville).trim();
  if (/^Le\s/.test(v)) return `au ${v.slice(3)}`;
  if (/^Les\s/.test(v)) return `aux ${v.slice(4)}`;
  return `à ${v}`;
};

const PROFILS = {
  fleuriste: {
    objet: 'vos fleurs en stock, vos devis de mariage et votre trésorerie suivis au même endroit',
    probleme: 'Chez un fleuriste, les fleurs ne se gardent que quelques jours, les devis de mariage et de deuil doivent partir vite et justes, et les commandes des entreprises s\'ajoutent à la boutique : c\'est souvent au moment de passer commande chez le grossiste qu\'on refait le compte de tête.',
    stock: 'fleurs, feuillages, contenants et rubans au bon niveau, avec un seuil d\'alerte par article et la liste à commander par fournisseur',
    devis: 'les devis de mariage, de deuil et d\'événement justes au centime, mentions comprises, et suivis jusqu\'à l\'acceptation',
    mesure: 'vos compositions types avec les fleurs qu\'elles consomment, vos devis de mariage préremplis, les abonnements de vos clients professionnels',
    relance: 'le stock de la boutique ou les devis de mariage',
  },
  brasserie: {
    objet: 'votre stock de matières, vos devis et votre TVA suivis au même endroit',
    probleme: 'Dans une brasserie artisanale, le malt, le houblon, les levures, les bouteilles, les étiquettes et les fûts se suivent souvent de tête ou dans un tableur : c\'est au moment de lancer un brassin qu\'on découvre ce qui manque, et la TVA des ventes aux bars, aux cavistes et en boutique se reconstitue au moment de déclarer.',
    stock: 'matières premières, bouteilles, étiquettes et fûts au bon niveau, avec un seuil d\'alerte par article et la liste à commander par fournisseur',
    devis: 'les devis des bars, des cavistes et des événements justes au centime, mentions comprises, et suivis jusqu\'à l\'acceptation',
    mesure: 'vos recettes avec les matières consommées à chaque brassin, le suivi de vos fûts chez les clients, vos tarifs professionnels',
    relance: 'le stock de matières ou la TVA',
  },
  atelier: {
    objet: 'vos matières, vos pièces finies et vos devis suivis au même endroit',
    probleme: 'Dans un atelier qui fabrique et vend, les matières d\'un côté et les pièces finies en boutique de l\'autre se suivent souvent de tête : c\'est au moment de lancer une série ou de répondre à une commande sur mesure qu\'on découvre ce qui manque, et le devis se refait à la main à chaque fois.',
    stock: 'matières premières et pièces finies au bon niveau, avec un seuil d\'alerte par article et la liste à commander par fournisseur',
    devis: 'les devis des commandes sur mesure et des professionnels justes au centime, mentions comprises, et suivis jusqu\'à l\'acceptation',
    mesure: 'vos recettes de fabrication avec les matières consommées par pièce, vos commandes sur mesure, vos dépôts chez les revendeurs',
    relance: 'le stock de l\'atelier ou les devis sur mesure',
  },
};
const profil = (p) => PROFILS[p.profil] || PROFILS.atelier;

export const objet = (p) => `${p.nom} : ${profil(p).objet}`;

export const texte = (p) => {
  const e = profil(p);
  return `Bonjour,

Je suis Quentin Morel, ingénieur : je conçois des outils de gestion pour les petites entreprises (QME).

J'ai consulté le site ${de(p.nom)}, ${a(p.ville)}${fait(p) ? ` : ${fait(p)}` : ''}. ${e.probleme}

J'ai réuni cinq outils prêts à l'emploi dans un pack « Commerçant et artisan », en ligne, sur ordinateur comme sur téléphone :
- Stocks et inventaire : ${e.stock} ;
- Générateur de devis : ${e.devis} ;
- Trésorerie prévisionnelle : les douze prochains mois, pour voir venir un creux avant une grosse commande ;
- Suivi de TVA, pour les entreprises qui facturent la TVA : TVA collectée et déductible, échéances signalées avant la date ;
- Livre recettes-dépenses, pour les micro-entrepreneurs seulement : recettes, cotisations estimées et seuils.

Vous pouvez les essayer tout de suite, sans inscription, sur des données fictives :
${page(p)}

Le pack coûte 95 € au lieu de 127 €. C'est un achat unique, sans abonnement ni renouvellement. Chaque outil s'achète aussi seul (de 19 à 29 €), car tous ne servent pas à tout le monde : le livre des recettes ne sert qu'aux micro-entrepreneurs, le suivi de TVA qu'aux entreprises qui facturent la TVA. Chacun a 14 jours d'essai gratuit avec vos propres données, sans carte bancaire :
${pack(p)}

C'est un ensemble tout prêt. Si votre activité demande autre chose (${e.mesure}), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui vous ferait gagner le plus de temps.

Bien à vous,`;
};

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet des outils de gestion que je vous ai présentés la semaine dernière :
${page(p)}

Si ${profil(p).relance} vous prennent du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus de temps, avec les outils tels quels ou adaptés sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
