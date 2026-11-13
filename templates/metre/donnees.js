// MétréPro · base intégrée (aucune logique ici).
// Ratios, pertes et conditionnements : ORDRES DE GRANDEUR INDICATIFS établis par QME pour démarrer vite.
// Ils ne sont ni normatifs ni issus d'un fabricant : chaque utilisateur les adapte (fiches techniques,
// DTU, habitudes d'entreprise) dans l'onglet Bibliothèque. Aucune marque, aucun prix.
window.BASE = {
  version: '2026-11-13',
  sourceRatios: 'Ratios et pertes : ordres de grandeur indicatifs QME (13/11/2026), non normatifs. Vérifie-les sur les fiches techniques des produits retenus et les règles de l\'art applicables (DTU).',

  unites: { m: 'm', m2: 'm²', m3: 'm³', kg: 'kg', t: 't', u: 'u', l: 'L' },

  // Formes de calcul. Dimensions en mètres, sauf l'épaisseur (e) en centimètres.
  // « deduction » : 'surface' (ouvertures L × H) ou 'longueur' (passages de porte) ; absent = pas de déduction.
  formes: [
    { id: 'rect', nom: 'Surface rectangulaire (longueur × largeur)', unite: 'm2', champs: ['L', 'l'], deduction: 'surface' },
    { id: 'mur', nom: 'Surface de mur (longueur développée × hauteur)', unite: 'm2', champs: ['L', 'H'], deduction: 'surface' },
    { id: 'triangle', nom: 'Surface triangulaire (base × hauteur ÷ 2)', unite: 'm2', champs: ['b', 'h'], deduction: 'surface' },
    { id: 'disque', nom: 'Surface circulaire (diamètre)', unite: 'm2', champs: ['d'], deduction: 'surface' },
    { id: 'volume', nom: 'Volume (longueur × largeur × épaisseur)', unite: 'm3', champs: ['L', 'l', 'e'] },
    { id: 'cylindre', nom: 'Volume cylindrique (diamètre × hauteur)', unite: 'm3', champs: ['d', 'H'] },
    { id: 'lineaire', nom: 'Longueur', unite: 'm', champs: ['L'], deduction: 'longueur' },
    { id: 'perimetre', nom: 'Périmètre d\'un rectangle (2 × (L + l))', unite: 'm', champs: ['L', 'l'], deduction: 'longueur' },
    { id: 'unite', nom: 'Nombre d\'unités', unite: 'u', champs: [] },
    { id: 'direct', nom: 'Quantité saisie directement (justification obligatoire)', unite: null, champs: ['q'] },
  ],
  champs: {
    L: { nom: 'Longueur', unite: 'm' }, l: { nom: 'Largeur', unite: 'm' }, H: { nom: 'Hauteur', unite: 'm' },
    b: { nom: 'Base', unite: 'm' }, h: { nom: 'Hauteur', unite: 'm' }, d: { nom: 'Diamètre', unite: 'm' },
    e: { nom: 'Épaisseur', unite: 'cm' }, q: { nom: 'Quantité', unite: '' },
  },

  familles: [
    { id: 'terrassement', nom: 'Terrassement et VRD' },
    { id: 'grosoeuvre', nom: 'Gros œuvre' },
    { id: 'maconnerie', nom: 'Maçonnerie' },
    { id: 'charpente', nom: 'Charpente et couverture' },
    { id: 'isolation', nom: 'Isolation' },
    { id: 'platrerie', nom: 'Plâtrerie et cloisons' },
    { id: 'menuiseries', nom: 'Menuiseries' },
    { id: 'sols', nom: 'Revêtements de sols' },
    { id: 'murs', nom: 'Revêtements muraux et peinture' },
    { id: 'plomberie', nom: 'Plomberie' },
    { id: 'electricite', nom: 'Électricité' },
    { id: 'exterieur', nom: 'Aménagements extérieurs' },
    { id: 'divers', nom: 'Divers' },
  ],

  // Ouvrages : unité de mesure, forme proposée, perte (%), composants à commander.
  // Composant : ratio par unité d'ouvrage, unité, conditionnement (quantité par unité de commande, null = au détail).
  ouvrages: [
    // Terrassement et VRD
    { id: 'deblai', nom: 'Déblai en pleine masse', famille: 'terrassement', unite: 'm3', forme: 'volume', perte: 0,
      composants: [{ nom: 'Terres à évacuer (foisonnées, coefficient 1,25)', ratio: 1.25, unite: 'm3', cond: 1, uc: 'm³' }],
      note: 'Le foisonnement (augmentation de volume des terres extraites) dépend du sol : 1,1 à 1,4 selon la nature.' },
    { id: 'fouille', nom: 'Fouille en rigole (semelles)', famille: 'terrassement', unite: 'm3', forme: 'volume', perte: 0,
      composants: [{ nom: 'Terres à évacuer (foisonnées, coefficient 1,25)', ratio: 1.25, unite: 'm3', cond: 1, uc: 'm³' }] },
    { id: 'herisson', nom: 'Hérisson ou couche de forme en gravier', famille: 'terrassement', unite: 'm3', forme: 'volume', perte: 5,
      composants: [{ nom: 'Gravier 20/40 (masse volumique indicative 1,6 t/m³)', ratio: 1.6, unite: 't', cond: 1, uc: 'big bag de 1 t' }] },
    { id: 'tranchee', nom: 'Tranchée de réseau', famille: 'terrassement', unite: 'm', forme: 'lineaire', perte: 0,
      composants: [{ nom: 'Grillage avertisseur', ratio: 1, unite: 'm', cond: 25, uc: 'rouleau de 25 m' }, { nom: 'Gaine annelée de réseau', ratio: 1, unite: 'm', cond: 25, uc: 'couronne de 25 m' }] },

    // Gros œuvre
    { id: 'semelle', nom: 'Semelle filante en béton armé', famille: 'grosoeuvre', unite: 'm3', forme: 'volume', perte: 5,
      composants: [{ nom: 'Béton prêt à l\'emploi', ratio: 1, unite: 'm3', cond: 0.5, uc: 'tranche de 0,5 m³' }, { nom: 'Acier HA (ratio indicatif 40 kg/m³)', ratio: 40, unite: 'kg', cond: null, uc: 'kg' }] },
    { id: 'dalle', nom: 'Dalle en béton (béton prêt à l\'emploi)', famille: 'grosoeuvre', unite: 'm3', forme: 'volume', perte: 5,
      composants: [{ nom: 'Béton prêt à l\'emploi', ratio: 1, unite: 'm3', cond: 0.5, uc: 'tranche de 0,5 m³' }] },
    { id: 'beton-chantier', nom: 'Béton fabriqué sur chantier (dosé à 350 kg/m³)', famille: 'grosoeuvre', unite: 'm3', forme: 'volume', perte: 5,
      composants: [{ nom: 'Ciment', ratio: 350, unite: 'kg', cond: 35, uc: 'sac de 35 kg' }, { nom: 'Sable 0/4', ratio: 0.4, unite: 'm3', cond: null, uc: 'm³' }, { nom: 'Gravillons 4/20', ratio: 0.8, unite: 'm3', cond: null, uc: 'm³' }, { nom: 'Eau', ratio: 175, unite: 'l', cond: null, uc: 'L' }],
      note: 'Dosage courant pour un béton de fondation ou de dalle ; adapte-le à l\'usage.' },
    { id: 'treillis', nom: 'Treillis soudé de dalle', famille: 'grosoeuvre', unite: 'm2', forme: 'rect', perte: 15,
      composants: [{ nom: 'Panneau de treillis soudé 2,40 × 6,00 m', ratio: 1, unite: 'm2', cond: 14.4, uc: 'panneau de 14,40 m²' }],
      note: 'Perte élevée : recouvrements entre panneaux et découpes.' },
    { id: 'polyane', nom: 'Film polyéthylène sous dalle', famille: 'grosoeuvre', unite: 'm2', forme: 'rect', perte: 10,
      composants: [{ nom: 'Film polyéthylène', ratio: 1, unite: 'm2', cond: 100, uc: 'rouleau de 100 m²' }] },
    { id: 'chape', nom: 'Chape de mortier (dosée à 300 kg/m³ de sable)', famille: 'grosoeuvre', unite: 'm3', forme: 'volume', perte: 5,
      composants: [{ nom: 'Ciment', ratio: 300, unite: 'kg', cond: 35, uc: 'sac de 35 kg' }, { nom: 'Sable 0/4', ratio: 1, unite: 'm3', cond: null, uc: 'm³' }] },

    // Maçonnerie
    { id: 'parpaing20', nom: 'Mur en blocs béton creux de 20 cm (50 × 20)', famille: 'maconnerie', unite: 'm2', forme: 'mur', perte: 5,
      composants: [{ nom: 'Bloc béton creux 20 × 20 × 50 cm', ratio: 10, unite: 'u', cond: 60, uc: 'palette de 60 blocs' }, { nom: 'Mortier de montage', ratio: 20, unite: 'kg', cond: 35, uc: 'sac de 35 kg' }],
      note: 'Environ 10 blocs par m² (bloc de 50 × 20 cm). Chaînages et linteaux à métrer à part.' },
    { id: 'parpaing15', nom: 'Mur en blocs béton creux de 15 cm (50 × 20)', famille: 'maconnerie', unite: 'm2', forme: 'mur', perte: 5,
      composants: [{ nom: 'Bloc béton creux 15 × 20 × 50 cm', ratio: 10, unite: 'u', cond: 80, uc: 'palette de 80 blocs' }, { nom: 'Mortier de montage', ratio: 15, unite: 'kg', cond: 35, uc: 'sac de 35 kg' }] },
    { id: 'brique', nom: 'Mur en briques creuses à joint mince (50 × 30)', famille: 'maconnerie', unite: 'm2', forme: 'mur', perte: 5,
      composants: [{ nom: 'Brique creuse 50 × 30 cm', ratio: 6.7, unite: 'u', cond: 60, uc: 'palette de 60 briques' }, { nom: 'Mortier-colle pour joint mince', ratio: 4, unite: 'kg', cond: 25, uc: 'sac de 25 kg' }] },
    { id: 'enduit-facade', nom: 'Enduit de façade monocouche', famille: 'maconnerie', unite: 'm2', forme: 'mur', perte: 10,
      composants: [{ nom: 'Enduit monocouche (indicatif 18 kg/m² pour 15 mm)', ratio: 18, unite: 'kg', cond: 25, uc: 'sac de 25 kg' }] },
    { id: 'linteau', nom: 'Linteau préfabriqué', famille: 'maconnerie', unite: 'u', forme: 'unite', perte: 0, composants: [] },

    // Charpente et couverture
    { id: 'tuiles', nom: 'Couverture en tuiles à emboîtement', famille: 'charpente', unite: 'm2', forme: 'rect', perte: 5,
      composants: [{ nom: 'Tuile à emboîtement (indicatif 13 u/m²)', ratio: 13, unite: 'u', cond: null, uc: 'u' }, { nom: 'Liteau (pureau indicatif 33 cm)', ratio: 3, unite: 'm', cond: 4, uc: 'liteau de 4 m' }, { nom: 'Écran sous toiture', ratio: 1.1, unite: 'm2', cond: 75, uc: 'rouleau de 75 m²' }],
      note: 'Mesurer la surface en rampant (selon la pente), pas la surface au sol.' },
    { id: 'gouttiere', nom: 'Gouttière', famille: 'charpente', unite: 'm', forme: 'lineaire', perte: 5,
      composants: [{ nom: 'Gouttière', ratio: 1, unite: 'm', cond: 4, uc: 'longueur de 4 m' }, { nom: 'Crochet de gouttière (1 tous les 50 cm)', ratio: 2, unite: 'u', cond: null, uc: 'u' }] },
    { id: 'descente', nom: 'Descente d\'eaux pluviales', famille: 'charpente', unite: 'm', forme: 'lineaire', perte: 5,
      composants: [{ nom: 'Tube de descente', ratio: 1, unite: 'm', cond: 3, uc: 'longueur de 3 m' }, { nom: 'Collier de fixation (1 par mètre)', ratio: 1, unite: 'u', cond: null, uc: 'u' }] },

    // Isolation
    { id: 'iso-combles', nom: 'Isolation de combles perdus en rouleaux', famille: 'isolation', unite: 'm2', forme: 'rect', perte: 5,
      composants: [{ nom: 'Rouleau d\'isolant (surface par rouleau à vérifier)', ratio: 1, unite: 'm2', cond: 4.8, uc: 'rouleau de 4,80 m²' }] },
    { id: 'iso-murs', nom: 'Isolation de murs par l\'intérieur (panneaux)', famille: 'isolation', unite: 'm2', forme: 'mur', perte: 7,
      composants: [{ nom: 'Panneau isolant', ratio: 1, unite: 'm2', cond: 3.6, uc: 'paquet de 3,60 m²' }] },

    // Plâtrerie et cloisons
    { id: 'cloison72', nom: 'Cloison en plaques de plâtre sur ossature 72/48', famille: 'platrerie', unite: 'm2', forme: 'mur', perte: 8,
      composants: [
        { nom: 'Plaque de plâtre 1,20 × 2,50 m (2 faces)', ratio: 2, unite: 'm2', cond: 3, uc: 'plaque de 3 m²' },
        { nom: 'Montant de 48 (entraxe 60 cm)', ratio: 1.8, unite: 'm', cond: 3, uc: 'montant de 3 m' },
        { nom: 'Rail de 48 (haut et bas, hauteur 2,50 m)', ratio: 0.8, unite: 'm', cond: 3, uc: 'rail de 3 m' },
        { nom: 'Isolant acoustique 45 mm', ratio: 1, unite: 'm2', cond: 7.2, uc: 'rouleau de 7,20 m²' },
        { nom: 'Vis à plaque', ratio: 30, unite: 'u', cond: 1000, uc: 'boîte de 1 000' },
        { nom: 'Bande à joint', ratio: 3, unite: 'm', cond: 150, uc: 'rouleau de 150 m' },
        { nom: 'Enduit à joint', ratio: 0.6, unite: 'kg', cond: 25, uc: 'sac de 25 kg' }],
      note: 'Ratios d\'ossature calculés pour une hauteur de 2,50 m ; à ajuster pour d\'autres hauteurs.' },
    { id: 'doublage', nom: 'Doublage collé en plaques de plâtre', famille: 'platrerie', unite: 'm2', forme: 'mur', perte: 8,
      composants: [{ nom: 'Plaque de plâtre 1,20 × 2,50 m', ratio: 1, unite: 'm2', cond: 3, uc: 'plaque de 3 m²' }, { nom: 'Mortier adhésif', ratio: 4, unite: 'kg', cond: 25, uc: 'sac de 25 kg' }, { nom: 'Bande à joint', ratio: 1.5, unite: 'm', cond: 150, uc: 'rouleau de 150 m' }, { nom: 'Enduit à joint', ratio: 0.3, unite: 'kg', cond: 25, uc: 'sac de 25 kg' }] },
    { id: 'plafond', nom: 'Plafond en plaques de plâtre sur fourrures', famille: 'platrerie', unite: 'm2', forme: 'rect', perte: 8,
      composants: [{ nom: 'Plaque de plâtre 1,20 × 2,50 m', ratio: 1, unite: 'm2', cond: 3, uc: 'plaque de 3 m²' }, { nom: 'Fourrure (entraxe 50 cm)', ratio: 2, unite: 'm', cond: 3, uc: 'fourrure de 3 m' }, { nom: 'Suspente', ratio: 1.6, unite: 'u', cond: 100, uc: 'boîte de 100' }, { nom: 'Vis à plaque', ratio: 20, unite: 'u', cond: 1000, uc: 'boîte de 1 000' }] },

    // Menuiseries
    { id: 'fenetre', nom: 'Fenêtre (fourniture et pose)', famille: 'menuiseries', unite: 'u', forme: 'unite', perte: 0, composants: [] },
    { id: 'porte-int', nom: 'Bloc-porte intérieur', famille: 'menuiseries', unite: 'u', forme: 'unite', perte: 0, composants: [] },
    { id: 'porte-ext', nom: 'Porte d\'entrée', famille: 'menuiseries', unite: 'u', forme: 'unite', perte: 0, composants: [] },

    // Revêtements de sols
    { id: 'carrelage-sol', nom: 'Carrelage de sol collé (pose droite)', famille: 'sols', unite: 'm2', forme: 'rect', perte: 10,
      composants: [{ nom: 'Carreaux (surface par boîte à vérifier)', ratio: 1, unite: 'm2', cond: 1.44, uc: 'boîte de 1,44 m²' }, { nom: 'Mortier-colle (simple encollage, indicatif 5 kg/m²)', ratio: 5, unite: 'kg', cond: 25, uc: 'sac de 25 kg' }, { nom: 'Mortier de joint', ratio: 0.5, unite: 'kg', cond: 5, uc: 'sac de 5 kg' }],
      note: 'Pose en diagonale ou grands formats : compter plutôt 12 à 15 % de perte.' },
    { id: 'parquet', nom: 'Parquet flottant', famille: 'sols', unite: 'm2', forme: 'rect', perte: 7,
      composants: [{ nom: 'Lames de parquet (surface par paquet à vérifier)', ratio: 1, unite: 'm2', cond: 2.2, uc: 'paquet de 2,20 m²' }, { nom: 'Sous-couche', ratio: 1, unite: 'm2', cond: 15, uc: 'rouleau de 15 m²' }] },
    { id: 'sol-souple', nom: 'Revêtement de sol souple en lés', famille: 'sols', unite: 'm2', forme: 'rect', perte: 10,
      composants: [{ nom: 'Revêtement en lés', ratio: 1, unite: 'm2', cond: null, uc: 'm²' }, { nom: 'Colle (indicatif 0,3 kg/m²)', ratio: 0.3, unite: 'kg', cond: 6, uc: 'seau de 6 kg' }] },
    { id: 'ragreage', nom: 'Ragréage de sol (3 mm)', famille: 'sols', unite: 'm2', forme: 'rect', perte: 5,
      composants: [{ nom: 'Enduit de ragréage (indicatif 1,6 kg/m² par mm)', ratio: 4.8, unite: 'kg', cond: 25, uc: 'sac de 25 kg' }] },
    { id: 'plinthes', nom: 'Plinthes', famille: 'sols', unite: 'm', forme: 'perimetre', perte: 5,
      composants: [{ nom: 'Plinthe', ratio: 1, unite: 'm', cond: 2.4, uc: 'longueur de 2,40 m' }],
      note: 'Déduis la largeur des portes : ajoute une déduction en longueur sur la ligne.' },

    // Revêtements muraux et peinture
    { id: 'peinture-murs', nom: 'Peinture de murs (impression + 2 couches)', famille: 'murs', unite: 'm2', forme: 'mur', perte: 0,
      composants: [{ nom: 'Sous-couche d\'impression (indicatif 10 m²/L)', ratio: 0.1, unite: 'l', cond: 10, uc: 'pot de 10 L' }, { nom: 'Peinture de finition (indicatif 10 m²/L par couche, 2 couches)', ratio: 0.2, unite: 'l', cond: 10, uc: 'pot de 10 L' }],
      note: 'Rendement réel selon le support et la peinture : lis l\'étiquette du produit.' },
    { id: 'peinture-plafond', nom: 'Peinture de plafond (impression + 2 couches)', famille: 'murs', unite: 'm2', forme: 'rect', perte: 0,
      composants: [{ nom: 'Sous-couche d\'impression (indicatif 10 m²/L)', ratio: 0.1, unite: 'l', cond: 10, uc: 'pot de 10 L' }, { nom: 'Peinture de plafond (indicatif 10 m²/L par couche, 2 couches)', ratio: 0.2, unite: 'l', cond: 10, uc: 'pot de 10 L' }] },
    { id: 'enduit-lissage', nom: 'Enduit de lissage', famille: 'murs', unite: 'm2', forme: 'mur', perte: 5,
      composants: [{ nom: 'Enduit de lissage (indicatif 1 kg/m²)', ratio: 1, unite: 'kg', cond: 25, uc: 'sac de 25 kg' }] },
    { id: 'faience', nom: 'Faïence murale collée', famille: 'murs', unite: 'm2', forme: 'mur', perte: 10,
      composants: [{ nom: 'Carreaux de faïence (surface par boîte à vérifier)', ratio: 1, unite: 'm2', cond: 1.2, uc: 'boîte de 1,20 m²' }, { nom: 'Colle (indicatif 3 kg/m²)', ratio: 3, unite: 'kg', cond: 15, uc: 'seau de 15 kg' }, { nom: 'Mortier de joint', ratio: 0.4, unite: 'kg', cond: 5, uc: 'sac de 5 kg' }] },
    { id: 'papier-peint', nom: 'Papier peint', famille: 'murs', unite: 'm2', forme: 'mur', perte: 15,
      composants: [{ nom: 'Rouleau de 0,53 × 10,05 m', ratio: 1, unite: 'm2', cond: 5.33, uc: 'rouleau de 5,33 m²' }, { nom: 'Colle (indicatif 1 paquet pour 25 m²)', ratio: 0.04, unite: 'u', cond: 1, uc: 'paquet' }],
      note: 'Perte élevée pour le raccord des motifs ; à augmenter pour un grand raccord.' },

    // Plomberie
    { id: 'per', nom: 'Alimentation en tube PER gainé', famille: 'plomberie', unite: 'm', forme: 'lineaire', perte: 10,
      composants: [{ nom: 'Tube PER gainé', ratio: 1, unite: 'm', cond: 25, uc: 'couronne de 25 m' }] },
    { id: 'evacuation', nom: 'Évacuation en tube PVC', famille: 'plomberie', unite: 'm', forme: 'lineaire', perte: 10,
      composants: [{ nom: 'Tube PVC d\'évacuation', ratio: 1, unite: 'm', cond: 2, uc: 'longueur de 2 m' }] },
    { id: 'sanitaire', nom: 'Appareil sanitaire (fourniture et pose)', famille: 'plomberie', unite: 'u', forme: 'unite', perte: 0, composants: [] },

    // Électricité
    { id: 'prise', nom: 'Prise de courant', famille: 'electricite', unite: 'u', forme: 'unite', perte: 0,
      composants: [{ nom: 'Boîte d\'encastrement', ratio: 1, unite: 'u', cond: null, uc: 'u' }, { nom: 'Mécanisme de prise', ratio: 1, unite: 'u', cond: null, uc: 'u' }] },
    { id: 'point-lumineux', nom: 'Point lumineux', famille: 'electricite', unite: 'u', forme: 'unite', perte: 0,
      composants: [{ nom: 'Boîte de point de centre', ratio: 1, unite: 'u', cond: null, uc: 'u' }, { nom: 'Interrupteur', ratio: 1, unite: 'u', cond: null, uc: 'u' }] },
    { id: 'cable', nom: 'Circuit en conducteurs sous gaine', famille: 'electricite', unite: 'm', forme: 'lineaire', perte: 10,
      composants: [{ nom: 'Gaine préfilée', ratio: 1, unite: 'm', cond: 100, uc: 'couronne de 100 m' }] },

    // Aménagements extérieurs
    { id: 'paves', nom: 'Pavés sur lit de sable', famille: 'exterieur', unite: 'm2', forme: 'rect', perte: 5,
      composants: [{ nom: 'Pavés', ratio: 1, unite: 'm2', cond: 10, uc: 'palette de 10 m²' }, { nom: 'Sable de pose (4 cm)', ratio: 0.04, unite: 'm3', cond: null, uc: 'm³' }] },
    { id: 'bordure', nom: 'Bordure de jardin', famille: 'exterieur', unite: 'm', forme: 'lineaire', perte: 5,
      composants: [{ nom: 'Bordure de 1 m', ratio: 1, unite: 'u', cond: null, uc: 'u' }, { nom: 'Béton de calage (indicatif 0,03 m³/m)', ratio: 0.03, unite: 'm3', cond: null, uc: 'm³' }] },
    { id: 'cloture', nom: 'Clôture en grillage rigide', famille: 'exterieur', unite: 'm', forme: 'lineaire', perte: 0,
      composants: [{ nom: 'Panneau rigide de 2,50 m', ratio: 0.4, unite: 'u', cond: null, uc: 'u' }, { nom: 'Poteau (1 par panneau, + 1 en extrémité)', ratio: 0.4, unite: 'u', cond: null, uc: 'u' }],
      note: 'Ajoute un poteau par extrémité ou angle (ligne « Nombre d\'unités »).' },
    { id: 'terre-vegetale', nom: 'Apport de terre végétale', famille: 'exterieur', unite: 'm3', forme: 'volume', perte: 10,
      composants: [{ nom: 'Terre végétale', ratio: 1, unite: 'm3', cond: 1, uc: 'm³' }] },

    // Divers
    { id: 'protection', nom: 'Protection des sols pendant les travaux', famille: 'divers', unite: 'm2', forme: 'rect', perte: 10,
      composants: [{ nom: 'Bâche ou carton de protection', ratio: 1, unite: 'm2', cond: 25, uc: 'rouleau de 25 m²' }] },
    { id: 'libre-u', nom: 'Ouvrage libre à l\'unité', famille: 'divers', unite: 'u', forme: 'unite', perte: 0, composants: [] },
    { id: 'libre-m2', nom: 'Ouvrage libre au m²', famille: 'divers', unite: 'm2', forme: 'rect', perte: 0, composants: [] },
  ],

  conseils: [
    ['Une ligne, une mesure', 'Chaque ligne garde ses dimensions, ses déductions et sa formule développée : le résultat se vérifie toujours.'],
    ['Pertes séparées', 'La quantité théorique ne contient aucune perte. Les pertes s\'ajoutent ensuite, ligne par ligne, avec un taux modifiable.'],
    ['Variantes', 'Une ligne vaut pour toutes les variantes, ou pour certaines seulement : compare deux solutions sans tout ressaisir.'],
    ['Commande', 'Les composants sont arrondis au conditionnement supérieur (sac, boîte, palette) pour donner la quantité à commander.'],
  ],
};
