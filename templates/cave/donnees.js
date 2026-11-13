// CaveManager · base intégrée (aucune logique ici).
// Règles de garde : ORDRES DE GRANDEUR INDICATIFS par catégorie (années après le millésime), établis par
// QME pour proposer une fenêtre quand l'utilisateur n'en saisit pas. Ils ne valent pas l'avis du
// producteur ni la connaissance d'un millésime : chaque fenêtre est modifiable bouteille par bouteille.
// Aucune donnée externe (prix, cotes, millésimes, avis) n'est récupérée.
window.BASE = {
  version: '2026-11-13',
  avertissement: 'Fenêtres de consommation et conseils de conservation indicatifs : l\'avis du producteur et ta dégustation priment. Aucune cote ni aucun prix ne sont récupérés en ligne. L\'abus d\'alcool est dangereux pour la santé, à consommer avec modération.',

  categories: [
    { id: 'rouge', nom: 'Rouge' }, { id: 'blanc', nom: 'Blanc' }, { id: 'rose', nom: 'Rosé' },
    { id: 'effervescent', nom: 'Effervescent' }, { id: 'liquoreux', nom: 'Moelleux et liquoreux' }, { id: 'mute', nom: 'Vin muté ou doux naturel' }, { id: 'autre', nom: 'Autre' },
  ],
  // Garde indicative (années après le millésime) : à partir de, apogée, jusqu'à.
  garde: {
    rouge: { debut: 3, apogee: 6, fin: 10 },
    blanc: { debut: 1, apogee: 3, fin: 6 },
    rose: { debut: 0, apogee: 1, fin: 2 },
    effervescent: { debut: 1, apogee: 3, fin: 6 },
    liquoreux: { debut: 4, apogee: 10, fin: 25 },
    mute: { debut: 2, apogee: 8, fin: 20 },
    autre: { debut: 0, apogee: 2, fin: 5 },
  },
  formats: [
    { id: '37', nom: 'Demi-bouteille 37,5 cl' }, { id: '75', nom: 'Bouteille 75 cl' }, { id: '150', nom: 'Magnum 1,5 L' }, { id: '300', nom: 'Double magnum 3 L' }, { id: 'autre', nom: 'Autre format' },
  ],
  motifsEntree: [['achat', 'Achat'], ['cadeau', 'Cadeau reçu'], ['inventaire', 'Inventaire initial']],
  motifsSortie: [['consommee', 'Consommée'], ['offerte', 'Offerte'], ['abimee', 'Abîmée ou bouchonnée'], ['vendue', 'Vendue ou échangée']],
  conservation: [
    ['Température', 'Une température stable, autour de 12 °C, compte plus que la valeur exacte : évite les variations.'],
    ['À l\'abri', 'Pénombre, peu de vibrations, pas d\'odeurs fortes à proximité.'],
    ['Couchées', 'Les bouteilles bouchées en liège se gardent couchées pour que le bouchon reste humide.'],
    ['Hygrométrie', 'Une humidité modérée évite que les bouchons sèchent ; trop humide, les étiquettes s\'abîment.'],
  ],
  conseils: [
    ['Le stock suit les mouvements', 'Chaque entrée et chaque sortie est datée : le stock et l\'historique restent justes.'],
    ['Une fenêtre par vin', 'Saisis la fenêtre conseillée par le producteur, ou laisse la règle indicative de sa catégorie la proposer.'],
    ['Quoi ouvrir ?', 'Les vins à boire en priorité remontent d\'eux-mêmes, avec la raison.'],
    ['Où est-elle ?', 'Note l\'emplacement (zone, casier, rangée) : tu retrouves chaque bouteille.'],
  ],
};
