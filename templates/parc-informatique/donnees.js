// Base intégrée de la gestion de parc informatique : catégories, types de licence, statuts.
// Aucune marque de matériel ni de logiciel. Garanties et durées de renouvellement = valeurs de départ
// indicatives (rédigées pour le produit, sans source externe), modifiables dans les réglages.
window.BASE = {
  // id, nom, garantie proposée (mois), durée de renouvellement indicative (années) ;
  // collectif : matériel partagé, installé à un emplacement plutôt que remis à une personne (« En place » quand il n'est pas affecté).
  categories: [
    { id: 'portable', nom: 'Ordinateur portable', garantie: 24, renouvellement: 4 },
    { id: 'fixe', nom: 'Ordinateur fixe', garantie: 24, renouvellement: 5 },
    { id: 'ecran', nom: 'Écran', garantie: 36, renouvellement: 7 },
    { id: 'station', nom: 'Station d\'accueil', garantie: 24, renouvellement: 5 },
    { id: 'smartphone', nom: 'Smartphone', garantie: 24, renouvellement: 3 },
    { id: 'tablette', nom: 'Tablette', garantie: 24, renouvellement: 4 },
    { id: 'imprimante', nom: 'Imprimante ou multifonction', garantie: 12, renouvellement: 5, collectif: true },
    { id: 'serveur', nom: 'Serveur', garantie: 36, renouvellement: 5, collectif: true },
    { id: 'stockage', nom: 'Stockage réseau', garantie: 24, renouvellement: 5, collectif: true },
    { id: 'reseau', nom: 'Équipement réseau', garantie: 24, renouvellement: 6, collectif: true },
    { id: 'onduleur', nom: 'Onduleur', garantie: 24, renouvellement: 5, collectif: true },
    { id: 'peripherique', nom: 'Périphérique (clavier, souris, casque…)', garantie: 12, renouvellement: 3 },
    { id: 'reunion', nom: 'Équipement de salle de réunion', garantie: 24, renouvellement: 6, collectif: true },
    { id: 'autre', nom: 'Autre matériel', garantie: 12, renouvellement: 5 },
  ],

  // mode : par utilisateur (personne) ou par poste (matériel) ; periode : mois entre deux échéances (0 = sans échéance).
  typesLicence: [
    { id: 'abo-an-util', nom: 'Abonnement annuel par utilisateur', mode: 'personne', periode: 12 },
    { id: 'abo-mois-util', nom: 'Abonnement mensuel par utilisateur', mode: 'personne', periode: 1 },
    { id: 'abo-an-poste', nom: 'Abonnement annuel par poste', mode: 'materiel', periode: 12 },
    { id: 'perp-poste', nom: 'Licence perpétuelle par poste', mode: 'materiel', periode: 0 },
    { id: 'perp-util', nom: 'Licence perpétuelle par utilisateur', mode: 'personne', periode: 0 },
    { id: 'volume', nom: 'Contrat en volume (renouvellement annuel)', mode: 'personne', periode: 12 },
    { id: 'serveur', nom: 'Licence serveur', mode: 'materiel', periode: 12 },
    { id: 'libre', nom: 'Logiciel libre ou gratuit (suivi seulement)', mode: 'personne', periode: 0 },
  ],

  categoriesLogiciel: [
    'Suite bureautique', 'Messagerie et collaboration', 'Sécurité des postes', 'Système d\'exploitation', 'Sauvegarde',
    'Gestion des mots de passe', 'Accès à distance', 'Comptabilité et paie', 'Conception assistée (CAO, DAO)', 'Graphisme et PAO', 'Autre logiciel',
  ],

  statuts: [
    { id: 'actif', nom: 'Actif' },
    { id: 'reparation', nom: 'En réparation' },
    { id: 'perdu', nom: 'Perdu ou volé' },
    { id: 'sorti', nom: 'Sorti du parc' },
  ],
  etats: [
    { id: 'neuf', nom: 'Neuf' },
    { id: 'bon', nom: 'Bon état' },
    { id: 'use', nom: 'Usé' },
    { id: 'hs', nom: 'Hors service' },
  ],
  motifsSortie: ['Recyclé (filière agréée)', 'Revendu', 'Donné', 'Détruit', 'Rendu au loueur', 'Autre'],

  // Fenêtres d'alerte par défaut (jours) ; réparation jugée longue au-delà de reparationLongue jours.
  alertes: { garantie: 60, licence: 60, depart: 15, reparationLongue: 30 },

  rgpd: {
    source: 'CNIL, « Les règles pour la gestion du personnel »',
    url: 'https://www.cnil.fr/fr/les-regles-pour-la-gestion-du-personnel',
    publie: '17/08/2023',
    consulte: '13/11/2026',
    points: [
      'Ne collecter que les données utiles à la gestion du matériel : nom, service, dates d\'arrivée et de départ suffisent.',
      'Les commentaires restent factuels, pertinents et non excessifs (aucune appréciation sur la personne).',
      'Informer les salariés du fichier : qui le tient, pourquoi, combien de temps, et leurs droits (accès, rectification).',
      'Réserver l\'accès aux personnes habilitées et inscrire le traitement au registre des activités de traitement.',
      'Ne pas garder les données plus longtemps que nécessaire : anonymiser une personne partie une fois son matériel restitué.',
    ],
  },

  couleurs: [
    { id: 'bleu', hex: '#1D4E89' }, { id: 'jaune', hex: '#F5B400' }, { id: 'rouge', hex: '#D9302A' }, { id: 'gris', hex: '#A8A398' },
  ],
};
