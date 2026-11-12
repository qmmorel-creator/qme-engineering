// Base intégrée du budget commun : couleurs, catégories, modèles de foyer, règles de répartition.
// Aucune donnée datée ni réglementaire : rien à remettre à jour.
window.BASE = {
  // Ordre fixe validé (séparation daltonisme) : bleu, jaune, rouge, vert, puis orange, prune.
  couleurs: [
    { id: 'bleu', hex: '#1D4E89', nom: 'Bleu' },
    { id: 'jaune', hex: '#F5B400', nom: 'Jaune' },
    { id: 'rouge', hex: '#D9302A', nom: 'Rouge' },
    { id: 'vert', hex: '#2E7D4F', nom: 'Vert' },
    { id: 'orange', hex: '#E8702A', nom: 'Orange' },
    { id: 'prune', hex: '#7A3E6B', nom: 'Prune' },
    { id: 'encre', hex: '#141414', nom: 'Noir' },
    { id: 'ciel', hex: '#4A90C2', nom: 'Bleu ciel' },
  ],

  categories: [
    { id: 'logement', nom: 'Logement', detail: 'Loyer, crédit, charges de copropriété' },
    { id: 'energie', nom: 'Énergie et eau', detail: 'Électricité, gaz, eau' },
    { id: 'courses', nom: 'Courses', detail: 'Alimentation, produits du quotidien' },
    { id: 'abonnements', nom: 'Abonnements', detail: 'Internet, téléphone, plateformes' },
    { id: 'assurances', nom: 'Assurances', detail: 'Habitation, véhicule' },
    { id: 'transport', nom: 'Transport', detail: 'Carburant, transports en commun, entretien' },
    { id: 'maison', nom: 'Maison', detail: 'Meubles, équipement, travaux' },
    { id: 'enfants', nom: 'Enfants', detail: 'Garde, école, activités' },
    { id: 'sorties', nom: 'Sorties et loisirs', detail: 'Restaurants, vacances, cadeaux communs' },
    { id: 'sante', nom: 'Santé', detail: 'Pharmacie, mutuelle commune' },
    { id: 'animaux', nom: 'Animaux', detail: 'Nourriture, vétérinaire' },
    { id: 'divers', nom: 'Divers', detail: 'Tout le reste' },
  ],

  modeles: [
    { id: 'couple', nom: 'Couple', detail: '2 personnes, au prorata des revenus', membres: ['Personne 1', 'Personne 2'], mode: 'prorata',
      categories: ['logement', 'energie', 'courses', 'abonnements', 'assurances', 'transport', 'maison', 'sorties', 'sante', 'divers'] },
    { id: 'coloc', nom: 'Colocation à trois', detail: '3 personnes, à parts égales', membres: ['Coloc 1', 'Coloc 2', 'Coloc 3'], mode: 'egale',
      categories: ['logement', 'energie', 'courses', 'abonnements', 'assurances', 'maison', 'sorties', 'divers'] },
    { id: 'famille', nom: 'Famille', detail: '2 adultes, enfants à charge, au prorata', membres: ['Parent 1', 'Parent 2'], mode: 'prorata',
      categories: ['logement', 'energie', 'courses', 'abonnements', 'assurances', 'transport', 'maison', 'enfants', 'sorties', 'sante', 'animaux', 'divers'] },
  ],

  modes: [
    { id: 'egale', nom: 'À parts égales', court: 'Égale',
      principe: 'Chacun paie la même part. Simple et lisible quand les revenus sont proches, ou en colocation.',
      exemple: '90,00 € à trois : 30,00 € chacun.' },
    { id: 'prorata', nom: 'Au prorata des revenus', court: 'Prorata',
      principe: 'Chacun paie en proportion de ses revenus. Les revenus se règlent dans l\'onglet Foyer ; s\'il en manque un, la dépense est partagée à parts égales.',
      exemple: '1 000 € avec des revenus de 2 600 € et 1 900 € : 577,78 € et 422,22 €.' },
    { id: 'parts', nom: 'En parts', court: 'Parts',
      principe: 'Chacun compte pour un nombre de parts (2 pour un adulte, 1 pour un enfant, 1,5 pour une grande chambre…).',
      exemple: '300 € en 2 parts et 1 part : 200 € et 100 €.' },
    { id: 'montants', nom: 'Montants personnalisés', court: 'Montants',
      principe: 'Tu indiques le montant exact de chacun ; leur somme doit faire le total de la dépense.',
      exemple: 'Un restaurant de 64 € : 40 € pour l\'un, 24 € pour l\'autre.' },
  ],
};
