// Base intégrée du calculateur de temps de vie : profils, conventions de calcul, périodicités et bibliothèque
// de catégories de dépenses. Aucune logique ici.
// AUCUN MONTANT NI BARÈME : tous les montants (revenus, dépenses) sont saisis par l'utilisateur. Aucun taux de
// prélèvement ni barème fiscal n'est intégré. Les valeurs par défaut du temps de travail ne servent qu'à compléter
// un profil partiel ; elles sont signalées comme hypothèses partout où elles sont utilisées.
window.BASE = {
  version: '2026-11-13',

  profils: [
    { id: 'salarie', nom: 'Salarié', aide: 'Revenu net versé chaque mois, horaires du contrat.' },
    { id: 'independant', nom: 'Indépendant', aide: 'Revenu net après charges et cotisations de ton activité.' },
    { id: 'partiel', nom: 'Temps partiel', aide: 'Indique tes heures réelles par semaine.' },
    { id: 'variable', nom: 'Horaires variables', aide: 'Indique une moyenne d\'heures par semaine sur l\'année.' },
    { id: 'autre', nom: 'Autre situation', aide: 'Saisis ce que tu connais : le calcul complète le reste par des hypothèses affichées.' },
  ],

  // Valeurs utilisées quand un champ du temps de travail n'est pas renseigné (hypothèses affichées).
  defauts: { moisTravailles: 12, heuresSemaine: 35, joursSemaine: 5, conges: 25, nonTravailles: 8, trajetMinutes: 0, fraisPro: 0 },

  conventions: [
    { id: 'contrat', num: 1, nom: 'Temps contractuel', court: 'contractuel',
      detail: 'Heures prévues par semaine × 52 semaines. Les congés payés et les jours fériés sont rémunérés : c\'est la base habituelle d\'un salaire horaire.' },
    { id: 'reel', num: 2, nom: 'Temps réellement consacré au travail', court: 'réel',
      detail: 'Temps effectif de travail, plus le transport domicile-travail si tu l\'inclus, et revenu diminué de tes dépenses professionnelles.' },
    { id: 'effectif', num: 3, nom: 'Temps annuel effectif', court: 'effectif',
      detail: 'Jours réellement travaillés dans l\'année (mois travaillés, congés et jours non travaillés retirés) × heures par jour.' },
  ],

  // Périodicités : nombre d'occurrences par an (null = dépense unique).
  periodicites: [
    { id: 'unique', nom: 'Une fois', court: '', parAn: null },
    { id: 'jour', nom: 'Par jour', court: '/jour', parAn: 365 },
    { id: 'semaine', nom: 'Par semaine', court: '/sem.', parAn: 52 },
    { id: 'mois', nom: 'Par mois', court: '/mois', parAn: 12 },
    { id: 'trimestre', nom: 'Par trimestre', court: '/trim.', parAn: 4 },
    { id: 'an', nom: 'Par an', court: '/an', parAn: 1 },
  ],

  // Bibliothèque : catégories et sous-catégories de dépenses (périodicité habituelle proposée à l'ajout).
  categories: [
    { id: 'logement', nom: 'Logement', sous: [
      ['loyer', 'Loyer', 'mois'], ['credit-immo', 'Crédit immobilier', 'mois'], ['charges', 'Charges', 'mois'], ['electricite', 'Électricité', 'mois'],
      ['gaz', 'Gaz', 'mois'], ['eau', 'Eau', 'mois'], ['internet', 'Internet', 'mois'], ['assurance-hab', 'Assurance habitation', 'mois'], ['travaux', 'Travaux et entretien', 'an'],
    ] },
    { id: 'mobilite', nom: 'Mobilité', sous: [
      ['voiture', 'Voiture', 'unique'], ['carburant', 'Carburant', 'mois'], ['assurance-auto', 'Assurance', 'mois'], ['entretien-auto', 'Entretien', 'an'],
      ['stationnement', 'Stationnement', 'mois'], ['transports', 'Transports en commun', 'mois'], ['velo', 'Vélo', 'unique'], ['deplacements-pro', 'Déplacements professionnels', 'mois'],
    ] },
    { id: 'alimentation', nom: 'Alimentation', sous: [
      ['courses', 'Courses', 'mois'], ['restaurants', 'Restaurants', 'mois'], ['livraison', 'Livraison', 'mois'], ['cafes', 'Cafés', 'semaine'], ['repas-exterieur', 'Repas à l\'extérieur', 'semaine'],
    ] },
    { id: 'equipement', nom: 'Équipement', sous: [
      ['telephone', 'Téléphone', 'unique'], ['ordinateur', 'Ordinateur', 'unique'], ['television', 'Télévision', 'unique'], ['electromenager', 'Électroménager', 'unique'],
      ['mobilier', 'Mobilier', 'unique'], ['vetements', 'Vêtements', 'mois'], ['chaussures', 'Chaussures', 'unique'],
    ] },
    { id: 'loisirs', nom: 'Loisirs', sous: [
      ['voyages', 'Voyages', 'unique'], ['sport', 'Sport', 'mois'], ['sorties', 'Sorties', 'mois'], ['jeux', 'Jeux', 'mois'], ['culture', 'Culture', 'mois'], ['activites', 'Activités personnelles', 'mois'],
    ] },
    { id: 'services', nom: 'Services et dépenses récurrentes', sous: [
      ['abonnements', 'Abonnements', 'mois'], ['numerique', 'Services numériques', 'mois'], ['assurances', 'Assurances', 'mois'], ['banque', 'Banque', 'mois'], ['services-perso', 'Services personnels', 'mois'],
    ] },
    { id: 'famille', nom: 'Famille', sous: [
      ['garde', 'Garde', 'mois'], ['education', 'Éducation', 'mois'], ['activites-enfants', 'Activités', 'mois'], ['equipements-famille', 'Équipements', 'unique'], ['courant-famille', 'Dépenses courantes', 'mois'],
    ] },
  ].map((c) => ({ ...c, sous: c.sous.map(([id, nom, periode]) => ({ id, nom, periode })) })),

  // Exemples fictifs du calculateur instantané (montants d'illustration, modifiables d'un toucher).
  exemples: [
    { libelle: 'Téléphone', montant: 900, periode: 'unique', categorie: 'equipement', sous: 'telephone' },
    { libelle: 'Restaurant', montant: 45, periode: 'unique', categorie: 'alimentation', sous: 'restaurants' },
    { libelle: 'Vacances', montant: 2500, periode: 'unique', categorie: 'loisirs', sous: 'voyages' },
    { libelle: 'Voiture', montant: 25000, periode: 'unique', categorie: 'mobilite', sous: 'voiture' },
    { libelle: 'Abonnement', montant: 15, periode: 'mois', categorie: 'services', sous: 'abonnements' },
  ],

  // Limites de l'expérience découverte (sans clé de licence).
  decouverte: { maxDepenses: 5 },
};
