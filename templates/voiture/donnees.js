// Base intégrée du carnet de voiture : énergies, contrôle technique (sourcé), plan d'entretien
// indicatif, catégories de dépenses, conseils. Aucune marque de véhicule, de carburant ni de garage.
// Aucun prix de carburant ou d'électricité : ils sont saisis à chaque plein ou recharge.
// Sources consultées le 14/11/2026 (voir docs/templates/fiches/voiture.md).
window.BASE = {
  version: '2026-11-14',

  // Réglages de départ (modifiables dans les Réglages).
  reglages: {
    alerteJours: 30,
    alerteKm: 1000,
    releveAncienJours: 60,
    ctPremierMois: 48,
    ctPeriodiqueMois: 24,
    ctContreVisiteMois: 2,
    ctVerifieLe: '2026-01-01',
  },

  // Types de véhicule. Seule la voiture particulière (M1) a une règle de contrôle technique intégrée,
  // vérifiée sur service-public.gouv.fr. Pour un autre véhicule, la périodicité est saisie.
  types: [
    { code: 'M1', nom: 'Voiture particulière', court: 'Voiture' },
    { code: 'AUTRE', nom: 'Autre véhicule (deux-roues, camping-car, utilitaire…) : périodicité à saisir', court: 'Autre' },
  ],

  // carburant : pleins en litres ; electrique : recharges en kWh. Les deux pour l'hybride rechargeable.
  energies: [
    { code: 'ES', nom: 'Essence', carburant: true, electrique: false },
    { code: 'GO', nom: 'Diesel', carburant: true, electrique: false },
    { code: 'HY', nom: 'Hybride (non rechargeable)', carburant: true, electrique: false },
    { code: 'HR', nom: 'Hybride rechargeable', carburant: true, electrique: true },
    { code: 'EL', nom: 'Électrique', carburant: false, electrique: true },
    { code: 'GPL', nom: 'GPL ou bicarburation', carburant: true, electrique: false },
    { code: 'AU', nom: 'Autre', carburant: true, electrique: false },
  ],

  // Contrôle technique d'une voiture particulière : périodicités par défaut, modifiables.
  ct: {
    source: {
      titre: 'Contrôle technique d\'une voiture (catégorie M1)',
      editeur: 'service-public.gouv.fr, fiche F2878',
      url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2878',
      verifie: '1er janvier 2026',
      consulte: '14/11/2026',
      resume: 'Le 1er contrôle technique se fait dans les 6 mois avant le 4e anniversaire de la 1re mise en circulation. Un résultat favorable est valable 2 ans (exemple de la fiche : contrôle du 14 mai 2025, prochain au plus tard le 13 mai 2027). Après une défaillance majeure ou critique, la contre-visite se fait dans les 2 mois ; une défaillance critique limite la validité au jour du contrôle. Une contre-visite favorable est valable 2 ans à compter du contrôle défavorable. Obligatoire quelle que soit l\'énergie (thermique, hybride, électrique).',
    },
  },

  // Plan d'entretien INDICATIF : ordres de grandeur courants, rédigés pour le produit.
  // Le carnet d'entretien du constructeur prime toujours. km ou mois à 0 = critère non utilisé.
  // pour : 'tous' | 'thermique' (moteur à combustion) | 'electrique' (électrique seul).
  entretiens: [
    { code: 'REV', nom: 'Révision (selon le carnet du constructeur)', km: 20000, mois: 12, pour: 'tous' },
    { code: 'VID', nom: 'Vidange et filtre à huile', km: 15000, mois: 12, pour: 'thermique' },
    { code: 'FAI', nom: 'Filtre à air', km: 30000, mois: 24, pour: 'thermique' },
    { code: 'FHA', nom: 'Filtre d\'habitacle', km: 20000, mois: 12, pour: 'tous' },
    { code: 'LDF', nom: 'Liquide de frein', km: 0, mois: 24, pour: 'tous' },
    { code: 'FRE', nom: 'Freins (plaquettes, disques) : contrôle', km: 20000, mois: 12, pour: 'tous' },
    { code: 'PNE', nom: 'Pneus : usure, pression, permutation', km: 10000, mois: 12, pour: 'tous' },
    { code: 'LDR', nom: 'Liquide de refroidissement', km: 60000, mois: 48, pour: 'tous' },
    { code: 'DIS', nom: 'Distribution (très variable selon le moteur)', km: 120000, mois: 72, pour: 'thermique' },
    { code: 'CLI', nom: 'Climatisation : contrôle', km: 0, mois: 24, pour: 'tous' },
    { code: 'BAT', nom: 'Batterie 12 V : contrôle', km: 0, mois: 24, pour: 'tous' },
  ],

  // Catégories de dépenses. ENT et CT viennent aussi des entretiens et contrôles saisis (pas de double
  // saisie). groupe : regroupement du graphique des coûts.
  categories: [
    { code: 'CAR', nom: 'Carburant', groupe: 'energie', energie: 'carburant' },
    { code: 'REC', nom: 'Recharge électrique', groupe: 'energie', energie: 'electrique' },
    { code: 'ENT', nom: 'Entretien', groupe: 'entretien', auto: true },
    { code: 'CT', nom: 'Contrôle technique', groupe: 'entretien', auto: true },
    { code: 'REP', nom: 'Réparations', groupe: 'reparations' },
    { code: 'PNE', nom: 'Pneus', groupe: 'reparations' },
    { code: 'ASS', nom: 'Assurance', groupe: 'assurance' },
    { code: 'PEA', nom: 'Péage', groupe: 'trajets' },
    { code: 'STA', nom: 'Stationnement', groupe: 'trajets' },
    { code: 'FIN', nom: 'Crédit ou location', groupe: 'autre' },
    { code: 'AUT', nom: 'Autre (lavage, accessoires…)', groupe: 'autre' },
  ],
  groupes: [
    { code: 'energie', nom: 'Énergie' },
    { code: 'entretien', nom: 'Entretien et contrôle' },
    { code: 'reparations', nom: 'Réparations et pneus' },
    { code: 'assurance', nom: 'Assurance' },
    { code: 'trajets', nom: 'Péage et stationnement' },
    { code: 'autre', nom: 'Crédit, location et autre' },
  ],

  conseils: [
    ['Le carnet du constructeur prime', 'Le plan d\'entretien proposé est indicatif : recopie les intervalles du carnet d\'entretien de ta voiture, ils priment.'],
    ['Note le compteur à chaque plein', 'Avec le kilométrage et le réservoir plein, la consommation se calcule d\'un plein à l\'autre.'],
    ['Garde les factures', 'Chaque entretien noté (date, km, garage) construit l\'historique à imprimer le jour de la revente.'],
    ['Saisis tes prix', 'Aucun prix de carburant ni d\'électricité n\'est intégré : tu notes ce que tu as payé.'],
  ],
};
