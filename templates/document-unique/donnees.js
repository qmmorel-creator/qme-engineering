// Base intégrée du Document unique d'évaluation des risques (DUERP). Aucune logique ici.
// Règle du produit : toute obligation affichée renvoie à une source officielle DATÉE (date de mise à jour de
// la source et date de consultation). Légifrance n'étant pas consultable par nos outils, les articles du Code
// du travail sont ceux CITÉS par les pages officielles ci-dessous ; l'utilisateur est invité à les relire.
// Familles de risques : inspirées des 20 fiches de la brochure INRS ED 840 (titres, situations et mesures
// REFORMULÉS pour QME, rien n'est recopié) ; source citée dans l'application.
window.BASE = {
  version: '2026-11-14',

  sources: {
    sp: {
      titre: 'Service-public.gouv.fr (Entreprendre), « Qu\'est-ce que le document unique d\'évaluation des risques professionnels (DUERP) ? »',
      court: 'Service-public.gouv.fr, fiche F35360',
      url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F35360',
      maj: 'vérifiée le 22/07/2026 par la DILA',
      consulte: '14/11/2026',
    },
    inrs: {
      titre: 'INRS, « Document unique d\'évaluation des risques. Ce qu\'il faut retenir »',
      court: 'INRS, page « Document unique »',
      url: 'https://www.inrs.fr/demarche/document-unique/ce-qu-il-faut-retenir.html',
      maj: 'mise à jour le 18/10/2024',
      consulte: '14/11/2026',
    },
    ed840: {
      titre: 'INRS, brochure ED 840 « Évaluation des risques professionnels. Aide au repérage des risques dans les PME-PMI »',
      court: 'INRS ED 840',
      url: 'https://www.inrs.fr/media.html?refINRS=ED%20840',
      maj: 'édition d\'octobre 2023',
      consulte: '14/11/2026',
    },
  },

  // Seuils d'effectif utilisés par les règles (sources : sp et inrs, consultées le 14/11/2026).
  seuils: { annuel: 11, programme: 50 },

  // Obligations, filtrées selon l'effectif saisi. min / max : bornes d'effectif (incluses), absentes = toutes.
  obligations: [
    { id: 'evaluer', titre: 'Évaluer les risques et les transcrire dans un document unique', texte: 'Obligatoire dès l\'embauche du premier salarié. Aucun modèle n\'est imposé ; papier ou numérique au choix de l\'employeur.', articles: 'Code du travail, art. R4121-1 à R4121-4', sources: ['sp', 'inrs'] },
    { id: 'contenu', titre: 'Contenu du document', texte: 'Inventaire des risques identifiés et évalués (organisé par unité de travail), méthode d\'évaluation retenue, actions de prévention et de protection prévues, et en annexe les données collectives d\'exposition aux facteurs de risques professionnels avec la proportion de salariés exposés au-delà des seuils.', articles: 'Code du travail, art. R4121-1 et suivants ; facteurs de risques : art. L4161-1', sources: ['sp', 'inrs'] },
    { id: 'maj-evenement', titre: 'Mise à jour à chaque changement', texte: 'Lors de toute décision d\'aménagement important modifiant les conditions de santé, de sécurité ou de travail, et lorsqu\'une information supplémentaire sur l\'évaluation d\'un risque est portée à la connaissance de l\'employeur.', articles: 'Code du travail, art. R4121-2', sources: ['sp', 'inrs'] },
    { id: 'maj-annuelle', min: 11, titre: 'Mise à jour au moins une fois par an', texte: 'Pour les entreprises d\'au moins 11 salariés, en plus des mises à jour liées aux changements.', articles: 'Code du travail, art. R4121-2', sources: ['sp', 'inrs'] },
    { id: 'spst-cse', min: 11, titre: 'Transmission et consultation', texte: 'Transmission du document au service de prévention et de santé au travail (SPST) à chaque mise à jour ; consultation du CSE s\'il existe.', articles: 'Code du travail, art. L2312-5 à L2312-7 (moins de 50 salariés), L2312-27 (50 et plus)', sources: ['sp'] },
    { id: 'liste-actions', max: 49, titre: 'Liste des actions de prévention', texte: 'Moins de 50 salariés : pas de programme annuel formalisé, mais la liste des actions de prévention et de protection figure dans le document et dans ses mises à jour.', articles: 'Code du travail, art. L4121-1 à L4121-5 et R4121-1 à R4121-4', sources: ['sp', 'inrs'] },
    { id: 'programme', min: 50, titre: 'Programme annuel de prévention', texte: '50 salariés et plus : programme annuel de prévention des risques et d\'amélioration des conditions de travail (mesures de l\'année avec conditions d\'exécution, indicateurs de résultat, estimation du coût, ressources mobilisables et calendrier), présenté au CSE, qui est aussi consulté sur le document unique.', articles: 'Code du travail, art. L2312-27', sources: ['sp', 'inrs'] },
    { id: 'conservation', titre: 'Conservation pendant 40 ans', texte: 'Le document et ses versions successives sont conservés pendant 40 ans à compter de leur élaboration.', articles: 'Code du travail, art. L4121-1 à L4121-5 et R4121-1 à R4121-4', sources: ['sp', 'inrs'] },
    { id: 'acces', titre: 'Mise à disposition et affichage', texte: 'Le document est tenu à la disposition notamment des travailleurs et anciens travailleurs, des membres de la délégation du personnel du CSE, du SPST, de l\'inspection du travail, des agents de la Carsat et des organismes professionnels de santé et de sécurité. Les modalités d\'accès sont affichées sur les lieux de travail.', articles: 'Code du travail, art. R4121-4', sources: ['sp'] },
    { id: 'sanctions', titre: 'Sanctions', texte: 'Absence ou défaut de mise à jour : contravention de 5e classe, jusqu\'à 1 500 € (3 000 € en récidive) pour une personne physique et 7 500 € (15 000 € en récidive) pour une personne morale. D\'autres sanctions existent (délit d\'entrave, amende administrative).', articles: 'Code du travail, art. R4741-1, L2317-1, L8115-1', sources: ['sp'] },
  ],

  // Grille de cotation par défaut (paramétrable). Le mode d'appréciation est choisi par l'entreprise
  // (INRS ED 840, « L'essentiel ») : ces libellés sont une proposition QME, pas une norme.
  grille: {
    gravite: ['Faible : gêne, soins sur place, sans arrêt', 'Moyenne : blessure ou atteinte avec arrêt de travail', 'Grave : séquelles durables, incapacité permanente', 'Très grave : invalidité lourde ou décès'],
    probabilite: ['Rare : exposition exceptionnelle, moins d\'une fois par an', 'Possible : quelques fois par an', 'Probable : situation fréquente, chaque mois', 'Très probable : exposition quotidienne ou hebdomadaire'],
    seuils: { p1: 9, p2: 4 }, // score ≥ p1 : priorité 1 ; ≥ p2 : priorité 2 ; sinon priorité 3
  },
  priorites: [
    { n: 1, nom: 'Priorité 1', detail: 'Risque élevé : agir sans attendre' },
    { n: 2, nom: 'Priorité 2', detail: 'Risque moyen : action à planifier' },
    { n: 3, nom: 'Priorité 3', detail: 'Risque faible : surveiller' },
  ],

  reglages: { alerteJours: 30, revueMois: 12 },

  // Types de mesures, du plus efficace au moins efficace (inspirés des principes généraux de prévention,
  // Code du travail art. L4121-2, cités par service-public.gouv.fr).
  typesMesure: [
    { id: 'supprimer', nom: 'Supprimer le danger' },
    { id: 'remplacer', nom: 'Remplacer par moins dangereux' },
    { id: 'collective', nom: 'Protection collective' },
    { id: 'organisation', nom: 'Organisation du travail' },
    { id: 'individuelle', nom: 'Protection individuelle' },
    { id: 'formation', nom: 'Formation, information' },
  ],

  statutsAction: [
    { id: 'a-faire', nom: 'À faire' },
    { id: 'en-cours', nom: 'En cours' },
    { id: 'faite', nom: 'Faite' },
    { id: 'abandonnee', nom: 'Abandonnée' },
  ],

  typesUnite: [
    { id: 'poste', nom: 'Poste ou métier' },
    { id: 'lieu', nom: 'Lieu' },
    { id: 'activite', nom: 'Activité' },
  ],

  motifs: [
    { id: 'creation', nom: 'Première évaluation' },
    { id: 'annuelle', nom: 'Mise à jour annuelle' },
    { id: 'amenagement', nom: 'Aménagement important' },
    { id: 'information', nom: 'Information nouvelle sur un risque' },
    { id: 'accident', nom: 'Après un accident ou un incident' },
    { id: 'autre', nom: 'Autre' },
  ],

  // Événements qui appellent une mise à jour (journal de l'application).
  evenements: [
    { id: 'amenagement', nom: 'Aménagement important (locaux, machine, organisation)' },
    { id: 'information', nom: 'Information nouvelle sur un risque' },
    { id: 'accident', nom: 'Accident du travail ou incident' },
    { id: 'embauche', nom: 'Nouveau poste ou nouvelle activité' },
    { id: 'demande', nom: 'Demande du CSE, du SPST ou de l\'inspection' },
    { id: 'autre', nom: 'Autre' },
  ],

  // 20 familles de risques, inspirées des fiches INRS ED 840 (reformulées). code AUTRE : saisie libre.
  familles: [
    { code: 'PLAINPIED', nom: 'Chute de plain-pied', detail: 'Glissade, trébuchement ou faux pas sur une surface plane.', situations: ['Sol mouillé, gras ou encombré dans une zone de passage', 'Câbles, cartons ou outils laissés au sol', 'Éclairage faible dans un couloir ou un escalier', 'Marche ou seuil mal signalé'], mesures: ['Ranger les passages et définir des zones de stockage', 'Choisir un revêtement antidérapant et le nettoyer régulièrement', 'Améliorer l\'éclairage des circulations', 'Signaler les dénivellations'] },
    { code: 'HAUTEUR', nom: 'Chute de hauteur', detail: 'Chute depuis un escabeau, une échelle, un quai, une toiture ou une mezzanine.', situations: ['Accès à un rangement haut avec une chaise ou un carton', 'Échelle utilisée comme poste de travail', 'Quai ou trémie sans garde-corps', 'Intervention en toiture ou sur échafaudage'], mesures: ['Équiper d\'un garde-corps les bords et trémies', 'Fournir une plateforme individuelle roulante plutôt qu\'une échelle', 'Ranger en hauteur seulement ce qui sert peu', 'Former au travail en hauteur et au port du harnais si nécessaire'] },
    { code: 'CIRCULATION', nom: 'Circulation de véhicules et d\'engins sur le site', detail: 'Heurt ou écrasement par un chariot, un camion ou une voiture dans l\'enceinte de l\'entreprise.', situations: ['Piétons et chariots qui partagent la même allée', 'Manœuvres de camions sur la cour ou le quai', 'Visibilité réduite aux angles et aux portes'], mesures: ['Séparer les allées piétonnes et les voies de circulation', 'Établir un plan de circulation et le communiquer', 'Installer des miroirs, des feux ou des signaux sonores', 'Réserver la conduite aux personnes formées et autorisées'] },
    { code: 'ROUTE', nom: 'Risque routier en mission', detail: 'Accident lors des déplacements professionnels (voiture, utilitaire, deux-roues).', situations: ['Nombreux rendez-vous sur une même journée', 'Téléphone utilisé en conduisant', 'Véhicule mal entretenu ou chargement non arrimé', 'Longs trajets en fin de journée'], mesures: ['Organiser les tournées pour limiter les trajets et l\'urgence', 'Interdire les appels au volant et prévoir des pauses', 'Entretenir les véhicules et arrimer les charges', 'Privilégier le train ou la visioconférence quand c\'est possible'] },
    { code: 'PHYSIQUE', nom: 'Charge physique et postures', detail: 'Port de charges, gestes répétitifs, postures pénibles, travail prolongé sur écran.', situations: ['Charges lourdes ou encombrantes portées à la main', 'Gestes répétés à cadence élevée', 'Travail penché, à genoux ou bras levés', 'Poste informatique mal réglé, plusieurs heures par jour'], mesures: ['Fournir des aides à la manutention (diable, chariot, table élévatrice)', 'Organiser des rotations et des pauses', 'Régler les postes (hauteur du plan, écran, siège)', 'Former aux gestes et postures adaptés'] },
    { code: 'MANUTENTION', nom: 'Manutention mécanique', detail: 'Chute ou heurt de charge avec un pont roulant, un palan, un chariot ou un transpalette.', situations: ['Charge mal élinguée ou trop lourde pour l\'appareil', 'Personne sous une charge suspendue', 'Transpalette électrique dans une zone encombrée'], mesures: ['Vérifier les appareils et accessoires de levage', 'Interdire le passage sous les charges', 'Former et autoriser les conducteurs', 'Baliser les zones de manœuvre'] },
    { code: 'CHIMIQUE', nom: 'Produits chimiques, émissions et déchets', detail: 'Contact, inhalation ou projection de produits dangereux, poussières, fumées, déchets.', situations: ['Produits de nettoyage, colles, vernis ou solvants utilisés sans aération', 'Poussières de bois, de ciment ou de métal', 'Produits transvasés dans des contenants sans étiquette', 'Fiches de données de sécurité absentes'], mesures: ['Remplacer un produit dangereux par un produit moins dangereux', 'Capter les émissions à la source et ventiler', 'Tenir à jour l\'inventaire des produits et leurs fiches de données de sécurité', 'Fournir des gants, lunettes ou masques adaptés et former'] },
    { code: 'BIOLOGIQUE', nom: 'Agents biologiques', detail: 'Infection, allergie ou intoxication par des micro-organismes.', situations: ['Contact avec des personnes malades ou des fluides biologiques', 'Contact avec des animaux, des déchets ou des eaux usées', 'Piqûre par un objet souillé'], mesures: ['Organiser l\'hygiène des mains et le nettoyage', 'Fournir des conteneurs pour objets piquants ou coupants', 'Informer sur la vaccination recommandée avec le SPST', 'Fournir des équipements de protection adaptés'] },
    { code: 'MACHINES', nom: 'Équipements de travail et machines', detail: 'Coupure, écrasement, happement ou projection par une machine ou un outil.', situations: ['Protecteur retiré ou dispositif de sécurité neutralisé', 'Outil coupant tenu à la main', 'Intervention sur une machine sans la consigner', 'Machine ancienne non mise en conformité'], mesures: ['Maintenir les protecteurs en place et vérifier les arrêts d\'urgence', 'Consigner la machine avant toute intervention', 'Choisir des outils adaptés et entretenus', 'Former et autoriser les utilisateurs'] },
    { code: 'EFFONDREMENT', nom: 'Effondrements et chutes d\'objets', detail: 'Chute de matériaux ou d\'objets stockés, effondrement d\'un rayonnage ou d\'une tranchée.', situations: ['Rayonnage surchargé ou endommagé', 'Objets stockés en hauteur sans arrêt de charge', 'Empilement instable de matériaux', 'Tranchée sans blindage'], mesures: ['Respecter la charge maximale des rayonnages et les contrôler', 'Stocker le lourd en bas', 'Stabiliser les piles et limiter leur hauteur', 'Porter un casque là où des objets peuvent tomber'] },
    { code: 'BRUIT', nom: 'Bruit', detail: 'Perte d\'audition, fatigue, gêne à la communication.', situations: ['Machines bruyantes (scies, compresseurs, broyeurs)', 'Il faut élever la voix pour se parler à un mètre', 'Open space bruyant'], mesures: ['Choisir des machines moins bruyantes et capoter les sources', 'Éloigner ou isoler les postes bruyants', 'Fournir des protections auditives et vérifier leur port', 'Faire mesurer l\'exposition si nécessaire'] },
    { code: 'THERMIQUE', nom: 'Ambiances thermiques', detail: 'Chaleur, froid ou intempéries.', situations: ['Travail en extérieur par forte chaleur ou par grand froid', 'Poste près d\'un four ou dans une chambre froide', 'Locaux mal chauffés ou mal ventilés'], mesures: ['Adapter les horaires lors des épisodes de chaleur', 'Mettre de l\'eau fraîche et un local de repos à disposition', 'Fournir des vêtements adaptés', 'Isoler ou ventiler les locaux'] },
    { code: 'INCENDIE', nom: 'Incendie et explosion', detail: 'Départ de feu, explosion de gaz, de poussières ou de vapeurs.', situations: ['Produits inflammables stockés près d\'une source de chaleur', 'Accumulation de poussières de bois ou de farine', 'Travaux par point chaud (soudure, meulage)', 'Issues de secours encombrées'], mesures: ['Stocker les produits inflammables à part, en petite quantité', 'Nettoyer régulièrement les poussières', 'Mettre en place un permis de feu pour les travaux par point chaud', 'Disposer d\'extincteurs adaptés, d\'issues dégagées et faire des exercices d\'évacuation'] },
    { code: 'ELECTRIQUE', nom: 'Électricité', detail: 'Électrisation, électrocution, brûlure ou incendie d\'origine électrique.', situations: ['Câble ou prise endommagé', 'Multiprises en cascade', 'Intervention sur une installation sous tension', 'Armoire électrique ouverte'], mesures: ['Faire vérifier l\'installation et réparer sans attendre', 'Réserver les interventions électriques aux personnes habilitées', 'Fermer les armoires et coffrets', 'Supprimer les multiprises en cascade'] },
    { code: 'ECLAIRAGE', nom: 'Ambiances lumineuses', detail: 'Fatigue visuelle, éblouissement, erreurs ou chutes dues à un éclairage inadapté.', situations: ['Éclairage insuffisant au poste ou dans les passages', 'Reflets ou éblouissement sur les écrans', 'Travail de précision sous une lumière faible'], mesures: ['Adapter l\'éclairage à la tâche', 'Orienter les écrans perpendiculairement aux fenêtres', 'Entretenir et remplacer les luminaires'] },
    { code: 'RAYONNEMENTS', nom: 'Rayonnements', detail: 'Exposition aux ultraviolets (soudure, soleil), aux lasers ou à d\'autres rayonnements.', situations: ['Soudure à l\'arc sans écran pour les voisins', 'Travail prolongé au soleil', 'Appareil laser ou à rayonnement mal protégé'], mesures: ['Installer des écrans autour des postes de soudure', 'Fournir des protections (masque, lunettes, vêtements)', 'Limiter le temps d\'exposition'] },
    { code: 'PSYCHOSOCIAUX', nom: 'Risques psychosociaux', detail: 'Stress, violences internes ou externes, épuisement, conflits.', situations: ['Charge de travail excessive ou objectifs flous', 'Contact avec un public agressif ou en détresse', 'Travail isolé', 'Manque de soutien ou de reconnaissance', 'Changements imposés sans information'], mesures: ['Répartir la charge et clarifier les rôles', 'Prévoir une procédure en cas d\'agression et un soutien après un incident', 'Organiser des points d\'équipe réguliers', 'Former l\'encadrement et associer les salariés aux changements'] },
    { code: 'VIBRATIONS', nom: 'Vibrations', detail: 'Troubles des mains, des bras ou du dos dus aux machines vibrantes ou aux véhicules.', situations: ['Usage prolongé de perforateurs, ponceuses ou meuleuses', 'Conduite d\'engins sur sol irrégulier'], mesures: ['Choisir des outils à faibles vibrations et les entretenir', 'Limiter la durée d\'utilisation et alterner les tâches', 'Équiper les engins de sièges suspendus'] },
    { code: 'HEURT', nom: 'Heurt, cognement', detail: 'Choc contre un obstacle fixe ou mobile, coupure contre un élément saillant.', situations: ['Passages étroits ou encombrés', 'Porte vitrée non signalée', 'Éléments saillants à hauteur de tête'], mesures: ['Dégager les passages', 'Signaler les vitrages et les obstacles', 'Protéger les angles et les saillies'] },
    { code: 'ADDICTIONS', nom: 'Pratiques addictives', detail: 'Effets de l\'alcool, du cannabis ou de médicaments sur la vigilance et la sécurité.', situations: ['Pots ou repas arrosés', 'Postes de sécurité (conduite, machines) tenus par une personne dont la vigilance est altérée', 'Charge et stress favorisant les consommations'], mesures: ['Définir des règles sur l\'alcool au travail (règlement intérieur, note de service)', 'Informer et orienter vers le SPST', 'Prévoir une conduite à tenir face à une personne dont la vigilance est altérée'] },
    { code: 'AUTRE', nom: 'Autre risque', detail: 'Risque absent de la liste : décris-le librement.', situations: [], mesures: [] },
  ],

  // Secteurs : unités de travail proposées au démarrage, avec les risques à examiner (famille + situation).
  // Exemples à adapter : ils ne disent pas quels risques existent dans ton entreprise.
  secteurs: [
    { id: 'bureaux', nom: 'Bureaux, services, conseil', unites: [
      { nom: 'Travail de bureau', type: 'poste', risques: [['PHYSIQUE', 'Plusieurs heures par jour sur écran, poste à régler'], ['PSYCHOSOCIAUX', 'Pics de charge et interruptions fréquentes'], ['ELECTRIQUE', 'Multiprises et câbles sous les bureaux'], ['PLAINPIED', 'Câbles et cartons dans les passages']] },
      { nom: 'Accueil du public', type: 'poste', risques: [['PSYCHOSOCIAUX', 'Visiteur mécontent ou agressif à l\'accueil'], ['PHYSIQUE', 'Station assise prolongée, écran et téléphone']] },
      { nom: 'Déplacements professionnels', type: 'activite', risques: [['ROUTE', 'Rendez-vous clients en voiture, souvent enchaînés']] },
      { nom: 'Archives et reprographie', type: 'lieu', risques: [['HAUTEUR', 'Cartons rangés en hauteur'], ['PHYSIQUE', 'Port de cartons d\'archives']] },
    ] },
    { id: 'commerce', nom: 'Commerce de détail', unites: [
      { nom: 'Vente en magasin', type: 'poste', risques: [['PSYCHOSOCIAUX', 'Client agressif ou vol à l\'étalage'], ['PHYSIQUE', 'Station debout prolongée'], ['PLAINPIED', 'Sol mouillé à l\'entrée par temps de pluie']] },
      { nom: 'Réserve et réception', type: 'lieu', risques: [['PHYSIQUE', 'Déchargement de colis lourds'], ['EFFONDREMENT', 'Rayonnages chargés en hauteur'], ['HAUTEUR', 'Escabeau pour atteindre le haut des rayonnages'], ['MACHINES', 'Cutter pour ouvrir les cartons']] },
      { nom: 'Caisse', type: 'poste', risques: [['PHYSIQUE', 'Gestes répétés au passage des articles'], ['PSYCHOSOCIAUX', 'Risque de vol à main armée ou d\'incivilités']] },
    ] },
    { id: 'restauration', nom: 'Restauration, métiers de bouche', unites: [
      { nom: 'Cuisine', type: 'lieu', risques: [['MACHINES', 'Couteaux, trancheuse et robots'], ['THERMIQUE', 'Chaleur des fourneaux en été'], ['PLAINPIED', 'Sol gras ou mouillé'], ['INCENDIE', 'Friteuse et gaz'], ['CHIMIQUE', 'Produits de nettoyage et de dégraissage']] },
      { nom: 'Salle et service', type: 'poste', risques: [['PHYSIQUE', 'Port de plateaux et station debout'], ['PSYCHOSOCIAUX', 'Coups de feu et horaires décalés'], ['PLAINPIED', 'Marche entre la salle et la terrasse']] },
      { nom: 'Plonge', type: 'poste', risques: [['CHIMIQUE', 'Produits de lavage concentrés'], ['THERMIQUE', 'Buées et chaleur du lave-vaisselle'], ['PHYSIQUE', 'Port de bacs de vaisselle']] },
      { nom: 'Réception et chambre froide', type: 'lieu', risques: [['THERMIQUE', 'Passages répétés en chambre froide'], ['PHYSIQUE', 'Livraisons lourdes à ranger']] },
    ] },
    { id: 'batiment', nom: 'Bâtiment et artisanat', unites: [
      { nom: 'Chantier', type: 'lieu', risques: [['HAUTEUR', 'Travail sur escabeau, échafaudage ou toiture'], ['PHYSIQUE', 'Port de matériaux'], ['CHIMIQUE', 'Poussières de ciment, de plâtre ou de bois'], ['BRUIT', 'Outils électroportatifs bruyants'], ['VIBRATIONS', 'Perforateur, burineur'], ['ELECTRIQUE', 'Alimentation provisoire du chantier']] },
      { nom: 'Atelier et dépôt', type: 'lieu', risques: [['MACHINES', 'Scies et machines à bois ou à métal'], ['EFFONDREMENT', 'Stockage de matériaux en hauteur'], ['INCENDIE', 'Produits inflammables et poussières']] },
      { nom: 'Trajets et livraisons', type: 'activite', risques: [['ROUTE', 'Utilitaire chargé entre le dépôt et les chantiers']] },
      { nom: 'Bureau', type: 'lieu', risques: [['PHYSIQUE', 'Devis et administratif sur écran'], ['PSYCHOSOCIAUX', 'Délais serrés et relations clients']] },
    ] },
    { id: 'atelier', nom: 'Atelier, fabrication, industrie légère', unites: [
      { nom: 'Production', type: 'lieu', risques: [['MACHINES', 'Machines de production et outillage'], ['BRUIT', 'Ambiance sonore élevée'], ['PHYSIQUE', 'Gestes répétitifs au poste'], ['CHIMIQUE', 'Huiles, solvants ou poussières']] },
      { nom: 'Magasin et expédition', type: 'lieu', risques: [['MANUTENTION', 'Transpalette et chariot élévateur'], ['CIRCULATION', 'Piétons et chariots dans les mêmes allées'], ['EFFONDREMENT', 'Palettes stockées en hauteur']] },
      { nom: 'Maintenance', type: 'poste', risques: [['ELECTRIQUE', 'Interventions sur armoires et machines'], ['MACHINES', 'Intervention machine à l\'arrêt mais non consignée'], ['HAUTEUR', 'Accès aux équipements en hauteur']] },
    ] },
    { id: 'logistique', nom: 'Logistique, entrepôt, transport', unites: [
      { nom: 'Quais', type: 'lieu', risques: [['CIRCULATION', 'Manœuvres de camions à quai'], ['HAUTEUR', 'Bord de quai sans camion'], ['THERMIQUE', 'Portes de quai ouvertes en hiver']] },
      { nom: 'Préparation de commandes', type: 'poste', risques: [['PHYSIQUE', 'Colis manipulés à cadence élevée'], ['PSYCHOSOCIAUX', 'Pression des délais d\'expédition'], ['EFFONDREMENT', 'Rayonnages à grande hauteur']] },
      { nom: 'Conduite de chariots', type: 'poste', risques: [['MANUTENTION', 'Chariot élévateur en charge'], ['CIRCULATION', 'Croisements avec les piétons']] },
      { nom: 'Livraison', type: 'activite', risques: [['ROUTE', 'Tournées de livraison en ville'], ['PHYSIQUE', 'Livraison de colis lourds en étage']] },
    ] },
    { id: 'aide', nom: 'Aide et soins à domicile', unites: [
      { nom: 'Interventions au domicile', type: 'poste', risques: [['PHYSIQUE', 'Aide au lever et à la toilette'], ['BIOLOGIQUE', 'Contact avec des personnes malades'], ['PSYCHOSOCIAUX', 'Travail isolé, situations de détresse'], ['CHIMIQUE', 'Produits ménagers du domicile'], ['PLAINPIED', 'Logements encombrés ou mal éclairés']] },
      { nom: 'Déplacements entre les domiciles', type: 'activite', risques: [['ROUTE', 'Trajets courts et nombreux, horaires serrés']] },
      { nom: 'Coordination et planning', type: 'poste', risques: [['PSYCHOSOCIAUX', 'Remplacements de dernière minute'], ['PHYSIQUE', 'Travail sur écran et au téléphone']] },
    ] },
    { id: 'beaute', nom: 'Coiffure, esthétique', unites: [
      { nom: 'Poste de coiffure ou de soin', type: 'poste', risques: [['PHYSIQUE', 'Station debout, bras levés'], ['CHIMIQUE', 'Colorations, décolorations, vernis'], ['ELECTRIQUE', 'Sèche-cheveux et appareils près de l\'eau']] },
      { nom: 'Bac à shampoing', type: 'lieu', risques: [['CHIMIQUE', 'Eau et produits : irritation des mains'], ['PHYSIQUE', 'Posture penchée au bac'], ['PLAINPIED', 'Sol mouillé']] },
      { nom: 'Accueil et caisse', type: 'poste', risques: [['PSYCHOSOCIAUX', 'Client mécontent, attente']] },
    ] },
    { id: 'autre', nom: 'Autre activité', unites: [
      { nom: 'Activité principale', type: 'activite', risques: [] },
    ] },
  ],

  conseils: [
    ['Découpe en unités de travail', 'Un poste, un métier ou un lieu où les salariés sont exposés aux mêmes risques.'],
    ['Note les risques réels', 'Observe le travail tel qu\'il se fait et demande aux salariés concernés.'],
    ['Cote, puis agis', 'Gravité × probabilité donne la priorité ; chaque risque élevé reçoit une action datée.'],
    ['Archive chaque mise à jour', 'Une version datée à chaque révision, à conserver 40 ans.'],
  ],
};
