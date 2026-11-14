// Base intégrée du dossier sinistre habitation : types de sinistre, pièces, biens courants, justificatifs,
// mesures conservatoires, étapes de suivi, modèles de courriers, délais indicatifs et sources officielles.
// Aucune logique ici (voir regles.js). Les délais sont des repères datés : le contrat de l'assuré prime.
window.BASE = {
  alerteDefaut: 7, // jours avant une échéance pour la signaler « bientôt »

  // Types de sinistre. delai : code du délai de déclaration (voir delais) ; justificatifs et mesures :
  // codes des listes plus bas, dans l'ordre d'affichage.
  types: [
    { code: 'eau', nom: 'Dégât des eaux', court: 'Dégât des eaux', couleur: '#2E5A88', delai: 'declaration',
      description: 'Fuite, débordement, infiltration, rupture de canalisation, chez toi ou venant d\'un voisin.',
      justificatifs: ['photos', 'factures', 'devis', 'constat-eau', 'recherche-fuite', 'courrier-syndic', 'liste-biens', 'rib'],
      mesures: ['couper-eau', 'couper-electricite', 'prevenir-voisin', 'prevenir-syndic', 'aerer', 'photos-avant', 'garder-biens', 'mettre-abri'] },
    { code: 'incendie', nom: 'Incendie ou explosion', court: 'Incendie', couleur: '#B84A34', delai: 'declaration',
      description: 'Feu, fumée, explosion, foudre, dommages électriques liés.',
      justificatifs: ['photos', 'factures', 'devis', 'rapport-pompiers', 'liste-biens', 'rib'],
      mesures: ['securite', 'couper-electricite', 'couper-gaz', 'photos-avant', 'garder-biens', 'securiser-acces', 'relogement'] },
    { code: 'climat', nom: 'Événement climatique', court: 'Climatique', couleur: '#E8B93A', delai: 'declaration', catnat: true,
      description: 'Tempête, grêle, poids de la neige, inondation, sécheresse ou autre catastrophe naturelle.',
      justificatifs: ['photos', 'factures', 'devis', 'arrete-catnat', 'bulletin-meteo', 'liste-biens', 'rib'],
      mesures: ['securite', 'bacher', 'couper-electricite', 'photos-avant', 'garder-biens', 'mettre-abri', 'aerer'] },
    { code: 'vol', nom: 'Cambriolage ou vandalisme', court: 'Cambriolage', couleur: '#24221F', delai: 'vol',
      description: 'Vol avec effraction, tentative, dégradations volontaires.',
      justificatifs: ['photos', 'plainte', 'factures', 'liste-biens', 'devis', 'opposition', 'rib'],
      mesures: ['ne-pas-toucher', 'plainte', 'opposition-moyens', 'securiser-acces', 'photos-avant', 'liste-vol'] },
    { code: 'glace', nom: 'Bris de glace', court: 'Bris de glace', couleur: '#6E685F', delai: 'declaration',
      description: 'Vitre, baie, miroir, plaque de cuisson vitrocéramique, vitrage de véranda.',
      justificatifs: ['photos', 'factures', 'devis', 'rib'],
      mesures: ['securite', 'securiser-acces', 'photos-avant', 'garder-biens'] },
    { code: 'autre', nom: 'Autre dommage matériel', court: 'Autre', couleur: '#8A7A5C', delai: 'declaration',
      description: 'Choc d\'un véhicule, chute d\'arbre, dommage électrique, autre événement.',
      justificatifs: ['photos', 'factures', 'devis', 'liste-biens', 'rib'],
      mesures: ['securite', 'photos-avant', 'garder-biens', 'mettre-abri'] },
  ],

  // Questions du parcours propres à certains types (ajoutées à l'assistant).
  sousTypesClimat: ['Tempête', 'Grêle', 'Poids de la neige', 'Inondation', 'Sécheresse (fissures)', 'Autre catastrophe naturelle'],
  tiers: ['Voisin', 'Syndic ou copropriété', 'Bailleur', 'Locataire', 'Entreprise', 'Auteur inconnu'],

  pieces: ['Entrée', 'Séjour', 'Salle à manger', 'Cuisine', 'Chambre', 'Chambre d\'enfant', 'Bureau', 'Salle de bain', 'WC',
    'Buanderie', 'Couloir', 'Cave', 'Garage', 'Grenier ou combles', 'Véranda', 'Balcon ou terrasse', 'Jardin', 'Toiture', 'Façade', 'Parties communes'],

  // Bibliothèque de biens courants : catégorie → biens. glace : proposé pour un bris de glace.
  categories: [
    { code: 'mobilier', nom: 'Mobilier', biens: ['Canapé', 'Fauteuil', 'Table', 'Chaises', 'Lit et sommier', 'Matelas', 'Armoire', 'Commode', 'Bibliothèque', 'Meuble TV', 'Bureau', 'Buffet', 'Meubles de cuisine', 'Meuble de salle de bain'] },
    { code: 'electromenager', nom: 'Électroménager', biens: ['Réfrigérateur', 'Congélateur', 'Lave-linge', 'Sèche-linge', 'Lave-vaisselle', 'Four', 'Plaque de cuisson', 'Micro-ondes', 'Hotte', 'Aspirateur', 'Petit électroménager'] },
    { code: 'informatique', nom: 'Informatique', biens: ['Ordinateur portable', 'Ordinateur fixe', 'Écran', 'Tablette', 'Imprimante', 'Box internet', 'Disque dur', 'Clavier et souris'] },
    { code: 'electronique', nom: 'Équipements électroniques', biens: ['Téléviseur', 'Barre de son', 'Enceinte', 'Console de jeux', 'Appareil photo', 'Téléphone', 'Montre connectée', 'Vidéoprojecteur'] },
    { code: 'vetements', nom: 'Vêtements et linge', biens: ['Vêtements', 'Chaussures', 'Manteaux', 'Linge de maison', 'Literie (couette, oreillers)', 'Sacs et bagagerie'] },
    { code: 'decoration', nom: 'Décoration et objets', biens: ['Tapis', 'Rideaux et voilages', 'Luminaires', 'Tableaux et cadres', 'Miroir', 'Livres', 'Vaisselle', 'Jouets', 'Plantes et pots'] },
    { code: 'revetements', nom: 'Revêtements', biens: ['Parquet', 'Stratifié', 'Moquette', 'Carrelage', 'Sol souple (PVC, lino)', 'Peinture murale', 'Papier peint', 'Faïence', 'Plafond', 'Doublage ou plâtre'] },
    { code: 'menuiseries', nom: 'Menuiseries et vitrages', biens: ['Porte d\'entrée', 'Porte intérieure', 'Fenêtre', 'Baie vitrée', 'Volet', 'Porte de garage', 'Serrure', 'Vitrage', 'Velux'], glace: ['Vitrage', 'Fenêtre', 'Baie vitrée', 'Velux'] },
    { code: 'technique', nom: 'Équipements techniques', biens: ['Chaudière', 'Ballon d\'eau chaude', 'Radiateur', 'Climatisation', 'Tableau électrique', 'Prises et interrupteurs', 'VMC', 'Pompe à chaleur', 'Alarme', 'Canalisation'] },
    { code: 'exterieur', nom: 'Extérieur et bâti', biens: ['Toiture et tuiles', 'Gouttière', 'Clôture ou portail', 'Abri de jardin', 'Mobilier de jardin', 'Store ou pergola', 'Façade', 'Arbre ou haie'] },
  ],
  // Biens proposés pour un bris de glace (désignation, catégorie).
  biensGlace: [['Vitrage', 'menuiseries'], ['Baie vitrée', 'menuiseries'], ['Fenêtre', 'menuiseries'], ['Velux', 'menuiseries'], ['Miroir', 'decoration'], ['Plaque de cuisson', 'electromenager'], ['Paroi de douche', 'technique']],

  etats: ['Neuf', 'Très bon', 'Bon', 'Usagé', 'Abîmé', 'Détruit', 'Disparu'],
  reparabilite: [['inconnu', 'À déterminer'], ['oui', 'Réparable'], ['non', 'Irréparable'], ['disparu', 'Disparu ou volé']],

  // Justificatifs utiles (liste générée « à fournir » à la création du dossier, modifiable).
  justificatifs: {
    photos: { nom: 'Photos des dommages', type: 'photo', aide: 'Vue d\'ensemble puis détails, avant tout nettoyage ou réparation.' },
    factures: { nom: 'Factures d\'achat des biens', type: 'facture', aide: 'À défaut : relevé bancaire, photo du bien, notice, garantie, témoignage.' },
    devis: { nom: 'Devis de réparation ou de remplacement', type: 'devis', aide: 'Un devis par entreprise et par poste.' },
    'constat-eau': { nom: 'Constat amiable de dégât des eaux', type: 'rapport', aide: 'Rempli avec le voisin, le syndic ou le bailleur concerné.' },
    'recherche-fuite': { nom: 'Rapport de recherche de fuite', type: 'rapport', aide: 'Si l\'origine de la fuite n\'est pas visible.' },
    'courrier-syndic': { nom: 'Échanges avec le syndic ou le bailleur', type: 'courrier', aide: 'Quand la fuite vient des parties communes ou d\'un autre logement.' },
    'rapport-pompiers': { nom: 'Rapport ou attestation d\'intervention des pompiers', type: 'rapport', aide: 'À demander au service départemental d\'incendie et de secours.' },
    'arrete-catnat': { nom: 'Référence de l\'arrêté de catastrophe naturelle', type: 'capture', aide: 'Date de publication au Journal officiel et commune concernée.' },
    'bulletin-meteo': { nom: 'Relevé ou article sur l\'événement climatique', type: 'capture', aide: 'Utile pour une tempête ou de la grêle.' },
    plainte: { nom: 'Récépissé du dépôt de plainte', type: 'rapport', aide: 'Commissariat ou gendarmerie.' },
    opposition: { nom: 'Attestations d\'opposition (cartes, chéquiers)', type: 'courrier', aide: 'Si des moyens de paiement ont été volés.' },
    'liste-biens': { nom: 'État des pertes (liste chiffrée des biens)', type: 'autre', aide: 'Généré par l\'onglet Dommages, à imprimer.' },
    rib: { nom: 'Relevé d\'identité bancaire', type: 'autre', aide: 'Demandé pour le versement : ne le saisis pas ici, joins-le seulement à ton envoi.' },
  },

  typesPreuve: [['photo', 'Photographie'], ['facture', 'Facture'], ['devis', 'Devis'], ['rapport', 'Rapport'], ['courrier', 'Courrier'], ['capture', 'Capture de document'], ['autre', 'Autre justificatif']],
  statutsPreuve: [['a-fournir', 'À fournir'], ['recu', 'Reçu'], ['verifie', 'Vérifié par moi'], ['manquant', 'Manquant'], ['refuse', 'Refusé']],

  // Mesures conservatoires à examiner (pratiques, pas des obligations listées par la loi ; le contrat peut en prévoir).
  mesures: {
    securite: 'Mettre les personnes en sécurité ; appeler les secours si nécessaire (18 ou 112).',
    'couper-eau': 'Couper l\'arrivée d\'eau au compteur ou à la vanne.',
    'couper-electricite': 'Couper l\'électricité des pièces touchées avant d\'y intervenir.',
    'couper-gaz': 'Couper le gaz et ne rien allumer en cas d\'odeur.',
    'prevenir-voisin': 'Prévenir le voisin du dessus ou du dessous.',
    'prevenir-syndic': 'Prévenir le syndic ou le bailleur si les parties communes ou un autre logement sont en cause.',
    aerer: 'Aérer et faire sécher les pièces ; éloigner les biens mouillés des murs.',
    bacher: 'Faire bâcher la toiture ou les ouvertures endommagées.',
    'photos-avant': 'Photographier les dommages avant tout nettoyage, rangement ou réparation.',
    'garder-biens': 'Garder les biens endommagés (ou leurs photos) jusqu\'au passage de l\'expert : ne rien jeter sans accord.',
    'mettre-abri': 'Mettre à l\'abri les biens encore intacts.',
    'securiser-acces': 'Faire sécuriser les accès (serrurier, vitrier, panneau provisoire) et garder la facture.',
    relogement: 'Si le logement est inhabitable : demander à l\'assureur si le contrat couvre un relogement.',
    'ne-pas-toucher': 'Ne rien toucher ni ranger avant le passage des enquêteurs s\'ils viennent.',
    plainte: 'Déposer plainte au commissariat ou à la gendarmerie.',
    'opposition-moyens': 'Faire opposition sur les cartes et chéquiers volés ; signaler le vol des papiers d\'identité.',
    'liste-vol': 'Dresser la liste des objets volés, avec leur valeur, pour la plainte et l\'assureur.',
  },

  // Étapes de suivi (chronologie). etape : rang dans la progression du dossier ; statut : statut atteint.
  evenements: [
    { code: 'decouverte', nom: 'Découverte du sinistre', etape: 1, statut: 'a-declarer' },
    { code: 'mesures', nom: 'Mesures conservatoires', etape: 1, statut: 'a-declarer' },
    { code: 'declaration', nom: 'Déclaration à l\'assureur', etape: 2, statut: 'declare' },
    { code: 'accuse', nom: 'Accusé de réception de l\'assureur', etape: 2, statut: 'declare' },
    { code: 'expertise', nom: 'Expertise', etape: 3, statut: 'expertise' },
    { code: 'devis', nom: 'Réception des devis', etape: 3, statut: 'expertise' },
    { code: 'proposition', nom: 'Proposition d\'indemnisation', etape: 4, statut: 'proposition' },
    { code: 'acceptation', nom: 'Acceptation de la proposition', etape: 5, statut: 'accepte' },
    { code: 'contestation', nom: 'Contestation de la proposition', etape: 5, statut: 'conteste' },
    { code: 'versement', nom: 'Versement d\'une indemnité', etape: 5, statut: 'accepte' },
    { code: 'reparation', nom: 'Réparation ou remplacement', etape: 6, statut: 'reparation' },
    { code: 'cloture', nom: 'Clôture du dossier', etape: 7, statut: 'clos' },
    { code: 'autre', nom: 'Autre événement', etape: 0, statut: null },
  ],
  statuts: [
    ['a-declarer', 'À déclarer', 'rouge'], ['declare', 'Déclaré', 'bleu'], ['expertise', 'Expertise', 'bleu'],
    ['proposition', 'Proposition reçue', 'jaune'], ['accepte', 'Accepté', 'vert'], ['conteste', 'Contesté', 'rouge'],
    ['reparation', 'En réparation', 'vert'], ['clos', 'Clos', 'gris'],
  ],
  etapes: ['Découverte', 'Déclaration', 'Expertise', 'Proposition', 'Accord', 'Réparation', 'Clôture'],

  // Délais indicatifs (loi). Vérifiés le 13/11/2026 sur Légifrance. Le contrat peut prévoir plus long
  // pour déclarer ; l'outil ne présente jamais ces délais comme ceux du contrat de l'assuré.
  // unite : 'ouvres' (lundi à vendredi hors jours fériés) ou 'jours' (calendaires) ; mois pour la prescription.
  delais: {
    declaration: { libelle: 'Déclarer le sinistre', jours: 5, unite: 'ouvres', source: 'l113-2',
      resume: 'Dès que tu as connaissance du sinistre, au plus tard dans le délai de ton contrat, qui ne peut pas être inférieur à 5 jours ouvrés (calcul depuis la découverte).' },
    vol: { libelle: 'Déclarer le vol', jours: 2, unite: 'ouvres', source: 'l113-2',
      resume: 'Pour un vol, le délai minimal légal est ramené à 2 jours ouvrés après en avoir eu connaissance ; ton contrat peut prévoir plus long.' },
    catnat: { libelle: 'Déclarer la catastrophe naturelle', jours: 30, unite: 'jours', source: 'l125-2',
      resume: 'Dès que tu as connaissance du sinistre, au plus tard 30 jours après la publication de l\'arrêté de catastrophe naturelle au Journal officiel.' },
    prescription: { libelle: 'Prescription pour agir contre l\'assureur', mois: 24, source: 'l114-1',
      resume: 'Les actions liées au contrat se prescrivent par 2 ans à compter de l\'événement (ou du jour où tu en as eu connaissance). Un recommandé avec accusé de réception ou la désignation d\'un expert interrompt ce délai.' },
    prescriptionSecheresse: { libelle: 'Prescription (sécheresse, catastrophe naturelle)', mois: 60, source: 'l114-1',
      resume: 'Pour les dommages de sécheresse-réhydratation des sols reconnus en catastrophe naturelle, le délai est de 5 ans.' },
  },

  // Repères généraux, chacun avec sa source. Aucun n'est un conseil juridique.
  reperes: [
    { texte: 'Déclaration tardive : la perte de garantie n\'est possible que si le contrat le prévoit et si l\'assureur prouve que le retard lui a causé un préjudice ; jamais en cas de force majeure.', source: 'l113-2' },
    { texte: 'Tempête : la garantie des effets du vent est obligatoirement incluse dans les contrats couvrant l\'incendie. La grêle, le poids de la neige et le bris de glace dépendent de ton contrat.', source: 'l122-7' },
    { texte: 'Catastrophe naturelle : franchise légale de 380 € par événement pour une habitation (1 520 € pour les dommages liés à la sécheresse).', source: 'a125-6' },
    { texte: 'Catastrophe naturelle : l\'assureur a 1 mois pour t\'informer des modalités de la garantie, 2 mois pour verser une provision et 1 mois pour proposer une indemnisation après l\'état estimatif ou le rapport d\'expertise ; puis 21 jours pour payer après ton accord.', source: 'l125-2' },
    { texte: 'Dégât des eaux : le constat amiable n\'est pas obligatoire mais facilite le règlement. Entre assureurs, la convention IRSI répartit la gestion selon le montant (jusqu\'à 1 600 € HT, puis jusqu\'à 5 000 € HT) : c\'est une convention privée, pas une loi.', source: 'sp-f2027' },
    { texte: 'Dégât des eaux : coupe l\'eau, fais réparer la fuite en urgence, mais attends l\'évaluation avant les travaux de remise en état.', source: 'sp-f1352' },
    { texte: 'Vol : ne touche à rien avant le passage des forces de l\'ordre, photographie les traces d\'effraction, porte plainte, fais opposition sur les moyens de paiement.', source: 'sp-f1523' },
    { texte: 'Mesures pour limiter les dommages : elles sont en général prévues par les conditions générales du contrat, pas par un article de loi propre à l\'habitation.', source: 'cass-2013' },
    { texte: 'Désaccord avec l\'expert : tu peux te faire assister par ton propre expert (honoraires à ta charge sauf garantie du contrat) ; en cas de désaccord persistant, une tierce expertise est possible.', source: 'sp-f3075' },
    { texte: 'Litige : écris d\'abord au service réclamation de l\'assureur, puis saisis gratuitement La Médiation de l\'Assurance si la réponse ne te convient pas.', source: 'sp-f3050' },
  ],

  // Sources officielles consultées (date de vérification affichée dans l'application).
  sources: [
    { id: 'l113-2', titre: 'Code des assurances, article L113-2 (obligations de l\'assuré, délai de déclaration)', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000035731302', nature: 'Texte de loi (version en vigueur depuis le 01/04/2018)', fiabilite: 'élevée', verifie: '13/11/2026',
      points: ['Déclaration dès connaissance du sinistre, au plus tard dans le délai du contrat.', 'Délai minimal : 5 jours ouvrés ; 2 jours ouvrés en cas de vol.', 'Déchéance pour retard seulement si le contrat la prévoit et si l\'assureur prouve un préjudice ; jamais en cas de force majeure.'] },
    { id: 'l114-1', titre: 'Code des assurances, article L114-1 (prescription)', url: 'https://www.legifrance.gouv.fr/affichCodeArticle.do?cidTexte=LEGITEXT000006073984&idArticle=LEGIARTI000006792197', nature: 'Texte de loi (version en vigueur depuis le 30/12/2021)', fiabilite: 'élevée', verifie: '13/11/2026',
      points: ['2 ans à compter de l\'événement qui donne naissance à l\'action ; en cas de sinistre, à partir du jour où l\'assuré en a eu connaissance s\'il prouve l\'avoir ignoré.', '5 ans pour les dommages de sécheresse-réhydratation des sols reconnus en catastrophe naturelle.'] },
    { id: 'l114-2', titre: 'Code des assurances, article L114-2 (interruption de la prescription)', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000035731305', nature: 'Texte de loi', fiabilite: 'élevée', verifie: '13/11/2026',
      points: ['Interruption par la désignation d\'experts après un sinistre.', 'Interruption par une lettre recommandée ou un envoi recommandé électronique avec accusé de réception adressé à l\'assureur pour le règlement de l\'indemnité.'] },
    { id: 'l122-7', titre: 'Code des assurances, article L122-7 (tempêtes)', url: 'https://legifrance.gouv.fr/affichCodeArticle.do?cidTexte=LEGITEXT000006073984&idArticle=LEGIARTI000006792530', nature: 'Texte de loi (version en vigueur depuis le 04/03/2022)', fiabilite: 'élevée', verifie: '13/11/2026',
      points: ['Les contrats garantissant l\'incendie couvrent les effets du vent dû aux tempêtes, ouragans et cyclones.', 'Franchises, plafonds et vétusté peuvent différer de la garantie incendie.'] },
    { id: 'l125-2', titre: 'Code des assurances, article L125-2 (catastrophes naturelles)', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047109081', nature: 'Texte de loi (version en vigueur depuis le 28/05/2026)', fiabilite: 'élevée', verifie: '13/11/2026',
      points: ['Déclaration au plus tard 30 jours après la publication de l\'arrêté de reconnaissance.', 'Assureur : 1 mois pour informer, provision sous 2 mois, proposition 1 mois après l\'état estimatif ou le rapport, paiement 21 jours après accord.', 'La fiche Service-Public sur ce sujet mentionnait encore un délai de 3 mois (ancienne règle) : le texte de loi fait foi.'] },
    { id: 'a125-6', titre: 'Code des assurances, article A125-6 (franchises des catastrophes naturelles)', url: 'https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006073984/LEGISCTA000046884155', nature: 'Arrêté (en vigueur depuis le 01/01/2024)', fiabilite: 'élevée', verifie: '13/11/2026',
      points: ['Habitation : 380 € par événement ; 1 520 € pour la sécheresse-réhydratation des sols.'] },
    { id: 'sp-f1352', titre: 'Service-Public.fr : assurance dégâts des eaux', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1352', nature: 'Page officielle', fiabilite: 'élevée', verifie: '13/11/2026',
      points: ['Couper l\'eau, réparer la fuite en urgence, pas de travaux de remise en état avant l\'évaluation.', 'Constat amiable non obligatoire.'] },
    { id: 'sp-f2027', titre: 'Service-Public.fr : convention IRSI (dégât des eaux en immeuble)', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2027', nature: 'Page officielle décrivant une convention privée entre assureurs', fiabilite: 'moyenne (convention, pas une loi)', verifie: '13/11/2026',
      points: ['Jusqu\'à 1 600 € HT : l\'assureur gestionnaire indemnise sans recours.', 'De 1 600 € à 5 000 € HT : indemnisation avec recours possibles.', 'Au-delà de 5 000 € HT : la convention ne s\'applique pas.'] },
    { id: 'sp-f2028', titre: 'Service-Public.fr : assurance habitation et vol', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2028', nature: 'Page officielle', fiabilite: 'élevée', verifie: '13/11/2026',
      points: ['Délai minimal de 2 jours ouvrés.', 'Justificatifs : récépissé de plainte, photos des effractions, factures, photos antérieures des biens, devis.'] },
    { id: 'sp-f1523', titre: 'Service-Public.fr : vol, cambriolage', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1523', nature: 'Page officielle', fiabilite: 'élevée', verifie: '13/11/2026',
      points: ['Ne rien toucher avant la police ou la gendarmerie, photographier les traces d\'effraction.', 'Porter plainte, faire opposition, prévenir l\'assureur.'] },
    { id: 'sp-f3075', titre: 'Service-Public.fr : contester une expertise d\'assurance', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F3075', nature: 'Page officielle', fiabilite: 'élevée', verifie: '13/11/2026',
      points: ['Expert de l\'assuré possible, honoraires à sa charge sauf garantie du contrat.', 'Tierce expertise en cas de désaccord persistant.'] },
    { id: 'sp-f3050', titre: 'Service-Public.fr : litige avec un assureur (réclamation, médiation)', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F3050', nature: 'Page officielle', fiabilite: 'élevée', verifie: '13/11/2026',
      points: ['Réclamation écrite au service réclamation d\'abord.', 'Puis médiation de l\'assurance, gratuite pour le consommateur.'] },
    { id: 'cass-2013', titre: 'Cour de cassation, 2e chambre civile, 12/12/2013, n° 12-29.862', url: 'https://www.legifrance.gouv.fr/juri/id/JURITEXT000028327074/', nature: 'Jurisprudence', fiabilite: 'moyenne (cas d\'espèce)', verifie: '13/11/2026',
      points: ['L\'obligation de limiter les dommages (ici bâcher) venait des conditions générales du contrat.'] },
  ],

  // Modèles de courriers : {{champ}} est remplacé par la donnée du dossier, [à compléter] reste à écrire.
  courriers: [
    { code: 'declaration', nom: 'Déclaration de sinistre', pour: null,
      objet: 'Déclaration de sinistre · contrat {{contrat}}',
      pieces: ['Photos des dommages', 'Premier état des pertes', 'Récépissé de plainte (vol)', 'Constat amiable (dégât des eaux)'],
      texte: 'Madame, Monsieur,\n\nJe vous déclare un sinistre survenu le {{survenu}} (constaté le {{decouvert}}) à mon domicile : {{lieu}}.\n\nNature du sinistre : {{type}}.\nPièces touchées : {{pieces}}.\nCirconstances : {{circonstances}}\n\nMesures déjà prises : {{mesures}}.\n\nJe vous adresse un premier état des dommages, estimé à {{estime}}, que je compléterai dès que possible. Je reste à la disposition de votre expert.\n\nMerci de m\'indiquer la suite donnée à cette déclaration et le numéro de dossier attribué.\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n[Nom, prénom]\n[Adresse]' },
    { code: 'etat-pertes', nom: 'Envoi de l\'état des pertes', pour: null,
      objet: 'Sinistre du {{survenu}} · dossier {{numero}} · état des pertes',
      pieces: ['État des pertes détaillé', 'Factures ou justificatifs de valeur', 'Devis', 'Photos'],
      texte: 'Madame, Monsieur,\n\nÀ la suite de ma déclaration du {{declareLe}}, je vous adresse l\'état détaillé des dommages : {{nbDommages}}, pour un montant estimé à {{estime}}.\n\nVous trouverez ci-joint les justificatifs dont je dispose. [Précise les pièces manquantes et quand tu pourras les fournir.]\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n[Nom, prénom]' },
    { code: 'relance', nom: 'Relance de l\'assureur', pour: null,
      objet: 'Sinistre du {{survenu}} · dossier {{numero}} · demande de suivi',
      pieces: [],
      texte: 'Madame, Monsieur,\n\nJ\'ai déclaré le {{declareLe}} un sinistre survenu le {{survenu}} (dossier {{numero}}). Sauf erreur de ma part, je n\'ai pas reçu de réponse depuis [date du dernier échange].\n\nMerci de m\'indiquer où en est l\'instruction de mon dossier et, le cas échéant, les pièces qui vous manquent.\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n[Nom, prénom]' },
    { code: 'contestation', nom: 'Contestation de la proposition', pour: null,
      objet: 'Sinistre du {{survenu}} · dossier {{numero}} · contestation de la proposition d\'indemnisation',
      pieces: ['Devis et factures complémentaires', 'Photos', 'Tout élément sur la valeur des biens'],
      texte: 'Madame, Monsieur,\n\nJ\'ai bien reçu votre proposition d\'indemnisation de {{reconnu}} pour le sinistre du {{survenu}}. Je ne peux pas l\'accepter en l\'état, pour les raisons suivantes :\n\n- [raison 1 : bien non retenu, valeur sous-estimée, vétusté appliquée…]\n- [raison 2]\n\nMon estimation s\'élève à {{estime}} ; je joins les justificatifs correspondants. Je vous remercie de réexaminer mon dossier [ou : de faire procéder à une nouvelle expertise].\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n[Nom, prénom]' },
    { code: 'syndic', nom: 'Information du syndic ou du bailleur', pour: 'eau',
      objet: 'Dégât des eaux du {{survenu}} · {{lieu}}',
      pieces: ['Photos', 'Constat amiable de dégât des eaux'],
      texte: 'Madame, Monsieur,\n\nJe vous informe d\'un dégât des eaux constaté le {{decouvert}} dans mon logement ({{lieu}}), pièces touchées : {{pieces}}. L\'origine semble être [origine supposée].\n\nJe vous remercie de faire le nécessaire pour [rechercher la fuite / intervenir sur les parties communes] et de m\'indiquer les coordonnées de votre assureur pour établir le constat amiable.\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n[Nom, prénom]' },
  ],
};
