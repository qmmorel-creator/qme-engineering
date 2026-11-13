// Base intégrée de l'organisateur de mariage (aucune logique ici).
// Rétroplanning, postes, checklist : rédigés pour le template. Délais = suggestions d'organisation.
// Seules règles officielles citées : service-public.gouv.fr, fiche F930 (voir SOURCE_DEMARCHES).
window.BASE = {
  // Catégories de tâches : couleur fixe dans l'ordre, jamais générée.
  categories: [
    { id: 'lieu', nom: 'Lieu et date', couleur: '#D9302A', texte: '#fff' },
    { id: 'prestataires', nom: 'Prestataires', couleur: '#1D4E89', texte: '#fff' },
    { id: 'invites', nom: 'Invités', couleur: '#F5B400', texte: '#141414' },
    { id: 'tenues', nom: 'Tenues', couleur: '#2E7D4F', texte: '#fff' },
    { id: 'demarches', nom: 'Démarches', couleur: '#141414', texte: '#F0EDE6' },
    { id: 'ceremonie', nom: 'Cérémonie', couleur: '#8A5A9E', texte: '#fff' },
    { id: 'reception', nom: 'Réception', couleur: '#C46A1B', texte: '#fff' },
    { id: 'jourj', nom: 'Jour J', couleur: '#5E5A52', texte: '#fff' },
  ],

  // Périodes du rétroplanning (jours avant le mariage, borne basse incluse).
  periodes: [
    { min: 270, nom: '12 à 9 mois avant' },
    { min: 180, nom: '9 à 6 mois avant' },
    { min: 90, nom: '6 à 3 mois avant' },
    { min: 30, nom: '3 à 1 mois avant' },
    { min: 7, nom: 'Le dernier mois' },
    { min: 1, nom: 'La dernière semaine' },
    { min: 0, nom: 'Le jour J' },
    { min: -Infinity, nom: 'Après le mariage' },
  ],

  // Rétroplanning type : « avant » = nombre de jours avant le mariage (suggestion, à adapter).
  taches: [
    { titre: 'Fixer le budget global et qui participe', categorie: 'lieu', avant: 360 },
    { titre: 'Estimer le nombre d\'invités (fourchette)', categorie: 'invites', avant: 355 },
    { titre: 'Choisir la saison et deux ou trois dates possibles', categorie: 'lieu', avant: 350 },
    { titre: 'Visiter des lieux de réception et demander les conditions', categorie: 'lieu', avant: 335 },
    { titre: 'Réserver le lieu de réception', categorie: 'lieu', avant: 320 },
    { titre: 'Choisir les témoins', categorie: 'ceremonie', avant: 310 },
    { titre: 'Demander des devis de traiteur et prévoir une dégustation', categorie: 'prestataires', avant: 300 },
    { titre: 'Réserver le photographe ou le vidéaste', categorie: 'prestataires', avant: 290 },
    { titre: 'Envoyer les « save the date »', categorie: 'invites', avant: 270 },
    { titre: 'Réserver le traiteur', categorie: 'prestataires', avant: 260 },
    { titre: 'Réserver la musique (DJ ou groupe)', categorie: 'prestataires', avant: 240 },
    { titre: 'Choisir la ou les tenues des mariés', categorie: 'tenues', avant: 220 },
    { titre: 'Prévoir l\'hébergement des invités venant de loin (liste d\'adresses)', categorie: 'invites', avant: 200 },
    { titre: 'Réserver le fleuriste', categorie: 'prestataires', avant: 180 },
    { titre: 'Contacter l\'officiant ou le lieu de la cérémonie non civile, s\'il y en a une', categorie: 'ceremonie', avant: 170 },
    { titre: 'Contacter la mairie : rendez-vous, liste des pièces et délais du dossier de mariage', categorie: 'demarches', avant: 160, note: 'Le dossier se dépose à la mairie de la commune choisie pour la cérémonie (service-public.gouv.fr, F930). Les délais de rendez-vous varient : demande-les à ta mairie.' },
    { titre: 'Choisir et commander les faire-part', categorie: 'invites', avant: 150 },
    { titre: 'Réserver coiffure et maquillage (essai compris)', categorie: 'prestataires', avant: 140 },
    { titre: 'Choisir les alliances', categorie: 'tenues', avant: 130 },
    { titre: 'Prévoir le transport des mariés et des invités', categorie: 'reception', avant: 120 },
    { titre: 'Envoyer les faire-part avec une date limite de réponse', categorie: 'invites', avant: 110 },
    { titre: 'Choisir le menu après la dégustation', categorie: 'reception', avant: 100 },
    { titre: 'Demander les actes de naissance pour le dossier', categorie: 'demarches', avant: 90, note: 'Extrait avec filiation de moins de 3 mois au jour du dépôt du dossier (6 mois s\'il est établi à l\'étranger) : service-public.gouv.fr, F930. Cale cette tâche sur ton rendez-vous en mairie.' },
    { titre: 'Déposer le dossier de mariage en mairie', categorie: 'demarches', avant: 75, note: 'Date à caler avec la mairie. Les bans sont ensuite publiés pendant 10 jours ; le mariage est possible à partir du 10e jour suivant la publication, puis dans l\'année (service-public.gouv.fr, F930).' },
    { titre: 'Préparer le déroulé de la cérémonie (textes, lectures, musiques)', categorie: 'ceremonie', avant: 70 },
    { titre: 'Choisir la décoration et la papeterie du jour (menus, marque-places)', categorie: 'reception', avant: 60 },
    { titre: 'Faire les essayages des tenues', categorie: 'tenues', avant: 50 },
    { titre: 'Relancer les invités qui n\'ont pas répondu', categorie: 'invites', avant: 40 },
    { titre: 'Arrêter la liste des invités et transmettre les régimes au traiteur', categorie: 'invites', avant: 30 },
    { titre: 'Faire le plan de table', categorie: 'reception', avant: 25 },
    { titre: 'Écrire le planning heure par heure du jour J', categorie: 'jourj', avant: 21 },
    { titre: 'Confirmer horaires et adresses avec chaque prestataire', categorie: 'prestataires', avant: 14 },
    { titre: 'Préparer les paiements du jour J (soldes, enveloppes)', categorie: 'prestataires', avant: 10 },
    { titre: 'Transmettre le nombre final de couverts au traiteur et au lieu', categorie: 'reception', avant: 8 },
    { titre: 'Confier le planning et les contacts des prestataires à un témoin', categorie: 'jourj', avant: 5 },
    { titre: 'Préparer le kit de secours et les tenues', categorie: 'jourj', avant: 2 },
    { titre: 'Profiter : la checklist du jour J prend le relais', categorie: 'jourj', avant: 0 },
    { titre: 'Rendre le matériel loué et récupérer les cautions', categorie: 'reception', avant: -3 },
    { titre: 'Remercier les invités et les prestataires', categorie: 'invites', avant: -20 },
    { titre: 'Effacer les allergies et régimes de la liste d\'invités', categorie: 'invites', avant: -30, note: 'Ce sont des données de santé : elles n\'ont plus d\'utilité après le mariage (Réglages → Effacer les régimes et allergies).' },
  ],

  // Postes de budget types : aucun montant proposé (aucun prix moyen non sourcé).
  postes: [
    'Lieu de réception', 'Traiteur et boissons', 'Pâtisserie et gâteau', 'Tenues et accessoires', 'Alliances',
    'Coiffure et maquillage', 'Photo et vidéo', 'Musique et animation', 'Fleurs et décoration',
    'Faire-part et papeterie', 'Cérémonie', 'Transport', 'Hébergement', 'Cadeaux des invités',
    'Voyage de noces', 'Imprévus',
  ],

  statuts: [
    { id: 'contacter', nom: 'À contacter', classe: '' },
    { id: 'devis', nom: 'Devis reçu', classe: 'jaune' },
    { id: 'reserve', nom: 'Réservé', classe: 'bleu' },
    { id: 'ecarte', nom: 'Écarté', classe: 'gris' },
  ],

  groupes: ['Famille de {1}', 'Famille de {2}', 'Amis communs', 'Amis de {1}', 'Amis de {2}', 'Collègues'],

  regimes: ['Sans restriction', 'Végétarien', 'Végétalien', 'Sans porc', 'Sans alcool', 'Menu enfant', 'Autre (préciser)'],

  reponses: [
    { id: 'attente', nom: 'En attente', classe: 'jaune' },
    { id: 'oui', nom: 'Oui', classe: 'bleu' },
    { id: 'non', nom: 'Non', classe: 'rouge' },
  ],

  // Checklist du jour J : heure facultative, à compléter par les mariés.
  jourJ: [
    { titre: 'Alliances confiées à un témoin', heure: '' },
    { titre: 'Pièces d\'identité des mariés', heure: '' },
    { titre: 'Tenues, chaussures et accessoires prêts', heure: '' },
    { titre: 'Kit de secours : épingles, pansements, fil, mouchoirs, antidouleur', heure: '' },
    { titre: 'Téléphone chargé et batterie de secours', heure: '' },
    { titre: 'Coiffure et maquillage', heure: '' },
    { titre: 'Photos des préparatifs', heure: '' },
    { titre: 'Départ vers la cérémonie', heure: '' },
    { titre: 'Cérémonie', heure: '' },
    { titre: 'Photos de groupe (liste des groupes prête)', heure: '' },
    { titre: 'Vin d\'honneur', heure: '' },
    { titre: 'Plan de table affiché à l\'entrée', heure: '' },
    { titre: 'Marque-places et menus en place', heure: '' },
    { titre: 'Enveloppes des paiements du jour remises', heure: '' },
    { titre: 'Discours et musiques transmis à l\'animateur', heure: '' },
    { titre: 'Dîner', heure: '' },
    { titre: 'Ouverture du bal', heure: '' },
    { titre: 'Retour des mariés et des invités organisé', heure: '' },
  ],

  sourceDemarches: {
    titre: 'Démarches du mariage civil',
    texte: 'Le dossier se dépose à la mairie de la commune choisie pour la cérémonie. Extrait d\'acte de naissance avec filiation : moins de 3 mois au jour du dépôt du dossier (6 mois s\'il est établi à l\'étranger). Les bans sont affichés 10 jours ; le mariage peut être célébré à partir du 10e jour suivant leur publication, puis dans l\'année. Pour tout le reste (pièces, rendez-vous, délais), renseigne-toi auprès de ta mairie.',
    source: 'service-public.gouv.fr, fiche F930 « Mariage en France », vérifiée le 28/10/2026 par l\'administration, consultée le 13/11/2026.',
    lien: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F930',
  },
};
