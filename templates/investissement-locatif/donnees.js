// Base intégrée de « Rentabilité d'un investissement locatif » : types de location, postes types, repères,
// points à vérifier avant d'acheter. Contenu original rédigé pour QME. Aucun taux de marché, prix au m²,
// loyer de référence ni taux d'imposition : prix, loyers, charges, taxe foncière et conditions du crédit
// sont ceux que l'utilisateur saisit. Seule valeur proposée : l'hypothèse de frais de notaire, affichée
// comme telle, datée et modifiable (ou remplacée par le montant du notaire).
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Types de location étudiés (aucune règle fiscale attachée : la fiscalité est hors calcul).
    locations: {
      nu: { nom: 'Location nue', court: 'Nue', aide: 'Logement vide, bail d\'habitation classique.' },
      meuble: { nom: 'Location meublée', court: 'Meublée', aide: 'Logement meublé à l\'année ou à l\'année scolaire.' },
      colocation: { nom: 'Colocation', court: 'Colocation', aide: 'Un loyer par chambre : saisis chaque chambre.' },
      saisonnier: { nom: 'Location saisonnière', court: 'Saisonnière', aide: 'Location à la nuitée : prix moyen d\'une nuit et nuits louées par an.' },
    },

    etats: { ancien: 'Ancien', neuf: 'Neuf' },

    // Frais de notaire estimés : HYPOTHÈSE affichée, à remplacer par l'estimation du notaire.
    notaire: {
      ancien: 8, // % du prix
      neuf: 3,
      texte: 'Hypothèse modifiable, haut des ordres de grandeur couramment donnés (environ 7 à 8 % du prix dans l\'ancien, 2 à 3 % dans le neuf, consultés le 14/11/2026). Le montant exact dépend du département, du prix et du type de bien : demande-le au notaire.',
      verifie: '14/11/2026',
    },

    // Postes types : libellé et aide de saisie. Aucun montant proposé.
    postesAcquisition: [
      ['prix', 'Prix d\'achat', 'Net vendeur, tel que dans la promesse ou l\'annonce.'],
      ['notaire', 'Frais de notaire', 'Montant du notaire, ou estimation (hypothèse affichée).'],
      ['fraisAgence', 'Frais d\'agence', 'Seulement s\'ils sont à ta charge et en plus du prix.'],
      ['travaux', 'Travaux', 'Devis ou estimation des travaux avant la mise en location.'],
      ['mobilier', 'Mobilier et équipement', 'Pour une location meublée, une colocation ou une location saisonnière.'],
      ['fraisBancaires', 'Frais bancaires', 'Frais de dossier, garantie, courtage.'],
      ['autresFrais', 'Autres frais', 'Diagnostics, déménagement, premières fournitures…'],
    ],
    postesCharges: [
      ['taxeFonciere', 'Taxe foncière', 'Montant de l\'avis d\'imposition, à demander au vendeur.'],
      ['copro', 'Charges de copropriété non récupérables', 'Part que tu ne peux pas refacturer au locataire (procès-verbaux d\'assemblée générale, appels de fonds).'],
      ['pno', 'Assurance propriétaire non occupant', 'Devis de ton assureur.'],
      ['gli', 'Assurance loyers impayés', 'Facultative ; devis de ton assureur ou de ton gestionnaire.'],
      ['gestion', 'Gestion ou conciergerie', 'En % des loyers encaissés : agence de gestion, conciergerie, commission de plateforme.'],
      ['entretien', 'Entretien et petites réparations', 'Ta provision annuelle.'],
      ['exploitation', 'Énergie, internet, ménage', 'Ce que tu paies toi-même en meublé, colocation ou saisonnier.'],
      ['autresCharges', 'Autres charges', 'Comptabilité, frais bancaires du compte dédié, cotisations…'],
    ],

    // Points à vérifier avant d'acheter (aucune règle chiffrée : sources générales).
    verifications: [
      ['loyer', 'Le loyer saisi est-il réaliste pour ce logement ?', 'Compare avec des annonces de biens équivalents dans le quartier ; aucun loyer de référence n\'est intégré.'],
      ['encadrement', 'Les loyers sont-ils encadrés dans la commune ?', 'Certaines communes encadrent les loyers : renseigne-toi auprès de la mairie ou sur service-public.fr.'],
      ['dpe', 'Le diagnostic de performance énergétique permet-il de louer le logement, aujourd\'hui et dans les années à venir ?', 'Des règles de décence énergétique s\'appliquent aux logements loués : vérifie-les sur service-public.fr.'],
      ['copro', 'As-tu lu les trois derniers procès-verbaux d\'assemblée générale ?', 'Travaux votés ou à venir, impayés, procédures : ils pèsent sur les charges et le prix.'],
      ['taxe', 'Connais-tu le montant exact de la taxe foncière ?', 'Demande le dernier avis d\'imposition au vendeur.'],
      ['saisonnier', 'La location saisonnière est-elle autorisée pour ce logement ?', 'Règlement de copropriété, déclaration ou autorisation en mairie : renseigne-toi avant d\'acheter.'],
      ['travaux', 'Les travaux sont-ils chiffrés par un devis ?', 'Une estimation au jugé fausse le coût total et le rendement net.'],
      ['fiscalite', 'As-tu fait estimer l\'impôt sur ces loyers ?', 'Le régime fiscal change fortement le résultat après impôt : demande à un conseiller fiscal ou consulte impots.gouv.fr.'],
    ],

    reperes: [
      ['Rendement brut', 'Loyers annuels théoriques (sans vacance) divisés par le prix d\'achat. C\'est le chiffre des annonces : il ignore les frais, les charges et la vacance.'],
      ['Rendement net de charges', 'Loyers réellement encaissés (vacance déduite) moins les charges du propriétaire, divisés par le coût total d\'acquisition (prix, notaire, travaux, mobilier, frais). Avant impôt et hors crédit.'],
      ['Cash-flow mensuel avant impôt', 'Ce qui reste chaque mois : loyers encaissés − charges − mensualité du crédit assurance comprise. Négatif : c\'est ton effort d\'épargne. L\'impôt sur les loyers n\'est pas déduit.'],
      ['Vacance locative', 'Nombre de mois par an sans loyer (entre deux locataires, travaux). Une vacance d\'un mois retire un douzième des loyers.'],
      ['Prix maximal', 'Le prix d\'achat au-delà duquel le rendement visé n\'est plus atteint, avec les mêmes loyers et les mêmes charges. Frais de notaire et d\'agence suivent le prix ; travaux, mobilier et frais bancaires restent fixes.'],
      ['Mensualité', 'Crédit amortissable à mensualités constantes : capital × t / (1 − (1 + t)^−n), t = taux annuel / 12, n = nombre de mois. Assurance : taux annuel × capital × quotité / 12, sur le capital initial ou restant dû.'],
    ],

    fiscalite: 'L\'impôt sur le revenu et les prélèvements sociaux dus sur les loyers ne sont pas calculés. Ils dépendent du type de location (nue ou meublée), du régime choisi (forfaitaire ou réel), de tes autres revenus et des règles de l\'année. Tous les résultats sont donc avant impôt : fais estimer l\'impôt par un conseiller fiscal ou un expert-comptable, ou consulte impots.gouv.fr.',
  };
})();
