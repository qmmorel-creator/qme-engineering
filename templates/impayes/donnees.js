// Base intégrée de la relance des impayés : paliers de relance par défaut avec leurs modèles de messages,
// taux de référence datés, conseils et repères. Contenu original rédigé pour QME.
// Les taux sont des PARAMÈTRES DATÉS (relevés le 13/11/2026) : ils changent chaque semestre et se
// modifient dans les Réglages. Mise à jour obligatoire de ce fichier chaque 1er janvier et 1er juillet.
(() => {
  window.BASE = {
    version: '2026-11-13',

    reglages: {
      delaiPaiement: 30,   // délai par défaut à la saisie d'une facture (jours après émission)
      ecartMin: 7,         // jours au moins entre deux relances
      delaiReponse: 8,     // délai laissé au client dans les messages (« sous 8 jours »)
      majoration: 10,      // points ajoutés au taux BCE (art. L441-10 du Code de commerce, à défaut de clause)
      // Taux de la BCE à son opération principale de refinancement, en vigueur au 1er janvier et au 1er juillet
      // (règle du semestre, art. L441-10, II). Source : Banque de France, « Taux directeurs de la BCE ».
      bce: [
        { debut: '2025-01-01', taux: 3.15 }, // en vigueur depuis le 18/12/2024
        { debut: '2025-07-01', taux: 2.15 }, // en vigueur depuis le 11/06/2025
        { debut: '2026-01-01', taux: 2.15 },
        { debut: '2026-07-01', taux: 2.40 }, // en vigueur depuis le 17/06/2026
      ],
      // Taux de l'intérêt légal « autres cas » (créancier professionnel), par semestre.
      tauxLegal: [
        { debut: '2026-01-01', taux: 2.62 }, // arrêté du 15/12/2025 (à vérifier au JORF)
        { debut: '2026-07-01', taux: 2.75 }, // arrêté du 26/06/2026, JO du 30/06/2026
      ],
      tauxContractuelPro: null,
      tauxContractuelPart: null,
      depuisEcheancePart: false,
      indemnite: 4000,     // 40 € (art. D441-5 du Code de commerce, version du 27/02/2021)
      verifieLe: '2026-11-13',
    },

    // Paliers par défaut : délai en jours après l'échéance. « md » : relance qui vaut mise en demeure
    // (point de départ des intérêts pour un client particulier). Modèles au vouvoiement, champs entre {}.
    paliers: [
      { id: 'rappel', nom: 'Rappel courtois', jours: 3, md: false,
        objet: 'Facture {numero} : rappel d\'échéance',
        corps: 'Bonjour,\n\nSauf erreur de notre part, la facture {numero} du {date_facture}, d\'un montant de {montant}, arrivée à échéance le {echeance}, reste à régler ({restant} restant dû).\n\nIl s\'agit peut-être d\'un simple oubli : pourriez-vous vérifier de votre côté et procéder au règlement ? Si le paiement est déjà parti, merci de ne pas tenir compte de ce message.\n\nJe reste disponible pour toute question.\n\nBien cordialement,\n{signature}' },
      { id: 'ferme', nom: 'Relance ferme', jours: 15, md: false,
        objet: 'Facture {numero} : paiement en retard de {retard}',
        corps: 'Bonjour,\n\nMalgré notre précédent rappel, la facture {numero} du {date_facture} reste impayée : {restant} restant dû, avec un retard de {retard} sur l\'échéance du {echeance}.\n\nMerci de procéder au règlement sous {delai_reponse}, soit avant le {date_limite}, ou de me faire savoir ce qui bloque (bon de commande, adresse de facturation, contestation) afin que nous trouvions une solution.\n\n{ligne_penalites}\n\nBien cordialement,\n{signature}' },
      { id: 'demeure', nom: 'Mise en demeure', jours: 30, md: true,
        objet: 'Mise en demeure de payer : facture {numero}',
        corps: 'Madame, Monsieur,\n\nLa facture {numero} émise le {date_facture}, payable au plus tard le {echeance}, reste impayée malgré nos relances. À ce jour, {restant} reste dû sur un montant de {montant}, soit {retard} de retard.\n\nPar la présente, nous vous mettons en demeure de régler la somme de {restant} sous {delai_reponse}, soit avant le {date_limite}.\n\n{ligne_penalites}\n\nÀ défaut de règlement dans ce délai, nous nous réservons le droit d\'engager une procédure de recouvrement, sans nouvel avis.\n\nVeuillez agréer, Madame, Monsieur, nos salutations distinguées.\n\n{signature}\n\n(Le {date_jour}. Message à envoyer de préférence par lettre recommandée avec accusé de réception.)' },
      { id: 'dernier', nom: 'Dernier avis', jours: 45, md: false,
        objet: 'Dernier avis avant procédure : facture {numero}',
        corps: 'Madame, Monsieur,\n\nNotre mise en demeure concernant la facture {numero} du {date_facture} est restée sans effet. Le montant dû s\'élève à {total_du}, soit {restant} au titre de la facture, majoré des pénalités et frais prévus.\n\nSans règlement de votre part avant le {date_limite}, le dossier sera transmis pour recouvrement (injonction de payer ou recours à un tiers), ce qui entraînera des frais supplémentaires.\n\nUn échéancier reste possible si vous me contactez avant cette date.\n\n{signature}' },
    ],

    // Aide affichée sous l'éditeur de modèles.
    champs: [
      ['client', 'Nom du client'], ['numero', 'Numéro de la facture'], ['date_facture', 'Date d\'émission'],
      ['echeance', 'Date d\'échéance'], ['montant', 'Montant TTC'], ['deja_paye', 'Déjà payé'],
      ['restant', 'Restant dû'], ['retard', 'Retard en jours'], ['taux', 'Taux annuel appliqué'],
      ['penalites', 'Pénalités ou intérêts à ce jour'], ['indemnite', 'Indemnité forfaitaire (professionnel)'],
      ['total_du', 'Restant + pénalités + indemnité'], ['ligne_penalites', 'Phrase sur les pénalités, adaptée au type de client'],
      ['delai_reponse', 'Délai laissé (Réglages)'], ['date_limite', 'Aujourd\'hui + délai'], ['date_jour', 'Date du jour'],
      ['entreprise', 'Ton entreprise'], ['signature', 'Ta signature'],
    ],

    canaux: ['E-mail', 'Courrier', 'Recommandé avec AR', 'Téléphone', 'Message', 'En personne'],

    conseils: [
      ['Une échéance claire', 'Date d\'échéance, taux des pénalités et indemnité de 40 € sur chaque facture entre professionnels : ce sont des mentions obligatoires.'],
      ['Relancer tôt', 'Un rappel courtois quelques jours après l\'échéance règle la plupart des oublis, sans abîmer la relation.'],
      ['Noter chaque relance', 'Date, palier et canal : le journal prouve tes démarches et fixe le départ des intérêts d\'un particulier.'],
      ['Écrire avant de poursuivre', 'La mise en demeure écrite, de préférence en recommandé, précède toute procédure de recouvrement.'],
    ],

    // Repères juridiques (droit français). Outil d'aide : les textes et ton contrat font foi.
    reperes: [
      ['Entre professionnels', 'Les pénalités de retard sont dues dès le lendemain de l\'échéance, sans rappel. À défaut de clause, taux de la BCE (opération principale de refinancement) majoré de 10 points ; une clause ne peut pas descendre sous 3 fois le taux de l\'intérêt légal. Le taux BCE retenu est celui du 1er janvier pour le premier semestre et du 1er juillet pour le second (article L441-10 du Code de commerce).'],
      ['Indemnité forfaitaire', 'Tout professionnel en retard de paiement doit une indemnité forfaitaire de 40 € pour frais de recouvrement, par facture (articles L441-10 et D441-5 du Code de commerce). Des frais supérieurs peuvent être demandés sur justificatifs.'],
      ['Client particulier', 'Pas d\'indemnité forfaitaire. Sans clause de pénalités au contrat, les intérêts de retard courent au taux de l\'intérêt légal à partir de la mise en demeure (article 1231-6 du Code civil). Le taux légal dépend de la qualité du créancier : « autres cas » quand c\'est une entreprise qui facture.'],
      ['Procédure collective', 'Si le client fait l\'objet d\'une sauvegarde, d\'un redressement ou d\'une liquidation judiciaire, la relance amiable ne suffit plus : la créance se déclare au mandataire, dans les délais fixés.'],
      ['Intérêts simples', 'Le calcul se fait au prorata des jours (année de 365 jours), sur le restant dû TTC, en tenant compte des paiements partiels et du changement de taux à chaque semestre. Base et convention de calcul : à vérifier selon tes conditions générales.'],
    ],
    sources: [
      ['Code de commerce, article L441-10 (version en vigueur depuis le 26/04/2019)', 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414392'],
      ['Code de commerce, article D441-5 (40 €, version en vigueur depuis le 27/02/2021)', 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043197457'],
      ['Banque de France, taux directeurs de la BCE (2,15 % au 01/01/2026, 2,40 % au 01/07/2026)', 'https://www.banque-france.fr/fr/les-taux-monetaires-directeurs'],
      ['Taux de l\'intérêt légal, 2nd semestre 2026 : 2,75 % (autres cas), 6,84 % (créancier particulier), arrêté du 26/06/2026', 'https://www.legifiscal.fr/actualites-fiscales/4555-taux-interet-legal-2d-semestre-2026.html'],
    ],
    sourceTaux: 'Taux relevés le 13/11/2026 (Légifrance, Banque de France, arrêté du 26/06/2026). Le taux de l\'intérêt légal du 1er semestre 2026 (2,62 %) vient d\'une source secondaire : à vérifier au Journal officiel. Nouveaux taux chaque 1er janvier et 1er juillet : à saisir dans les Réglages.',
  };
})();
