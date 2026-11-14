// Base intégrée de « Capacité d'emprunt et comparateur de prêts » : valeurs proposées par défaut,
// repères, questions à poser à la banque. Contenu original rédigé pour QME. Aucun taux de marché :
// taux de crédit, taux d'assurance, frais et garanties sont ceux que l'utilisateur saisit.
// Seules valeurs datées : la norme du HCSF (taux d'effort, durée), sourcée et datée ci-dessous,
// et le plafond des indemnités de remboursement anticipé (Code de la consommation), sourcé et daté.
// Toutes deux sont modifiables dans l'application.
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Norme du Haut Conseil de stabilité financière (HCSF) sur l'octroi des crédits immobiliers.
    hcsf: {
      tauxEffort: 35, // % des revenus nets, assurance emprunteur comprise
      dureeAns: 25,   // durée maximale du crédit
      texte: 'Décision D-HCSF-2021-7 du 29 septembre 2021 du Haut Conseil de stabilité financière, applicable depuis le 1er janvier 2022 : taux d\'effort de 35 % au plus des revenus nets, assurance emprunteur comprise, et durée de 25 ans au plus (jusqu\'à 27 ans dans certains cas de logement neuf ou de gros travaux avec différé). Les banques peuvent y déroger pour une part limitée de leurs dossiers.',
      source: 'economie.gouv.fr, page du Haut Conseil de stabilité financière',
      url: 'https://www.economie.gouv.fr/hcsf',
      verifie: '14/11/2026',
    },

    // Plafond légal des indemnités de remboursement anticipé (IRA) d'un crédit immobilier.
    ira: {
      moisInterets: 6, // semestre d'intérêts sur le capital remboursé, au taux moyen du prêt
      pctCrd: 3,       // % du capital restant dû avant le remboursement
      texte: 'Article R313-25 du Code de la consommation : l\'indemnité ne peut dépasser un semestre d\'intérêts sur le capital remboursé, au taux moyen du prêt, ni 3 % du capital restant dû avant le remboursement. Certains cas en sont exonérés (article L313-48 : vente liée à une mutation professionnelle, décès, cessation forcée d\'activité). Ton offre peut prévoir moins, ou aucune indemnité.',
      source: 'Code de la consommation, articles L313-47, L313-48 et R313-25 (Légifrance)',
      url: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069565/',
      verifie: '14/11/2026',
    },

    // Frais de notaire estimés : HYPOTHÈSE affichée, à remplacer par l'estimation du notaire.
    notaire: {
      ancien: 8, // % du prix
      neuf: 3,
      texte: 'Hypothèse modifiable, haut des ordres de grandeur couramment donnés (environ 7 à 8 % du prix dans l\'ancien, 2 à 3 % dans le neuf, consultés le 14/11/2026). Le montant exact dépend du département, du prix et du type de bien : demande-le au notaire ou utilise le simulateur de notaires.fr.',
    },

    // Valeurs proposées à la création (hypothèses de simulation, modifiables).
    defauts: {
      dureeAns: 25,
      tauxAssurance: null, // aucun taux d'assurance intégré : à saisir
      quotite: 100,
      ponderationLoyers: 70, // % des loyers perçus retenus dans les revenus (pratique à vérifier avec ta banque)
    },

    typesBien: {
      ancien: 'Ancien',
      neuf: 'Neuf (VEFA ou construction)',
      terrain: 'Terrain et construction',
    },

    garanties: {
      caution: 'Caution d\'un organisme',
      hypotheque: 'Hypothèque',
      ppd: 'Privilège de prêteur de deniers',
      aucune: 'Autre ou aucune',
    },

    questions: [
      ['taux', 'Le taux est-il fixe sur toute la durée ? Quel est le TAEG de l\'offre ?', 'Le TAEG figure dans l\'offre de prêt : compare-le à l\'estimation du comparateur.'],
      ['assurance', 'L\'assurance est-elle calculée sur le capital initial ou sur le capital restant dû ?', 'Sur le capital initial, la cotisation ne baisse pas : le coût total est plus élevé à taux égal.'],
      ['delegation', 'Puis-je choisir une autre assurance que celle de la banque (délégation) ?', 'Tu peux comparer une assurance externe à garanties équivalentes ; reporte son taux dans l\'offre.'],
      ['garantie', 'Quelle garantie est demandée, combien coûte-t-elle, et une partie est-elle restituée à la fin ?', 'Une caution peut prévoir une restitution partielle ; elle n\'est pas déduite ici.'],
      ['ira', 'Quelles indemnités en cas de remboursement anticipé ?', 'Certaines offres n\'en prévoient pas, ou moins que le plafond légal.'],
      ['modulation', 'Peut-on moduler ou reporter des mensualités ?', 'Utile si tes revenus varient ; demande les conditions écrites.'],
      ['domiciliation', 'Faut-il domicilier mes revenus, et pour combien de temps ?', 'Une contrepartie à intégrer : frais de compte, cartes, durée imposée.'],
      ['transferable', 'Le prêt est-il transférable sur un autre bien en cas de revente ?', 'Utile si tu prévois de revendre avant la fin du crédit.'],
    ],

    reperes: [
      ['Mensualité', 'Crédit amortissable à mensualités constantes : capital × t / (1 − (1 + t)^−n), t = taux annuel / 12, n = nombre de mois. Les intérêts de chaque mois sont calculés sur le capital restant dû.'],
      ['Taux d\'effort', 'Toutes tes mensualités de crédit (assurance comprise) et les charges que tu choisis de retenir, divisées par tes revenus nets mensuels. Les revenus locatifs sont retenus à la part que tu indiques.'],
      ['Montant empruntable', 'Le capital dont la mensualité, assurance comprise, tient dans la mensualité maximale, au taux, sur la durée et au taux d\'assurance saisis. L\'assurance y est comptée sur le capital initial (estimation prudente).'],
      ['Coût total du crédit', 'Intérêts + assurance emprunteur + frais de dossier + garantie + frais de courtage. Les frais de notaire n\'en font pas partie : ils sont dans le budget du projet.'],
      ['TAEG approché', 'Taux actuariel qui égalise le montant reçu (capital moins frais) et les mensualités payées, assurance comprise. C\'est une estimation : le TAEG de l\'offre de prêt fait foi.'],
      ['Remboursement anticipé', 'Après un versement, soit la mensualité reste la même et la durée raccourcit, soit la durée reste la même et la mensualité baisse. Les indemnités se déduisent de l\'économie.'],
    ],
  };
})();
