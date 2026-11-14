// Base intégrée de Gestion de compétition sportive : formats de départ, catégories types, épreuves
// génériques, types de score, conseils et repères. Contenu original rédigé pour QME, aucune logique ici.
// Aucune épreuve de référence ni nom de marque : chaque épreuve est décrite par son format et ses mouvements.
(() => {
  window.BASE = {
    version: '2026-11-14',

    reglages: {
      methode: 'rang',          // 'rang' : somme des rangs (le plus bas gagne) ; 'bareme' : points (le plus haut gagne)
      bareme: { premier: 100, pas: 4, plancher: 10 },
      departage: 'places',      // 'places' : plus de meilleures places ; 'derniere' : dernière épreuve ; 'aucun'
      nomPublic: 'complet',     // 'complet' ou 'initiale' (« Prénom N. ») sur l'écran et le lien public
      reposMin: 20,             // minutes de repos minimum entre deux vagues d'un même participant
      ecranSecondes: 15,        // durée d'affichage de chaque page en mode écran
      ecranLignes: 10,          // lignes par page en mode écran
    },

    // Types de score. sens : -1 le plus petit gagne (temps), +1 le plus grand gagne.
    types: [
      { id: 'temps', nom: 'Pour le temps', court: 'Temps', sens: -1, detail: 'Le plus rapide gagne. Au temps limite, on note les répétitions faites : les non-finishers sont classés après, au nombre de répétitions.' },
      { id: 'reps', nom: 'Répétitions (AMRAP)', court: 'Reps', sens: 1, detail: 'Le plus de répétitions dans le temps donné. Tours complets × répétitions par tour + répétitions du tour entamé.' },
      { id: 'charge', nom: 'Charge maximale (kg)', court: 'Charge', sens: 1, detail: 'La plus lourde charge réussie, au demi-kilo.' },
      { id: 'points', nom: 'Points, distance ou calories', court: 'Points', sens: 1, detail: 'Toute valeur où le plus grand gagne : mètres, calories, points de jugement.' },
    ],

    statutsInscription: [
      { id: 'inscrit', nom: 'Inscrit' },
      { id: 'confirme', nom: 'Confirmé' },
      { id: 'forfait', nom: 'Forfait' },
    ],

    // Couleurs des catégories, dans l'ordre (jamais générées).
    couleurs: ['#2E5A88', '#B84A34', '#E8B93A', '#24221F', '#22476E', '#8A3322', '#6E5310', '#6E685F', '#514C44', '#2E7D4F'],

    // Formats proposés au premier lancement (catégories et épreuves de départ, tout se modifie ensuite).
    formats: [
      {
        id: 'individuel', nom: 'Cross-training individuel', detail: 'Trois niveaux, hommes et femmes, plus une catégorie Masters.',
        categories: [['Élite hommes'], ['Élite femmes'], ['Intermédiaire hommes'], ['Intermédiaire femmes'], ['Découverte hommes'], ['Découverte femmes'], ['Masters 40+ hommes'], ['Masters 40+ femmes']],
        epreuves: ['couplet-temps', 'amrap-12', 'charge-fenetre', 'finale'],
      },
      {
        id: 'equipes2', nom: 'Équipes de 2', detail: 'Binômes hommes, femmes et mixtes, en deux niveaux.',
        categories: [['Binômes hommes · Avancé', 2], ['Binômes femmes · Avancé', 2], ['Binômes mixtes · Avancé', 2], ['Binômes mixtes · Accessible', 2]],
        epreuves: ['synchro-temps', 'relais-rameur', 'amrap-partage', 'finale'],
      },
      {
        id: 'equipes4', nom: 'Équipes de 4 (2 hommes, 2 femmes)', detail: 'Équipes mixtes, deux niveaux.',
        categories: [['Équipes · Avancé', 4], ['Équipes · Accessible', 4]],
        epreuves: ['parcours-equipe', 'amrap-partage', 'charge-cumul', 'finale'],
      },
      {
        id: 'force', nom: 'Force et haltérophilie amateur', detail: 'Charges maximales par catégorie de niveau.',
        categories: [['Hommes'], ['Femmes'], ['Juniors (moins de 18 ans)']],
        epreuves: ['charge-fenetre', 'charge-cumul', 'amrap-12'],
      },
      {
        id: 'endurance', nom: 'Épreuves chronométrées d\'endurance', detail: 'Rameur, vélo, course courte.',
        categories: [['Hommes'], ['Femmes'], ['Vétérans']],
        epreuves: ['rameur-2000', 'velo-calories', 'course-navette'],
      },
      { id: 'vide', nom: 'Partir de zéro', detail: 'Aucune catégorie ni épreuve : tu crées tout.', categories: [], epreuves: [] },
    ],

    // Épreuves génériques (description modifiable). capMin : temps limite en minutes ; repsTotal : répétitions
    // d'une épreuve au temps terminée (affichage « CAP+n »).
    epreuves: [
      { id: 'couplet-temps', nom: 'Épreuve 1 · Couplet au temps', type: 'temps', capMin: 10, repsTotal: 150, departage: false, description: '5 tours : 15 kettlebell swings, 15 sauts sur box. Temps limite 10 min.' },
      { id: 'amrap-12', nom: 'Épreuve 2 · AMRAP 12 min', type: 'reps', capMin: 12, departage: true, description: 'Le plus de répétitions en 12 min : 8 burpees, 12 fentes, 16 relevés de buste. Départage : temps à la fin du 3e tour.' },
      { id: 'charge-fenetre', nom: 'Épreuve 3 · Charge maximale', type: 'charge', capMin: 8, departage: false, description: 'Fenêtre de 8 min pour trouver la charge maximale d\'épaulé (au choix de l\'organisation).' },
      { id: 'finale', nom: 'Finale', type: 'temps', capMin: 8, repsTotal: 90, departage: false, coefficient: 1, description: '3 tours : 10 thrusters, 10 tractions, 10 burpees. Temps limite 8 min.' },
      { id: 'synchro-temps', nom: 'Épreuve 1 · Synchro au temps', type: 'temps', capMin: 12, repsTotal: 160, departage: false, description: 'À deux, en synchronisation : 4 tours de 20 squats et 20 pompes. Temps limite 12 min.' },
      { id: 'relais-rameur', nom: 'Épreuve 2 · Relais rameur', type: 'temps', capMin: 9, departage: false, description: '2 000 m au rameur en relais, changement libre.' },
      { id: 'amrap-partage', nom: 'Épreuve 3 · AMRAP partagé', type: 'reps', capMin: 14, departage: true, description: 'Répétitions partagées librement : 10 wall balls, 10 box jumps, 10 swings. Départage : temps au 2e tour.' },
      { id: 'parcours-equipe', nom: 'Épreuve 1 · Parcours par équipe', type: 'temps', capMin: 15, repsTotal: 200, departage: false, description: 'Parcours enchaîné, un athlète à la fois sur chaque atelier. Temps limite 15 min.' },
      { id: 'charge-cumul', nom: 'Charge cumulée', type: 'charge', capMin: 10, departage: false, description: 'Somme des meilleures charges de l\'équipe (ou de trois essais) en 10 min.' },
      { id: 'rameur-2000', nom: 'Rameur 2 000 m', type: 'temps', capMin: 12, departage: false, description: '2 000 m au rameur, réglage de résistance libre.' },
      { id: 'velo-calories', nom: 'Vélo · calories en 3 min', type: 'points', capMin: 3, departage: false, description: 'Le plus de calories en 3 min sur vélo à air.' },
      { id: 'course-navette', nom: 'Course navette', type: 'temps', capMin: 6, departage: false, description: '10 allers-retours de 20 m le plus vite possible.' },
    ],

    conseils: [
      ['Les catégories d\'abord', 'Chaque inscrit appartient à une catégorie : le classement et les vagues se font par catégorie.'],
      ['Les épreuves dans l\'ordre', 'L\'ordre des épreuves est celui du programme : il sert aux horaires et au départage « dernière épreuve ».'],
      ['Les vagues ensuite', 'Choisis le nombre de couloirs : les vagues se remplissent de façon équilibrée, les mieux classés passent en dernier.'],
      ['Les scores au fil de l\'eau', 'Saisis depuis un téléphone au bord du plateau : le classement se recalcule aussitôt.'],
    ],

    reperes: [
      ['Battement entre vagues', 'Compte 3 à 5 minutes entre deux vagues pour vider le plateau, régler le matériel et appeler les suivants.'],
      ['Un juge par couloir', 'Le juge compte, valide les répétitions et fait signer la feuille. Imprime les feuilles avant chaque épreuve.'],
      ['Temps limite et CAP+', 'Au temps limite, note les répétitions faites. Avec le total de l\'épreuve, le score s\'affiche « CAP+n » (répétitions manquantes).'],
      ['Départage', 'Un temps de passage (fin d\'un tour, d\'un exercice) départage deux scores égaux. Annonce-le avant l\'épreuve.'],
      ['Repos', 'Vérifie les alertes de repos : un participant qui enchaîne deux vagues trop proches ne joue pas à armes égales.'],
      ['Scores validés', 'Coche « validé » quand la feuille de juge est signée : tu sais ce qui peut encore bouger avant l\'annonce.'],
    ],

    mentionRgpd: 'Les informations recueillies (nom, catégorie, club, et si vous les donnez e-mail et téléphone) servent à organiser la compétition : inscriptions, vagues, scores et classement. Le nom, la catégorie, le club et les scores sont affichés sur le classement de l\'événement (écran sur place et lien de consultation) ; vous pouvez demander à n\'apparaître que sous votre numéro de dossard. Les coordonnées ne sont jamais publiées et sont effacées après la compétition. Vous pouvez accéder à vos données, les faire rectifier ou effacer en écrivant à l\'organisation.',
  };
})();
