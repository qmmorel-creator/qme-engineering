// Base intégrée du template séminaire / offsite : rédigée pour le template (aucune source externe).
// Programmes types : horaires et durées d'exemple, à adapter. Postes de budget sans aucun montant.
window.BASE = {
  // Couleurs fixes de la charte (ordre fixe, jamais générées).
  couleurs: [
    { id: 'rouge', nom: 'Rouge', hex: '#B84A34' },
    { id: 'bleu', nom: 'Bleu', hex: '#2E5A88' },
    { id: 'jaune', nom: 'Jaune', hex: '#E8B93A' },
    { id: 'encre', nom: 'Encre', hex: '#24221F' },
    { id: 'vert', nom: 'Vert', hex: '#3E7A57' },
    { id: 'gris', nom: 'Gris', hex: '#8A8478' },
  ],

  modes: [
    { id: 'train', nom: 'Train' },
    { id: 'avion', nom: 'Avion' },
    { id: 'car', nom: 'Car ou navette' },
    { id: 'voiture', nom: 'Voiture ou covoiturage' },
    { id: 'autre', nom: 'Autre' },
  ],

  // Types de chambre : capacité proposée par défaut (modifiable).
  chambres: [
    { id: 'individuelle', nom: 'Individuelle', capacite: 1 },
    { id: 'double', nom: 'Double (un grand lit)', capacite: 2 },
    { id: 'twin', nom: 'Twin (deux lits)', capacite: 2 },
    { id: 'triple', nom: 'Triple', capacite: 3 },
    { id: 'quadruple', nom: 'Quadruple', capacite: 4 },
  ],

  // Types de session du programme (couleur fixe de la charte). « repas » alimente la fiche traiteur.
  sessions: [
    { id: 'pleniere', nom: 'Plénière', couleur: 'bleu' },
    { id: 'atelier', nom: 'Atelier', couleur: 'jaune' },
    { id: 'repas', nom: 'Repas', couleur: 'rouge' },
    { id: 'pause', nom: 'Pause', couleur: 'gris' },
    { id: 'activite', nom: 'Activité de cohésion', couleur: 'vert' },
    { id: 'transfert', nom: 'Transfert', couleur: 'encre' },
    { id: 'libre', nom: 'Temps libre', couleur: 'gris' },
  ],

  roles: [
    { id: 'participant', nom: 'Participant' },
    { id: 'intervenant', nom: 'Intervenant' },
    { id: 'organisation', nom: 'Organisation' },
  ],

  // Liste fermée de préférences alimentaires (aucun champ libre, aucune donnée de santé détaillée).
  // Les allergies et intolérances passent par une case sans détail : le participant contacte le traiteur.
  regimes: ['Sans restriction', 'Végétarien', 'Végétalien', 'Sans porc', 'Sans alcool'],

  // Programmes types : [jour, heure, durée en minutes, intitulé, type, salle]. Horaires d'exemple, à adapter.
  programmes: {
    journee: {
      nom: 'Journée d\'équipe (1 jour)',
      sessions: [
        [1, '08:45', 30, 'Accueil café', 'pause', 'Hall'],
        [1, '09:15', 15, 'Ouverture par la direction', 'pleniere', 'Plénière'],
        [1, '09:30', 75, 'Bilan de l\'année et cap', 'pleniere', 'Plénière'],
        [1, '10:45', 15, 'Pause', 'pause', 'Hall'],
        [1, '11:00', 75, 'Ateliers (groupe A)', 'atelier', 'Salle 1'],
        [1, '11:00', 75, 'Ateliers (groupe B)', 'atelier', 'Salle 2'],
        [1, '12:15', 75, 'Déjeuner', 'repas', 'Restaurant'],
        [1, '13:30', 90, 'Activité de cohésion', 'activite', 'Extérieur'],
        [1, '15:00', 15, 'Pause', 'pause', 'Hall'],
        [1, '15:15', 60, 'Restitution des ateliers', 'pleniere', 'Plénière'],
        [1, '16:15', 30, 'Clôture et suite', 'pleniere', 'Plénière'],
      ],
    },
    deuxjours: {
      nom: 'Séminaire de deux jours avec nuitée',
      sessions: [
        [1, '09:30', 30, 'Accueil café, remise des chambres', 'pause', 'Hall'],
        [1, '10:00', 15, 'Ouverture par la direction', 'pleniere', 'Plénière'],
        [1, '10:15', 90, 'Plénière : bilan et enjeux', 'pleniere', 'Plénière'],
        [1, '11:45', 15, 'Pause', 'pause', 'Hall'],
        [1, '12:00', 60, 'Intervention invitée', 'pleniere', 'Plénière'],
        [1, '13:00', 75, 'Déjeuner', 'repas', 'Restaurant'],
        [1, '14:15', 90, 'Ateliers (groupe A)', 'atelier', 'Salle 1'],
        [1, '14:15', 90, 'Ateliers (groupe B)', 'atelier', 'Salle 2'],
        [1, '14:15', 90, 'Ateliers (groupe C)', 'atelier', 'Salle 3'],
        [1, '15:45', 15, 'Pause', 'pause', 'Hall'],
        [1, '16:00', 120, 'Activité de cohésion', 'activite', 'Extérieur'],
        [1, '18:00', 90, 'Temps libre', 'libre', ''],
        [1, '19:30', 30, 'Apéritif', 'repas', 'Terrasse'],
        [1, '20:00', 150, 'Dîner', 'repas', 'Restaurant'],
        [2, '07:30', 90, 'Petit déjeuner', 'repas', 'Restaurant'],
        [2, '09:00', 90, 'Restitution des ateliers', 'pleniere', 'Plénière'],
        [2, '10:30', 15, 'Pause', 'pause', 'Hall'],
        [2, '10:45', 75, 'Plan d\'actions et engagements', 'pleniere', 'Plénière'],
        [2, '12:00', 75, 'Déjeuner', 'repas', 'Restaurant'],
        [2, '13:15', 30, 'Clôture', 'pleniere', 'Plénière'],
        [2, '13:45', 30, 'Départ des navettes', 'transfert', 'Parvis'],
      ],
    },
  },

  // Postes de budget types (aucun montant).
  postes: [
    'Lieu et salles', 'Hébergement', 'Restauration', 'Boissons', 'Transports', 'Activités et cohésion',
    'Intervenants et animation', 'Technique (son, vidéo)', 'Kits et cadeaux participants', 'Assurance',
    'Communication', 'Imprévus',
  ],

  statutsDepense: [
    { id: 'devis', nom: 'Devis' },
    { id: 'engage', nom: 'Engagée' },
    { id: 'annule', nom: 'Annulée' },
  ],

  // Rappel RGPD (paraphrase, pas un conseil juridique).
  rgpd: {
    source: 'CNIL, « Donnée sensible » (définition), cnil.fr/fr/definition/donnee-sensible.',
    url: 'https://www.cnil.fr/fr/definition/donnee-sensible',
  },
};
