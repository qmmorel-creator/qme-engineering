// Campagne ciblée « clubs-competition » (lancée le 27/11/2026 depuis la session « Audit campagnes ciblées ») :
// Pack Associations et clubs (PAS, 7 outils, en vente) présenté aux clubs et associations sportives qui organisent
// eux-mêmes une compétition ou une course annuelle (judo, gymnastique, escalade, trail, triathlon, natation…).
// Structure : docs/prospection/mail-type-packs-niches.md. Page : /concepts/clubs-competition/.
// Prix lus le 27/11/2026 sur /packs/associations/ et dans outils/packs/donnees.mjs : pack 156 € au lieu de 209 €,
// outils seuls de 19 à 49 €, 14 jours d'essai sans carte bancaire, achat unique sans renouvellement.
// Texte validé par Quentin avant tout envoi (voir docs/prospection/campagne-clubs-competition.md).
// Le serveur ajoute la signature « Bandeau » et la mention d'opposition : ne jamais les écrire ici.

export const campagne = {
  id: 'clubs-competition',
  nom: 'Clubs sportifs qui organisent leur compétition · Pack Associations et clubs',
  vague: 'cible-clubs-competition',
  segment: 'Clubs et associations sportives organisateurs d\'une compétition ou d\'une course annuelle',
  produit: { code: 'PAS', nom: 'Pack Associations et clubs', pack: 'associations' },
  concept: 'https://qm-engineering.fr/concepts/clubs-competition/',
  demo: 'https://qm-engineering.fr/templates/competition/?demo',
};

// Lien traçable par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=clubs-competition-<id>.
const ref = (p) => `clubs-competition-${String(p.id)}`.slice(0, 64);
const lien = (p) => `${campagne.concept}?utm_campaign=${ref(p)}`;
const pack = (p) => `https://qm-engineering.fr/packs/associations/?utm_campaign=${ref(p)}`;
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');

// « le site du Judo Club de Vannes », « de l'Entente… », « de la Gymnastique… » ; `p.de` force la forme si besoin.
const MASC = /^(club|judo|karat[ée]|cercle|stade|team|racing|triathlon|trail|running|cross|gym\b|gymnase|v[ée]lo|cyclo|ski|tennis|badminton|ping|tennis de table|foyer|sporting|groupe|comit[ée] des f[êe]tes)/i;
const FEM = /^(gymnastique|natation|section|soci[ée]t[ée]|f[ée]d[ée]ration|ligue|escalade|course|jeunesse)/i;
const de = (p) => {
  if (p.de) return p.de;
  const n = String(p.nom).trim();
  if (/^Le\s/.test(n)) return `du ${n.slice(3)}`;
  if (/^Les\s/.test(n)) return `des ${n.slice(4)}`;
  if (/^La\s/.test(n)) return `de ${n}`;
  if (/^L'/.test(n)) return `de ${n}`;
  if (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(n)) return `de l'${n}`;
  if (MASC.test(n)) return `du ${n}`;
  if (FEM.test(n)) return `de la ${n}`;
  if (/\bClub\b/.test(n)) return `du ${n}`;
  return `du club ${n}`;
};
const a = (ville) => {
  const v = String(ville).trim();
  if (/^Le\s/.test(v)) return `au ${v.slice(3)}`;
  if (/^Les\s/.test(v)) return `aux ${v.slice(4)}`;
  return `à ${v}`;
};

export const objet = (p) => `${p.nom} : votre compétition, de l'inscription au podium`;

export const texte = (p) => `Bonjour,

Je suis Quentin Morel, ingénieur : je conçois des outils de gestion pour les petites structures, dont les associations (QME).

J'ai consulté le site ${de(p)}, ${a(p.ville)}${fait(p) ? ` : ${fait(p)}` : ''}. Dans un club, la compétition de l'année repose sur quelques bénévoles : les inscrits et leurs dossards dans un tableur, les vagues refaites à la main, le classement qu'on attend pendant que la table de marque additionne, les postes du jour J répartis par messages, et autour, le dossier de subvention et l'assemblée générale à préparer.

J'ai réuni sept outils prêts à l'emploi dans un pack « Associations et clubs », en ligne, sur ordinateur comme sur téléphone, avec une seule clé pour le bureau :
- Gestion de compétition : inscrits et dossards, vagues et horaires calculés, scores saisis au téléphone, classement en direct affiché sur écran ;
- Bénévoles et créneaux : qui tient quel poste à quelle heure, les trous et les doublons signalés avant le jour J ;
- Organisateur d'événement : le rétroplanning daté depuis le jour de la compétition, le budget et les prestataires ;
- Inscriptions associatives : adhérents, créneaux, liste d'attente et paiements de la saison ;
- Subventions : un dossier par financeur, pièces et échéances suivies jusqu'au bilan ;
- Assemblée générale : convocation, quorum, votes et procès-verbal selon vos statuts ;
- Trésorerie prévisionnelle : le solde du club mois par mois, sur douze mois.

Vous pouvez les essayer tout de suite, sans inscription, sur des données fictives :
${lien(p)}

Le pack coûte 156 € au lieu de 209 €. C'est un achat unique, sans abonnement ni renouvellement, et chaque outil s'achète aussi seul si un seul vous sert (de 19 à 49 €). Chacun a 14 jours d'essai gratuit avec vos propres données, sans carte bancaire :
${pack(p)}

C'est un ensemble tout prêt. Si votre club demande autre chose (votre barème et vos règles de classement, des inscriptions ouvertes en ligne aux participants extérieurs, la publication de vos résultats), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui ferait gagner le plus de temps à vos bénévoles.

Bien à vous,`;

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet des outils pour l'organisation de votre compétition que je vous ai présentés la semaine dernière :
${lien(p)}

Si les inscrits, les vagues, le classement ou les bénévoles du jour J prennent du temps à votre bureau, un échange de 30 minutes suffit pour voir ce qui vous en ferait gagner le plus, avec le pack tel quel ou adapté sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
