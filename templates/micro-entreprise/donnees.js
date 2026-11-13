// Base intégrée du livre recettes-dépenses micro-entreprise (window.BASE), sans logique.
// DONNÉES DATÉES : taux et seuils 2026, à revérifier et mettre à jour chaque année.
// Sources : urssaf.fr, autoentrepreneur.urssaf.fr, economie.gouv.fr (consultés le 12/11/2026).
// L'utilisateur peut modifier chaque valeur dans l'application (Réglages → Taux et seuils).
// Aucune date limite de déclaration et aucun taux ACRE en base : à vérifier ou saisir par l'utilisateur.
globalThis.BASE = {
  millesime: 2026,
  consulteLe: '2026-11-12',
  sources: [
    { nom: 'urssaf.fr', url: 'https://www.urssaf.fr' },
    { nom: 'autoentrepreneur.urssaf.fr', url: 'https://www.autoentrepreneur.urssaf.fr' },
    { nom: 'economie.gouv.fr', url: 'https://www.economie.gouv.fr' },
  ],

  // Taux en pourcentage du chiffre d'affaires encaissé ; montants en euros.
  taux: {
    cotisations: { vente: 12.3, bic: 21.2, bnc: 25.6, cipav: 23.2 },
    versementLiberatoire: { vente: 1, bic: 1.7, bnc: 2.2 },
    formation: { commercant: 0.1, liberal: 0.2, artisan: 0.3 },
    plafonds: { vente: 203100, services: 83600 },
    tva: { vente: { base: 85000, majore: 93500 }, services: { base: 37500, majore: 41250 } },
  },

  // Catégories d'activité du livre des recettes (couleurs fixes, dans l'ordre).
  categories: [
    { id: 'vente', nom: 'Vente de marchandises (BIC)', court: 'Vente', couleur: 'bleu' },
    { id: 'bic', nom: 'Prestations de services (BIC)', court: 'Services BIC', couleur: 'jaune' },
    { id: 'bnc', nom: 'Prestations libérales (BNC)', court: 'BNC', couleur: 'rouge' },
  ],

  statutsFormation: [
    { id: 'commercant', nom: 'Commerçant' },
    { id: 'artisan', nom: 'Artisan' },
    { id: 'liberal', nom: 'Profession libérale' },
  ],

  modesReglement: ['Virement', 'Carte bancaire', 'Espèces', 'Chèque', 'Prélèvement', 'Plateforme de paiement', 'Autre'],

  categoriesDepenses: [
    'Fournitures et petit matériel', 'Matériel et outillage', 'Logiciels et abonnements', 'Téléphone et internet',
    'Déplacements', 'Repas professionnels', 'Loyer et charges', 'Assurances', 'Frais bancaires', 'Formation',
    'Publicité et communication', 'Honoraires', 'Autre',
  ],

  couleurs: [
    { id: 'bleu', hex: '#1D4E89', nom: 'Bleu' },
    { id: 'jaune', hex: '#F5B400', nom: 'Jaune' },
    { id: 'rouge', hex: '#D9302A', nom: 'Rouge' },
    { id: 'encre', hex: '#141414', nom: 'Noir' },
  ],
};
