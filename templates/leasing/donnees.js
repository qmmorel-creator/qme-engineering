// Base intégrée du simulateur leasing ou achat : valeurs proposées par défaut, libellés des scénarios,
// questions à poser au vendeur, conseils et repères. Contenu original rédigé pour QME, sans aucune
// donnée de marché : aucun prix, taux ou cote de véhicule n'est intégré. Les valeurs par défaut
// (décote, entretien…) sont des HYPOTHÈSES à remplacer par les tiennes, signalées comme telles.
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Hypothèses proposées à la création d'une comparaison (toutes modifiables).
    defauts: {
      duree: 48,          // mois : durée de détention = durée des contrats LOA et LLD
      kmAn: 15000,        // kilomètres réellement parcourus par an
      decote1: 20,        // % de valeur perdue la première année (hypothèse, pas une cote)
      decote2: 12,        // % par an ensuite
      entretienAn: 50000, // centimes : entretien courant par an (révisions, pneus), hors énergie
      assuranceMois: 6000, // centimes : assurance du véhicule par mois
      placement: null,    // % par an : rendement d'un placement de l'apport (désactivé par défaut)
      kmNormal: 15000,    // km par an supposés « normaux » dans la décote
      perteKm: 5,         // centimes de valeur perdus par km au-delà (gagnés en deçà) : hypothèse
    },

    types: {
      comptant: { nom: 'Achat comptant', court: 'Comptant', phrase: 'Tu paies tout le jour de l\'achat, tu revends à la fin.' },
      credit: { nom: 'Crédit auto', court: 'Crédit', phrase: 'Apport, puis mensualités d\'un crédit amortissable ; la voiture est à toi.' },
      loa: { nom: 'LOA', court: 'LOA', phrase: 'Location avec option d\'achat : premier loyer, loyers, puis tu rachètes ou tu rends.' },
      lld: { nom: 'LLD', court: 'LLD', phrase: 'Location longue durée : premier loyer, loyers, forfait kilométrique, tu rends la voiture.' },
    },

    // Questions à poser avant de signer, par type d'offre. « commun » vaut pour toutes les offres.
    questions: {
      commun: [
        ['prix-remise', 'Quel est le prix exact du véhicule, remises et options comprises ?', 'Toutes les offres doivent partir du même prix pour être comparables.'],
        ['frais-annexes', 'Quels frais s\'ajoutent : dossier, mise à la route, carte grise, livraison ?', 'Ils changent le coût total et ne figurent pas toujours dans le loyer ou le taux.'],
        ['assurance', 'L\'assurance est-elle obligatoire chez un assureur imposé, et à quel prix ?', 'Compare avec ta propre assurance avant d\'accepter un forfait.'],
        ['garantie', 'Quelle garantie constructeur ou vendeur, combien de temps, et que couvre-t-elle ?', 'Une panne hors garantie pèse lourd sur une voiture achetée.'],
      ],
      credit: [
        ['taeg', 'Quel est le TAEG, et que comprend-il (frais de dossier, assurance emprunteur) ?', 'Le TAEG est le seul taux qui permet de comparer deux crédits ; il doit figurer dans l\'offre.'],
        ['assurance-emprunteur', 'L\'assurance emprunteur est-elle obligatoire ? Son coût mensuel ?', 'Si elle est facultative, elle n\'est pas dans le TAEG : ajoute-la à l\'assurance de l\'offre.'],
        ['remboursement-anticipe', 'Peut-on rembourser par anticipation, et avec quelles indemnités ?', 'Si tu revends avant la fin du crédit, le capital restant dû se rembourse à la revente.'],
        ['offre-ecrite', 'Puis-je avoir l\'offre de crédit écrite, avec le tableau d\'amortissement ?', 'Elle fait foi : vérifie la mensualité et le coût total du crédit.'],
      ],
      loa: [
        ['loa-cout-total', 'Quel est le coût total si je lève l\'option, et si je ne la lève pas ?', 'Le contrat doit indiquer les deux montants : reporte-les ici pour vérifier.'],
        ['loa-option', 'Quel est le montant de l\'option d\'achat, et à quelle date peut-on la lever ?', 'Compare-le à la valeur de revente estimée : c\'est ce qui décide de lever ou non.'],
        ['loa-km', 'Quel forfait kilométrique, et combien coûte chaque kilomètre en plus ?', 'Un dépassement se paie à la restitution, souvent cher.'],
        ['loa-restitution', 'Comment se passe la restitution : état des lieux, barème des frais de remise en état ?', 'Rayures, pneus usés, entretien manquant se facturent : demande le barème écrit.'],
        ['loa-entretien', 'L\'entretien est-il inclus dans le loyer, et dans quel réseau ?', 'S\'il ne l\'est pas, il s\'ajoute au coût mensuel.'],
      ],
      lld: [
        ['lld-km', 'Quel forfait kilométrique, et combien coûte chaque kilomètre en plus ?', 'C\'est le poste qui fait le plus varier le coût d\'une LLD.'],
        ['lld-ajustement', 'Le forfait peut-il être ajusté en cours de contrat, et à quel prix ?', 'Si ton usage change, un ajustement coûte souvent moins qu\'un dépassement.'],
        ['lld-inclus', 'Que comprend le loyer : entretien, pneus, assistance, véhicule de remplacement ?', 'Coche « entretien inclus » seulement si c\'est écrit au contrat.'],
        ['lld-restitution', 'Quel barème de frais de remise en état à la restitution ?', 'Estime ces frais dans l\'offre plutôt que de les découvrir à la fin.'],
        ['lld-resiliation', 'Que coûte une résiliation anticipée (déménagement, changement de situation) ?', 'Les indemnités de sortie anticipée peuvent représenter plusieurs loyers.'],
      ],
    },

    conseils: [
      ['Même voiture, même durée', 'Compare des offres pour le même véhicule et la même période : la LOA et la LLD sont comptées sur la durée de détention.'],
      ['Ton vrai kilométrage', 'Pars de tes kilomètres réels de l\'an passé (contrôle technique, entretien) : c\'est lui qui fait basculer une location.'],
      ['La revente est une hypothèse', 'La valeur à la fin dépend de l\'état, du kilométrage et du marché : teste une décote prudente.'],
      ['L\'offre écrite fait foi', 'Reporte les montants de l\'offre ou du contrat, pas ceux d\'une publicité.'],
    ],

    reperes: [
      ['Comptant', 'Aucun intérêt à payer, mais l\'argent immobilisé ne rapporte plus rien : active le coût d\'opportunité pour en tenir compte. La voiture t\'appartient et se revend à la fin.'],
      ['Crédit amortissable', 'Mensualité constante calculée par la formule d\'annuité sur le capital emprunté (prix moins apport), au taux et sur la durée saisis. Si le crédit dure plus longtemps que la détention, le capital restant dû est remboursé à la revente.'],
      ['LOA', 'Premier loyer, loyers mensuels, puis au choix : lever l\'option d\'achat (la voiture devient à toi, elle garde une valeur) ou restituer le véhicule (dépassement kilométrique et frais de remise en état éventuels).'],
      ['LLD', 'Tu ne deviens jamais propriétaire : premier loyer, loyers, puis restitution. Le forfait kilométrique et l\'entretien éventuellement inclus font la différence.'],
      ['Indépendants', 'Déductibilité des loyers, amortissement, TVA récupérable et avantage en nature ne sont pas calculés ici : ils dépendent de ton statut et des plafonds en vigueur. Demande à ton expert-comptable.'],
    ],

    // Ce qui n'est pas compté (identique entre scénarios, ou hors du champ du simulateur).
    horsCalcul: 'Non comptés : énergie (carburant, électricité), péage et stationnement, carte grise et malus si tu ne les saisis pas en frais de dossier, indemnités de remboursement anticipé, fiscalité des indépendants.',
  };
})();
