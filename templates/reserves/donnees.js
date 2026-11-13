// Base intégrée de la levée de réserves : lots types, natures de réserve, règles de rédaction.
// Intitulés usuels de chantier, rien de réglementaire. Seule référence légale : article 1792-6 du
// Code civil (Légifrance, consulté le 12/11/2026), présentée en paraphrase dans le Guide.
window.BASE = {
  // Délais de départ, réglables, jamais présentés comme réglementaires ni contractuels.
  delaiDefaut: 30,
  alerteDefaut: 7,
  delaiRefus: 15,

  lots: [
    { code: 'VRD', nom: 'VRD et aménagements extérieurs', courant: true },
    { code: 'DEM', nom: 'Démolition et curage' },
    { code: 'GO', nom: 'Gros œuvre', courant: true },
    { code: 'CH', nom: 'Charpente' },
    { code: 'CE', nom: 'Couverture et étanchéité', courant: true },
    { code: 'FA', nom: 'Façades et ravalement' },
    { code: 'ME', nom: 'Menuiseries extérieures', courant: true },
    { code: 'SER', nom: 'Serrurerie et métallerie', courant: true },
    { code: 'CLO', nom: 'Cloisons, doublages et faux plafonds', courant: true },
    { code: 'MI', nom: 'Menuiseries intérieures', courant: true },
    { code: 'CAR', nom: 'Carrelage et faïence', courant: true },
    { code: 'SS', nom: 'Sols souples' },
    { code: 'PEI', nom: 'Peinture et revêtements muraux', courant: true },
    { code: 'PLB', nom: 'Plomberie et sanitaires', courant: true },
    { code: 'CVC', nom: 'Chauffage, ventilation et climatisation', courant: true },
    { code: 'CFO', nom: 'Électricité courants forts', courant: true },
    { code: 'CFA', nom: 'Courants faibles' },
    { code: 'ASC', nom: 'Ascenseurs' },
    { code: 'EV', nom: 'Espaces verts' },
    { code: 'NET', nom: 'Nettoyage de fin de chantier' },
  ],

  natures: [
    { nom: 'Finition et aspect', exemple: 'Reprise d\'enduit visible, joint irrégulier, teinte non uniforme.' },
    { nom: 'Dégradation ou choc', exemple: 'Porte rayée, carreau fêlé, angle de cloison épaufré.' },
    { nom: 'Élément manquant', exemple: 'Butée de porte, cache de prise, plinthe non posée.' },
    { nom: 'Fonctionnement et réglage', exemple: 'Fenêtre qui frotte, robinet qui goutte, serrure dure.' },
    { nom: 'Non-conforme au marché', exemple: 'Modèle d\'appareil différent du descriptif, cote hors plan.' },
    { nom: 'Étanchéité et infiltration', exemple: 'Trace d\'eau en sous-face, joint de douche discontinu.' },
    { nom: 'Nettoyage', exemple: 'Traces de peinture sur le vitrage, gravats en gaine.' },
    { nom: 'Sécurité et accessibilité', exemple: 'Garde-corps mal fixé, ressaut au seuil, éclairage de secours éteint.' },
    { nom: 'Équipement non mis en service', exemple: 'VMC à l\'arrêt, interphone non raccordé.' },
    { nom: 'Documentaire', exemple: 'Notice, procès-verbal d\'essai ou plan de récolement manquant.' },
  ],

  niveaux: ['Sous-sol', 'RDC', 'R+1', 'R+2', 'R+3', 'R+4', 'R+5', 'R+6', 'Combles', 'Toiture', 'Extérieurs'],

  // Bien rédiger une réserve.
  redaction: [
    ['Une réserve, un défaut', 'Trois défauts dans la même pièce font trois réserves : chacune se lève et se contrôle séparément.'],
    ['Localiser sans ambiguïté', 'Bâtiment, niveau, local, puis l\'endroit précis : « mur nord, à gauche de la fenêtre ».'],
    ['Décrire un fait', '« Fissure de 30 cm sous l\'allège », pas « finition à revoir ». Ce qui se voit ou se mesure.'],
    ['Dire ce qui est attendu', 'Remplacer, régler, compléter, nettoyer : l\'entreprise sait quoi faire sans revenir te demander.'],
    ['Désigner une entreprise', 'Une seule entreprise responsable par réserve. En cas de doute, le dire dans la description et trancher vite.'],
    ['Fixer une échéance', 'Le délai par défaut est réglable ; le contrat de l\'opération fait foi.'],
    ['Garder la preuve', 'Note la référence de la photo (numéro du cliché, dossier partagé) : les photos ne sont pas stockées dans l\'outil.'],
  ],

  // Cycle d'une réserve, dans l'ordre.
  cycle: [
    ['Ouverte', 'Constatée lors des opérations préalables à la réception, à la réception ou pendant l\'année qui suit. À lever par l\'entreprise avant l\'échéance.'],
    ['Levée, à contrôler', 'L\'entreprise déclare l\'avoir reprise. Elle reste à vérifier sur place.'],
    ['Contrôlée', 'La reprise est vérifiée et acceptée : la réserve est soldée et figure au procès-verbal de levée.'],
    ['Refusée', 'La reprise n\'est pas satisfaisante : motif noté, nouvelle échéance, l\'entreprise reprend.'],
  ],

  // Référence légale vérifiée (paraphrase, pas de citation longue).
  legal: {
    texte: 'Article 1792-6 du Code civil',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006443552',
    version: 'en vigueur depuis le 1er janvier 1979',
    consulte: '12/11/2026',
    points: [
      'La réception est l\'acte par lequel le maître de l\'ouvrage déclare accepter l\'ouvrage, avec ou sans réserves ; elle est prononcée contradictoirement.',
      'La garantie de parfait achèvement, due par l\'entrepreneur pendant un an à compter de la réception, couvre les désordres signalés par le maître de l\'ouvrage : par les réserves du procès-verbal de réception, ou par notification écrite pour ceux révélés après.',
      'Les délais des travaux de reprise sont fixés d\'un commun accord entre le maître de l\'ouvrage et l\'entrepreneur.',
    ],
  },
};
