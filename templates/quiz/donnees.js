// Base intégrée de la banque de questions et quiz : types de questions, niveaux de difficulté, réglages de
// départ, format de collage, textes RGPD, conseils. Aucune question fournie (hors démo, générée dans app.js),
// aucun programme ni manuel repris, aucune donnée d'apprenant. Rédigée pour QME le 14/11/2026
// (voir docs/templates/fiches/quiz.md).
window.BASE = {
  version: '2026-11-14',

  // Réglages de départ (modifiables dans les Réglages).
  reglages: {
    bareme: 20, // note affichée sur … (10, 20 ou 100)
    seuilFacile: 85, // taux de réussite (%) au-dessus duquel une question est « trop facile »
    seuilDifficile: 35, // taux de réussite (%) en dessous duquel une question est « trop difficile »
    minReponses: 5, // nombre minimal de réponses avant de classer une question
    conservation: 12, // durée de conservation conseillée des résultats nominatifs (mois)
    saisieDefaut: 'anonyme', // mode de saisie proposé pour une nouvelle session : 'anonyme' ou 'nominatif'
    rgpdLu: false,
  },

  types: [
    { code: 'qcm', nom: 'QCM', aide: 'Deux à six propositions, une ou plusieurs justes. Juste si toutes les bonnes cases et elles seules sont cochées.' },
    { code: 'vf', nom: 'Vrai ou faux', aide: 'Une affirmation, vraie ou fausse.' },
    { code: 'courte', nom: 'Réponse courte', aide: 'Un mot, un nombre ou une expression. Corrigée seule si elle correspond à une réponse acceptée (sans tenir compte des majuscules, des accents ni des espaces) ; sinon, à vérifier.' },
  ],
  difficultes: [
    { niveau: 1, nom: 'Facile' },
    { niveau: 2, nom: 'Moyenne' },
    { niveau: 3, nom: 'Difficile' },
  ],
  baremes: [10, 20, 100],
  lettres: ['A', 'B', 'C', 'D', 'E', 'F'],
  maxChoix: 6,

  // Format de collage d'une liste de questions (aide affichée dans la fenêtre « Coller des questions »).
  format: [
    ['? Énoncé', 'commence une nouvelle question'],
    ['+ proposition', 'proposition juste (QCM)'],
    ['- proposition', 'proposition fausse (QCM)'],
    ['= vrai  ou  = faux', 'question vrai ou faux'],
    ['= réponse', 'réponse acceptée (réponse courte, une ligne par variante)'],
    ['# étiquette, étiquette', 'étiquettes'],
    ['~ 1, 2 ou 3', 'difficulté (facile, moyenne, difficile)'],
    ['! texte', 'explication montrée dans le corrigé'],
  ],

  conseils: [
    ['Une question, une idée', 'Un énoncé court et sans double négation : on évalue la notion, pas la lecture.'],
    ['Des distracteurs plausibles', 'Les mauvaises propositions reprennent les erreurs fréquentes : les statistiques montrent ensuite lesquelles attirent.'],
    ['Étiqueter sans compter', 'Notion, séquence, module, niveau : les quiz se tirent par étiquette et la réussite se lit par étiquette.'],
    ['Le moins de données possible', 'Saisie anonyme (copies numérotées) ou pseudonyme : les statistiques n\'ont pas besoin des noms.'],
  ],

  // Couleurs fixes des étiquettes (dans cet ordre, jamais générées) : fond teinté et texte foncé correspondant.
  couleurs: [
    ['#D8E4F0', '#22476E'], ['#FBEBC2', '#6E5310'], ['#F8DCD3', '#8A3322'], ['#DCEBDD', '#1F5A36'], ['#E9E1F2', '#4B3570'], ['#F3EDE3', '#514C44'],
  ],

  sources: {
    rgpd: 'Résultats nominatifs : données personnelles au sens du RGPD (règlement (UE) 2016/679). Tu es responsable de leur usage ; QME les héberge pour toi, liées à ta clé, sans les lire ni les partager.',
    analyse: 'Taux de réussite, trop facile ou trop difficile : seuils réglables, indicatifs. Rédigé pour QME, aucune méthode publiée reprise.',
  },
};
