// Base intégrée du tableau de bord annuel : couleurs fixes, domaines de vie types avec leurs questions
// d'évaluation, objectifs modèles (méthode OKR : un objectif, des résultats clés mesurables), actions types,
// questions des revues trimestrielle et annuelle, repères de méthode.
// Contenu original rédigé pour QME. La roue de vie est un outil classique de coaching, la méthode OKR une
// méthode de gestion d'objectifs largement documentée : aucune base externe n'est reprise. Rien ne se périme.
// Résultat clé : type « nombre » (de `depart` vers `cible`, dans un sens ou dans l'autre) ou « case » (fait / pas fait).
(() => {
  const nb = (titre, cible, unite, depart = 0) => ({ titre, type: 'nombre', depart, cible, unite });
  const fait = (titre) => ({ titre, type: 'case' });
  const o = (titre, resultats, pourquoi = '') => ({ titre, pourquoi, resultats });

  window.BASE = {
    // Une couleur par domaine, dans cet ordre (jamais générée). Palette validée avec le validateur du skill
    // dataviz (luminosité, saturation, séparation pour les daltonismes) ; la moutarde, peu contrastée sur
    // blanc, est toujours accompagnée de son nom et de sa note écrits.
    couleurs: [
      { id: 'bleu', hex: '#2B5DA3', nom: 'Bleu', texte: '#fff', teinte: '#D8E4F0' },
      { id: 'rouge', hex: '#B84A34', nom: 'Brique', texte: '#fff', teinte: '#F8DCD3' },
      { id: 'jaune', hex: '#C99A1E', nom: 'Moutarde', texte: '#24221F', teinte: '#FBEBC2' },
      { id: 'vert', hex: '#2E7D4F', nom: 'Vert', texte: '#fff', teinte: '#D7EBDD' },
      { id: 'prune', hex: '#7A3E6B', nom: 'Prune', texte: '#fff', teinte: '#EBDBE6' },
      { id: 'ciel', hex: '#4A90C2', nom: 'Bleu ciel', texte: '#24221F', teinte: '#DCEBF5' },
      { id: 'orange', hex: '#D5732F', nom: 'Orange', texte: '#24221F', teinte: '#F9E0CC' },
      { id: 'framboise', hex: '#A23E6E', nom: 'Framboise', texte: '#fff', teinte: '#F1D8E3' },
    ],

    // Domaines de vie types. `defaut` : proposés cochés au premier lancement (8 au plus, une couleur chacun).
    // Trois questions par domaine, notées de 0 (pas du tout) à 10 (tout à fait) : la note du domaine est
    // leur moyenne. Formulées pour qu'une note haute soit toujours la situation souhaitée.
    domaines: [
      { id: 'sante', nom: 'Santé et forme', defaut: true, questions: [
        'Je me sens en forme et j\'ai de l\'énergie au quotidien.',
        'Je bouge régulièrement : marche, sport, activité physique.',
        'Mon sommeil et mon alimentation me conviennent.'] },
      { id: 'travail', nom: 'Travail et carrière', defaut: true, questions: [
        'Mon travail a du sens pour moi.',
        'Ma charge de travail est tenable sur la durée.',
        'J\'avance vers le poste ou le métier que je vise.'] },
      { id: 'argent', nom: 'Argent', defaut: true, questions: [
        'Mes dépenses restent sous mes revenus chaque mois.',
        'J\'ai une épargne de précaution qui me rassure.',
        'Je sais où va mon argent et je m\'en sens maître.'] },
      { id: 'famille', nom: 'Famille', defaut: true, questions: [
        'Je passe du temps de qualité avec ma famille.',
        'Les relations avec mes proches sont apaisées.',
        'Je suis là dans les moments qui comptent pour mes proches.'] },
      { id: 'couple', nom: 'Couple et vie amoureuse', defaut: true, questions: [
        'Ma vie amoureuse correspond à ce que je souhaite, en couple ou non.',
        'Je me sens écouté(e) et soutenu(e).',
        'Nous prenons du temps à deux, ou je prends du temps pour rencontrer.'] },
      { id: 'amis', nom: 'Amis et vie sociale', defaut: true, questions: [
        'Je vois mes amis aussi souvent que je le souhaite.',
        'J\'ai des personnes sur qui compter.',
        'J\'entretiens mes liens et je fais de nouvelles rencontres.'] },
      { id: 'developpement', nom: 'Développement personnel', defaut: true, questions: [
        'J\'apprends régulièrement quelque chose de nouveau.',
        'Je prends le temps de réfléchir à ce que je veux.',
        'Je me sens progresser en tant que personne.'] },
      { id: 'loisirs', nom: 'Loisirs et plaisir', defaut: true, questions: [
        'J\'ai du temps pour des activités qui me font plaisir.',
        'Je m\'accorde de vraies pauses sans culpabiliser.',
        'Je découvre, je voyage ou je crée.'] },
      { id: 'cadre', nom: 'Cadre de vie', questions: [
        'Mon logement me convient.',
        'Mon quartier et ma ville me plaisent.',
        'Mon intérieur est rangé et facile à vivre.'] },
      { id: 'sens', nom: 'Engagement et sens', questions: [
        'Je contribue à quelque chose qui me dépasse : association, bénévolat, transmission.',
        'Mes choix sont alignés avec mes valeurs.',
        'Je me sens utile aux autres.'] },
      { id: 'serenite', nom: 'Sérénité', questions: [
        'Je gère bien mon stress.',
        'Je prends des moments de calme pour moi.',
        'Je me sens globalement en paix.'] },
      { id: 'etudes', nom: 'Études et formation', questions: [
        'Je suis à jour dans mes cours ou ma formation.',
        'Je comprends et retiens ce que j\'étudie.',
        'Je sais vers quoi mes études me mènent.'] },
    ],

    // Objectifs modèles par domaine : un objectif qualitatif, 1 à 3 résultats clés mesurables.
    // Cibles indicatives, à adapter (le point de départ est toujours à saisir).
    objectifs: {
      sante: [
        o('Retrouver la forme', [nb('Séances de sport par semaine, en moyenne', 3, 'séances'), fait('Une course de 10 km terminée'), nb('Jours à 8 000 pas ou plus', 200, 'jours')], 'Avoir de l\'énergie pour le reste.'),
        o('Mieux dormir', [nb('Nuits de 7 h ou plus, par semaine', 5, 'nuits'), nb('Soirs par semaine sans écran 30 min avant le coucher', 5, 'soirs')]),
        o('Faire le point sur ma santé', [fait('Bilan chez le médecin traitant fait'), fait('Rendez-vous chez le dentiste fait'), fait('Vaccins et dépistages vérifiés avec un professionnel')]),
      ],
      travail: [
        o('Évoluer dans mon poste', [fait('Entretien annuel préparé avec 3 réalisations chiffrées'), fait('Nouvelle responsabilité obtenue'), nb('Heures de formation suivies', 20, 'h')]),
        o('Retrouver un équilibre', [nb('Soirs par semaine sans e-mail professionnel', 5, 'soirs'), nb('Jours de congés réellement posés', 25, 'jours')]),
        o('Préparer une reconversion', [nb('Personnes du métier visé rencontrées', 6, 'personnes'), fait('Bilan de compétences fait'), fait('Formation choisie et financement trouvé')]),
      ],
      argent: [
        o('Constituer une épargne de précaution', [nb('Mois de dépenses mis de côté', 3, 'mois'), fait('Virement automatique mis en place le jour de la paie')], 'Ne plus angoisser au moindre imprévu.'),
        o('Dépenser moins sans me priver', [nb('Dépenses mensuelles moyennes', 2100, '€', 2400), nb('Abonnements inutiles résiliés', 3, 'abonnements')]),
        o('Rembourser une dette', [nb('Reste à rembourser', 0, '€', 3000), nb('Mensualités payées à temps', 12, 'mois')]),
      ],
      famille: [
        o('Plus de temps de qualité en famille', [nb('Sorties ou activités en famille par mois', 2, 'sorties'), nb('Repas sans écran par semaine', 4, 'repas')]),
        o('Garder le lien avec mes proches éloignés', [nb('Appels ou visites par mois', 4, 'fois'), fait('Un rassemblement familial organisé')]),
        o('Mener un projet en famille', [fait('Projet choisi ensemble'), nb('Étapes réalisées', 5, 'étapes')]),
      ],
      couple: [
        o('Prendre du temps à deux', [nb('Soirées à deux par mois', 2, 'soirées'), fait('Un week-end à deux')]),
        o('Mieux nous parler', [nb('Semaines avec un vrai moment d\'échange', 40, 'semaines')]),
        o('Faire de nouvelles rencontres', [nb('Activités ou soirées où rencontrer du monde', 12, 'sorties')]),
      ],
      amis: [
        o('Voir mes amis plus souvent', [nb('Moments avec des amis par mois', 4, 'fois'), fait('Un week-end ou un voyage entre amis')]),
        o('Élargir mon cercle', [nb('Nouvelles activités de groupe essayées', 3, 'activités'), nb('Nouvelles personnes revues au moins deux fois', 3, 'personnes')]),
        o('Recevoir chez moi', [nb('Repas ou soirées organisés', 6, 'fois')]),
      ],
      developpement: [
        o('Lire davantage', [nb('Livres lus', 12, 'livres')]),
        o('Apprendre une compétence', [nb('Heures de pratique', 50, 'h'), fait('Niveau ou certificat validé')]),
        o('Progresser dans une langue', [nb('Séances ou leçons', 100, 'séances'), fait('Une conversation de 15 minutes tenue')]),
      ],
      loisirs: [
        o('Reprendre une passion', [nb('Séances de pratique', 30, 'séances'), fait('Un projet terminé : morceau, objet, œuvre')]),
        o('Découvrir de nouveaux lieux', [nb('Week-ends ou journées découverte', 4, 'sorties'), fait('Un voyage préparé et fait')]),
        o('Déconnecter vraiment', [nb('Journées sans écran de loisir', 12, 'jours')]),
      ],
      cadre: [
        o('Désencombrer mon logement', [nb('Pièces triées', 6, 'pièces'), nb('Objets donnés ou vendus', 50, 'objets')]),
        o('Améliorer mon logement', [nb('Petits travaux prévus réalisés', 3, 'travaux')]),
        o('Déménager', [nb('Visites faites', 10, 'visites'), fait('Nouveau logement signé')]),
      ],
      sens: [
        o('M\'engager pour une cause', [fait('Association choisie'), nb('Heures de bénévolat', 40, 'h')]),
        o('Transmettre', [nb('Personnes accompagnées : tutorat, mentorat, aide', 2, 'personnes')]),
      ],
      serenite: [
        o('Réduire mon stress', [nb('Séances de respiration, de relaxation ou de méditation', 100, 'séances'), nb('Soirs par semaine sans travail', 5, 'soirs')]),
        o('Ralentir', [nb('Demi-journées rien que pour moi par mois', 2, 'demi-journées')]),
      ],
      etudes: [
        o('Réussir mon année', [nb('Moyenne générale', 13, '/20', 11), nb('Examens validés', 6, 'examens')]),
        o('Préparer mon orientation', [nb('Formations ou métiers explorés', 5, 'pistes'), fait('Dossiers de candidature envoyés')]),
      ],
    },

    // Actions types par domaine : idées concrètes pour remplir un trimestre.
    actions: {
      sante: ['Prendre rendez-vous pour un bilan', 'S\'inscrire à un club ou à un cours', 'Caler 3 créneaux de sport dans l\'agenda', 'Fixer une heure de coucher et s\'y tenir'],
      travail: ['Préparer l\'entretien annuel', 'Demander un retour à mon manager', 'Choisir une formation', 'Couper les notifications après 19 h'],
      argent: ['Faire le bilan des dépenses du trimestre', 'Mettre en place un virement d\'épargne', 'Trier les abonnements', 'Comparer mon assurance'],
      famille: ['Planifier une sortie en famille', 'Appeler un proche chaque semaine', 'Organiser un repas de famille', 'Préparer les vacances ensemble'],
      couple: ['Réserver une soirée à deux', 'Prévoir un week-end à deux', 'Instaurer un moment d\'échange hebdomadaire', 'S\'inscrire à une activité'],
      amis: ['Organiser un dîner', 'Relancer un ami perdu de vue', 'Proposer une sortie de groupe', 'Rejoindre une association ou un club'],
      developpement: ['Choisir les 3 prochains livres', 'Bloquer 2 h d\'apprentissage par semaine', 'S\'inscrire à un cours en ligne', 'Tenir un carnet de bord'],
      loisirs: ['Réserver un week-end', 'Ressortir le matériel de ma passion', 'Bloquer une demi-journée de loisir', 'Préparer un voyage'],
      cadre: ['Trier une pièce', 'Donner ou vendre ce qui ne sert plus', 'Faire réaliser un devis', 'Réaménager un coin de vie'],
      sens: ['Contacter une association', 'Proposer mon aide à un proche', 'Participer à une collecte', 'Partager une compétence'],
      serenite: ['Essayer 10 minutes de calme par jour', 'Identifier ce qui me stresse', 'Planifier une vraie coupure', 'Ranger mon agenda de la semaine'],
      etudes: ['Faire un planning de révision', 'Rencontrer un conseiller d\'orientation', 'Rejoindre un groupe de travail', 'Visiter un salon ou une journée portes ouvertes'],
    },

    // Questions de la revue (bilan écrit). La revue du 4e trimestre est le bilan annuel : elle ajoute les
    // questions `annuelle`.
    bilan: {
      trimestrielle: [
        ['reussites', 'Qu\'est-ce qui a bien marché ce trimestre ?', 'Ce qui te rend content(e), même petit.'],
        ['difficultes', 'Qu\'est-ce qui a coincé, et pourquoi ?', 'Manque de temps, d\'envie, objectif mal posé…'],
        ['arreter', 'J\'arrête…', 'Une chose qui te coûte plus qu\'elle ne t\'apporte.'],
        ['continuer', 'Je continue…', 'Ce qui marche et que tu gardes.'],
        ['commencer', 'Je commence…', 'Une seule nouveauté, pour le trimestre qui vient.'],
      ],
      annuelle: [
        ['fierte', 'Quelle est ma plus grande fierté de l\'année ?', 'Une réussite, un moment, un changement.'],
        ['lecon', 'Quelle leçon je retiens ?', 'Ce que tu ferais autrement.'],
        ['mot', 'Mon mot pour l\'année qui vient', 'Un mot ou une phrase qui donne le cap.'],
      ],
    },

    // Repères de méthode affichés dans l'application (onglet Objectifs et revue).
    methode: {
      roue: 'La roue de vie est un outil classique de coaching : on note chaque domaine de 0 à 10 pour voir d\'un coup d\'œil ce qui va bien et ce qui demande de l\'attention. Une roue « bien ronde » compte plus qu\'une roue « grande ».',
      okr: 'Méthode OKR (objectifs et résultats clés) : un objectif dit ce que tu veux, en mots qui motivent ; 1 à 3 résultats clés disent comment tu sauras que tu y es, avec un chiffre ou un fait vérifiable. Un objectif ambitieux atteint aux deux tiers est déjà un vrai progrès.',
      trimestre: 'Un an, c\'est loin ; un trimestre se planifie. Chaque trimestre, choisis 1 à 3 domaines prioritaires et quelques actions concrètes. Ce qui n\'est pas fait se reporte ou s\'abandonne, sans culpabilité.',
      revue: 'La revue prend 20 à 30 minutes à la fin de chaque trimestre : noter la roue, mettre à jour les résultats clés, écrire le bilan, puis choisir les priorités et les actions du trimestre suivant. La revue du 4e trimestre est le bilan de l\'année.',
    },

    // Unités proposées pour les résultats clés.
    unites: ['fois', 'séances', 'jours', 'semaines', 'mois', 'h', 'km', 'livres', '€', '%', '/20', 'kg', 'étapes', 'personnes'],
  };
})();
