// Base intégrée des notes de frais : catégories de frais, types de véhicule et barème kilométrique fiscal.
// Contenu original rédigé pour QME, sans logique. Aucun montant de frais n'est imposé : l'utilisateur saisit
// toujours ce qu'il a payé (TTC) et, s'il la connaît, la TVA indiquée sur le justificatif.
// Barème kilométrique : valeurs publiées par l'administration fiscale, relevées le 13/11/2026 (source ci-dessous).
// Il est copié dans les données de l'utilisateur au premier lancement et reste entièrement modifiable dans les
// Réglages (un barème par année de trajets). Mise à jour annuelle de ce fichier à chaque nouvelle publication.
(() => {
  // r(plafond de puissance fiscale, [a, b] par tranche) : indemnité = distance annuelle × a + b (en euros).
  const r = (cv, t1, t2, t3) => ({ cv, tranches: [t1, t2, t3] });

  window.BASE = {
    version: '2026-11-13',

    // Catégories de frais (couleurs fixes, dans l'ordre de « couleurs »). « justif » : justificatif habituel.
    categories: [
      { id: 'repas', nom: 'Repas', justif: 'Ticket ou facture du restaurant' },
      { id: 'invitation', nom: 'Repas d\'affaires (invités)', justif: 'Facture, noms des invités au dos' },
      { id: 'hebergement', nom: 'Hébergement', justif: 'Facture de l\'hôtel ou du logement' },
      { id: 'train', nom: 'Train, car', justif: 'Billet ou facture' },
      { id: 'avion', nom: 'Avion', justif: 'Facture et carte d\'embarquement' },
      { id: 'taxi', nom: 'Taxi, VTC', justif: 'Reçu de la course' },
      { id: 'transports', nom: 'Transports en commun', justif: 'Ticket ou justificatif d\'achat' },
      { id: 'location', nom: 'Location de véhicule', justif: 'Contrat et facture de location' },
      { id: 'carburant', nom: 'Carburant', justif: 'Ticket de la station' },
      { id: 'peage', nom: 'Péage', justif: 'Ticket ou relevé du badge' },
      { id: 'stationnement', nom: 'Stationnement', justif: 'Ticket ou reçu du parking' },
      { id: 'fournitures', nom: 'Fournitures de bureau', justif: 'Ticket de caisse ou facture' },
      { id: 'materiel', nom: 'Petit matériel', justif: 'Facture' },
      { id: 'telecom', nom: 'Téléphone, internet', justif: 'Facture de l\'opérateur' },
      { id: 'documentation', nom: 'Documentation, abonnements pro', justif: 'Facture' },
      { id: 'formation', nom: 'Formation, salon', justif: 'Facture ou convocation' },
      { id: 'poste', nom: 'Frais postaux', justif: 'Reçu' },
      { id: 'autres', nom: 'Autres frais', justif: 'Tout document qui prouve la dépense' },
      { id: 'regularisation', nom: 'Régularisation kilométrique', justif: 'Calcul annuel des indemnités kilométriques', interne: true },
    ],
    // Couleurs des catégories dans les listes (pastilles), dans l'ordre des catégories, jamais générées.
    couleurs: ['#E58C74', '#B84A34', '#2E5A88', '#5C8FD1', '#22476E', '#E8B93A', '#6E5310', '#24221F', '#8A3322', '#514C44', '#6E685F', '#2E7D4F', '#4F8A64', '#A06A1C', '#7A5C99', '#C77B3D', '#8C8579', '#B3AA9C', '#2E5A88'],

    statuts: [
      { id: 'brouillon', nom: 'Brouillon', aide: 'Saisi, pas encore envoyé' },
      { id: 'soumis', nom: 'Soumis', aide: 'Envoyé, en attente de remboursement' },
      { id: 'rembourse', nom: 'Remboursé', aide: 'Remboursement reçu' },
    ],

    vehicules: [
      { id: 'voiture', nom: 'Voiture', aide: 'Puissance fiscale : case P.6 de la carte grise' },
      { id: 'moto', nom: 'Moto ou scooter (plus de 50 cm³)', aide: 'Puissance fiscale : case P.6 de la carte grise' },
      { id: 'cyclo', nom: 'Cyclomoteur (50 cm³ au plus)', aide: 'Un seul barème, quelle que soit la puissance' },
    ],

    // Barèmes kilométriques fiscaux. « annee » : année des trajets (revenus de cette année).
    baremes: [
      {
        id: 'fiscal-2025',
        annee: 2025,
        libelle: 'Barème fiscal des revenus 2025 (publié en 2026)',
        source: 'Service-public.fr (DILA), actualité A14686 « Impôts 2026 » du 9 avril 2026, d\'après la brochure pratique 2026 de la DGFiP : barèmes non revalorisés, identiques à ceux de 2023 et 2024. Relevé le 13/11/2026.',
        adresse: 'service-public.gouv.fr/particuliers/actualites/A14686',
        publieLe: '2026-04-09',
        releveLe: '2026-11-13',
        verifie: true,
        majorationElectrique: 20,
        seuils: { voiture: [5000, 20000], moto: [3000, 6000], cyclo: [3000, 6000] },
        voiture: [
          r(3, [0.529, 0], [0.316, 1065], [0.370, 0]),
          r(4, [0.606, 0], [0.340, 1330], [0.407, 0]),
          r(5, [0.636, 0], [0.357, 1395], [0.427, 0]),
          r(6, [0.665, 0], [0.374, 1457], [0.447, 0]),
          r(7, [0.697, 0], [0.394, 1515], [0.470, 0]),
        ],
        moto: [
          r(2, [0.395, 0], [0.099, 891], [0.248, 0]),
          r(5, [0.468, 0], [0.082, 1158], [0.275, 0]),
          r(6, [0.606, 0], [0.079, 1583], [0.343, 0]),
        ],
        cyclo: [
          r(99, [0.315, 0], [0.079, 711], [0.198, 0]),
        ],
      },
    ],
    // Libellés des lignes du barème.
    lignesBareme: {
      voiture: ['3 CV et moins', '4 CV', '5 CV', '6 CV', '7 CV et plus'],
      moto: ['1 ou 2 CV', '3, 4 ou 5 CV', 'Plus de 5 CV'],
      cyclo: ['Toutes puissances'],
    },

    conseils: [
      ['Saisis le jour même', 'Une dépense notée sur le moment, avec son justificatif rangé, ne se perd pas en fin de mois.'],
      ['Range le justificatif', 'L\'application ne stocke aucun fichier : note où est le ticket (enveloppe du mois, dossier, numéro de scan).'],
      ['Soumets la note du mois', 'En début de mois, imprime la note du mois écoulé en PDF et marque-la « soumise » ; « remboursée » à réception.'],
      ['Kilomètres : tout au long de l\'année', 'Le barème s\'applique au total annuel par véhicule : l\'indemnité exacte se connaît en fin d\'année, d\'où la régularisation.'],
    ],
  };
})();
