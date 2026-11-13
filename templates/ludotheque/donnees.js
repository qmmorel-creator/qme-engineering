// Ludothèque · base intégrée (aucune logique ici).
// Catégories et mécaniques : vocabulaire générique du jeu de société. Catalogue de démonstration :
// jeux INVENTÉS par QME (noms, éditeurs et caractéristiques fictifs), sans marque ni donnée propriétaire ;
// toute ressemblance avec un jeu existant serait fortuite. Aucune base ni API externe.
window.BASE = {
  version: '2026-11-13',
  avertissement: 'Les jeux du catalogue d\'exemple sont inventés. Ta collection se remplit avec tes propres fiches : aucune donnée n\'est récupérée sur internet.',

  categories: [
    { id: 'strategie', nom: 'Stratégie' }, { id: 'familial', nom: 'Familial' }, { id: 'ambiance', nom: 'Ambiance' },
    { id: 'cooperatif', nom: 'Coopératif' }, { id: 'cartes', nom: 'Jeu de cartes' }, { id: 'des', nom: 'Jeu de dés' },
    { id: 'deduction', nom: 'Enquête et déduction' }, { id: 'abstrait', nom: 'Abstrait' }, { id: 'enfants', nom: 'Jeu d\'enfants' },
    { id: 'narratif', nom: 'Narratif' }, { id: 'duel', nom: 'Duel (deux joueurs)' }, { id: 'reflexion', nom: 'Réflexion' },
  ],
  mecaniques: [
    'Placement d\'ouvriers', 'Construction de deck', 'Draft', 'Gestion de main', 'Enchères', 'Collection de séries', 'Pose de tuiles',
    'Contrôle de territoire', 'Lancer de dés', 'Coopération', 'Rôles cachés', 'Bluff', 'Déduction', 'Majorité', 'Course', 'Stop ou encore',
    'Mémoire', 'Rapidité', 'Narration', 'Programmation d\'actions', 'Gestion de ressources', 'Négociation', 'Questions et réponses', 'Dessin', 'Adresse', 'Écriture et coche',
  ],
  complexites: ['Très simple', 'Simple', 'Intermédiaire', 'Avancé', 'Expert'],
  emplacements: ['Salon, étagère du haut', 'Salon, étagère du bas', 'Placard du couloir', 'Chambre des enfants', 'Cave'],

  // Catalogue de démonstration : jeux fictifs.
  exemples: [
    { nom: 'Comptoirs d\'Ambre', min: 2, max: 4, duree: 90, complexite: 4, age: 14, categories: ['strategie'], mecaniques: ['Placement d\'ouvriers', 'Gestion de ressources'], extensions: ['Les Routes du Sel'] },
    { nom: 'La Vallée des Lanternes', min: 1, max: 5, duree: 45, complexite: 2, age: 8, categories: ['familial'], mecaniques: ['Pose de tuiles', 'Collection de séries'] },
    { nom: 'Petits Fantômes Farceurs', min: 2, max: 6, duree: 15, complexite: 1, age: 5, categories: ['enfants'], mecaniques: ['Mémoire', 'Rapidité'] },
    { nom: 'Opération Sémaphore', min: 4, max: 10, duree: 20, complexite: 1, age: 10, categories: ['ambiance'], mecaniques: ['Rôles cachés', 'Déduction'] },
    { nom: 'Les Gardiens du Phare', min: 1, max: 4, duree: 60, complexite: 3, age: 12, categories: ['cooperatif'], mecaniques: ['Coopération', 'Gestion de main'], extensions: ['La Tempête', 'Les Récifs'] },
    { nom: 'Rivières et Moulins', min: 2, max: 4, duree: 75, complexite: 3, age: 12, categories: ['strategie'], mecaniques: ['Draft', 'Gestion de ressources'] },
    { nom: 'Dés de la Caravane', min: 1, max: 6, duree: 25, complexite: 2, age: 8, categories: ['des', 'familial'], mecaniques: ['Lancer de dés', 'Écriture et coche'] },
    { nom: 'Le Duel des Cartographes', min: 2, max: 2, duree: 30, complexite: 2, age: 10, categories: ['duel', 'cartes'], mecaniques: ['Draft', 'Collection de séries'] },
    { nom: 'Mystère au Manoir Flamant', min: 1, max: 6, duree: 90, complexite: 2, age: 12, categories: ['deduction', 'cooperatif'], mecaniques: ['Déduction', 'Narration'] },
    { nom: 'Quatre Saisons au Potager', min: 1, max: 4, duree: 40, complexite: 2, age: 8, categories: ['familial'], mecaniques: ['Pose de tuiles'] },
    { nom: 'Bluff à la Criée', min: 3, max: 8, duree: 20, complexite: 1, age: 8, categories: ['ambiance', 'cartes'], mecaniques: ['Bluff', 'Enchères'] },
    { nom: 'Les Archivistes de Port-Brume', min: 2, max: 5, duree: 120, complexite: 5, age: 14, categories: ['strategie'], mecaniques: ['Construction de deck', 'Contrôle de territoire'], extensions: ['Le Scriptorium'] },
    { nom: 'Pyramide de Galets', min: 2, max: 2, duree: 15, complexite: 2, age: 7, categories: ['abstrait', 'duel'], mecaniques: ['Adresse'] },
    { nom: 'Course des Escargots Pressés', min: 2, max: 5, duree: 20, complexite: 1, age: 4, categories: ['enfants'], mecaniques: ['Course', 'Lancer de dés'] },
    { nom: 'Mots Croisés en Folie', min: 3, max: 8, duree: 30, complexite: 1, age: 10, categories: ['ambiance'], mecaniques: ['Questions et réponses'] },
    { nom: 'Expédition Boréale', min: 1, max: 4, duree: 75, complexite: 3, age: 12, categories: ['cooperatif', 'narratif'], mecaniques: ['Coopération', 'Narration'] },
    { nom: 'Pas de Panique, Capitaine !', min: 2, max: 6, duree: 30, complexite: 2, age: 10, categories: ['cooperatif'], mecaniques: ['Programmation d\'actions', 'Rapidité'] },
    { nom: 'Le Marché des Oubliés', min: 2, max: 5, duree: 50, complexite: 3, age: 10, categories: ['cartes', 'strategie'], mecaniques: ['Gestion de main', 'Négociation'] },
    { nom: 'Tours et Remparts', min: 2, max: 4, duree: 60, complexite: 3, age: 10, categories: ['strategie'], mecaniques: ['Majorité', 'Contrôle de territoire'] },
    { nom: 'Croquis Express', min: 4, max: 12, duree: 25, complexite: 1, age: 8, categories: ['ambiance'], mecaniques: ['Dessin', 'Rapidité'] },
    { nom: 'Le Lac aux Libellules', min: 2, max: 4, duree: 35, complexite: 1, age: 6, categories: ['familial', 'enfants'], mecaniques: ['Collection de séries', 'Stop ou encore'] },
    { nom: 'Énigmes du Labyrinthe', min: 1, max: 1, duree: 45, complexite: 3, age: 12, categories: ['reflexion'], mecaniques: ['Déduction'] },
  ],

  conseils: [
    ['Ta collection, à ta façon', 'Ajoute tes jeux avec le nombre de joueurs, la durée, la complexité et l\'âge : ce sont eux qui servent aux suggestions.'],
    ['Note tes parties', 'Une partie notée en dix secondes nourrit les statistiques et révèle les jeux qui dorment.'],
    ['Que jouer ce soir ?', 'Indique le nombre de joueurs et le temps disponible : l\'application propose les jeux de ta collection qui conviennent, et dit pourquoi.'],
    ['Liste à découvrir', 'Garde une liste des jeux qui te tentent, sans les confondre avec ceux que tu possèdes.'],
  ],
};
