// Base intégrée du Secret Santa : modèles d'échange prêts à l'emploi (sans logique).
// Les budgets sont des suggestions modifiables, pas des recommandations.
window.BASE = {
  modeles: [
    {
      id: 'famille', nom: 'En famille', titre: 'Noël en famille', budget: '30 €',
      message: 'Un seul cadeau chacun, offert à la personne tirée au sort. On ouvre tout le soir du réveillon. Pense à remplir ta liste d\'idées pour aider celui ou celle qui t\'a tiré.',
      conseil: 'Ajoute une exclusion pour chaque couple : on ne tire pas son conjoint.',
    },
    {
      id: 'amis', nom: 'Entre amis', titre: 'Secret Santa des copains', budget: '20 €',
      message: 'Un cadeau, un budget, aucune pression. Le tirage se fait dès que tout le monde est inscrit. Le cadeau peut être fait main.',
      conseil: 'Fixe la date de la soirée : elle s\'affiche sur la page de chaque participant.',
    },
    {
      id: 'bureau', nom: 'Entre collègues', titre: 'Secret Santa du bureau', budget: '15 €',
      message: 'Cadeau à déposer sous le sapin de l\'équipe avant la date indiquée. Pense à des idées que l\'on peut offrir à un collègue : livres, gourmandises, objets de bureau.',
      conseil: 'Un budget bas et identique pour tous évite les malaises. Ferme les inscriptions avant le tirage.',
    },
  ],
  idees: ['Un livre', 'Un jeu de société', 'Une gourmandise locale', 'Une plante', 'Un objet fait main', 'Une sortie (cinéma, concert)', 'Une bougie', 'Un accessoire de cuisine'],
  // Données de la démo : prénoms fictifs.
  demo: {
    code: 'noel2026',
    famille: ['Camille', 'Hugo', 'Inès', 'Malo', 'Rose', 'Yanis', 'Lucie'],
    bureau: ['Sarah', 'Thomas', 'Nadia', 'Paul', 'Jeanne'],
    amis: ['Léo', 'Chloé'],
    box: ['Max', 'Léa', 'Tom', 'Sofia', 'Nina', 'Jules', 'Emma', 'Lucas'],
    souhaits: {
      Camille: 'Un roman policier\nDes chaussettes rigolotes (taille 38)\nTout sauf du chocolat noir',
      Hugo: 'Un jeu de société à deux joueurs\nUn bonnet bleu',
      'Inès': 'Une plante facile (j\'oublie d\'arroser)\nDu thé vert',
      Malo: '',
      Rose: 'Un carnet de croquis\nDes crayons de couleur',
      Yanis: 'Un puzzle de 1000 pièces',
      Lucie: 'Une bougie parfumée\nUn livre de cuisine végétarienne',
    },
  },
};
