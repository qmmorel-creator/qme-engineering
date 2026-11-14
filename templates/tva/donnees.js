// Base intégrée du suivi de TVA (window.BASE), sans logique.
// DONNÉES DATÉES : taux, périodicités et échéances vérifiés le 14/11/2026, à revérifier chaque année.
// Chaque valeur est modifiable dans l'application (Réglages → Régime, taux et échéances). Les règles qui
// n'ont pas pu être vérifiées sur une page officielle sont marquées « à vérifier » et restent paramétrables.
// Aucun nom de société, de logiciel comptable, de banque ni de personne réelle.
window.BASE = {
  version: '2026-11-14',
  verifieLe: '2026-11-14',

  reglages: {
    societe: '',
    regime: 'mensuel', // mensuel | trimestriel | simplifie
    debut: '', // premier jour du suivi (AAAA-MM-01)
    clotureMois: 12, // mois de clôture de l'exercice (régime simplifié)
    creditInitial: 0, // crédit de TVA reporté au début du suivi
    jourEcheance: 15, // CA3 : jour du mois qui suit la période (entre le 15 et le 24 selon l'entreprise)
    acompte1Pct: 55, // régime simplifié : acompte de juillet (7e mois de l'exercice)
    acompte2Pct: 40, // régime simplifié : acompte de décembre (12e mois de l'exercice)
    jourAcompte: 15, // jour limite des acomptes (à vérifier, voir sources)
    dispenseAcomptes: 1000, // pas d'acompte si la TVA de référence est inférieure (en euros)
    ca12Jour: 0, // CA12 d'un exercice clos le 31 décembre : 0 = calculé (2e jour ouvré suivant le 1er mai, 5 mai en 2026), sinon jour fixe
    ca12Mois: 5,
    ca12Delai: 3, // exercice clos en cours d'année : CA12 dans les 3 mois de la clôture
    finSimplifie: '2027-01-01', // suppression annoncée du régime simplifié de TVA (à vérifier)
    seuilTrimestriel: 4000, // réel normal : CA3 trimestrielle possible si la TVA exigible annuelle est inférieure
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
    { id: 'trimestriel', nom: 'Réel normal, trimestriel', detail: 'Une CA3 par trimestre : possible si ta TVA exigible annuelle est inférieure au seuil (4 000 € en 2026).' },
    { id: 'simplifie', nom: 'Réel simplifié', detail: 'Deux acomptes (juillet et décembre) et une déclaration annuelle CA12. Suppression annoncée au 1er janvier 2027 : à vérifier.' },
  ],

  types: [
    { id: 'vente', nom: 'Vente', pluriel: 'Ventes', sens: 'collectee', aide: 'TVA collectée sur tes ventes et prestations.' },
    { id: 'achat', nom: 'Achat', pluriel: 'Achats', sens: 'deductible', aide: 'Marchandises, matières, sous-traitance : TVA déductible sur biens et services.' },
    { id: 'frais', nom: 'Frais', pluriel: 'Frais', sens: 'deductible', aide: 'Frais généraux (loyer, logiciels, déplacements…) : TVA déductible si elle est récupérable.' },
    { id: 'immo', nom: 'Immobilisation', pluriel: 'Immobilisations', sens: 'deductible', aide: 'Matériel, véhicule utilitaire, aménagements : TVA déductible sur immobilisations.' },
  ],

  // Sources consultées le 14/11/2026. Les pages officielles sont citées par leur nom (aucun lien
  // vers un espace professionnel) ; la numérotation du CGI peut changer (recodification en cours).
  sources: [
    { sujet: 'Taux 20 %, 10 %, 5,5 % et 2,1 %', texte: 'economie.gouv.fr, « Quels sont les taux de TVA en vigueur en France et dans l\'Union européenne ? » (fiche du 11/12/2025) ; BOFiP BOI-TVA-LIQ-40 (taux particulier de 2,1 %, CGI art. 281 octies) ; CGI art. 278 (taux normal), 279 (10 %), 278-0 bis (5,5 %).', statut: 'vérifié' },
    { sujet: 'CA3 mensuelle ou trimestrielle', texte: 'Notice du formulaire n° 3310-CA3-SD 2026 (impots.gouv.fr) : déclaration mensuelle en principe ; trimestrielle seulement si la taxe exigible annuelle est inférieure à 4 000 €.', statut: 'vérifié' },
    { sujet: 'Date limite des CA3', texte: 'impots.gouv.fr, « Le régime réel normal : dates limites de transmission des CA3 » : entre le 15 et le 24 du mois suivant, selon la forme juridique, le département et le numéro SIREN ou l\'initiale. Le jour exact est celui indiqué par ton service des impôts : saisis-le dans les réglages.', statut: 'à vérifier pour ton entreprise' },
    { sujet: 'Réel simplifié : acomptes et CA12', texte: 'Acomptes de 55 % (juillet) et 40 % (décembre) de la TVA due au titre de l\'exercice précédent, avant déduction de la TVA sur immobilisations ; dispense sous 1 000 € ; CA12 le 2e jour ouvré suivant le 1er mai pour un exercice clos le 31 décembre (5 mai 2026), sinon dans les 3 mois de la clôture. Repris de sources secondaires (articles de cabinets et de sites spécialisés) : page officielle non consultée.', statut: 'à vérifier' },
    { sujet: 'Fin du régime simplifié de TVA', texte: 'Loi de finances pour 2025 (loi n° 2025-127 du 14 février 2025, art. 38) : suppression annoncée du régime simplifié de TVA au 1er janvier 2027 (ou au premier exercice ouvert après le 31/12/2026), passage à des déclarations mensuelles ou trimestrielles. Modalités décrites différemment selon les sources secondaires.', statut: 'à vérifier' },
    { sujet: 'Report des échéances', texte: 'Une échéance qui tombe un samedi, un dimanche ou un jour férié est reportée au premier jour ouvrable suivant (sources secondaires).', statut: 'à vérifier' },
    { sujet: 'Facturation électronique', texte: 'Le calendrier de la facturation électronique obligatoire (réception, puis émission selon la taille de l\'entreprise) ne change pas ce suivi, qui reste une aide de contrôle. Calendrier à vérifier sur les pages officielles.', statut: 'à vérifier' },
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
