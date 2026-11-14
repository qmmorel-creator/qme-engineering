// Base intégrée de Stocks et inventaire : unités, catégories proposées par type d'activité, types de
// mouvements, motifs de perte, conseils et repères. Contenu original rédigé pour QME, aucune logique ici.
// Aucun prix ni fournisseur réel : l'utilisateur saisit ses propres articles et ses propres prix.
(() => {
  window.BASE = {
    version: '2026-11-14',

    reglages: {
      methode: 'cmup',      // valorisation affichée : 'cmup' (coût moyen unitaire pondéré) ou 'dernier' (dernier prix d'achat)
      joursDormant: 90,     // sans vente depuis ce nombre de jours (et en stock) : article dormant
      joursRotation: 90,    // période d'analyse de la rotation et de la couverture
      joursVentes: 30,      // période des ventes théoriques du tableau de bord
    },

    unites: ['pièce', 'lot', 'boîte', 'carton', 'paire', 'sachet', 'rouleau', 'kg', 'g', 'L', 'mL', 'm', 'm²'],

    // Catégories proposées au premier lancement (modifiables ensuite dans les Réglages).
    activites: [
      { id: 'boutique', nom: 'Boutique, commerce de détail', categories: ['Produits phares', 'Accessoires', 'Saisonnier', 'Revente', 'Emballages', 'Consommables'] },
      { id: 'atelier', nom: 'Atelier, artisan, fabrication', categories: ['Matières premières', 'Composants', 'Produits finis', 'Emballages', 'Consommables', 'Revente'] },
      { id: 'ecommerce', nom: 'Vente en ligne', categories: ['Produits', 'Lots et coffrets', 'Emballages d\'expédition', 'Échantillons', 'Consommables'] },
      { id: 'service', nom: 'Prestataire avec pièces (dépannage, réparation)', categories: ['Pièces détachées', 'Fournitures', 'Outillage consommable', 'Produits revendus'] },
      { id: 'autre', nom: 'Autre activité', categories: ['Général', 'Emballages', 'Consommables'] },
    ],

    // Couleurs des catégories, dans l'ordre (jamais générées).
    couleurs: ['#2E5A88', '#E8B93A', '#B84A34', '#6E685F', '#22476E', '#8A6A12', '#8A3322', '#514C44'],

    // Types de mouvements. sens : +1 entre en stock, -1 sort, 0 : quantité signée (ajustement).
    mouvements: [
      { id: 'entree', nom: 'Entrée', detail: 'Achat, réception fournisseur, production', sens: 1 },
      { id: 'sortie', nom: 'Sortie', detail: 'Vente, consommation en atelier', sens: -1 },
      { id: 'perte', nom: 'Perte', detail: 'Casse, péremption, vol, défaut', sens: -1 },
      { id: 'retourClient', nom: 'Retour client', detail: 'Article revenu en stock, remis au coût moyen', sens: 1 },
      { id: 'retourFournisseur', nom: 'Retour fournisseur', detail: 'Article renvoyé au fournisseur', sens: -1 },
      { id: 'ajustement', nom: 'Ajustement', detail: 'Correction après comptage (+ ou −)', sens: 0 },
    ],

    motifsPerte: ['Casse', 'Péremption', 'Vol ou démarque inconnue', 'Défaut', 'Usage interne', 'Échantillon offert'],

    conseils: [
      ['Un article, une référence', 'Une référence courte et unique par article (ex. : POT-200) : elle sert au comptage et aux exports.'],
      ['Tout passe par un mouvement', 'Le stock n\'est jamais saisi à la main : il se calcule à partir des entrées, sorties, pertes, retours et ajustements datés.'],
      ['Un seuil réaliste', 'Le seuil d\'alerte couvre le délai de réapprovisionnement : ventes d\'une semaine si ton fournisseur livre en une semaine.'],
      ['Compter un peu, souvent', 'L\'inventaire tournant (une catégorie ou un rayon à la fois) repère les écarts tôt, sans fermer la boutique.'],
    ],

    reperes: [
      ['Coût moyen unitaire pondéré (CMUP)', 'Recalculé à chaque entrée : (stock × coût moyen + quantité reçue × prix d\'achat) ÷ nouveau stock. Les sorties, pertes et retours clients se font au coût moyen du moment, sans le changer.'],
      ['Dernier prix d\'achat', 'Valorisation au prix de la dernière entrée : simple et proche du coût de remplacement, mais elle peut s\'écarter du coût réel du stock quand les prix changent.'],
      ['Premier entré, premier sorti (PEPS)', 'Autre méthode admise pour les biens interchangeables : elle n\'est pas calculée ici.'],
      ['Inventaire annuel', 'Un commerçant contrôle par inventaire, au moins une fois tous les douze mois, l\'existence et la valeur de son patrimoine (Code de commerce, art. L123-12 : à vérifier). Le comptage est un point de départ : la valorisation retenue à la clôture relève de ton expert-comptable.'],
      ['Prix hors taxes', 'Prix d\'achat et prix de vente se saisissent hors taxes : la marge théorique se compare au prix de vente HT.'],
    ],
  };
})();
