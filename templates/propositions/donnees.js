// Base intégrée des Propositions commerciales QME (rédigée pour QME, aucune donnée datée ni règle légale).
// Trames par métier : questions de contexte, objectifs, livrables, étapes de planning (en semaines),
// trois options types (bon / mieux / premium) et conditions commerciales types, toutes modifiables.
// Les prix ne sont jamais fournis : chaque option est chiffrée par l'utilisateur.
// Mentions légales, TVA et détail chiffré : dans le devis (template Générateur de devis), pas ici.
globalThis.BASE = {
  version: 1,
  typesBlocs: [
    { id: 'presentation', nom: 'Présentation', couleur: 'var(--bleu)' },
    { id: 'methode', nom: 'Méthode', couleur: 'var(--jaune)' },
    { id: 'references', nom: 'Références', couleur: 'var(--rouge)' },
    { id: 'engagements', nom: 'Engagements', couleur: 'var(--encre)' },
    { id: 'autre', nom: 'Autre', couleur: 'var(--discret)' },
  ],
  // Blocs types de la bibliothèque : gabarits à personnaliser (les crochets signalent ce qui reste à écrire).
  blocsTypes: [
    { type: 'presentation', titre: 'Qui je suis', texte: 'Je suis [ton métier] depuis [nombre] ans. J\'accompagne [type de clients] sur [type de projets].\nCe que mes clients retiennent : [ta force principale, en une phrase].' },
    { type: 'presentation', titre: 'Pourquoi travailler avec moi', texte: '- Un interlocuteur unique, du cadrage à la livraison.\n- Des points d\'avancement réguliers, à la date prévue.\n- Une proposition sans surprise : ce qui est inclus est écrit, ce qui ne l\'est pas aussi.' },
    { type: 'methode', titre: 'Ma méthode en quatre temps', texte: '1. Comprendre : un échange pour préciser le besoin, les contraintes et les critères de réussite.\n2. Proposer : une première version soumise à ta validation.\n3. Réaliser : le travail par étapes, avec un point à la fin de chacune.\n4. Transmettre : la livraison, les explications et le bilan.' },
    { type: 'methode', titre: 'Comment nous travaillerons ensemble', texte: 'Un point de lancement fixe le calendrier et les interlocuteurs. Chaque étape se termine par une validation écrite avant de passer à la suivante. Les demandes nouvelles sont chiffrées à part, avant d\'être engagées.' },
    { type: 'methode', titre: 'Points d\'avancement', texte: 'Un point de [durée] chaque [fréquence], et un compte rendu écrit sous [délai] : décisions prises, actions, prochaines étapes.' },
    { type: 'references', titre: 'Références', texte: 'À compléter avec des missions comparables, avec l\'accord des clients concernés :\n- [Type de client] : [mission], [résultat obtenu].\n- [Type de client] : [mission], [résultat obtenu].' },
    { type: 'references', titre: 'Ce que disent mes clients', texte: '« [Citation d\'un client, avec son accord]. »\n[Fonction], [type d\'organisation].' },
    { type: 'engagements', titre: 'Mes engagements', texte: '- Respect des dates convenues, ou alerte dès qu\'un risque apparaît.\n- Confidentialité des informations transmises.\n- Un livrable conforme à ce qui est décrit dans cette proposition.' },
    { type: 'engagements', titre: 'Ce qui n\'est pas inclus', texte: 'Sauf mention contraire : [frais de déplacement], [achats de licences ou de matériel], [prestations de tiers]. Toute demande hors périmètre fait l\'objet d\'un chiffrage complémentaire.' },
    { type: 'autre', titre: 'Prochaines étapes', texte: '1. Tu choisis l\'option qui te convient.\n2. Je t\'envoie le devis détaillé correspondant.\n3. Nous fixons la date de lancement.' },
  ],
  motifsRefus: ['Prix', 'Calendrier', 'Concurrent retenu', 'Projet reporté ou annulé', 'Besoin mal compris', 'Pas de réponse', 'Autre'],
  trames: [
    {
      id: 'conseil', nom: 'Conseil', description: 'Diagnostic, accompagnement, stratégie',
      contexte: ['Quelle situation a déclenché la demande ?', 'Qu\'est-ce qui a déjà été essayé ?', 'Qui décide, et qui sera concerné ?', 'Que se passe-t-il si rien ne change ?'],
      objectifs: ['Disposer d\'un diagnostic partagé de la situation', 'Choisir une orientation parmi des scénarios comparés', 'Obtenir un plan d\'actions priorisé et daté', 'Rendre l\'équipe autonome sur la suite'],
      livrables: [
        ['Note de cadrage', 'Périmètre, questions à traiter, interlocuteurs et calendrier validés au lancement.'],
        ['Rapport de diagnostic', 'Constats, causes et points forts, appuyés sur les entretiens et les données.'],
        ['Scénarios comparés', 'Deux ou trois orientations avec avantages, risques et moyens nécessaires.'],
        ['Plan d\'actions', 'Actions, responsables, échéances et indicateurs de suivi.'],
        ['Restitution', 'Présentation des conclusions aux décideurs.'],
      ],
      etapes: [['Cadrage', 1], ['Entretiens et collecte', 2], ['Analyse et diagnostic', 2], ['Scénarios et recommandations', 1], ['Restitution', 1]],
      options: [
        { nom: 'Essentiel', accroche: 'Le diagnostic et les recommandations', inclus: ['Note de cadrage', 'Rapport de diagnostic', 'Recommandations', 'Restitution'], delai: '5 semaines' },
        { nom: 'Confort', accroche: 'Le diagnostic et un plan d\'actions prêt à lancer', inclus: ['Note de cadrage', 'Rapport de diagnostic', 'Recommandations', 'Restitution', 'Scénarios comparés', 'Plan d\'actions'], delai: '7 semaines', recommandee: true },
        { nom: 'Premium', accroche: 'Le plan d\'actions et l\'accompagnement de sa mise en œuvre', inclus: ['Note de cadrage', 'Rapport de diagnostic', 'Recommandations', 'Restitution', 'Scénarios comparés', 'Plan d\'actions', 'Suivi mensuel pendant 3 mois'], delai: '7 semaines + 3 mois de suivi' },
      ],
      conditions: ['Acompte de 30 % à l\'acceptation, solde à la restitution.', 'Facturation mensuelle des jours réalisés.', 'Frais de déplacement en sus, sur justificatifs.', 'Le devis détaillé (TVA et mentions légales) suit l\'acceptation de la proposition.'],
    },
    {
      id: 'developpement', nom: 'Développement', description: 'Site, application, outil sur mesure',
      contexte: ['Quel problème l\'outil doit-il résoudre, et pour qui ?', 'Que fait-on aujourd\'hui sans lui ?', 'Quels outils existants doit-il remplacer ou compléter ?', 'Y a-t-il une date qui compte (salon, lancement, saison) ?'],
      objectifs: ['Mettre en ligne une première version utilisable', 'Réduire le temps passé sur une tâche répétitive', 'Rendre l\'équipe autonome sur les mises à jour courantes', 'Disposer d\'un outil maintenable et documenté'],
      livrables: [
        ['Cahier des charges fonctionnel', 'Parcours, écrans et règles validés avant le développement.'],
        ['Maquettes', 'Écrans principaux sur ordinateur et téléphone.'],
        ['Application', 'Version en ligne, testée sur les navigateurs convenus.'],
        ['Documentation', 'Guide d\'utilisation et notes techniques pour la maintenance.'],
        ['Formation', 'Prise en main par les utilisateurs.'],
      ],
      etapes: [['Ateliers et cahier des charges', 1], ['Maquettes', 1], ['Développement', 4], ['Tests et recette', 1], ['Mise en ligne et formation', 1]],
      options: [
        { nom: 'Essentiel', accroche: 'Les fonctions indispensables, en ligne vite', inclus: ['Cahier des charges', 'Maquettes', 'Fonctions indispensables', 'Mise en ligne'], delai: '5 semaines' },
        { nom: 'Confort', accroche: 'L\'outil complet et la formation de l\'équipe', inclus: ['Cahier des charges', 'Maquettes', 'Fonctions indispensables', 'Mise en ligne', 'Fonctions de confort', 'Documentation', 'Formation'], delai: '8 semaines', recommandee: true },
        { nom: 'Premium', accroche: 'L\'outil complet, suivi et amélioré', inclus: ['Cahier des charges', 'Maquettes', 'Fonctions indispensables', 'Mise en ligne', 'Fonctions de confort', 'Documentation', 'Formation', 'Maintenance pendant 6 mois'], delai: '8 semaines + 6 mois de maintenance' },
      ],
      conditions: ['Acompte de 30 % à l\'acceptation, 40 % à la validation des maquettes, solde à la mise en ligne.', 'Hébergement, noms de domaine et licences tierces à la charge du client.', 'Toute demande hors cahier des charges est chiffrée avant d\'être engagée.', 'Le devis détaillé (TVA et mentions légales) suit l\'acceptation de la proposition.'],
    },
    {
      id: 'formation', nom: 'Formation', description: 'Session, parcours, atelier',
      contexte: ['Qui sont les participants (nombre, rôle, niveau) ?', 'Qu\'est-ce qui doit changer dans leur travail après la formation ?', 'Quelles contraintes de dates, de lieu ou de format ?', 'Comment le commanditaire mesurera-t-il la réussite ?'],
      objectifs: ['Rendre les participants autonomes sur une compétence précise', 'Harmoniser les pratiques de l\'équipe', 'Appliquer la formation à un cas réel de l\'entreprise', 'Mesurer les acquis en fin de parcours'],
      livrables: [
        ['Programme détaillé', 'Objectifs pédagogiques, séquences, durée et méthodes.'],
        ['Questionnaire de positionnement', 'Niveau et attentes des participants avant la session.'],
        ['Sessions de formation', 'Animation en présentiel ou à distance.'],
        ['Supports participants', 'Fiches pratiques et exercices corrigés.'],
        ['Bilan de fin de formation', 'Évaluation des acquis et de la satisfaction, recommandations.'],
      ],
      etapes: [['Analyse du besoin', 1], ['Conception du programme', 2], ['Sessions', 2], ['Bilan', 1]],
      options: [
        { nom: 'Essentiel', accroche: 'Une journée pour poser les bases', inclus: ['Programme détaillé', '1 journée de formation', 'Supports participants'], delai: '3 semaines' },
        { nom: 'Confort', accroche: 'Deux jours avec un cas réel de l\'entreprise', inclus: ['Programme détaillé', '1 journée de formation', 'Supports participants', 'Questionnaire de positionnement', '1 journée sur un cas réel', 'Bilan de fin de formation'], delai: '5 semaines', recommandee: true },
        { nom: 'Premium', accroche: 'Le parcours complet et un suivi à un mois', inclus: ['Programme détaillé', '1 journée de formation', 'Supports participants', 'Questionnaire de positionnement', '1 journée sur un cas réel', 'Bilan de fin de formation', 'Classe de suivi à un mois'], delai: '5 semaines + suivi' },
      ],
      conditions: ['Groupe de [nombre] participants au plus.', 'Report possible jusqu\'à [délai] avant la session, sans frais.', 'Salle et matériel de projection fournis par le client pour le présentiel.', 'Le devis ou la convention (mentions obligatoires) suit l\'acceptation de la proposition.'],
    },
    {
      id: 'travaux', nom: 'Travaux', description: 'Rénovation, aménagement, installation',
      contexte: ['Quel est l\'état actuel et qu\'est-ce qui ne convient plus ?', 'Le logement ou le local est-il occupé pendant les travaux ?', 'Quelles contraintes d\'accès, de copropriété ou de calendrier ?', 'Quel niveau de finition est attendu ?'],
      objectifs: ['Rénover les pièces concernées avec un niveau de finition défini', 'Tenir le calendrier convenu, logement occupé ou non', 'Limiter la gêne : protection, propreté, horaires', 'Livrer un chantier propre, réserves levées'],
      livrables: [
        ['Visite et relevé', 'Mesures, état des supports et contraintes notés sur place.'],
        ['Descriptif des travaux', 'Pièce par pièce, matériaux et finitions proposés.'],
        ['Réalisation', 'Travaux selon le descriptif retenu.'],
        ['Nettoyage de fin de chantier', 'Évacuation des déchets et remise en état des lieux.'],
        ['Réception', 'Visite de fin de travaux et levée des réserves.'],
      ],
      etapes: [['Visite et descriptif', 1], ['Commande des matériaux', 2], ['Travaux', 3], ['Finitions et nettoyage', 1], ['Réception', 1]],
      options: [
        { nom: 'Essentiel', accroche: 'La remise en état, finition standard', inclus: ['Protection des lieux', 'Préparation des supports', 'Finition standard', 'Nettoyage de fin de chantier'], delai: '3 semaines de travaux' },
        { nom: 'Confort', accroche: 'La rénovation complète, finition soignée', inclus: ['Protection des lieux', 'Préparation des supports', 'Finition standard', 'Nettoyage de fin de chantier', 'Finition soignée', 'Reprise des boiseries'], delai: '4 semaines de travaux', recommandee: true },
        { nom: 'Premium', accroche: 'La rénovation clés en main, matériaux haut de gamme', inclus: ['Protection des lieux', 'Préparation des supports', 'Finition standard', 'Nettoyage de fin de chantier', 'Finition soignée', 'Reprise des boiseries', 'Matériaux haut de gamme', 'Coordination des autres corps de métier'], delai: '5 semaines de travaux' },
      ],
      conditions: ['Date de démarrage confirmée à la signature du devis.', 'Acompte à la commande, selon le devis.', 'Accès au chantier et à l\'eau et l\'électricité fournis par le client.', 'Le devis détaillé (TVA, assurance et mentions obligatoires) suit l\'acceptation de la proposition.'],
    },
  ],
};
