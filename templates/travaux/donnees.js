// Base intégrée du pilote de travaux maison : types de postes, ordre habituel, modèles de planning,
// taux de TVA travaux (source datée) et liens officiels. Aucun prix moyen, aucun montant d'aide.
window.BASE = {
  // Provision pour imprévus proposée (en % du budget prévu), modifiable dans les réglages.
  imprevusDefaut: 10,

  couleurs: [
    { id: 'rouge', hex: '#D9302A' },
    { id: 'bleu', hex: '#1D4E89' },
    { id: 'jaune', hex: '#F5B400' },
    { id: 'encre', hex: '#141414' },
    { id: 'vert', hex: '#2E7D4F' },
    { id: 'orange', hex: '#E8702A' },
    { id: 'ciel', hex: '#4A90C2' },
    { id: 'prune', hex: '#7A3E6B' },
  ],

  // Types de postes. rang = place dans l'ordre habituel d'un chantier de rénovation (à adapter).
  // verifier = points à retrouver sur le devis pour comparer à périmètre égal.
  postes: [
    { code: 'DEM', nom: 'Dépose et démolition', metier: 'Maçon ou entreprise générale', rang: 1,
      verifier: ['Dépose des équipements existants', 'Évacuation des gravats et déchets', 'Protection des sols et des pièces voisines', 'Murs porteurs : avis d\'un professionnel de la structure'] },
    { code: 'MAC', nom: 'Maçonnerie et ouvertures', metier: 'Maçon', rang: 2,
      verifier: ['Nature exacte des ouvertures ou reprises', 'Étaiement et linteaux', 'Enduits et rebouchages compris ou non', 'Évacuation des gravats'] },
    { code: 'MEX', nom: 'Menuiseries extérieures', metier: 'Menuisier', rang: 3,
      verifier: ['Matériau, vitrage et dimensions', 'Dépose des anciennes menuiseries', 'Habillages et finitions intérieures', 'Volets et occultations'] },
    { code: 'PLB', nom: 'Plomberie', metier: 'Plombier', rang: 4,
      verifier: ['Fourniture des équipements ou pose seule', 'Alimentations et évacuations à reprendre', 'Raccordement et mise en service', 'Coupure d\'eau : durée annoncée'] },
    { code: 'ELE', nom: 'Électricité', metier: 'Électricien', rang: 4,
      verifier: ['Nombre de prises, points lumineux et circuits', 'Tableau électrique : reprise ou non', 'Saignées et rebouchages', 'Attestation de conformité si exigée'] },
    { code: 'CVC', nom: 'Chauffage et ventilation', metier: 'Chauffagiste', rang: 4,
      verifier: ['Équipement : marque libre, puissance, emplacement', 'Dépose de l\'ancien équipement', 'Mise en service et réglages', 'Taux de TVA appliqué'] },
    { code: 'ISO', nom: 'Isolation et plâtrerie', metier: 'Plaquiste', rang: 5,
      verifier: ['Surface et épaisseur d\'isolant', 'Cloisons, doublages et plafonds', 'Bandes et enduits de finition', 'Taux de TVA appliqué'] },
    { code: 'ETA', nom: 'Étanchéité des pièces d\'eau', metier: 'Carreleur ou plombier', rang: 5,
      verifier: ['Système d\'étanchéité sous carrelage', 'Zones traitées (douche, sol, remontées)', 'Siphon et pente', 'Temps de séchage'] },
    { code: 'CHA', nom: 'Chape et ragréage', metier: 'Maçon ou carreleur', rang: 6,
      verifier: ['Surface et épaisseur', 'Temps de séchage avant revêtement', 'Préparation du support'] },
    { code: 'CAR', nom: 'Carrelage et faïence', metier: 'Carreleur', rang: 6,
      verifier: ['Fourniture du carrelage ou pose seule', 'Surface, format et calepinage', 'Plinthes, joints et profilés', 'Découpes et finitions'] },
    { code: 'MIN', nom: 'Menuiseries intérieures', metier: 'Menuisier', rang: 7,
      verifier: ['Portes : fourniture, quincaillerie, sens d\'ouverture', 'Placards et rangements', 'Ajustage après revêtement de sol'] },
    { code: 'SOL', nom: 'Revêtements de sol', metier: 'Solier ou parqueteur', rang: 8,
      verifier: ['Fourniture ou pose seule', 'Préparation du support', 'Plinthes et barres de seuil', 'Surface comptée (pertes comprises)'] },
    { code: 'PEI', nom: 'Peinture', metier: 'Peintre', rang: 8,
      verifier: ['Nombre de couches et finition', 'Préparation (rebouchage, ponçage, impression)', 'Surfaces comprises : murs, plafonds, boiseries', 'Protection des sols'] },
    { code: 'CUI', nom: 'Pose de la cuisine', metier: 'Cuisiniste ou menuisier', rang: 9,
      verifier: ['Meubles, plan de travail et électroménager compris ou non', 'Raccordements eau et électricité', 'Crédence et finitions', 'Délai de livraison des meubles'] },
    { code: 'SAN', nom: 'Pose des sanitaires', metier: 'Plombier', rang: 9,
      verifier: ['Équipements fournis par qui', 'Raccordements et joints', 'Accessoires (barres, miroirs, meubles)'] },
    { code: 'EXT', nom: 'Façade, toiture et extérieurs', metier: 'Couvreur ou façadier', rang: 3,
      verifier: ['Échafaudage compris', 'Démarches d\'urbanisme : qui s\'en charge', 'Surface et nature des travaux', 'Évacuation des déchets'] },
    { code: 'NET', nom: 'Nettoyage de fin de chantier', metier: 'Entreprise de nettoyage', rang: 10,
      verifier: ['Pièces comprises', 'Vitres et menuiseries', 'Évacuation des derniers déchets'] },
    { code: 'AUT', nom: 'Autre poste', metier: 'Artisan', rang: 5,
      verifier: ['Périmètre exact des travaux', 'Fournitures comprises ou non', 'Délai et conditions de paiement'] },
  ],

  // Modèles de planning. Chaque étape : type de poste, pièce (index dans pieces, null = tout le
  // logement), durée de départ en jours calendaires (à remplacer par celle de l'artisan), et
  // avec: true pour démarrer en même temps que l'étape précédente.
  modeles: [
    { id: 'cuisine', nom: 'Cuisine', detail: 'Dépose, réseaux, murs, sol, pose des meubles',
      pieces: ['Cuisine'],
      etapes: [
        { code: 'DEM', piece: 0, duree: 2 },
        { code: 'PLB', piece: 0, duree: 2 },
        { code: 'ELE', piece: 0, duree: 2, avec: true },
        { code: 'ISO', piece: 0, duree: 3 },
        { code: 'CAR', piece: 0, duree: 3 },
        { code: 'PEI', piece: 0, duree: 2 },
        { code: 'CUI', piece: 0, duree: 3 },
      ] },
    { id: 'sdb', nom: 'Salle de bains', detail: 'Dépose, réseaux, étanchéité, carrelage, sanitaires',
      pieces: ['Salle de bains'],
      etapes: [
        { code: 'DEM', piece: 0, duree: 2 },
        { code: 'PLB', piece: 0, duree: 2 },
        { code: 'ELE', piece: 0, duree: 1, avec: true },
        { code: 'ISO', piece: 0, duree: 2 },
        { code: 'ETA', piece: 0, duree: 2 },
        { code: 'CAR', piece: 0, duree: 4 },
        { code: 'PEI', piece: 0, duree: 2 },
        { code: 'SAN', piece: 0, duree: 2 },
      ] },
    { id: 'appartement', nom: 'Rénovation complète d\'un appartement', detail: 'Toutes les pièces, dans l\'ordre habituel',
      pieces: ['Séjour', 'Cuisine', 'Salle de bains', 'Chambre', 'Entrée'],
      etapes: [
        { code: 'DEM', piece: null, duree: 5 },
        { code: 'MEX', piece: null, duree: 3 },
        { code: 'PLB', piece: null, duree: 5 },
        { code: 'ELE', piece: null, duree: 7, avec: true },
        { code: 'CVC', piece: null, duree: 3 },
        { code: 'ISO', piece: null, duree: 10 },
        { code: 'ETA', piece: 2, duree: 2 },
        { code: 'CAR', piece: 2, duree: 5 },
        { code: 'CHA', piece: null, duree: 3 },
        { code: 'MIN', piece: null, duree: 3 },
        { code: 'SOL', piece: null, duree: 5 },
        { code: 'PEI', piece: null, duree: 8, avec: true },
        { code: 'CUI', piece: 1, duree: 3 },
        { code: 'SAN', piece: 2, duree: 2, avec: true },
        { code: 'NET', piece: null, duree: 1 },
      ] },
  ],

  // Taux de TVA applicables aux travaux dans un logement, France métropolitaine.
  tva: {
    taux: [5.5, 10, 20],
    source: 'Entreprendre Service Public, « Taux de TVA pour les travaux de rénovation d\'un logement » (fiche F23568)',
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23568',
    verifieLe: '2026-02-21', // date « Vérifié le » affichée par la page officielle
    consulteLe: '2026-11-13',
  },

  garanties: {
    source: 'Service Public, « Garanties après la réception des travaux » (fiche F2958)',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2958',
    verifieLe: '2026-09-25',
    consulteLe: '2026-11-13',
  },

  // Aides publiques : renvoi vers les sites officiels, aucun montant repris.
  aides: [
    { nom: 'MaPrimeRénov\' (fiche Service Public F35083)', url: 'https://www.service-public.fr/particuliers/vosdroits/F35083', verifieLe: '2026-09-01' },
    { nom: 'France Rénov\', portail public de la rénovation de l\'habitat', url: 'https://france-renov.gouv.fr/', verifieLe: null },
    { nom: 'TVA à taux réduit pour les travaux (fiche F23568)', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23568', verifieLe: '2026-02-21' },
  ],
  aidesConsulteLe: '2026-11-13',
};
