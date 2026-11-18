// Base intégrée du suivi de TVA (window.BASE), sans logique.
// DONNÉES DATÉES : taux, périodicités et échéances vérifiés le 14/11/2026 et le 17/11/2026, à revérifier chaque année.
// Chaque valeur est modifiable dans l'application (Réglages → Régime, taux et échéances). Les règles qui
// n'ont pas pu être vérifiées sur une page officielle sont marquées « à vérifier » et restent paramétrables.
// Aucun nom de société, de logiciel comptable, de banque ni de personne réelle.
window.BASE = {
  version: '2026-11-17',
  verifieLe: '2026-11-17',

  reglages: {
    societe: '',
    regime: 'mensuel', // mensuel | trimestriel | simplifie
    debut: '', // premier jour du suivi (AAAA-MM-01)
    clotureMois: 12, // mois de clôture de l'exercice (régime simplifié)
    creditInitial: 0, // crédit de TVA reporté au début du suivi
    jourEcheance: 15, // CA3 : jour du mois qui suit la période (entre le 15 et le 24 selon l'entreprise)
    acompte1Pct: 55, // régime simplifié : acompte de juillet (7e mois de l'exercice)
    acompte2Pct: 40, // régime simplifié : acompte de décembre (12e mois de l'exercice)
    jourAcompte: 15, // jour limite des acomptes de juillet et de décembre (jour non publié sur la page officielle : à vérifier)
    dispenseAcomptes: 1000, // pas d'acompte si la TVA de référence est inférieure (en euros)
    ca12Jour: 0, // CA12 d'un exercice clos le 31 décembre : 0 = calculé (2e jour ouvré suivant le 1er mai, 5 mai en 2026), sinon jour fixe
    ca12Mois: 5,
    ca12Delai: 3, // exercice clos en cours d'année : CA12 dans les 3 mois de la clôture
    finSimplifie: '2027-01-01', // suppression du régime simplifié de TVA (loi n° 2025-127, art. 38)
    seuilTrimestriel: 4000, // jusqu'au 31/12/2026 : CA3 trimestrielle possible si la TVA exigible annuelle est inférieure
    seuilCaN1: 1000000, // à partir de dateSeuilCa : CA3 trimestrielle si le chiffre d'affaires de l'année civile précédente n'excède pas ce montant
    seuilCaN: 1100000, // ... et celui de l'année en cours ; au-delà, mensuelle à compter du mois du dépassement
    dateSeuilCa: '2027-01-01', // entrée en vigueur du critère de chiffre d'affaires (CGI art. 287, 3, version 2027)
    tolerance: 0.01, // écart admis entre la TVA saisie et HT × taux (en euros)
    periodesDeductible: 3, // alerte si la TVA déductible dépasse la collectée sur autant de périodes de suite
    periodesCredit: 3, // alerte si un crédit est reporté sur autant de périodes de suite
    // Taux en pourcentage (France métropolitaine). 0 = opération exonérée ou hors champ.
    taux: [
      { taux: 20, nom: 'Taux normal' },
      { taux: 10, nom: 'Taux intermédiaire' },
      { taux: 5.5, nom: 'Taux réduit' },
      { taux: 2.1, nom: 'Taux particulier' },
      { taux: 0, nom: 'Exonéré ou hors champ' },
    ],
  },

  regimes: [
    { id: 'mensuel', nom: 'Réel normal, mensuel', detail: 'Une déclaration CA3 chaque mois, pour le mois précédent.' },
    { id: 'trimestriel', nom: 'Réel normal, trimestriel', detail: 'Une CA3 par trimestre. En 2026 : si ta TVA exigible annuelle est inférieure à 4 000 €. À partir de 2027 : si ton chiffre d\'affaires ne dépasse pas 1 000 000 € l\'année précédente (1 100 000 € l\'année en cours).' },
    { id: 'simplifie', nom: 'Réel simplifié', detail: 'Deux acomptes (juillet et décembre) et une déclaration annuelle CA12. Supprimé au 1er janvier 2027 : dernière CA12 pour l\'exercice 2026 (le 4 mai 2027 pour un exercice civil).' },
  ],

  types: [
    { id: 'vente', nom: 'Vente', pluriel: 'Ventes', sens: 'collectee', aide: 'TVA collectée sur tes ventes et prestations.' },
    { id: 'achat', nom: 'Achat', pluriel: 'Achats', sens: 'deductible', aide: 'Marchandises, matières, sous-traitance : TVA déductible sur biens et services.' },
    { id: 'frais', nom: 'Frais', pluriel: 'Frais', sens: 'deductible', aide: 'Frais généraux (loyer, logiciels, déplacements…) : TVA déductible si elle est récupérable.' },
    { id: 'immo', nom: 'Immobilisation', pluriel: 'Immobilisations', sens: 'deductible', aide: 'Matériel, véhicule utilitaire, aménagements : TVA déductible sur immobilisations.' },
  ],

  // Sources consultées le 14/11/2026, complétées le 17/11/2026 sur les pages officielles. Les pages officielles sont citées par leur nom (aucun lien
  // vers un espace professionnel) ; la numérotation du CGI peut changer (recodification en cours).
  sources: [
    { sujet: 'Taux 20 %, 10 %, 5,5 % et 2,1 %', texte: 'economie.gouv.fr, « Quels sont les taux de TVA en vigueur en France et dans l\'Union européenne ? » (fiche du 11/12/2025) ; BOFiP BOI-TVA-LIQ-40 (taux particulier de 2,1 %, CGI art. 281 octies) ; CGI art. 278 (taux normal), 279 (10 %), 278-0 bis (5,5 %).', statut: 'vérifié' },
    { sujet: 'CA3 mensuelle ou trimestrielle (jusqu\'au 31/12/2026)', texte: 'Notice du formulaire n° 3310-CA3-SD 2026 et impots.gouv.fr, page « TVA » (mise à jour du 21/05/2026) : déclaration mensuelle en principe ; trimestrielle lorsque la TVA est inférieure à 4 000 € par an.', statut: 'vérifié' },
    { sujet: 'CA3 mensuelle ou trimestrielle (à partir du 01/01/2027)', texte: 'CGI art. 287, 3 et 3 bis, version au 1er janvier 2027 (Légifrance), issue de la loi n° 2025-127 du 14 février 2025, art. 38 : déclaration trimestrielle lorsque le chiffre d\'affaires majoré des acquisitions taxables n\'excède pas 1 000 000 € l\'année civile précédente et 1 100 000 € l\'année en cours ; mensuelle à compter du mois du dépassement ; option pour le mensuel pour au moins quatre trimestres. Le seuil de 4 000 € de TVA ne figure plus dans cette version. L\'outil ne compte que tes ventes HT : ajoute tes acquisitions taxables.', statut: 'vérifié' },
    { sujet: 'Date limite des CA3', texte: 'impots.gouv.fr, « Le régime réel normal : dates limites de transmission des CA3 » : la date dépend du département (Paris et petite couronne ou autres), de la catégorie d\'entreprise et du SIREN ou de l\'initiale du nom. Le jour exact figure dans ton espace professionnel : saisis-le dans les réglages.', statut: 'à vérifier pour ton entreprise' },
    { sujet: 'Réel simplifié : acomptes et CA12', texte: 'impots.gouv.fr, page « TVA » (mise à jour du 21/05/2026) : 2 acomptes en juillet et en décembre, de 55 % et 40 % de la TVA de la ligne 57 de la CA12 précédente ; dispense lorsque la TVA due pour l\'année ou l\'exercice précédent est inférieure à 1 000 € ; CA12 au plus tard le 2e jour ouvré suivant le 1er mai pour un exercice civil, sinon dans les 3 mois de la clôture. Le jour limite des acomptes n\'y figure pas : saisis celui de ton espace professionnel.', statut: 'vérifié (jour des acomptes à vérifier)' },
    { sujet: 'Fin du régime simplifié de TVA', texte: 'impots.gouv.fr, actualité « Le régime simplifié d\'imposition à la TVA est supprimé à compter du 1er janvier 2027 » (22/09/2026) et loi n° 2025-127 du 14 février 2025, art. 38 : passage au réel normal (CA3) ; dernière CA12 le 4 mai 2027 pour un exercice clos le 31/12/2026, dans les 3 mois de la clôture pour un exercice clos de janvier à novembre 2027 ; exercice décalé : première CA3 pour le mois ou le trimestre qui suit la clôture de l\'exercice 2026/2027 ; pas d\'acompte en décembre 2027 ; acompte de juillet 2027 seulement pour un exercice clos de juillet à novembre 2027, si la TVA de l\'exercice précédent dépasse 1 000 €. Le régime simplifié agricole n\'est pas concerné.', statut: 'vérifié' },
    { sujet: 'Report des échéances', texte: 'Une échéance qui tombe un samedi, un dimanche ou un jour férié est reportée au premier jour ouvrable suivant (sources secondaires ; non trouvé sur les pages officielles consultées).', statut: 'à vérifier' },
    { sujet: 'Facturation électronique', texte: 'impots.gouv.fr (actualité du 22/09/2026) : transmission des données de transaction et de paiement (e-reporting) à partir du 1er septembre 2027, à une fréquence qui dépend du régime. Ce suivi n\'en change pas : il reste une aide de contrôle.', statut: 'vérifié' },
  ],

  // Couleurs fixes, dans cet ordre (jamais générées).
  couleurs: {
    collectee: '#2E5A88',
    deductible: '#B8901F',
    vente: { fond: '#D8E4F0', texte: '#22476E' },
    achat: { fond: '#FBEBC2', texte: '#6E5310' },
    frais: { fond: '#F3EDE3', texte: '#45413A' },
    immo: { fond: '#F8DCD3', texte: '#8A3322' },
  },

  conseils: [
    ['Choisis ton régime', 'Réel normal mensuel ou trimestriel, ou réel simplifié : les périodes et l\'échéancier suivent ce choix. Ajuste le jour d\'échéance de tes CA3 dans les réglages.'],
    ['Saisis tes opérations', 'Ventes (TVA collectée), achats, frais et immobilisations (TVA déductible), en HT ou en TTC : la TVA est calculée au centime et tout écart avec ta facture est signalé.'],
    ['Suis chaque période', 'TVA collectée, déductible, nette à payer ou crédit reporté sur la période suivante, avec le détail par taux.'],
    ['Pointe et contrôle', 'Marque chaque déclaration « déclarée » puis « payée ». L\'onglet Contrôles liste ce qui mérite un coup d\'œil avant de déclarer.'],
  ],
};
