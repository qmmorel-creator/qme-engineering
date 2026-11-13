// ContrôleRéception · base intégrée (aucune logique ici).
// Modèles de contrôle GÉNÉRIQUES établis par QME pour démarrer : ce ne sont ni des exigences
// réglementaires ni une certification. Plages de mesure et tolérances indicatives, à adapter aux
// produits, aux contrats fournisseurs et à la réglementation qui s'applique à ton activité.
window.BASE = {
  version: '2026-11-13',
  avertissement: 'Modèles de contrôle génériques et valeurs indicatives (QME, 13/11/2026) : ils ne constituent ni une exigence réglementaire ni une certification. Adapte-les à tes produits, à tes contrats et à la réglementation applicable.',

  unites: ['u', 'kg', 'g', 't', 'm', 'm²', 'm³', 'L', 'carton', 'colis', 'palette', 'lot'],

  gravites: [
    { id: 'mineure', nom: 'Mineure', aide: 'Défaut d\'aspect ou documentaire sans effet sur l\'usage.' },
    { id: 'majeure', nom: 'Majeure', aide: 'Défaut qui gêne l\'usage ou la revente d\'une partie de la livraison.' },
    { id: 'critique', nom: 'Critique', aide: 'Risque pour la sécurité, la santé ou l\'usage : la livraison est non conforme.' },
  ],
  typesConstat: [
    { id: 'quantitatif', nom: 'Quantitatif (manquant, excédent)' },
    { id: 'qualitatif', nom: 'Qualitatif (casse, défaut, dates)' },
    { id: 'documentaire', nom: 'Documentaire (bon de livraison, certificat, étiquetage)' },
    { id: 'logistique', nom: 'Logistique (retard, conditions de transport)' },
  ],

  // Points communs à toutes les familles (ajoutés en tête de chaque liste).
  communs: [
    { id: 'bl', libelle: 'Bon de livraison présent et cohérent avec la commande', type: 'documentaire', critique: false },
    { id: 'emballage', libelle: 'Emballages et palettes intacts (pas d\'écrasement, de choc, d\'humidité)', type: 'visuel', critique: false },
    { id: 'etiquetage', libelle: 'Étiquetage lisible, références et lots identifiables', type: 'documentaire', critique: false },
  ],

  familles: [
    { id: 'frais', nom: 'Produits frais réfrigérés', tolerance: 2, controles: [
      { id: 'temp', libelle: 'Température à cœur ou en surface à réception', type: 'mesure', critique: true, unite: '°C', min: 0, max: 4, aide: 'Plage indicative à adapter à chaque produit et à la réglementation applicable.' },
      { id: 'dlc', libelle: 'Dates limites suffisantes pour l\'utilisation prévue', type: 'documentaire', critique: true },
      { id: 'vehicule', libelle: 'Véhicule de transport propre et réfrigéré', type: 'visuel', critique: false },
      { id: 'aspect', libelle: 'Aspect, odeur et couleur normaux', type: 'visuel', critique: true },
    ] },
    { id: 'surgeles', nom: 'Produits surgelés', tolerance: 2, controles: [
      { id: 'temp', libelle: 'Température des produits à réception', type: 'mesure', critique: true, unite: '°C', min: -30, max: -18, aide: 'Valeur indicative : vérifie les tolérances admises pendant le transport.' },
      { id: 'givre', libelle: 'Absence de givre excessif ou de signe de décongélation', type: 'visuel', critique: true },
      { id: 'dates', libelle: 'Dates de durabilité suffisantes', type: 'documentaire', critique: false },
    ] },
    { id: 'epicerie', nom: 'Épicerie et produits secs', tolerance: 2, controles: [
      { id: 'dates', libelle: 'Dates de durabilité suffisantes', type: 'documentaire', critique: false },
      { id: 'nuisibles', libelle: 'Absence de trace de nuisibles', type: 'visuel', critique: true },
      { id: 'humidite', libelle: 'Absence d\'humidité ou de moisissure', type: 'visuel', critique: true },
    ] },
    { id: 'materiaux', nom: 'Matériaux de construction', tolerance: 3, controles: [
      { id: 'reference', libelle: 'Références, dimensions et classes conformes à la commande', type: 'documentaire', critique: true },
      { id: 'documents', libelle: 'Fiches techniques, marquages et documents d\'accompagnement fournis', type: 'documentaire', critique: false },
      { id: 'etat', libelle: 'Absence de casse, d\'épaufrure ou de déformation', type: 'visuel', critique: false },
      { id: 'stockage', libelle: 'Produits protégés des intempéries à la livraison', type: 'visuel', critique: false },
    ] },
    { id: 'mecanique', nom: 'Pièces mécaniques', tolerance: 0, controles: [
      { id: 'cote', libelle: 'Cote de contrôle sur échantillon', type: 'mesure', critique: true, unite: 'mm', min: null, max: null, aide: 'Saisis la plage de tolérance de ton plan dans le référentiel.' },
      { id: 'certificat', libelle: 'Certificat matière ou de conformité fourni si demandé', type: 'documentaire', critique: false },
      { id: 'corrosion', libelle: 'Absence de corrosion, de bavure et de choc', type: 'visuel', critique: false },
      { id: 'quantite-lot', libelle: 'Quantité par lot et traçabilité conformes', type: 'documentaire', critique: false },
    ] },
    { id: 'electronique', nom: 'Composants électroniques', tolerance: 0, controles: [
      { id: 'antistatique', libelle: 'Emballage antistatique intact', type: 'visuel', critique: true },
      { id: 'humidite', libelle: 'Indicateur d\'humidité et sachet dessiccant conformes', type: 'visuel', critique: false },
      { id: 'references', libelle: 'Références, marquages et codes de lot conformes', type: 'documentaire', critique: true },
    ] },
    { id: 'chimique', nom: 'Produits chimiques et dangereux', tolerance: 0, controles: [
      { id: 'fds', libelle: 'Fiche de données de sécurité disponible', type: 'documentaire', critique: true },
      { id: 'etiquette-danger', libelle: 'Étiquetage de danger présent et lisible', type: 'documentaire', critique: true },
      { id: 'etancheite', libelle: 'Contenants fermés et étanches, sans fuite', type: 'visuel', critique: true },
      { id: 'incompatibilites', libelle: 'Rangement prévu compatible avec les autres produits', type: 'visuel', critique: false },
    ] },
    { id: 'fournitures', nom: 'Fournitures et consommables', tolerance: 2, controles: [
      { id: 'references', libelle: 'Références et conditionnements conformes', type: 'documentaire', critique: false },
      { id: 'aspect', libelle: 'Aspect correct, pas de produit abîmé', type: 'visuel', critique: false },
    ] },
    { id: 'equipements', nom: 'Équipements et mobilier', tolerance: 0, controles: [
      { id: 'aspect', libelle: 'Aspect : rayures, chocs, finitions', type: 'visuel', critique: false },
      { id: 'accessoires', libelle: 'Accessoires, quincaillerie et notice présents', type: 'documentaire', critique: false },
      { id: 'fonctionnement', libelle: 'Mise en marche ou essai de fonctionnement réussi', type: 'visuel', critique: true },
      { id: 'serie', libelle: 'Numéros de série relevés', type: 'documentaire', critique: false },
    ] },
    { id: 'textile', nom: 'Textiles et habillement', tolerance: 2, controles: [
      { id: 'tailles', libelle: 'Tailles, coloris et références conformes', type: 'documentaire', critique: false },
      { id: 'defauts', libelle: 'Absence de tache, d\'accroc ou de défaut de couture', type: 'visuel', critique: false },
    ] },
    { id: 'generique', nom: 'Livraison générique', tolerance: 0, controles: [
      { id: 'conformite', libelle: 'Marchandise conforme à la commande', type: 'visuel', critique: true },
    ] },
  ],

  conseils: [
    ['Contrôler avant de signer', 'Compte et regarde avant de signer le bon du transporteur : une réserve se note sur le bon au moment de la livraison.'],
    ['Des réserves précises', 'Une réserve utile dit quoi, combien et où : « 2 cartons écrasés sur 12, produits visibles abîmés ».'],
    ['Tolérances', 'Une tolérance de quantité évite de bloquer une livraison pour un écart prévu au contrat (vrac, coupe, poids).'],
    ['Traçabilité', 'Le procès-verbal, les photos et l\'historique par fournisseur servent à la réclamation et au choix des fournisseurs.'],
  ],
};
