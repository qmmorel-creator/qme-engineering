// Base intégrée du circuit de visa : codes d'avis, lots types du bâtiment, types de documents,
// documents usuels par lot, rôles des viseurs. Aucun délai réglementaire : les délais sont des
// valeurs de départ, à remplacer par celles du marché (CCAP, convention de maîtrise d'œuvre).
window.BASE = {
  // Valeurs de départ des réglages (modifiables, et par opération).
  reglages: { delaiVisa: 15, delaiResoumission: 15, ouvres: false, frequenceRelance: 7, alerte: 3, vaoNouvelIndice: true },

  // Ordre de sévérité croissante : la synthèse retient le plus sévère.
  avis: [
    { code: 'VSO', nom: 'Visa sans observation', couleur: '#1D4E89', texte: '#fff',
      sens: 'Le document est conforme au projet : bon pour exécution.', suite: 'Document clos. L\'entreprise peut exécuter.' },
    { code: 'VAO', nom: 'Visa avec observations', couleur: '#F5B400', texte: '#141414',
      sens: 'Le document est acceptable sous réserve de prendre en compte les observations.', suite: 'Exécution possible en intégrant les observations ; un nouvel indice les reprenant est en général demandé (réglable).' },
    { code: 'REF', nom: 'Refusé', couleur: '#D9302A', texte: '#fff',
      sens: 'Le document n\'est pas conforme au projet ou est incomplet.', suite: 'Pas d\'exécution. L\'entreprise remet un nouvel indice corrigé.' },
  ],

  couleurs: [
    { id: 'rouge', hex: '#D9302A', nom: 'Rouge' },
    { id: 'bleu', hex: '#1D4E89', nom: 'Bleu' },
    { id: 'jaune', hex: '#F5B400', nom: 'Jaune' },
    { id: 'encre', hex: '#141414', nom: 'Noir' },
    { id: 'vert', hex: '#2E7D4F', nom: 'Vert' },
    { id: 'orange', hex: '#E8702A', nom: 'Orange' },
    { id: 'ciel', hex: '#4A90C2', nom: 'Bleu ciel' },
    { id: 'prune', hex: '#7A3E6B', nom: 'Prune' },
  ],

  typesOperation: [
    { id: 'tertiaire', nom: 'Bâtiment tertiaire' },
    { id: 'logement', nom: 'Logement' },
    { id: 'equipement', nom: 'Équipement public' },
    { id: 'autre', nom: 'Autre' },
  ],

  roles: ['Architecte', 'BET structure', 'BET fluides', 'BET électricité', 'BET façades', 'Économiste', 'Contrôleur technique', 'OPC', 'Maître d\'ouvrage', 'Autre'],

  types: [
    { code: 'PEX', nom: 'Plan d\'exécution' },
    { code: 'NDC', nom: 'Note de calcul' },
    { code: 'FT', nom: 'Fiche technique' },
    { code: 'ECH', nom: 'Échantillon ou prototype' },
    { code: 'DET', nom: 'Carnet de détails' },
    { code: 'RES', nom: 'Plan de réservations' },
    { code: 'MET', nom: 'Méthodologie' },
    { code: 'PV', nom: 'Procès-verbal d\'essai' },
    { code: 'NOT', nom: 'Notice technique' },
    { code: 'CAL', nom: 'Calepinage' },
    { code: 'SCH', nom: 'Schéma de principe' },
  ],

  // Lots types tous corps d'état ; documents usuels : [titre, code du type].
  lots: [
    { code: 'DEM', nom: 'Démolition – désamiantage', docs: [['Méthodologie de démolition', 'MET'], ['Plan de phasage des démolitions', 'PEX'], ['Plan de retrait et de confinement', 'PEX'], ['Plan d\'installation de chantier', 'PEX']] },
    { code: 'VRD', nom: 'Terrassements – VRD', docs: [['Plan des réseaux enterrés', 'PEX'], ['Profils en long des réseaux', 'PEX'], ['Note de dimensionnement des chaussées', 'NDC'], ['Fiches techniques des regards et canalisations', 'FT'], ['Plan de nivellement', 'PEX']] },
    { code: 'GO', nom: 'Gros œuvre', docs: [['Plans de fondations', 'PEX'], ['Plans de coffrage', 'PEX'], ['Plans de ferraillage', 'PEX'], ['Note de calcul de structure', 'NDC'], ['Plans de réservations', 'RES'], ['Méthodologie de bétonnage', 'MET']] },
    { code: 'CH', nom: 'Charpente', docs: [['Plans de charpente', 'PEX'], ['Note de calcul de charpente', 'NDC'], ['Détails d\'assemblage', 'DET'], ['Fiches techniques des bois et connecteurs', 'FT']] },
    { code: 'COU', nom: 'Couverture – étanchéité', docs: [['Plan de calepinage de couverture', 'CAL'], ['Carnet de détails d\'étanchéité', 'DET'], ['Fiches techniques des membranes et isolants', 'FT'], ['Note de calcul des descentes d\'eaux pluviales', 'NDC']] },
    { code: 'FAC', nom: 'Façades – bardage', docs: [['Calepinage des façades', 'CAL'], ['Carnet de détails de façade', 'DET'], ['Note de calcul de l\'ossature', 'NDC'], ['Échantillon de parement', 'ECH'], ['Fiches techniques des panneaux', 'FT']] },
    { code: 'MEX', nom: 'Menuiseries extérieures', docs: [['Plans et coupes des menuiseries', 'PEX'], ['Carnet de détails de pose', 'DET'], ['Fiches techniques des vitrages', 'FT'], ['Note de calcul des menuiseries', 'NDC'], ['Prototype de menuiserie', 'ECH']] },
    { code: 'SER', nom: 'Serrurerie – métallerie', docs: [['Plans des garde-corps', 'PEX'], ['Plans des escaliers métalliques', 'PEX'], ['Note de calcul des ouvrages métalliques', 'NDC'], ['Fiches techniques des finitions', 'FT']] },
    { code: 'CLO', nom: 'Cloisons – doublages – plafonds', docs: [['Plans de cloisonnement', 'PEX'], ['Plans de faux plafonds', 'PEX'], ['Fiches techniques des cloisons', 'FT'], ['Carnet de détails', 'DET']] },
    { code: 'MIN', nom: 'Menuiseries intérieures', docs: [['Carnet des portes', 'PEX'], ['Plans des agencements', 'PEX'], ['Fiches techniques des blocs-portes', 'FT'], ['Échantillon de finition', 'ECH']] },
    { code: 'SOL', nom: 'Revêtements de sols', docs: [['Calepinage des sols', 'CAL'], ['Fiches techniques des revêtements', 'FT'], ['Échantillons de revêtements', 'ECH'], ['Plan des joints de fractionnement', 'PEX']] },
    { code: 'PEI', nom: 'Peinture', docs: [['Nuancier et échantillons', 'ECH'], ['Fiches techniques des produits', 'FT'], ['Plan de repérage des teintes', 'PEX']] },
    { code: 'PLB', nom: 'Plomberie – sanitaires', docs: [['Plans des réseaux de plomberie', 'PEX'], ['Schéma de principe de production d\'eau chaude', 'SCH'], ['Note de dimensionnement des réseaux', 'NDC'], ['Fiches techniques des appareils sanitaires', 'FT'], ['Plans de réservations', 'RES']] },
    { code: 'CVC', nom: 'Chauffage – ventilation – climatisation', docs: [['Plans des réseaux aérauliques', 'PEX'], ['Plans des réseaux hydrauliques', 'PEX'], ['Schéma de principe', 'SCH'], ['Note de dimensionnement', 'NDC'], ['Fiches techniques des équipements', 'FT'], ['Plans de réservations', 'RES']] },
    { code: 'CFO', nom: 'Électricité courants forts', docs: [['Schémas des tableaux électriques', 'SCH'], ['Plans d\'éclairage', 'PEX'], ['Plans de distribution', 'PEX'], ['Note de calcul des sections de câbles', 'NDC'], ['Fiches techniques des luminaires', 'FT']] },
    { code: 'CFA', nom: 'Courants faibles', docs: [['Synoptique du réseau informatique', 'SCH'], ['Plans de sécurité incendie', 'PEX'], ['Plans de contrôle d\'accès', 'PEX'], ['Fiches techniques des matériels', 'FT']] },
    { code: 'ASC', nom: 'Ascenseurs', docs: [['Plan de gaine et de cuvette', 'PEX'], ['Note de calcul des réactions', 'NDC'], ['Fiches techniques de l\'appareil', 'FT'], ['Échantillon de finition de cabine', 'ECH']] },
    { code: 'ESV', nom: 'Aménagements extérieurs – espaces verts', docs: [['Plan de plantations', 'PEX'], ['Plan d\'arrosage', 'PEX'], ['Fiches techniques du mobilier extérieur', 'FT'], ['Palette végétale', 'ECH']] },
  ],

  sources: [
    { texte: 'Mission de visa : Code de la commande publique, article R2431-4, 7° (mission de base en bâtiment)', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037728187', date: '12/11/2026' },
    { texte: 'Jours fériés : Code du travail, article L3133-1 (métropole)', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033020901/', date: '12/11/2026' },
  ],
};
