// Base intégrée du suivi de lecture : genres proposés (liste modifiable dans les Réglages), formats,
// statuts, priorités de la liste « à lire », couleurs, conseils. Aucune donnée datée, aucune œuvre réelle,
// aucune couverture, aucun service de livres en ligne : tout se saisit à la main.
window.BASE = {
  version: '2026-11-14',

  // Genres proposés au premier lancement (l'utilisateur les renomme, en ajoute ou en retire).
  genres: [
    'Roman', 'Policier et thriller', 'Science-fiction', 'Fantasy', 'Classique', 'Historique',
    'Biographie et mémoires', 'Essai', 'Histoire', 'Sciences et nature', 'Développement personnel',
    'Bande dessinée et manga', 'Poésie', 'Théâtre', 'Jeunesse', 'Voyage', 'Pratique et loisirs',
  ],

  formats: [
    { code: 'papier', nom: 'Papier', unite: 'pages' },
    { code: 'numerique', nom: 'Numérique', unite: 'pages' },
    { code: 'audio', nom: 'Audio', unite: 'minutes' },
  ],

  statuts: [
    { code: 'encours', nom: 'En cours' },
    { code: 'alire', nom: 'À lire' },
    { code: 'lu', nom: 'Lu' },
    { code: 'abandonne', nom: 'Abandonné' },
  ],

  priorites: [
    { code: 1, nom: 'Prioritaire' },
    { code: 2, nom: 'Bientôt' },
    { code: 3, nom: 'Un jour' },
  ],

  // Objectif proposé au premier lancement (modifiable, année par année).
  objectif: { livres: 24, pages: 0 },

  // Couleurs des genres, dans cet ordre, jamais générées (fond teinté, filet, texte foncé lisible).
  couleurs: [
    { fond: '#D8E4F0', bord: '#2E5A88', texte: '#22476E' },
    { fond: '#FBEBC2', bord: '#B8901F', texte: '#6E5310' },
    { fond: '#F8DCD3', bord: '#B84A34', texte: '#8A3322' },
    { fond: '#DCEBDD', bord: '#2E7D4F', texte: '#1F5A36' },
    { fond: '#E6DDF0', bord: '#6A4C93', texte: '#4A3270' },
    { fond: '#F3EDE3', bord: '#6E685F', texte: '#45413A' },
    { fond: '#D5ECEC', bord: '#2F7A7A', texte: '#1F5656' },
    { fond: '#F6E0EC', bord: '#A04A78', texte: '#7A2F58' },
  ],

  conseils: [
    ['Ajoute tes livres', 'Titre, auteur, genre, format et nombre de pages (ou durée pour un livre audio). Ceux que tu veux lire vont dans la liste « à lire », classés par priorité.'],
    ['Note tes sessions', 'Après chaque lecture : les pages lues, ou la page où tu es arrivé. La progression, ton rythme et la date de fin estimée se calculent seuls.'],
    ['Fixe ton objectif', 'Un nombre de livres et, si tu veux, de pages pour l\'année : tu vois au jour près si tu es en avance ou en retard.'],
    ['Garde une trace', 'Une note sur 5, ton avis et les citations qui t\'ont marqué, avec leur page. Les statistiques font le reste.'],
  ],
};
