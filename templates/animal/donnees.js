// Base intégrée du suivi d'un animal de compagnie : espèces, types de soins, modèles de soins SANS durée,
// catégories de frais, conseils. Aucun calendrier vaccinal ni antiparasitaire, aucune posologie, aucune
// marque de produit vétérinaire ou d'aliment : les intervalles sont saisis par l'utilisateur d'après son
// vétérinaire (voir docs/templates/fiches/animal.md).
window.BASE = {
  version: '2026-11-14',

  // Réglages de départ (modifiables dans les Réglages). Aucun n'est une valeur vétérinaire :
  // alerteJours = fenêtre d'affichage « Bientôt » ; peseeJours = rappel de pesée (0 = aucun rappel).
  reglages: {
    alerteJours: 14,
    peseeJours: 60,
  },

  especes: [
    { code: 'chien', nom: 'Chien' },
    { code: 'chat', nom: 'Chat' },
    { code: 'autre', nom: 'Autre animal' },
  ],

  // Types de soins récurrents. categorie : catégorie de frais où va le coût d'un soin fait.
  types: [
    { code: 'VAC', nom: 'Vaccin', categorie: 'SOI' },
    { code: 'AEX', nom: 'Antiparasitaire externe', categorie: 'SOI' },
    { code: 'VER', nom: 'Vermifuge (antiparasitaire interne)', categorie: 'SOI' },
    { code: 'CON', nom: 'Visite de contrôle', categorie: 'SOI' },
    { code: 'TOI', nom: 'Toilettage', categorie: 'TOI' },
    { code: 'GRI', nom: 'Griffes', categorie: 'TOI' },
    { code: 'DEN', nom: 'Hygiène dentaire', categorie: 'SOI' },
    { code: 'AUT', nom: 'Autre soin', categorie: 'SOI' },
  ],

  // Modèles de soins proposés à la création d'un animal : un NOM et un type, jamais de durée.
  // L'intervalle reste vide tant que l'utilisateur ne l'a pas saisi d'après son vétérinaire.
  modeles: {
    chien: [
      ['VAC', 'Vaccin (rappel)'], ['AEX', 'Antiparasitaire externe (puces, tiques)'], ['VER', 'Vermifuge'],
      ['CON', 'Visite de contrôle'], ['TOI', 'Toilettage'], ['GRI', 'Coupe des griffes'], ['DEN', 'Hygiène dentaire'],
    ],
    chat: [
      ['VAC', 'Vaccin (rappel)'], ['AEX', 'Antiparasitaire externe (puces, tiques)'], ['VER', 'Vermifuge'],
      ['CON', 'Visite de contrôle'], ['GRI', 'Coupe des griffes'],
    ],
    autre: [
      ['CON', 'Visite de contrôle'], ['GRI', 'Coupe des griffes ou des dents'], ['AUT', 'Autre soin'],
    ],
  },

  // Catégories de frais. auto : alimentées par les saisies de soins faits (SOI, TOI) et de visites (VET),
  // et aussi saisissables à la main. Couleur unique dans les graphiques : pas de couleur par catégorie.
  categories: [
    { code: 'VET', nom: 'Vétérinaire (consultations)' },
    { code: 'SOI', nom: 'Soins préventifs (vaccins, antiparasitaires…)' },
    { code: 'MED', nom: 'Médicaments et traitements' },
    { code: 'ALI', nom: 'Alimentation' },
    { code: 'TOI', nom: 'Toilettage et hygiène' },
    { code: 'ACC', nom: 'Accessoires, litière, jouets' },
    { code: 'ASS', nom: 'Assurance santé animale' },
    { code: 'GAR', nom: 'Garde et pension' },
    { code: 'EDU', nom: 'Éducation et activités' },
    { code: 'AUT', nom: 'Autre' },
  ],

  conseils: [
    ['Ton vétérinaire fixe les intervalles', 'Aucun calendrier de vaccins ni d\'antiparasitaires n\'est intégré : tu recopies ce que ton vétérinaire t\'a indiqué (carnet de santé, ordonnance), l\'outil calcule les dates.'],
    ['Note chaque soin fait', 'La prochaine échéance repart de la date du dernier soin noté, ou de la date que le vétérinaire a inscrite.'],
    ['Pèse à intervalles réguliers', 'La courbe de poids montre l\'évolution ; elle ne dit pas si un poids est bon ou non : c\'est le rôle du vétérinaire.'],
    ['Garde les tickets', 'Chaque frais noté (alimentation, visites, assurance, garde…) donne le coût par mois et par an.'],
  ],
};
