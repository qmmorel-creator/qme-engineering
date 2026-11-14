// Base intégrée de « Bénévoles et planning des créneaux » : postes types, compétences types, modèles
// d'événement avec leurs créneaux, message type, réglages par défaut et repères RGPD. Contenu original
// rédigé pour QME, aucune logique ici, aucune donnée qui se périme (aucun prix, aucun tarif, aucune date fixe).
// Les seuils de repos et d'heures sont des CHOIX de l'association, pas des règles légales : les bénévoles
// ne relèvent pas du Code du travail ; chaque association fixe ses propres repères dans les Réglages.
(() => {
  window.BASE = {
    version: '2026-11-14',

    reglages: {
      reposMin: 30,        // minutes de pause minimum entre deux créneaux pour « couper » un enchaînement
      maxContinu: 4,       // heures d'affilée au plus sans pause d'au moins reposMin (0 = pas d'alerte)
      maxJour: 8,          // heures au plus sur une même journée (0 = pas d'alerte)
      sansReponse: false,  // la suggestion automatique propose aussi les bénévoles qui n'ont pas répondu
      conservationMois: 24, // durée choisie par l'association pour garder un bénévole inactif (aucune durée légale intégrée)
      contact: '',         // qui prévenir en cas d'empêchement (repris dans le message)
      signature: '',
    },

    // Couleurs des postes, dans cet ordre fixe (palette déjà validée pour le planning d'équipe : séparation
    // pour les daltonismes ; le nom du poste est toujours écrit à côté de la couleur).
    couleurs: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'],

    competences: [
      'Accueil du public', 'Tenue de caisse', 'Hygiène alimentaire', 'Cuisine en grande quantité', 'Bricolage et montage',
      'Permis B', 'Premiers secours (PSC1 ou plus)', 'Sono et lumière', 'Animation enfants', 'Arbitrage ou jugement',
      'Langue étrangère', 'Photo et vidéo',
    ],

    familles: ['Accueil', 'Restauration', 'Logistique', 'Sécurité', 'Animation', 'Sport'],

    // Postes types : [nom, famille, compétence conseillée ('' = aucune), consigne type]
    postes: [
      ['Accueil et information', 'Accueil', '', 'Renseigner le public, tenir le plan et les horaires, orienter vers les stands.'],
      ['Billetterie et entrées', 'Accueil', 'Tenue de caisse', 'Vendre ou contrôler les entrées, compter la caisse à la relève.'],
      ['Vestiaire', 'Accueil', '', 'Ticket numéroté contre chaque vêtement, ne rien rendre sans ticket.'],
      ['Accueil des exposants', 'Accueil', '', 'Vérifier les inscriptions, placer chaque exposant à son emplacement.'],
      ['Accueil des artistes ou des équipes', 'Accueil', '', 'Accueillir, montrer les loges ou vestiaires, rappeler les horaires.'],
      ['Retrait des dossards', 'Accueil', '', 'Remettre dossards et sacs, cocher la liste des inscrits.'],
      ['Buvette', 'Restauration', '', 'Servir, garder le comptoir propre, prévenir avant la rupture de stock.'],
      ['Caisse de la buvette', 'Restauration', 'Tenue de caisse', 'Encaisser, rendre la monnaie, remettre le fond de caisse à la relève.'],
      ['Grillades et snack', 'Restauration', 'Hygiène alimentaire', 'Cuire, servir chaud, respecter la chaîne du froid.'],
      ['Cuisine', 'Restauration', 'Cuisine en grande quantité', 'Préparer selon le menu, étiqueter, nettoyer le plan de travail.'],
      ['Service en salle', 'Restauration', '', 'Servir les tables, débarrasser, réapprovisionner pain et eau.'],
      ['Plonge', 'Restauration', '', 'Laver, sécher et ranger la vaisselle au fil du service.'],
      ['Montage', 'Logistique', '', 'Monter barnums, tables et barrières selon le plan d\'implantation.'],
      ['Démontage', 'Logistique', '', 'Démonter, compter le matériel, charger les véhicules.'],
      ['Rangement et nettoyage', 'Logistique', '', 'Ramasser, nettoyer, rendre les lieux dans l\'état du début.'],
      ['Tri des déchets', 'Logistique', '', 'Vider les points de tri, changer les sacs, garder les zones propres.'],
      ['Parking', 'Logistique', '', 'Orienter les véhicules, garder les accès secours libres.'],
      ['Signalétique', 'Logistique', '', 'Poser puis retirer panneaux et fléchage.'],
      ['Navette et transport', 'Logistique', 'Permis B', 'Conduire selon le planning des navettes ou des courses de matériel.'],
      ['Ravitaillement', 'Logistique', '', 'Préparer et tenir le point de ravitaillement, ramasser les gobelets.'],
      ['Contrôle des accès', 'Sécurité', '', 'Vérifier bracelets ou badges, garder les issues dégagées.'],
      ['Signaleur sur le parcours', 'Sécurité', '', 'Tenir son point, gilet porté, prévenir le PC en cas d\'incident.'],
      ['Poste de secours', 'Sécurité', 'Premiers secours (PSC1 ou plus)', 'Rester joignable au poste ; le dispositif de secours reste celui prévu par l\'organisateur.'],
      ['Animation enfants', 'Animation', 'Animation enfants', 'Animer l\'atelier, ne jamais laisser un enfant seul, rendre l\'enfant à un adulte connu.'],
      ['Stand jeux', 'Animation', '', 'Expliquer le jeu, distribuer les lots, tenir le stand rangé.'],
      ['Tombola ou loto', 'Animation', 'Tenue de caisse', 'Vendre les cartons ou tickets, annoncer, remettre les lots.'],
      ['Sono et lumière', 'Animation', 'Sono et lumière', 'Installer, faire les balances, couper à l\'heure prévue.'],
      ['Photo et vidéo', 'Animation', 'Photo et vidéo', 'Couvrir les temps forts ; ne diffuser qu\'avec l\'accord des personnes.'],
      ['Table de marque', 'Sport', 'Arbitrage ou jugement', 'Tenir la feuille de match, le chrono et le tableau des scores.'],
      ['Chronométrage', 'Sport', '', 'Relever les temps, vérifier les arrivées, transmettre les résultats.'],
      ['Juge ou arbitre', 'Sport', 'Arbitrage ou jugement', 'Appliquer le règlement de l\'épreuve, noter les scores.'],
      ['Saisie des résultats', 'Sport', '', 'Saisir les scores ou les temps au fil des épreuves, vérifier les doublons.'],
      ['Remise des prix', 'Sport', '', 'Préparer le podium et les lots, appeler les lauréats.'],
    ],

    // Modèles d'événement : durée en jours, postes retenus et créneaux types
    // [poste, jour (0 = premier jour, -1 = la veille), début, fin, besoin en personnes].
    modeles: [
      {
        id: 'fete', nom: 'Fête de village ou kermesse', jours: 1, description: 'Montage la veille au soir, buvette et stands le jour J, démontage le soir.',
        creneaux: [
          ['Montage', -1, '17:00', '20:00', 6],
          ['Accueil et information', 0, '10:00', '13:00', 2], ['Accueil et information', 0, '13:00', '16:00', 2], ['Accueil et information', 0, '16:00', '19:00', 2],
          ['Buvette', 0, '11:00', '14:00', 3], ['Buvette', 0, '14:00', '17:00', 3], ['Buvette', 0, '17:00', '20:00', 3],
          ['Caisse de la buvette', 0, '11:00', '15:30', 1], ['Caisse de la buvette', 0, '15:30', '20:00', 1],
          ['Grillades et snack', 0, '11:30', '14:30', 2], ['Grillades et snack', 0, '18:00', '21:00', 2],
          ['Animation enfants', 0, '14:00', '17:00', 2], ['Stand jeux', 0, '14:00', '18:00', 2],
          ['Démontage', 0, '20:00', '23:00', 6],
        ],
      },
      {
        id: 'festival', nom: 'Festival sur deux jours', jours: 2, description: 'Montage la veille, deux jours d\'accueil, buvette et scène, démontage le soir du second jour.',
        creneaux: [
          ['Montage', -1, '09:00', '13:00', 8], ['Montage', -1, '14:00', '18:00', 8], ['Signalétique', -1, '14:00', '17:00', 2],
          ['Billetterie et entrées', 0, '17:00', '20:30', 3], ['Billetterie et entrées', 0, '20:30', '00:00', 2],
          ['Contrôle des accès', 0, '17:00', '20:30', 2], ['Contrôle des accès', 0, '20:30', '00:30', 2],
          ['Buvette', 0, '18:00', '21:00', 4], ['Buvette', 0, '21:00', '00:30', 4],
          ['Accueil des artistes ou des équipes', 0, '15:00', '19:00', 1], ['Tri des déchets', 0, '19:00', '23:00', 2],
          ['Billetterie et entrées', 1, '14:00', '18:00', 3], ['Billetterie et entrées', 1, '18:00', '22:00', 3],
          ['Contrôle des accès', 1, '14:00', '18:00', 2], ['Contrôle des accès', 1, '18:00', '00:30', 2],
          ['Buvette', 1, '14:00', '18:00', 4], ['Buvette', 1, '18:00', '21:00', 4], ['Buvette', 1, '21:00', '00:30', 4],
          ['Tri des déchets', 1, '15:00', '19:00', 2], ['Démontage', 1, '23:30', '02:30', 8],
        ],
      },
      {
        id: 'competition', nom: 'Compétition sportive', jours: 1, description: 'Accueil des équipes, table de marque, arbitrage, buvette et remise des prix.',
        creneaux: [
          ['Montage', 0, '07:00', '08:30', 4], ['Accueil des artistes ou des équipes', 0, '08:00', '10:00', 2],
          ['Table de marque', 0, '09:00', '13:00', 2], ['Table de marque', 0, '13:30', '17:30', 2],
          ['Juge ou arbitre', 0, '09:00', '13:00', 3], ['Juge ou arbitre', 0, '13:30', '17:30', 3],
          ['Saisie des résultats', 0, '09:00', '17:30', 1],
          ['Buvette', 0, '09:00', '13:00', 2], ['Buvette', 0, '13:00', '17:00', 2], ['Caisse de la buvette', 0, '09:00', '17:00', 1],
          ['Remise des prix', 0, '17:30', '18:30', 2], ['Rangement et nettoyage', 0, '18:00', '19:30', 4],
        ],
      },
      {
        id: 'course', nom: 'Course à pied ou randonnée', jours: 1, description: 'Retrait des dossards, signaleurs, ravitaillements, arrivée et rangement.',
        creneaux: [
          ['Signalétique', -1, '16:00', '19:00', 3], ['Retrait des dossards', -1, '16:00', '19:00', 3],
          ['Retrait des dossards', 0, '07:00', '09:15', 4], ['Parking', 0, '07:00', '09:30', 3],
          ['Signaleur sur le parcours', 0, '08:45', '12:00', 10], ['Ravitaillement', 0, '09:00', '12:00', 4],
          ['Chronométrage', 0, '09:00', '12:30', 2], ['Buvette', 0, '10:00', '13:00', 3],
          ['Remise des prix', 0, '12:00', '13:00', 2], ['Rangement et nettoyage', 0, '12:30', '14:30', 6],
        ],
      },
      {
        id: 'brocante', nom: 'Brocante ou vide-greniers', jours: 1, description: 'Placement des exposants à l\'aube, buvette, parking et nettoyage.',
        creneaux: [
          ['Signalétique', -1, '18:00', '20:00', 2],
          ['Accueil des exposants', 0, '05:30', '08:30', 4], ['Parking', 0, '06:00', '09:00', 2], ['Parking', 0, '09:00', '12:00', 2],
          ['Buvette', 0, '07:00', '10:30', 2], ['Buvette', 0, '10:30', '14:00', 2], ['Buvette', 0, '14:00', '17:30', 2],
          ['Caisse de la buvette', 0, '07:00', '12:00', 1], ['Caisse de la buvette', 0, '12:00', '17:30', 1],
          ['Grillades et snack', 0, '11:00', '14:30', 2], ['Tri des déchets', 0, '12:00', '16:00', 2],
          ['Rangement et nettoyage', 0, '17:30', '19:30', 6],
        ],
      },
      {
        id: 'repas', nom: 'Repas, loto ou soirée associative', jours: 1, description: 'Installation de la salle, cuisine, service, plonge et rangement.',
        creneaux: [
          ['Montage', 0, '14:00', '17:00', 5], ['Cuisine', 0, '15:00', '19:00', 3], ['Accueil et information', 0, '18:30', '20:00', 2],
          ['Billetterie et entrées', 0, '18:30', '20:30', 1], ['Service en salle', 0, '19:30', '22:30', 5],
          ['Tombola ou loto', 0, '20:30', '23:00', 2], ['Plonge', 0, '20:30', '23:30', 3], ['Rangement et nettoyage', 0, '23:00', '01:00', 6],
        ],
      },
    ],

    // Message envoyé par l'association elle-même (copié, jamais envoyé par l'outil). Marqueurs remplacés :
    // {prenom} {evenement} {lieu} {dates} {creneaux} {total} {contact} {signature} {consignes}
    message: 'Bonjour {prenom},\n\nMerci de donner un coup de main pour {evenement} ({lieu}, {dates}). Voici tes créneaux :\n{creneaux}\nSoit {total} au total.\n{consignes}\nEn cas d\'empêchement, préviens {contact} le plus tôt possible.\n\nÀ bientôt,\n{signature}',

    conseils: [
      ['Les bénévoles d\'abord', 'Un prénom, un moyen de contact, ce qu\'ils savent faire et ce qu\'ils préfèrent. Rien de plus.'],
      ['L\'événement ensuite', 'Pars d\'un modèle : les postes et les créneaux types sont créés, tu ajustes les horaires et le nombre de personnes.'],
      ['Remplir et vérifier', 'Note qui vient et sur quelles plages, puis affecte à la main ou laisse l\'outil suggérer : trous et conflits restent visibles jusqu\'au bout.'],
    ],

    // Repères RGPD (textes lus sur cnil.fr, reproduction du règlement (UE) 2016/679, le 14/11/2026).
    rgpd: {
      verifieLe: '2026-11-14',
      sources: [
        ['RGPD, article 5.1.c : données « adéquates, pertinentes et limitées à ce qui est nécessaire »', 'https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2'],
        ['RGPD, article 5.1.e : durée de conservation « n\'excédant pas celle nécessaire » aux finalités', 'https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2'],
        ['RGPD, articles 13 (information), 15 (droit d\'accès) et 17 (droit à l\'effacement)', 'https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3'],
      ],
    },
  };
})();
