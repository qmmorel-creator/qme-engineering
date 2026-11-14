// Base intégrée des subventions : types de financeurs, postes de budget, pièces types d'un dossier et d'un bilan,
// trame du bilan, rappels réglementaires sourcés et datés, couleurs fixes.
// Contenu original rédigé pour QME. Aucun calendrier de financeur, aucun montant de dispositif, aucun appel à projets :
// les dates limites, montants et pièces demandées sont saisis par l'utilisateur, dossier par dossier.
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Types de financeurs. public = autorité administrative ou organisme public (rappels réglementaires possibles).
    // Couleur : indice dans `couleurs`.
    typesFinanceur: [
      { id: 'commune', nom: 'Commune', public: true, couleur: 0 },
      { id: 'interco', nom: 'Intercommunalité', public: true, couleur: 1 },
      { id: 'departement', nom: 'Département', public: true, couleur: 2 },
      { id: 'region', nom: 'Région', public: true, couleur: 3 },
      { id: 'etat', nom: 'État et services de l\'État', public: true, couleur: 4 },
      { id: 'organisme', nom: 'Autre organisme public', public: true, couleur: 5 },
      { id: 'europe', nom: 'Fonds européens', public: true, couleur: 6 },
      { id: 'fondation', nom: 'Fondation', public: false, couleur: 7 },
      { id: 'mecenat', nom: 'Mécénat d\'entreprise', public: false, couleur: 8 },
      { id: 'autre', nom: 'Autre financeur privé', public: false, couleur: 9 },
    ],

    // Nature de l'aide demandée.
    natures: [
      { id: 'projet', nom: 'Projet ou action déterminée' },
      { id: 'fonctionnement', nom: 'Fonctionnement' },
      { id: 'investissement', nom: 'Investissement (matériel, travaux)' },
    ],

    // Postes de charges du budget prévisionnel d'un projet (libellés courants, sans numéro de compte).
    postes: [
      'Achats (matériel, fournitures)',
      'Prestations et intervenants extérieurs',
      'Locations (salles, matériel)',
      'Frais de personnel',
      'Déplacements et hébergement',
      'Communication et impression',
      'Assurances',
      'Frais de structure affectés au projet',
      'Autres charges',
    ],
    // Ressources hors subventions demandées.
    ressources: ['Fonds propres de l\'association', 'Participation des usagers', 'Recettes de l\'action (billetterie, buvette)', 'Cotisations', 'Autre ressource'],

    // Pièces types d'un dossier de demande. pour : types de financeur concernés ('public', 'prive' ou 'tous').
    // Ce sont des pièces souvent demandées : chaque financeur fixe sa propre liste, à vérifier dans son règlement.
    pieces: [
      { id: 'formulaire', nom: 'Formulaire de demande du financeur, complété et signé', pour: 'tous' },
      { id: 'lettre', nom: 'Lettre de demande adressée au financeur', pour: 'tous' },
      { id: 'presentation', nom: 'Présentation du projet (objectifs, public, calendrier)', pour: 'tous' },
      { id: 'budget-projet', nom: 'Budget prévisionnel du projet', pour: 'tous' },
      { id: 'budget-asso', nom: 'Budget prévisionnel de l\'association', pour: 'public' },
      { id: 'statuts', nom: 'Statuts à jour', pour: 'tous' },
      { id: 'dirigeants', nom: 'Liste des membres du bureau et du conseil d\'administration', pour: 'tous' },
      { id: 'identifiants', nom: 'Numéro RNA et numéro SIRET de l\'association', pour: 'public' },
      { id: 'rib', nom: 'Relevé d\'identité bancaire au nom de l\'association', pour: 'tous' },
      { id: 'comptes', nom: 'Comptes approuvés du dernier exercice clos', pour: 'tous' },
      { id: 'rapport', nom: 'Rapport d\'activité de l\'année écoulée', pour: 'tous' },
      { id: 'pv-ag', nom: 'Procès-verbal de la dernière assemblée générale', pour: 'tous' },
      { id: 'crf-precedent', nom: 'Compte rendu financier de la subvention précédente (si déjà subventionné)', pour: 'public' },
      { id: 'pouvoir', nom: 'Pouvoir du signataire, s\'il n\'est pas le représentant légal', pour: 'tous' },
      { id: 'devis', nom: 'Devis des dépenses principales', pour: 'tous' },
      { id: 'assurance', nom: 'Attestation d\'assurance responsabilité civile', pour: 'tous' },
      { id: 'contreparties', nom: 'Proposition de contreparties ou de visibilité pour le mécène', pour: 'prive' },
    ],
    // Pièces proposées par défaut à la création d'un dossier, selon le type de financeur.
    depart: {
      public: ['formulaire', 'presentation', 'budget-projet', 'budget-asso', 'statuts', 'dirigeants', 'identifiants', 'rib', 'comptes', 'rapport', 'crf-precedent'],
      prive: ['lettre', 'presentation', 'budget-projet', 'statuts', 'rib', 'comptes', 'rapport', 'contreparties'],
    },
    // Pièces types du bilan à rendre.
    piecesBilan: [
      'Compte rendu financier (formulaire du financeur)',
      'Bilan qualitatif de l\'action',
      'Tableau des dépenses réalisées',
      'Copies des factures et justificatifs demandés',
      'Supports de communication portant le logo du financeur',
      'Photos ou revue de presse de l\'action',
    ],

    // Trame du bilan d'utilisation : rubriques à remplir pour chaque dossier (questions guides).
    trameBilan: [
      { id: 'realise', titre: 'Ce qui a été réalisé', aide: 'Actions menées, dates, lieux. Ce qui était prévu et ce qui a changé.' },
      { id: 'public', titre: 'Public touché', aide: 'Nombre de participants ou de bénéficiaires, profil, comparé à l\'objectif annoncé.' },
      { id: 'resultats', titre: 'Résultats et indicateurs', aide: 'Les indicateurs annoncés dans la demande et leur valeur atteinte.' },
      { id: 'ecarts', titre: 'Écarts au budget prévu', aide: 'Les postes qui ont bougé de plus de 20 % et pourquoi.' },
      { id: 'suites', titre: 'Suites et perspectives', aide: 'Ce que l\'action devient : reconduction, évolution, nouveaux partenaires.' },
    ],

    // Rappels réglementaires pour les subventions publiques, repris de service-public.gouv.fr (fiches datées).
    // Indicatifs, désactivables dans les Réglages ; ils ne remplacent ni la convention du financeur ni un conseil.
    regles: {
      convention: { seuil: 23000, texte: 'Au-delà de 23 000 €, l\'administration ou l\'organisme qui attribue la subvention doit conclure une convention avec l\'association (objet, montant, conditions de versement et d\'utilisation).' },
      compteRendu: { mois: 6, texte: 'Pour une subvention affectée à une action déterminée, le compte rendu financier (formulaire Cerfa n° 15059*02) est remis à l\'autorité qui a versé la subvention dans les 6 mois suivant la fin de l\'exercice pour lequel elle a été attribuée, et avant toute nouvelle demande.' },
      comptesAnnuels: { seuil: 153000, texte: 'Une association qui reçoit des subventions en numéraire dont le total dépasse 153 000 € doit établir des comptes annuels (bilan, compte de résultat, annexe), nommer un commissaire aux comptes et publier ses comptes au Journal officiel des associations dans les 3 mois suivant leur approbation.' },
    },
    sources: [
      { id: 'F3180', titre: 'Subventions versées aux associations', editeur: 'service-public.gouv.fr (DILA)', url: 'https://www.service-public.gouv.fr/associations/vosdroits/F3180', verifiePar: '1er janvier 2026', consulte: '2026-11-14' },
      { id: 'R46623', titre: 'Association : compte-rendu financier de subvention (Cerfa n° 15059*02)', editeur: 'service-public.gouv.fr (DILA)', url: 'https://www.service-public.gouv.fr/associations/vosdroits/R46623', verifiePar: '30 décembre 2025', consulte: '2026-11-14' },
    ],

    reglages: {
      alerte: 21,           // jours avant une date limite pour la signaler comme proche
      relanceReponse: 30,   // jours après le dépôt, sans date de réponse attendue saisie, pour proposer une relance
      debutExercice: 1,     // mois de début de l'exercice comptable de l'association (1 = janvier)
      rappels: true,        // rappels réglementaires des subventions publiques (convention, compte rendu, comptes annuels)
    },

    // Couleurs des types de financeurs, dans cet ordre (jamais générées). Toujours accompagnées du libellé.
    couleurs: ['#2A78D6', '#1BAF7A', '#EB6834', '#6250D6', '#24221F', '#008300', '#E87BA4', '#EDA100', '#E34948', '#8A8275'],

    conseils: [
      ['Un dossier par financeur', 'Pour un même projet, crée un dossier par financeur sollicité : chacun a ses dates, ses pièces et son montant.'],
      ['Les dates, c\'est toi', 'Aucun calendrier n\'est intégré : note la date limite de dépôt lue dans l\'appel à projets ou le règlement du financeur.'],
      ['Les pièces une fois pour toutes', 'Statuts, RIB, comptes : coche ce qui est prêt. Les pièces communes se retrouvent d\'un dossier à l\'autre.'],
      ['Le bilan se prépare dès le début', 'Rattache chaque dépense au projet et garde le justificatif : le bilan se remplit presque seul.'],
    ],
  };
})();
