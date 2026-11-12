// Base intégrée du budget du foyer : groupes, catalogue de catégories, sources de revenus, modèles de foyer.
// Aucune donnée réglementaire ni aucun montant : rien à remettre à jour chaque année.
window.BASE = {
  // Groupes du repère 50/30/20 (popularisé par E. Warren et A. Warren Tyagi, « All Your Worth », 2005).
  groupes: [
    { id: 'besoins', nom: 'Besoins', repere: 50, couleur: '#1D4E89', texte: '#fff', detail: 'Dépenses nécessaires : logement, énergie, courses, transports, santé.' },
    { id: 'envies', nom: 'Envies', repere: 30, couleur: '#F5B400', texte: '#141414', detail: 'Dépenses choisies : sorties, loisirs, shopping, vacances.' },
    { id: 'epargne', nom: 'Épargne', repere: 20, couleur: '#2E7D4F', texte: '#fff', detail: 'Ce qui est mis de côté ou rembourse une dette en avance.' },
  ],

  // Catalogue : identifiant stable, groupe par défaut, report du reste conseillé, sous-catégories.
  categories: [
    { id: 'logement', nom: 'Logement', groupe: 'besoins', sous: ['Loyer', 'Crédit immobilier', 'Charges de copropriété', 'Assurance habitation', 'Entretien et réparations'] },
    { id: 'energie', nom: 'Énergie et eau', groupe: 'besoins', sous: ['Électricité', 'Gaz', 'Eau', 'Chauffage (bois, fioul…)'] },
    { id: 'alimentation', nom: 'Alimentation', groupe: 'besoins', sous: ['Courses', 'Marché et producteurs', 'Boulangerie', 'Cantine'] },
    { id: 'transports', nom: 'Transports', groupe: 'besoins', sous: ['Carburant ou recharge', 'Transports en commun', 'Assurance auto', 'Entretien du véhicule', 'Crédit ou location auto', 'Stationnement et péages'] },
    { id: 'sante', nom: 'Santé', groupe: 'besoins', sous: ['Complémentaire santé', 'Consultations', 'Pharmacie', 'Optique et dentaire'] },
    { id: 'telecoms', nom: 'Télécoms', groupe: 'besoins', sous: ['Box internet', 'Forfaits mobiles', 'Téléphone (achat)'] },
    { id: 'enfants', nom: 'Enfants', groupe: 'besoins', report: true, sous: ['Garde', 'Scolarité et fournitures', 'Activités', 'Vêtements', 'Argent de poche'] },
    { id: 'assurances', nom: 'Assurances et banque', groupe: 'besoins', sous: ['Frais bancaires', 'Assurance emprunteur', 'Autres assurances'] },
    { id: 'impots', nom: 'Impôts et taxes', groupe: 'besoins', report: true, sous: ['Impôt sur le revenu', 'Taxe foncière', 'Autres taxes'] },
    { id: 'animaux', nom: 'Animaux', groupe: 'besoins', sous: ['Alimentation animale', 'Vétérinaire', 'Accessoires'] },
    { id: 'sorties', nom: 'Restaurants et sorties', groupe: 'envies', sous: ['Restaurants', 'Cafés et bars', 'Cinéma et spectacles', 'Livraison de repas'] },
    { id: 'loisirs', nom: 'Loisirs et sport', groupe: 'envies', sous: ['Sport', 'Livres et jeux', 'Activités culturelles', 'Matériel de loisirs'] },
    { id: 'abonnements', nom: 'Abonnements', groupe: 'envies', sous: ['Vidéo et musique', 'Presse', 'Applications', 'Salle de sport'] },
    { id: 'shopping', nom: 'Shopping', groupe: 'envies', sous: ['Vêtements', 'Maison et décoration', 'Électronique'] },
    { id: 'beaute', nom: 'Beauté et bien-être', groupe: 'envies', sous: ['Coiffeur', 'Soins', 'Produits'] },
    { id: 'vacances', nom: 'Vacances', groupe: 'envies', report: true, sous: ['Transport', 'Hébergement', 'Sur place'] },
    { id: 'cadeaux', nom: 'Cadeaux et fêtes', groupe: 'envies', report: true, sous: ['Anniversaires', 'Fêtes de fin d\'année', 'Réceptions'] },
    { id: 'dons', nom: 'Dons', groupe: 'envies', sous: ['Associations', 'Parrainages'] },
    { id: 'precaution', nom: 'Épargne de précaution', groupe: 'epargne', sous: ['Virement mensuel', 'Versement exceptionnel'] },
    { id: 'projets', nom: 'Épargne projets', groupe: 'epargne', sous: ['Voiture', 'Travaux', 'Voyage', 'Études'] },
    { id: 'retraite', nom: 'Épargne retraite', groupe: 'epargne', sous: ['Versements programmés'] },
    { id: 'dettes', nom: 'Remboursement anticipé', groupe: 'epargne', sous: ['Crédit à la consommation', 'Prêt personnel'] },
  ],

  sources: ['Salaire', 'Prime', 'Allocations', 'Pension', 'Revenus locatifs', 'Activité indépendante', 'Autre revenu'],

  // Modèles de foyer : catégories et sources préchoisies, jamais de montant.
  modeles: [
    { id: 'seul', nom: 'Personne seule', detail: 'Un revenu, un logement',
      categories: ['logement', 'energie', 'alimentation', 'transports', 'sante', 'telecoms', 'assurances', 'impots', 'sorties', 'loisirs', 'abonnements', 'shopping', 'vacances', 'cadeaux', 'precaution', 'projets'],
      sources: ['Salaire'] },
    { id: 'couple', nom: 'Couple sans enfant', detail: 'Deux revenus, dépenses mises en commun',
      categories: ['logement', 'energie', 'alimentation', 'transports', 'sante', 'telecoms', 'assurances', 'impots', 'sorties', 'loisirs', 'abonnements', 'shopping', 'beaute', 'vacances', 'cadeaux', 'precaution', 'projets', 'retraite'],
      sources: ['Salaire', 'Salaire'] },
    { id: 'famille', nom: 'Famille avec enfants', detail: 'Enfants, garde, activités, allocations',
      categories: ['logement', 'energie', 'alimentation', 'transports', 'sante', 'telecoms', 'enfants', 'assurances', 'impots', 'animaux', 'sorties', 'loisirs', 'abonnements', 'shopping', 'vacances', 'cadeaux', 'precaution', 'projets'],
      sources: ['Salaire', 'Salaire', 'Allocations'] },
    { id: 'etudiant', nom: 'Étudiant', detail: 'Petit budget, aides et job',
      categories: ['logement', 'energie', 'alimentation', 'transports', 'sante', 'telecoms', 'sorties', 'loisirs', 'abonnements', 'shopping', 'precaution'],
      sources: ['Activité indépendante', 'Allocations', 'Autre revenu'] },
  ],

  repere: {
    titre: 'Repère 50/30/20',
    texte: 'Un repère courant de conseil budgétaire : environ 50 % des revenus pour les besoins, 30 % pour les envies et 20 % pour l\'épargne. Ce n\'est pas une règle : selon ton loyer, ta ville ou tes projets, l\'écart peut être normal.',
    source: 'Popularisé par Elizabeth Warren et Amelia Warren Tyagi dans le livre « All Your Worth » (2005). Aucune source officielle.',
  },
};
