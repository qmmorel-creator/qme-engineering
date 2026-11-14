// Base intégrée du planificateur de voyage : postes de budget, listes de bagages par type de séjour,
// documents à prévoir, conseils et sources officielles. Contenu original rédigé pour QME.
// AUCUNE règle de formalité (validité des papiers, visa, vaccins) n'est intégrée : elles dépendent du pays
// et changent ; l'application renvoie aux sources officielles. Sources vérifiées le 14/11/2026.
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Postes de budget, dans l'ordre d'affichage. Couleurs fixes (jamais générées).
    // `auto` : poste alimenté par le plan (hébergements, transports, activités).
    postes: [
      { id: 'transport', nom: 'Transports', couleur: '#2E5A88', auto: 'transports' },
      { id: 'hebergement', nom: 'Hébergements', couleur: '#B84A34', auto: 'nuits' },
      { id: 'activites', nom: 'Activités et visites', couleur: '#E8B93A', auto: 'activites' },
      { id: 'repas', nom: 'Repas et restaurants', couleur: '#2E7D4F' },
      { id: 'courses', nom: 'Courses', couleur: '#7A5C99' },
      { id: 'surplace', nom: 'Déplacements sur place', couleur: '#5C8FD1' },
      { id: 'assurance', nom: 'Assurance et frais', couleur: '#6E685F' },
      { id: 'achats', nom: 'Souvenirs et achats', couleur: '#E58C74' },
      { id: 'divers', nom: 'Divers', couleur: '#24221F' },
    ],

    // Modes de transport (texte seul, aucune compagnie ni plateforme).
    modes: [
      ['avion', 'Avion'], ['train', 'Train'], ['voiture', 'Voiture'], ['bus', 'Car ou bus'],
      ['bateau', 'Bateau'], ['velo', 'Vélo'], ['pied', 'À pied'], ['autre', 'Autre'],
    ],

    // Listes de bagages par type de séjour. « essentiels » est toujours proposée.
    bagages: [
      { id: 'essentiels', nom: 'Essentiels', items: [
        'Papiers d\'identité', 'Moyens de paiement', 'Téléphone et chargeur', 'Clés du domicile', 'Trousse de toilette',
        'Brosse à dents et dentifrice', 'Médicaments habituels', 'Sous-vêtements', 'Chaussettes', 'Tenues de jour',
        'Pyjama', 'Une veste chaude', 'Chaussures confortables', 'Lunettes ou lentilles', 'Sac pour le linge sale',
        'Gourde', 'Petite trousse de secours (pansements, antalgique)',
      ] },
      { id: 'ville', nom: 'Ville', items: [
        'Sac à dos de journée', 'Batterie externe', 'Parapluie compact', 'Tenue pour sortir le soir', 'Écouteurs',
        'Adaptateur de prise (selon le pays)', 'Carte ou plan hors ligne',
      ] },
      { id: 'plage', nom: 'Plage et soleil', items: [
        'Maillots de bain', 'Serviette de plage', 'Crème solaire', 'Chapeau ou casquette', 'Lunettes de soleil',
        'Sandales', 'Après-soleil', 'Sac étanche', 'Anti-moustique',
      ] },
      { id: 'montagne', nom: 'Montagne et randonnée', items: [
        'Chaussures de randonnée', 'Polaire', 'Veste imperméable', 'Bâtons de marche', 'Frontale',
        'Couverture de survie', 'Pansements pour ampoules', 'En-cas énergétiques', 'Carte de randonnée',
        'Crème solaire montagne',
      ] },
      { id: 'hiver', nom: 'Hiver et neige', items: [
        'Doudoune', 'Sous-couches thermiques', 'Bonnet', 'Gants', 'Écharpe ou tour de cou', 'Chaussettes chaudes',
        'Après-ski ou bottes', 'Baume à lèvres', 'Masque de ski',
      ] },
      { id: 'camping', nom: 'Camping', items: [
        'Tente', 'Sacs de couchage', 'Matelas', 'Réchaud et cartouche', 'Popote et couverts', 'Briquet',
        'Lampe', 'Corde et pinces à linge', 'Glacière', 'Sacs poubelle',
      ] },
      { id: 'avion', nom: 'Vol long-courrier', items: [
        'Bagage cabine aux dimensions de la compagnie', 'Liquides en petits flacons (règles à vérifier)',
        'Coussin de voyage', 'Bouchons d\'oreilles', 'Tenue de rechange en cabine', 'Stylo (formulaires d\'arrivée)',
      ] },
      { id: 'enfants', nom: 'Bébé et jeunes enfants', items: [
        'Couches et lingettes', 'Doudou', 'Biberons ou gobelet', 'Repas et goûters du trajet', 'Jeux et livres',
        'Poussette ou porte-bébé', 'Thermomètre', 'Carnet de santé', 'Vêtements de rechange (en double)',
      ] },
      { id: 'voiture', nom: 'Voyage en voiture', items: [
        'Permis de conduire', 'Papiers du véhicule et attestation d\'assurance', 'Gilet et triangle',
        'Chargeur de voiture', 'Constat amiable', 'Collations et eau pour la route',
      ] },
    ],

    // Documents à prévoir. Aucune règle de validité ni de délai : à vérifier sur les sources officielles.
    documents: [
      ['Carte d\'identité ou passeport', 'Vérifie que le document accepté par le pays de destination est valide pour toute la durée du voyage (et au-delà si le pays l\'exige).'],
      ['Visa ou autorisation d\'entrée', 'Selon la destination et ta nationalité : vérifie sur la fiche du pays (Conseils aux voyageurs).'],
      ['Billets et confirmations', 'Transports, hébergements, activités : garde une copie hors ligne.'],
      ['Assurance voyage ou assistance', 'Numéro de contrat et numéro à appeler, à portée de main.'],
      ['Couverture santé à l\'étranger', 'Selon la destination, demande à ton organisme d\'assurance maladie ce qu\'il faut emporter.'],
      ['Permis de conduire', 'Si tu conduis : vérifie si un permis international est demandé dans le pays.'],
      ['Carte bancaire et plafonds', 'Préviens ta banque si besoin et vérifie tes plafonds de paiement et de retrait.'],
      ['Ordonnances et carnet de vaccination', 'Vaccins et précautions de santé : vérifie la fiche du pays et demande conseil à un médecin.'],
      ['Autorisation de sortie du territoire', 'Pour un mineur qui voyage sans ses parents : vérifie sur service-public.fr si elle est nécessaire.'],
      ['Copies numériques des documents', 'Une copie de chaque pièce dans un espace sûr, séparée des originaux.'],
    ],

    conseils: [
      ['Les étapes d\'abord', 'Pose les grandes étapes et leurs dates : chaque nuit du voyage doit avoir un toit, les trous sont signalés.'],
      ['Réservé ou à réserver', 'Chaque hébergement, transport ou activité porte son statut : la liste de ce qui reste à réserver se tient seule.'],
      ['Prévu puis réel', 'Le plan donne le budget prévu, poste par poste ; les dépenses saisies pendant le voyage donnent le réel.'],
      ['Qui doit quoi', 'Chaque dépense dit qui a payé et pour qui : au retour, le nombre minimal de remboursements est calculé.'],
    ],

    // Sources officielles (formalités) : seulement un renvoi, aucun contenu repris.
    sources: [
      ['France Diplomatie, « Conseils aux voyageurs » : fiche de chaque pays (entrée, sécurité, santé)', 'https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/'],
      ['Service-public.fr, « Passeport »', 'https://www.service-public.fr/particuliers/vosdroits/N360'],
      ['Service-public.fr, « Carte d\'identité »', 'https://www.service-public.fr/particuliers/vosdroits/N358'],
      ['Service-public.fr, « Autorisation de sortie du territoire (AST) »', 'https://www.service-public.fr/particuliers/vosdroits/F1359'],
    ],
    sourcesVerifieesLe: '2026-11-14',
  };
})();
