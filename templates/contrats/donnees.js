// Base intégrée de Contrats fournisseurs et échéances (aucune logique ici).
// Règle du produit : aucune règle légale de résiliation sans source officielle datée. Les préavis par
// catégorie sont des VALEURS PAR DÉFAUT d'organisation, modifiables, à remplacer par ceux de chaque contrat
// (conditions générales ou particulières). Seule exception sourcée : la note sur les assurances (Code des
// assurances, art. L113-12, version en vigueur depuis le 28/05/2026, lue sur Légifrance le 14/11/2026).
// Aucune autre règle légale n'est intégrée ni citée : l'outil calcule à partir de ce que dit chaque contrat.
window.BASE = {
  version: '2026-11-14',

  // Réglages par défaut (modifiables) : alertes à J-60 et J-30 de la date limite, marge d'envoi du courrier.
  reglages: { alerteLongue: 60, alerteCourte: 30, margeEnvoi: 7, mention: 'HT' },

  periodicites: [
    { id: 'mensuel', nom: 'Par mois', court: '/ mois', parAn: 12 },
    { id: 'trimestriel', nom: 'Par trimestre', court: '/ trimestre', parAn: 4 },
    { id: 'semestriel', nom: 'Par semestre', court: '/ semestre', parAn: 2 },
    { id: 'annuel', nom: 'Par an', court: '/ an', parAn: 1 },
    { id: 'unique', nom: 'Paiement unique', court: 'une fois', parAn: 0 },
  ],

  decisions: [
    { id: 'a-decider', nom: 'À décider', detail: 'Aucune décision prise pour cette échéance' },
    { id: 'renouveler', nom: 'Renouveler', detail: 'On garde le contrat tel quel : plus d\'alerte jusqu\'à l\'échéance suivante' },
    { id: 'renegocier', nom: 'Renégocier', detail: 'Demander un meilleur prix ou d\'autres conditions avant la date limite' },
    { id: 'resilier', nom: 'Résilier', detail: 'Envoyer la résiliation avant la date limite' },
  ],

  modesEnvoi: ['Lettre recommandée avec accusé de réception', 'Courrier électronique', 'Espace client du fournisseur', 'Remise en main propre contre décharge', 'Autre'],

  // Couleurs fixes des catégories, dans l'ordre (jamais générées).
  couleurs: ['#2E5A88', '#E8B93A', '#B84A34', '#2E7D4F', '#7A5C99', '#E58C74', '#22476E', '#8A6D1F', '#514C44', '#5C8FD1'],

  // Catégories proposées. preavisMois : valeur par défaut d'organisation (null = à saisir pour chaque
  // contrat), reconduction et dureeMois : comportement le plus courant, à corriger contrat par contrat.
  categories: [
    { id: 'assurances', nom: 'Assurances', preavisMois: 2, reconduction: 'tacite', dureeMois: 12,
      exemples: 'Multirisque des locaux, responsabilité civile, flotte, cyber',
      source: { texte: 'Code des assurances, art. L113-12 : la police fixe la durée et les conditions de résiliation ; l\'assuré peut résilier à l\'expiration d\'un délai d\'un an en notifiant au moins deux mois avant l\'échéance. L\'article permet d\'y déroger pour les risques autres que ceux des particuliers : pour un contrat professionnel, lis les conditions de ta police.', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054141689', version: 'version en vigueur depuis le 28/05/2026 (loi n° 2026-403 du 26 mai 2026)', consulte: '14/11/2026' } },
    { id: 'maintenance', nom: 'Maintenance', preavisMois: 3, reconduction: 'tacite', dureeMois: 12, exemples: 'Climatisation, ascenseur, portes, chaudière, extincteurs' },
    { id: 'telecoms', nom: 'Télécoms et internet', preavisMois: 1, reconduction: 'tacite', dureeMois: 12, exemples: 'Fibre, téléphonie fixe et mobile, standard' },
    { id: 'leasing', nom: 'Location et leasing', preavisMois: 3, reconduction: 'tacite', dureeMois: 12, exemples: 'Copieurs, véhicules, matériel informatique, mobilier' },
    { id: 'logiciels', nom: 'Logiciels et abonnements', preavisMois: 1, reconduction: 'tacite', dureeMois: 12, exemples: 'Paie, comptabilité, messagerie, sauvegarde' },
    { id: 'nettoyage', nom: 'Nettoyage et hygiène', preavisMois: 3, reconduction: 'tacite', dureeMois: 12, exemples: 'Entretien des locaux, vitres, sanitaires, déchets' },
    { id: 'energie', nom: 'Énergie', preavisMois: 1, reconduction: 'aucune', dureeMois: 12, exemples: 'Électricité, gaz, eau' },
    { id: 'securite', nom: 'Sécurité et surveillance', preavisMois: 3, reconduction: 'tacite', dureeMois: 12, exemples: 'Télésurveillance, alarme, gardiennage, contrôle d\'accès' },
    { id: 'services', nom: 'Services et prestations', preavisMois: 3, reconduction: 'tacite', dureeMois: 12, exemples: 'Expert-comptable, affranchissement, fontaines à eau, plantes' },
    { id: 'autre', nom: 'Autre', preavisMois: null, reconduction: 'tacite', dureeMois: 12, exemples: 'Tout le reste' },
  ],

  conseils: [
    ['Rassemble tes contrats', 'Conditions particulières, dernier avenant, dernière facture : la date de fin et le préavis s\'y trouvent.'],
    ['Note la date de fin de la période en cours', 'L\'outil fait avancer les reconductions tacites et calcule la date limite d\'envoi.'],
    ['Décide avant la date limite', 'Renouveler, renégocier ou résilier : la lettre de résiliation se prépare en un clic.'],
  ],
};
