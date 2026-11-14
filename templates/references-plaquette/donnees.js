// Base intégrée du Kit références et plaquette : modèles de fiches par métier (types de mission, mots-clés,
// résultats à mesurer, questions d'aide), secteurs et tailles de client pour décrire sans nommer, trame
// « contexte, mission, résultat », verbes d'action, demande de témoignage, mises en page imprimables.
// Contenu original rédigé pour QME. Aucune référence réelle, aucune marque, aucune donnée datée. Aucune logique ici.
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Modèles de fiches par métier. types : types de mission proposés (le premier sert de défaut).
    // resultats : libellés de résultats chiffrés typiques, sans valeur (la valeur est toujours saisie).
    metiers: [
      {
        id: 'conseil', nom: 'Conseil et accompagnement', detail: 'Consultants, coachs d\'entreprise, chefs de projet indépendants',
        types: ['Diagnostic', 'Accompagnement du changement', 'Organisation et processus', 'Pilotage de projet', 'Stratégie', 'Formation des équipes'],
        motsCles: ['organisation', 'processus', 'conduite du changement', 'pilotage', 'tableau de bord', 'gouvernance', 'réduction des délais', 'outils numériques', 'management', 'qualité'],
        resultats: ['de délai de traitement', 'heures gagnées par mois', 'd\'économies par an', 'de satisfaction interne', 'personnes formées', 'processus revus'],
        questions: {
          contexte: 'Quelle situation le client voulait-il changer ? Qu\'est-ce qui coinçait, depuis quand, avec quel enjeu ?',
          mission: 'Qu\'as-tu fait, étape par étape ? Avec qui, sur quelle durée, avec quelle méthode ?',
          resultat: 'Qu\'est-ce qui a changé, chiffres à l\'appui : délai, coût, volume, satisfaction ?',
        },
      },
      {
        id: 'web', nom: 'Développement et web', detail: 'Développeurs, intégrateurs, studios web, no-code',
        types: ['Site vitrine', 'Boutique en ligne', 'Application web', 'Application mobile', 'Refonte', 'Maintenance et évolutions', 'Automatisation'],
        motsCles: ['site vitrine', 'e-commerce', 'application', 'refonte', 'performance', 'accessibilité', 'référencement', 'automatisation', 'API', 'maintenance'],
        resultats: ['de taux de conversion', 'de temps de chargement', 'de trafic', 'commandes par mois', 'heures de saisie évitées', 'd\'utilisateurs actifs'],
        questions: {
          contexte: 'Que faisait le client avant (outil, site, fichier) et pourquoi ce n\'était plus tenable ?',
          mission: 'Qu\'as-tu conçu et livré : périmètre, technologies dites simplement, étapes, mise en ligne ?',
          resultat: 'Qu\'a mesuré le client après la mise en ligne : ventes, trafic, temps gagné, erreurs évitées ?',
        },
      },
      {
        id: 'design', nom: 'Design et graphisme', detail: 'Graphistes, directeurs artistiques, designers UX',
        types: ['Identité visuelle', 'Charte graphique', 'Édition et print', 'Packaging', 'Design d\'interface', 'Signalétique'],
        motsCles: ['identité visuelle', 'logo', 'charte', 'print', 'packaging', 'UX', 'UI', 'signalétique', 'illustration', 'édition'],
        resultats: ['supports déclinés', 'de notoriété mesurée', 'de ventes en magasin', 'écrans conçus', 'de taux de clic', 'semaines de projet'],
        questions: {
          contexte: 'Quelle image le client renvoyait-il, et qu\'est-ce qui ne collait plus à son activité ?',
          mission: 'Quelles pistes as-tu proposées, comment le choix s\'est fait, quels supports as-tu livrés ?',
          resultat: 'Qu\'est-ce que la nouvelle identité a changé : retours clients, ventes, cohérence des supports ?',
        },
      },
      {
        id: 'communication', nom: 'Communication et rédaction', detail: 'Rédacteurs, chargés de communication, community managers',
        types: ['Stratégie éditoriale', 'Rédaction web', 'Réseaux sociaux', 'Relations presse', 'Communication interne', 'Newsletter'],
        motsCles: ['contenu', 'rédaction', 'réseaux sociaux', 'newsletter', 'ligne éditoriale', 'relations presse', 'communication interne', 'référencement', 'storytelling', 'événement'],
        resultats: ['d\'abonnés', 'de taux d\'ouverture', 'articles publiés', 'retombées presse', 'de visites organiques', 'demandes de contact'],
        questions: {
          contexte: 'Où en était la communication du client : canaux, régularité, résultats, manque de temps ?',
          mission: 'Qu\'as-tu mis en place : ligne éditoriale, calendrier, contenus produits, rythme ?',
          resultat: 'Qu\'est-ce qui a bougé : audience, engagement, demandes entrantes, retombées ?',
        },
      },
      {
        id: 'formation', nom: 'Formation', detail: 'Formateurs, organismes de formation, intervenants',
        types: ['Formation intra-entreprise', 'Formation inter-entreprises', 'Parcours à distance', 'Atelier', 'Conférence', 'Ingénierie pédagogique'],
        motsCles: ['formation', 'pédagogie', 'atelier', 'e-learning', 'management', 'bureautique', 'sécurité', 'communication', 'évaluation', 'parcours'],
        resultats: ['stagiaires formés', 'de satisfaction', 'de réussite à l\'évaluation', 'sessions animées', 'heures de formation', 'modules créés'],
        questions: {
          contexte: 'Quel besoin de compétence le client avait-il, pour quel public, avec quelles contraintes ?',
          mission: 'Comment as-tu construit et animé la formation : format, durée, méthodes, évaluation ?',
          resultat: 'Quels résultats : satisfaction, réussite, mise en pratique observée quelques semaines après ?',
        },
      },
      {
        id: 'batiment', nom: 'Artisanat du bâtiment', detail: 'Plombiers, électriciens, menuisiers, peintres, entreprises de rénovation',
        types: ['Rénovation complète', 'Salle de bains', 'Cuisine', 'Électricité', 'Menuiserie', 'Isolation', 'Extension', 'Dépannage et entretien'],
        motsCles: ['rénovation', 'salle de bains', 'cuisine', 'isolation', 'électricité', 'menuiserie', 'peinture', 'maison ancienne', 'accessibilité', 'économies d\'énergie'],
        resultats: ['m² rénovés', 'jours de chantier', 'de consommation d\'énergie', 'pièces rénovées', 'jours d\'avance sur le planning', 'logements livrés'],
        questions: {
          contexte: 'Dans quel état était le logement ou le local, et que voulait le client (confort, vente, location) ?',
          mission: 'Quels travaux as-tu réalisés, avec quels matériaux, en combien de temps, en site occupé ou non ?',
          resultat: 'Qu\'est-ce qui a changé pour le client : surface, confort, facture d\'énergie, délai tenu ?',
        },
      },
      {
        id: 'architecture', nom: 'Architecture et décoration', detail: 'Architectes, architectes d\'intérieur, décorateurs, paysagistes',
        types: ['Conception', 'Aménagement intérieur', 'Rénovation', 'Extension', 'Aménagement de commerce', 'Aménagement extérieur', 'Suivi de chantier'],
        motsCles: ['aménagement', 'rénovation', 'extension', 'commerce', 'bureaux', 'lumière', 'matériaux', 'optimisation de l\'espace', 'jardin', 'suivi de chantier'],
        resultats: ['m² aménagés', 'semaines d\'études', 'de surface utile gagnée', 'lots coordonnés', 'de budget tenu', 'postes de travail'],
        questions: {
          contexte: 'Quel lieu, quel usage, quelles contraintes (budget, délais, règlement, existant) ?',
          mission: 'Quelles étapes as-tu menées : relevé, esquisses, choix des matériaux, suivi des entreprises ?',
          resultat: 'Qu\'est-ce que le lieu permet maintenant, et dans quels délais et budget le projet a tenu ?',
        },
      },
      {
        id: 'image', nom: 'Photo et vidéo', detail: 'Photographes, vidéastes, monteurs, motion designers',
        types: ['Reportage', 'Portraits', 'Photos de produits', 'Film d\'entreprise', 'Vidéo pour les réseaux', 'Événement', 'Motion design'],
        motsCles: ['reportage', 'portrait', 'packshot', 'film', 'réseaux sociaux', 'événement', 'drone', 'montage', 'motion design', 'interview'],
        resultats: ['photos livrées', 'vidéos livrées', 'de vues', 'jours de tournage', 'déclinaisons de formats', 'heures de montage'],
        questions: {
          contexte: 'À quoi devaient servir les images, pour quel public et sur quels supports ?',
          mission: 'Comment as-tu préparé et réalisé le tournage ou la prise de vue, puis la post-production ?',
          resultat: 'Qu\'a obtenu le client : nombre d\'images, usages, audience, délai de livraison ?',
        },
      },
      {
        id: 'general', nom: 'Généraliste', detail: 'Toute activité de service ou d\'artisanat',
        types: ['Mission', 'Projet', 'Prestation récurrente', 'Accompagnement', 'Réalisation'],
        motsCles: ['qualité', 'délais', 'sur mesure', 'accompagnement', 'réactivité', 'économies', 'organisation', 'proximité'],
        resultats: ['d\'économies', 'de délai gagné', 'clients servis', 'de satisfaction', 'jours de mission', 'livrables'],
        questions: {
          contexte: 'Quelle était la situation du client avant toi, et pourquoi a-t-il fait appel à toi ?',
          mission: 'Qu\'as-tu fait concrètement, avec quelle méthode et sur quelle durée ?',
          resultat: 'Qu\'est-ce qui a changé pour lui, chiffres à l\'appui ?',
        },
      },
    ],

    // Secteurs du client (pour le décrire sans le nommer et filtrer).
    secteurs: [
      { id: 'industrie', nom: 'Industrie' },
      { id: 'btp', nom: 'BTP et immobilier' },
      { id: 'commerce', nom: 'Commerce et distribution' },
      { id: 'services', nom: 'Services aux entreprises' },
      { id: 'numerique', nom: 'Numérique' },
      { id: 'sante', nom: 'Santé et médico-social' },
      { id: 'public', nom: 'Collectivités et secteur public' },
      { id: 'associations', nom: 'Associations' },
      { id: 'tourisme', nom: 'Hôtellerie, restauration, tourisme' },
      { id: 'education', nom: 'Éducation et formation' },
      { id: 'agro', nom: 'Agriculture et agroalimentaire' },
      { id: 'particuliers', nom: 'Particuliers' },
    ],

    // Tailles de client : description par effectif, sans référence à une définition légale.
    tailles: [
      { id: 'particulier', nom: 'Particulier', phrase: 'Un particulier' },
      { id: 'independant', nom: 'Indépendant', phrase: 'Un indépendant' },
      { id: 'tpe', nom: 'Moins de 10 salariés', phrase: 'Une entreprise de moins de 10 salariés' },
      { id: 'pe', nom: '10 à 49 salariés', phrase: 'Une entreprise de 10 à 49 salariés' },
      { id: 'me', nom: '50 à 249 salariés', phrase: 'Une entreprise de 50 à 249 salariés' },
      { id: 'ge', nom: '250 salariés et plus', phrase: 'Une entreprise de 250 salariés et plus' },
      { id: 'collectivite', nom: 'Collectivité', phrase: 'Une collectivité' },
      { id: 'association', nom: 'Association', phrase: 'Une association' },
    ],

    // Couleurs d'accent de la plaquette (charte QME) et formes des couvertures générées.
    accents: [
      { id: 'bleu', nom: 'Bleu', couleur: '#2E5A88', teinte: '#D8E4F0', texte: '#22476E' },
      { id: 'rouge', nom: 'Rouge', couleur: '#B84A34', teinte: '#F8DCD3', texte: '#8A3322' },
      { id: 'jaune', nom: 'Jaune', couleur: '#E8B93A', teinte: '#FBEBC2', texte: '#6E5310' },
      { id: 'encre', nom: 'Encre', couleur: '#24221F', teinte: '#F3EDE3', texte: '#24221F' },
    ],
    formes: ['rond', 'carre', 'quart', 'triangle'],

    // Mises en page imprimables (A4 portrait). parPage : références par page.
    modeles: [
      { id: 'plaquette', nom: 'Plaquette', detail: 'Couverture, présentation et chiffres clés, puis deux références par page.', parPage: 2 },
      { id: 'fiches', nom: 'Fiches', detail: 'Une référence par page, avec le mot d\'introduction en tête.', parPage: 1 },
      { id: 'liste', nom: 'Liste', detail: 'Tableau récapitulatif : client, mission, résultat, année.', parPage: 14 },
    ],

    // Trame d'aide à la rédaction.
    verbes: ['analysé', 'cadré', 'conçu', 'réalisé', 'livré', 'animé', 'coordonné', 'formé', 'mis en place', 'automatisé', 'réorganisé', 'rénové', 'optimisé', 'accompagné', 'piloté', 'repensé'],
    anonymisation: [
      'une PME industrielle de 40 salariés',
      'un réseau de 12 agences en région',
      'une association d\'aide à domicile',
      'une collectivité de 15 000 habitants',
      'un cabinet de conseil de 8 personnes',
      'une famille dans une maison des années 1970',
      'une enseigne de 5 boutiques',
      'une start-up du numérique en croissance',
    ],
    // Demande de témoignage : questions courtes, faciles à répondre par écrit.
    questionsTemoignage: [
      'Quelle était votre situation avant notre collaboration ?',
      'Qu\'est-ce qui vous a décidé à travailler avec moi ?',
      'Qu\'est-ce qui a changé depuis, concrètement ?',
      'Que diriez-vous à quelqu\'un qui hésite à faire appel à moi ?',
      'Puis-je citer votre nom, votre fonction et votre structure avec ce témoignage ?',
    ],

    conseils: [
      ['Une référence = un résultat', 'Un chiffre saisi par toi (délai, économies, volume, satisfaction) vaut mieux qu\'un long paragraphe.'],
      ['Anonymise par défaut', 'Sans accord écrit du client, il est décrit par son secteur, sa taille et sa région : la plaquette ne le nomme jamais.'],
      ['Demande le témoignage à chaud', 'À la livraison, le client se souvient de ce qui a changé. Le message à copier pose cinq questions courtes.'],
      ['Choisis pour le prospect', 'Trois références proches de son secteur et de son besoin convainquent mieux que vingt références en vrac.'],
    ],
  };
})();
