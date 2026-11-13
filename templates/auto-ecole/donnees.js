// Base intégrée de la gestion d'auto-école : listes de saisie et repères, sans logique.
// Aucun tarif, aucune durée de formation, aucun intervalle d'entretien par défaut : ce sont des saisies.
// Seule donnée réglementaire citée : la règle générale du contrôle technique des voitures (M1),
// service-public.gouv.fr F2878, consultée le 13/11/2026 (« Vérifié le 1er janvier 2026 »).
window.BASE = {
  // Étapes de progression génériques, rédigées pour le produit : ce n'est PAS le référentiel officiel
  // de la formation à la conduite (non repris). Liste modifiable dans les réglages.
  competences: [
    'Installation au poste et commandes',
    'Démarrage, arrêt et changements de vitesse',
    'Trajectoire et adaptation de l\'allure',
    'Intersections et priorités',
    'Changements de direction',
    'Insertion, croisement et dépassement',
    'Manœuvres et stationnement',
    'Circulation en agglomération',
    'Route et voie rapide',
    'Conduite autonome sur un itinéraire',
  ],

  boites: [
    { id: 'manuelle', nom: 'Manuelle' },
    { id: 'auto', nom: 'Automatique' },
  ],

  statutsLecon: [
    { id: 'prevue', nom: 'Prévue' },
    { id: 'faite', nom: 'Faite' },
    { id: 'absent', nom: 'Élève absent' },
    { id: 'annulee', nom: 'Annulée' },
  ],

  modesPaiement: ['Carte', 'Espèces', 'Chèque', 'Virement', 'Autre'],

  interventions: [
    { id: 'entretien', nom: 'Entretien' },
    { id: 'ct', nom: 'Contrôle technique' },
    { id: 'reparation', nom: 'Réparation' },
    { id: 'pneus', nom: 'Pneumatiques' },
    { id: 'carburant', nom: 'Carburant ou recharge' },
    { id: 'assurance', nom: 'Assurance' },
    { id: 'autre', nom: 'Autre' },
  ],

  jours: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],

  // Couleurs des moniteurs, dans l'ordre de la charte (jamais générées).
  couleurs: [
    { id: 'bleu', hex: '#1D4E89', texte: '#fff' },
    { id: 'rouge', hex: '#D9302A', texte: '#fff' },
    { id: 'jaune', hex: '#F5B400', texte: '#141414' },
    { id: 'encre', hex: '#141414', texte: '#fff' },
    { id: 'vert', hex: '#2E7D4F', texte: '#fff' },
    { id: 'gris', hex: '#A8A398', texte: '#141414' },
  ],

  // Réglages de départ (modifiables) : ce sont des choix d'organisation, pas des règles.
  reglagesDefaut: {
    joursOuverts: [1, 2, 3, 4, 5, 6],
    ouverture: '08:00',
    fermeture: '20:00',
    duree: 60,
    decompteAbsence: true,
    alerteJours: 30,
    alerteKm: 1000,
    periodiciteCT: null,
  },

  controleTechnique: {
    titre: 'Contrôle technique d\'une voiture (catégorie M1)',
    source: 'service-public.gouv.fr, fiche F2878',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2878',
    verifie: '1er janvier 2026',
    consulte: '13/11/2026',
    points: [
      'Premier contrôle dans les 6 mois avant le 4e anniversaire de la première mise en circulation.',
      'Un résultat favorable est valable 2 ans pour un véhicule de catégorie M1.',
      'Le contrôle se fait à l\'initiative du propriétaire, sans convocation.',
    ],
    reserve: 'Cette fiche ne traite pas des véhicules utilisés pour l\'enseignement de la conduite : aucune périodicité propre à ces véhicules n\'a pu être confirmée sur une source officielle. L\'outil ne calcule donc rien d\'office : saisis la date limite indiquée sur le procès-verbal du dernier contrôle et vérifie la règle applicable auprès de ton centre de contrôle.',
  },
};
