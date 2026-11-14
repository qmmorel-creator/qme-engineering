// Base intégrée de la gestion locative : types de bail, catégories de dépenses, modèles de textes, repères.
// Contenu original rédigé pour QME. AUCUN indice IRL n'est intégré : l'Insee en publie un chaque trimestre,
// l'utilisateur saisit les valeurs dont il a besoin (onglet Révisions). Repères relevés le 14/11/2026 sur
// service-public.gouv.fr (date de vérification de chaque page indiquée) : à revérifier chaque année.
(() => {
  window.BASE = {
    version: '2026-11-14',
    verifieLe: '2026-11-14',

    reglages: {
      bailleurNom: '',
      bailleurAdresse: '',
      zoneIrl: 'metropole',        // metropole, corse, dom : l'Insee publie une valeur par zone
      relances: [5, 15, 30],       // paliers de relance, en jours de retard après l'échéance
      prorata: true,               // premier et dernier mois au prorata des jours
      alerteFinBail: 90,           // jours avant une fin de bail prévue
    },

    zones: [['metropole', 'Métropole'], ['corse', 'Corse'], ['dom', 'Outre-mer (DOM)']],

    // Types de bail. depotMax en mois de loyer hors charges (null = interdit).
    typesBail: {
      vide: { nom: 'Location vide', depotMax: 1, revision: true, charges: 'provision' },
      meuble: { nom: 'Location meublée', depotMax: 2, revision: true, charges: 'provision' },
      mobilite: { nom: 'Bail mobilité', depotMax: null, revision: false, charges: 'forfait' },
    },

    typesBien: ['Appartement', 'Maison', 'Studio', 'Chambre', 'Parking ou box', 'Autre'],

    // Catégories de dépenses du propriétaire ; « recuperable » est une proposition, modifiable à chaque dépense.
    categories: [
      { id: 'taxe-fonciere', nom: 'Taxe foncière', recuperable: false },
      { id: 'teom', nom: 'Taxe d\'enlèvement des ordures ménagères', recuperable: true },
      { id: 'assurance', nom: 'Assurance propriétaire non occupant', recuperable: false },
      { id: 'copro-recup', nom: 'Charges de copropriété récupérables', recuperable: true },
      { id: 'copro', nom: 'Charges de copropriété non récupérables', recuperable: false },
      { id: 'eau', nom: 'Eau', recuperable: true },
      { id: 'chauffage', nom: 'Chauffage collectif', recuperable: true },
      { id: 'parties-communes', nom: 'Entretien des parties communes', recuperable: true },
      { id: 'travaux', nom: 'Travaux et réparations', recuperable: false },
      { id: 'entretien', nom: 'Entretien courant (chaudière, etc.)', recuperable: false },
      { id: 'gestion', nom: 'Frais de gestion', recuperable: false },
      { id: 'interets', nom: 'Intérêts d\'emprunt', recuperable: false },
      { id: 'banque', nom: 'Frais bancaires', recuperable: false },
      { id: 'autre', nom: 'Autre', recuperable: false },
    ],

    conseils: [
      ['Une échéance par mois', 'Chaque bail crée ses échéances (loyer + charges) au jour prévu. Note chaque paiement : les retards et les relances se calculent.'],
      ['La quittance en un geste', 'Quand une échéance est payée, la quittance est prête : à imprimer ou à copier. Paiement partiel : un reçu.'],
      ['La révision au bon moment', 'Saisis les indices IRL publiés par l\'Insee : le nouveau loyer et la date limite de la demande se calculent.'],
      ['Ce que rapporte chaque bien', 'Note tes dépenses (taxe foncière, assurance, travaux) : rendement brut et net, et régularisation des charges.'],
    ],

    // Modèles de textes. Variables entre accolades, remplacées par l'application. Rien n'est envoyé : à copier.
    modeles: {
      rappel: {
        nom: 'Rappel amiable',
        texte: 'Bonjour {locataire},\n\nSauf erreur de ma part, le loyer de {mois} ({du}), dû le {echeance}, ne m\'est pas encore parvenu en totalité : il reste {reste} à régler.\n\nIl s\'agit peut-être d\'un oubli. Pouvez-vous faire le nécessaire, ou me prévenir si vous rencontrez une difficulté ?\n\nMerci,\n{bailleur}',
      },
      relance: {
        nom: 'Relance',
        texte: 'Bonjour {locataire},\n\nJe reviens vers vous au sujet du loyer de {mois} du logement {bien} : il reste {reste} à régler depuis le {echeance}, soit {jours} jours de retard.\n\nMerci de régulariser la situation sous 8 jours. Si vous rencontrez des difficultés de paiement, parlons-en rapidement pour trouver une solution.\n\nCordialement,\n{bailleur}',
      },
      miseEnDemeure: {
        nom: 'Mise en demeure',
        texte: '{bailleur}\n{bailleurAdresse}\n\n{locataire}\n{bienAdresse}\n\nLe {aujourdhui}\n\nObjet : mise en demeure de payer\n\nMadame, Monsieur,\n\nMalgré mes précédentes relances, vous restez redevable de la somme de {resteTotal} au titre des loyers et charges du logement situé {bienAdresse} :\n{detailImpayes}\n\nJe vous mets en demeure de régler cette somme dans un délai de 8 jours à compter de la réception de ce courrier.\n\nÀ défaut, je me verrai contraint d\'engager les démarches prévues par le bail et par la loi pour recouvrer ces sommes.\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n{bailleur}',
      },
      revision: {
        nom: 'Demande de révision du loyer',
        texte: '{bailleur}\n{bailleurAdresse}\n\n{locataire}\n{bienAdresse}\n\nLe {aujourdhui}\n\nObjet : révision annuelle du loyer\n\nMadame, Monsieur,\n\nConformément à la clause de révision de votre bail, le loyer hors charges du logement situé {bienAdresse} est révisé à la date du {dateRevision}, en fonction de l\'indice de référence des loyers (IRL) publié par l\'Insee :\n\n- loyer actuel hors charges : {ancienLoyer}\n- IRL du {trimestreNouveau} : {irlNouveau}\n- IRL du {trimestreAncien} : {irlAncien}\n- nouveau loyer : {ancienLoyer} × {irlNouveau} / {irlAncien} = {nouveauLoyer}\n\nLe nouveau loyer s\'applique à partir du {dateEffet}. Les charges restent inchangées ({charges} par mois).\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n{bailleur}',
      },
      regularisation: {
        nom: 'Décompte de régularisation des charges',
        texte: 'Bonjour {locataire},\n\nVoici le décompte de régularisation des charges de l\'année {annee} pour le logement {bien} (du {debut} au {fin}) :\n\n{detailCharges}\n\nCharges récupérables réelles (au prorata de votre occupation, {prorata}) : {reel}\nProvisions versées : {provisions}\n\n{conclusion}\n\nLes justificatifs sont à votre disposition sur simple demande.\n\nCordialement,\n{bailleur}',
      },
      depot: {
        nom: 'Restitution du dépôt de garantie',
        texte: 'Bonjour {locataire},\n\nSuite à la remise des clés du logement {bien} le {remiseCles}, voici le décompte de votre dépôt de garantie :\n\n- dépôt versé : {depot}\n{detailRetenues}\n- montant restitué : {restitue}\n\n{justificatifs}\n\nCordialement,\n{bailleur}',
      },
    },

    // Repères légaux (droit français, logement loué comme résidence principale). Outil d'aide : le bail et
    // les textes font foi ; l'ADIL de ton département renseigne gratuitement.
    reperes: [
      ['Révision annuelle', 'Le loyer ne peut être révisé qu\'une fois par an et seulement si le bail le prévoit. Nouveau loyer = loyer actuel × IRL du trimestre de référence ÷ IRL du même trimestre de l\'année précédente, arrondi au centime (service-public.gouv.fr, F1311, vérifiée le 08/08/2025).'],
      ['Un an pour demander', 'La révision n\'est pas automatique : elle doit être demandée au locataire dans l\'année qui suit la date de révision, et ne s\'applique qu\'à partir de la demande, sans effet rétroactif. Passé un an, la révision de l\'année est perdue (F1311).'],
      ['Révision interdite', 'Révision interdite en bail mobilité, et en métropole pour un logement classé F ou G au DPE dont le bail a été signé, renouvelé ou reconduit depuis le 24/08/2022 (01/07/2024 dans les DOM) (F1311).'],
      ['IRL', 'L\'indice de référence des loyers est publié chaque trimestre par l\'Insee, avec une valeur pour la métropole, la Corse et les DOM (service-public.gouv.fr, F13723, vérifiée le 15/10/2026). L\'outil n\'intègre aucune valeur : saisis celles publiées.'],
      ['Quittance', 'Le bailleur remet gratuitement une quittance au locataire qui la demande ; elle détaille le loyer et les charges. Paiement partiel : un reçu. Envoi par e-mail seulement avec l\'accord du locataire (service-public.gouv.fr, F35247, vérifiée le 25/08/2025).'],
      ['Dépôt de garantie', 'Au plus 1 mois de loyer hors charges en location vide, 2 mois en meublé, interdit en bail mobilité. Restitution dans le mois qui suit la remise des clés si l\'état des lieux de sortie est conforme à celui d\'entrée, dans les 2 mois sinon ; en retard, 10 % du loyer mensuel hors charges par mois de retard commencé, après mise en demeure du locataire (service-public.gouv.fr, F31269, vérifiée le 09/06/2026).'],
      ['Charges', 'Provisions mensuelles régularisées au moins une fois par an sur les dépenses réelles ; décompte par nature de charges un mois avant, justificatifs tenus à disposition 6 mois. Un forfait de charges (meublé, bail mobilité) ne se régularise pas. Liste des charges récupérables : décret n° 87-713 (service-public.gouv.fr, F947, vérifiée le 15/04/2025).'],
      ['Pas de frais de retard', 'Le bailleur ne peut pas facturer d\'amende ni de pénalité en cas de retard de loyer : une telle clause du bail est abusive (service-public.gouv.fr, F2889, vérifiée le 15/07/2026). Les modèles de relance n\'en contiennent pas.'],
    ],
    sources: [
      ['Révision du loyer en cours de bail (F1311, vérifiée le 08/08/2025)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1311'],
      ['Indice de référence des loyers (F13723, vérifiée le 15/10/2026)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F13723'],
      ['Quittance de loyer : comment l\'obtenir ? (F35247, vérifiée le 25/08/2025)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F35247'],
      ['Dépôt de garantie (F31269, vérifiée le 09/06/2026)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F31269'],
      ['Charges locatives (F947, vérifiée le 15/04/2025)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F947'],
      ['Frais de retard de paiement du loyer (F2889, vérifiée le 15/07/2026)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2889'],
      ['Valeurs de l\'IRL publiées par l\'Insee', 'https://www.insee.fr/fr/statistiques/serie/001515333'],
    ],
    sourceIrl: 'Aucun indice intégré : l\'Insee publie l\'IRL chaque trimestre. Saisis les valeurs de ta zone (métropole, Corse ou DOM) dont tes baux ont besoin. Repères relevés le 14/11/2026.',
  };
})();
