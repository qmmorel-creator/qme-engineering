// Base intégrée du calendrier éditorial : couleurs fixes, piliers types, formats types, trames de texte,
// métiers et banque de sujets. Contenu original rédigé pour QME (aucune source externe reprise, aucune marque).
// Aucune règle de réseau social n'est intégrée : limites de caractères et horaires dépendent de chaque réseau,
// changent sans préavis et sont saisis par l'utilisateur. Les durées de préparation des formats et la longueur
// d'accroche sont des repères d'écriture QME, modifiables.
// Jours : 0 = lundi … 6 = dimanche.
(() => {
  // i : sujet d'idée → { metier, pilier, format, trame, sujet }
  const i = (metier, pilier, format, trame, sujet) => ({ metier, pilier, format, trame, sujet });

  window.BASE = {
    // Une couleur par pilier, dans cet ordre (jamais générée). Palette validée (contraste sur fond clair,
    // daltonisme) avec le validateur du skill dataviz ; chaque couleur est toujours accompagnée du nom du pilier.
    couleurs: [
      { id: 'bleu', hex: '#2B5DA3', nom: 'Bleu', texte: '#fff', teinte: '#D8E4F0' },
      { id: 'rouge', hex: '#B84A34', nom: 'Brique', texte: '#fff', teinte: '#F8DCD3' },
      { id: 'jaune', hex: '#C99A1E', nom: 'Moutarde', texte: '#24221F', teinte: '#FBEBC2' },
      { id: 'vert', hex: '#2E7D4F', nom: 'Vert', texte: '#fff', teinte: '#D7EBDD' },
      { id: 'prune', hex: '#7A3E6B', nom: 'Prune', texte: '#fff', teinte: '#EBDBE6' },
      { id: 'ciel', hex: '#4A90C2', nom: 'Bleu ciel', texte: '#24221F', teinte: '#DCEBF5' },
    ],

    // Piliers éditoriaux types : les grandes familles de sujets, chacune avec une part visée (en %).
    piliers: [
      { id: 'expertise', nom: 'Expertise', couleur: 'bleu', part: 35, description: 'Ce que tu sais faire et que ton client ne sait pas : explications, analyses, décryptages.' },
      { id: 'preuves', nom: 'Cas clients et résultats', couleur: 'vert', part: 25, description: 'Des missions racontées (anonymisées ou avec accord) : problème, démarche, résultat.' },
      { id: 'coulisses', nom: 'Coulisses et méthode', couleur: 'jaune', part: 20, description: 'Comment tu travailles : outils, organisation, erreurs, apprentissages.' },
      { id: 'conseils', nom: 'Conseils pratiques', couleur: 'rouge', part: 20, description: 'Des astuces applicables tout de suite, qui donnent envie de te suivre.' },
      { id: 'opinion', nom: 'Points de vue', couleur: 'prune', part: 0, description: 'Ton avis argumenté sur une pratique, une tendance ou une idée reçue de ton secteur.' },
      { id: 'parcours', nom: 'Parcours et valeurs', couleur: 'ciel', part: 0, description: 'Ton histoire, tes choix, ce qui compte pour toi dans ton métier.' },
    ],

    // Formats types. minutes = temps de préparation indicatif (repère QME, modifiable dans l'application).
    formats: [
      { id: 'texte', nom: 'Texte seul', minutes: 30 },
      { id: 'image', nom: 'Texte et image', minutes: 45 },
      { id: 'carrousel', nom: 'Carrousel ou document', minutes: 90 },
      { id: 'video', nom: 'Vidéo courte', minutes: 60 },
      { id: 'sondage', nom: 'Sondage', minutes: 15 },
      { id: 'article', nom: 'Article long', minutes: 120 },
      { id: 'ressource', nom: 'Ressource commentée', minutes: 20 },
      { id: 'lettre', nom: 'Lettre d\'information', minutes: 90 },
    ],

    // Format proposé pour recycler un contenu qui a bien marché (on change de forme, pas de fond).
    recyclage: { texte: 'carrousel', image: 'carrousel', carrousel: 'video', video: 'texte', sondage: 'texte', article: 'carrousel', ressource: 'texte', lettre: 'texte' },

    // Trames : un squelette de texte à compléter, inséré dans le brouillon. Les [crochets] sont à remplacer.
    trames: [
      { id: 'liste', nom: 'Liste de conseils', pilier: 'conseils', format: 'texte', texte: '[Accroche : le problème en une phrase, ou un chiffre de ton expérience]\n\n[Contexte en deux lignes : pour qui, dans quelle situation]\n\nCe que je conseille :\n\n1. [Conseil] : [pourquoi, en une ligne]\n2. [Conseil] : [pourquoi]\n3. [Conseil] : [pourquoi]\n\n[Le piège à éviter]\n\n[Question au lecteur : et vous, lequel appliquez-vous déjà ?]' },
      { id: 'cas', nom: 'Étude de cas', pilier: 'preuves', format: 'texte', texte: '[Accroche : le résultat, ou la situation de départ]\n\nLe contexte : [type de client, sans le nommer sans son accord]\nLe problème : [ce qui bloquait]\n\nCe que nous avons fait :\n▪ [Étape 1]\n▪ [Étape 2]\n▪ [Étape 3]\n\nLe résultat : [mesurable si possible, sinon concret]\n\nCe que j\'en retiens : [la leçon réutilisable]' },
      { id: 'erreur', nom: 'L\'erreur que j\'ai faite', pilier: 'coulisses', format: 'texte', texte: '[Accroche : « J\'ai fait cette erreur pendant X ans. »]\n\nCe que je faisais : [le comportement]\nCe que ça m\'a coûté : [temps, argent, client, énergie]\nLe déclic : [ce qui m\'a fait changer]\nCe que je fais maintenant : [la nouvelle pratique]\n\n[Question : vous l\'avez déjà faite aussi ?]' },
      { id: 'coulisses', nom: 'Dans les coulisses', pilier: 'coulisses', format: 'image', texte: '[Accroche : ce que personne ne voit de mon métier]\n\n[Ce que montre l\'image ou la situation]\n\nPourquoi je travaille comme ça :\n▪ [Raison 1]\n▪ [Raison 2]\n\n[Ce que ça change pour mes clients]' },
      { id: 'avant-apres', nom: 'Avant / après', pilier: 'preuves', format: 'carrousel', texte: '[Accroche : l\'écart entre avant et après]\n\nAvant : [la situation, les symptômes]\nAprès : [la situation, ce qui a changé]\n\nCe qui a fait la différence :\n1. [Changement]\n2. [Changement]\n3. [Changement]\n\n[Pour qui ça vaut le coup]' },
      { id: 'opinion', nom: 'Avis argumenté', pilier: 'opinion', format: 'texte', texte: '[Accroche : l\'idée reçue que je ne partage pas]\n\nCe qu\'on entend souvent : [l\'idée reçue]\nCe que j\'observe sur le terrain : [ton constat]\n\nTrois raisons :\n1. [Raison]\n2. [Raison]\n3. [Raison]\n\n[La nuance honnête : quand l\'idée reçue a raison]\n\n[Question ouverte au réseau]' },
      { id: 'question', nom: 'Question au réseau', pilier: 'expertise', format: 'sondage', texte: '[Question claire, une seule]\n\n[Pourquoi je la pose : le contexte en deux lignes]\n\nOptions :\n▪ [Option A]\n▪ [Option B]\n▪ [Option C]\n\nJe partagerai les réponses et mon avis dans [délai].' },
      { id: 'methode', nom: 'Ma méthode en étapes', pilier: 'expertise', format: 'carrousel', texte: '[Accroche : le résultat que permet la méthode]\n\nMa méthode en [n] étapes :\n\n1. [Étape] : [ce qu\'on fait, ce qu\'on obtient]\n2. [Étape]\n3. [Étape]\n4. [Étape]\n\n[L\'étape que la plupart sautent, et pourquoi c\'est une erreur]\n\n[Invitation : enregistrez ce post pour plus tard]' },
      { id: 'ressource', nom: 'Ressource commentée', pilier: 'conseils', format: 'ressource', texte: '[Accroche : la ressource qui m\'a fait gagner du temps cette semaine]\n\nDe quoi il s\'agit : [livre, outil, article, méthode]\nCe que j\'en retiens :\n▪ [Idée 1]\n▪ [Idée 2]\n\nPour qui : [profil du lecteur à qui ça servira]\n\n[Lien en commentaire ou référence]' },
      { id: 'annonce', nom: 'Disponibilité ou offre', pilier: 'preuves', format: 'texte', texte: '[Accroche : l\'annonce en une phrase, sans détour]\n\nCe que je propose : [l\'offre]\nPour qui : [le client idéal]\nCe que vous obtenez : [le résultat concret]\nQuand : [disponibilité, date]\n\n[Comment me contacter : message privé, site]' },
      { id: 'bilan', nom: 'Bilan (mois, projet, année)', pilier: 'parcours', format: 'texte', texte: '[Accroche : le bilan en un chiffre ou une phrase]\n\nCe qui a marché :\n▪ [Point]\n▪ [Point]\n\nCe qui n\'a pas marché :\n▪ [Point]\n\nCe que je change pour la suite : [décision]\n\n[Merci à… / question au réseau]' },
    ],

    // Métiers proposés au premier lancement : ils filtrent la banque de sujets.
    metiers: [
      { id: 'consultant', nom: 'Consultant·e' },
      { id: 'developpeur', nom: 'Développeur·se freelance' },
      { id: 'designer', nom: 'Graphiste, designer' },
      { id: 'coach', nom: 'Coach, accompagnant·e' },
      { id: 'formateur', nom: 'Formateur·rice' },
      { id: 'redacteur', nom: 'Rédacteur·rice, traducteur·rice' },
      { id: 'photographe', nom: 'Photographe, vidéaste' },
      { id: 'marketing', nom: 'Marketing et communication' },
    ],

    // Banque de sujets. metier « tous » : valable pour tout indépendant.
    idees: [
      // Pour tous
      i('tous', 'parcours', 'texte', 'bilan', 'Pourquoi je suis devenu·e indépendant·e, et ce que je referais autrement'),
      i('tous', 'coulisses', 'image', 'coulisses', 'Ma semaine type : comment je répartis production, prospection et administratif'),
      i('tous', 'coulisses', 'texte', 'erreur', 'Le premier devis que j\'ai mal chiffré, et ce que j\'ai changé depuis'),
      i('tous', 'conseils', 'texte', 'liste', 'Cinq questions que je pose toujours avant d\'accepter une mission'),
      i('tous', 'preuves', 'texte', 'cas', 'Une mission récente racontée en cinq lignes : problème, démarche, résultat'),
      i('tous', 'opinion', 'texte', 'opinion', 'Ce qu\'on dit souvent des freelances dans mon secteur, et que je ne crois pas'),
      i('tous', 'expertise', 'sondage', 'question', 'Sondage : quel est votre plus gros frein quand vous faites appel à un indépendant ?'),
      i('tous', 'conseils', 'ressource', 'ressource', 'Le livre ou l\'outil qui a changé ma façon de travailler cette année'),
      i('tous', 'parcours', 'texte', 'bilan', 'Bilan du trimestre : ce qui a marché, ce que j\'arrête'),
      i('tous', 'preuves', 'texte', 'annonce', 'Mes disponibilités du mois prochain et le type de mission que je cherche'),
      i('tous', 'coulisses', 'texte', 'coulisses', 'Comment je prépare un premier rendez-vous avec un client'),
      i('tous', 'conseils', 'carrousel', 'methode', 'Ma méthode pour cadrer une mission en une page'),

      // Consultant·e
      i('consultant', 'expertise', 'carrousel', 'methode', 'Le diagnostic en 4 étapes que je mène au début de chaque mission'),
      i('consultant', 'preuves', 'carrousel', 'avant-apres', 'Avant / après : une organisation réunions remise à plat'),
      i('consultant', 'expertise', 'texte', 'liste', 'Trois indicateurs qu\'une PME devrait suivre chaque mois'),
      i('consultant', 'opinion', 'texte', 'opinion', 'Pourquoi un audit sans plan d\'action ne sert à rien'),
      i('consultant', 'conseils', 'texte', 'liste', 'Comment préparer une réunion de direction en 30 minutes'),
      i('consultant', 'coulisses', 'texte', 'erreur', 'La recommandation que j\'ai faite trop tôt'),
      i('consultant', 'preuves', 'texte', 'cas', 'Comment un client a réduit ses délais de traitement, étape par étape'),
      i('consultant', 'expertise', 'sondage', 'question', 'Sondage : qui décide vraiment des priorités dans votre entreprise ?'),
      i('consultant', 'conseils', 'article', 'methode', 'Guide : rédiger un cahier des charges que les prestataires comprennent'),
      i('consultant', 'expertise', 'image', 'coulisses', 'Le schéma que je dessine dans presque toutes mes missions'),

      // Développeur·se
      i('developpeur', 'expertise', 'texte', 'liste', 'Trois questions à se poser avant de refaire un site ou une application'),
      i('developpeur', 'preuves', 'texte', 'cas', 'Le projet où un outil simple a remplacé trois tableurs'),
      i('developpeur', 'opinion', 'texte', 'opinion', 'Pourquoi la technologie à la mode n\'est pas toujours le bon choix'),
      i('developpeur', 'coulisses', 'image', 'coulisses', 'À quoi ressemble ma journée de code, outils compris'),
      i('developpeur', 'conseils', 'carrousel', 'liste', 'Ce qu\'un client doit préparer avant le premier jour de développement'),
      i('developpeur', 'expertise', 'carrousel', 'methode', 'Comment j\'estime une fonctionnalité : ma méthode en 4 étapes'),
      i('developpeur', 'coulisses', 'texte', 'erreur', 'Le bug en production qui m\'a appris à tester autrement'),
      i('developpeur', 'conseils', 'ressource', 'ressource', 'La documentation ou le cours que je recommande à chaque débutant'),
      i('developpeur', 'expertise', 'sondage', 'question', 'Sondage : site sur mesure ou outil clé en main, qu\'avez-vous choisi ?'),
      i('developpeur', 'preuves', 'video', 'avant-apres', 'Démonstration courte : un écran avant et après refonte'),

      // Graphiste, designer
      i('designer', 'preuves', 'carrousel', 'avant-apres', 'Avant / après : une identité visuelle refaite pour un artisan'),
      i('designer', 'expertise', 'texte', 'liste', 'Cinq erreurs de mise en page qui rendent un document illisible'),
      i('designer', 'coulisses', 'video', 'coulisses', 'Du croquis au rendu final : les étapes d\'un logo en accéléré'),
      i('designer', 'opinion', 'texte', 'opinion', 'Pourquoi « faire moderne » n\'est pas un brief'),
      i('designer', 'conseils', 'carrousel', 'liste', 'Comment choisir deux polices qui vont ensemble'),
      i('designer', 'expertise', 'carrousel', 'methode', 'Ma méthode pour poser une palette de couleurs cohérente'),
      i('designer', 'coulisses', 'texte', 'erreur', 'Le projet où j\'ai dit oui à trop de révisions'),
      i('designer', 'expertise', 'sondage', 'question', 'Sondage : laquelle de ces deux affiches retient votre attention ?'),
      i('designer', 'conseils', 'texte', 'liste', 'Ce qu\'il faut préparer avant de commander un logo'),
      i('designer', 'preuves', 'image', 'cas', 'Une charte graphique déclinée sur tous les supports d\'un client'),

      // Coach, accompagnant·e
      i('coach', 'expertise', 'texte', 'liste', 'Trois signes qu\'il est temps de se faire accompagner'),
      i('coach', 'conseils', 'texte', 'liste', 'Un exercice de cinq minutes pour clarifier une décision'),
      i('coach', 'preuves', 'texte', 'cas', 'Le parcours d\'un client (anonymisé, avec son accord) : point de départ et déclic'),
      i('coach', 'opinion', 'texte', 'opinion', 'Ce que l\'accompagnement n\'est pas'),
      i('coach', 'coulisses', 'texte', 'coulisses', 'Comment se déroule une première séance avec moi'),
      i('coach', 'parcours', 'texte', 'bilan', 'Pourquoi j\'ai choisi ce métier'),
      i('coach', 'expertise', 'carrousel', 'methode', 'Les 4 questions que je pose en début d\'accompagnement'),
      i('coach', 'conseils', 'sondage', 'question', 'Sondage : qu\'est-ce qui vous empêche le plus de passer à l\'action ?'),
      i('coach', 'coulisses', 'texte', 'erreur', 'Une erreur de posture que j\'ai corrigée avec la pratique'),
      i('coach', 'conseils', 'ressource', 'ressource', 'Le livre que je prête le plus souvent à mes clients'),

      // Formateur·rice
      i('formateur', 'expertise', 'carrousel', 'methode', 'Comment je construis une formation d\'une journée'),
      i('formateur', 'conseils', 'texte', 'liste', 'Trois techniques pour garder l\'attention après le déjeuner'),
      i('formateur', 'preuves', 'texte', 'cas', 'Ce que les stagiaires ont changé dans leur pratique trois mois après'),
      i('formateur', 'coulisses', 'image', 'coulisses', 'La salle avant l\'arrivée des stagiaires : mon installation'),
      i('formateur', 'opinion', 'texte', 'opinion', 'Pourquoi une formation sans mise en pratique ne tient pas'),
      i('formateur', 'expertise', 'sondage', 'question', 'Sondage : présentiel, distanciel ou mixte, que préférez-vous ?'),
      i('formateur', 'coulisses', 'texte', 'erreur', 'La séance qui ne s\'est pas passée comme prévu'),
      i('formateur', 'conseils', 'carrousel', 'liste', 'Comment choisir une formation : cinq critères'),
      i('formateur', 'preuves', 'texte', 'annonce', 'Prochaines sessions : dates, public et programme'),
      i('formateur', 'expertise', 'texte', 'liste', 'L\'exercice d\'ouverture que j\'utilise depuis des années'),

      // Rédacteur·rice, traducteur·rice
      i('redacteur', 'expertise', 'texte', 'liste', 'Cinq mots qui affaiblissent un texte professionnel'),
      i('redacteur', 'preuves', 'carrousel', 'avant-apres', 'Avant / après : une page d\'accueil réécrite'),
      i('redacteur', 'conseils', 'texte', 'liste', 'Comment écrire une accroche qui donne envie de lire la suite'),
      i('redacteur', 'opinion', 'texte', 'opinion', 'Pourquoi un texte court demande plus de temps qu\'un long'),
      i('redacteur', 'coulisses', 'texte', 'coulisses', 'Ma méthode de relecture en trois passes'),
      i('redacteur', 'expertise', 'carrousel', 'methode', 'Le plan en 4 parties qui marche pour presque tous les articles'),
      i('redacteur', 'coulisses', 'texte', 'erreur', 'La traduction mot à mot qui a fait sourire un client'),
      i('redacteur', 'expertise', 'sondage', 'question', 'Sondage : lisez-vous les articles jusqu\'au bout ?'),
      i('redacteur', 'conseils', 'ressource', 'ressource', 'Le dictionnaire ou guide de style que je garde ouvert'),
      i('redacteur', 'preuves', 'texte', 'cas', 'Une fiche produit réécrite, et ce que ça a changé pour le client'),

      // Photographe, vidéaste
      i('photographe', 'preuves', 'carrousel', 'avant-apres', 'Avant / après retouche : ce que je corrige et ce que je laisse'),
      i('photographe', 'coulisses', 'video', 'coulisses', 'Les coulisses d\'une séance : installation de la lumière'),
      i('photographe', 'conseils', 'texte', 'liste', 'Comment préparer une séance portrait professionnelle'),
      i('photographe', 'expertise', 'texte', 'liste', 'Trois réglages qui changent tout en lumière naturelle'),
      i('photographe', 'opinion', 'texte', 'opinion', 'Pourquoi une photo de banque d\'images dessert votre marque'),
      i('photographe', 'preuves', 'image', 'cas', 'Une série réalisée pour un commerce : le brief et le résultat'),
      i('photographe', 'coulisses', 'texte', 'erreur', 'La séance où tout a failli rater, et comment je l\'ai sauvée'),
      i('photographe', 'expertise', 'sondage', 'question', 'Sondage : couleur ou noir et blanc pour ce portrait ?'),
      i('photographe', 'conseils', 'carrousel', 'liste', 'Les tenues à éviter devant l\'objectif'),
      i('photographe', 'preuves', 'texte', 'annonce', 'Créneaux disponibles pour les séances du mois prochain'),

      // Marketing et communication
      i('marketing', 'expertise', 'carrousel', 'methode', 'Comment je construis un plan de communication sur un trimestre'),
      i('marketing', 'conseils', 'texte', 'liste', 'Trois indicateurs à regarder avant de juger une campagne'),
      i('marketing', 'opinion', 'texte', 'opinion', 'Pourquoi publier tous les jours n\'est pas une stratégie'),
      i('marketing', 'preuves', 'texte', 'cas', 'Une campagne locale racontée : objectif, moyens, résultats'),
      i('marketing', 'coulisses', 'image', 'coulisses', 'Mon tableau de suivi des contenus d\'un client'),
      i('marketing', 'expertise', 'texte', 'liste', 'Les trois piliers éditoriaux d\'une petite entreprise'),
      i('marketing', 'coulisses', 'texte', 'erreur', 'La campagne qui n\'a rien donné, et pourquoi'),
      i('marketing', 'expertise', 'sondage', 'question', 'Sondage : où vos clients vous ont-ils découvert ?'),
      i('marketing', 'conseils', 'carrousel', 'liste', 'Comment recycler un contenu qui a bien marché'),
      i('marketing', 'conseils', 'lettre', 'liste', 'Lettre d\'information : cinq idées de rubriques récurrentes'),
    ],

    // Statistiques saisies à la main (aucune connexion à un réseau). Les réseaux ne les nomment pas tous
    // de la même façon : l'aide de chaque champ dit quoi reporter.
    statistiques: [
      { id: 'vues', nom: 'Vues', aide: 'Affichages ou impressions indiqués par le réseau' },
      { id: 'reactions', nom: 'Réactions', aide: 'Mentions « j\'aime » et autres réactions' },
      { id: 'commentaires', nom: 'Commentaires', aide: 'Commentaires reçus (sans compter les tiens)' },
      { id: 'partages', nom: 'Partages', aide: 'Republications et partages' },
      { id: 'contacts', nom: 'Contacts générés', aide: 'Messages, demandes de rendez-vous ou de devis venus de ce contenu' },
    ],
  };
})();
