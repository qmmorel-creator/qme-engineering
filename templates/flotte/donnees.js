// Base intégrée de la gestion de flotte : types, énergies, contrôle technique (sourcé), plan
// d'entretien indicatif, postes de dépenses. Aucune marque de véhicule ni de loueur.
// Sources consultées le 13/11/2026 (voir docs/templates/fiches/flotte.md).
window.BASE = {
  // Fenêtres d'alerte de départ (réglables).
  alerteJours: 30,
  alerteKm: 1500,
  releveAncienJours: 30,

  types: [
    { code: 'M1', nom: 'Voiture particulière (M1)', court: 'Voiture' },
    { code: 'N1', nom: 'Camionnette (N1)', court: 'Utilitaire' },
    { code: 'AUTRE', nom: 'Autre (périodicité à saisir)', court: 'Autre' },
  ],

  // exempte : exemptée du contrôle complémentaire pollution des camionnettes N1 (fiche F33353).
  // thermique : moteur à combustion (opérations moteur du plan d'entretien).
  energies: [
    { code: 'ES', nom: 'Essence', thermique: true },
    { code: 'GO', nom: 'Diesel', thermique: true },
    { code: 'HY', nom: 'Hybride', thermique: true },
    { code: 'HR', nom: 'Hybride rechargeable', thermique: true },
    { code: 'EL', nom: 'Électrique', thermique: false, exempte: true },
    { code: 'GPL', nom: 'GPL', thermique: true },
    { code: 'GNV', nom: 'GNV', thermique: true },
    { code: 'H2', nom: 'Hydrogène', thermique: false, exempte: true },
    { code: 'AU', nom: 'Autre', thermique: true },
  ],

  // Contrôle technique : périodicités par défaut, modifiables dans les réglages.
  ct: {
    premierMois: 48,
    periodiqueMois: 24,
    pollutionMois: 12,
    sources: [
      { titre: 'Contrôle technique d\'une voiture (catégorie M1)', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2878', verifie: '1er janvier 2026',
        resume: '1er contrôle dans les 6 mois avant le 4e anniversaire de la 1re mise en circulation ; un résultat favorable est valable 2 ans.' },
      { titre: 'Contrôle technique d\'une camionnette (catégorie N1)', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F33353', verifie: '1er janvier 2026',
        resume: 'Mêmes délais ; contrôle complémentaire pollution dans les 2 mois précédant la fin d\'un délai d\'un an après chaque contrôle périodique. Exemptés notamment : véhicules électriques, à hydrogène, hybrides hydrogène-électrique, de collection.' },
    ],
    consulte: '13/11/2026',
  },

  // Désignation du conducteur par une personne morale (modifiable dans les réglages).
  designation: {
    jours: 45,
    texte: 'Article L121-6 du Code de la route',
    version: 'version en vigueur depuis le 31 décembre 2025',
    url: 'https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006074228/LEGISCTA000006159506/',
    consulte: '13/11/2026',
    resume: 'Le représentant légal d\'une personne morale titulaire du certificat d\'immatriculation désigne la personne qui conduisait, dans les 45 jours à compter de l\'envoi ou de la remise de l\'avis de contravention, sauf vol, usurpation de plaque ou force majeure.',
  },

  // Plan d'entretien INDICATIF : ordres de grandeur courants, le carnet du constructeur fait foi.
  // km et mois à 0 = critère non utilisé. pour : 'tous' | 'thermique' | 'electrique'.
  entretiens: [
    { code: 'REV', nom: 'Révision constructeur', km: 20000, mois: 12, pour: 'tous' },
    { code: 'VID', nom: 'Vidange et filtre à huile', km: 20000, mois: 12, pour: 'thermique' },
    { code: 'FAI', nom: 'Filtre à air', km: 40000, mois: 24, pour: 'thermique' },
    { code: 'FHA', nom: 'Filtre d\'habitacle', km: 20000, mois: 12, pour: 'tous' },
    { code: 'LDF', nom: 'Liquide de frein', km: 0, mois: 24, pour: 'tous' },
    { code: 'FRE', nom: 'Contrôle des freins (plaquettes, disques)', km: 20000, mois: 12, pour: 'tous' },
    { code: 'PNE', nom: 'Pneumatiques (usure, pression, permutation)', km: 10000, mois: 6, pour: 'tous' },
    { code: 'LDR', nom: 'Liquide de refroidissement', km: 60000, mois: 48, pour: 'tous' },
    { code: 'DIS', nom: 'Distribution (courroie : très variable selon le moteur)', km: 120000, mois: 72, pour: 'thermique' },
    { code: 'CLI', nom: 'Climatisation', km: 0, mois: 24, pour: 'tous' },
    { code: 'BAT', nom: 'Batterie 12 V (contrôle)', km: 0, mois: 12, pour: 'tous' },
  ],

  // Postes de dépenses (les loyers, entretiens, contrôles et sinistres ont leur propre saisie).
  postes: [
    { code: 'ENE', nom: 'Énergie (carburant, recharge)' },
    { code: 'ASS', nom: 'Assurance' },
    { code: 'PEA', nom: 'Péages et stationnement' },
    { code: 'PNE', nom: 'Pneumatiques' },
    { code: 'REP', nom: 'Réparations hors entretien' },
    { code: 'LAV', nom: 'Lavage' },
    { code: 'AUT', nom: 'Autre' },
  ],

  // Couleurs fixes des postes de coût (ordre du graphique), charte QME.
  couleurs: { detention: '#1D4E89', depenses: '#F5B400', entretien: '#D9302A', sinistres: '#141414' },

  rgpd: [
    'Ne saisis que le nécessaire : nom, service, date de vérification du permis. Pas de points de permis, pas de données de santé, pas d\'adresse personnelle.',
    'Informe les conducteurs que leurs réservations, sinistres et amendes sont suivis dans cet outil, et pourquoi.',
    'Les amendes sont des données relatives à des infractions (article 10 du RGPD) : accès limité à la personne chargée de la flotte, suppression quand le dossier est clos et que plus rien ne justifie de les garder.',
    'Un conducteur qui quitte la structure : supprime sa fiche quand plus aucun dossier ouvert ne le concerne.',
  ],
};
