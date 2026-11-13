// Base intégrée du suivi des abonnements : catégories, abonnements types et repères de résiliation.
// Contenu original rédigé pour QME. Aucune marque, aucun prix : l'utilisateur saisit toujours son montant.
// Les durées d'engagement et de préavis proposées sont des valeurs de départ courantes, modifiables
// abonnement par abonnement (le contrat fait foi). Repères juridiques : relevés le 13/11/2026, à revérifier
// chaque année (mise à jour annuelle de ce fichier).
(() => {
  // t(nom, périodicité, engagement en mois, préavis en jours, essai fréquent)
  const t = (nom, periodicite = 'mensuel', engagementMois = 0, preavisJours = 0, essai = false) => ({ nom, periodicite, engagementMois, preavisJours, essai });

  window.BASE = {
    version: '2026-11-13',

    periodicites: [
      { id: 'hebdo', nom: 'Chaque semaine', court: 'semaine', parAn: 52 },
      { id: 'mensuel', nom: 'Chaque mois', court: 'mois', parAn: 12 },
      { id: 'bimestriel', nom: 'Tous les 2 mois', court: '2 mois', parAn: 6 },
      { id: 'trimestriel', nom: 'Chaque trimestre', court: 'trimestre', parAn: 4 },
      { id: 'semestriel', nom: 'Tous les 6 mois', court: 'semestre', parAn: 2 },
      { id: 'annuel', nom: 'Chaque année', court: 'an', parAn: 1 },
    ],

    // Catégories et abonnements types (noms génériques, jamais de marque). « doublon » : catégorie où deux
    // abonnements en cours font souvent double emploi (piste d'économie proposée).
    categories: [
      { id: 'video', doublon: true, nom: 'Vidéo et TV', types: [
        t('Plateforme de streaming vidéo (séries et films)', 'mensuel', 0, 0, true),
        t('Deuxième plateforme de streaming vidéo', 'mensuel', 0, 0, true),
        t('Plateforme de sport en direct', 'mensuel', 0, 0, true),
        t('Plateforme d\'animation et de mangas', 'mensuel', 0, 0, true),
        t('Bouquet de chaînes TV payantes', 'mensuel', 12, 30),
        t('Vidéo à la demande jeunesse', 'mensuel', 0, 0, true),
      ] },
      { id: 'audio', doublon: true, nom: 'Musique et audio', types: [
        t('Streaming musical', 'mensuel', 0, 0, true),
        t('Streaming musical, offre famille', 'mensuel', 0, 0, true),
        t('Livres audio', 'mensuel', 0, 0, true),
        t('Podcasts et radio sans publicité', 'mensuel'),
      ] },
      { id: 'presse', doublon: true, nom: 'Presse et lecture', types: [
        t('Quotidien national en numérique', 'mensuel', 0, 0, true),
        t('Presse régionale', 'mensuel'),
        t('Magazine hebdomadaire', 'mensuel'),
        t('Magazine trimestriel ou revue', 'trimestriel'),
        t('Kiosque numérique (plusieurs titres)', 'mensuel', 0, 0, true),
        t('Livres numériques en illimité', 'mensuel', 0, 0, true),
        t('Bande dessinée numérique en illimité', 'mensuel', 0, 0, true),
        t('Newsletter payante', 'annuel'),
        t('Magazine jeunesse', 'mensuel'),
      ] },
      { id: 'mobile', nom: 'Téléphone mobile', types: [
        t('Forfait mobile', 'mensuel'),
        t('Forfait mobile enfant', 'mensuel'),
        t('Forfait données pour tablette', 'mensuel'),
        t('Seconde ligne (montre connectée, voiture)', 'mensuel'),
        t('Assurance du téléphone', 'mensuel', 12, 30),
        t('Financement ou location du téléphone', 'mensuel', 24, 0),
      ] },
      { id: 'internet', nom: 'Internet et box', types: [
        t('Box internet (fibre ou ADSL)', 'mensuel', 12, 10),
        t('Option TV de la box', 'mensuel'),
        t('Option chaînes ou bouquet de la box', 'mensuel', 1, 0),
        t('Box 4G / 5G (résidence secondaire)', 'mensuel'),
      ] },
      { id: 'assurance', nom: 'Assurances', types: [
        t('Assurance habitation', 'annuel', 12, 30),
        t('Assurance auto', 'annuel', 12, 30),
        t('Assurance moto ou scooter', 'annuel', 12, 30),
        t('Complémentaire santé (mutuelle)', 'mensuel', 12, 60),
        t('Garantie des accidents de la vie', 'annuel', 12, 60),
        t('Assurance animal de compagnie', 'mensuel', 12, 60),
        t('Protection juridique', 'annuel', 12, 60),
        t('Assurance scolaire', 'annuel'),
        t('Extension de garantie d\'un appareil', 'mensuel', 12, 30),
      ] },
      { id: 'sport', nom: 'Sport et bien-être', types: [
        t('Salle de sport', 'mensuel', 12, 30, true),
        t('Club sportif ou licence', 'annuel'),
        t('Application de coaching sportif', 'mensuel', 0, 0, true),
        t('Carte de piscine', 'trimestriel'),
        t('Cours de danse, yoga ou arts martiaux', 'trimestriel'),
        t('Application de méditation ou de sommeil', 'annuel', 0, 0, true),
      ] },
      { id: 'logiciels', nom: 'Logiciels et applications', types: [
        t('Suite bureautique', 'annuel', 0, 0, true),
        t('Logiciel de retouche photo ou de création', 'mensuel', 12, 14, true),
        t('Gestionnaire de mots de passe', 'annuel', 0, 0, true),
        t('VPN', 'annuel'),
        t('Antivirus et sécurité', 'annuel'),
        t('Assistant d\'intelligence artificielle', 'mensuel', 0, 0, true),
        t('Application de notes ou d\'organisation', 'annuel', 0, 0, true),
        t('Nom de domaine et hébergement de site', 'annuel'),
      ] },
      { id: 'stockage', doublon: true, nom: 'Stockage en ligne', types: [
        t('Stockage en ligne (cloud)', 'mensuel'),
        t('Sauvegarde des photos', 'annuel'),
        t('Stockage familial partagé', 'mensuel'),
        t('Messagerie e-mail premium', 'annuel'),
      ] },
      { id: 'livraison', nom: 'Livraison et achats', types: [
        t('Programme de livraison gratuite d\'un site marchand', 'annuel', 0, 0, true),
        t('Livraison de repas à domicile', 'mensuel', 0, 0, true),
        t('Panier de légumes', 'hebdo'),
        t('Box repas à cuisiner', 'hebdo', 0, 0, true),
        t('Box beauté ou découverte', 'mensuel'),
        t('Nourriture pour animaux livrée', 'mensuel'),
      ] },
      { id: 'jeux', doublon: true, nom: 'Jeux vidéo', types: [
        t('Abonnement en ligne de la console', 'annuel'),
        t('Catalogue de jeux en illimité', 'mensuel', 0, 0, true),
        t('Jeu en ligne par abonnement', 'mensuel'),
        t('Jeux dans le cloud', 'mensuel', 0, 0, true),
        t('Box de jeux de société', 'mensuel'),
      ] },
      { id: 'transport', nom: 'Transports', types: [
        t('Transports en commun', 'mensuel'),
        t('Vélo en libre-service', 'annuel'),
        t('Carte de réduction train', 'annuel'),
        t('Place de parking', 'mensuel', 0, 30),
        t('Autopartage', 'mensuel'),
        t('Location longue durée de vélo', 'mensuel', 12, 30),
        t('Badge de télépéage', 'mensuel'),
      ] },
      { id: 'banque', nom: 'Banque', types: [
        t('Carte bancaire ou offre groupée', 'mensuel'),
        t('Frais de tenue de compte', 'trimestriel'),
        t('Compte en ligne premium', 'mensuel'),
        t('Coffre-fort numérique', 'annuel'),
        t('Assurance des moyens de paiement', 'annuel', 12, 60),
      ] },
      { id: 'maison', nom: 'Maison et services', types: [
        t('Alarme et télésurveillance', 'mensuel', 12, 30),
        t('Contrat d\'entretien de la chaudière', 'annuel', 12, 30),
        t('Aide à domicile ou ménage', 'mensuel'),
        t('Entretien du jardin', 'mensuel'),
        t('Location de matériel (fontaine à eau, électroménager)', 'mensuel', 12, 30),
      ] },
      { id: 'famille', nom: 'Famille et apprentissage', types: [
        t('Soutien scolaire en ligne', 'mensuel', 0, 0, true),
        t('Application d\'apprentissage des langues', 'annuel', 0, 0, true),
        t('Activité extrascolaire', 'trimestriel'),
        t('Box d\'activités pour enfants', 'mensuel'),
        t('Garderie périscolaire', 'mensuel'),
        t('Contrôle parental', 'annuel'),
      ] },
      { id: 'dons', nom: 'Dons et adhésions', types: [
        t('Don mensuel à une association', 'mensuel'),
        t('Cotisation d\'association', 'annuel'),
        t('Parrainage d\'un enfant ou d\'un animal', 'mensuel'),
        t('Adhésion syndicale ou professionnelle', 'annuel'),
      ] },
      { id: 'autres', nom: 'Autres', types: [
        t('Autre abonnement', 'mensuel'),
        t('Box de produits du terroir', 'mensuel'),
      ] },
    ],

    // Moyens de paiement proposés (saisie libre possible).
    paiements: ['Carte bancaire', 'Prélèvement', 'Compte de paiement en ligne', 'Facture du téléphone', 'Chèque', 'Espèces'],

    // Repères généraux (droit français de la consommation). Outil d'aide : le contrat et les textes font foi.
    reperes: [
      ['Reconduction tacite', 'Pour un contrat de services reconduit tacitement, le professionnel doit te prévenir par écrit, au plus tôt 3 mois et au plus tard 1 mois avant la fin de la période où tu peux refuser la reconduction (article L215-1 du Code de la consommation).'],
      ['Assurances après un an', 'Les assurances auto, moto, habitation et affinitaires se résilient à tout moment après la première année (loi Hamon) ; la complémentaire santé aussi, depuis le 1er décembre 2020. Le nouvel assureur peut s\'en charger.'],
      ['Résiliation en ligne', 'Depuis le 1er juin 2023, un contrat qui peut être souscrit en ligne doit pouvoir être résilié en ligne, par une fonction dédiée, facile d\'accès.'],
      ['Box et forfait mobile', 'L\'engagement ne dépasse pas 24 mois. Au-delà de 12 mois, une résiliation à partir du 13e mois coûte au plus le quart des mensualités restantes (article L224-28 du Code de la consommation).'],
      ['Période d\'essai gratuite', 'Un essai qui demande ta carte bancaire devient en général payant à sa date de fin, sans autre message. Note la date de fin et décide avant.'],
    ],
    sourceReperes: 'Code de la consommation et fiches pratiques de service-public.fr, relevés le 13/11/2026 : à vérifier, les règles changent.',

    conseils: [
      ['Fais le tour une fois', 'Relevés de compte des 3 derniers mois : chaque prélèvement récurrent est un abonnement à saisir.'],
      ['Saisis ce que tu paies vraiment', 'Prix après promotion, part payée si l\'abonnement est partagé : c\'est ce montant qui compte.'],
      ['Note les dates qui engagent', 'Fin d\'essai, fin d\'engagement et préavis : l\'alerte « à décider avant le … » s\'en sert.'],
      ['Décide, puis marque', '« À résilier » garde l\'abonnement dans tes dépenses jusqu\'à la résiliation effective ; « Résilié » l\'en sort et compte l\'économie.'],
    ],
  };
})();
