// Base intégrée de Notes et moyennes : systèmes de notation, types d'évaluation, modèles de structure, matières
// suggérées, mentions proposées, couleurs, conseils. Aucun barème officiel d'examen ni règle d'un diplôme : les
// coefficients, crédits, seuils, règles de compensation et mentions se saisissent (ils dépendent du règlement de
// chaque établissement). Les valeurs ci-dessous ne sont que des propositions de départ, toutes modifiables.
window.BASE = {
  version: '2026-11-14',

  // Systèmes de notation : note maximale, seuil de validation et objectif proposés (modifiables par période).
  systemes: [
    { code: 'sur20', nom: 'Sur 20', max: 20, seuil: 10, objectif: 12 },
    { code: 'sur10', nom: 'Sur 10', max: 10, seuil: 5, objectif: 6 },
    { code: 'sur100', nom: 'Sur 100 (pourcentage)', max: 100, seuil: 50, objectif: 60 },
    { code: 'lettres', nom: 'Lettres (A à F)', max: 4, seuil: 2, objectif: 3 },
  ],

  // Correspondance lettres → points proposée pour le système « Lettres » (sur 4). Elle varie d'un établissement à
  // l'autre (et la notation ECTS en lettres repose sur un classement, pas sur une conversion) : à remplacer par
  // celle de ton règlement dans les Réglages.
  lettres: [
    { lettre: 'A', points: 4 },
    { lettre: 'B', points: 3 },
    { lettre: 'C', points: 2 },
    { lettre: 'D', points: 1 },
    { lettre: 'F', points: 0 },
  ],

  types: [
    { code: 'controle', nom: 'Contrôle' },
    { code: 'cc', nom: 'Contrôle continu' },
    { code: 'partiel', nom: 'Partiel, examen' },
    { code: 'oral', nom: 'Oral' },
    { code: 'tp', nom: 'TP' },
    { code: 'projet', nom: 'Projet, dossier' },
    { code: 'concours', nom: 'Concours blanc' },
    { code: 'rattrapage', nom: 'Rattrapage (2e session)' },
    { code: 'autre', nom: 'Autre' },
  ],

  // Règles de validation proposées (le règlement de ton diplôme fait foi : choisis celle qui s'en approche).
  modes: [
    { code: 'totale', nom: 'Compensation entre toutes les matières', aide: 'La période est validée si sa moyenne atteint le seuil, sans note éliminatoire.' },
    { code: 'ue', nom: 'Compensation à l\'intérieur de chaque UE', aide: 'Chaque UE est validée si sa moyenne atteint le seuil ; la période l\'est si toutes ses UE le sont.' },
    { code: 'aucune', nom: 'Aucune compensation', aide: 'Chaque matière doit atteindre le seuil.' },
  ],

  // Modèles de structure du premier lancement : seulement des noms de périodes et des réglages de calcul.
  modeles: [
    { code: 'lycee', nom: 'Lycée', aide: '3 trimestres, notes sur 20, coefficients', periodes: ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'], poids: 'coef', mode: 'totale', ue: false },
    { code: 'bts', nom: 'BTS, BUT', aide: '2 semestres, unités d\'enseignement, coefficients', periodes: ['Semestre 1', 'Semestre 2'], poids: 'coef', mode: 'ue', ue: true },
    { code: 'licence', nom: 'Licence, master, école', aide: '2 semestres, UE et crédits ECTS', periodes: ['Semestre 1', 'Semestre 2'], poids: 'credits', mode: 'totale', ue: true },
    { code: 'concours', nom: 'Prépa, concours', aide: 'une année, notes sur 20, coefficients', periodes: ['Année'], poids: 'coef', mode: 'totale', ue: false },
  ],

  // Suggestions de noms (liste de saisie), aucune n'est imposée.
  matieres: [
    'Mathématiques', 'Français', 'Philosophie', 'Histoire-géographie', 'Anglais', 'Espagnol', 'Allemand',
    'Physique-chimie', 'Sciences de la vie et de la Terre', 'Sciences économiques et sociales', 'Éducation physique et sportive',
    'Enseignement moral et civique', 'Microéconomie', 'Macroéconomie', 'Statistiques', 'Comptabilité', 'Droit', 'Gestion',
    'Marketing', 'Informatique', 'Algorithmique', 'Méthodologie', 'Culture générale', 'Langue vivante', 'Projet tutoré', 'Stage',
  ],

  // Mentions proposées (seuils sur 20, convertis pour les autres échelles) : à adapter à ton règlement.
  mentions: [
    { nom: 'Assez bien', seuil: 12 },
    { nom: 'Bien', seuil: 14 },
    { nom: 'Très bien', seuil: 16 },
  ],

  // Couleurs des matières, dans cet ordre, jamais générées (fond teinté, filet, texte foncé lisible).
  couleurs: [
    { fond: '#D8E4F0', bord: '#2E5A88', texte: '#22476E' },
    { fond: '#FBEBC2', bord: '#B8901F', texte: '#6E5310' },
    { fond: '#F8DCD3', bord: '#B84A34', texte: '#8A3322' },
    { fond: '#DCEBDD', bord: '#2E7D4F', texte: '#1F5A36' },
    { fond: '#E6DDF0', bord: '#6A4C93', texte: '#4A3270' },
    { fond: '#F3EDE3', bord: '#6E685F', texte: '#45413A' },
    { fond: '#D5ECEC', bord: '#2F7A7A', texte: '#1F5656' },
    { fond: '#F6E0EC', bord: '#A04A78', texte: '#7A2F58' },
  ],

  conseils: [
    ['Recopie ta maquette', 'Tes semestres (ou trimestres), tes UE et tes matières, avec les coefficients ou les crédits de ton règlement.'],
    ['Note chaque résultat', 'Contrôle, partiel, oral : la note, sur combien, et son coefficient dans la matière. Les moyennes se calculent seules.'],
    ['Prévois les épreuves', 'Ajoute les partiels à venir sans note : le simulateur te dit ce qu\'il te faut pour atteindre ton objectif.'],
    ['Saisis tes règles', 'Seuil de validation, compensation, note éliminatoire, rattrapage, mentions : celles de ton diplôme, pas une règle générale.'],
  ],
};
