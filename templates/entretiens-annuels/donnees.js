// Base intégrée des Entretiens annuels et professionnels : trames (questions par thème), thèmes complémentaires,
// natures et statuts de formation, types d'absence, repères réglementaires datés.
// Questions : rédaction originale pour QME. Repères relevés le 14/11/2026 (sources indiquées sur chaque repère) :
// à revérifier chaque année (mise à jour annuelle de ce fichier). L'outil ne remplace pas un conseil juridique.
(() => {
  // q(id, texte) : une question. Les identifiants ne changent jamais (les réponses y sont rattachées).
  const q = (id, texte) => ({ id, texte });

  window.BASE = {
    version: '2026-11-14',

    // Périodicités par défaut (toutes modifiables dans les réglages). Mois sauf mention.
    defauts: {
      annuelActif: true, // l'entretien annuel n'est pas une obligation légale générale : désactivable
      annuelMois: 12,
      premierEppMois: 12, // premier EPP au cours de la première année suivant l'embauche
      eppMois: 48, // puis tous les 4 ans au plus
      bilanAns: 8, // état des lieux récapitulatif
      fenetreJours: 60, // « à venir » : échéance dans les 60 jours
      effacementMois: 12, // proposer d'effacer un salarié sorti depuis 12 mois
      toleranceMois: 3, // contrôle de l'état des lieux : écart toléré entre deux EPP au-delà de la périodicité
    },

    types: [
      { id: 'annuel', nom: 'Entretien annuel', court: 'Annuel', desc: 'Bilan de l\'année, objectifs, besoins. Facultatif légalement, distinct de l\'EPP.' },
      { id: 'epp', nom: 'Entretien de parcours professionnel', court: 'Parcours pro', desc: 'Compétences, parcours, formation, souhaits d\'évolution. Pas d\'évaluation du travail.' },
      { id: 'bilan', nom: 'État des lieux récapitulatif', court: 'État des lieux', desc: 'Tous les 8 ans : un EPP qui fait le point sur le parcours des 8 dernières années.' },
    ],

    // Motif d'un EPP : ajoute des thèmes à la trame.
    motifs: [
      { id: 'periodique', nom: 'Périodique', themes: [] },
      { id: 'premier', nom: 'Premier entretien après l\'embauche', themes: [] },
      { id: 'retour', nom: 'Retour d\'absence', themes: ['retour'] },
      { id: 'mi-carriere', nom: 'Après la visite de mi-carrière', themes: ['mi-carriere'] },
      { id: 'fin-carriere', nom: 'Avant les 60 ans', themes: ['fin-carriere'] },
    ],

    // Trames : thèmes dans l'ordre de l'entretien. « auto » : bloc rempli par l'application (objectifs, formations).
    trames: {
      annuel: [
        { id: 'an-annee', nom: 'L\'année écoulée', questions: [
          q('an1', 'Quelles sont les trois réalisations de l\'année dont tu es le plus satisfait ?'),
          q('an2', 'Quelles difficultés as-tu rencontrées, et qu\'est-ce qui t\'a aidé à les surmonter ?'),
          q('an3', 'Qu\'est-ce qui a changé dans ton poste ou ton équipe depuis le dernier entretien ?'),
          q('an4', 'Sur quoi aurais-tu aimé passer plus de temps ? Et moins ?'),
        ] },
        { id: 'an-objectifs', nom: 'Objectifs de la période', auto: 'objectifs', questions: [
          q('an5', 'Pour chaque objectif : ce qui a été atteint, ce qui ne l\'a pas été, et pourquoi.'),
          q('an6', 'Les moyens prévus étaient-ils suffisants ?'),
        ] },
        { id: 'an-competences', nom: 'Compétences mises en œuvre', questions: [
          q('an7', 'Quelles compétences as-tu le plus utilisées cette année ?'),
          q('an8', 'Lesquelles as-tu développées, et comment ?'),
          q('an9', 'Sur quel point voudrais-tu progresser l\'an prochain ?'),
        ] },
        { id: 'an-travail', nom: 'Organisation et conditions de travail', questions: [
          q('an10', 'Comment juges-tu ta charge de travail sur l\'année : régulière, irrégulière, trop forte ?'),
          q('an11', 'Ton organisation te permet-elle de concilier vie professionnelle et vie personnelle ?'),
          q('an12', 'Les outils, l\'information et les moyens mis à ta disposition sont-ils adaptés ?'),
          q('an13', 'Qu\'est-ce qui pourrait simplifier ton travail au quotidien ?'),
        ] },
        { id: 'an-equipe', nom: 'Relations et fonctionnement d\'équipe', questions: [
          q('an14', 'Comment se passe la collaboration avec l\'équipe et les autres services ?'),
          q('an15', 'Qu\'attends-tu de ton manager pour l\'année qui vient ?'),
        ] },
        { id: 'an-avenir', nom: 'L\'année qui vient', auto: 'nouveaux-objectifs', questions: [
          q('an16', 'Quelles priorités vois-tu pour ton poste l\'an prochain ?'),
          q('an17', 'De quel accompagnement auras-tu besoin (formation, tutorat, outils, temps) ?'),
        ] },
        { id: 'an-commentaires', nom: 'Commentaires', questions: [
          q('an18', 'Commentaire du salarié.'),
          q('an19', 'Commentaire du manager.'),
        ] },
      ],
      epp: [
        { id: 'pp-competences', nom: 'Compétences et qualifications', questions: [
          q('pp1', 'Quelles compétences et qualifications mobilises-tu aujourd\'hui dans ton emploi ?'),
          q('pp2', 'Comment ces compétences devraient-elles évoluer avec les changements de l\'entreprise (outils, organisation, clients, métiers) ?'),
          q('pp3', 'Quelles compétences as-tu et qui ne sont pas utilisées dans ton poste actuel ?'),
        ] },
        { id: 'pp-parcours', nom: 'Situation et parcours professionnel', questions: [
          q('pp4', 'Comment résumerais-tu ton parcours depuis ton arrivée (postes, missions, responsabilités) ?'),
          q('pp5', 'Comment ton métier évolue-t-il, dans l\'entreprise et en dehors ?'),
          q('pp6', 'Qu\'est-ce qui te motive le plus dans ton travail actuel ?'),
        ] },
        { id: 'pp-formation', nom: 'Besoins de formation', auto: 'formations', questions: [
          q('pp7', 'Quelles formations as-tu suivies depuis le dernier entretien de parcours professionnel ?'),
          q('pp8', 'De quelles formations aurais-tu besoin pour ton poste actuel ?'),
          q('pp9', 'Et pour le poste ou le métier que tu envisages ensuite ?'),
        ] },
        { id: 'pp-souhaits', nom: 'Souhaits d\'évolution', questions: [
          q('pp10', 'Où te vois-tu dans trois à cinq ans ?'),
          q('pp11', 'Envisages-tu une évolution dans l\'entreprise (poste, responsabilités, mobilité) ?'),
          q('pp12', 'Envisages-tu une reconversion, une validation des acquis de l\'expérience (VAE) ou un bilan de compétences ?'),
        ] },
        { id: 'pp-dispositifs', nom: 'Information sur les dispositifs', questions: [
          q('pp13', 'Compte personnel de formation (CPF) : as-tu activé ton compte ? Sais-tu comment le consulter ?'),
          q('pp14', 'Abondements que l\'employeur peut financer sur le CPF : information donnée.'),
          q('pp15', 'Conseil en évolution professionnelle (CEP), gratuit : information donnée.'),
        ] },
        { id: 'pp-conclusion', nom: 'Conclusion', questions: [
          q('pp16', 'Ce qui est convenu à l\'issue de l\'entretien (actions, échéances, qui fait quoi).'),
          q('pp17', 'Commentaire du salarié.'),
        ] },
      ],
      bilan: [
        { id: 'bl-entretiens', nom: 'Entretiens des 8 dernières années', auto: 'controle', questions: [
          q('bl1', 'Les entretiens de parcours professionnel prévus ont-ils eu lieu ? Commentaire sur les écarts éventuels.'),
        ] },
        { id: 'bl-formations', nom: 'Formations et certifications', auto: 'formations', questions: [
          q('bl2', 'Formations suivies sur la période, en distinguant celles qui étaient obligatoires pour le poste.'),
          q('bl3', 'Certifications obtenues (diplôme, titre, certificat, VAE).'),
        ] },
        { id: 'bl-progression', nom: 'Progression salariale ou professionnelle', questions: [
          q('bl4', 'Évolutions de poste, de responsabilités ou de qualification sur la période.'),
          q('bl5', 'Progression salariale sur la période (oui ou non, sans montant).'),
        ] },
        { id: 'bl-avenir', nom: 'Perspectives', questions: [
          q('bl6', 'Ce que le salarié souhaite pour les années qui viennent.'),
          q('bl7', 'Ce qui est convenu (formation, mobilité, accompagnement).'),
          q('bl8', 'Commentaire du salarié.'),
        ] },
      ],
    },

    // Thèmes complémentaires, ajoutés selon le motif ou à la demande.
    complements: {
      retour: { id: 'retour', nom: 'Reprise après l\'absence', questions: [
        q('rt1', 'Ce qui a changé pendant l\'absence (équipe, outils, organisation, clients) : point fait ensemble.'),
        q('rt2', 'Besoins pour reprendre dans de bonnes conditions (mise à niveau, formation, adaptation du poste ou des horaires).'),
        q('rt3', 'Point d\'étape convenu après la reprise (date).'),
      ] },
      'mi-carriere': { id: 'mi-carriere', nom: 'Mi-carrière', questions: [
        q('mc1', 'Mesures proposées par le médecin du travail à l\'issue de la visite de mi-carrière (sans détail médical).'),
        q('mc2', 'Adaptation du poste ou de l\'organisation à envisager.'),
        q('mc3', 'Prévention de l\'usure professionnelle : ce qui pèse le plus dans le poste, pistes d\'amélioration.'),
        q('mc4', 'Besoins de formation et souhaits de mobilité ou de reconversion pour la seconde partie de carrière.'),
      ] },
      'fin-carriere': { id: 'fin-carriere', nom: 'Fin de carrière', questions: [
        q('fc1', 'Souhaits sur le maintien dans l\'emploi jusqu\'à la retraite.'),
        q('fc2', 'Aménagements de fin de carrière envisagés (temps partiel, retraite progressive, tutorat, transmission).'),
        q('fc3', 'Transmission des savoir-faire : ce qui doit être transmis, à qui, comment.'),
      ] },
      'forfait-jours': { id: 'forfait-jours', nom: 'Charge de travail (forfait jours)', questions: [
        q('fj1', 'Charge de travail sur la période : volume, pics, jours travaillés.'),
        q('fj2', 'Organisation du travail et respect des temps de repos.'),
        q('fj3', 'Articulation entre activité professionnelle et vie personnelle.'),
        q('fj4', 'Rémunération : commentaire du salarié (sans montant).'),
      ] },
    },

    // Types d'absence après lesquels un EPP est proposé au retour (si aucun EPP dans les 12 mois précédents).
    absences: [
      { id: 'maternite', nom: 'Congé de maternité' },
      { id: 'adoption', nom: 'Congé d\'adoption' },
      { id: 'naissance', nom: 'Congé supplémentaire de naissance' },
      { id: 'parental', nom: 'Congé parental d\'éducation' },
      { id: 'partiel-parental', nom: 'Temps partiel après un congé parental' },
      { id: 'aidant', nom: 'Congé de proche aidant' },
      { id: 'sabbatique', nom: 'Congé sabbatique' },
      { id: 'mobilite', nom: 'Période de mobilité volontaire sécurisée' },
      { id: 'longue-maladie', nom: 'Arrêt longue maladie' },
      { id: 'mandat', nom: 'Fin d\'un mandat syndical' },
    ],

    natures: [
      { id: 'obligatoire', nom: 'Obligatoire pour le poste', court: 'Obligatoire', nonObligatoire: false, desc: 'Conditionne l\'exercice d\'une activité ou d\'une fonction (habilitation, sécurité…).' },
      { id: 'adaptation', nom: 'Adaptation au poste', court: 'Adaptation', nonObligatoire: true, desc: 'Tenir son poste actuel, suivre l\'évolution des outils.' },
      { id: 'developpement', nom: 'Développement des compétences', court: 'Développement', nonObligatoire: true, desc: 'Aller au-delà du poste actuel.' },
      { id: 'certifiante', nom: 'Formation certifiante', court: 'Certifiante', nonObligatoire: true, certification: true, desc: 'Diplôme, titre ou certificat.' },
      { id: 'vae', nom: 'Validation des acquis (VAE)', court: 'VAE', nonObligatoire: true, certification: true, desc: 'Certification obtenue par l\'expérience.' },
      { id: 'bilan-competences', nom: 'Bilan de compétences', court: 'Bilan de compétences', nonObligatoire: true, desc: 'Faire le point sur ses compétences et son projet.' },
    ],
    dispositifs: ['Plan de développement des compétences', 'CPF', 'CPF avec abondement de l\'employeur', 'Projet de transition professionnelle', 'Autre'],
    statutsFormation: [
      { id: 'demandee', nom: 'Demandée' },
      { id: 'acceptee', nom: 'Acceptée' },
      { id: 'planifiee', nom: 'Planifiée' },
      { id: 'realisee', nom: 'Réalisée' },
      { id: 'reportee', nom: 'Reportée' },
      { id: 'refusee', nom: 'Refusée' },
    ],
    origines: [
      { id: 'entretien', nom: 'Entretien' },
      { id: 'salarie', nom: 'Demande du salarié' },
      { id: 'manager', nom: 'Proposition du manager' },
    ],
    statutsObjectif: [
      { id: 'en-cours', nom: 'En cours' },
      { id: 'atteint', nom: 'Atteint' },
      { id: 'partiel', nom: 'Partiellement atteint' },
      { id: 'non-atteint', nom: 'Non atteint' },
      { id: 'abandonne', nom: 'Abandonné' },
    ],

    conseils: [
      ['Saisis l\'historique', 'Pour chaque salarié, note la date du dernier entretien de parcours professionnel et du dernier état des lieux déjà tenus : les échéances partent de là.'],
      ['Planifie, puis prépare', 'Un entretien prévu donne un questionnaire à copier pour que le salarié le prépare. Ses réponses se collent dans l\'entretien.'],
      ['Annuel et parcours, séparés', 'L\'entretien de parcours professionnel ne porte pas sur l\'évaluation du travail : tiens-le à part, même le même jour.'],
      ['Remets la copie', 'Imprime le compte rendu (ou enregistre-le en PDF), fais-le signer et note la date de remise.'],
    ],

    reperes: {
      epp: { titre: 'Entretien de parcours professionnel', texte: 'Remplace l\'entretien professionnel (loi n° 2025-989 du 24 octobre 2025). Un premier au cours de la première année suivant l\'embauche, puis tous les 4 ans ; un accord collectif peut prévoir plus court, jamais plus de 4 ans. Son existence est signalée au salarié dès l\'embauche. Il ne porte pas sur l\'évaluation du travail.', source: 'service-public.gouv.fr, fiche F32040 « Qu\'est-ce qu\'un entretien de parcours professionnel (EPP) ? », vérifiée par le site le 01/10/2026, relevée le 14/11/2026. Code du travail, article L6315-1 (cité par la fiche) : à relire sur Légifrance.' },
      cas: { titre: 'Cas particuliers', texte: 'Un EPP est aussi dû : au retour de certains congés, si aucun EPP n\'a eu lieu dans les 12 mois précédant la reprise ; dans les 2 mois suivant la visite médicale de mi-carrière (vers 45 ans) ; dans les 2 ans précédant les 60 ans du salarié.', source: 'service-public.gouv.fr, fiche F32040, vérifiée le 01/10/2026, relevée le 14/11/2026. Liste des congés : éditions Tissot (page mise à jour le 08/10/2026), à vérifier sur Légifrance.' },
      bilan: { titre: 'État des lieux récapitulatif', texte: 'Tous les 8 ans (6 ans avant la réforme) ; le premier peut intervenir 7 ans après le premier EPP. Il vérifie les entretiens des 8 années et le parcours : formation, certification, progression salariale ou professionnelle. Compte rendu écrit, copie remise au salarié.', source: 'service-public.gouv.fr, fiche F32040, vérifiée le 01/10/2026, relevée le 14/11/2026.' },
      abondement: { titre: 'Abondement de 3 000 € (50 salariés et plus)', texte: 'Dans les entreprises d\'au moins 50 salariés, si le salarié n\'a pas eu les entretiens prévus et au moins une formation non obligatoire sur les 8 ans, l\'employeur abonde son CPF de 3 000 €. En dessous de 50 salariés : dommages et intérêts possibles en cas de litige.', source: 'service-public.gouv.fr, fiche F32040, vérifiée le 01/10/2026, relevée le 14/11/2026 ; Code du travail, articles L6315-1 et L6323-13 (cités) : à relire sur Légifrance.' },
      transition: { titre: 'Salariés présents avant la réforme', texte: 'Les règles de passage (point de départ du cycle de 4 ans et de la période de 8 ans) ne sont pas tranchées par cet outil : saisis la date du dernier entretien professionnel et du dernier état des lieux, les échéances en partent. Les sources consultées indiquent une application depuis le 26/10/2025 et la fin de l\'adaptation des accords collectifs au 01/10/2026.', source: 'Éditions Tissot et legisocial.fr (15/06/2026), relevés le 14/11/2026 ; questions-réponses du ministère du Travail du 12/02/2026 (travail-emploi.gouv.fr) : à consulter.' },
      annuel: { titre: 'Entretien annuel d\'évaluation', texte: 'Aucune obligation légale générale : périodicité au choix (convention collective ou usage). Les méthodes d\'évaluation sont portées à la connaissance du salarié avant leur mise en œuvre. Salariés au forfait jours : un entretien sur la charge de travail est prévu (thème « Charge de travail » de la trame).', source: 'Code du travail, articles L1222-3 et L3121-64 : repères relevés le 14/11/2026, à vérifier sur Légifrance.' },
      rgpd: { titre: 'Données des salariés', texte: 'Ne garder que le nécessaire : prénom et initiale, poste, service, dates. Aucune donnée de santé (on note la date d\'une visite, jamais son contenu), aucun salaire, aucun motif personnel. Informer les salariés du traitement ; effacer les fiches des salariés sortis une fois les délais de conservation de l\'entreprise atteints.', source: 'Référentiel CNIL « Gestion des ressources humaines », repère général relevé le 14/11/2026 : à vérifier.' },
    },
  };
})();
