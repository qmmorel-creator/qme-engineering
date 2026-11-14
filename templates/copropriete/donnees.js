// Base intégrée de Charges et AG de copropriété : postes de charges types, types de lots, d'assemblées, de documents,
// libellés de vote, rappels sourcés et datés (service-public.gouv.fr), couleurs fixes.
// Contenu original rédigé pour QME. Aucune règle de majorité intégrée : la majorité d'une résolution est celle que
// l'utilisateur lit dans la convocation. Aucun montant, aucun taux de charge, aucune clé de répartition par défaut :
// tout vient des appels de fonds et des décomptes du syndic, saisis par l'utilisateur.
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Postes de charges types (décompte annuel). cite : catégorie citée par la fiche F947 de service-public.gouv.fr
    // parmi les charges récupérables sur le locataire (décret n° 87-713 du 26 août 1987). null : non citée, à vérifier.
    // propose : part récupérable proposée par le bouton d'aide (modifiable, jamais appliquée sans l'utilisateur).
    postes: [
      { id: 'eau-froide', nom: 'Eau froide', cite: true, propose: 100, aide: 'Eau froide : catégorie citée parmi les charges récupérables.' },
      { id: 'eau-chaude', nom: 'Eau chaude collective', cite: true, propose: 100, aide: 'Eau chaude collective : catégorie citée parmi les charges récupérables.' },
      { id: 'chauffage', nom: 'Chauffage collectif', cite: true, propose: 100, aide: 'Chauffage collectif : catégorie citée parmi les charges récupérables.' },
      { id: 'ascenseur', nom: 'Ascenseur', cite: true, propose: 100, aide: 'Électricité, exploitation et petites réparations de l\'ascenseur sont citées ; le contrôle technique tous les 5 ans n\'est pas récupérable.' },
      { id: 'entretien', nom: 'Ménage et entretien des parties communes', cite: true, propose: 100, aide: 'Produits d\'entretien et frais de personnel d\'entretien des parties communes intérieures : cités.' },
      { id: 'electricite', nom: 'Électricité des parties communes', cite: true, propose: 100, aide: 'Électricité des parties communes intérieures : citée.' },
      { id: 'gardien', nom: 'Gardien ou employé d\'immeuble', cite: true, propose: null, aide: 'Salaire du gardien ou de l\'employé d\'immeuble : récupérable sous certaines conditions. Saisis la part indiquée par le syndic.' },
      { id: 'exterieurs', nom: 'Espaces verts et abords', cite: true, propose: 100, aide: 'Espaces extérieurs (voies, stationnement, abords des espaces verts, jeux) : cités.' },
      { id: 'ordures', nom: 'Taxes et redevances (ordures, assainissement)', cite: true, propose: 100, aide: 'Taxes et redevances (ordures ménagères, balayage, assainissement) : citées.' },
      { id: 'contrats', nom: 'Contrats d\'entretien (portes, interphone, VMC)', cite: null, propose: null, aide: 'Selon l\'équipement et le contrat : regarde la colonne « récupérable » du décompte du syndic.' },
      { id: 'assurance', nom: 'Assurance de l\'immeuble', cite: null, propose: null, aide: 'Non citée par la fiche F947 : vérifie le décompte du syndic.' },
      { id: 'honoraires', nom: 'Honoraires du syndic', cite: null, propose: null, aide: 'Non citée par la fiche F947 : vérifie le décompte du syndic.' },
      { id: 'administratif', nom: 'Frais administratifs et bancaires', cite: null, propose: null, aide: 'Non citée par la fiche F947 : vérifie le décompte du syndic.' },
      { id: 'reparations', nom: 'Petits travaux et réparations', cite: null, propose: null, aide: 'Selon la nature de la réparation : regarde le décompte du syndic.' },
      { id: 'autres', nom: 'Autres charges', cite: null, propose: null, aide: 'À vérifier ligne par ligne sur le décompte.' },
    ],

    typesLot: [
      { id: 'logement', nom: 'Logement' },
      { id: 'cave', nom: 'Cave' },
      { id: 'parking', nom: 'Parking ou box' },
      { id: 'local', nom: 'Local commercial ou professionnel' },
      { id: 'autre', nom: 'Autre lot' },
    ],

    typesAG: [
      { id: 'ordinaire', nom: 'Assemblée générale ordinaire' },
      { id: 'extraordinaire', nom: 'Assemblée générale extraordinaire' },
    ],
    // Libellés seulement : la majorité requise est celle écrite dans la convocation, saisie par l'utilisateur.
    majorites: ['Article 24', 'Article 25', 'Article 25-1', 'Article 26', 'Unanimité', 'Non précisée'],
    presences: [
      { id: 'present', nom: 'Présent(e)' },
      { id: 'represente', nom: 'Représenté(e) par un mandataire' },
      { id: 'correspondance', nom: 'Vote par correspondance' },
      { id: 'distance', nom: 'Présent(e) à distance' },
      { id: 'absent', nom: 'Absent(e)' },
    ],

    // Documents à conserver : types proposés (référence de rangement saisie, aucun fichier, aucune durée imposée).
    typesDocument: [
      'Règlement de copropriété et état descriptif de division',
      'Convocation et ordre du jour',
      'Procès-verbal d\'assemblée générale',
      'Appel de fonds',
      'Décompte annuel des charges',
      'Budget prévisionnel',
      'Contrat de syndic',
      'Carnet d\'entretien de l\'immeuble',
      'Devis et factures de travaux',
      'Diagnostics de l\'immeuble',
      'Courrier du syndic',
      'Autre document',
    ],

    // Rappels repris de service-public.gouv.fr (fiches datées). Indicatifs, désactivables dans les Réglages.
    regles: {
      provisions: { texte: 'Les provisions du budget prévisionnel sont égales au quart du budget voté et dues le 1er jour de chaque trimestre, ou le 1er jour de la période fixée par l\'assemblée générale.', source: 'F20586' },
      fondsTravaux: { taux: 5, texte: 'Dans un immeuble à destination totale ou partielle d\'habitation, un fonds de travaux est constitué à la fin d\'une période de 10 ans après la réception des travaux de construction. Sa cotisation annuelle ne peut pas être inférieure à 5 % du budget prévisionnel (avec un plan pluriannuel de travaux adopté : ni à 2,5 % du montant des travaux prévus dans ce plan). Elle est appelée avec la même périodicité que les provisions du budget.', source: 'F34026' },
      recuperables: { texte: 'La liste des charges récupérables sur le locataire d\'un logement loué vide est fixée par le décret n° 87-713 du 26 août 1987. Elles sont régularisées au moins une fois par an en comparant les provisions versées aux dépenses réelles ; un mois avant, le propriétaire communique le décompte des charges par nature.', source: 'F947' },
    },
    sources: [
      { id: 'F20586', titre: 'Budget prévisionnel d\'une copropriété', editeur: 'service-public.gouv.fr (DILA)', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F20586', verifiePar: '4 août 2026', consulte: '2026-11-14' },
      { id: 'F34026', titre: 'Fonds de travaux mis en place dans les copropriétés', editeur: 'service-public.gouv.fr (DILA)', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F34026', verifiePar: '9 juin 2026', consulte: '2026-11-14' },
      { id: 'F947', titre: 'Charges à payer par le locataire (charges locatives ou charges récupérables)', editeur: 'service-public.gouv.fr (DILA)', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F947', verifiePar: '15 avril 2025', consulte: '2026-11-14' },
    ],

    reglages: {
      alerte: 15,       // jours avant l'échéance d'un appel de fonds pour le signaler
      alerteAG: 21,     // jours avant une assemblée générale pour proposer de la préparer
      rappels: true,    // rappels sourcés (provisions trimestrielles, fonds de travaux, charges récupérables)
    },

    // Couleurs des graphiques, dans cet ordre (jamais générées), validées avec le validateur du skill dataviz
    // (bande de luminosité, chroma, daltonisme, contraste ≥ 3:1 sur fond clair).
    // 0 : provisions appelées · 1 : charges réelles · 2 : récupérable (texture sur la couleur 1).
    couleurs: ['#2A78D6', '#EB6834'],

    conseils: [
      ['Tes lots, une fois', 'Note les tantièmes de chaque lot : l\'application calcule ta part quand un vote ou un devis donne un montant global.'],
      ['Chaque appel reçu', 'Recopie l\'appel de fonds du syndic (provisions, fonds de travaux, travaux) et coche-le payé : plus de retard ni de double paiement.'],
      ['Le décompte annuel', 'Saisis tes charges réelles par poste à réception du décompte : la régularisation et la part récupérable sur le locataire se calculent.'],
      ['L\'AG préparée', 'Ordre du jour, majorité écrite dans la convocation, ton vote, puis le résultat : les travaux votés gardent leur échéancier.'],
    ],
  };
})();
