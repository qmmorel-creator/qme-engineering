// Base intégrée du préparateur d'appel découverte : phases, banque de questions, objections types,
// signaux de qualification et listes de saisie. Contenu original rédigé pour QME (aucun briefing réel
// repris, aucune marque). Les pistes de réponse sont des points de départ à adapter à chaque échange.
(() => {
  // q(id, texte, signal informé ou '', essentielle)
  const q = (id, texte, signal = '', essentielle = false) => ({ id, texte, signal, essentielle });
  // o(id, catégorie, objection, piste de réponse, question de relance)
  const o = (id, cat, texte, piste, relance) => ({ id, cat, texte, piste, relance });

  window.BASE = {
    version: '2026-11-13',

    // Phases dans l'ordre de l'appel. « poids » : part indicative du temps (en %, total 100), utilisée
    // par le plan minuté pour répartir la durée entre les phases retenues.
    phases: [
      { id: 'ouverture', nom: 'Ouverture', court: 'Ouverture', poids: 10, but: 'Remercier, rappeler la durée et l\'objectif, se mettre d\'accord sur le déroulé.' },
      { id: 'situation', nom: 'Situation actuelle', court: 'Situation', poids: 25, but: 'Comprendre comment les choses se passent aujourd\'hui, avec qui et avec quels outils.' },
      { id: 'probleme', nom: 'Problème', court: 'Problème', poids: 20, but: 'Faire décrire la difficulté avec des exemples concrets et récents.' },
      { id: 'impact', nom: 'Impact et enjeux', court: 'Impact', poids: 15, but: 'Mesurer ce que le problème coûte et ce qui se passe si rien ne change.' },
      { id: 'decision', nom: 'Décision et budget', court: 'Décision', poids: 15, but: 'Savoir qui décide, comment, et avec quel budget.' },
      { id: 'delais', nom: 'Délais', court: 'Délais', poids: 5, but: 'Situer l\'échéance et ce qui la détermine.' },
      { id: 'conclusion', nom: 'Conclusion', court: 'Conclusion', poids: 10, but: 'Reformuler, lever les dernières questions, fixer une prochaine étape datée.' },
    ],

    // Banque de questions par phase (84). « signal » : le signal de qualification que la réponse éclaire.
    // « essentielle » : retenue par « Ajouter les essentielles ».
    questions: {
      ouverture: [
        q('ou-01', 'Nous avions prévu ce temps ensemble : est-ce toujours bon pour vous ?', '', true),
        q('ou-02', 'Je vous propose de commencer par votre contexte, puis de voir ensemble si et comment je peux vous aider. Cela vous convient ?', '', true),
        q('ou-03', 'Qu\'est-ce qui vous a donné envie d\'accepter cet échange ?', 'besoin', true),
        q('ou-04', 'Qu\'aimeriez-vous avoir obtenu à la fin de cet appel pour qu\'il vous ait été utile ?', '', true),
        q('ou-05', 'Pouvez-vous me rappeler votre rôle et ce dont vous êtes responsable ?', 'decideur'),
        q('ou-06', 'Quelqu\'un d\'autre aurait-il dû participer à cet échange ?', 'decideur'),
        q('ou-07', 'Qu\'avez-vous déjà regardé ou lu sur le sujet avant notre appel ?'),
        q('ou-08', 'Comment avez-vous entendu parler de nous ?'),
        q('ou-09', 'Avez-vous une contrainte de temps aujourd\'hui dont je dois tenir compte ?'),
        q('ou-10', 'Y a-t-il un point que vous voulez absolument aborder ?'),
        q('ou-11', 'Puis-je prendre quelques notes pendant l\'échange ?'),
        q('ou-12', 'Si nous voyons à la fin que ce n\'est pas pour vous, êtes-vous d\'accord pour me le dire franchement ?'),
      ],
      situation: [
        q('si-01', 'Comment cela se passe-t-il aujourd\'hui, concrètement, du début à la fin ?', '', true),
        q('si-02', 'Qui intervient dans ce fonctionnement, et à quel moment ?', '', true),
        q('si-03', 'Quels outils, fichiers ou prestataires utilisez-vous actuellement pour cela ?', '', true),
        q('si-04', 'Depuis combien de temps fonctionnez-vous ainsi ?'),
        q('si-05', 'Qu\'est-ce qui marche bien et que vous voulez garder ?', '', true),
        q('si-06', 'Quels volumes cela représente-t-il, par semaine ou par mois ?'),
        q('si-07', 'Combien de personnes sont concernées au quotidien ?'),
        q('si-08', 'Qu\'avez-vous déjà essayé pour améliorer les choses ?', 'besoin'),
        q('si-09', 'Pourquoi ces essais n\'ont-ils pas suffi ?'),
        q('si-10', 'Qu\'est-ce qui a changé récemment dans votre activité ?'),
        q('si-11', 'Comment cela s\'organise-t-il entre vos différents sites ou équipes ?'),
        q('si-12', 'Quelles règles ou obligations encadrent cette activité chez vous ?'),
      ],
      probleme: [
        q('pb-01', 'Qu\'est-ce qui vous pose le plus de difficulté aujourd\'hui ?', 'besoin', true),
        q('pb-02', 'Pouvez-vous me donner un exemple récent où cela a coincé ?', '', true),
        q('pb-03', 'À quelle fréquence ce problème se présente-t-il ?', '', true),
        q('pb-04', 'Qui en souffre le plus dans l\'équipe ?'),
        q('pb-05', 'Comment le contournez-vous en attendant ?'),
        q('pb-06', 'Depuis quand ce problème existe-t-il ?'),
        q('pb-07', 'Qu\'est-ce qui, selon vous, en est la cause principale ?'),
        q('pb-08', 'Si vous pouviez changer une seule chose dès demain, laquelle serait-ce ?', 'besoin', true),
        q('pb-09', 'Qu\'est-ce qui vous empêche de le régler vous-mêmes ?'),
        q('pb-10', 'Votre direction partage-t-elle ce constat ?', 'decideur'),
        q('pb-11', 'Y a-t-il d\'autres sujets liés que nous devrions aborder ?'),
        q('pb-12', 'Sur une échelle de 1 à 10, quelle importance a ce sujet pour vous ?', 'besoin'),
      ],
      impact: [
        q('im-01', 'Que vous coûte ce problème aujourd\'hui : du temps, de l\'argent, des clients, de la sérénité ?', 'besoin', true),
        q('im-02', 'Combien de temps y passez-vous, vous et l\'équipe, chaque semaine ?', '', true),
        q('im-03', 'Que se passe-t-il si rien ne change d\'ici un an ?', 'besoin', true),
        q('im-04', 'Quel effet cela a-t-il sur vos clients ou vos usagers ?'),
        q('im-05', 'Quel risque cela fait-il peser : erreur, retard, conformité ?'),
        q('im-06', 'Quel objectif de l\'année ce sujet freine-t-il ?', '', true),
        q('im-07', 'Comment mesureriez-vous qu\'une solution a réussi ?'),
        q('im-08', 'Que feriez-vous du temps ou de l\'argent récupéré ?'),
        q('im-09', 'Qui d\'autre dans l\'organisation serait gagnant si c\'était réglé ?'),
        q('im-10', 'Ce sujet a-t-il déjà été chiffré en interne ?', 'budget'),
        q('im-11', 'Qu\'est-ce qui rend ce sujet plus urgent aujourd\'hui qu\'il y a six mois ?', 'echeance'),
        q('im-12', 'Personnellement, qu\'y gagneriez-vous ?'),
      ],
      decision: [
        q('de-01', 'Comment se prend habituellement une décision de ce type chez vous ?', 'decideur', true),
        q('de-02', 'Qui d\'autre sera impliqué dans le choix ?', 'decideur', true),
        q('de-03', 'Qui aura le dernier mot ?', 'decideur'),
        q('de-04', 'Un budget est-il prévu pour ce sujet ?', 'budget', true),
        q('de-05', 'Dans quelle fourchette d\'investissement vous situez-vous ?', 'budget', true),
        q('de-06', 'Comment ce type de dépense est-il validé : bon de commande, comité, appel d\'offres ?', 'budget'),
        q('de-07', 'Quels critères compteront le plus dans votre choix ?'),
        q('de-08', 'Consultez-vous d\'autres prestataires ou d\'autres solutions ?'),
        q('de-09', 'Qu\'est-ce qui pourrait bloquer le projet en interne ?', 'decideur'),
        q('de-10', 'Avez-vous déjà acheté ce type de prestation ? Comment cela s\'était-il passé ?'),
        q('de-11', 'De quoi auriez-vous besoin pour défendre le projet en interne ?', 'decideur'),
        q('de-12', 'Le budget dépend-il de votre service ou d\'un autre ?', 'budget'),
      ],
      delais: [
        q('dl-01', 'À quelle date aimeriez-vous que ce soit réglé ?', 'echeance', true),
        q('dl-02', 'Qu\'est-ce qui détermine cette date ?', 'echeance', true),
        q('dl-03', 'Quelles sont les prochaines étapes de votre côté, et quand ?', 'echeance', true),
        q('dl-04', 'Y a-t-il une période à éviter : clôture, saison haute, congés ?', 'echeance'),
        q('dl-05', 'Quand pensez-vous prendre votre décision ?', 'echeance', true),
        q('dl-06', 'Que se passe-t-il si cette date n\'est pas tenue ?'),
        q('dl-07', 'Combien de temps prend en général une validation chez vous ?', 'echeance'),
        q('dl-08', 'Le projet dépend-il d\'un autre chantier en cours ?'),
        q('dl-09', 'Quelles ressources pouvez-vous mobiliser de votre côté, et à partir de quand ?'),
        q('dl-10', 'Y a-t-il une échéance réglementaire ou contractuelle ?', 'echeance'),
        q('dl-11', 'Si nous démarrions le mois prochain, serait-ce trop tôt ou trop tard ?', 'echeance'),
        q('dl-12', 'Qui doit être disponible pour lancer le projet ?'),
      ],
      conclusion: [
        q('co-01', 'D\'après ce que vous m\'avez dit, je retiens… Est-ce que j\'ai bien compris ?', '', true),
        q('co-02', 'Qu\'est-ce qui vous a semblé le plus utile dans cet échange ?'),
        q('co-03', 'Reste-t-il une question ou une inquiétude que nous n\'avons pas abordée ?', '', true),
        q('co-04', 'Que proposez-vous comme prochaine étape ?', '', true),
        q('co-05', 'Pouvons-nous fixer dès maintenant la date du prochain échange ?', 'echeance', true),
        q('co-06', 'Qui faut-il inviter au prochain rendez-vous ?', 'decideur'),
        q('co-07', 'Quelles informations dois-je vous envoyer d\'ici là ?'),
        q('co-08', 'De votre côté, que pouvez-vous me transmettre : chiffres, exemples, documents ?'),
        q('co-09', 'Sur une échelle de 1 à 10, où en est votre envie d\'avancer ?', 'besoin'),
        q('co-10', 'Qu\'est-ce qui ferait passer cette note à 10 ?'),
        q('co-11', 'Préférez-vous un échange par téléphone, en visio ou sur place la prochaine fois ?'),
        q('co-12', 'Puis-je vous résumer par écrit ce que nous nous sommes dit ?'),
      ],
    },

    // Catégories d'objections, dans l'ordre d'affichage.
    categoriesObjections: [
      { id: 'prix', nom: 'Prix' },
      { id: 'budget', nom: 'Budget' },
      { id: 'moment', nom: 'Moment' },
      { id: 'besoin', nom: 'Besoin' },
      { id: 'confiance', nom: 'Confiance' },
      { id: 'concurrence', nom: 'Concurrence' },
      { id: 'decision', nom: 'Décision' },
      { id: 'infos', nom: 'Informations' },
      { id: 'risque', nom: 'Risques' },
    ],

    // Objections types (25) : piste de réponse et question de relance, à adapter.
    objections: [
      o('ob-01', 'prix', 'C\'est trop cher.', 'Ne pas défendre le prix tout de suite : demander par rapport à quoi, puis revenir à ce que le problème coûte, chiffré pendant l\'appel.', 'Trop cher par rapport à quoi : un budget prévu, une autre offre, ou ce que le problème vous coûte aujourd\'hui ?'),
      o('ob-02', 'prix', 'Pouvez-vous faire un geste sur le prix ?', 'Ne pas baisser sans contrepartie : ajuster le périmètre, le calendrier ou les modalités plutôt que le tarif seul.', 'Si nous réduisons le périmètre à l\'essentiel, cela répondrait-il à votre contrainte ?'),
      o('ob-03', 'budget', 'Nous n\'avons pas de budget.', 'Distinguer « pas de budget cette année » de « pas de budget pour ce sujet ». Chercher qui arbitre les budgets et quand.', 'Quand vos budgets se décident-ils, et qui les arbitre ?'),
      o('ob-04', 'budget', 'Le budget est déjà engagé ailleurs.', 'Vérifier si le sujet peut entrer dans l\'exercice suivant, ou être découpé en une première étape plus petite.', 'Une première étape réduite trouverait-elle sa place cette année ?'),
      o('ob-05', 'moment', 'Ce n\'est pas le bon moment.', 'Accepter, comprendre ce qui rendrait le moment bon, et fixer une date de reprise plutôt qu\'un « on se rappelle ».', 'Qu\'est-ce qui devra avoir changé pour que ce soit le bon moment ? Je note une date pour en reparler ?'),
      o('ob-06', 'moment', 'Rappelez-moi dans six mois.', 'Vérifier s\'il s\'agit d\'une vraie échéance ou d\'une façon polie de dire non. Demander ce qui se passera d\'ici là.', 'Qu\'est-ce qui se sera passé dans six mois ? Si rien ne change, que vous coûtera l\'attente ?'),
      o('ob-07', 'moment', 'Nous sommes débordés en ce moment.', 'C\'est souvent un symptôme du problème lui-même : relier la charge actuelle au temps que la solution libérerait.', 'Si ce sujet était réglé, combien de temps récupéreriez-vous chaque semaine ?'),
      o('ob-08', 'besoin', 'Nous n\'en avons pas besoin.', 'Respecter la réponse et vérifier qu\'elle repose sur la situation réelle : revenir à un exemple concret évoqué plus tôt.', 'Comment gérez-vous aujourd\'hui le cas dont vous m\'avez parlé ? Est-ce que cela vous convient vraiment ?'),
      o('ob-09', 'besoin', 'Notre façon de faire actuelle fonctionne.', 'Partir de ce qui marche et chercher ses limites : volume, dépendance à une personne, erreurs, temps passé.', 'Que se passerait-il si la personne qui s\'en occupe était absente un mois ?'),
      o('ob-10', 'besoin', 'Ce n\'est pas une priorité.', 'Relier le sujet aux priorités annoncées ; s\'il n\'y en a aucun lien, l\'accepter et fixer une date de reprise.', 'Quelles sont vos priorités cette année ? Ce sujet les freine-t-il ?'),
      o('ob-11', 'besoin', 'Nous allons le faire nous-mêmes.', 'Option légitime : aider à évaluer le coût réel (temps interne, maintenance, continuité) sans dénigrer.', 'Qui s\'en chargerait, sur quel temps, et qui le maintiendra ensuite ?'),
      o('ob-12', 'confiance', 'Je ne vous connais pas.', 'Proposer des preuves vérifiables (méthode, exemples anonymisés, première étape courte) plutôt que des promesses.', 'Qu\'est-ce qui vous permettrait de juger sur pièce : un exemple, un essai, une première étape limitée ?'),
      o('ob-13', 'confiance', 'Nous avons eu une mauvaise expérience avec un prestataire.', 'Écouter en détail ce qui s\'est mal passé : c\'est la liste des points sur lesquels rassurer.', 'Qu\'est-ce qui s\'est mal passé, précisément ? Qu\'auriez-vous voulu voir à la place ?'),
      o('ob-14', 'confiance', 'Vous êtes trop petit pour nous.', 'Rassurer sur la continuité : documentation, réversibilité, interlocuteur unique, engagements de délais.', 'Qu\'est-ce qui vous inquiète : la disponibilité, la continuité, la capacité à suivre ?'),
      o('ob-15', 'concurrence', 'Nous travaillons déjà avec quelqu\'un.', 'Ne pas critiquer le prestataire en place ; chercher ce qui manque ou ce qui pourrait compléter.', 'Qu\'est-ce qui vous plaît dans cette collaboration, et qu\'aimeriez-vous en plus ?'),
      o('ob-16', 'concurrence', 'Un autre prestataire est moins cher.', 'Comparer le périmètre plutôt que le prix : ce qui est inclus, les délais, ce qui reste à votre charge.', 'Les deux offres couvrent-elles exactement la même chose ?'),
      o('ob-17', 'concurrence', 'Il existe un logiciel gratuit qui fait ça.', 'Reconnaître l\'option et explorer pourquoi elle n\'est pas déjà en place.', 'L\'avez-vous essayé ? Qu\'est-ce qui a manqué ?'),
      o('ob-18', 'decision', 'Je dois en parler à ma direction.', 'Bon signe si c\'est réel : préparer ensemble les arguments et proposer d\'être présent à l\'étape suivante.', 'Que va-t-elle vous demander ? Voulez-vous une note d\'une page, ou que nous la rencontrions ensemble ?'),
      o('ob-19', 'decision', 'Ce n\'est pas moi qui décide.', 'Faire de l\'interlocuteur un allié : comprendre le circuit de décision et ce qui compte pour la personne qui décide.', 'Qui décide, et comment pourrions-nous lui présenter le sujet ensemble ?'),
      o('ob-20', 'decision', 'Il faut passer par un appel d\'offres.', 'Demander le calendrier et les critères ; rester dans les règles de mise en concurrence de l\'organisation.', 'Quand la consultation sera-t-elle lancée, et quels critères pèseront le plus ?'),
      o('ob-21', 'infos', 'Envoyez-moi une documentation.', 'Souvent une façon d\'écourter : accepter, cibler l\'envoi sur un point précis et fixer un échange pour en parler.', 'Volontiers : sur quel point précis ? Je vous l\'envoie et nous en reparlons quel jour ?'),
      o('ob-22', 'infos', 'Faites-moi une proposition chiffrée.', 'Trop tôt sans informations : chiffrer un besoin mal compris expose à se tromper. Proposer de compléter d\'abord deux ou trois points.', 'Pour vous chiffrer juste, il me manque deux ou trois éléments : pouvons-nous les voir maintenant ?'),
      o('ob-23', 'risque', 'Nous avons peur que ce soit compliqué à mettre en place.', 'Découper : une première étape courte, un périmètre réduit, des jalons visibles.', 'Quelle serait la plus petite étape qui vous montrerait que cela fonctionne ?'),
      o('ob-24', 'risque', 'Les équipes ne vont pas l\'adopter.', 'Associer les utilisateurs dès le départ ; demander qui serait volontaire pour tester.', 'Qui dans l\'équipe serait partant pour l\'essayer en premier ?'),
      o('ob-25', 'risque', 'Nous ne voulons pas dépendre d\'un prestataire.', 'Expliquer la réversibilité : données exportables, documentation, transfert de compétences.', 'Qu\'est-ce qui vous rassurerait : la documentation, la formation, la propriété des données ?'),
    ],

    // Signaux de qualification, avec le libellé de chaque niveau.
    // Règle du score : oui = 2 points, partiel = 1, non ou inconnu = 0 ; total sur 8 (voir regles.js).
    signaux: [
      { id: 'besoin', nom: 'Besoin', niveaux: { inconnu: 'Pas encore exploré', non: 'Aucun besoin reconnu', partiel: 'Reconnu, pas prioritaire', oui: 'Explicite et prioritaire' } },
      { id: 'budget', nom: 'Budget', niveaux: { inconnu: 'Pas encore exploré', non: 'Aucun budget possible', partiel: 'À trouver ou à arbitrer', oui: 'Budget identifié' } },
      { id: 'decideur', nom: 'Décideur', niveaux: { inconnu: 'Pas encore exploré', non: 'Inconnu, pas d\'accès', partiel: 'Identifié, absent de l\'appel', oui: 'Présent ou accès confirmé' } },
      { id: 'echeance', nom: 'Échéance', niveaux: { inconnu: 'Pas encore explorée', non: 'Aucune échéance', partiel: 'Floue ou lointaine', oui: 'Échéance datée' } },
    ],

    niveauxQualif: {
      qualifie: { nom: 'Qualifié', detail: 'Besoin explicite et au moins 6 points sur 8 : préparer la proposition.' },
      'a-creuser': { nom: 'À creuser', detail: '3 à 5 points, ou besoin pas encore explicite : un second échange est nécessaire.' },
      froid: { nom: 'Froid', detail: 'Moins de 3 points : garder le contact, sans forcer.' },
      'hors-cible': { nom: 'Hors cible', detail: 'Aucun besoin reconnu : remercier et clore proprement.' },
    },

    durees: [15, 20, 30, 45, 60, 90],
    canaux: [
      { id: 'telephone', nom: 'Téléphone' },
      { id: 'visio', nom: 'Visio' },
      { id: 'sur-place', nom: 'Sur place' },
    ],
    tailles: [
      { id: '', nom: 'Non précisée' },
      { id: 'independant', nom: 'Indépendant, sans salarié' },
      { id: 'tpe', nom: '1 à 9 salariés' },
      { id: 'pe', nom: '10 à 49 salariés' },
      { id: 'me', nom: '50 à 249 salariés' },
      { id: 'eti', nom: '250 à 4 999 salariés' },
      { id: 'ge', nom: '5 000 salariés et plus' },
      { id: 'public', nom: 'Organisme public' },
      { id: 'asso', nom: 'Association' },
    ],
    secteurs: ['Industrie', 'BTP et construction', 'Commerce', 'Services aux entreprises', 'Conseil', 'Numérique', 'Santé et médico-social', 'Éducation et formation', 'Collectivité ou administration', 'Associatif', 'Transport et logistique', 'Hôtellerie et restauration', 'Finance et assurance', 'Immobilier', 'Énergie et environnement', 'Agriculture et agroalimentaire', 'Culture et loisirs'],
    fonctions: ['Dirigeant ou dirigeante', 'Direction générale', 'Direction administrative et financière', 'Direction des opérations', 'Direction commerciale', 'Direction marketing', 'Direction des ressources humaines', 'Direction des systèmes d\'information', 'Responsable de service', 'Responsable qualité', 'Responsable des achats', 'Chef de projet', 'Associé ou associée', 'Élu ou élue', 'Directeur ou directrice des services'],

    conseils: [
      ['Un objectif par appel', 'Écris ce que tu veux savoir à la fin de l\'échange : c\'est lui qui guide le choix des questions.'],
      ['Des hypothèses à vérifier', 'Note ce que tu crois savoir sur le prospect : l\'appel sert à le confirmer ou à le corriger.'],
      ['Moins de questions, mieux posées', 'Compte environ 2 minutes par question : le plan minuté te prévient si tu en prévois trop.'],
      ['Toujours une prochaine étape datée', 'Un appel sans date de suite se perd : fixe-la avant de raccrocher.'],
    ],

    // Données personnelles (RGPD) : règle de conservation proposée pour les prospects.
    rgpd: {
      conservationMois: 36,
      texte: 'Données minimales : l\'organisation, la fonction de ton interlocuteur et, si tu veux, son prénom. Pas de nom de famille, d\'e-mail ni de téléphone. N\'écris aucune donnée sensible (santé, opinions, vie privée) dans les notes.',
      source: 'Repère CNIL : les données d\'un prospect peuvent être conservées 3 ans à compter de la collecte ou du dernier contact venant du prospect (questions-réponses sur les référentiels « gestion des activités commerciales », cnil.fr, consulté le 13/11/2026). À vérifier pour ton activité.',
    },
  };
})();
