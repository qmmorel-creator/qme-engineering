// Quiz QME pour étudiants et jeunes adultes (tutoiement) : source unique des stories et Reels quiz
// (docs/templates/communication/jeux/stories.html), réutilisable par un futur jeu du site.
// Chaque chiffre est un calcul sur un exemple fictif, ou vient d'un template ou d'une source citée dans `source`.
(function (racine) {
  'use strict';

  const QUIZ = [
    { jour: 'lundi 23/11', couleur: 'rouge', theme: 'Habitudes', slug: 'habitudes-66-jours',
      question: 'Combien de jours pour qu\'une habitude devienne automatique ?',
      choix: ['7 jours', '21 jours', '66 jours', '1 an'], bonne: 2,
      grand: '66 jours', texte: 'Pas 21 : c\'est un mythe. Dans l\'étude qui l\'a mesuré, il a fallu 66 jours en valeur médiane, de 18 à 254 selon les gens.',
      calcul: 'Bonne nouvelle : rater un jour ne remet pas le compteur à zéro. Source : Lally et al., European Journal of Social Psychology, 2010.',
      source: 'Lally, van Jaarsveld, Potts et Wardle, « How are habits formed », European Journal of Social Psychology, 40 (6), 2010', produit: 'Suivi d\'habitudes', slugProduit: 'habitudes' },
    { jour: 'mardi 24/11', couleur: 'jaune', theme: 'Budget', slug: 'budget-snack',
      question: '5 € de snack ou de café, du lundi au vendredi. Combien par an ?',
      choix: ['260 €', '650 €', '1 300 €', '1 825 €'], bonne: 2,
      grand: '1 300 €', texte: 'Ce n\'est pas le café, le problème. C\'est de ne pas le voir passer.',
      calcul: '5 € × 5 jours × 52 semaines = 1 300 €. Exemple fictif.',
      source: 'calcul', produit: 'Mon Budget', slugProduit: 'budget' },
    { jour: 'mercredi 25/11', couleur: 'bleu', theme: 'Tâches', slug: 'taches-80-lignes',
      question: 'Ta liste fait 80 lignes et tu ne sais pas par où commencer. Le vrai problème ?',
      choix: ['la liste est trop longue', 'le tri', 'le manque de temps', 'la motivation'], bonne: 1,
      grand: 'Le tri', texte: 'Tu notes tout d\'abord, sans réfléchir. Puis tu tries une fois : faire, planifier, déléguer, abandonner.',
      calcul: 'Ensuite, 3 à 5 tâches au focus pour la journée.',
      source: 'Reel IG-56', produit: 'Gestionnaire de tâches', slugProduit: 'taches' },
    { jour: 'jeudi 26/11', couleur: 'rouge', theme: 'Habitudes', slug: 'habitudes-traitement',
      question: 'Ton traitement du matin : pris ou pas ? Tu ne sais plus. Tu fais quoi ?',
      choix: ['j\'en reprends un, au cas où', 'je saute, tant pis', 'je regarde si je l\'ai coché', 'je devine'], bonne: 2,
      grand: 'Coché = pris', texte: 'Un geste au moment de la prise, et le doute disparaît. Le Suivi d\'habitudes te sert de pense-bête, chaque matin.',
      calcul: 'Outil d\'aide, pas un dispositif médical : en cas d\'oubli, suis ta prescription ou demande à ton pharmacien.',
      source: 'templates/habitudes (habitude « Traitement du matin pris », AVERTISSEMENT_SANTE)', produit: 'Suivi d\'habitudes', slugProduit: 'habitudes' },
    { jour: 'vendredi 27/11', couleur: 'jaune', theme: 'Révisions', slug: 'revision-200',
      question: '40 chapitres à revoir 5 fois chacun avant tes partiels. Combien de révisions ?',
      choix: ['45', '80', '200', '400'], bonne: 2,
      grand: '200', texte: 'Sur 30 jours, c\'est environ 7 révisions par jour. Impossible à suivre de tête.',
      calcul: 'Le Planning de révision fait revenir chaque chapitre au bon moment et te donne la liste du jour.',
      source: 'calcul (40 × 5, donné dans la question)', produit: 'Planning de révision', slugProduit: 'revision' },
    { jour: 'samedi 28/11', couleur: 'bleu', theme: 'Budget', slug: 'budget-50-30-20',
      question: 'Règle 50/30/20 : sur 1 200 € par mois, combien pour tes envies ?',
      choix: ['240 €', '360 €', '400 €', '600 €'], bonne: 1,
      grand: '360 €', texte: '50 % pour les besoins, 30 % pour les envies, 20 % pour l\'épargne. Un repère, pas une loi.',
      calcul: '600 € de besoins, 360 € d\'envies, 240 € d\'épargne. Exemple fictif.',
      source: 'templates/budget/regles.js (repère 50/30/20)', produit: 'Mon Budget', slugProduit: 'budget' },
    { jour: 'dimanche 29/11', couleur: 'rouge', theme: 'Tâches', slug: 'taches-urgent',
      question: 'Une tâche urgente, mais pas importante. Tu en fais quoi ?',
      choix: ['je m\'y mets à fond', 'je la planifie', 'je l\'expédie ou je la délègue', 'je l\'abandonne'], bonne: 2,
      grand: 'L\'expédier', texte: 'En quelques minutes, ou tu la délègues. Ton temps va d\'abord à ce qui est important.',
      calcul: 'Urgent et important : faire. Important : planifier. Urgent seulement : expédier ou déléguer. Ni l\'un ni l\'autre : abandonner.',
      source: 'Reel IG-56', produit: 'Gestionnaire de tâches', slugProduit: 'taches' },
    { jour: 'lundi 30/11', couleur: 'jaune', theme: 'Révisions', slug: 'revision-feuille-blanche',
      question: 'Pour retenir un chapitre, le plus efficace ?',
      choix: ['le relire 3 fois', 'le surligner', 'le réciter sans regarder', 'le recopier'], bonne: 2,
      grand: 'Réciter', texte: 'Sans regarder : ferme le cours, écris tout ce dont tu te souviens, puis complète. C\'est l\'effort de rappel qui fixe la mémoire, pas la relecture.',
      calcul: 'La méthode de la feuille blanche, l\'une des 12 méthodes expliquées pas à pas dans le Planning de révision.',
      source: 'templates/revision/donnees.js (méthode « Rappel sur feuille blanche »)', produit: 'Planning de révision', slugProduit: 'revision' },
    { jour: 'mardi 01/12', couleur: 'bleu', theme: 'Sondage', slug: 'sondage',
      question: 'Ce que tu lâches en premier ?',
      choix: ['les révisions', 'le budget', 'le sport', 'la to-do list'], bonne: null,
      grand: '1 minute', texte: 'Combien te coûte ta désorganisation ? 4 questions : tes euros, tes heures et tes séances perdues, sur un an.',
      calcul: '', source: 'diagnostic/', produit: '', slugProduit: '' },
  ];

  // Espaces insécables dans les nombres et devant les unités (aucune coupure « 1 / 300 € »).
  const insec = (t) => t.replace(/(\d) (?=\d)/g, '$1 ').replace(/(\d) (?=€|%|km|jours|h\b|min|séances|semaines)/g, '$1 ');
  for (const q of QUIZ) for (const k of ['question', 'grand', 'texte', 'calcul']) q[k] = insec(q[k]);

  racine.QUIZ_QME = QUIZ;
})(typeof window !== 'undefined' ? window : globalThis);
