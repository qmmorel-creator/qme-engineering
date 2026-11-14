// Base intégrée de la gestion de classe : découpages de l'année, notes spéciales, échelle de maîtrise,
// référentiels de compétences (socle commun sourcé, exemple générique), banque d'appréciations, conseils.
// Aucune donnée d'élève, d'établissement ni de marque. Sources vérifiées le 14/11/2026
// (voir docs/templates/fiches/gestion-classe.md).
window.BASE = {
  version: '2026-11-14',

  // Réglages de départ (modifiables dans les Réglages).
  reglages: {
    decimales: 2,
    longueurAppreciation: 300,
    alerteJours: 21,
  },

  // Découpages de l'année proposés. Les dates de fin sont des propositions (jour et mois), à ajuster aux
  // dates de l'établissement : aucun calendrier officiel n'est intégré.
  decoupages: [
    { code: 'trimestres', nom: 'Trimestres', periodes: [['Trimestre 1', '11-30'], ['Trimestre 2', '03-15'], ['Trimestre 3', '06-30']] },
    { code: 'semestres', nom: 'Semestres', periodes: [['Semestre 1', '01-31'], ['Semestre 2', '06-30']] },
  ],

  // Notes spéciales : jamais comptées dans les moyennes. Saisie rapide : la lettre ou le code.
  speciales: [
    { code: 'ABS', nom: 'Absent', saisie: ['abs', 'a'] },
    { code: 'NN', nom: 'Non noté', saisie: ['nn', 'n'] },
    { code: 'DISP', nom: 'Dispensé', saisie: ['disp', 'd'] },
  ],

  // Échelle de maîtrise en 4 échelons : intitulés de l'article D122-3 du code de l'éducation.
  niveaux: [
    { n: 1, nom: 'Maîtrise insuffisante', court: 'Insuffisante' },
    { n: 2, nom: 'Maîtrise fragile', court: 'Fragile' },
    { n: 3, nom: 'Maîtrise satisfaisante', court: 'Satisfaisante' },
    { n: 4, nom: 'Très bonne maîtrise', court: 'Très bonne' },
  ],

  // Source officielle du référentiel « Socle commun » et de l'échelle, lue sur Légifrance.
  source: {
    titre: 'Code de l\'éducation, articles D122-1 (domaines du socle commun) et D122-3 (évaluation, échelle de maîtrise)',
    editeur: 'legifrance.gouv.fr, version issue du décret n° 2015-372 du 31 mars 2015 et du décret n° 2015-1929 du 31 décembre 2015',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030428781',
    vigueur: 'en vigueur depuis le 1er septembre 2016',
    consulte: '14/11/2026',
    resume: 'Le socle commun comprend cinq domaines de formation ; le domaine « Les langages pour penser et communiquer » est évalué en quatre composantes. La maîtrise se positionne sur une échelle de quatre échelons : maîtrise insuffisante, maîtrise fragile, maîtrise satisfaisante, très bonne maîtrise.',
  },

  // Référentiels proposés au départ ; tout est modifiable ensuite (ajout, renommage, suppression).
  referentiels: [
    {
      code: 'socle', nom: 'Socle commun : domaines et composantes (collège)', source: true,
      competences: [
        ['D1.1', 'Langue française', 'Domaine 1'],
        ['D1.2', 'Langues étrangères et, le cas échéant, régionales', 'Domaine 1'],
        ['D1.3', 'Langages mathématiques, scientifiques et informatiques', 'Domaine 1'],
        ['D1.4', 'Langages des arts et du corps', 'Domaine 1'],
        ['D2', 'Les méthodes et outils pour apprendre', 'Domaine 2'],
        ['D3', 'La formation de la personne et du citoyen', 'Domaine 3'],
        ['D4', 'Les systèmes naturels et les systèmes techniques', 'Domaine 4'],
        ['D5', 'Les représentations du monde et l\'activité humaine', 'Domaine 5'],
      ],
    },
    {
      code: 'generique', nom: 'Exemple générique, à adapter à ta matière', source: false,
      competences: [
        ['C1', 'Connaître et restituer', 'Exemple'],
        ['C2', 'Raisonner et justifier', 'Exemple'],
        ['C3', 'Mettre en œuvre une méthode', 'Exemple'],
        ['C4', 'Rédiger et communiquer', 'Exemple'],
        ['C5', 'Organiser son travail', 'Exemple'],
      ],
    },
  ],

  // Banque d'appréciations : formulations types, rédigées pour l'outil, à composer et à modifier.
  // niveau 1 à 4 (des difficultés aux très bons résultats) ; {prenom} est remplacé par le prénom affiché.
  axes: [
    { code: 'resultats', nom: 'Résultats' },
    { code: 'travail', nom: 'Travail' },
    { code: 'attitude', nom: 'Attitude en classe' },
    { code: 'conseil', nom: 'Conseil' },
  ],
  banque: [
    ['resultats', 1, 'Les résultats sont très insuffisants sur cette période.'],
    ['resultats', 1, 'Des difficultés importantes persistent.'],
    ['resultats', 2, 'Les résultats sont fragiles et irréguliers.'],
    ['resultats', 2, 'Un ensemble encore juste, avec quelques réussites encourageantes.'],
    ['resultats', 3, 'Des résultats satisfaisants.'],
    ['resultats', 3, 'Un bon ensemble, les bases sont acquises.'],
    ['resultats', 4, 'De très bons résultats.'],
    ['resultats', 4, 'Un excellent ensemble, bravo.'],
    ['travail', 1, 'Le travail personnel est insuffisant.'],
    ['travail', 1, 'Les devoirs ne sont pas toujours faits.'],
    ['travail', 2, 'Le travail doit devenir plus régulier.'],
    ['travail', 2, '{prenom} fournit des efforts, encore à approfondir.'],
    ['travail', 3, 'Le travail est sérieux et régulier.'],
    ['travail', 3, '{prenom} s\'investit avec application.'],
    ['travail', 4, 'Un travail approfondi et rigoureux.'],
    ['travail', 4, '{prenom} travaille avec beaucoup de sérieux et d\'autonomie.'],
    ['attitude', 1, 'L\'attitude en classe doit changer.'],
    ['attitude', 1, 'Les bavardages gênent le travail.'],
    ['attitude', 2, 'La participation reste trop discrète.'],
    ['attitude', 2, 'L\'attention en classe est inégale.'],
    ['attitude', 3, 'Une participation active et pertinente.'],
    ['attitude', 3, 'Une attitude positive en classe.'],
    ['attitude', 4, 'Une participation riche qui fait avancer la classe.'],
    ['attitude', 4, 'Une attitude exemplaire.'],
    ['conseil', 1, 'Il faut se mettre au travail dès maintenant.'],
    ['conseil', 1, 'Il faut solliciter de l\'aide sans attendre.'],
    ['conseil', 2, 'Il faut reprendre les leçons régulièrement.'],
    ['conseil', 2, 'Courage, les progrès sont à portée.'],
    ['conseil', 3, 'Il faut continuer ainsi.'],
    ['conseil', 3, 'Il faut viser davantage de précision.'],
    ['conseil', 4, 'Félicitations, il faut garder ce rythme.'],
    ['conseil', 4, 'Il faut continuer à approfondir.'],
  ],

  // Matières proposées à la création d'une classe (liste libre, modifiable).
  matieres: ['Français', 'Mathématiques', 'Histoire-géographie', 'Anglais', 'Espagnol', 'Allemand', 'Physique-chimie', 'SVT', 'Technologie', 'Arts plastiques', 'Éducation musicale', 'EPS', 'SES', 'Philosophie', 'NSI', 'Autre'],

  conseils: [
    ['Prénom et initiale', 'Chaque élève est noté par son prénom et l\'initiale de son nom, ou par un pseudonyme : rien de plus n\'est demandé.'],
    ['Saisie au clavier', 'Dans une évaluation, tape la note puis Entrée : le curseur passe à l\'élève suivant. « a » pour absent, « n » pour non noté, « d » pour dispensé.'],
    ['Barème libre', 'Note sur 10, 20 ou 40 : tout est ramené sur 20, avec un coefficient par évaluation.'],
    ['Outil personnel', 'Ce carnet prépare tes conseils de classe. Il ne remplace pas le logiciel de vie scolaire de ton établissement.'],
  ],
};
