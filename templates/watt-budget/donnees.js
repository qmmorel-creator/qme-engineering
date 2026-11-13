// WattBudget · base intégrée (aucune logique ici).
// Puissances et usages : ORDRES DE GRANDEUR GÉNÉRIQUES établis par QME pour démarrer, sans marque.
// Ils ne remplacent pas la plaque signalétique, l'étiquette énergie ou une mesure au wattmètre.
// AUCUN TARIF n'est fourni : le prix du kWh vient du contrat de l'utilisateur (date saisie avec le prix).
window.BASE = {
  version: '2026-11-13',
  sourceValeurs: 'Puissances, durées et consommations du catalogue : ordres de grandeur génériques QME (13/11/2026), sans source officielle. Remplace-les par la puissance de la plaque signalétique, la consommation de l\'étiquette énergie ou une mesure au wattmètre.',

  categories: [
    { id: 'cuisine', nom: 'Cuisine' },
    { id: 'chauffage', nom: 'Chauffage, climatisation et eau chaude' },
    { id: 'electromenager', nom: 'Électroménager' },
    { id: 'informatique', nom: 'Informatique et réseau' },
    { id: 'audiovisuel', nom: 'Audiovisuel et loisirs' },
    { id: 'eclairage', nom: 'Éclairage' },
    { id: 'autre', nom: 'Autres appareils' },
  ],

  // Modes de calcul de la consommation annuelle.
  modes: [
    { id: 'duree', nom: 'Puissance × durée d\'utilisation' },
    { id: 'cycles', nom: 'Consommation par cycle × nombre de cycles' },
    { id: 'annuel', nom: 'Consommation annuelle de l\'étiquette énergie' },
    { id: 'mesure', nom: 'Mesure au wattmètre (kWh relevés sur une période)' },
  ],

  // Catalogue : mode, puissance (W) en marche, heures par jour, jours par semaine, mois d'usage par an,
  // veille (W) et heures de veille par jour ; kWh par cycle et cycles par semaine ; kWh par an.
  appareils: [
    // Cuisine
    { id: 'bouilloire', nom: 'Bouilloire', cat: 'cuisine', mode: 'duree', puissance: 2000, heures: 0.15, jours: 7 },
    { id: 'cafetiere', nom: 'Cafetière à filtre', cat: 'cuisine', mode: 'duree', puissance: 1000, heures: 0.3, jours: 7 },
    { id: 'expresso', nom: 'Machine à expresso', cat: 'cuisine', mode: 'duree', puissance: 1300, heures: 0.15, jours: 7, veille: 1, veilleH: 23 },
    { id: 'micro-ondes', nom: 'Four à micro-ondes', cat: 'cuisine', mode: 'duree', puissance: 1000, heures: 0.2, jours: 7, veille: 2, veilleH: 23.8 },
    { id: 'four', nom: 'Four électrique', cat: 'cuisine', mode: 'duree', puissance: 2500, heures: 1, jours: 3 },
    { id: 'plaque-induction', nom: 'Plaque de cuisson à induction', cat: 'cuisine', mode: 'duree', puissance: 1500, heures: 1, jours: 7 },
    { id: 'plaque-vitro', nom: 'Plaque de cuisson vitrocéramique', cat: 'cuisine', mode: 'duree', puissance: 1800, heures: 1, jours: 7 },
    { id: 'hotte', nom: 'Hotte aspirante', cat: 'cuisine', mode: 'duree', puissance: 150, heures: 0.7, jours: 7 },
    { id: 'grille-pain', nom: 'Grille-pain', cat: 'cuisine', mode: 'duree', puissance: 900, heures: 0.1, jours: 5 },
    { id: 'robot', nom: 'Robot de cuisine', cat: 'cuisine', mode: 'duree', puissance: 800, heures: 0.3, jours: 2 },
    // Chauffage, climatisation et eau chaude
    { id: 'radiateur', nom: 'Radiateur électrique', cat: 'chauffage', mode: 'duree', puissance: 1500, heures: 6, jours: 7, mois: 5 },
    { id: 'radiateur-appoint', nom: 'Radiateur d\'appoint soufflant', cat: 'chauffage', mode: 'duree', puissance: 2000, heures: 1, jours: 5, mois: 4 },
    { id: 'seche-serviettes', nom: 'Sèche-serviettes', cat: 'chauffage', mode: 'duree', puissance: 500, heures: 2, jours: 7, mois: 6 },
    { id: 'chauffe-eau', nom: 'Chauffe-eau électrique (cumulus)', cat: 'chauffage', mode: 'duree', puissance: 2200, heures: 3, jours: 7 },
    { id: 'clim-mobile', nom: 'Climatiseur mobile', cat: 'chauffage', mode: 'duree', puissance: 1000, heures: 5, jours: 7, mois: 2 },
    { id: 'ventilateur', nom: 'Ventilateur', cat: 'chauffage', mode: 'duree', puissance: 50, heures: 6, jours: 7, mois: 3 },
    { id: 'vmc', nom: 'Ventilation mécanique (VMC)', cat: 'chauffage', mode: 'duree', puissance: 30, heures: 24, jours: 7 },
    // Électroménager
    { id: 'refrigerateur', nom: 'Réfrigérateur', cat: 'electromenager', mode: 'annuel', kwhAn: 180 },
    { id: 'frigo-congel', nom: 'Réfrigérateur-congélateur', cat: 'electromenager', mode: 'annuel', kwhAn: 260 },
    { id: 'congelateur', nom: 'Congélateur', cat: 'electromenager', mode: 'annuel', kwhAn: 230 },
    { id: 'lave-linge', nom: 'Lave-linge', cat: 'electromenager', mode: 'cycles', kwhCycle: 0.8, cycles: 4, veille: 0.5, veilleH: 24 },
    { id: 'seche-linge', nom: 'Sèche-linge', cat: 'electromenager', mode: 'cycles', kwhCycle: 2.5, cycles: 3 },
    { id: 'lave-vaisselle', nom: 'Lave-vaisselle', cat: 'electromenager', mode: 'cycles', kwhCycle: 1, cycles: 4, veille: 0.5, veilleH: 24 },
    { id: 'aspirateur', nom: 'Aspirateur', cat: 'electromenager', mode: 'duree', puissance: 800, heures: 1, jours: 2 },
    { id: 'fer', nom: 'Fer à repasser', cat: 'electromenager', mode: 'duree', puissance: 2000, heures: 1, jours: 1 },
    { id: 'seche-cheveux', nom: 'Sèche-cheveux', cat: 'electromenager', mode: 'duree', puissance: 1800, heures: 0.15, jours: 7 },
    // Informatique et réseau
    { id: 'box', nom: 'Box internet', cat: 'informatique', mode: 'duree', puissance: 12, heures: 24, jours: 7 },
    { id: 'portable', nom: 'Ordinateur portable', cat: 'informatique', mode: 'duree', puissance: 45, heures: 5, jours: 5, veille: 1, veilleH: 19 },
    { id: 'fixe', nom: 'Ordinateur fixe', cat: 'informatique', mode: 'duree', puissance: 150, heures: 4, jours: 5, veille: 3, veilleH: 20 },
    { id: 'ecran', nom: 'Écran d\'ordinateur', cat: 'informatique', mode: 'duree', puissance: 25, heures: 4, jours: 5, veille: 0.5, veilleH: 20 },
    { id: 'imprimante', nom: 'Imprimante', cat: 'informatique', mode: 'duree', puissance: 30, heures: 0.2, jours: 2, veille: 2, veilleH: 23.8 },
    { id: 'chargeur', nom: 'Chargeur de téléphone', cat: 'informatique', mode: 'duree', puissance: 10, heures: 2, jours: 7 },
    { id: 'nas', nom: 'Serveur de stockage réseau', cat: 'informatique', mode: 'duree', puissance: 25, heures: 24, jours: 7 },
    // Audiovisuel et loisirs
    { id: 'tv', nom: 'Téléviseur', cat: 'audiovisuel', mode: 'duree', puissance: 100, heures: 3, jours: 7, veille: 0.5, veilleH: 21 },
    { id: 'decodeur', nom: 'Décodeur TV', cat: 'audiovisuel', mode: 'duree', puissance: 15, heures: 3, jours: 7, veille: 8, veilleH: 21 },
    { id: 'console', nom: 'Console de jeux', cat: 'audiovisuel', mode: 'duree', puissance: 150, heures: 2, jours: 4, veille: 10, veilleH: 22 },
    { id: 'barre-son', nom: 'Barre de son', cat: 'audiovisuel', mode: 'duree', puissance: 30, heures: 3, jours: 7, veille: 2, veilleH: 21 },
    { id: 'enceinte', nom: 'Enceinte connectée', cat: 'audiovisuel', mode: 'duree', puissance: 5, heures: 2, jours: 7, veille: 2, veilleH: 22 },
    // Éclairage
    { id: 'led', nom: 'Ampoule LED', cat: 'eclairage', mode: 'duree', puissance: 8, heures: 4, jours: 7 },
    { id: 'halogene', nom: 'Lampe halogène', cat: 'eclairage', mode: 'duree', puissance: 50, heures: 3, jours: 7 },
    { id: 'lampadaire', nom: 'Lampadaire halogène à variateur', cat: 'eclairage', mode: 'duree', puissance: 300, heures: 3, jours: 7 },
    { id: 'eclairage-ext', nom: 'Éclairage extérieur', cat: 'eclairage', mode: 'duree', puissance: 20, heures: 6, jours: 7 },
    // Autres
    { id: 'pompe-piscine', nom: 'Pompe de filtration de piscine', cat: 'autre', mode: 'duree', puissance: 750, heures: 8, jours: 7, mois: 5 },
    { id: 'aquarium', nom: 'Aquarium (pompe et éclairage)', cat: 'autre', mode: 'duree', puissance: 60, heures: 24, jours: 7 },
    { id: 'velo-electrique', nom: 'Recharge de vélo électrique', cat: 'autre', mode: 'cycles', kwhCycle: 0.5, cycles: 3 },
    { id: 'outillage', nom: 'Outillage électrique', cat: 'autre', mode: 'duree', puissance: 800, heures: 1, jours: 1 },
  ],

  // Actions des scénarios de réduction.
  actions: [
    { id: 'duree', nom: 'Réduire la durée d\'utilisation', aide: 'Pourcentage de réduction de la durée (ou du nombre de cycles).', parametre: 'pourcent' },
    { id: 'veille', nom: 'Supprimer la veille', aide: 'Multiprise à interrupteur, extinction complète.', parametre: null },
    { id: 'hc', nom: 'Programmer en heures creuses', aide: 'Utile seulement avec une option heures pleines / heures creuses.', parametre: null },
    { id: 'retirer', nom: 'Ne plus utiliser l\'appareil', aide: 'L\'appareil sort du calcul.', parametre: null },
    { id: 'remplacer', nom: 'Remplacer par un modèle plus sobre', aide: 'Nouvelle consommation annuelle en kWh (étiquette énergie du nouveau modèle).', parametre: 'kwh' },
  ],

  conseils: [
    ['Ton tarif, pas un tarif type', 'Saisis le prix du kWh et l\'abonnement de ton contrat (facture ou espace client). Rien n\'est fourni d\'office : les tarifs changent.'],
    ['Estimé ou mesuré', 'Les valeurs du catalogue sont des ordres de grandeur. Une étiquette énergie ou une mesure au wattmètre rend le calcul fiable.'],
    ['Les gros postes d\'abord', 'Chauffage, eau chaude et froid pèsent souvent le plus : vérifie-les en priorité.'],
    ['Scénarios', 'Teste une action (veille, durée, heures creuses, remplacement) et vois tout de suite l\'économie annuelle.'],
  ],
};
