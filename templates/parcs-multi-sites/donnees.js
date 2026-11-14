// Base intégrée du pilotage de parcs multi-sites : types de sites, catégories d'équipements,
// criticités, types d'intervention, régions proposées. Aucune marque, aucun prestataire, aucune
// périodicité réglementaire : la périodicité du préventif est saisie par l'utilisateur.
window.BASE = {
  // Réglages de départ (modifiables dans les Réglages).
  alerteJours: 30, // préventif « à prévoir » dans les N jours
  arretJours: 7, // alerte quand un équipement est à l'arrêt depuis N jours
  visiteMois: 6, // alerte quand un site n'a pas été visité depuis N mois
  periodeJours: 365, // période des indicateurs (disponibilité, coûts, délais, taux à temps)

  typesSites: [
    { code: 'BUR', nom: 'Immeuble de bureaux', court: 'Bureaux' },
    { code: 'RES', nom: 'Résidence, logements', court: 'Résidence' },
    { code: 'COM', nom: 'Commerce, local d\'activité', court: 'Commerce' },
    { code: 'ENT', nom: 'Entrepôt, plateforme logistique', court: 'Entrepôt' },
    { code: 'ERP', nom: 'Établissement recevant du public', court: 'ERP' },
    { code: 'IND', nom: 'Site industriel ou atelier', court: 'Industriel' },
    { code: 'TEC', nom: 'Site technique (local, poste, station)', court: 'Technique' },
    { code: 'AUT', nom: 'Autre', court: 'Autre' },
  ],

  categories: [
    { code: 'CHA', nom: 'Chauffage, eau chaude' },
    { code: 'CVC', nom: 'Climatisation, ventilation' },
    { code: 'ASC', nom: 'Ascenseur, monte-charge' },
    { code: 'ELE', nom: 'Électricité, éclairage' },
    { code: 'GEN', nom: 'Groupe électrogène, onduleur' },
    { code: 'INC', nom: 'Sécurité incendie' },
    { code: 'ACC', nom: 'Contrôle d\'accès, vidéo' },
    { code: 'POR', nom: 'Portes et portails automatiques' },
    { code: 'PLO', nom: 'Plomberie, pompes' },
    { code: 'MAN', nom: 'Manutention (quais, chariots)' },
    { code: 'FRO', nom: 'Froid (chambres froides, vitrines)' },
    { code: 'ENR', nom: 'Production d\'énergie (solaire, borne)' },
    { code: 'AUT', nom: 'Autre' },
  ],
  // Catégorie pseudo pour les coûts d'une visite de site sans équipement.
  categorieSite: { code: 'SITE', nom: 'Visites de site' },

  criticites: [
    { code: 'haute', nom: 'Haute', court: 'Haute' },
    { code: 'moyenne', nom: 'Moyenne', court: 'Moyenne' },
    { code: 'basse', nom: 'Basse', court: 'Basse' },
  ],

  typesInterventions: [
    { code: 'preventif', nom: 'Préventif' },
    { code: 'correctif', nom: 'Correctif' },
    { code: 'visite', nom: 'Visite de site' },
  ],

  // Périodicités proposées dans les listes (en mois) ; toute valeur entière de 1 à 120 est acceptée.
  periodicites: [1, 2, 3, 6, 12, 24, 36, 60],

  // Régions proposées à la saisie (texte libre accepté : secteur, agence, pays…).
  regions: ['Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est', 'Hauts-de-France',
    'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', 'Provence-Alpes-Côte d\'Azur',
    'Guadeloupe', 'Guyane', 'La Réunion', 'Martinique', 'Mayotte'],
};
