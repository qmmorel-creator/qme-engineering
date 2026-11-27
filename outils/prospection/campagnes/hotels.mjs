// Campagne ciblée « hôtels » (27/11/2026, sous-campagne de la session « Audit campagnes ciblées ») : Pack Exploitation
// et maintenance (PXP, 95 € au lieu de 119 €) présenté aux hôtels indépendants (hors chaînes, franchises, groupes et
// résidences de tourisme), avec ou sans restaurant. Page : /concepts/hotels/ ; pack : /packs/exploitation/.
// Structure du mail type : docs/prospection/mail-type-packs-niches.md (exemple hôtels). Prix lus sur la page du pack et
// dans outils/packs/donnees.mjs (VRF 35 €, GMA 39 €, STK 25 €, NCF 20 €) le 27/11/2026.
// Texte validé par Quentin avant tout envoi (docs/prospection/campagne-hotels.md).
// Le serveur ajoute la signature « Bandeau » et la mention d'opposition : ne jamais les écrire ici.

export const campagne = {
  id: 'hotels',
  nom: 'Hôtels indépendants · pack Exploitation et maintenance',
  vague: 'cible-hotels',
  segment: 'Hôtels indépendants (avec ou sans restaurant)',
  produit: { code: 'PXP', nom: 'Pack Exploitation et maintenance', pack: 'exploitation' },
  concept: 'https://qm-engineering.fr/concepts/hotels/',
  pack: 'https://qm-engineering.fr/packs/exploitation/',
};

// Liens traçables par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=hotels-<id>.
const ref = (p) => `hotels-${String(p.id)}`.slice(0, 64);
const lien = (p) => `${campagne.concept}?utm_campaign=${ref(p)}`;
const lienPack = (p) => `${campagne.pack}?utm_campaign=${ref(p)}`;
// Le fait relevé sur le site, sans point final en double.
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');

// « de » élidé ou contracté : « le site de l'Hôtel du Lac », « le site du Relais… », « le site des Glycines ».
const de = (nom) => {
  const n = String(nom).trim();
  if (/^Le\s/.test(n)) return `du ${n.slice(3)}`;
  if (/^Les\s/.test(n)) return `des ${n.slice(4)}`;
  if (/^L'|^L’/.test(n)) return `de ${n}`;
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(n) ? `de l'${n}` : `de ${n}`;
};
const deNom = (nom) => (/^h[ôo]tel\b/i.test(String(nom).trim()) ? `de l'${String(nom).trim()}` : de(nom));
const a = (ville) => {
  const v = String(ville).trim();
  if (/^Le\s/.test(v)) return `au ${v.slice(3)}`;
  if (/^Les\s/.test(v)) return `aux ${v.slice(4)}`;
  return `à ${v}`;
};

export const objet = (p) => `${p.nom} : vos contrôles, votre maintenance et vos stocks suivis au même endroit`;

export const texte = (p) => `Bonjour,

Je suis Quentin Morel, ingénieur : je conçois des outils de gestion pour les petites entreprises (QME).

J'ai consulté le site ${deNom(p.nom)}, ${a(p.ville)}${fait(p) ? ` : ${fait(p)}` : ''}. Dans un hôtel indépendant, les vérifications obligatoires (extincteurs, électricité, gaz, désenfumage, éclairage de sécurité), l'entretien des chambres et des équipements, et les stocks de linge et de produits d'accueil se suivent souvent sur des carnets séparés, et c'est le jour de la visite de sécurité qu'on cherche le dernier rapport.

J'ai réuni quatre outils prêts à l'emploi dans un pack « Exploitation et maintenance », en ligne, sur ordinateur comme sur téléphone :
- Vérifications réglementaires : chaque contrôle à sa périodicité, l'échéance qui approche signalée, le rapport rangé ;
- Maintenance préventive : chambres et équipements suivis à la date ou au compteur, bons d'intervention et coûts ;
- Stocks et inventaire : seuils d'alerte et liste à commander pour le linge, l'accueil et le bar ;
- Non-conformités : réclamation ou écart constaté, cause, action corrective et vérification.

Vous pouvez les essayer tout de suite, sans inscription, sur des données fictives :
${lien(p)}

Le pack coûte 95 € au lieu de 119 €. C'est un achat unique, sans abonnement ni renouvellement, et chaque outil s'achète aussi seul si un seul vous sert (de 20 à 39 €). Chacun a 14 jours d'essai gratuit avec vos propres données, sans carte bancaire :
${lienPack(p)}

C'est un ensemble tout prêt. Si votre organisation demande autre chose (plusieurs établissements, vos propres grilles de contrôle, un lien avec votre logiciel de réservation), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui vous ferait gagner le plus de temps.

Bien à vous,`;

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet du pack « Exploitation et maintenance » que je vous ai présenté la semaine dernière (vérifications obligatoires, entretien des chambres et des équipements, stocks de linge et d'accueil) :
${lien(p)}

Si le suivi des contrôles ou de l'entretien ${deNom(p.nom)} vous prend du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus de temps, avec les outils tels quels ou adaptés sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
