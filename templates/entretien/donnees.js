// Base intégrée de l'entretien de la maison : zones, équipements, tâches types et sources réglementaires.
// Contenu original rédigé pour QME. Fréquences indicatives (bonnes pratiques courantes, notices usuelles),
// toutes modifiables par l'utilisateur. Les fréquences d'origine réglementaire renvoient à BASE.regles,
// avec leur source et la date de vérification : à revoir chaque année (donnée datée).
// Fréquence en mois ; saison = mois conseillés (1 = janvier … 12 = décembre), vide = toute l'année.
// qui (répartition indicative pour un logement loué) : 'locataire', 'proprietaire' ou 'selon'.
(() => {
  // t(titre, fréquence en mois, saison, qui, règle, conseil)
  const t = (titre, frequence, saison = [], qui = 'locataire', regle = null, conseil = '') => ({ titre, frequence, saison, qui, regle, conseil });
  const HIVER = [10, 11, 12, 1, 2, 3, 4];
  const ETE = [5, 6, 7, 8, 9];

  window.BASE = {
    verifieLe: '2026-11-13',

    // Zones de la maison, dans l'ordre d'affichage ; une couleur fixe chacune (identité, toujours avec le nom).
    zones: [
      { id: 'chauffage', nom: 'Chauffage et climatisation', couleur: '#B84A34' },
      { id: 'eau', nom: 'Eau et assainissement', couleur: '#2F67A8' },
      { id: 'air', nom: 'Air et ventilation', couleur: '#5B8DB8' },
      { id: 'cuisine', nom: 'Cuisine', couleur: '#C9962A' },
      { id: 'buanderie', nom: 'Buanderie', couleur: '#7A3E6B' },
      { id: 'securite', nom: 'Sécurité et électricité', couleur: '#24221F' },
      { id: 'interieur', nom: 'Intérieur', couleur: '#8A7A5C' },
      { id: 'exterieur', nom: 'Toiture et extérieur', couleur: '#2E7D4F' },
      { id: 'jardin', nom: 'Jardin et piscine', couleur: '#5E8C3A' },
    ],

    // Sources réglementaires citées. « verifie » : relu sur la source officielle à la date de verifieLe ;
    // false : non vérifié, affiché « à vérifier ». Jamais présenté comme certain : tout reste modifiable.
    regles: {
      chaudiere: {
        titre: 'Entretien annuel des chaudières (4 à 400 kW)',
        texte: 'Chaudières gaz, fioul, bois ou charbon : un entretien par année civile, par un professionnel qualifié, qui remet une attestation. En location, il est à la charge du locataire, sauf clause contraire du bail.',
        source: 'Code de l\'environnement, art. R224-41-4 à R224-41-9 ; arrêté du 15 septembre 2009 ; loi n° 89-462 du 6 juillet 1989, art. 7 ; fiche service-public.gouv.fr F20760.',
        frequence: 12, verifie: true,
      },
      ramonage: {
        titre: 'Ramonage des conduits de fumée',
        texte: 'Logement individuel : au moins une fois tous les 12 mois. Un arrêté ou le règlement sanitaire de votre département peut en demander davantage, souvent deux fois par an pour le bois, dont une pendant la période de chauffe. Garde le certificat de ramonage (souvent demandé par l\'assureur).',
        source: 'Code de la santé publique, dispositions issues du décret n° 2023-641 du 20 juillet 2023 (en vigueur le 1er octobre 2023) ; règlement sanitaire départemental et arrêtés locaux.',
        frequence: 12, verifie: true,
      },
      combustion: {
        titre: 'Entretien des appareils à combustion',
        texte: 'Poêles, inserts et autres appareils à combustion : entretien au moins tous les 12 mois par un professionnel, et avant une remise en service après un an sans utilisation.',
        source: 'Code de la santé publique, dispositions issues du décret n° 2023-641 du 20 juillet 2023.',
        frequence: 12, verifie: true,
      },
      thermodynamique: {
        titre: 'Entretien des pompes à chaleur et climatisations (4 à 70 kW)',
        texte: 'Au plus deux ans entre deux entretiens, par un professionnel, avec attestation. Les chauffe-eau thermodynamiques qui ne servent qu\'à l\'eau chaude d\'un seul logement ne sont pas concernés. Sous 4 kW (petits climatiseurs mobiles), pas d\'obligation : suis la notice.',
        source: 'Code de l\'environnement, art. R224-44 à R224-44-5 (décret n° 2020-912 du 28 juillet 2020) ; arrêté du 24 juillet 2020.',
        frequence: 24, verifie: true,
      },
      detecteur: {
        titre: 'Détecteur de fumée',
        texte: 'Le propriétaire installe le détecteur ; l\'occupant l\'entretient et le remplace si besoin, sauf exceptions (meublé, location saisonnière, logement de fonction…). Le texte ne fixe pas de fréquence de test : suis la notice de l\'appareil.',
        source: 'Code de la construction et de l\'habitation, art. R142-1 à R142-5 (loi n° 2010-238 du 9 mars 2010).',
        frequence: null, verifie: true,
      },
      vidange: {
        titre: 'Vidange d\'une installation d\'assainissement non collectif',
        texte: 'La vidange se fait selon le remplissage (en pratique quand les boues atteignent environ la moitié du volume utile), par une entreprise agréée. La fréquence proposée ici n\'est qu\'un ordre de grandeur.',
        source: 'Arrêté du 7 septembre 2009 modifié (prescriptions techniques de l\'assainissement non collectif). Non revérifié : à vérifier.',
        frequence: null, verifie: false,
      },
      spanc: {
        titre: 'Contrôle par le SPANC',
        texte: 'Le service public d\'assainissement non collectif de ta commune contrôle l\'installation selon une périodicité qu\'il fixe (dix ans au plus d\'après les textes, souvent moins).',
        source: 'Code général des collectivités territoriales, art. L2224-8. Non revérifié : à vérifier auprès de ta commune.',
        frequence: null, verifie: false,
      },
      debroussaillement: {
        titre: 'Obligation légale de débroussaillement',
        texte: 'Seulement dans les zones exposées au risque d\'incendie de forêt définies par arrêté préfectoral : périmètre, période et profondeur dépendent de ton département.',
        source: 'Code forestier (obligations légales de débroussaillement) et arrêté préfectoral. Non revérifié : à vérifier en mairie.',
        frequence: null, verifie: false,
      },
    },

    // Répartition indicative en location (logement vide), d'après la liste des réparations locatives.
    sourceLocatif: 'Répartition indicative, d\'après le décret n° 87-712 du 26 août 1987 (réparations locatives). Ton bail et l\'état de l\'équipement priment.',

    // Équipements : zone, maison seulement, coché par défaut (maison / appartement), tâches types.
    equipements: [
      { id: 'chaudiere-gaz', nom: 'Chaudière gaz', zone: 'chauffage', defaut: [], taches: [
        t('Entretien annuel de la chaudière', 12, [8, 9, 10], 'locataire', 'chaudiere', 'Avant la saison de chauffe : les professionnels sont plus disponibles en fin d\'été.'),
        t('Vérifier la pression du circuit de chauffage', 3, [], 'locataire', null, 'Lis le manomètre à froid et compare à la plage indiquée dans la notice.'),
      ] },
      { id: 'chaudiere-fioul', nom: 'Chaudière fioul', zone: 'chauffage', maison: true, taches: [
        t('Entretien annuel de la chaudière', 12, [6, 7, 8, 9], 'locataire', 'chaudiere'),
        t('Ramonage du conduit de la chaudière', 12, [8, 9, 10], 'locataire', 'ramonage'),
        t('Relever le niveau de la cuve', 3, [], 'locataire', null, 'Commande avant l\'hiver si le niveau est bas.'),
      ] },
      { id: 'chaudiere-bois', nom: 'Chaudière bois ou granulés', zone: 'chauffage', maison: true, taches: [
        t('Entretien annuel de la chaudière', 12, [6, 7, 8, 9], 'locataire', 'chaudiere'),
        t('Ramonage du conduit de la chaudière', 12, [8, 9, 10], 'locataire', 'ramonage'),
        t('Vider le bac à cendres', 1, HIVER, 'locataire', null, 'Cendres refroidies, dans un seau métallique.'),
      ] },
      { id: 'poele', nom: 'Poêle à bois ou à granulés', zone: 'chauffage', taches: [
        t('Ramonage du conduit du poêle', 12, [8, 9, 10], 'locataire', 'ramonage'),
        t('Entretien du poêle par un professionnel', 12, [8, 9, 10], 'locataire', 'combustion'),
        t('Nettoyer la vitre, le creuset et le cendrier', 1, HIVER, 'locataire'),
        t('Vérifier les joints de porte et de vitre', 12, [9, 10], 'locataire'),
      ] },
      { id: 'cheminee', nom: 'Cheminée ou insert', zone: 'chauffage', maison: true, taches: [
        t('Ramonage de la cheminée', 12, [8, 9, 10], 'locataire', 'ramonage'),
        t('Entretien de l\'insert par un professionnel', 12, [8, 9, 10], 'locataire', 'combustion'),
        t('Vérifier la trappe de fermeture et l\'arrivée d\'air', 12, [9, 10], 'locataire'),
      ] },
      { id: 'pac', nom: 'Pompe à chaleur (chauffage)', zone: 'chauffage', taches: [
        t('Entretien de la pompe à chaleur par un professionnel', 24, [5, 6, 7, 8, 9], 'locataire', 'thermodynamique'),
        t('Dégager et nettoyer l\'unité extérieure', 6, [4, 10], 'locataire', null, 'Feuilles, neige et herbes hautes gênent l\'échange d\'air.'),
        t('Vérifier la pression du circuit d\'eau', 6, [], 'locataire'),
      ] },
      { id: 'radiateurs', nom: 'Radiateurs à eau chaude', zone: 'chauffage', taches: [
        t('Purger les radiateurs', 12, [9, 10], 'locataire', null, 'Chauffage coupé, en commençant par le radiateur le plus proche de la chaudière.'),
        t('Dépoussiérer les radiateurs', 6, [], 'locataire'),
      ] },
      { id: 'clim', nom: 'Climatisation', zone: 'chauffage', taches: [
        t('Entretien de la climatisation par un professionnel', 24, [3, 4, 5], 'locataire', 'thermodynamique'),
        t('Nettoyer les filtres des unités intérieures', 3, [], 'locataire', null, 'Plus souvent en période d\'usage intensif.'),
        t('Dégager l\'unité extérieure', 12, [4, 5], 'locataire'),
      ] },

      { id: 'robinetterie', nom: 'Robinetterie et canalisations', zone: 'eau', defaut: ['maison', 'appartement'], taches: [
        t('Détartrer mousseurs et pommeau de douche', 3, [], 'locataire'),
        t('Rechercher une fuite (compteur relevé avant et après la nuit)', 6, [], 'locataire', null, 'Si l\'index bouge alors que rien ne coule, il y a une fuite.'),
        t('Manœuvrer le robinet d\'arrêt général', 12, [], 'locataire', null, 'Un robinet jamais manœuvré finit par se bloquer.'),
        t('Nettoyer les siphons (évier, lavabos, douche)', 6, [], 'locataire'),
      ] },
      { id: 'chauffe-eau', nom: 'Chauffe-eau électrique (ballon)', zone: 'eau', defaut: ['maison', 'appartement'], taches: [
        t('Actionner le groupe de sécurité', 1, [], 'locataire', null, 'Quelques secondes : l\'eau doit s\'écouler franchement (voir la notice).'),
        t('Détartrage et contrôle de l\'anode', 36, [], 'selon', null, 'Plus souvent si l\'eau est très calcaire.'),
      ] },
      { id: 'chauffe-eau-thermo', nom: 'Chauffe-eau thermodynamique', zone: 'eau', taches: [
        t('Nettoyer le filtre à air', 6, [], 'locataire'),
        t('Actionner le groupe de sécurité', 1, [], 'locataire'),
        t('Contrôle par un professionnel', 24, [], 'selon', null, 'Non soumis à l\'entretien obligatoire des pompes à chaleur s\'il ne sert qu\'à l\'eau chaude du logement : suis la notice.'),
      ] },
      { id: 'adoucisseur', nom: 'Adoucisseur d\'eau', zone: 'eau', taches: [
        t('Recharger le bac à sel', 1, [], 'locataire'),
        t('Désinfection de la résine et révision', 12, [], 'locataire'),
      ] },
      { id: 'assainissement', nom: 'Fosse ou micro-station (assainissement individuel)', zone: 'eau', maison: true, taches: [
        t('Vidange de la fosse', 48, [4, 5, 6, 7, 8, 9], 'locataire', 'vidange'),
        t('Nettoyer le préfiltre et le bac dégraisseur', 6, [], 'locataire'),
        t('Contrôle de l\'installation par le SPANC', 120, [], 'proprietaire', 'spanc'),
      ] },
      { id: 'recuperateur', nom: 'Récupérateur d\'eau de pluie', zone: 'eau', maison: true, taches: [
        t('Nettoyer le filtre et la cuve', 12, [3, 4], 'locataire'),
        t('Vidanger avant le gel', 12, [11], 'locataire'),
      ] },

      { id: 'vmc', nom: 'VMC (ventilation mécanique)', zone: 'air', defaut: ['maison', 'appartement'], taches: [
        t('Nettoyer les bouches d\'extraction', 3, [], 'locataire', null, 'Eau savonneuse, sans dérégler l\'ouverture des bouches.'),
        t('Nettoyer ou changer les filtres (double flux)', 6, [], 'locataire'),
        t('Vérification du caisson et des gaines', 36, [], 'selon'),
      ] },
      { id: 'entrees-air', nom: 'Entrées d\'air des fenêtres', zone: 'air', defaut: ['maison', 'appartement'], taches: [
        t('Dépoussiérer les entrées d\'air', 6, [], 'locataire', null, 'Ne jamais les boucher, même en hiver.'),
      ] },
      { id: 'hotte', nom: 'Hotte de cuisine', zone: 'cuisine', defaut: ['maison', 'appartement'], taches: [
        t('Nettoyer le filtre à graisse', 2, [], 'locataire'),
        t('Changer le filtre à charbon (hotte à recyclage)', 6, [], 'locataire'),
      ] },
      { id: 'frigo', nom: 'Réfrigérateur et congélateur', zone: 'cuisine', defaut: ['maison', 'appartement'], taches: [
        t('Dégivrer et nettoyer le congélateur', 6, [], 'locataire', null, 'Au-delà de quelques millimètres de givre, la consommation augmente.'),
        t('Dépoussiérer la grille arrière', 12, [], 'locataire'),
        t('Nettoyer les joints de porte', 3, [], 'locataire'),
      ] },
      { id: 'lave-vaisselle', nom: 'Lave-vaisselle', zone: 'cuisine', defaut: ['maison', 'appartement'], taches: [
        t('Nettoyer le filtre du lave-vaisselle', 1, [], 'locataire'),
        t('Vérifier le sel régénérant et le liquide de rinçage', 1, [], 'locataire'),
        t('Cycle d\'entretien à vide et bras de lavage', 3, [], 'locataire'),
      ] },
      { id: 'four', nom: 'Four et plaques', zone: 'cuisine', defaut: ['maison', 'appartement'], taches: [
        t('Nettoyer le four', 3, [], 'locataire'),
      ] },
      { id: 'gaz-cuisson', nom: 'Cuisson au gaz', zone: 'cuisine', taches: [
        t('Vérifier la date limite du tuyau ou flexible de gaz', 12, [], 'locataire', null, 'La date est imprimée sur le tuyau : à remplacer avant.'),
      ] },
      { id: 'lave-linge', nom: 'Lave-linge', zone: 'buanderie', defaut: ['maison', 'appartement'], taches: [
        t('Nettoyer le filtre de vidange', 3, [], 'locataire'),
        t('Nettoyer le joint de hublot et le bac à produits', 1, [], 'locataire'),
        t('Cycle à vide à haute température', 3, [], 'locataire'),
      ] },
      { id: 'seche-linge', nom: 'Sèche-linge', zone: 'buanderie', taches: [
        t('Nettoyer le condenseur ou l\'échangeur', 1, [], 'locataire', null, 'Le filtre à peluches, lui, se vide à chaque cycle.'),
        t('Nettoyer la gaine d\'évacuation', 12, [], 'locataire'),
      ] },

      { id: 'detecteur', nom: 'Détecteur de fumée', zone: 'securite', defaut: ['maison', 'appartement'], taches: [
        t('Tester le détecteur de fumée', 1, [], 'locataire', 'detecteur', 'Bouton test, puis dépoussiérage.'),
        t('Remplacer la pile ou le détecteur', 120, [], 'locataire', 'detecteur', 'Selon le modèle : pile remplaçable ou détecteur à remplacer en entier à la date indiquée.'),
      ] },
      { id: 'detecteur-co', nom: 'Détecteur de monoxyde de carbone', zone: 'securite', taches: [
        t('Tester le détecteur de monoxyde de carbone', 1, [], 'locataire'),
        t('Remplacer le détecteur de monoxyde de carbone', 84, [], 'locataire', null, 'Durée de vie indiquée sur l\'appareil.'),
      ] },
      { id: 'extincteur', nom: 'Extincteur', zone: 'securite', taches: [
        t('Vérifier le manomètre et la date de l\'extincteur', 12, [], 'selon'),
      ] },
      { id: 'tableau', nom: 'Tableau électrique', zone: 'securite', defaut: ['maison', 'appartement'], taches: [
        t('Tester les interrupteurs différentiels (bouton test)', 6, [], 'locataire'),
        t('Repérer prises abîmées et fils apparents', 12, [], 'selon'),
      ] },

      { id: 'logement', nom: 'Logement (joints, serrures, fenêtres)', zone: 'interieur', defaut: ['maison', 'appartement'], taches: [
        t('Refaire les joints silicone noircis ou décollés', 24, [], 'locataire'),
        t('Graisser serrures, gonds et paumelles', 12, [], 'locataire'),
        t('Vérifier les joints de fenêtres', 12, [9, 10], 'locataire'),
        t('Rechercher traces d\'humidité et moisissures', 6, [11, 3], 'selon'),
      ] },
      { id: 'volets', nom: 'Volets roulants', zone: 'interieur', taches: [
        t('Nettoyer les lames et tester les volets', 12, [3, 4], 'locataire'),
      ] },
      { id: 'toiture', nom: 'Toiture et gouttières', zone: 'exterieur', maison: true, defaut: ['maison'], taches: [
        t('Nettoyer les gouttières et descentes', 12, [11, 12], 'locataire', null, 'Après la chute des feuilles.'),
        t('Inspecter la toiture (tuiles, faîtage, solins)', 12, [3, 4], 'proprietaire'),
        t('Démousser la toiture', 60, [4, 5, 9], 'proprietaire'),
        t('Vérifier les regards d\'eaux pluviales', 12, [10, 11], 'locataire'),
      ] },
      { id: 'facade', nom: 'Façade et terrasse', zone: 'exterieur', maison: true, defaut: ['maison'], taches: [
        t('Inspecter la façade (fissures, enduit)', 12, [4, 5], 'proprietaire'),
        t('Nettoyer la terrasse et enlever la mousse', 12, [4, 5], 'locataire'),
        t('Lasurer ou peindre les bois extérieurs', 36, [5, 6, 9], 'selon'),
      ] },
      { id: 'portail', nom: 'Portail ou porte de garage motorisés', zone: 'exterieur', maison: true, taches: [
        t('Graisser et vérifier la motorisation', 12, [4, 5], 'selon'),
      ] },
      { id: 'robinets-ext', nom: 'Robinets extérieurs et arrosage', zone: 'jardin', maison: true, taches: [
        t('Purger les robinets extérieurs avant le gel', 12, [11], 'locataire'),
        t('Remettre en eau et vérifier l\'arrosage', 12, [4], 'locataire'),
      ] },
      { id: 'jardin', nom: 'Jardin', zone: 'jardin', maison: true, defaut: ['maison'], taches: [
        t('Tailler les haies', 6, [3, 9], 'locataire'),
        t('Scarifier et aérer la pelouse', 12, [3, 4], 'locataire'),
        t('Entretenir la tondeuse (lame, huile, filtre)', 12, [2, 3], 'locataire'),
        t('Ranger le jardin pour l\'hiver', 12, [10, 11], 'locataire'),
      ] },
      { id: 'arbres', nom: 'Arbres', zone: 'jardin', maison: true, taches: [
        t('Élaguer les arbres', 36, [11, 12, 1, 2], 'selon', null, 'Grands arbres et abattage : souvent à la charge du propriétaire.'),
      ] },
      { id: 'debroussaillement', nom: 'Terrain en zone de débroussaillement obligatoire', zone: 'jardin', maison: true, taches: [
        t('Débroussailler autour de la maison', 12, [3, 4, 5], 'selon', 'debroussaillement'),
      ] },
      { id: 'piscine', nom: 'Piscine', zone: 'jardin', maison: true, taches: [
        t('Remise en service de la piscine', 12, [4, 5], 'selon'),
        t('Nettoyer le filtre de la piscine', 1, ETE, 'selon'),
        t('Hivernage de la piscine', 12, [10], 'selon'),
      ] },
    ],

    conseils: [
      ['Commence par les obligations', 'Chaudière, ramonage, pompe à chaleur : ce sont les tâches que l\'assureur ou le bailleur peuvent te demander de prouver. Garde les attestations.'],
      ['Regroupe les passages', 'Ramonage et entretien du poêle, ou chaudière et purge des radiateurs : un seul rendez-vous en fin d\'été.'],
      ['Note le coût et l\'intervenant', 'L\'historique sert l\'année suivante pour comparer, et pour une vente ou un état des lieux.'],
      ['Adapte les fréquences', 'Eau calcaire, animaux, grande famille : raccourcis ; résidence secondaire : allonge. Chaque fréquence est modifiable.'],
    ],
  };
})();
