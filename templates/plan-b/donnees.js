// PlanB · base intégrée (aucune logique ici).
// Référentiel GÉNÉRAL et PRUDENT établi par QME, daté et modifiable. Il ne remplace JAMAIS les consignes
// des autorités publiques (préfecture, mairie, services de secours), qui priment en toutes circonstances.
// Quantités par défaut : valeurs prudentes choisies par QME, non officielles, à adapter au foyer.
window.BASE = {
  version: '2026-11-13',
  dateReference: '2026-11-13',
  avertissement: 'Référentiel général et prudent établi par QME le 13/11/2026, non officiel. Il ne remplace pas les consignes des autorités (préfecture, mairie, services de secours), qui priment toujours. En cas de danger immédiat, appelle le 112.',
  sourcesExternes: 'Informations officielles à consulter et à suivre : site de ta préfecture et de ta mairie, plan communal de sauvegarde, informations de prévention des risques publiées par l\'État (dont Géorisques), vigilance météorologique.',

  profils: [
    { id: 'adulte', nom: 'Adulte' },
    { id: 'enfant', nom: 'Enfant (3 à 17 ans)' },
    { id: 'bebe', nom: 'Bébé (moins de 3 ans)' },
    { id: 'senior', nom: 'Personne âgée' },
  ],
  especes: [
    { id: 'chien', nom: 'Chien' }, { id: 'chat', nom: 'Chat' }, { id: 'autre', nom: 'Autre animal' },
  ],
  // Besoins spécifiques : chacun ajoute des points à vérifier et, si besoin, un article de réserve.
  besoins: [
    { id: 'traitement', nom: 'Traitement médical quotidien', conseil: 'Garder une réserve du traitement et une copie de l\'ordonnance ; en parler au médecin ou au pharmacien.' },
    { id: 'appareil', nom: 'Appareil médical électrique', conseil: 'Prévoir avec le prestataire de l\'appareil une solution en cas de coupure (batterie, consignes) et noter son numéro d\'assistance.' },
    { id: 'mobilite', nom: 'Mobilité réduite', conseil: 'Prévoir l\'aide nécessaire en cas d\'évacuation et un moyen de se signaler ; certaines mairies tiennent un registre des personnes vulnérables.' },
    { id: 'alimentation', nom: 'Allergie ou régime alimentaire', conseil: 'Choisir des réserves compatibles et garder les traitements d\'urgence prescrits.' },
    { id: 'sensoriel', nom: 'Handicap visuel ou auditif', conseil: 'Prévoir un moyen d\'alerte adapté ; le 114 permet de joindre les secours par SMS.' },
  ],

  categories: [
    { id: 'eau', nom: 'Eau' }, { id: 'nourriture', nom: 'Nourriture' }, { id: 'eclairage', nom: 'Éclairage et énergie' },
    { id: 'hygiene', nom: 'Hygiène' }, { id: 'secours', nom: 'Premiers secours et santé' }, { id: 'equipement', nom: 'Équipement' },
    { id: 'documents', nom: 'Documents et argent' }, { id: 'bebe', nom: 'Bébé' }, { id: 'animaux', nom: 'Animaux' },
  ],

  // Règles de quantité : personneJour (× personnes × jours), personne (× personnes), foyer (forfait),
  // bebeJour (× bébés × jours), animalJour (× animaux × jours), besoinJour (× membres concernés × jours).
  // autonomie : 'eau' ou 'nourriture' si l'article entre dans le calcul d'autonomie.
  articles: [
    { id: 'eau', nom: 'Eau potable en bouteilles', categorie: 'eau', unite: 'L', regle: 'personneJour', q: 3, autonomie: 'eau', peremption: true, aide: 'Boisson et cuisine. Valeur prudente par défaut, à ajuster.' },
    { id: 'eau-hygiene', nom: 'Eau pour l\'hygiène (bidons)', categorie: 'eau', unite: 'L', regle: 'personneJour', q: 2, peremption: false },
    { id: 'repas', nom: 'Repas non périssables sans cuisson (conserves, plats prêts)', categorie: 'nourriture', unite: 'repas', regle: 'personneJour', q: 3, autonomie: 'nourriture', peremption: true, aide: 'Compte en repas : une boîte de plat cuisiné pour une personne = 1 repas.' },
    { id: 'en-cas', nom: 'En-cas énergétiques (biscuits, fruits secs)', categorie: 'nourriture', unite: 'portion', regle: 'personneJour', q: 1, peremption: true },
    { id: 'ouvre-boite', nom: 'Ouvre-boîte manuel', categorie: 'nourriture', unite: 'u', regle: 'foyer', q: 1 },
    { id: 'lampe', nom: 'Lampe de poche ou frontale', categorie: 'eclairage', unite: 'u', regle: 'personne', q: 1, aide: 'Préférer les lampes aux bougies (risque d\'incendie).' },
    { id: 'piles', nom: 'Jeux de piles de rechange', categorie: 'eclairage', unite: 'jeu', regle: 'personne', q: 2, peremption: true },
    { id: 'radio', nom: 'Radio à piles ou à dynamo', categorie: 'eclairage', unite: 'u', regle: 'foyer', q: 1, aide: 'Pour suivre les consignes si internet et le téléphone ne fonctionnent plus.' },
    { id: 'batterie', nom: 'Batterie externe chargée', categorie: 'eclairage', unite: 'u', regle: 'foyer', q: 1 },
    { id: 'savon', nom: 'Savon et gel hydroalcoolique', categorie: 'hygiene', unite: 'u', regle: 'foyer', q: 2 },
    { id: 'papier', nom: 'Papier toilette', categorie: 'hygiene', unite: 'rouleau', regle: 'personneJour', q: 0.5 },
    { id: 'sacs', nom: 'Sacs poubelle', categorie: 'hygiene', unite: 'u', regle: 'foyer', q: 10 },
    { id: 'protections', nom: 'Protections hygiéniques', categorie: 'hygiene', unite: 'u', regle: 'foyer', q: 0, aide: 'Quantité à fixer selon le foyer (0 = non concerné).' },
    { id: 'trousse', nom: 'Trousse de premiers secours', categorie: 'secours', unite: 'u', regle: 'foyer', q: 1, peremption: true },
    { id: 'traitement', nom: 'Réserve de traitement médical', categorie: 'secours', unite: 'jour', regle: 'besoinJour', besoin: 'traitement', q: 1, peremption: true, aide: 'En jours de traitement, par personne concernée.' },
    { id: 'couverture', nom: 'Couverture de survie', categorie: 'equipement', unite: 'u', regle: 'personne', q: 1 },
    { id: 'vetements', nom: 'Vêtements chauds et imperméable', categorie: 'equipement', unite: 'tenue', regle: 'personne', q: 1 },
    { id: 'sac', nom: 'Sac d\'évacuation prêt', categorie: 'equipement', unite: 'u', regle: 'personne', q: 1 },
    { id: 'sifflet', nom: 'Sifflet', categorie: 'equipement', unite: 'u', regle: 'foyer', q: 1 },
    { id: 'outil', nom: 'Couteau multifonction', categorie: 'equipement', unite: 'u', regle: 'foyer', q: 1 },
    { id: 'copies', nom: 'Copies des papiers importants (identité, assurance, ordonnances)', categorie: 'documents', unite: 'jeu', regle: 'foyer', q: 1 },
    { id: 'liste-contacts', nom: 'Liste papier des contacts importants', categorie: 'documents', unite: 'u', regle: 'foyer', q: 1 },
    { id: 'especes', nom: 'Argent liquide en petites coupures', categorie: 'documents', unite: 'lot', regle: 'foyer', q: 1 },
    { id: 'lait-infantile', nom: 'Lait infantile et repas bébé', categorie: 'bebe', unite: 'jour', regle: 'bebeJour', q: 1, peremption: true },
    { id: 'couches', nom: 'Couches', categorie: 'bebe', unite: 'u', regle: 'bebeJour', q: 6 },
    { id: 'nourriture-animal', nom: 'Nourriture pour animal', categorie: 'animaux', unite: 'ration', regle: 'animalJour', q: 1, peremption: true },
    { id: 'eau-animal', nom: 'Eau pour animal', categorie: 'animaux', unite: 'L', regle: 'animalJour', q: 1 },
  ],

  // Situations : actions avant (préparer), pendant, après. Formulations générales et prudentes.
  situations: [
    { id: 'electricite', nom: 'Coupure d\'électricité', avant: [
      ['e1', 'Savoir où se trouve le tableau électrique et comment couper le courant'],
      ['e2', 'Avoir une lampe par personne et des piles de rechange'],
      ['e3', 'Garder une batterie externe chargée'],
      ['e4', 'Lister les appareils médicaux électriques du foyer et prévoir une solution avec leur prestataire'],
    ], pendant: [
      ['e5', 'Utiliser des lampes plutôt que des bougies'],
      ['e6', 'Garder le réfrigérateur et le congélateur fermés le plus possible'],
      ['e7', 'Débrancher les appareils sensibles pour le retour du courant'],
      ['e8', 'Ne jamais utiliser de groupe électrogène, barbecue ou chauffage d\'appoint à combustion dans un lieu fermé (monoxyde de carbone)'],
    ], apres: [
      ['e9', 'Vérifier l\'état des aliments du réfrigérateur et du congélateur avant de les consommer'],
      ['e10', 'Rebrancher les appareils progressivement'],
    ] },
    { id: 'eau', nom: 'Coupure ou restriction d\'eau', avant: [
      ['o1', 'Avoir une réserve d\'eau potable et d\'eau pour l\'hygiène'],
      ['o2', 'Savoir où se trouve le robinet d\'arrivée d\'eau'],
    ], pendant: [
      ['o3', 'Suivre les consignes de la mairie ou du distributeur d\'eau (points de distribution, eau non potable)'],
      ['o4', 'Réserver l\'eau potable à la boisson et à la cuisine'],
    ], apres: [
      ['o5', 'Appliquer les consignes du distributeur avant de reboire l\'eau du robinet'],
    ] },
    { id: 'intemperies', nom: 'Intempéries (tempête, inondation, neige)', avant: [
      ['i1', 'Savoir où consulter la vigilance météorologique et les consignes officielles'],
      ['i2', 'Ranger ou fixer ce qui peut s\'envoler à l\'extérieur'],
      ['i3', 'Repérer une pièce sûre et, en zone inondable, mettre en hauteur les objets importants'],
    ], pendant: [
      ['i4', 'Rester à l\'abri et limiter les déplacements'],
      ['i5', 'Ne pas s\'engager à pied ou en voiture sur une route inondée'],
      ['i6', 'Ne pas descendre dans un sous-sol ou un parking souterrain en cas d\'inondation'],
      ['i7', 'Suivre les consignes diffusées à la radio et par les autorités'],
    ], apres: [
      ['i8', 'Ne pas toucher aux câbles tombés au sol'],
      ['i9', 'Photographier les dommages pour l\'assurance'],
    ] },
    { id: 'evacuation', nom: 'Évacuation du logement', avant: [
      ['v1', 'Préparer un sac d\'évacuation par personne'],
      ['v2', 'Convenir d\'un point de rassemblement et d\'un contact hors de la zone'],
      ['v3', 'Connaître deux itinéraires pour quitter le quartier'],
      ['v4', 'Prévoir le transport des animaux (cage, laisse)'],
    ], pendant: [
      ['v5', 'Suivre les consignes et itinéraires donnés par les autorités'],
      ['v6', 'Couper le gaz et l\'électricité si les autorités le demandent'],
      ['v7', 'Emporter le sac, les traitements, les papiers et les animaux'],
      ['v8', 'Prévenir le contact convenu de l\'endroit où l\'on se rend'],
    ], apres: [
      ['v9', 'Ne rentrer qu\'avec l\'autorisation des autorités'],
    ] },
    { id: 'communications', nom: 'Interruption des communications', avant: [
      ['c1', 'Garder une liste papier des contacts importants'],
      ['c2', 'Convenir à l\'avance d\'un lieu et d\'une heure de retrouvailles'],
      ['c3', 'Avoir une radio à piles ou à dynamo'],
    ], pendant: [
      ['c4', 'Préférer les SMS aux appels quand le réseau est saturé'],
      ['c5', 'Économiser la batterie du téléphone'],
      ['c6', 'Écouter la radio pour suivre les consignes'],
    ], apres: [
      ['c7', 'Donner des nouvelles aux proches dès que possible'],
    ] },
    { id: 'logement', nom: 'Logement temporairement inaccessible', avant: [
      ['l1', 'Identifier un hébergement de repli chez des proches'],
      ['l2', 'Garder accessibles le numéro de contrat d\'assurance habitation et les copies de papiers'],
    ], pendant: [
      ['l3', 'Déclarer le sinistre à l\'assureur dans les délais du contrat'],
      ['l4', 'Se renseigner auprès de la mairie sur les solutions d\'hébergement d\'urgence'],
    ], apres: [
      ['l5', 'Faire vérifier le logement (électricité, gaz, structure) avant de le réoccuper si les autorités ou l\'assureur le demandent'],
    ] },
  ],

  // Numéros d'urgence en France (préremplis dans les contacts, non modifiables).
  urgences: [
    ['112', 'Numéro d\'urgence européen'], ['15', 'SAMU (urgence médicale)'], ['17', 'Police secours'], ['18', 'Sapeurs-pompiers'], ['114', 'Urgences par SMS (personnes sourdes, malentendantes ou ne pouvant pas parler)'],
  ],

  conseils: [
    ['Commencer petit', 'Trois jours d\'autonomie pour tout le foyer est un premier objectif courant ; tu peux le changer.'],
    ['Faire tourner les réserves', 'Consomme les réserves avant leur date et remplace-les : l\'application te prévient.'],
    ['En parler', 'Un plan n\'est utile que si chacun le connaît : imprime-le et range-le avec le sac d\'évacuation.'],
    ['Consignes officielles d\'abord', 'Ce plan prépare ton foyer ; le jour venu, ce sont les consignes des autorités qui s\'appliquent.'],
  ],
};
