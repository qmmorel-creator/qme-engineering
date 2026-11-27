// Campagne ciblée « campings » (27/11/2026) : Pack Exploitation et maintenance (PXP, en vente : Vérifications
// réglementaires VRF, Maintenance préventive GMA, Stocks et inventaire STK, Non-conformités NCF) présenté aux campings
// indépendants (hors chaînes, groupes, franchises et campings municipaux en régie), angle « préparer l'ouverture ».
// Page : /concepts/campings/ ; pack : /packs/exploitation/. Structure : docs/prospection/mail-type-packs-niches.md.
// Prix lus le 27/11/2026 sur https://qm-engineering.fr/packs/exploitation/ et dans outils/packs/donnees.mjs :
// pack 95 € au lieu de 119 €, outils seuls de 20 € (NCF) à 39 € (GMA), 14 jours d'essai sans carte bancaire.
// Piscine et aires de jeux ne sont pas dans la base des vérifications : le mail n'en parle pas comme d'un contrôle intégré.
// Texte validé par Quentin avant tout envoi (voir docs/prospection/campagne-campings.md).
// Le serveur ajoute la signature « Bandeau » et la mention d'opposition : ne jamais les écrire ici.

export const campagne = {
  id: 'campings',
  nom: 'Campings indépendants · Pack Exploitation et maintenance',
  vague: 'cible-campings',
  segment: 'Campings indépendants (locatifs, bâtiments recevant du public)',
  produit: { code: 'PXP', nom: 'Pack Exploitation et maintenance', pack: 'exploitation' },
  concept: 'https://qm-engineering.fr/concepts/campings/',
  pack: 'https://qm-engineering.fr/packs/exploitation/',
};

// Liens traçables par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=campings-<id>.
const ref = (p) => `campings-${String(p.id)}`.slice(0, 64);
const lien = (p) => `${campagne.concept}?utm_campaign=${ref(p)}`;
const lienPack = (p) => `${campagne.pack}?utm_campaign=${ref(p)}`;
// Le fait relevé sur le site, en fin de phrase, sans point final en double.
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');

// « le site du Camping des Pins », « du Camping… » (Le Camping…), « des Mouettes » (Les…), sinon « du camping La Grange ».
const du = (nom) => {
  const n = String(nom).trim();
  if (/^camping\s/i.test(n)) return `du ${n}`;
  if (/^le\s+(camping|domaine|château)\s/i.test(n)) return `du ${n.slice(3)}`;
  if (/^(domaine|château)\s/i.test(n)) return `du ${n}`;
  return `du camping ${n}`;
};
const a = (ville) => {
  const v = String(ville).trim();
  if (/^Le\s/.test(v)) return `au ${v.slice(3)}`;
  if (/^Les\s/.test(v)) return `aux ${v.slice(4)}`;
  return `à ${v}`;
};

export const objet = (p) => `${p.nom} : vos locatifs, vos contrôles et vos stocks suivis au même endroit`;

export const texte = (p) => `Bonjour,

Je suis Quentin Morel, ingénieur : je conçois des outils de gestion pour les petites entreprises (QME).

J'ai consulté le site ${du(p.nom)}, ${a(p.ville)}${fait(p) ? ` : ${fait(p)}` : ''}. L'hiver, c'est le moment de préparer l'ouverture : locatifs à remettre en état, équipements à réviser, vérifications des bâtiments qui reçoivent du public à programmer, commandes de la boutique et du snack. Le tout se suit souvent sur des carnets séparés, et c'est en pleine saison qu'on cherche le dernier rapport ou qu'on découvre la panne.

J'ai réuni quatre outils prêts à l'emploi dans un pack « Exploitation et maintenance », en ligne, sur ordinateur comme sur téléphone :
- Maintenance préventive : chaque mobil-home, chalet ou équipement suivi à la date ou au compteur, bons d'intervention et coûts ;
- Vérifications réglementaires : pour l'accueil, le bar, le restaurant et les sanitaires, chaque contrôle à sa périodicité, l'échéance qui approche signalée, le rapport rangé ;
- Stocks et inventaire : seuils d'alerte et liste à commander pour la boutique et le snack ;
- Non-conformités : réclamation ou écart constaté, cause, action corrective et vérification.

Vous pouvez les essayer tout de suite, sans inscription, sur des données fictives :
${lien(p)}

Le pack coûte 95 € au lieu de 119 €. C'est un achat unique, sans abonnement ni renouvellement, et chaque outil s'achète aussi seul si un seul vous sert (de 20 à 39 €). Chacun a 14 jours d'essai gratuit avec vos propres données, sans carte bancaire :
${lienPack(p)}

C'est un ensemble tout prêt. Si votre camping demande autre chose (vos plans d'entretien par type de locatif, vos propres grilles de contrôle pour la piscine ou les aires de jeux, un suivi par équipe), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui vous ferait gagner le plus de temps.

Bien à vous,`;

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet des outils de préparation de saison que je vous ai présentés la semaine dernière (maintenance des locatifs, vérifications, stocks, non-conformités) :
${lien(p)}

Si la préparation de l'ouverture vous prend du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus de temps, avec le pack tel quel ou adapté sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
