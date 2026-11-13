// Base intégrée du template « Remboursement de dettes » : types de dettes, méthodes, glossaire, conseils.
// Contenu original rédigé pour QME. Aucun taux, barème ni seuil réglementaire figé : l'utilisateur saisit
// les chiffres de ses propres contrats. Les dispositifs d'aide cités (points conseil budget, commission de
// surendettement) ont été vérifiés le 13/11/2026 sur les sites publics (solidarites.gouv.fr,
// banque-france.fr) : à revérifier chaque année.
(() => {
  window.BASE = {
    version: '2026-11-13',

    // Types de dettes : libellé, aide à la saisie (où trouver les chiffres) et points d'attention.
    // « tauxZero » : le type est souvent sans intérêts (le champ taux est prérempli à 0, modifiable).
    types: [
      { id: 'conso', nom: 'Crédit à la consommation', court: 'Crédit conso', forme: 'carre',
        ou: 'Tableau d\'amortissement remis à la signature, ou espace client du prêteur (« capital restant dû »).',
        attention: 'Le taux à saisir est le taux débiteur (ou nominal), pas le TAEG qui inclut frais et assurance. Un remboursement anticipé peut entraîner des indemnités : vérifie ton contrat.' },
      { id: 'renouvelable', nom: 'Crédit renouvelable', court: 'Renouvelable', forme: 'rond',
        ou: 'Relevé mensuel du compte renouvelable : montant utilisé, taux débiteur et échéance du mois.',
        attention: 'L\'échéance minimale suit souvent le montant utilisé : saisis celle de ton dernier relevé et mets-la à jour. Toute nouvelle utilisation de la réserve repousse la date de fin.' },
      { id: 'auto', nom: 'Prêt auto ou moto', court: 'Prêt auto', forme: 'carre',
        ou: 'Tableau d\'amortissement ou espace client du prêteur.',
        attention: 'Une location avec option d\'achat (LOA) n\'est pas un prêt : ses loyers ne réduisent pas un capital. Ne la saisis pas ici, ou seulement le rachat prévu.' },
      { id: 'travaux', nom: 'Prêt travaux ou équipement', court: 'Prêt travaux', forme: 'carre',
        ou: 'Offre de prêt et tableau d\'amortissement.',
        attention: 'Certains prêts travaux ont un différé : tant qu\'il court, la mensualité peut ne couvrir que les intérêts.' },
      { id: 'etudiant', nom: 'Prêt étudiant', court: 'Prêt étudiant', forme: 'triangle',
        ou: 'Offre de prêt, tableau d\'amortissement, espace client.',
        attention: 'Pendant un différé, rien ou seulement les intérêts sont remboursés : saisis la mensualité qui s\'appliquera après le différé, et le mois de départ du plan en conséquence.' },
      { id: 'familial', nom: 'Prêt d\'un proche', court: 'Prêt familial', forme: 'rond', tauxZero: true,
        ou: 'Reconnaissance de dette ou accord écrit, s\'il y en a un.',
        attention: 'Souvent sans intérêts : laisse le taux à 0. Fixe ensemble une mensualité réaliste et écris-la.' },
      { id: 'decouvert', nom: 'Découvert bancaire', court: 'Découvert', forme: 'quart',
        ou: 'Relevé de compte : solde débiteur, taux débiteur du découvert (conditions tarifaires de ta banque).',
        attention: 'Un découvert n\'a pas de mensualité : choisis le montant que tu remets chaque mois pour le combler. Les agios dépendent du nombre de jours à découvert ; le calcul mensuel n\'en donne qu\'un ordre d\'idée.' },
      { id: 'carte', nom: 'Carte de crédit ou paiement fractionné', court: 'Carte / fractionné', forme: 'quart',
        ou: 'Relevé de la carte ou échéancier du paiement en plusieurs fois.',
        attention: 'Un paiement en plusieurs fois a un nombre d\'échéances fixe : saisis le reste dû et l\'échéance. Des frais peuvent s\'ajouter en cas de retard.' },
      { id: 'retard', nom: 'Retard de loyer, de facture ou de charges', court: 'Retard', forme: 'triangle', tauxZero: true,
        ou: 'Courrier ou échéancier convenu avec le créancier (bailleur, fournisseur).',
        attention: 'À traiter en priorité : un retard de loyer ou d\'énergie a des conséquences plus lourdes qu\'un crédit. Un échéancier écrit avec le créancier vaut mieux qu\'un accord oral.' },
      { id: 'impots', nom: 'Impôts ou amende en plan de paiement', court: 'Impôts', forme: 'carre', tauxZero: true,
        ou: 'Plan de règlement accordé par l\'administration (espace en ligne ou courrier).',
        attention: 'Des majorations peuvent s\'appliquer : vérifie le courrier reçu. Respecter le plan accordé est prioritaire.' },
      { id: 'autre', nom: 'Autre dette', court: 'Autre', forme: 'rond',
        ou: 'Le document qui fixe le montant dû et les échéances.',
        attention: 'Saisis le reste dû, le taux s\'il y a des intérêts (sinon 0) et ce que tu rembourses chaque mois.' },
    ],

    // Méthodes de remboursement : couleur fixe de chaque série (palette validée par le validateur dataviz,
    // contraste ≥ 3:1 sur blanc, séparation daltonisme ΔE ≥ 9 entre toutes les paires).
    methodes: [
      { id: 'boule', nom: 'Boule de neige', couleur: '#2A63B0',
        regle: 'Plus petit solde d\'abord.',
        detail: 'Tout l\'argent disponible au-delà des minimums va sur la dette au plus petit solde. Une fois soldée, sa mensualité s\'ajoute à la suivante : la « boule » grossit. Avantage : des dettes soldées vite, ce qui motive.' },
      { id: 'avalanche', nom: 'Avalanche', couleur: '#C0502F',
        regle: 'Taux le plus élevé d\'abord.',
        detail: 'Le surplus va sur la dette au taux le plus élevé. C\'est la méthode qui coûte le moins d\'intérêts au total ; la première dette soldée peut arriver plus tard.' },
      { id: 'perso', nom: 'Ordre personnalisé', couleur: '#1E8A6E',
        regle: 'L\'ordre que tu choisis.',
        detail: 'Le surplus suit l\'ordre que tu fixes dans l\'onglet Dettes : utile pour passer d\'abord un retard de loyer, un prêt familial ou une dette qui t\'inquiète.' },
    ],
    // Repère de comparaison : payer seulement les minimums, sans reporter les mensualités libérées.
    minimums: { id: 'minimums', nom: 'Minimums seuls', couleur: '#8C857A',
      detail: 'Chaque dette reçoit sa mensualité minimale et rien de plus ; quand une dette est soldée, sa mensualité n\'est pas reportée.' },

    // Mode de calcul affiché dans l'application.
    calcul: [
      'Chaque mois, les intérêts de chaque dette valent : capital restant × taux annuel ÷ 12, arrondis au centime (calcul mensuel simple).',
      'Puis le paiement du mois est déduit : d\'abord la mensualité minimale de chaque dette, puis le reste du budget sur la dette prioritaire selon la méthode.',
      'Quand une dette est soldée, ce qu\'elle coûtait chaque mois reste dans le budget et passe à la dette suivante (report de la mensualité libérée).',
      'Un versement exceptionnel s\'ajoute au budget du mois choisi, sur la dette indiquée ou sur la dette prioritaire.',
      'Limites : les prêteurs calculent souvent les intérêts au jour près et ajoutent assurance et frais. Le résultat est une estimation, proche mais pas identique à ton tableau d\'amortissement.',
    ],

    glossaire: [
      ['Capital restant dû', 'Ce qu\'il reste à rembourser sur le prêt, hors intérêts futurs. C\'est le montant à saisir.'],
      ['Taux débiteur (ou nominal)', 'Le taux annuel qui sert à calculer les intérêts. C\'est celui à saisir.'],
      ['TAEG', 'Taux annuel effectif global : taux débiteur plus frais, assurance obligatoire et commissions. Sert à comparer des offres, pas à calculer les intérêts du mois.'],
      ['Mensualité minimale', 'Ce que tu dois payer chaque mois d\'après ton contrat ou ton accord.'],
      ['Intérêts du mois', 'Le prix de l\'argent emprunté pour un mois : ici capital restant × taux ÷ 12.'],
      ['Remboursement anticipé', 'Rembourser plus que prévu. Il réduit le capital, donc les intérêts suivants ; le contrat peut prévoir des indemnités.'],
      ['Boule de neige', 'Méthode : le surplus va sur le plus petit solde, puis la mensualité libérée passe à la dette suivante.'],
      ['Avalanche', 'Méthode : le surplus va sur le taux le plus élevé. Le moins d\'intérêts au total.'],
    ],

    conseils: [
      ['Commence par la liste complète', 'Toutes les dettes, même petites ou sans intérêts : un plan ne tient que si rien n\'est oublié.'],
      ['Saisis le taux débiteur', 'Pas le TAEG : il figure sur le contrat, le tableau d\'amortissement ou le relevé.'],
      ['Garde un coussin', 'Un petit fonds pour les imprévus évite de recréer une dette au premier pépin.'],
      ['Ne ré-emprunte pas sur une dette soldée', 'Une réserve de crédit renouvelable remboursée reste utilisable : la fermer évite la tentation.'],
      ['Priorise les dettes lourdes de conséquences', 'Loyer, énergie, impôts : leurs retards coûtent plus qu\'un taux. L\'ordre personnalisé sert à ça.'],
      ['Pointe chaque mois', 'Le pointage montre l\'écart au plan avant qu\'il ne grossisse.'],
      ['Recale le plan quand la vie change', 'Hausse ou baisse de revenus, prime, imprévu : recale depuis tes soldes réels.'],
      ['Parle à ton prêteur tôt', 'Un report ou un réaménagement se discute mieux avant un impayé qu\'après.'],
    ],

    avertissement: 'Outil d\'aide au calcul : il ne remplace pas un conseil professionnel. Les montants réels dépendent de tes contrats (date de prélèvement, assurance, frais, calcul des intérêts au jour près). En cas de difficulté, tu peux t\'adresser gratuitement à un point conseil budget, ou à la commission de surendettement de ton département (secrétariat assuré par la Banque de France).',
    sources: 'Dispositifs vérifiés le 13/11/2026 : points conseil budget (labellisés par l\'État, ministère chargé des solidarités) et commissions de surendettement (Banque de France). À vérifier : leurs modalités peuvent changer.',
  };
})();
