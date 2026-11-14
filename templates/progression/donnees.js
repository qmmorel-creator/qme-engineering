// Base intégrée de la progression pédagogique : jours, statuts de séance, déroulé type d'une séquence,
// modèles de structure de progression (génériques), banque de verbes d'objectifs rangés selon les six
// niveaux de la taxonomie de Bloom révisée, conseils. Aucun programme officiel, aucun calendrier de
// vacances scolaires, aucune donnée d'élève ni d'établissement. Rédigée pour QME le 14/11/2026
// (voir docs/templates/fiches/progression.md).
window.BASE = {
  version: '2026-11-14',

  // Réglages de départ (modifiables dans les Réglages).
  reglages: {
    alsaceMoselle: false, // ajoute le Vendredi saint et le 26 décembre aux jours sans cours
    sauteVacances: true, // l'alternance des semaines A et B ne compte que les semaines avec des cours
    feriesIgnores: [], // fériés qui ne suppriment pas de cours (identifiants)
    reserve: 10, // part des heures gardée pour les imprévus quand un modèle propose des durées (%)
  },

  // Jours de la semaine (1 = lundi … 6 = samedi ; le dimanche n'a jamais de cours).
  jours: ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  joursCourts: ['', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],

  // Durées proposées pour un créneau (en heures).
  durees: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],

  // Statuts d'une séance. Seules les séances « faites » comptent dans l'avancement réel.
  statuts: [
    { code: 'faite', nom: 'Faite', aide: 'Le cours a eu lieu : ses heures comptent pour la séquence.' },
    { code: 'prevue', nom: 'Prévue', aide: 'Séance préparée pour une date à venir.' },
    { code: 'reportee', nom: 'Reportée', aide: 'Le contenu est à refaire plus tard : il peut être replacé au prochain créneau.' },
    { code: 'annulee', nom: 'Annulée', aide: 'Le cours n\'a pas eu lieu (sortie, absence, examen…) : le créneau est perdu.' },
  ],
  motifs: ['Sortie ou voyage', 'Absence', 'Examen ou épreuve', 'Réunion ou formation', 'Événement de l\'établissement', 'Autre'],

  // Déroulé type d'une séquence : étapes proposées pour décrire une séance (texte libre ensuite).
  etapes: [
    'Situation de départ et diagnostic',
    'Découverte',
    'Structuration et trace écrite',
    'Entraînement',
    'Remédiation ou approfondissement',
    'Évaluation',
    'Correction et bilan',
  ],

  // Modèles de structure de progression. Les durées sont des parts des heures disponibles de la classe
  // (après la réserve des Réglages) ; « periodes » crée une séquence par période entre deux vacances.
  // Les titres sont des repères génériques, à renommer.
  modeles: [
    { code: 'periodes', nom: 'Une séquence par période', description: 'Une séquence entre deux périodes de vacances, à la durée exacte des heures de la période.', periodes: true },
    { code: 'huit', nom: 'Huit séquences et un bilan', description: 'Huit séquences de même durée, puis révisions et bilan de fin d\'année.',
      sequences: [['Séquence 1', 11.5], ['Séquence 2', 11.5], ['Séquence 3', 11.5], ['Séquence 4', 11.5], ['Séquence 5', 11.5], ['Séquence 6', 11.5], ['Séquence 7', 11.5], ['Séquence 8', 11.5], ['Révisions et bilan', 8]] },
    { code: 'spirale', nom: 'Progression spiralaire', description: 'Trois thèmes repris trois fois : découverte, approfondissement, réinvestissement.',
      sequences: [['Thème A · découverte', 10], ['Thème B · découverte', 10], ['Thème C · découverte', 10], ['Thème A · approfondissement', 12], ['Thème B · approfondissement', 12], ['Thème C · approfondissement', 12], ['Thème A · réinvestissement', 11], ['Thème B · réinvestissement', 11], ['Thème C · réinvestissement', 12]] },
    { code: 'projet', nom: 'Apports puis projet', description: 'Quatre séquences d\'apports, un projet, puis une présentation et un bilan.',
      sequences: [['Apports 1', 15], ['Apports 2', 15], ['Apports 3', 15], ['Apports 4', 15], ['Projet', 30], ['Présentation et bilan', 10]] },
    { code: 'modules', nom: 'Formation en modules', description: 'Pour un groupe en formation : accueil et positionnement, quatre modules, évaluation finale.',
      sequences: [['Accueil et positionnement', 5], ['Module 1', 20], ['Module 2', 20], ['Module 3', 20], ['Module 4', 20], ['Évaluation finale et bilan', 15]] },
  ],

  // Verbes d'objectifs rangés selon les six niveaux du domaine cognitif de la taxonomie de Bloom, dans sa
  // version révisée (Anderson et Krathwohl, 2001). Noms des niveaux traduits ; listes de verbes rédigées
  // pour QME (verbes d'action observables, à l'infinitif), sans reprise d'une liste publiée.
  bloom: [
    { n: 1, nom: 'Se souvenir', aide: 'Retrouver une information apprise.', verbes: ['citer', 'nommer', 'définir', 'énumérer', 'reconnaître', 'identifier', 'repérer', 'restituer', 'réciter', 'lister', 'rappeler', 'situer'] },
    { n: 2, nom: 'Comprendre', aide: 'Expliquer avec ses mots, donner du sens.', verbes: ['expliquer', 'reformuler', 'résumer', 'décrire', 'illustrer', 'interpréter', 'classer', 'traduire', 'associer', 'distinguer', 'commenter', 'représenter'] },
    { n: 3, nom: 'Appliquer', aide: 'Utiliser une méthode dans une situation connue.', verbes: ['appliquer', 'calculer', 'utiliser', 'résoudre', 'construire', 'réaliser', 'exécuter', 'mettre en œuvre', 'compléter', 'tracer', 'manipuler', 'employer', 'développer'] },
    { n: 4, nom: 'Analyser', aide: 'Décomposer, relier, chercher les causes.', verbes: ['analyser', 'comparer', 'différencier', 'organiser', 'déduire', 'examiner', 'catégoriser', 'relier', 'hiérarchiser', 'questionner', 'schématiser', 'décomposer'] },
    { n: 5, nom: 'Évaluer', aide: 'Juger à partir de critères, argumenter.', verbes: ['évaluer', 'justifier', 'argumenter', 'critiquer', 'vérifier', 'défendre', 'estimer', 'choisir', 'valider', 'juger', 'contrôler', 'démontrer'] },
    { n: 6, nom: 'Créer', aide: 'Produire quelque chose de nouveau.', verbes: ['concevoir', 'créer', 'élaborer', 'inventer', 'rédiger', 'planifier', 'produire', 'composer', 'imaginer', 'proposer', 'formuler', 'modéliser'] },
  ],
  // Verbes difficiles à observer : l'objectif est signalé « à préciser » s'il commence par l'un d'eux.
  verbesVagues: ['savoir', 'connaître', 'connaitre', 'maîtriser', 'maitriser', 'apprendre', 'découvrir', 'aborder', 'voir', 'étudier', 'sensibiliser', 'aimer', 'appréhender', 'se familiariser', 'prendre conscience'],
  // Débuts de phrase ignorés pour trouver le verbe.
  amorces: ['l\'élève sera capable de', 'l\'élève est capable de', 'l\'apprenant sera capable de', 'le stagiaire sera capable de', 'être capable de', 'etre capable de', 'capable de', 'savoir', 'pouvoir', 'il s\'agit de', 'je sais', 'je suis capable de'],

  // Couleurs des classes et groupes, dans l'ordre de création (jamais générées).
  couleurs: ['#2E5A88', '#B84A34', '#C9971C', '#24221F', '#5B7F5E', '#7A5C99'],

  conseils: [
    ['Ton calendrier', 'Début et fin des cours, vacances de ta zone et jours sans cours : les jours fériés se calculent seuls.'],
    ['Tes classes', 'Les créneaux de chaque classe ou groupe (semaines A et B possibles) donnent les heures réellement disponibles.'],
    ['Tes séquences', 'Dans l\'ordre, avec leurs objectifs et leur durée en heures. Un modèle peut les proposer.'],
    ['Après chaque cours', 'Faite, reportée ou annulée : l\'avancement, le retard et la date de fin projetée se recalculent.'],
  ],

  sources: {
    bloom: 'Niveaux du domaine cognitif d\'après la taxonomie de B. S. Bloom (1956), révisée par L. W. Anderson et D. R. Krathwohl (2001) ; noms traduits et verbes rédigés pour QME.',
    feries: 'Jours fériés calculés chaque année (fêtes légales de l\'article L3133-1 du Code du travail, Pâques calculé) ; Alsace-Moselle en option.',
    vacances: 'Aucun calendrier de vacances scolaires intégré : les dates de ta zone sont à saisir (elles changent chaque année).',
  },
};
