// Campagne ciblée « architectes d'intérieur » (sous-campagne de l'audit des campagnes ciblées, 27/11/2026) : Pack
// Freelance : trouver ses clients (PFC, en vente) présenté aux architectes d'intérieur et décorateurs indépendants ou
// petites agences (moins de 10 personnes) ; pack complémentaire cité : Freelance : chiffrer, facturer, encaisser (PFG).
// Page : /concepts/architectes-interieur/ ; pack : /packs/freelance-clients/.
// Structure : docs/prospection/mail-type-packs-niches.md. Prix lus le 27/11/2026 sur les pages des packs
// (PFC 76 € au lieu de 102 €, outils seuls de 12 à 25 € ; PFG 118 € au lieu de 158 €) : les relire avant chaque lot.
// Texte validé par Quentin avant tout envoi (voir docs/prospection/campagne-architectes-interieur.md).
// Le serveur ajoute la signature « Bandeau » et la mention d'opposition : ne jamais les écrire ici.

export const campagne = {
  id: 'architectes-interieur',
  nom: 'Architectes d\'intérieur · pack Freelance : trouver ses clients',
  vague: 'cible-architectes-interieur',
  segment: 'Architectes d\'intérieur et décorateurs indépendants ou petites agences (moins de 10 personnes)',
  produit: { code: 'PFC', nom: 'Pack Freelance : trouver ses clients', pack: 'freelance-clients' },
  concept: 'https://qm-engineering.fr/concepts/architectes-interieur/',
  demo: 'https://qm-engineering.fr/concepts/architectes-interieur/',
};

// Liens traçables par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=ai-<id>.
const ref = (p) => `ai-${String(p.id)}`.slice(0, 64);
const lien = (p) => `${campagne.concept}?utm_campaign=${ref(p)}`;
const pack = (p) => `https://qm-engineering.fr/packs/freelance-clients/?utm_campaign=${ref(p)}`;
// Le fait relevé sur le site, sans point final en double.
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');

// « de » élidé devant une voyelle ou un h ; contractions « du » (Le) et « des » (Les).
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

export const objet = (p) => `${p.nom} : du premier rendez-vous au projet signé, sans rien perdre en route`;

export const texte = (p) => `Bonjour,

Je suis Quentin Morel, ingénieur : je conçois des outils de gestion pour les petites entreprises (QME).

J'ai consulté le site ${de(p.nom)}, ${a(p.ville)}${fait(p) ? ` : ${fait(p)}` : ''}. En architecture d'intérieur, entre le premier appel d'un client et la signature, il y a la visite, la proposition à chiffrer, les références à montrer et les relances : c'est souvent là que des projets se perdent, quand tout tient dans la boîte mail, un dossier de photos et un tableur.

J'ai réuni six outils prêts à l'emploi dans un pack « Freelance : trouver ses clients », en ligne, sur ordinateur comme sur téléphone :
- Appel découverte : l'objectif, les questions par phase (besoin, budget, délais, décision) et la prochaine étape datée ;
- Propositions commerciales : contexte, prestations et deux ou trois options comparées côte à côte, avec un planning ;
- Références et plaquette : vos réalisations rangées une fois, et une plaquette adaptée à chaque prospect ;
- CRM et prospection : chaque contact à son étape, les relances du jour, devis et factures suivis ;
- Calendrier éditorial : vos publications planifiées, pour rester visible entre deux projets ;
- Suivi de candidatures : les appels d'offres et consultations, pièces et dates limites.

Vous pouvez les essayer tout de suite, sans inscription, sur des données fictives :
${lien(p)}

Le pack coûte 76 € au lieu de 102 €. C'est un achat unique, sans abonnement ni renouvellement, et chaque outil s'achète aussi seul si un seul vous sert (de 12 à 25 €). Chacun a 14 jours d'essai gratuit avec vos propres données, sans carte bancaire :
${pack(p)}

Pour la suite, un second pack, « Freelance : chiffrer, facturer, encaisser » (118 € au lieu de 158 €), compare le temps passé sur chaque projet au budget du devis, prépare les devis et relance les impayés.

C'est un ensemble tout prêt. Si votre agence demande autre chose (vos phases de mission et vos honoraires, vos listes de fournitures, le suivi des artisans sur le chantier), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui vous ferait gagner le plus de temps.

Bien à vous,`;

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet des outils que je vous ai présentés la semaine dernière, du premier rendez-vous avec un client à la signature du projet :
${lien(p)}

Si la préparation des propositions, le choix des références à montrer ou le suivi des relances vous prennent du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus de temps, avec les outils tels quels ou adaptés sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
