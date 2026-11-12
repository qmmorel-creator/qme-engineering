// Base intégrée du calculateur de TJM : taux micro-entreprise datés, avec leur source.
// DONNÉES DATÉES : à revérifier et mettre à jour chaque année (au 1er janvier).
// Aucune logique ici ; les valeurs sont recopiées dans les réglages de l'utilisateur, qui peut les modifier.
window.BASE = {
  taux: {
    annee: 2026,
    enVigueur: 'au 1er janvier 2026',
    consulteLe: '12/11/2026',
    sources: ['urssaf.fr', 'autoentrepreneur.urssaf.fr', 'economie.gouv.fr'],
    // Cotisations sociales de la micro-entreprise, en % du chiffre d'affaires.
    cotisations: { bic: 21.2, bnc: 25.6, cipav: 23.2 },
    // Versement libératoire de l'impôt sur le revenu (option), en % du chiffre d'affaires.
    vl: { bic: 1.7, bnc: 2.2 },
    // Contribution à la formation professionnelle, en % du chiffre d'affaires.
    cfp: { commercant: 0.1, liberal: 0.2, artisan: 0.3 },
    // Plafond de chiffre d'affaires de la micro-entreprise (prestations de services), en euros.
    plafondServices: 83600,
    // Franchise en base de TVA (prestations de services) : seuil de base et seuil majoré, en euros.
    tvaBase: 37500,
    tvaMajore: 41250,
    // Valeurs signalées « à revérifier » dans la fiche produit.
    aReverifier: ['cotisations.cipav'],
  },

  // Statuts proposés. Sociétés : aucun taux intégré, saisi par l'utilisateur.
  statuts: [
    { id: 'bic', nom: 'Micro-entreprise · prestations BIC', court: 'Micro BIC', detail: 'Prestations de services commerciales ou artisanales' },
    { id: 'bnc', nom: 'Micro-entreprise · BNC', court: 'Micro BNC', detail: 'Professions libérales non réglementées (Sécurité sociale des indépendants)' },
    { id: 'cipav', nom: 'Micro-entreprise · BNC Cipav', court: 'Micro Cipav', detail: 'Professions libérales relevant de la Cipav' },
    { id: 'societe', nom: 'Société · SASU ou EURL', court: 'SASU / EURL', detail: 'Taux de charges à saisir (à demander à ton expert-comptable)' },
  ],

  // Frais professionnels types : libellés seulement, aucun montant intégré.
  fraisTypes: ['Logiciels et abonnements', 'Matériel informatique', 'Assurance responsabilité civile pro', 'Comptabilité et banque',
    'Téléphone et internet', 'Déplacements', 'Formation', 'Espace de travail (coworking)'],

  // Couleurs des scénarios, dans cet ordre (jamais générées).
  couleurs: [
    { id: 'bleu', hex: '#1D4E89', nom: 'Bleu', tiret: '', forme: 'rond' },
    { id: 'rouge', hex: '#D9302A', nom: 'Rouge', tiret: '8 5', forme: 'carre' },
    { id: 'jaune', hex: '#F5B400', nom: 'Jaune', tiret: '2 4', forme: 'triangle' },
  ],
};
