// Base intégrée du garde-manger : lieux de rangement proposés, catégories d'aliments avec leur type de date
// habituel, sources officielles consultées, conseils. Aucune durée de conservation inventée : seules deux durées
// chiffrées sont proposées, reprises mot pour mot d'une page de l'Anses (source et date affichées dans
// l'application). Toutes les autres durées (après ouverture, au congélateur) se saisissent : c'est l'emballage
// qui fait foi. Aucune marque, aucun prix, aucune base produit externe.
window.BASE = {
  version: '2026-11-14',

  // Lieux proposés au premier lancement (renommables, on peut en ajouter). type : frigo, congel, placard, autre.
  lieux: [
    { code: 'frigo', nom: 'Réfrigérateur', type: 'frigo', defaut: true },
    { code: 'congel', nom: 'Congélateur', type: 'congel', defaut: true },
    { code: 'placard', nom: 'Placard', type: 'placard', defaut: true },
    { code: 'garde-manger', nom: 'Garde-manger', type: 'placard', defaut: false },
    { code: 'cave', nom: 'Cave ou cellier', type: 'placard', defaut: false },
    { code: 'congel-2', nom: 'Second congélateur', type: 'congel', defaut: false },
    { code: 'corbeille', nom: 'Corbeille à fruits', type: 'autre', defaut: false },
  ],
  typesLieu: { frigo: 'Réfrigérateur', congel: 'Congélateur', placard: 'Placard, garde-manger', autre: 'Autre' },

  // Catégories : type de date le plus courant sur l'emballage (DLC, DDM ou aucune), simple suggestion à la
  // saisie. Durées en jours, vides sauf valeur sourcée : `sansDate` (produit sans date, compté depuis l'achat),
  // `apresOuverture` et `congel` se saisissent (Rangement). Couleur par index dans `couleurs`.
  categories: [
    { code: 'viande', nom: 'Viande, volaille', date: 'DLC', lieu: 'frigo' },
    { code: 'poisson', nom: 'Poisson, fruits de mer', date: 'DLC', lieu: 'frigo' },
    { code: 'charcuterie', nom: 'Charcuterie', date: 'DLC', lieu: 'frigo' },
    { code: 'laitier', nom: 'Produits laitiers, desserts', date: 'DLC', lieu: 'frigo' },
    { code: 'fromage', nom: 'Fromage', date: 'DLC', lieu: 'frigo' },
    { code: 'oeufs', nom: 'Œufs', date: 'DDM', lieu: 'frigo' },
    { code: 'traiteur', nom: 'Traiteur, plats non préemballés', date: 'aucune', lieu: 'frigo', sansDate: 3, source: 'anses-dlc' },
    { code: 'restes', nom: 'Restes et plats faits maison', date: 'aucune', lieu: 'frigo' },
    { code: 'fruits', nom: 'Fruits et légumes', date: 'aucune', lieu: 'corbeille' },
    { code: 'surgeles', nom: 'Surgelés', date: 'DDM', lieu: 'congel' },
    { code: 'feculents', nom: 'Pâtes, riz, céréales', date: 'DDM', lieu: 'placard' },
    { code: 'conserves', nom: 'Conserves, bocaux', date: 'DDM', lieu: 'placard' },
    { code: 'epicerie', nom: 'Épicerie sucrée, biscuits', date: 'DDM', lieu: 'placard' },
    { code: 'condiments', nom: 'Sauces, condiments, huiles', date: 'DDM', lieu: 'placard' },
    { code: 'boissons', nom: 'Boissons', date: 'DDM', lieu: 'placard' },
    { code: 'bebe', nom: 'Petits pots, lait infantile', date: 'DDM', lieu: 'placard' },
  ],

  // Couleurs des catégories, dans cet ordre, jamais générées (fond teinté, texte foncé lisible).
  couleurs: [
    { fond: '#F8DCD3', bord: '#B84A34', texte: '#8A3322' },
    { fond: '#D8E4F0', bord: '#2E5A88', texte: '#22476E' },
    { fond: '#F6E0EC', bord: '#A04A78', texte: '#7A2F58' },
    { fond: '#FBEBC2', bord: '#B8901F', texte: '#6E5310' },
    { fond: '#F3EDE3', bord: '#6E685F', texte: '#45413A' },
    { fond: '#DCEBDD', bord: '#2E7D4F', texte: '#1F5A36' },
    { fond: '#E6DDF0', bord: '#6A4C93', texte: '#4A3270' },
    { fond: '#D5ECEC', bord: '#2F7A7A', texte: '#1F5656' },
  ],

  // Unités proposées (texte libre accepté).
  unites: ['', 'pièce', 'paquet', 'boîte', 'bocal', 'barquette', 'bouteille', 'pot', 'sachet', 'g', 'kg', 'cl', 'L', 'portion', 'tranche'],

  motifsJete: [
    ['perime', 'Date dépassée'],
    ['abime', 'Abîmé, moisi, odeur'],
    ['oublie', 'Oublié au fond'],
    ['trop', 'Trop acheté, trop cuisiné'],
    ['gout', 'Pas aimé'],
    ['autre', 'Autre'],
  ],

  // Sources consultées, affichées dans l'application avec leur date. Une seule source chiffrée est utilisée.
  sources: [
    {
      id: 'anses-dlc',
      organisme: 'Anses',
      titre: 'Date limite de consommation (DLC) et date de durabilité minimale (DDM)',
      url: 'https://www.anses.fr/fr/article/date-limite-consommation-dlc-date-durabilite-minimale-ddm',
      publiee: '2021-01-04',
      consultee: '2026-11-14',
      // Extraits utilisés (citations de la page).
      points: [
        '« À consommer avant le » ou « à consommer jusqu\'au » : date limite de consommation. Ces produits ne doivent pas être consommés après la date limite indiquée.',
        '« À consommer de préférence avant le » : date de durabilité minimale. Consommer le produit après sa DDM ne constitue pas un risque pour la santé ; il peut perdre certaines qualités gustatives ou nutritionnelles.',
        'La date limite de consommation d\'un produit n\'est plus valable lorsque celui-ci est ouvert : suivre les indications du fabricant (« à consommer dans les x jours après ouverture »).',
        'Traiteur, plats cuisinés, pâtisseries à la crème non préemballés, sans date : demander conseil au commerçant ; en règle générale, les consommer sous 3 jours.',
        'Aliments décongelés : les consommer rapidement (pas plus de trois jours) et ne pas les recongeler.',
        'Mieux vaut congeler dès l\'achat ou la préparation, pas en fin de DLC. Un emballage gonflé, l\'absence de « pop » à l\'ouverture d\'un bocal, une odeur désagréable ou une couleur anormale : jeter le produit.',
      ],
    },
    {
      id: 'anses-hygiene',
      organisme: 'Anses',
      titre: 'En cuisine, le meilleur ingrédient, c\'est l\'hygiène !',
      url: 'https://www.anses.fr/fr/content/en-cuisine-le-meilleur-ingredient-c-est-l-hygiene',
      publiee: '2026-05-11',
      consultee: '2026-11-14',
      points: [
        'Réfrigérateur entre 0 et +4 °C ; plats mis au réfrigérateur dès qu\'ils ne sont plus chauds, sans dépasser deux heures d\'attente.',
      ],
    },
  ],

  // Durées chiffrées proposées par défaut : uniquement celles de la source ci-dessus.
  dureeDecongele: 3, // jours, Anses (« pas plus de trois jours »)

  conseils: [
    ['Range par lieu', 'Réfrigérateur, congélateur, placard : chaque produit a sa place, sa quantité et sa date.'],
    ['Note le bon type de date', '« À consommer jusqu\'au » (DLC) : au-delà, on ne mange pas. « De préférence avant » (DDM) : au-delà, on vérifie l\'aspect et l\'odeur.'],
    ['Note l\'ouverture', 'Une fois ouvert, c\'est le délai indiqué sur l\'emballage qui compte (« à consommer sous x jours après ouverture »).'],
    ['Commence par la liste « À consommer »', 'Ce qui est dépassé, ce qui expire aujourd\'hui, dans 3 jours, cette semaine : de quoi décider des repas.'],
  ],
};
