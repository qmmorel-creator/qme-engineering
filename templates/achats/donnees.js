// Base intégrée des demandes d'achat et fournitures : catalogue de fournitures types (sans prix ni marque),
// unités, services proposés, motifs, niveaux d'urgence, réglages par défaut, couleurs fixes.
// Contenu original rédigé pour QME. Aucune donnée réglementaire, aucun prix, aucun tarif : les prix sont saisis
// par l'utilisateur (prix habituel d'un article, prix estimé d'une demande, prix réel à la réception).
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Catégories du catalogue, dans l'ordre d'affichage. Couleur : indice dans `couleurs`.
    categories: [
      { id: 'bureau', nom: 'Fournitures de bureau', couleur: 0 },
      { id: 'papier', nom: 'Papier et impression', couleur: 1 },
      { id: 'entretien', nom: 'Entretien et hygiène', couleur: 2 },
      { id: 'cuisine', nom: 'Café et cuisine', couleur: 3 },
      { id: 'informatique', nom: 'Informatique courante', couleur: 4 },
      { id: 'equipement', nom: 'Petit équipement', couleur: 5 },
      { id: 'autre', nom: 'Autre', couleur: 6 },
    ],

    unites: ['pièce', 'boîte', 'paquet', 'lot', 'ramette', 'carton', 'pack', 'rouleau', 'flacon', 'bidon', 'sachet', 'kg', 'litre'],

    // Catalogue de départ : [catégorie, nom, unité]. Aucun prix, aucune marque, aucune référence fournisseur.
    articles: [
      ['bureau', 'Stylos à bille bleus', 'boîte'], ['bureau', 'Stylos à bille noirs', 'boîte'], ['bureau', 'Stylos à bille rouges', 'boîte'],
      ['bureau', 'Surligneurs (assortiment)', 'paquet'], ['bureau', 'Crayons à papier', 'boîte'], ['bureau', 'Gommes', 'paquet'],
      ['bureau', 'Taille-crayons', 'pièce'], ['bureau', 'Correcteurs en ruban', 'paquet'], ['bureau', 'Marqueurs pour tableau blanc', 'paquet'],
      ['bureau', 'Feutres pour paperboard', 'paquet'], ['bureau', 'Brosse pour tableau blanc', 'pièce'], ['bureau', 'Blocs-notes A4', 'paquet'],
      ['bureau', 'Blocs-notes A5', 'paquet'], ['bureau', 'Cahiers grand format', 'paquet'], ['bureau', 'Notes repositionnables', 'paquet'],
      ['bureau', 'Agrafeuse', 'pièce'], ['bureau', 'Agrafes', 'boîte'], ['bureau', 'Trombones', 'boîte'], ['bureau', 'Pinces à dessin', 'boîte'],
      ['bureau', 'Ciseaux', 'pièce'], ['bureau', 'Règle de 30 cm', 'pièce'], ['bureau', 'Ruban adhésif', 'lot'], ['bureau', 'Dévidoir de ruban adhésif', 'pièce'],
      ['bureau', 'Colle en bâton', 'lot'], ['bureau', 'Enveloppes DL', 'boîte'], ['bureau', 'Enveloppes C5', 'boîte'], ['bureau', 'Enveloppes C4', 'boîte'],
      ['bureau', 'Étiquettes adhésives (planches A4)', 'boîte'], ['bureau', 'Chemises cartonnées', 'paquet'], ['bureau', 'Sous-chemises', 'paquet'],
      ['bureau', 'Pochettes perforées transparentes', 'boîte'], ['bureau', 'Classeurs à levier', 'pièce'], ['bureau', 'Intercalaires', 'paquet'],
      ['bureau', 'Parapheur', 'pièce'], ['bureau', 'Calculatrice de bureau', 'pièce'], ['bureau', 'Perforatrice', 'pièce'], ['bureau', 'Bannettes de rangement', 'pièce'],
      ['papier', 'Ramette de papier A4 80 g', 'ramette'], ['papier', 'Ramette de papier A3 80 g', 'ramette'], ['papier', 'Papier couleur A4', 'ramette'],
      ['papier', 'Papier épais A4 (160 g et plus)', 'ramette'], ['papier', 'Cartouche d\'encre noire (selon modèle d\'imprimante)', 'pièce'],
      ['papier', 'Cartouches d\'encre couleur (selon modèle)', 'lot'], ['papier', 'Toner noir (selon modèle)', 'pièce'], ['papier', 'Toners couleur (selon modèle)', 'lot'],
      ['papier', 'Pochettes de plastification', 'boîte'], ['papier', 'Rouleaux pour étiqueteuse', 'pièce'],
      ['entretien', 'Essuie-mains en papier', 'carton'], ['entretien', 'Papier toilette', 'carton'], ['entretien', 'Savon pour les mains (recharge)', 'flacon'],
      ['entretien', 'Gel hydroalcoolique', 'flacon'], ['entretien', 'Sacs-poubelle 30 L', 'rouleau'], ['entretien', 'Sacs-poubelle 100 L', 'rouleau'],
      ['entretien', 'Liquide vaisselle', 'flacon'], ['entretien', 'Éponges', 'paquet'], ['entretien', 'Lavettes microfibre', 'paquet'],
      ['entretien', 'Nettoyant multi-usage', 'flacon'], ['entretien', 'Nettoyant pour vitres', 'flacon'], ['entretien', 'Désinfectant pour surfaces', 'flacon'],
      ['entretien', 'Lingettes pour écrans', 'paquet'], ['entretien', 'Tablettes pour lave-vaisselle', 'boîte'], ['entretien', 'Gants de ménage', 'paquet'],
      ['entretien', 'Serpillières', 'paquet'],
      ['cuisine', 'Café en grains', 'kg'], ['cuisine', 'Café moulu', 'paquet'], ['cuisine', 'Capsules ou dosettes de café (selon machine)', 'boîte'],
      ['cuisine', 'Thé (assortiment)', 'boîte'], ['cuisine', 'Infusions', 'boîte'], ['cuisine', 'Sucre en morceaux', 'boîte'], ['cuisine', 'Sucre en bûchettes', 'boîte'],
      ['cuisine', 'Lait demi-écrémé (briques)', 'pack'], ['cuisine', 'Gobelets en carton', 'paquet'], ['cuisine', 'Bâtonnets en bois', 'boîte'],
      ['cuisine', 'Serviettes en papier', 'paquet'], ['cuisine', 'Eau en bouteille', 'pack'], ['cuisine', 'Biscuits pour les réunions', 'paquet'],
      ['cuisine', 'Filtres à café', 'boîte'], ['cuisine', 'Détartrant pour machine à café', 'flacon'], ['cuisine', 'Assiettes et couverts compostables', 'lot'],
      ['informatique', 'Souris filaire', 'pièce'], ['informatique', 'Souris sans fil', 'pièce'], ['informatique', 'Clavier', 'pièce'], ['informatique', 'Tapis de souris', 'pièce'],
      ['informatique', 'Câble HDMI', 'pièce'], ['informatique', 'Câble USB-C', 'pièce'], ['informatique', 'Adaptateur USB-C vers HDMI', 'pièce'],
      ['informatique', 'Chargeur d\'ordinateur portable (selon modèle)', 'pièce'], ['informatique', 'Clé USB', 'pièce'], ['informatique', 'Disque dur externe', 'pièce'],
      ['informatique', 'Casque avec micro', 'pièce'], ['informatique', 'Webcam', 'pièce'], ['informatique', 'Multiprise avec parafoudre', 'pièce'],
      ['informatique', 'Rallonge électrique', 'pièce'], ['informatique', 'Piles AA', 'paquet'], ['informatique', 'Piles AAA', 'paquet'],
      ['informatique', 'Support pour ordinateur portable', 'pièce'],
      ['equipement', 'Boîtes d\'archives', 'paquet'], ['equipement', 'Ampoules LED', 'paquet'], ['equipement', 'Lampe de bureau', 'pièce'],
      ['equipement', 'Repose-pieds', 'pièce'], ['equipement', 'Corbeille à papier', 'pièce'], ['equipement', 'Bacs de tri sélectif', 'pièce'],
      ['equipement', 'Recharge de trousse de premiers secours', 'lot'], ['equipement', 'Porte-documents mural', 'pièce'],
    ],

    services: ['Direction', 'Administration et finances', 'Commercial', 'Production', 'Accueil et services généraux', 'Informatique'],

    urgences: [
      { id: 'normale', nom: 'Normale', aide: 'Avec la prochaine commande groupée.' },
      { id: 'urgente', nom: 'Urgente', aide: 'À commander rapidement, sans attendre la commande groupée.' },
      { id: 'bloquante', nom: 'Bloquante', aide: 'Le travail est arrêté sans cet article.' },
    ],

    motifs: ['Réassort habituel', 'Stock épuisé', 'Nouvel arrivant', 'Remplacement d\'un matériel défectueux', 'Réunion ou événement', 'Projet client'],
    motifsRefus: ['Stock encore disponible', 'Budget du service épuisé', 'Hors catalogue : à justifier', 'Doublon d\'une autre demande', 'À regrouper avec la prochaine commande'],

    reglages: {
      seuil: 100,            // montant estimé (€) jusqu'auquel une demande est validée automatiquement ; null = toujours valider
      debutExercice: 1,      // mois de début de l'exercice budgétaire (1 = janvier)
      relance: 3,            // jours d'attente avant de signaler une demande à valider
      taxe: 'HT',            // les montants saisis sont HT ou TTC (simple libellé, aucun calcul de TVA)
    },

    // Couleurs des catégories et des services, dans cet ordre (jamais générées). Palette catégorielle validée
    // (lumière, chroma, daltonisme) ; toujours accompagnée du libellé, jamais seule porteuse de l'information.
    couleurs: ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#6250D6', '#E34948'],

    conseils: [
      ['Une clé pour toute l\'équipe', 'Partage la clé de licence avec les personnes qui demandent et celles qui valident : chacune la saisit une fois sur son appareil, et tout le monde voit les mêmes demandes.'],
      ['Ton nom à chaque demande', 'Pas de compte à créer : chacun saisit son nom (un prénom suffit). Il est retenu sur ton appareil pour la fois suivante.'],
      ['Un seuil pour aller vite', 'Sous le seuil que tu fixes, une demande dont le prix est estimé et qui tient dans le budget du service est validée tout de suite. Au-dessus, quelqu\'un valide.'],
      ['Commandes groupées', 'Les demandes validées se regroupent par fournisseur en un bon de commande imprimable. La réception, même partielle, met le budget à jour.'],
    ],
  };
})();
