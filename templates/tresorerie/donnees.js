// Trésorerie prévisionnelle QME · base intégrée (aucune logique).
// Catégories et profils rédigés pour le template : aucune base externe, aucun taux, aucune échéance officielle.
// Les échéances fiscales et sociales sont saisies par l'utilisateur d'après ses propres avis.
window.BASE = {
  familles: [
    { id: 'exploitation', nom: 'Exploitation', detail: 'Activité courante : ventes, achats, frais généraux, salaires.' },
    { id: 'fiscal', nom: 'Fiscal et social', detail: 'TVA, charges sociales, impôts : montants et dates selon tes avis d\'échéance.' },
    { id: 'investissement', nom: 'Investissement', detail: 'Achats et ventes de matériel, véhicules, travaux.' },
    { id: 'financement', nom: 'Financement', detail: 'Apports, emprunts, aides, remboursements, prélèvements.' },
  ],
  // type : enc (encaissement) ou dec (décaissement).
  categories: [
    { id: 'ventes', nom: 'Ventes de marchandises', type: 'enc', famille: 'exploitation' },
    { id: 'prestations', nom: 'Prestations de services', type: 'enc', famille: 'exploitation' },
    { id: 'acomptes', nom: 'Acomptes clients', type: 'enc', famille: 'exploitation' },
    { id: 'commissions', nom: 'Commissions et redevances', type: 'enc', famille: 'exploitation' },
    { id: 'autres-enc', nom: 'Autres encaissements', type: 'enc', famille: 'exploitation' },
    { id: 'credit-tva', nom: 'Remboursement de crédit de TVA', type: 'enc', famille: 'fiscal' },
    { id: 'cession', nom: 'Vente d\'un bien (matériel, véhicule)', type: 'enc', famille: 'investissement' },
    { id: 'apport', nom: 'Apport des associés ou du dirigeant', type: 'enc', famille: 'financement' },
    { id: 'emprunt-recu', nom: 'Déblocage d\'emprunt', type: 'enc', famille: 'financement' },
    { id: 'aides', nom: 'Subventions et aides', type: 'enc', famille: 'financement' },

    { id: 'achats', nom: 'Achats de marchandises et matières', type: 'dec', famille: 'exploitation' },
    { id: 'sous-traitance', nom: 'Sous-traitance', type: 'dec', famille: 'exploitation' },
    { id: 'loyer', nom: 'Loyer et charges locatives', type: 'dec', famille: 'exploitation' },
    { id: 'energie', nom: 'Énergie et eau', type: 'dec', famille: 'exploitation' },
    { id: 'telecom', nom: 'Téléphone et internet', type: 'dec', famille: 'exploitation' },
    { id: 'logiciels', nom: 'Logiciels et abonnements', type: 'dec', famille: 'exploitation' },
    { id: 'assurances', nom: 'Assurances', type: 'dec', famille: 'exploitation' },
    { id: 'honoraires', nom: 'Honoraires (comptable, avocat, conseil)', type: 'dec', famille: 'exploitation' },
    { id: 'banque', nom: 'Frais bancaires', type: 'dec', famille: 'exploitation' },
    { id: 'deplacements', nom: 'Déplacements et véhicules', type: 'dec', famille: 'exploitation' },
    { id: 'marketing', nom: 'Marketing et publicité', type: 'dec', famille: 'exploitation' },
    { id: 'fournitures', nom: 'Fournitures et petit matériel', type: 'dec', famille: 'exploitation' },
    { id: 'entretien', nom: 'Entretien et réparations', type: 'dec', famille: 'exploitation' },
    { id: 'salaires', nom: 'Salaires nets', type: 'dec', famille: 'exploitation' },
    { id: 'remuneration', nom: 'Rémunération du dirigeant', type: 'dec', famille: 'exploitation' },
    { id: 'autres-dec', nom: 'Autres décaissements', type: 'dec', famille: 'exploitation' },
    { id: 'tva', nom: 'TVA à reverser', type: 'dec', famille: 'fiscal' },
    { id: 'charges-sociales', nom: 'Charges sociales des salariés', type: 'dec', famille: 'fiscal' },
    { id: 'cotisations', nom: 'Cotisations sociales du dirigeant', type: 'dec', famille: 'fiscal' },
    { id: 'impots', nom: 'Impôts et taxes', type: 'dec', famille: 'fiscal' },
    { id: 'materiel', nom: 'Achat de matériel', type: 'dec', famille: 'investissement' },
    { id: 'vehicule', nom: 'Achat de véhicule', type: 'dec', famille: 'investissement' },
    { id: 'travaux', nom: 'Travaux et aménagements', type: 'dec', famille: 'investissement' },
    { id: 'emprunt', nom: 'Remboursement d\'emprunt', type: 'dec', famille: 'financement' },
    { id: 'prelevements', nom: 'Prélèvements ou dividendes', type: 'dec', famille: 'financement' },
    { id: 'compte-courant', nom: 'Remboursement de compte courant', type: 'dec', famille: 'financement' },
    { id: 'caution', nom: 'Dépôt de garantie versé', type: 'dec', famille: 'financement' },
  ],
  // Profils proposés au premier lancement : lignes types SANS montant (l'utilisateur saisit les siens).
  profils: [
    { id: 'services', nom: 'Prestataire de services', detail: 'Indépendant, consultant, profession libérale', lignes: [
      ['prestations', 'Factures clients', 'mensuel'], ['remuneration', 'Ma rémunération', 'mensuel'], ['cotisations', 'Cotisations sociales', 'mensuel'],
      ['tva', 'TVA à reverser', 'mensuel'], ['logiciels', 'Logiciels et abonnements', 'mensuel'], ['telecom', 'Téléphone et internet', 'mensuel'],
      ['honoraires', 'Expert-comptable', 'mensuel'], ['assurances', 'Responsabilité civile professionnelle', 'annuel'], ['banque', 'Frais bancaires', 'mensuel'],
      ['deplacements', 'Déplacements', 'mensuel'],
    ] },
    { id: 'commerce', nom: 'Commerce', detail: 'Boutique, négoce, vente en ligne', lignes: [
      ['ventes', 'Ventes', 'mensuel'], ['achats', 'Achats de marchandises', 'mensuel'], ['loyer', 'Loyer du local', 'mensuel'],
      ['energie', 'Électricité', 'mensuel'], ['tva', 'TVA à reverser', 'mensuel'], ['marketing', 'Publicité', 'mensuel'],
      ['assurances', 'Assurance multirisque', 'annuel'], ['emprunt', 'Prêt bancaire', 'mensuel'], ['remuneration', 'Ma rémunération', 'mensuel'],
      ['cotisations', 'Cotisations sociales', 'mensuel'], ['banque', 'Frais bancaires et terminal de paiement', 'mensuel'],
    ] },
    { id: 'artisan', nom: 'Artisan / BTP', detail: 'Chantiers, atelier, interventions', lignes: [
      ['prestations', 'Factures de chantiers', 'mensuel'], ['acomptes', 'Acomptes à la commande', 'mensuel'], ['achats', 'Matériaux et fournitures', 'mensuel'],
      ['sous-traitance', 'Sous-traitants', 'mensuel'], ['deplacements', 'Carburant et entretien véhicule', 'mensuel'], ['assurances', 'Assurance décennale', 'annuel'],
      ['tva', 'TVA à reverser', 'trimestriel'], ['emprunt', 'Crédit véhicule', 'mensuel'], ['remuneration', 'Ma rémunération', 'mensuel'],
      ['cotisations', 'Cotisations sociales', 'trimestriel'], ['honoraires', 'Expert-comptable', 'trimestriel'],
    ] },
    { id: 'societe', nom: 'Société avec salariés', detail: 'TPE de 1 à 10 salariés', lignes: [
      ['prestations', 'Chiffre d\'affaires encaissé', 'mensuel'], ['salaires', 'Salaires nets', 'mensuel'], ['charges-sociales', 'Charges sociales', 'mensuel'],
      ['remuneration', 'Rémunération du dirigeant', 'mensuel'], ['loyer', 'Loyer des bureaux', 'mensuel'], ['tva', 'TVA à reverser', 'mensuel'],
      ['logiciels', 'Logiciels et abonnements', 'mensuel'], ['honoraires', 'Expert-comptable', 'mensuel'], ['assurances', 'Assurances', 'annuel'],
      ['emprunt', 'Prêt bancaire', 'mensuel'], ['impots', 'Impôts et taxes', 'annuel'], ['prelevements', 'Dividendes', 'annuel'],
    ] },
  ],
  recurrences: [
    { id: 'ponctuel', nom: 'Ponctuel', detail: 'une seule fois' },
    { id: 'mensuel', nom: 'Mensuel', detail: 'tous les mois' },
    { id: 'trimestriel', nom: 'Trimestriel', detail: 'tous les 3 mois' },
    { id: 'annuel', nom: 'Annuel', detail: 'tous les 12 mois' },
  ],
  scenarios: [
    { id: 'prudent', nom: 'Prudent', detail: 'encaissements en baisse' },
    { id: 'central', nom: 'Central', detail: 'encaissements comme prévus' },
    { id: 'optimiste', nom: 'Optimiste', detail: 'encaissements en hausse' },
  ],
  // Écarts de départ des scénarios (en % sur les encaissements non réalisés) : valeurs arbitraires, réglables.
  ecartsParDefaut: { prudent: -20, optimiste: 10 },
  avertissement: 'Outil d\'aide à la prévision de trésorerie : ce n\'est ni un logiciel comptable ni un logiciel certifié, et il ne remplace pas l\'avis de ton expert-comptable ou de ton banquier. Les échéances fiscales et sociales ne sont pas fournies : saisis-les d\'après tes propres avis.',
};
