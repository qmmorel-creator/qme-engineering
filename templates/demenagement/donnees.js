// Base intégrée du template Déménagement : rétroplanning type, démarches, pièces, meubles et volumes,
// postes de budget, prestations des devis. Contenu original rédigé pour QME.
// Règle : aucune démarche datée ni aucun délai légal. Les délais qui dépendent d'un texte (préavis du bail,
// restitution du dépôt de garantie, changement d'adresse d'un véhicule, listes électorales…) ne sont pas
// chiffrés : chaque tâche renvoie au bail, au contrat ou à service-public.fr, qui font foi.
// Échéances : J = jour du déménagement ; J−56 = huit semaines avant. Ce sont des repères d'organisation,
// pas des obligations. Volumes des meubles : ordres de grandeur indicatifs (hypothèses QME), modifiables.
(() => {
  // t(identifiant stable, J relatif, catégorie, titre, aide, condition facultative)
  // Conditions : 'depart:locataire', 'depart:proprietaire', 'arrivee:locataire', 'arrivee:proprietaire',
  // 'mode:pro', 'mode:soi', 'enfants', 'animaux', 'vehicule'.
  const t = (id, j, cat, titre, aide = '', si = '') => ({ id, j, cat, titre, aide, si });
  const VERIF = 'Le délai dépend de ta situation : vérifie-le sur service-public.fr ou dans ton contrat avant d\'agir.';

  window.BASE = {
    version: '2026-11-14',

    categories: [
      { id: 'logement', nom: 'Logement', long: 'Ancien et nouveau logement', couleur: 'bleu' },
      { id: 'demarches', nom: 'Adresse', long: 'Changements d\'adresse', couleur: 'rouge' },
      { id: 'contrats', nom: 'Contrats', long: 'Contrats à résilier, transférer ou ouvrir', couleur: 'jaune' },
      { id: 'organisation', nom: 'Organisation', long: 'Tri, transport et cartons', couleur: 'encre' },
      { id: 'famille', nom: 'Famille', long: 'Enfants et animaux', couleur: 'rose' },
      { id: 'jourj', nom: 'Jour J', long: 'Le jour du déménagement', couleur: 'rouge' },
      { id: 'installation', nom: 'Installation', long: 'Après l\'arrivée', couleur: 'bleu' },
    ],

    // Situations proposées au premier lancement (modifiables dans les réglages).
    situations: {
      depart: [
        { id: 'locataire', nom: 'Je quitte une location' },
        { id: 'proprietaire', nom: 'Je quitte un logement dont je suis propriétaire' },
        { id: 'autre', nom: 'Autre (hébergé, logement de fonction…)' },
      ],
      arrivee: [
        { id: 'locataire', nom: 'J\'emménage dans une location' },
        { id: 'proprietaire', nom: 'J\'emménage dans un logement que j\'achète' },
        { id: 'autre', nom: 'Autre' },
      ],
      mode: [
        { id: 'pro', nom: 'Avec un déménageur professionnel' },
        { id: 'soi', nom: 'Par mes propres moyens (utilitaire, amis)' },
      ],
      options: [
        { id: 'enfants', nom: 'Avec des enfants (école, crèche, garde le jour J)' },
        { id: 'animaux', nom: 'Avec un animal de compagnie' },
        { id: 'vehicule', nom: 'Avec un véhicule immatriculé à mon adresse' },
      ],
    },

    // Rétroplanning type, de « bien avant » à un mois après.
    taches: [
      // Logement
      t('l01', -90, 'logement', 'Relire le bail : préavis de départ, forme du congé, état des lieux', 'Le délai de préavis dépend du bail et de la situation du logement. Vérifie-le sur service-public.fr (rubrique logement) avant de fixer la date.', 'depart:locataire'),
      t('l02', -84, 'logement', 'Envoyer le congé au propriétaire, dans la forme prévue par le bail', 'Garde une preuve d\'envoi et de réception. Forme et délai : ton bail et service-public.fr font foi.', 'depart:locataire'),
      t('l03', -60, 'logement', 'Convenir avec l\'acquéreur ou le notaire de la date de remise des clés', '', 'depart:proprietaire'),
      t('l04', -56, 'logement', 'Fixer la date du déménagement et poser les jours de congé nécessaires'),
      t('l05', -45, 'logement', 'Fixer avec le notaire ou le vendeur la date de signature et de remise des clés', '', 'arrivee:proprietaire'),
      t('l06', -42, 'logement', 'Prendre rendez-vous pour l\'état des lieux de sortie', 'Prévois-le une fois le logement vide et nettoyé.', 'depart:locataire'),
      t('l07', -42, 'logement', 'Prendre rendez-vous pour l\'état des lieux d\'entrée et la remise des clés', '', 'arrivee:locataire'),
      t('l08', -28, 'logement', 'Prévenir le syndic ou le gardien des deux immeubles : date, ascenseur, accès', ''),
      t('l09', -21, 'logement', 'Faire les petites réparations avant l\'état des lieux (trous, joints, ampoules)', 'Compare avec l\'état des lieux d\'entrée : il sert de référence.', 'depart:locataire'),
      t('l10', -14, 'logement', 'Confirmer l\'heure et le lieu de remise des clés du nouveau logement'),
      t('l11', -5, 'logement', 'Nettoyer l\'ancien logement, ou réserver un ménage de fin de bail', ''),
      t('l12', 0, 'logement', 'Relever les compteurs de l\'ancien logement (électricité, gaz, eau), avec photos', 'Les relevés servent aux factures de clôture.'),
      t('l13', 0, 'logement', 'État des lieux de sortie : comparer avec l\'entrée, rendre toutes les clés', 'Note le nombre de clés rendues sur l\'état des lieux.', 'depart:locataire'),
      t('l14', 0, 'logement', 'Remettre les clés et relever les compteurs avec l\'acquéreur', '', 'depart:proprietaire'),
      t('l15', 0, 'logement', 'Relever les compteurs du nouveau logement, avec photos'),
      t('l16', 0, 'logement', 'État des lieux d\'entrée : noter chaque défaut, avec photos datées', 'Ouvre les placards, teste les prises, les robinets et les volets.', 'arrivee:locataire'),
      t('l17', 7, 'logement', 'Signaler par écrit au propriétaire un défaut découvert après l\'entrée', 'Le délai pour compléter l\'état des lieux est fixé par les textes : vérifie-le sur service-public.fr.', 'arrivee:locataire'),
      t('l18', 30, 'logement', 'Suivre la restitution du dépôt de garantie', 'Le délai de restitution dépend de l\'état des lieux de sortie : vérifie-le sur service-public.fr.', 'depart:locataire'),

      // Changements d'adresse
      t('a01', -30, 'demarches', 'Faire suivre le courrier vers la nouvelle adresse (contrat de réexpédition)', 'Service payant de la poste : choisis la durée et la date de début.'),
      t('a02', -14, 'demarches', 'Déclarer le changement d\'adresse en ligne sur service-public.fr', 'Le téléservice de changement de coordonnées prévient plusieurs organismes en une fois : vérifie la liste des organismes couverts avant de prévenir les autres.'),
      t('a03', -14, 'demarches', 'Prévenir l\'employeur ou les clients (adresse, éventuels frais de trajet)'),
      t('a04', -14, 'demarches', 'Prévenir la banque'),
      t('a05', -14, 'demarches', 'Prévenir l\'assurance maladie et la complémentaire santé', 'Peut être couvert par le téléservice : vérifie avant.'),
      t('a06', -14, 'demarches', 'Prévenir la caisse d\'allocations familiales ou la caisse de retraite, si tu en dépends', 'Peut être couvert par le téléservice : vérifie avant. Un changement de loyer peut modifier une aide au logement.'),
      t('a07', -14, 'demarches', 'Mettre à jour l\'adresse dans ton espace fiscal en ligne', 'Peut être couvert par le téléservice : vérifie avant.'),
      t('a08', -7, 'demarches', 'Prévenir la famille et les amis de la nouvelle adresse'),
      t('a09', -3, 'demarches', 'Changer l\'adresse de livraison des commandes en cours'),
      t('a10', 7, 'demarches', 'Mettre à jour l\'adresse du certificat d\'immatriculation', 'Démarche en ligne. ' + VERIF, 'vehicule'),
      t('a11', 7, 'demarches', 'Prévenir l\'assureur du véhicule (lieu de stationnement)', '', 'vehicule'),
      t('a12', 14, 'demarches', 'S\'inscrire sur les listes électorales de la nouvelle commune', 'La date limite d\'inscription avant chaque scrutin est fixée par les textes : vérifie-la sur service-public.fr.'),
      t('a13', 14, 'demarches', 'Mettre à jour l\'adresse des abonnements, mutuelles et sites de commande'),
      t('a14', 14, 'demarches', 'Prévenir le médecin traitant, ou en choisir un près du nouveau logement'),
      t('a15', 14, 'demarches', 'Mettre à jour l\'adresse au fichier d\'identification de l\'animal', '', 'animaux'),
      t('a16', 30, 'demarches', 'Vérifier que le courrier arrive bien à la nouvelle adresse'),

      // Contrats
      t('c01', -30, 'contrats', 'Électricité : résilier ou transférer le contrat à la date du départ', 'Garde le relevé du jour J pour la facture de clôture.'),
      t('c02', -30, 'contrats', 'Électricité : ouvrir un contrat au nouveau logement pour la date d\'arrivée'),
      t('c03', -30, 'contrats', 'Gaz : résilier ou transférer, puis ouvrir au nouveau logement s\'il en a'),
      t('c04', -30, 'contrats', 'Internet : vérifier l\'éligibilité du nouveau logement, demander le transfert ou résilier', 'Les conditions de résiliation et de transfert sont dans ton contrat.'),
      t('c05', -30, 'contrats', 'Assurance habitation : prévenir l\'assureur et assurer le nouveau logement dès la remise des clés', 'Demande l\'attestation : elle est souvent demandée à la remise des clés.'),
      t('c06', -21, 'contrats', 'Eau : prévenir le service des eaux de l\'ancien et du nouveau logement', 'En immeuble, l\'eau est parfois comprise dans les charges.'),
      t('c07', -21, 'contrats', 'Contrats liés au logement (alarme, entretien de chaudière, box de télésurveillance) : résilier ou transférer'),
      t('c08', -14, 'contrats', 'Abonnements locaux (salle de sport, parking, médiathèque) : résilier ou transférer', 'Conditions de résiliation : voir chaque contrat.'),
      t('c09', 7, 'contrats', 'Rendre la box et le décodeur si le contrat internet est résilié', 'Délai et mode de retour : voir les conditions de ton opérateur.'),
      t('c10', 30, 'contrats', 'Vérifier les factures de clôture (énergie, eau, internet) avec les relevés du jour J'),

      // Organisation, tri et cartons
      t('o01', -56, 'organisation', 'Faire le tri pièce par pièce : garder, donner, vendre, jeter'),
      t('o02', -49, 'organisation', 'Estimer le volume (onglet Devis) et demander au moins trois devis', 'Une visite ou un inventaire précis rend les devis comparables.', 'mode:pro'),
      t('o03', -42, 'organisation', 'Comparer les devis, réserver le déménageur et verser l\'acompte', 'Vérifie ce qui est inclus : emballage, démontage, assurance, stationnement.', 'mode:pro'),
      t('o04', -42, 'organisation', 'Réserver l\'utilitaire et demander de l\'aide à des proches', 'Estime le volume (onglet Devis) pour choisir la taille de l\'utilitaire.', 'mode:soi'),
      t('o05', -35, 'organisation', 'Vendre, donner ou apporter en déchetterie ce qui ne part pas'),
      t('o06', -35, 'organisation', 'Se procurer cartons, adhésif, papier de protection et marqueurs'),
      t('o07', -28, 'organisation', 'Demander l\'autorisation de stationnement du camion aux deux mairies', 'Les règles et les délais varient selon la commune : renseigne-toi auprès de chaque mairie.'),
      t('o08', -28, 'organisation', 'Commencer les cartons des pièces peu utilisées (cave, grenier, livres)', 'Numérote chaque carton et note son contenu dans l\'onglet Cartons.'),
      t('o09', -21, 'organisation', 'Établir la déclaration de valeur du mobilier pour l\'assurance du déménageur', 'Elle fixe le montant de l\'indemnisation en cas de dommage : lis les conditions du contrat.', 'mode:pro'),
      t('o10', -14, 'organisation', 'Emballer les objets fragiles et la vaisselle qui ne sert pas'),
      t('o11', -14, 'organisation', 'Démonter les meubles qui ne servent plus d\'ici le départ'),
      t('o12', -10, 'organisation', 'Confirmer au déménageur la date, l\'heure, les adresses et les accès', '', 'mode:pro'),
      t('o13', -10, 'organisation', 'Confirmer l\'utilitaire et l\'heure de rendez-vous des proches', '', 'mode:soi'),
      t('o14', -7, 'organisation', 'Préparer le carton « premier jour » : draps, toilette, chargeurs, outils, café', 'Marque-le « À ouvrir en premier » dans l\'onglet Cartons.'),
      t('o15', -5, 'organisation', 'Mettre de côté papiers importants, clés, bijoux et médicaments : ils voyagent avec toi'),
      t('o16', -3, 'organisation', 'Finir les cartons, sauf l\'essentiel des derniers jours'),
      t('o17', -2, 'organisation', 'Vider, débrancher et dégivrer le réfrigérateur et le congélateur'),
      t('o18', -2, 'organisation', 'Imprimer les étiquettes des cartons et la liste par pièce', 'Onglet Cartons : « Étiquettes » et « Liste à imprimer ».'),
      t('o19', -1, 'organisation', 'Préparer un sac pour la nuit et le lendemain'),
      t('o20', -1, 'organisation', 'Prévoir eau et repas pour ceux qui aident'),

      // Famille
      t('f01', -42, 'famille', 'Inscrire les enfants dans la nouvelle école ou la nouvelle crèche', 'Renseigne-toi auprès de la mairie de la nouvelle commune.', 'enfants'),
      t('f02', -21, 'famille', 'Demander le certificat de radiation à l\'école actuelle', '', 'enfants'),
      t('f03', -21, 'famille', 'Prévoir la garde des enfants le jour J', '', 'enfants'),
      t('f04', -21, 'famille', 'Prévoir la garde de l\'animal ou son transport le jour J', '', 'animaux'),
      t('f05', -14, 'famille', 'Transférer la cantine, le périscolaire et les activités des enfants', '', 'enfants'),
      t('f06', -7, 'famille', 'Préparer le carton des enfants : doudous, jeux, affaires du premier soir', '', 'enfants'),
      t('f07', 7, 'famille', 'Trouver un vétérinaire près du nouveau logement', '', 'animaux'),

      // Jour J
      t('j01', 0, 'jourj', 'Garder sur soi les papiers, les clés et le carton « premier jour »'),
      t('j02', 0, 'jourj', 'Vérifier le chargement pièce par pièce : aucun carton oublié', 'Onglet Cartons : chaque carton est numéroté, rien ne se perd.'),
      t('j03', 0, 'jourj', 'Faire le dernier tour : placards, cave, balcon, grenier'),
      t('j04', 0, 'jourj', 'Coller le nom de chaque pièce sur sa porte au nouveau logement', 'Les étiquettes des cartons portent la même pièce et la même couleur.'),
      t('j05', 0, 'jourj', 'Pointer les cartons à l\'arrivée (onglet Cartons, « Arrivé »)'),
      t('j06', 0, 'jourj', 'Noter les réserves précises sur le document de livraison avant de signer', 'Objet et dégât, carton par carton. Délai pour confirmer les réserves : voir les conditions du contrat.', 'mode:pro'),
      t('j07', 0, 'jourj', 'Rendre l\'utilitaire à l\'heure, avec le niveau de carburant prévu', '', 'mode:soi'),

      // Installation
      t('i01', 1, 'installation', 'Monter les lits et ouvrir le carton « premier jour »'),
      t('i02', 2, 'installation', 'Vérifier le chauffage, l\'eau chaude, l\'électricité et les détecteurs de fumée'),
      t('i03', 3, 'installation', 'Déballer les cartons prioritaires'),
      t('i04', 7, 'installation', 'Signaler au déménageur les casses ou les manques constatés', 'Garde photos et numéros de cartons. Délai et forme : voir le contrat.', 'mode:pro'),
      t('i05', 14, 'installation', 'Faire le point sur les cartons qui restent à déballer'),
      t('i06', 21, 'installation', 'Donner ou recycler les cartons vides'),
      t('i07', 30, 'installation', 'Clôturer le budget du déménagement (onglet Budget)'),
    ],

    // Pièces proposées pour les cartons (couleur d'étiquette fixe, dans l'ordre de « couleurs »).
    couleurs: ['#2E5A88', '#B84A34', '#E8B93A', '#5B8C5A', '#8A5A9E', '#C47A2C', '#3F8C8C', '#A23B62', '#6E685F', '#24221F'],
    nomsCouleurs: ['Bleu', 'Rouge', 'Jaune', 'Vert', 'Violet', 'Orange', 'Turquoise', 'Framboise', 'Gris', 'Noir'],
    pieces: [
      { id: 'entree', nom: 'Entrée' },
      { id: 'salon', nom: 'Salon' },
      { id: 'cuisine', nom: 'Cuisine' },
      { id: 'sdb', nom: 'Salle de bains' },
      { id: 'ch1', nom: 'Chambre 1' },
      { id: 'ch2', nom: 'Chambre 2' },
      { id: 'bureau', nom: 'Bureau' },
      { id: 'cave', nom: 'Cave ou garage' },
    ],
    autresPieces: ['Salle à manger', 'Chambre 3', 'Chambre d\'enfant', 'Buanderie', 'Grenier', 'Balcon ou jardin', 'Dressing', 'Toilettes'],

    statutsCarton: [
      { id: 'remplir', nom: 'À remplir', court: 'À remplir' },
      { id: 'ferme', nom: 'Fermé, prêt à partir', court: 'Fermé' },
      { id: 'arrive', nom: 'Arrivé au nouveau logement', court: 'Arrivé' },
      { id: 'deballe', nom: 'Déballé', court: 'Déballé' },
    ],

    // Volume d'un carton standard de 55 × 35 × 30 cm (calcul : 0,058 m³, arrondi).
    volumeCarton: 0.06,
    margeVolume: 10,
    // Meubles et appareils courants, volume indicatif en m³ (ordres de grandeur, hypothèses QME).
    meubles: [
      { id: 'canape3', g: 'Salon', nom: 'Canapé 3 places', v: 2.5 },
      { id: 'canape2', g: 'Salon', nom: 'Canapé 2 places', v: 1.8 },
      { id: 'fauteuil', g: 'Salon', nom: 'Fauteuil', v: 0.8 },
      { id: 'tablebasse', g: 'Salon', nom: 'Table basse', v: 0.3 },
      { id: 'meubletv', g: 'Salon', nom: 'Meuble TV', v: 0.6 },
      { id: 'tele', g: 'Salon', nom: 'Télévision', v: 0.2 },
      { id: 'biblio', g: 'Salon', nom: 'Bibliothèque', v: 1.2 },
      { id: 'buffet', g: 'Salon', nom: 'Buffet ou vaisselier', v: 1.5 },
      { id: 'table6', g: 'Salon', nom: 'Table de salle à manger', v: 1.0 },
      { id: 'chaise', g: 'Salon', nom: 'Chaise', v: 0.3 },
      { id: 'piano', g: 'Salon', nom: 'Piano droit', v: 1.5 },
      { id: 'litdouble', g: 'Chambres', nom: 'Lit double avec sommier', v: 2.0 },
      { id: 'litsimple', g: 'Chambres', nom: 'Lit simple avec sommier', v: 1.2 },
      { id: 'litbebe', g: 'Chambres', nom: 'Lit de bébé', v: 0.6 },
      { id: 'armoire2', g: 'Chambres', nom: 'Armoire 2 portes', v: 1.8 },
      { id: 'armoire3', g: 'Chambres', nom: 'Armoire 3 portes', v: 2.5 },
      { id: 'commode', g: 'Chambres', nom: 'Commode', v: 0.8 },
      { id: 'chevet', g: 'Chambres', nom: 'Table de chevet', v: 0.2 },
      { id: 'bureau', g: 'Chambres', nom: 'Bureau', v: 0.8 },
      { id: 'chaisebureau', g: 'Chambres', nom: 'Chaise de bureau', v: 0.3 },
      { id: 'frigo', g: 'Cuisine', nom: 'Réfrigérateur', v: 0.9 },
      { id: 'congel', g: 'Cuisine', nom: 'Congélateur', v: 0.6 },
      { id: 'lavelinge', g: 'Cuisine', nom: 'Lave-linge', v: 0.5 },
      { id: 'lavevaisselle', g: 'Cuisine', nom: 'Lave-vaisselle', v: 0.5 },
      { id: 'secheling', g: 'Cuisine', nom: 'Sèche-linge', v: 0.5 },
      { id: 'cuisiniere', g: 'Cuisine', nom: 'Cuisinière ou four', v: 0.5 },
      { id: 'microondes', g: 'Cuisine', nom: 'Micro-ondes', v: 0.1 },
      { id: 'tablecuisine', g: 'Cuisine', nom: 'Table de cuisine', v: 0.6 },
      { id: 'velo', g: 'Extérieur et garage', nom: 'Vélo', v: 0.5 },
      { id: 'poussette', g: 'Extérieur et garage', nom: 'Poussette', v: 0.4 },
      { id: 'tablejardin', g: 'Extérieur et garage', nom: 'Table de jardin', v: 0.8 },
      { id: 'chaisejardin', g: 'Extérieur et garage', nom: 'Chaise de jardin', v: 0.15 },
      { id: 'tondeuse', g: 'Extérieur et garage', nom: 'Tondeuse', v: 0.5 },
      { id: 'barbecue', g: 'Extérieur et garage', nom: 'Barbecue', v: 0.4 },
      { id: 'etabli', g: 'Extérieur et garage', nom: 'Établi ou étagère de garage', v: 1.0 },
      { id: 'miroir', g: 'Divers', nom: 'Miroir ou tableau', v: 0.1 },
      { id: 'tapis', g: 'Divers', nom: 'Tapis roulé', v: 0.2 },
      { id: 'lampadaire', g: 'Divers', nom: 'Lampadaire', v: 0.1 },
      { id: 'valise', g: 'Divers', nom: 'Valise', v: 0.15 },
    ],

    // Postes de budget proposés.
    postes: [
      { id: 'demenageur', nom: 'Déménageur' },
      { id: 'utilitaire', nom: 'Utilitaire et carburant' },
      { id: 'cartons', nom: 'Cartons et fournitures' },
      { id: 'garde', nom: 'Garde-meubles' },
      { id: 'menage', nom: 'Ménage de l\'ancien logement' },
      { id: 'reparations', nom: 'Petites réparations' },
      { id: 'double', nom: 'Double loyer ou chevauchement' },
      { id: 'frais', nom: 'Frais d\'agence et de dossier' },
      { id: 'courrier', nom: 'Réexpédition du courrier' },
      { id: 'contrats', nom: 'Mise en service des contrats' },
      { id: 'mobilier', nom: 'Mobilier et équipement' },
      { id: 'aide', nom: 'Repas et remerciements' },
      { id: 'autre', nom: 'Divers' },
    ],

    // Devis de déménageurs : formules et prestations à comparer.
    formules: [
      { id: 'economique', nom: 'Économique', desc: 'Tu emballes, le déménageur transporte.' },
      { id: 'standard', nom: 'Standard', desc: 'Fragile emballé et meubles démontés par le déménageur.' },
      { id: 'confort', nom: 'Confort', desc: 'Le déménageur emballe et déballe presque tout.' },
      { id: 'autre', nom: 'Autre', desc: '' },
    ],
    prestations: [
      { id: 'cartons', nom: 'Cartons fournis' },
      { id: 'fragile', nom: 'Emballage du fragile' },
      { id: 'emballage', nom: 'Emballage de tout' },
      { id: 'demontage', nom: 'Démontage et remontage' },
      { id: 'deballage', nom: 'Déballage' },
      { id: 'montemeuble', nom: 'Monte-meuble' },
      { id: 'stationnement', nom: 'Démarches de stationnement' },
      { id: 'assurance', nom: 'Garantie selon valeur déclarée' },
    ],

    conseils: [
      ['Une date, tout se cale', 'Chaque tâche a une échéance relative au jour J. Si la date change, tout le rétroplanning suit.'],
      ['Un numéro par carton', 'Note la pièce et le contenu : « dans quel carton est la perceuse ? » trouve la réponse en une recherche.'],
      ['Des devis comparables', 'Même volume, mêmes prestations : le prix au m³ et ce qui est inclus se lisent côte à côte.'],
    ],
    avertissement: 'Outil d\'aide à l\'organisation. Les démarches listées sont des repères généraux, sans délai légal : ton bail, tes contrats et service-public.fr font foi.',
  };
})();
