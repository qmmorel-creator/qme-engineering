// Campagne ciblée « btp » (demande de Quentin du 25/11/2026) : Pack Chef de projet BTP (PBT, 192 € au lieu de 256 €,
// 8 templates en vente) présenté comme prêt à l'emploi, avec l'ouverture sur du sur-mesure. Page : /concepts/btp/.
// Deux profils, un seul problème d'entrée par mail :
//  - « moe » (architectes qui assurent la direction des travaux, maîtres d'œuvre d'exécution, économistes, OPC) :
//    réserves non levées et DOE incomplet à la réception → Levée de réserves (RSV) ;
//  - « eg » (petites entreprises générales) : pièces de vigilance des sous-traitants et avenants → Conformité des
//    sous-traitants (STR).
// Texte validé par Quentin avant tout envoi (docs/prospection/campagne-btp.md). Le serveur ajoute la signature
// « Bandeau » et la mention d'opposition : ne jamais les écrire ici. Aucun logiciel concurrent cité.

export const campagne = {
  id: 'btp',
  nom: 'BTP · pack Chef de projet prêt à l\'emploi',
  vague: 'cible-btp',
  segment: 'Maîtrise d\'œuvre et entreprises générales',
  produit: { code: 'PBT', nom: 'Pack Chef de projet BTP', pack: 'chef-de-projet-btp' },
  concept: 'https://qm-engineering.fr/concepts/btp/',
  demo: 'https://qm-engineering.fr/templates/reserves/?demo',
};

const SITE = 'https://qm-engineering.fr';
const court = (p) => String(p.id).slice(0, 50);
// Liens traçables par prospect (GoatCounter garde utm_campaign) : ?utm_campaign=btp-<id>.
const utm = (p) => `utm_campaign=btp-${court(p)}`;
const page = (p) => `${campagne.concept}?${utm(p)}`;
const autres = (p) => `${SITE}/pro/?${utm(p)}`;
const fait = (p) => String(p.fait || '').trim().replace(/[.;\s]+$/, '');
const de = (nom) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(String(nom).trim()) ? `d'${nom}` : `de ${nom}`);
const eg = (p) => p.profil === 'eg';

// Le problème d'entrée, l'outil correspondant et sa démo, selon le profil.
const entree = (p) => (eg(p)
  ? {
    probleme: 'Attestations de vigilance des sous-traitants qui expirent en cours de chantier, acceptation par le maître d\'ouvrage pas encore reçue, avenants suivis dans la messagerie : c\'est souvent au moment de régler une situation que l\'on découvre la pièce manquante.',
    outil: 'un outil de conformité des sous-traitants',
    points: [
      'il tient, pour chaque entreprise, ses pièces (URSSAF, Kbis, assurance décennale…) avec leur date de fin ;',
      'il prévient avant l\'expiration et prépare la relance ;',
      'il suit l\'acceptation de chaque sous-traitant, opération par opération.',
    ],
    demo: `${SITE}/templates/sous-traitants/?demo&${utm(p)}`,
  }
  : {
    probleme: 'Réserves encore ouvertes des semaines après la réception, entreprises à relancer une par une, DOE incomplet qui retarde la remise au maître d\'ouvrage : c\'est souvent là que la fin d\'une opération s\'éternise.',
    outil: 'un outil de levée des réserves',
    points: [
      'chaque réserve est localisée, attribuée à une entreprise et datée ;',
      'les retards passent en tête de liste, entreprise par entreprise ;',
      'la liste à transmettre et le procès-verbal de levée s\'impriment directement.',
    ],
    demo: `${SITE}/templates/reserves/?demo&${utm(p)}`,
  });

export const objet = (p) => (eg(p)
  ? `${p.nom} : les pièces de vos sous-traitants à jour, sans relances à la main`
  : `${p.nom} : des réserves levées et un DOE complet, sans relances à la main`);

export const texte = (p) => {
  const e = entree(p);
  return `Bonjour,

Je suis Quentin Morel, ingénieur : je conçois des outils de gestion pour les petites entreprises (QME).

J'ai consulté le site ${de(p.nom)}, à ${p.ville}${fait(p) ? ` : ${fait(p)}` : ''}. ${e.probleme}

J'ai conçu ${e.outil}, prêt à l'emploi, en ligne, sur ordinateur au bureau comme sur téléphone au chantier :
${e.points.map((x) => `- ${x}`).join('\n')}

Vous pouvez l'essayer tout de suite, sans inscription, sur une opération fictive :
${e.demo}

Il fait partie d'un pack de huit outils qui suivent une opération de la préparation à la réception : planning, sous-traitants, visas, suivi par lot (marchés, avenants, situations), comptes rendus de chantier, non-conformités, réserves et DOE. Chaque étape, avec sa démo, est présentée ici :
${page(p)}

C'est un ensemble tout prêt. Si votre organisation demande autre chose (vos lots et vos codes de visa, vos modèles de procès-verbaux, plusieurs opérations et intervenants), je peux aussi le faire sur mesure, en fonction de votre besoin.

Si cela vous parle, répondez simplement à ce message : trente minutes d'échange suffisent pour voir ce qui vous ferait gagner le plus de temps.

D'autres outils prêts à l'emploi peuvent aussi vous servir (générateur de devis, trésorerie, relance des impayés, document unique, gestion de flotte…) : ${autres(p)}

Bien à vous,`;
};

// Relance unique à J+7, dans le même fil, seulement sans réponse (vérifiée dans Gmail par la session).
export const relance = (p) => `Bonjour,

Je me permets de revenir vers vous au sujet des outils de suivi d'opération que je vous ai présentés la semaine dernière :
${page(p)}

Si ${eg(p) ? 'les pièces de vos sous-traitants ou le suivi des avenants' : 'la levée des réserves ou la collecte du DOE'} vous prennent du temps, un échange de 30 minutes suffit pour voir ce qui vous ferait gagner le plus de temps, avec les outils tels quels ou adaptés sur mesure. Sinon, dites-le-moi simplement : je ne vous relancerai pas.

Bien à vous,`;
