// Campagne ciblée « proprete » (demande du 27/11/2026) : Pack Petite entreprise (PPE, en vente) présenté aux
// entreprises de propreté et de nettoyage indépendantes de 10 à 50 salariés, prêt à l'emploi, avec l'ouverture sur
// du sur-mesure. Page : /concepts/proprete/. Structure du mail : docs/prospection/mail-type-packs-niches.md (renvoi
// vers le pack, achat unique, chaque outil seul, 14 jours d'essai).
// Prix calculés depuis netlify/lib/packs.mjs et outils/packs/donnees.mjs (même source que /packs/petite-entreprise/),
// jamais écrits à la main. Texte validé par Quentin avant tout envoi (docs/prospection/campagne-proprete.md).
// Le serveur ajoute la signature « Bandeau » et la mention d'opposition : ne jamais les écrire ici.
import { PACKS, prixPack } from '../../../netlify/lib/packs.mjs';
import { TEMPLATES } from '../../packs/donnees.mjs';

const PACK = PACKS.PPE;
const prixSeuls = PACK.produits.map((c) => TEMPLATES[c].prix);
const { valeur, prix } = prixPack(prixSeuls);
const euros = (c) => `${Math.round(c / 100)} €`;
const PRIX = {
  pack: euros(prix),
  valeur: euros(valeur),
  min: Math.round(Math.min(...prixSeuls) / 100),
  max: Math.round(Math.max(...prixSeuls) / 100),
};

export const campagne = {
  id: 'proprete',
  nom: 'Propreté · Pack Petite entreprise prêt à l\'emploi',
  vague: 'cible-proprete',
  segment: 'Entreprises de propreté et de nettoyage (10 à 50 salariés)',
  produit: { code: 'PPE', nom: PACK.nom, pack: PACK.slug },
  concept: 'https://qm-engineering.fr/concepts/proprete/',
  demo: 'https://qm-engineering.fr/templates/planning-equipe/?demo',
};

const SITE = 'https://qm-engineering.fr';
const court = (p) => String(p.id).slice(0, 50);
// Liens traçables par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=proprete-<id>.
const utm = (p) => `utm_campaign=proprete-${court(p)}`;
const page = (p) => `${campagne.concept}?${utm(p)}`;
const pack = (p) => `${SITE}/packs/${PACK.slug}/?${utm(p)}`;
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');
const de = (nom) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(String(nom).trim()) ? `d'${nom}` : `de ${nom}`);

export const objet = (p) => `${p.nom} : vos plannings, vos congés et vos obligations d'employeur au même endroit`;

export const texte = (p) => `Bonjour,

Je suis Quentin Morel, ingénieur : je conçois des outils de gestion pour les petites entreprises (QME).

J'ai consulté le site ${de(p.nom)}, à ${p.ville}${fait(p) ? ` : ${fait(p)}` : ''}. Dans une entreprise de propreté, les agents à temps partiel répartis sur de nombreux sites, les absences à remplacer le matin même et les arrivées tout au long de l'année se suivent souvent sur un tableur et dans le téléphone du gérant ; les entretiens professionnels et la mise à jour du document unique passent alors au second plan.

J'ai réuni neuf outils prêts à l'emploi dans un pack « Petite entreprise », en ligne, sur ordinateur comme sur téléphone :
- Planning d'équipe : chaque site client couvert, la charge de chaque agent, les trous et les surcharges signalés ;
- Congés et absences : soldes calculés, chevauchements dans une même équipe signalés avant validation ;
- Arrivées et départs : la checklist de chaque nouvel agent (DPAE, clés, badges, tenue), le matériel récupéré au départ ;
- Entretiens professionnels : les échéances de chaque salarié calculées, la trame et le compte rendu prêts ;
- Document unique : les risques par unité de travail (produits de nettoyage, travail en hauteur, trajets), le plan d'actions et la mise à jour annuelle ;
- Notes de frais : les trajets entre les sites au barème kilométrique ;
- Comptes rendus : les réunions des chefs d'équipe, avec des actions suivies ;
- Trésorerie : douze mois devant vous, salaires et charges compris ;
- Tableau de bord : vos indicateurs du mois (absentéisme, marge, délai de paiement des clients) face à vos objectifs.

Vous pouvez les essayer tout de suite, sans inscription, sur des données fictives :
${page(p)}

Le pack coûte ${PRIX.pack} au lieu de ${PRIX.valeur}. C'est un achat unique, sans abonnement ni renouvellement, et chaque outil s'achète aussi seul si un seul vous sert (de ${PRIX.min} à ${PRIX.max} €). Chacun a 14 jours d'essai gratuit avec vos propres données, sans carte bancaire :
${pack(p)}

C'est un ensemble tout prêt. Si votre organisation demande autre chose (vos sites et vos fréquences de passage, vos heures contractuelles, un accès pour chaque chef d'équipe), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui vous ferait gagner le plus de temps.

Bien à vous,`;

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet des outils de gestion d'équipe que je vous ai présentés la semaine dernière :
${page(p)}

Si le planning des agents, les congés ou les obligations d'employeur (entretiens professionnels, document unique) vous prennent du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus de temps, avec les outils tels quels ou adaptés sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
