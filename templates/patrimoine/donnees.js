// Base intégrée de l'inventaire valorisé : catégories, sous-catégories, exemples d'objets, états,
// fréquences d'utilisation, familles de décote et règles de valorisation. Aucune logique ici.
// AUCUN PRIX DE MARCHÉ : les exemples d'objets n'ont pas de prix ; les coefficients de décote sont des
// HYPOTHÈSES INDICATIVES QME (ordres de grandeur de dépréciation par famille), recopiées dans les réglages
// de l'utilisateur, qui peut toutes les modifier. Ce ne sont ni des cotes, ni des barèmes d'assurance.
window.BASE = {
  version: '2026-11-13',

  // Familles de valorisation. an1 : perte la première année (% du prix d'achat) ; annuel : perte par an
  // ensuite (% de la valeur restante) ; plancher : valeur minimale conservée (% du prix d'achat) ;
  // revente : écart entre valeur actuelle estimée et prix de revente rapide entre particuliers (%) ;
  // liquidite : facilité de revente (forte, moyenne, faible).
  familles: [
    { id: 'electronique', nom: 'Électronique', an1: 30, annuel: 15, plancher: 5, revente: 20, liquidite: 'forte', note: 'Renouvellement rapide des modèles.' },
    { id: 'informatique', nom: 'Informatique', an1: 35, annuel: 20, plancher: 5, revente: 20, liquidite: 'forte', note: 'Obsolescence technique rapide.' },
    { id: 'electromenager', nom: 'Électroménager', an1: 25, annuel: 12, plancher: 5, revente: 35, liquidite: 'moyenne', note: 'Encombrant, transport à prévoir.' },
    { id: 'mobilier', nom: 'Mobilier et décoration', an1: 40, annuel: 8, plancher: 5, revente: 40, liquidite: 'faible', note: 'Forte perte à la sortie du magasin, puis lente.' },
    { id: 'vetements', nom: 'Vêtements et accessoires', an1: 60, annuel: 15, plancher: 2, revente: 50, liquidite: 'faible', note: 'Revente à l\'unité longue et peu rémunératrice.' },
    { id: 'outillage', nom: 'Outillage et jardin', an1: 20, annuel: 8, plancher: 15, revente: 25, liquidite: 'forte', note: 'Matériel robuste, demande d\'occasion régulière.' },
    { id: 'loisirs', nom: 'Sports, loisirs et musique', an1: 25, annuel: 10, plancher: 10, revente: 25, liquidite: 'moyenne', note: 'Dépend beaucoup de l\'état et de la saison.' },
    { id: 'collections', nom: 'Collections, bijoux et art', an1: 0, annuel: 0, plancher: 100, revente: 30, liquidite: 'moyenne', note: 'Aucune décote automatique : saisis toi-même une valeur si tu la connais.' },
  ],

  // États : coefficient appliqué à la valeur après décote liée à l'âge (1 = aucune réduction).
  etats: [
    { id: 'neuf', nom: 'Neuf', coef: 1, aide: 'Jamais utilisé, emballage d\'origine.' },
    { id: 'comme-neuf', nom: 'Comme neuf', coef: 0.95, aide: 'Utilisé, sans aucune trace.' },
    { id: 'tres-bon', nom: 'Très bon état', coef: 0.85, aide: 'Traces d\'usage à peine visibles.' },
    { id: 'bon', nom: 'Bon état', coef: 0.72, aide: 'Traces d\'usage visibles, tout fonctionne.' },
    { id: 'correct', nom: 'État correct', coef: 0.55, aide: 'Usure nette, défauts esthétiques.' },
    { id: 'mauvais', nom: 'Mauvais état', coef: 0.3, aide: 'Défauts importants, réparation à prévoir.' },
    { id: 'hs', nom: 'Hors service', coef: 0.05, aide: 'Ne fonctionne plus : pièces détachées au mieux.' },
  ],

  // Fréquence d'utilisation : « peu » marque les objets peu ou pas utilisés dans l'analyse.
  usages: [
    { id: 'quotidien', nom: 'Tous les jours', peu: false },
    { id: 'hebdo', nom: 'Chaque semaine', peu: false },
    { id: 'mensuel', nom: 'Chaque mois', peu: false },
    { id: 'rare', nom: 'Quelques fois par an', peu: true },
    { id: 'jamais', nom: 'Jamais', peu: true },
  ],

  // Le prix d'achat unitaire module la vitesse de décote : multiplicateur appliqué aux taux de l'âge.
  // Hypothèse : un objet très bon marché se revend mal, un objet haut de gamme garde mieux sa valeur.
  tranchesPrix: [
    { jusqua: 50, mult: 1.25, nom: 'Moins de 50 €' },
    { jusqua: 300, mult: 1.1, nom: 'De 50 à 300 €' },
    { jusqua: 1000, mult: 1, nom: 'De 300 à moins de 1 000 €' },
    { jusqua: null, mult: 0.85, nom: '1 000 € et plus' },
  ],

  // Facilité de revente : un objet est « facilement revendable » si sa famille a cette liquidité et
  // que son état est au moins celui indiqué.
  reventeFacile: { forte: 'bon', moyenne: 'tres-bon', faible: null },

  // Paramètres par défaut du simulateur de revente (modifiables pour chaque scénario).
  simulationDefaut: { decote: 0, negociation: 10, commission: 8, fraisFixes: 0, expedition: 7, partExpediee: 50 },

  // Seuil par défaut d'un objet « de valeur » peu utilisé (valeur actuelle estimée, en euros).
  seuilValeur: 100,

  // Catégories : id stable, nom, sous-catégories (famille de décote + exemples d'objets, sans prix).
  // Les six premières sont ouvertes dans l'expérience découverte.
  categories: [
    { id: 'informatique', nom: 'Informatique et électronique', decouverte: true, sous: [
      { id: 'portables', nom: 'Ordinateurs portables', famille: 'informatique', exemples: ['Ordinateur portable', 'Ultraportable', 'Ordinateur portable de jeu', 'Chromebook'] },
      { id: 'fixes', nom: 'Ordinateurs fixes', famille: 'informatique', exemples: ['Ordinateur de bureau', 'Mini-PC', 'Tour de jeu', 'Ordinateur tout-en-un'] },
      { id: 'tablettes', nom: 'Tablettes et liseuses', famille: 'informatique', exemples: ['Tablette', 'Liseuse', 'Tablette graphique'] },
      { id: 'ecrans', nom: 'Écrans et périphériques', famille: 'informatique', exemples: ['Écran d\'ordinateur', 'Clavier', 'Souris', 'Imprimante', 'Disque dur externe', 'Station d\'accueil'] },
      { id: 'tv', nom: 'Télévision et vidéo', famille: 'electronique', exemples: ['Téléviseur', 'Vidéoprojecteur', 'Barre de son', 'Lecteur Blu-ray', 'Box multimédia'] },
      { id: 'audio', nom: 'Audio et hi-fi', famille: 'electronique', exemples: ['Enceinte', 'Chaîne hi-fi', 'Platine vinyle', 'Amplificateur', 'Casque audio'] },
      { id: 'photo', nom: 'Photo et vidéo', famille: 'electronique', exemples: ['Appareil photo hybride', 'Reflex', 'Objectif', 'Caméra sportive', 'Drone', 'Trépied'] },
    ] },
    { id: 'telephonie', nom: 'Téléphonie et objets connectés', decouverte: true, sous: [
      { id: 'smartphones', nom: 'Smartphones', famille: 'electronique', exemples: ['Smartphone', 'Téléphone de secours', 'Téléphone fixe sans fil'] },
      { id: 'montres', nom: 'Montres et bracelets connectés', famille: 'electronique', exemples: ['Montre connectée', 'Bracelet d\'activité', 'Montre GPS de sport'] },
      { id: 'ecouteurs', nom: 'Écouteurs', famille: 'electronique', exemples: ['Écouteurs sans fil', 'Écouteurs à réduction de bruit', 'Casque Bluetooth'] },
      { id: 'maison-connectee', nom: 'Maison connectée', famille: 'electronique', exemples: ['Enceinte connectée', 'Caméra de surveillance', 'Thermostat connecté', 'Ampoules connectées', 'Sonnette connectée'] },
      { id: 'accessoires-tel', nom: 'Accessoires', famille: 'electronique', exemples: ['Batterie externe', 'Chargeur sans fil', 'Coque et protection'] },
    ] },
    { id: 'electromenager', nom: 'Électroménager', decouverte: true, sous: [
      { id: 'gros', nom: 'Gros électroménager', famille: 'electromenager', exemples: ['Lave-linge', 'Sèche-linge', 'Réfrigérateur', 'Congélateur', 'Lave-vaisselle', 'Four', 'Plaque de cuisson', 'Hotte'] },
      { id: 'cuisine', nom: 'Petit électroménager de cuisine', famille: 'electromenager', exemples: ['Robot pâtissier', 'Robot cuiseur', 'Machine à café', 'Micro-ondes', 'Friteuse à air', 'Blender', 'Bouilloire', 'Grille-pain'] },
      { id: 'entretien', nom: 'Entretien de la maison', famille: 'electromenager', exemples: ['Aspirateur', 'Aspirateur robot', 'Aspirateur balai', 'Nettoyeur vapeur', 'Fer à repasser', 'Centrale vapeur'] },
      { id: 'soin', nom: 'Soin de la personne', famille: 'electromenager', exemples: ['Sèche-cheveux', 'Lisseur', 'Tondeuse', 'Brosse à dents électrique'] },
      { id: 'confort', nom: 'Chauffage et climatisation d\'appoint', famille: 'electromenager', exemples: ['Climatiseur mobile', 'Radiateur d\'appoint', 'Déshumidificateur', 'Purificateur d\'air', 'Ventilateur'] },
    ] },
    { id: 'mobilier', nom: 'Mobilier', decouverte: true, sous: [
      { id: 'salon', nom: 'Salon', famille: 'mobilier', exemples: ['Canapé', 'Fauteuil', 'Table basse', 'Meuble TV', 'Bibliothèque'] },
      { id: 'chambre', nom: 'Chambre', famille: 'mobilier', exemples: ['Lit', 'Matelas', 'Armoire', 'Commode', 'Table de chevet'] },
      { id: 'repas', nom: 'Salle à manger', famille: 'mobilier', exemples: ['Table', 'Chaises', 'Buffet', 'Vaisselier'] },
      { id: 'bureau', nom: 'Bureau', famille: 'mobilier', exemples: ['Bureau', 'Chaise de bureau', 'Bureau assis-debout', 'Caisson'] },
      { id: 'rangement', nom: 'Rangement', famille: 'mobilier', exemples: ['Étagère', 'Meuble à chaussures', 'Dressing', 'Meuble de salle de bain'] },
      { id: 'enfant', nom: 'Chambre d\'enfant', famille: 'mobilier', exemples: ['Lit d\'enfant', 'Lit à barreaux', 'Table à langer', 'Coffre à jouets'] },
    ] },
    { id: 'decoration', nom: 'Décoration', sous: [
      { id: 'luminaires', nom: 'Luminaires', famille: 'mobilier', exemples: ['Lampadaire', 'Lampe de bureau', 'Suspension', 'Applique'] },
      { id: 'tapis', nom: 'Tapis et textiles', famille: 'mobilier', exemples: ['Tapis', 'Rideaux', 'Coussins', 'Plaid'] },
      { id: 'murs', nom: 'Tableaux, cadres et miroirs', famille: 'mobilier', exemples: ['Miroir', 'Cadre', 'Affiche encadrée', 'Horloge murale'] },
      { id: 'table', nom: 'Art de la table', famille: 'mobilier', exemples: ['Service de vaisselle', 'Verres', 'Couverts', 'Batterie de cuisine', 'Couteaux de cuisine'] },
      { id: 'objets-deco', nom: 'Objets de décoration', famille: 'mobilier', exemples: ['Vase', 'Plantes artificielles', 'Bougeoir', 'Sculpture décorative'] },
    ] },
    { id: 'vetements', nom: 'Vêtements et chaussures', decouverte: true, sous: [
      { id: 'manteaux', nom: 'Manteaux et vestes', famille: 'vetements', exemples: ['Manteau d\'hiver', 'Doudoune', 'Veste en cuir', 'Imperméable', 'Blazer'] },
      { id: 'hauts', nom: 'Hauts', famille: 'vetements', exemples: ['Pulls', 'Chemises', 'T-shirts', 'Sweats'] },
      { id: 'bas', nom: 'Bas', famille: 'vetements', exemples: ['Jeans', 'Pantalons', 'Jupes', 'Shorts'] },
      { id: 'tenues', nom: 'Robes et costumes', famille: 'vetements', exemples: ['Costume', 'Robe de soirée', 'Tailleur'] },
      { id: 'chaussures', nom: 'Chaussures', famille: 'vetements', exemples: ['Baskets', 'Chaussures de ville', 'Bottes', 'Chaussures de randonnée', 'Chaussures de course'] },
      { id: 'sport-vet', nom: 'Vêtements de sport', famille: 'vetements', exemples: ['Tenue de sport', 'Combinaison de ski', 'Vêtements techniques'] },
      { id: 'enfants-vet', nom: 'Vêtements d\'enfant', famille: 'vetements', exemples: ['Lot de vêtements bébé', 'Lot de vêtements enfant', 'Combinaison de ski enfant'] },
    ] },
    { id: 'bijoux', nom: 'Bijoux et accessoires', sous: [
      { id: 'bijoux-precieux', nom: 'Bijoux en métal précieux', famille: 'collections', exemples: ['Bague', 'Collier', 'Bracelet', 'Boucles d\'oreilles', 'Alliance'] },
      { id: 'montres-classiques', nom: 'Montres', famille: 'collections', exemples: ['Montre automatique', 'Montre à quartz', 'Montre de plongée'] },
      { id: 'fantaisie', nom: 'Bijoux fantaisie', famille: 'vetements', exemples: ['Bijoux fantaisie', 'Parure fantaisie'] },
      { id: 'maroquinerie', nom: 'Sacs et maroquinerie', famille: 'vetements', exemples: ['Sac à main', 'Sac à dos', 'Portefeuille', 'Valise', 'Ceinture'] },
      { id: 'lunettes', nom: 'Lunettes et accessoires', famille: 'vetements', exemples: ['Lunettes de soleil', 'Écharpe', 'Chapeau', 'Parapluie'] },
    ] },
    { id: 'sports', nom: 'Sports et loisirs', decouverte: true, sous: [
      { id: 'velos', nom: 'Vélos', famille: 'loisirs', exemples: ['Vélo de route', 'VTT', 'Vélo de ville', 'Vélo enfant', 'Home-trainer'] },
      { id: 'fitness', nom: 'Fitness et musculation', famille: 'loisirs', exemples: ['Tapis de course', 'Vélo d\'appartement', 'Rameur', 'Haltères', 'Banc de musculation', 'Kettlebell'] },
      { id: 'hiver', nom: 'Sports d\'hiver', famille: 'loisirs', exemples: ['Skis', 'Chaussures de ski', 'Snowboard', 'Casque de ski', 'Raquettes à neige'] },
      { id: 'eau', nom: 'Sports nautiques', famille: 'loisirs', exemples: ['Paddle', 'Combinaison néoprène', 'Kayak', 'Planche de surf', 'Équipement de plongée'] },
      { id: 'plein-air', nom: 'Camping et randonnée', famille: 'loisirs', exemples: ['Tente', 'Sac de couchage', 'Sac de randonnée', 'Réchaud', 'Bâtons de marche'] },
      { id: 'raquettes', nom: 'Sports de raquette et collectifs', famille: 'loisirs', exemples: ['Raquette de tennis', 'Raquette de padel', 'Table de ping-pong', 'Panier de basket'] },
    ] },
    { id: 'musique', nom: 'Instruments de musique', sous: [
      { id: 'cordes', nom: 'Guitares et cordes', famille: 'loisirs', exemples: ['Guitare acoustique', 'Guitare électrique', 'Basse', 'Violon', 'Ukulélé'] },
      { id: 'claviers', nom: 'Claviers et pianos', famille: 'loisirs', exemples: ['Piano numérique', 'Piano droit', 'Clavier arrangeur', 'Synthétiseur'] },
      { id: 'percussions', nom: 'Batteries et percussions', famille: 'loisirs', exemples: ['Batterie électronique', 'Batterie acoustique', 'Cajón'] },
      { id: 'vents', nom: 'Instruments à vent', famille: 'loisirs', exemples: ['Saxophone', 'Trompette', 'Flûte traversière', 'Clarinette'] },
      { id: 'sono', nom: 'Matériel de son', famille: 'electronique', exemples: ['Ampli guitare', 'Table de mixage', 'Interface audio', 'Micro', 'Enceintes de monitoring'] },
    ] },
    { id: 'outillage', nom: 'Outillage et bricolage', sous: [
      { id: 'electroportatif', nom: 'Outillage électroportatif', famille: 'outillage', exemples: ['Perceuse-visseuse', 'Perforateur', 'Scie circulaire', 'Scie sauteuse', 'Ponceuse', 'Meuleuse'] },
      { id: 'main', nom: 'Outillage à main', famille: 'outillage', exemples: ['Caisse à outils', 'Jeu de clés', 'Coffret de douilles', 'Serre-joints'] },
      { id: 'mesure', nom: 'Mesure et traçage', famille: 'outillage', exemples: ['Niveau laser', 'Télémètre laser', 'Détecteur de matériaux'] },
      { id: 'acces', nom: 'Échelles et escabeaux', famille: 'outillage', exemples: ['Échelle', 'Escabeau', 'Échafaudage roulant'] },
      { id: 'atelier', nom: 'Atelier', famille: 'outillage', exemples: ['Établi', 'Compresseur', 'Poste à souder', 'Aspirateur d\'atelier', 'Nettoyeur haute pression'] },
    ] },
    { id: 'livres', nom: 'Livres et collections', sous: [
      { id: 'livres', nom: 'Livres', famille: 'collections', exemples: ['Bibliothèque de romans', 'Beaux livres', 'Livres de cuisine', 'Encyclopédie'] },
      { id: 'bd', nom: 'BD et mangas', famille: 'collections', exemples: ['Collection de BD', 'Collection de mangas', 'Albums en édition originale'] },
      { id: 'disques', nom: 'Vinyles, CD et films', famille: 'collections', exemples: ['Collection de vinyles', 'Collection de CD', 'Collection de DVD et Blu-ray'] },
      { id: 'objets-collection', nom: 'Objets de collection', famille: 'collections', exemples: ['Figurines', 'Cartes à collectionner', 'Miniatures', 'Objets vintage'] },
      { id: 'art', nom: 'Œuvres d\'art', famille: 'collections', exemples: ['Tableau', 'Lithographie', 'Sculpture', 'Photographie d\'art'] },
      { id: 'numismatique', nom: 'Timbres et monnaies', famille: 'collections', exemples: ['Collection de timbres', 'Collection de pièces'] },
    ] },
    { id: 'jeux', nom: 'Jeux et divertissement', sous: [
      { id: 'consoles', nom: 'Consoles', famille: 'electronique', exemples: ['Console de salon', 'Console portable', 'Casque de réalité virtuelle', 'Manette'] },
      { id: 'jeux-video', nom: 'Jeux vidéo', famille: 'electronique', exemples: ['Jeux vidéo physiques', 'Édition collector'] },
      { id: 'societe', nom: 'Jeux de société', famille: 'loisirs', exemples: ['Collection de jeux de société', 'Jeu d\'échecs', 'Puzzle'] },
      { id: 'jouets', nom: 'Jouets', famille: 'loisirs', exemples: ['Briques de construction', 'Poupées', 'Circuit de voitures', 'Jouets d\'éveil', 'Trottinette enfant'] },
      { id: 'modelisme', nom: 'Modélisme', famille: 'loisirs', exemples: ['Train miniature', 'Voiture radiocommandée', 'Maquettes'] },
    ] },
    { id: 'mobilite', nom: 'Équipements automobiles et mobilité', sous: [
      { id: 'electrique', nom: 'Mobilité électrique', famille: 'electronique', exemples: ['Vélo à assistance électrique', 'Trottinette électrique', 'Gyroroue'] },
      { id: 'moto', nom: 'Équipement moto', famille: 'loisirs', exemples: ['Casque moto', 'Blouson moto', 'Gants moto', 'Bottes moto'] },
      { id: 'auto', nom: 'Accessoires auto', famille: 'outillage', exemples: ['Coffre de toit', 'Porte-vélos', 'Barres de toit', 'Jeu de pneus hiver', 'Siège auto enfant', 'Chaînes neige'] },
      { id: 'deux-roues', nom: 'Accessoires vélo', famille: 'loisirs', exemples: ['Remorque vélo', 'Siège vélo enfant', 'Antivol', 'Sacoches'] },
    ] },
    { id: 'jardin', nom: 'Équipements de jardin', sous: [
      { id: 'motoculture', nom: 'Tondeuses et motoculture', famille: 'outillage', exemples: ['Tondeuse', 'Tondeuse robot', 'Taille-haie', 'Débroussailleuse', 'Souffleur', 'Tronçonneuse'] },
      { id: 'outils-jardin', nom: 'Outils de jardin', famille: 'outillage', exemples: ['Bêche', 'Râteau', 'Brouette', 'Sécateur', 'Composteur'] },
      { id: 'mobilier-jardin', nom: 'Mobilier de jardin', famille: 'mobilier', exemples: ['Salon de jardin', 'Table de jardin', 'Bains de soleil', 'Parasol', 'Hamac'] },
      { id: 'cuisson', nom: 'Barbecue et plancha', famille: 'electromenager', exemples: ['Barbecue', 'Plancha', 'Four à pizza d\'extérieur'] },
      { id: 'arrosage', nom: 'Arrosage et piscine', famille: 'outillage', exemples: ['Programmateur d\'arrosage', 'Récupérateur d\'eau', 'Piscine hors-sol', 'Robot de piscine'] },
    ] },
    { id: 'autres', nom: 'Autres biens', sous: [
      { id: 'puericulture', nom: 'Puériculture', famille: 'loisirs', exemples: ['Poussette', 'Porte-bébé', 'Chaise haute', 'Babyphone', 'Parc bébé'] },
      { id: 'animaux', nom: 'Animaux', famille: 'loisirs', exemples: ['Aquarium', 'Cage', 'Arbre à chat', 'Caisse de transport'] },
      { id: 'bagagerie', nom: 'Voyage', famille: 'vetements', exemples: ['Valise cabine', 'Grande valise', 'Sac de voyage'] },
      { id: 'divers', nom: 'Divers', famille: 'loisirs', exemples: ['Machine à coudre', 'Coffre-fort', 'Matériel médical', 'Autre objet'] },
    ] },
  ],

  // Limites de l'expérience découverte (sans clé de licence).
  decouverte: { maxObjets: 10 },
};
