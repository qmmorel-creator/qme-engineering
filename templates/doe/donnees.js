// Base intégrée du registre du DOE : familles de pièces, lots types et pièces attendues par lot.
// Intitulés usuels de fin de chantier, rédigés pour le produit : ce sont des propositions, modifiables par
// l'utilisateur. La liste exigée pour une opération est celle de son marché (CCAP, CCTP), qui fait foi.
// Seule référence réglementaire : article 40 du CCAG Travaux 2021, en paraphrase (voir `legal`).
window.BASE = {
  // Délais de départ, réglables, jamais présentés comme réglementaires ni contractuels.
  delaiRemise: 30,      // jours après la réception, pour proposer une date limite de remise du DOE
  delaiReprise: 15,     // jours accordés pour renvoyer une pièce à reprendre
  intervalleRelance: 7, // jours minimum entre deux relances d'une même entreprise

  // Familles de pièces, dans l'ordre d'affichage. `court` : libellé des étiquettes.
  familles: [
    { code: 'plan', nom: 'Plans d\'exécution et de récolement', court: 'Plans' },
    { code: 'notice', nom: 'Notices de fonctionnement et d\'entretien', court: 'Notices' },
    { code: 'pv', nom: 'Procès-verbaux d\'essais et de mise en service', court: 'PV d\'essais' },
    { code: 'fiche', nom: 'Fiches techniques et références des produits', court: 'Fiches techniques' },
    { code: 'garantie', nom: 'Garanties et attestations', court: 'Garanties' },
    { code: 'diuo', nom: 'Éléments pour le DIUO', court: 'DIUO' },
    { code: 'autre', nom: 'Autres pièces', court: 'Autre' },
  ],

  // Pièce ajoutée à chaque lot quand l'opération comprend un DIUO (case de l'opération).
  pieceDiuo: { famille: 'diuo', intitule: 'Éléments du lot pour le DIUO (accès, interventions ultérieures, risques)' },

  // Formats de remise proposés.
  formats: ['Numérique', 'Papier', 'Numérique et papier'],

  // Modes de relance proposés (aucun envoi automatique : la relance se fait hors de l'outil).
  modesRelance: ['Courrier', 'E-mail', 'Téléphone', 'Réunion de chantier', 'Compte rendu de chantier'],

  // Lots types et pièces attendues : [famille, intitulé].
  lots: [
    { code: 'VRD', nom: 'VRD et aménagements extérieurs', courant: true, pieces: [
      ['plan', 'Plans de récolement des réseaux enterrés (tracés, fils d\'eau, profondeurs)'],
      ['pv', 'PV d\'essais des réseaux (étanchéité, inspection télévisée, compactage)'],
      ['fiche', 'Fiches techniques des regards, canalisations et revêtements'],
      ['notice', 'Notice d\'entretien des ouvrages de gestion des eaux pluviales'],
    ] },
    { code: 'DEM', nom: 'Démolition et curage', pieces: [
      ['autre', 'Bordereaux de suivi et justificatifs d\'évacuation des déchets'],
      ['plan', 'Plan des démolitions réalisées'],
    ] },
    { code: 'GO', nom: 'Gros œuvre', courant: true, pieces: [
      ['plan', 'Plans de récolement des ouvrages de gros œuvre'],
      ['plan', 'Plans des réservations et trémies réalisées'],
      ['fiche', 'Fiches techniques des bétons, aciers et isolants mis en œuvre'],
      ['pv', 'PV d\'essais d\'écrasement des bétons'],
      ['autre', 'Justificatifs d\'évacuation des déchets du lot'],
    ] },
    { code: 'CH', nom: 'Charpente', pieces: [
      ['plan', 'Plans d\'exécution de la charpente conformes à la réalisation'],
      ['fiche', 'Fiches techniques des bois, connecteurs et traitements'],
      ['garantie', 'Certificats de traitement des bois'],
    ] },
    { code: 'CE', nom: 'Couverture et étanchéité', courant: true, pieces: [
      ['plan', 'Plans de récolement de la toiture (pentes, évacuations, relevés)'],
      ['fiche', 'Fiches techniques et avis techniques des complexes d\'étanchéité'],
      ['pv', 'PV d\'essai d\'étanchéité (mise en eau ou contrôle équivalent)'],
      ['notice', 'Notice d\'entretien de la toiture et des évacuations'],
      ['garantie', 'Conditions de garantie du fabricant du complexe'],
    ] },
    { code: 'FA', nom: 'Façades et ravalement', pieces: [
      ['fiche', 'Fiches techniques des enduits, isolants et revêtements de façade'],
      ['notice', 'Notice d\'entretien des façades'],
      ['garantie', 'Conditions de garantie des fabricants'],
    ] },
    { code: 'ME', nom: 'Menuiseries extérieures', courant: true, pieces: [
      ['plan', 'Plans et carnet de détails des menuiseries posées'],
      ['fiche', 'Fiches techniques des profilés, vitrages et occultations'],
      ['pv', 'PV de classement des menuiseries (air, eau, vent)'],
      ['notice', 'Notices de manœuvre, de réglage et d\'entretien'],
      ['garantie', 'Conditions de garantie des fabricants (vitrages, motorisations)'],
    ] },
    { code: 'SER', nom: 'Serrurerie et métallerie', courant: true, pieces: [
      ['plan', 'Plans d\'exécution des ouvrages métalliques conformes à la réalisation'],
      ['fiche', 'Fiches techniques des traitements de surface (galvanisation, thermolaquage)'],
      ['notice', 'Notice d\'entretien des ouvrages métalliques'],
    ] },
    { code: 'CLO', nom: 'Cloisons, doublages et faux plafonds', courant: true, pieces: [
      ['plan', 'Plans de récolement des cloisons et faux plafonds'],
      ['fiche', 'Fiches techniques des plaques, ossatures et isolants'],
      ['fiche', 'PV de classement de réaction et de résistance au feu des ouvrages concernés'],
    ] },
    { code: 'MI', nom: 'Menuiseries intérieures', courant: true, pieces: [
      ['plan', 'Plan de repérage des portes et organigramme des clés'],
      ['fiche', 'Fiches techniques des blocs-portes et de la quincaillerie'],
      ['notice', 'Notice de réglage et d\'entretien des ferme-portes et serrures'],
      ['autre', 'Bordereau de remise des clés'],
    ] },
    { code: 'CAR', nom: 'Carrelage et faïence', courant: true, pieces: [
      ['plan', 'Plans de calepinage réalisés'],
      ['fiche', 'Fiches techniques des carreaux, colles, joints et étanchéités sous carrelage'],
      ['notice', 'Notice d\'entretien des revêtements'],
      ['autre', 'Références des carreaux posés et surplus remis'],
    ] },
    { code: 'SS', nom: 'Sols souples', pieces: [
      ['fiche', 'Fiches techniques des revêtements et des colles'],
      ['notice', 'Notice d\'entretien des sols souples'],
    ] },
    { code: 'PEI', nom: 'Peinture et revêtements muraux', courant: true, pieces: [
      ['fiche', 'Fiches techniques des peintures et revêtements appliqués'],
      ['autre', 'Nuancier des teintes appliquées, local par local'],
      ['notice', 'Notice d\'entretien des revêtements'],
    ] },
    { code: 'PLB', nom: 'Plomberie et sanitaires', courant: true, pieces: [
      ['plan', 'Plans de récolement des réseaux d\'eau et d\'évacuation'],
      ['plan', 'Schémas de principe des installations'],
      ['fiche', 'Fiches techniques des appareils et équipements'],
      ['notice', 'Notices de fonctionnement et d\'entretien (production d\'eau chaude, appareils)'],
      ['pv', 'PV d\'essais d\'étanchéité des réseaux'],
      ['pv', 'PV de rinçage et de désinfection des réseaux'],
      ['garantie', 'Conditions de garantie des fabricants'],
    ] },
    { code: 'CVC', nom: 'Chauffage, ventilation et climatisation', courant: true, pieces: [
      ['plan', 'Plans de récolement des réseaux et des équipements'],
      ['plan', 'Schémas de principe et synoptiques de régulation'],
      ['fiche', 'Fiches techniques des équipements'],
      ['notice', 'Notices de fonctionnement, de conduite et de maintenance'],
      ['pv', 'PV d\'essais, d\'équilibrage et de mise en service'],
      ['garantie', 'Conditions de garantie des fabricants'],
    ] },
    { code: 'CFO', nom: 'Électricité courants forts', courant: true, pieces: [
      ['plan', 'Plans de récolement (distribution, éclairage, prises)'],
      ['plan', 'Schémas unifilaires des tableaux électriques'],
      ['fiche', 'Fiches techniques des appareillages et luminaires'],
      ['notice', 'Notices de fonctionnement et d\'entretien'],
      ['pv', 'PV d\'essais et de mesures (isolement, continuité, prise de terre)'],
      ['garantie', 'Conditions de garantie des fabricants'],
    ] },
    { code: 'CFA', nom: 'Courants faibles', pieces: [
      ['plan', 'Plans de récolement et synoptiques des réseaux courants faibles'],
      ['pv', 'Cahier de recette des réseaux (tests de câblage)'],
      ['notice', 'Notices d\'exploitation (alarme, contrôle d\'accès, interphonie)'],
      ['fiche', 'Fiches techniques des équipements'],
    ] },
    { code: 'ASC', nom: 'Ascenseurs', pieces: [
      ['autre', 'Dossier technique de l\'appareil et déclaration de conformité du fabricant'],
      ['notice', 'Notice d\'utilisation et de maintenance'],
      ['pv', 'PV d\'essais de mise en service'],
      ['garantie', 'Conditions de garantie'],
    ] },
    { code: 'EV', nom: 'Espaces verts', pieces: [
      ['plan', 'Plan des plantations réalisées'],
      ['autre', 'Liste des végétaux plantés'],
      ['notice', 'Notice d\'entretien et d\'arrosage'],
      ['garantie', 'Conditions de garantie de reprise des végétaux'],
    ] },
    { code: 'NET', nom: 'Nettoyage de fin de chantier', pieces: [
      ['fiche', 'Fiches techniques des produits de protection et de traitement des sols'],
    ] },
  ],

  // Cycle d'une pièce, dans l'ordre.
  cycle: [
    ['Attendue', 'La pièce figure dans la liste du lot mais n\'a pas été remise. Elle est en retard une fois la date limite passée.'],
    ['Reçue', 'L\'entreprise l\'a remise : elle reste à vérifier (contenu, conformité à la réalisation, format).'],
    ['À reprendre', 'La vérification a relevé un manque ou une erreur : motif noté, nouvelle date, l\'entreprise la renvoie.'],
    ['Validée', 'La pièce est vérifiée et acceptée : elle entre dans le DOE et peut figurer au bordereau de transmission.'],
  ],

  // Bonnes pratiques (savoir-faire de chantier, rien de réglementaire).
  conseils: [
    ['Fixer la liste dès le départ', 'Reprends la liste des pièces du CCTP ou du CCAP de chaque lot et ajuste les pièces types : c\'est elle qui fait foi.'],
    ['Demander tôt', 'Les fiches techniques et les avis techniques se collectent pendant le chantier, pas après la réception.'],
    ['Vérifier ce qui est conforme à l\'exécution', 'Un plan d\'exécution non mis à jour n\'est pas un plan de récolement : le noter en motif de reprise.'],
    ['Relancer par écrit et dater', 'Chaque relance est notée ici (date, mode) : l\'historique sert en réunion et en fin d\'opération.'],
    ['Une pièce, une référence', 'Note la référence du document (indice, nom du fichier) : elle est reprise au bordereau de transmission.'],
    ['Transmettre ce qui est validé', 'Le bordereau ne reprend que les pièces validées (ou reçues si tu le choisis) : ce qui manque reste visible.'],
  ],

  // Référence vérifiée (paraphrase, pas de citation longue). Applicable seulement aux marchés qui s'y réfèrent.
  legal: {
    texte: 'Article 40 du CCAG Travaux 2021 (« Documents fournis après exécution »)',
    url: 'https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000043310498',
    version: 'arrêté du 30 mars 2021, NOR ECOM2106871A',
    consulte: '14/11/2026',
    points: [
      'Pour les marchés publics de travaux qui s\'y réfèrent, le titulaire remet au maître d\'œuvre les dossiers des ouvrages exécutés lorsqu\'il demande la réception : plans conformes à la réalisation, fiches techniques, notices de fonctionnement, prescriptions de maintenance, conditions de garantie des fabricants, constats d\'évacuation des déchets et documents nécessaires au DIUO.',
      'Un exemplaire des documents nécessaires au DIUO est aussi remis au coordonnateur en matière de sécurité et de protection de la santé.',
      'En cas d\'allotissement, chaque lot remet son DOE dès l\'achèvement de ses ouvrages ; le contenu précis, le format et les pénalités de retard sont fixés par les documents particuliers du marché.',
    ],
  },
};
