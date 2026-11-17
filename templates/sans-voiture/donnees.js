// Base intégrée de « Vivre sans voiture » : questionnaire, valeurs d'exemple, cas d'urgence et parades,
// cas du quotidien, équipement, semaine type, calendrier, phase de test, score de faisabilité.
// Contenu original rédigé pour QME. AUCUNE donnée de marché : pas de tarif de transport, de location,
// de carburant ni de cote ; aucune ville, aucun réseau, loueur, financeur ni marque. Les valeurs par
// défaut sont des EXEMPLES ronds, signalés comme tels dans l'application, à remplacer par les tiens.
// Numéros d'urgence vérifiés le 17/11/2026 sur service-public.gouv.fr (fiche F33954, vérifiée le
// 25/08/2026) ; siège enfant : article R412-2 du code de la route et fiche F628 (vérifiée le 02/11/2026) ;
// casque à vélo avant 12 ans : fiche F34169 (vérifiée le 10/06/2026).
(() => {
  window.BASE = {
    version: '2026-11-17',

    // Valeurs d'exemple proposées à la création d'un scénario (toutes modifiables, montants en centimes).
    defauts: {
      voiture: {
        detention: 'achat', valeur: 800000, depreciation: 12,
        mensualite: 0, moisRestants: 0, capitalRestant: 0, loyer: 0, servicesMois: 0,
        assurance: 60000, entretien: 50000, controle: 4000,
        carburantMode: 'km', carburantAn: 0, kmAn: 10000, conso: 6, energie: 'l', prixEnergie: 180,
        stationnement: 0, peages: 10000, divers: 10000,
        loa: { duree: 48, loyersPayes: 0, premierLoyer: 0, option: 0, premierRachat: 0, prixVehicule: 0, unite: 'montant', bareme: [] },
        lld: { duree: 48, loyersPayes: 0 },
      },
      sortie: { remise: 5, frais: 0, canal: 'particulier', ecartParticulier: 0, ecartPro: 15, indemniteMode: 'pct', indemnitePct: 50 },
      remplacement: {
        transports: { abonnes: 0, prixAbonnement: 0, partEmployeur: 0, enfants: 0, tickets: 0, deja: 0 },
        velo: { achat: 0, aides: 0, dureeAns: 6, entretien: 0, assurance: 0, deja: 0 },
        joursLocation: 6, prixJour: 6000, semainesLocation: 1, prixSemaine: 30000, franchiseJour: 1500,
        kmLocation: 2000, prixKmLocation: 12, autopartage: { abonnement: 0, heures: 0, prixHeure: 0, km: 0, prixKm: 0 },
        taxis: 4, prixTaxi: 2500, train: 0, livraisons: 0, prixLivraison: 0, autres: [], equipement: [],
      },
    },

    // Trois profils de location (jours isolés, semaines) pour remplir vite la partie location.
    profilsLocation: [
      ['sobre', 'Sobre', 'Quelques journées par an, pas de semaine de vacances en voiture.', { joursLocation: 4, semainesLocation: 0 }],
      ['moyen', 'Moyen', 'Une journée par mois environ et une semaine de vacances.', { joursLocation: 10, semainesLocation: 1 }],
      ['frequent', 'Fréquent', 'Plusieurs week-ends hors de la ville et deux semaines de vacances.', { joursLocation: 24, semainesLocation: 2 }],
    ],

    // Questions du score de faisabilité. poids : importance ; bloquant : un « non » bloque le verdict ;
    // condition : seulement si le foyer a des enfants, ou un vélo.
    faisabilite: [
      { id: 'travail', q: 'Le trajet domicile-travail se fait sans voiture', aide: 'À pied, à vélo, en transports, ou en télétravail complet. « Sans objet » si personne ne travaille hors du domicile.', poids: 20, bloquant: true },
      { id: 'ecole', q: 'L\'école ou la crèche se rejoint sans voiture', aide: 'Aller et retour, par tous les temps.', poids: 15, bloquant: true, condition: 'enfants' },
      { id: 'arret', q: 'Un arrêt de transport fréquent est à moins de 10 minutes à pied', aide: 'Fréquent : qui passe assez souvent pour ne pas organiser sa journée autour.', poids: 10 },
      { id: 'recours', q: 'Une personne de recours peut récupérer un enfant ou te dépanner', aide: 'Voisin, famille, ami ; inscrite à l\'école si besoin.', poids: 8 },
      { id: 'medecin', q: 'Médecin ou pédiatre accessible sans voiture', aide: 'Cabinet habituel joignable à pied, à vélo ou en transports.', poids: 8 },
      { id: 'location', q: 'Une location ou un autopartage à moins de 15 minutes', aide: 'Pour les jours où une voiture reste nécessaire.', poids: 8 },
      { id: 'localVelo', q: 'Un local ou un abri sûr pour le vélo', aide: 'À la maison et, si possible, au travail.', poids: 6, condition: 'velo' },
      { id: 'horaires', q: 'Horaires réguliers, sans astreinte la nuit', aide: 'Les horaires décalés compliquent les transports.', poids: 6 },
      { id: 'teletravail', q: 'Télétravail au moins un jour par semaine', aide: 'Un jour de moins à organiser.', poids: 5 },
      { id: 'famille', q: 'Famille et amis joignables en train', aide: 'Pour les visites et les vacances.', poids: 5 },
      { id: 'accord', q: 'Tout le foyer est d\'accord pour essayer', aide: 'La décision se prend à plusieurs.', poids: 5 },
      { id: 'veloPorte', q: 'Le vélo transporte l\'enfant et les courses', aide: 'Siège enfant, remorque, sacoches ou vélo cargo.', poids: 4, condition: 'velo' },
    ],

    // Cas d'urgence et parades. gravite : 'bloquant' (peut empêcher de se passer de voiture),
    // 'anticiper' (se règle si c'est prévu), 'favorable' (se règle facilement).
    // condition : 'enfants', 'velo' ou 'contrat' (LOA, LLD ou crédit en cours).
    urgences: [
      { id: 'nuit', titre: 'Urgence médicale la nuit', gravite: 'bloquant', solution: 'Urgence vitale : appeler le 15 (Samu), ou le 112, numéro d\'urgence européen joignable depuis un portable. Le 114 pour les personnes sourdes ou malentendantes. Médecin de garde : le 116 117 ou le 15, selon la région.', planB: 'Hors urgence vitale : taxi vers le service d\'urgence le plus proche (note sa distance dans le questionnaire) ; numéro d\'un taxi enregistré dans les deux téléphones.', enfant: 'Le code de la route dispense les taxis du siège enfant (article R412-2) ; pour un VTC, le texte ne prévoit pas cette dispense : à vérifier avant de réserver. Garde un rehausseur pliable prêt à l\'entrée.' },
      { id: 'malade', titre: 'Enfant malade à récupérer à l\'école', gravite: 'bloquant', condition: 'enfants', solution: 'L\'adulte le plus proche y va, à pied ou à vélo si l\'état de l\'enfant le permet.', planB: 'Une personne de recours inscrite à l\'école ; taxi si l\'enfant ne peut pas marcher.' },
      { id: 'siege', titre: 'Siège auto obligatoire dans un véhicule loué, emprunté ou partagé', gravite: 'anticiper', condition: 'enfants', solution: 'Un enfant de moins de 10 ans doit être attaché dans un siège adapté à sa taille et à son poids (code de la route, article R412-2). Emporte un rehausseur pliable homologué, adapté à l\'âge de l\'enfant.', planB: 'Réserver le siège avec la location, en vérifiant qu\'il correspond à l\'enfant.' },
      { id: 'velo', titre: 'Panne ou vol du vélo', gravite: 'anticiper', condition: 'velo', solution: 'Deux antivols, assurance vol, entretien régulier, kit de crevaison ; un atelier repéré près de chez toi.', planB: 'Transports en commun ou location à la journée le temps de la réparation.' },
      { id: 'greve', titre: 'Grève ou travaux sur les transports', gravite: 'anticiper', solution: 'Vélo, télétravail si possible, billets de train échangeables.', planB: 'Location de repli pour la journée.' },
      { id: 'tard', titre: 'Retour tardif avec un enfant endormi', gravite: 'anticiper', condition: 'enfants', solution: 'Rentrer avant que les passages des transports se raréfient.', planB: 'Taxi, avec le rehausseur pliable.' },
      { id: 'meteo', titre: 'Pluie, froid ou canicule', gravite: 'favorable', solution: 'Cape de pluie, protection du siège enfant, vêtements adaptés ; trajets décalés aux heures fraîches.', planB: 'Transports ou taxi les jours vraiment difficiles.' },
      { id: 'achats', titre: 'Gros achats, déchetterie, déménagement', gravite: 'favorable', solution: 'Regrouper ces besoins sur une journée de location.', planB: 'Livraison par le magasin ; utilitaire loué à l\'heure.' },
      { id: 'vacances', titre: 'Vacances et visites lointaines', gravite: 'anticiper', solution: 'Train, puis location sur place si besoin.', planB: 'Réserver 2 à 3 mois avant les vacances scolaires, quand les voitures de location se font rares.' },
      { id: 'caution', titre: 'Disponibilité et caution des locations', gravite: 'anticiper', solution: 'Comptes ouverts chez deux loueurs au moins, avant de vendre.', planB: 'Vérifier le plafond de ta carte bancaire (caution) et le montant de la franchise.' },
      { id: 'grandit', titre: 'L\'enfant devient trop lourd pour le siège vélo', gravite: 'anticiper', condition: 'enfants', solution: 'Regarder la limite de poids du siège ; prévoir la suite : barre de traction, tandem parent-enfant, remorque ou vélo cargo.', planB: 'Transports pour les trajets longs. Rappel : avant 12 ans, le casque est obligatoire à vélo, conducteur ou passager.' },
      { id: 'bonus', titre: 'Bonus d\'assurance si tu reprends une voiture plus tard', gravite: 'favorable', solution: 'Demander le relevé d\'information à la résiliation de l\'assurance et le conserver.', planB: 'Le garder avec tes papiers ; il te sera demandé par le prochain assureur.' },
      { id: 'contrat', titre: 'Contrat en cours (LOA, LLD ou crédit)', gravite: 'bloquant', condition: 'contrat', solution: 'La sortie anticipée peut coûter cher : relis le contrat et demande par écrit le montant exact au financeur avant de décider.', planB: 'Attendre la date où la sortie coûte le moins (onglet Bilan, meilleur moment de sortie).' },
      { id: 'famille', titre: 'La famille change (naissance, déménagement, nouvel emploi)', gravite: 'favorable', solution: 'Refaire le point une fois par an avec ce simulateur.', planB: 'La décision est réversible : une voiture se rachète.' },
    ],

    // Cas de figure du quotidien (situation, piste). Cochés une fois réglés.
    quotidien: [
      ['École ou crèche', 'Trajet à pied ou à vélo, horaires des transports notés, plan B en cas de pluie.'],
      ['Trajet du travail', 'Itinéraire testé aux heures de pointe, durée porte à porte notée.'],
      ['Courses de la semaine', 'Sacoches ou remorque ; livraison pour les grosses courses.'],
      ['Activités des enfants', 'Activités proches ou desservies ; covoiturage avec d\'autres parents.'],
      ['Anniversaires et invitations', 'Trajet repéré à l\'avance ; retour avec d\'autres parents.'],
      ['Sorties du soir', 'Dernier passage des transports connu ; taxi au retour si besoin.'],
      ['Week-end hors de la ville', 'Train et location sur place, ou location à la journée.'],
      ['Vacances', 'Train et réservation anticipée de la location.'],
      ['Garde alternée', 'Trajets d\'échange organisés sans voiture, affaires en double si possible.'],
      ['Rendez-vous médicaux', 'Cabinet joignable, temps de trajet prévu.'],
      ['Visites à la famille', 'Train ; la famille vient chercher à la gare.'],
      ['Déplacement professionnel', 'Train ; voiture de location payée par l\'employeur si c\'est prévu.'],
      ['Grève ou travaux', 'Vélo, télétravail ou location de repli.'],
      ['Panne du vélo', 'Atelier repéré, transports en secours.'],
      ['Jardinerie, bricolage', 'Livraison du magasin ou location d\'un utilitaire à l\'heure.'],
      ['Déchetterie', 'Regrouper sur une journée de location.'],
      ['Animal chez le vétérinaire', 'Sac de transport adapté, taxi ou transports.'],
      ['Sport et matériel encombrant', 'Rangement au club, vélo avec remorque, ou location.'],
      ['Mariage, fête, événement', 'Covoiturage avec les invités, ou location.'],
      ['Imprévu le dimanche', 'Taxi, et un numéro de recours.'],
    ],

    // Équipement type. Les prix se saisissent dans « Sans voiture » (équipement acheté une fois).
    equipement: [
      ['rehausseur', 'Rehausseur pliable homologué', 'enfants'],
      ['siege-velo', 'Siège enfant pour le vélo', 'enfants'],
      ['casque-enfant', 'Casque enfant (obligatoire à vélo avant 12 ans)', 'enfants'],
      ['antivols', 'Deux antivols', 'velo'],
      ['sacoches', 'Sacoches ou panier', 'velo'],
      ['remorque', 'Remorque ou vélo cargo', 'velo'],
      ['cape', 'Cape de pluie et protection du siège enfant', null],
      ['eclairage', 'Éclairage et gilet réfléchissant', 'velo'],
      ['crevaison', 'Kit de crevaison et pompe', 'velo'],
      ['cabas', 'Cabas à roulettes pour les courses', null],
    ],

    // Comptes à ouvrir avant de vendre.
    comptes: [
      ['loueur1', 'Un premier loueur de voitures (compte ouvert, permis enregistré)'],
      ['loueur2', 'Un second loueur, en cas d\'indisponibilité'],
      ['autopartage', 'Un service d\'autopartage près de chez toi, s\'il en existe'],
      ['taxi', 'Le numéro d\'une compagnie de taxi enregistré dans les téléphones'],
      ['transports', 'L\'application ou la carte des transports en commun'],
      ['train', 'Un compte pour réserver les billets de train'],
    ],

    // Calendrier de réservation (repères).
    calendrier: [
      ['vacances-ete', '2 à 3 mois avant les vacances d\'été', 'Réserver la location de la semaine de vacances et les billets de train.'],
      ['vacances-courtes', '1 à 2 mois avant les petites vacances', 'Réserver la location si elle est nécessaire.'],
      ['week-ends', '2 à 3 semaines avant un week-end', 'Réserver la journée de location ou le train.'],
      ['annuel', 'Une fois par an', 'Refaire le bilan ; vérifier l\'assurance vol du vélo et l\'entretien.'],
    ],

    // Semaine type proposée (modifiable).
    semaine: [
      'Lundi : vélo jusqu\'au travail, école à pied.',
      'Mardi : télétravail, courses avec les sacoches.',
      'Mercredi : activité de l\'enfant à vélo.',
      'Jeudi : transports en commun.',
      'Vendredi : vélo ; livraison des grosses courses.',
      'Samedi : marché à pied, sortie en transports.',
      'Dimanche : visite en train, ou journée de location un week-end sur deux.',
    ],

    // Étapes de la phase de test.
    etapesTest: [
      'Garde la voiture, mais ne t\'en sers plus pendant au moins deux mois (ou jusqu\'à la date de sortie d\'un contrat).',
      'Note chaque location, train, taxi, autopartage ou livraison payés, avec leur montant.',
      'Compare la dépense ramenée à l\'année avec le coût sans voiture prévu.',
      'Décide à la fin : vendre, attendre la fin du contrat, ou garder la voiture.',
    ],

    typesTest: { location: 'Location', train: 'Train', taxi: 'Taxi ou VTC', autopartage: 'Autopartage', livraison: 'Livraison', transports: 'Transports', autre: 'Autre' },

    horsCalcul: 'Non comptés : ce que tu ne saisis pas (cartes de réduction, aides locales, achat d\'une autre voiture plus tard), la fiscalité d\'une voiture de fonction, et l\'effet sur ta santé ou ton temps libre si tu ne le chiffres pas.',
  };
})();
