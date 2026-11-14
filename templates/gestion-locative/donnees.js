// Base intégrée de la gestion locative : réglages par défaut, catégories de dépenses, paliers de relance,
// modèles de quittance et de relance, repères et sources. Contenu original rédigé pour QME, aucune logique ici.
// AUCUN indice de référence des loyers (IRL) n'est intégré : il se périme chaque trimestre. L'utilisateur
// saisit les valeurs publiées par l'Insee. Les règles légales sont des PARAMÈTRES relevés le 14/11/2026 sur
// service-public.gouv.fr et Légifrance (loi n° 89-462 du 6 juillet 1989), modifiables dans les Réglages.
(() => {
  window.BASE = {
    version: '2026-11-14',

    reglages: {
      tolerance: 5,            // jours après l'échéance avant qu'un loyer non payé soit « en retard »
      paliers: [5, 15, 30],    // relance 1, 2, 3 : jours de retard depuis l'échéance la plus ancienne non payée
      depotMoisNu: 1,          // dépôt de garantie au plus : 1 mois de loyer hors charges en location nue (art. 22)
      depotMoisMeuble: 2,      // 2 mois en meublé (art. 25-6)
      restitutionConforme: 1,  // restitution en 1 mois si l'état des lieux de sortie est conforme à l'entrée
      restitutionNonConforme: 2, // 2 mois sinon
      penaliteRetardPct: 10,   // 10 % du loyer mensuel hors charges par mois de retard commencé
      dateGelDpe: '2022-08-24', // révision interdite pour un logement classé F ou G (métropole), bail signé ou renouvelé depuis
      limiteRevisionMois: 12,  // la révision se demande dans l'année qui suit sa date ; au-delà, elle est perdue
      verifieLe: '2026-11-14',
    },

    // Catégories des dépenses payées par le bailleur. « recup » : part récupérable proposée par défaut
    // (1 = tout, 0 = rien, null = à saisir d'après le décompte). Repères, pas une liste légale complète.
    categories: [
      { id: 'copro', nom: 'Charges de copropriété', recup: null, aide: 'La part récupérable sur le locataire figure sur le décompte annuel du syndic.' },
      { id: 'taxeFonciere', nom: 'Taxe foncière', recup: 0, aide: 'Hors taxe d\'enlèvement des ordures ménagères, à saisir à part : elle est récupérable.' },
      { id: 'teom', nom: 'Taxe d\'ordures ménagères', recup: 1, aide: 'Indiquée sur l\'avis de taxe foncière ; récupérable sur le locataire.' },
      { id: 'eau', nom: 'Eau, chauffage collectif', recup: 1, aide: 'Consommations collectives refacturées.' },
      { id: 'assurance', nom: 'Assurance du bailleur', recup: 0, aide: 'Assurance propriétaire non occupant, garantie des loyers impayés.' },
      { id: 'travaux', nom: 'Entretien et réparations', recup: 0, aide: 'Menues réparations à la charge du locataire : à ne pas compter ici.' },
      { id: 'interets', nom: 'Intérêts d\'emprunt', recup: 0, aide: 'Montant annuel figurant sur le tableau d\'amortissement.' },
      { id: 'assuranceEmprunt', nom: 'Assurance d\'emprunt', recup: 0, aide: '' },
      { id: 'gestion', nom: 'Frais de gestion', recup: 0, aide: 'Agence, frais bancaires, comptabilité.' },
      { id: 'autre', nom: 'Autre dépense', recup: 0, aide: '' },
    ],

    modesPaiement: [['virement', 'Virement'], ['prelevement', 'Prélèvement'], ['cheque', 'Chèque'], ['especes', 'Espèces'], ['autre', 'Autre']],

    // Modèles de relance par palier (à copier, rien n'est envoyé). Variables : {locataire}, {adresse},
    // {montant}, {mois}, {depuis}, {bailleur}, {date}, {detail}. MODÈLES À VÉRIFIER, pas des documents juridiques certifiés.
    relances: [
      { titre: 'Rappel amical', objet: 'Loyer de {mois}', texte: 'Bonjour {locataire},\n\nSauf erreur de ma part, je n\'ai pas encore reçu le règlement du loyer de {mois} pour le logement situé {adresse}. Il reste {montant} à régler.\n\n{detail}\n\nS\'il s\'agit d\'un oubli, merci de faire le nécessaire dans les prochains jours. Si le paiement est déjà parti, ne tenez pas compte de ce message. En cas de difficulté, parlons-en : une solution est toujours plus simple à trouver tôt.\n\nBien cordialement,\n{bailleur}' },
      { titre: 'Relance', objet: 'Relance : loyers impayés', texte: 'Bonjour {locataire},\n\nMalgré mon précédent message, les sommes suivantes restent impayées pour le logement situé {adresse} :\n\n{detail}\n\nTotal dû au {date} : {montant}, avec un retard depuis le {depuis}.\n\nJe vous remercie de régulariser la situation sous huit jours, ou de me proposer un échéancier de paiement par écrit.\n\nBien cordialement,\n{bailleur}' },
      { titre: 'Mise en demeure', objet: 'Mise en demeure de payer', texte: 'Madame, Monsieur {locataire},\n\nLogement situé {adresse}.\n\nÀ ce jour ({date}), les loyers et charges suivants restent impayés malgré mes relances :\n\n{detail}\n\nTotal dû : {montant}, en retard depuis le {depuis}.\n\nPar la présente, je vous mets en demeure de régler cette somme sous quinze jours à compter de la réception de ce courrier. À défaut, je me verrai contraint d\'engager les démarches prévues par le bail et par la loi pour obtenir le paiement, en commençant par informer la caution le cas échéant.\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n{bailleur}', note: 'Courrier à envoyer toi-même en recommandé avec accusé de réception. La suite (caution, commissaire de justice, commandement de payer, clause résolutoire) dépend de ton bail et de la loi : renseigne-toi auprès d\'un professionnel ou de l\'ADIL de ton département avant d\'aller plus loin.' },
    ],

    conseils: [
      ['Un bail, un compte', 'Chaque mois, le loyer et les provisions dus s\'ajoutent ; chaque paiement les solde dans l\'ordre. Les retards se voient tout seuls.'],
      ['L\'indice, c\'est toi qui le saisis', 'L\'IRL est publié chaque trimestre par l\'Insee. Recopie la valeur du trimestre de ton bail : l\'outil calcule le nouveau loyer.'],
      ['Les charges réelles', 'Saisis tes dépenses et leur part récupérable : la régularisation annuelle compare les provisions au réel.'],
      ['Le minimum sur tes locataires', 'Un nom et, si tu veux, un contact. Aucune pièce justificative n\'est stockée ici.'],
    ],

    // Repères (droit français, loi du 6 juillet 1989). Outil d'aide : le bail et la loi font foi.
    reperes: [
      ['Quittance', 'Le bailleur remet gratuitement une quittance au locataire qui la demande, en distinguant le loyer et les charges ; aucun frais ne peut être facturé pour l\'avis d\'échéance ou la quittance. En cas de paiement partiel, il remet un reçu. Envoi par voie électronique possible avec l\'accord exprès du locataire (art. 21).'],
      ['Révision du loyer', 'Une fois par an, si le bail prévoit une clause de révision : loyer × IRL du trimestre de référence de l\'année ÷ IRL du même trimestre de l\'année précédente. Trimestre de référence : celui du bail, à défaut le dernier publié à la signature. La révision n\'est pas automatique ; elle se demande dans l\'année qui suit sa date, prend effet à la date de la demande, sans rétroactivité ; au-delà d\'un an, elle est perdue pour cette année (art. 17-1).'],
      ['Logement classé F ou G', 'En métropole, la révision est interdite pour un logement classé F ou G au diagnostic de performance énergétique si le bail a été signé, renouvelé ou tacitement reconduit depuis le 24 août 2022 (1er juillet 2024 en outre-mer).'],
      ['Dépôt de garantie', 'Au plus un mois de loyer hors charges en location nue, deux mois en meublé (si le loyer est payé d\'avance au mois ou au bimestre). Restitué dans le mois de la remise des clés si l\'état des lieux de sortie est conforme, deux mois sinon ; au-delà, 10 % du loyer mensuel hors charges par mois de retard commencé (art. 22 et 25-6).'],
      ['Charges', 'Location nue : provisions mensuelles et régularisation annuelle sur le réel ; décompte par nature de charges un mois avant, justificatifs tenus à disposition six mois. En meublé, le bail peut prévoir un forfait, qui ne se régularise pas. Régularisation tardive : le locataire peut demander un paiement en douze mois (art. 23 et 25-10).'],
      ['Encadrement des loyers', 'Dans certaines communes, le loyer est plafonné par un loyer de référence fixé par arrêté préfectoral. L\'outil ne le calcule pas : vérifie auprès de ta commune ou de l\'ADIL.'],
    ],
    sources: [
      ['Révision du loyer (service-public.gouv.fr, fiche F1311, vérifiée le 08/08/2025 par l\'éditeur, consultée le 14/11/2026)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1311'],
      ['Dépôt de garantie (service-public.gouv.fr, fiche F31269, consultée le 14/11/2026)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F31269'],
      ['Charges locatives (service-public.gouv.fr, fiche F947, consultée le 14/11/2026)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F947'],
      ['Loi n° 89-462 du 6 juillet 1989, art. 21 (quittance gratuite, reçu en cas de paiement partiel)', 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000028806698/'],
      ['Indice de référence des loyers : publication trimestrielle de l\'Insee (à recopier dans l\'outil)', 'insee.fr, rubrique « Indice de référence des loyers »'],
    ],
    sourceRegles: 'Règles relevées le 14/11/2026 sur service-public.gouv.fr (fiches F1311, F31269, F947) et Légifrance (loi du 6 juillet 1989, art. 21). Elles peuvent changer : vérifie-les avant de t\'en servir.',

    // Mentions fiscales : aucun calcul d'impôt.
    fiscal: 'Récapitulatif pour t\'aider à préparer ta déclaration, pas un calcul d\'impôt ni un conseil fiscal ou juridique. Le régime (micro-foncier ou réel pour la location nue, micro-BIC ou réel pour la location meublée, statut de loueur en meublé) et ce qui est déductible se vérifient sur impots.gouv.fr ou auprès d\'un professionnel.',
  };
})();
