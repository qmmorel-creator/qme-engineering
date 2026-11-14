// Base intégrée de l'emploi du temps d'établissement : grilles de créneaux types, équipements de salle
// courants, couleurs des modules, conseils. Aucune donnée datée (les jours fériés sont calculés dans
// regles.js), aucun nom d'établissement, de logiciel ni de personne réelle.
window.BASE = {
  version: '2026-11-14',

  reglages: {
    jours: [1, 2, 3, 4, 5], // 1 = lundi … 6 = samedi
    alternance: false, // semaines A et B
    alsaceMoselle: false, // Vendredi saint et 26 décembre en plus
    etablissement: '',
  },

  // Grilles de créneaux proposées au premier lancement (modifiables ensuite).
  grilles: [
    { code: 'J4', nom: 'Quatre créneaux de 1 h 30 par jour', detail: '08:30 → 16:15, pauses de 15 min et déjeuner',
      creneaux: [['08:30', '10:00'], ['10:15', '11:45'], ['13:00', '14:30'], ['14:45', '16:15']] },
    { code: 'J5', nom: 'Cinq créneaux de 1 h 30 (dont un en fin de journée)', detail: '08:30 → 18:00, idéal avec des cours du soir',
      creneaux: [['08:30', '10:00'], ['10:15', '11:45'], ['13:00', '14:30'], ['14:45', '16:15'], ['16:30', '18:00']] },
    { code: 'H1', nom: 'Heures pleines', detail: '08:00 → 18:00, un créneau par heure, sans cours de 12:00 à 13:00',
      creneaux: [['08:00', '09:00'], ['09:00', '10:00'], ['10:00', '11:00'], ['11:00', '12:00'], ['13:00', '14:00'], ['14:00', '15:00'], ['15:00', '16:00'], ['16:00', '17:00'], ['17:00', '18:00']] },
    { code: 'DJ', nom: 'Demi-journées', detail: 'matin 09:00 → 12:30, après-midi 13:30 → 17:00',
      creneaux: [['09:00', '12:30'], ['13:30', '17:00']] },
  ],

  equipements: ['Vidéoprojecteur', 'Postes informatiques', 'Tableau blanc', 'Écran interactif', 'Matériel de visioconférence', 'Accès fauteuil roulant'],

  // Couleurs des modules, dans cet ordre, jamais générées (fond teinté, texte foncé lisible).
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
    ['Commence par les ressources', 'Groupes avec leur effectif, formateurs avec leurs indisponibilités et leur quota, salles avec leur capacité et leurs équipements, puis les modules et leur volume prévu.'],
    ['Place une semaine type', 'Clique sur un créneau libre de la grille pour y poser une séance. Les conflits s\'affichent tout de suite, en rouge.'],
    ['Duplique-la', 'Recopie la semaine sur les suivantes (ou sur les semaines A ou B seulement) : les jours fériés et les fermetures sont sautés.'],
    ['Suis les heures', 'L\'onglet Heures compare, module par module et formateur par formateur, le prévu, le placé et le réalisé.'],
  ],
};
