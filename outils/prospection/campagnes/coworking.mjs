// Campagne ciblée « coworking » (sous-campagne lancée le 27/11/2026 depuis la session « Audit campagnes ciblées ») :
// Pack Moyens généraux (PMG, 10 templates en vente) présenté aux coworkings et centres d'affaires indépendants pour
// l'exploitation du lieu (vérifications du bâtiment, maintenance, contrats fournisseurs, salles), avec l'ouverture sur du
// sur-mesure. Page : /concepts/coworking/. Structure : docs/prospection/mail-type-packs-niches.md.
// Angle : l'exploitation du lieu, jamais la réservation par les membres (beaucoup ont déjà un logiciel pour eux).
// Texte validé par Quentin avant tout envoi (docs/prospection/campagne-coworking.md). Le serveur ajoute la signature
// « Bandeau » et la mention d'opposition : ne jamais les écrire ici. Aucun logiciel concurrent cité.
import { TEMPLATES } from '../../packs/donnees.mjs';

export const campagne = {
  id: 'coworking',
  nom: 'Coworkings et centres d\'affaires · pack Moyens généraux prêt à l\'emploi',
  vague: 'cible-coworking',
  segment: 'Coworkings et centres d\'affaires indépendants',
  produit: { code: 'PMG', nom: 'Pack Moyens généraux', pack: 'moyens-generaux' },
  concept: 'https://qm-engineering.fr/concepts/coworking/',
  demo: 'https://qm-engineering.fr/templates/verifications/?demo',
};

// Prix du pack lus sur https://qm-engineering.fr/packs/moyens-generaux/ le 27/11/2026 (223 € au lieu de 298 €) :
// à relire avant chaque nouveau lot. Fourchette des outils seuls calculée depuis outils/packs/donnees.mjs.
const PACK = { prix: 223, total: 298 };
const CODES = ['PRC', 'VHC', 'ARD', 'GMA', 'VRF', 'SDR', 'BSC', 'CTR', 'ACH', 'EVT'];
const prix = CODES.map((c) => TEMPLATES[c].prix / 100);
const MIN = Math.min(...prix), MAX = Math.max(...prix);
if (prix.reduce((a, b) => a + b, 0) !== PACK.total) throw new Error('Prix du pack Moyens généraux à relire : la somme des outils a changé.');

const SITE = 'https://qm-engineering.fr';
const court = (p) => String(p.id).slice(0, 50);
// Liens traçables par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=cw-<id>.
const utm = (p) => `utm_campaign=cw-${court(p)}`;
const page = (p) => `${campagne.concept}?${utm(p)}`;
const pack = (p) => `${SITE}/packs/moyens-generaux/?${utm(p)}`;
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');

// « de » élidé devant une voyelle ou un h ; contractions « du » (Le), « des » (Les).
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

export const objet = (p) => `${p.nom} : les contrôles, la maintenance et les contrats de votre lieu au même endroit`;

export const texte = (p) => `Bonjour,

Je suis Quentin Morel, ingénieur : je conçois des outils de gestion pour les petites entreprises (QME).

J'ai consulté le site ${de(p.nom)}, ${a(p.ville)}${fait(p) ? ` : ${fait(p)}` : ''}. Derrière l'accueil d'un lieu de travail partagé, il y a les vérifications du bâtiment qui reçoit du public (électricité, extincteurs, éclairage de sécurité), l'entretien de la climatisation et des équipements, les contrats de ménage, d'internet et de sécurité, les achats et l'occupation des salles. Tout cela se suit souvent sur des carnets séparés, et c'est le jour de la commission de sécurité, ou quand un contrat vient d'être reconduit, qu'on s'en rend compte.

J'ai réuni dix outils prêts à l'emploi dans un pack « Moyens généraux », en ligne, sur ordinateur comme sur téléphone. Ceux qui servent le plus pour un lieu comme le vôtre :
- Vérifications réglementaires : chaque contrôle à sa périodicité, l'échéance qui approche signalée, les observations suivies jusqu'à la levée ;
- Maintenance préventive : climatisation, chauffage, imprimantes et autres équipements suivis à la date ou au compteur, pannes et coûts ;
- Contrats fournisseurs : la date limite de résiliation calculée pour chaque contrat, avant la tacite reconduction ;
- Réservation de salles et bureaux : ce qui est libre maintenant, sans double réservation, et le taux d'occupation ;
- Demandes d'achat, parc informatique et organisateur d'événement pour le reste (fournitures, matériel, afterworks).

Vous pouvez les essayer tout de suite, sans inscription, sur des données fictives :
${page(p)}

Le pack coûte ${PACK.prix} € au lieu de ${PACK.total} €. C'est un achat unique, sans abonnement ni renouvellement, et chaque outil s'achète aussi seul si un seul vous sert (de ${MIN} à ${MAX} €). Chacun a 14 jours d'essai gratuit avec vos propres données, sans carte bancaire :
${pack(p)}

C'est un ensemble tout prêt. Si votre lieu demande autre chose (plusieurs sites ou étages, vos propres grilles de contrôle, vos catégories de prestataires et d'achats), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui vous ferait gagner le plus de temps.

Bien à vous,`;

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet des outils d'exploitation que je vous ai présentés la semaine dernière (vérifications du bâtiment, maintenance, contrats fournisseurs, salles) :
${page(p)}

Si le suivi des contrôles, de l'entretien ou des préavis de vos prestataires vous prend du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus de temps, avec les outils tels quels ou adaptés sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
