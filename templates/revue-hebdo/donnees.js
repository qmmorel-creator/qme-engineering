// Base intégrée de la revue hebdomadaire et journal de bord : étapes de la revue guidée, questions de revue
// types (une par étape est proposée chaque semaine, par rotation), échelles d'humeur et d'énergie, repères de
// méthode. Contenu original rédigé pour QME (14/11/2026) : aucune base externe n'est reprise. Rien ne se
// périme. L'humeur et l'énergie sont des indicateurs personnels, sans aucune portée médicale.
(() => {
  window.BASE = {
    // Étapes de la revue guidée, dans l'ordre. `id` sert aussi de clé aux questions.
    etapes: [
      { id: 'tete', nom: 'Vider la tête', titre: 'Qu\'est-ce qui traîne dans ta tête ?', aide: 'Tout ce qui t\'occupe l\'esprit, en vrac, une idée par ligne : tâches, idées, inquiétudes, choses promises. Tu trieras plus tard (dans ton gestionnaire de tâches, par exemple).' },
      { id: 'semaine', nom: 'La semaine passée', titre: 'Regarde ta semaine.', aide: 'Relis ton journal et fais le point sur les trois priorités que tu t\'étais fixées.' },
      { id: 'bilan', nom: 'Réussites et difficultés', titre: 'Qu\'est-ce qui a marché, qu\'est-ce qui a coincé ?', aide: 'Trois réussites, même petites, et ce qui a été difficile. Une ligne chacune suffit.' },
      { id: 'apprentissages', nom: 'Apprentissages', titre: 'Qu\'est-ce que tu retiens ?', aide: 'Ce que tu referais, ce que tu ferais autrement, ce que tu as compris sur ta façon de travailler.' },
      { id: 'priorites', nom: '3 priorités', titre: 'Tes 3 priorités pour la semaine qui vient.', aide: 'Trois résultats qui feraient de la semaine une bonne semaine. Pas une liste de tâches : ce qui compte vraiment.' },
      { id: 'agenda', nom: 'Rendez-vous et échéances', titre: 'Qu\'est-ce qui arrive ?', aide: 'Rendez-vous, échéances et dates à ne pas rater dans les semaines qui viennent. Ils s\'afficheront sur ta page Semaine.' },
      { id: 'energie', nom: 'Énergie et humeur', titre: 'Comment tu te sens, cette semaine ?', aide: 'Deux notes de 1 à 5 et, si tu veux, un mot pour résumer la semaine. Indicateurs personnels, pour voir la tendance.' },
    ],

    // Questions de revue types : 7 à 9 par étape. Chaque semaine, une question par étape est proposée
    // (rotation selon le numéro de semaine) ; « Autre question » passe à la suivante. Réponse facultative.
    questions: {
      tete: [
        'Qu\'est-ce que j\'ai promis à quelqu\'un et pas encore fait ?',
        'Quelle tâche repousses-tu depuis plus d\'une semaine ?',
        'Quel message ou quel appel attend une réponse de ta part ?',
        'Qu\'est-ce qui t\'a réveillé(e) ou préoccupé(e) le soir ?',
        'Quelle idée as-tu eue cette semaine sans la noter ?',
        'Qu\'est-ce que tu dois acheter, réserver ou payer ?',
        'Qu\'est-ce que tu attends des autres, et de qui ?',
        'Quel petit problème revient sans cesse ?',
        'Qu\'est-ce que tu ferais si tu avais une heure de libre demain ?',
      ],
      semaine: [
        'Quel moment de la semaine voudrais-tu revivre ?',
        'Où est passé ton temps, vraiment ?',
        'Quelle journée a été la plus utile, et pourquoi ?',
        'Qu\'est-ce qui t\'a pris plus de temps que prévu ?',
        'Qu\'est-ce que tu as fait qui n\'était prévu nulle part ?',
        'À qui as-tu rendu service cette semaine ?',
        'Quelle réunion ou quel échange aurait pu être évité ?',
        'Qu\'est-ce que tu as appris sur tes clients, ton équipe ou tes proches ?',
      ],
      bilan: [
        'De quoi es-tu fier ou fière cette semaine ?',
        'Quelle difficulté t\'a le plus coûté d\'énergie ?',
        'Quel obstacle reviendra la semaine prochaine si tu ne fais rien ?',
        'Qu\'est-ce qui a avancé sans que tu forces ?',
        'Quel petit progrès mérite d\'être noté ?',
        'Sur quoi as-tu dit oui alors que tu pensais non ?',
        'Qui t\'a aidé(e), et l\'as-tu remercié(e) ?',
        'Quelle décision as-tu prise, et que tu ne regrettes pas ?',
      ],
      apprentissages: [
        'Que ferais-tu autrement si tu recommençais la semaine ?',
        'Quelle habitude t\'a servi, laquelle t\'a freiné(e) ?',
        'À quel moment de la journée travailles-tu le mieux ?',
        'Qu\'est-ce que tu as compris trop tard ?',
        'Quel conseil te donnerais-tu pour la semaine prochaine ?',
        'Qu\'est-ce qui t\'a surpris(e) ?',
        'Quelle règle simple pourrais-tu t\'imposer ?',
        'Qu\'arrêter, que continuer, que commencer ?',
      ],
      priorites: [
        'Si tu ne devais réussir qu\'une chose la semaine prochaine, laquelle ?',
        'Quelle priorité de cette semaine mérite d\'être reprise ?',
        'Qu\'est-ce qui deviendra urgent si tu ne t\'en occupes pas maintenant ?',
        'Quelle tâche importante n\'a pas encore de créneau ?',
        'Qu\'est-ce que tu peux déléguer ou abandonner ?',
        'Quel résultat rendrait vendredi prochain agréable ?',
        'Quelle priorité est personnelle, et pas seulement professionnelle ?',
        'Où bloquer deux heures de travail de fond ?',
      ],
      agenda: [
        'Quel rendez-vous demande une préparation ?',
        'Quelle échéance tombe dans moins de trois semaines ?',
        'Quel anniversaire ou quel événement ne pas oublier ?',
        'Qu\'est-ce qui doit être envoyé avant une date précise ?',
        'Quel déplacement faut-il organiser ?',
        'Quelle journée s\'annonce trop chargée, et que peux-tu déplacer ?',
        'Quel temps libre veux-tu protéger ?',
      ],
      energie: [
        'Qu\'est-ce qui t\'a donné de l\'énergie cette semaine ?',
        'Qu\'est-ce qui t\'en a pris ?',
        'As-tu assez dormi, bougé, pris l\'air ?',
        'Quel moment de pause as-tu vraiment pris ?',
        'De quoi aurais-tu besoin la semaine prochaine pour être en forme ?',
        'Avec qui as-tu passé un bon moment ?',
        'Quel petit plaisir prévoir la semaine prochaine ?',
      ],
    },

    // Échelles de 1 à 5 : libellés écrits partout à côté de la note (jamais la forme ou la couleur seule).
    humeurs: ['', 'Difficile', 'Bof', 'Correct', 'Bien', 'Très bien'],
    energies: ['', 'À plat', 'Basse', 'Moyenne', 'Bonne', 'Pleine forme'],

    // Jours de la semaine, lundi = 1 (semaines ISO, du lundi au dimanche).
    jours: ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],

    // Repères de méthode affichés dans l'application.
    methode: {
      revue: 'La revue hebdomadaire prend 20 à 30 minutes, toujours le même jour : vider la tête, regarder la semaine, noter ce qui a marché et ce qui a coincé, en tirer une leçon, choisir 3 priorités et regarder ce qui arrive. Une revue faite vite vaut mieux qu\'une revue sautée.',
      journal: 'Une ligne par jour, le soir ou le lendemain matin : ce qui s\'est passé, ce qui a compté. En revue, tu relis la semaine en une minute.',
      humeur: 'L\'humeur et l\'énergie sont des repères personnels pour voir la tendance, pas une mesure de santé. Si tu te sens mal plusieurs semaines de suite, parles-en à un proche ou à un professionnel de santé.',
    },
  };
})();
