// Nutrition et dépense énergétique QME · base intégrée (sans logique).
// La base aliments (Ciqual) est dans aliments.js, chargée à la demande.
window.BASE = {
  // Repas de la journée, dans l'ordre d'affichage.
  repas: [
    { id: 'pdj', nom: 'Petit-déjeuner' },
    { id: 'dej', nom: 'Déjeuner' },
    { id: 'din', nom: 'Dîner' },
    { id: 'col', nom: 'Collations' },
  ],

  // Nutriments suivis (valeurs Ciqual pour 100 g, dans cet ordre).
  nutriments: [
    { id: 'kcal', nom: 'Énergie', unite: 'kcal' },
    { id: 'prot', nom: 'Protéines', unite: 'g' },
    { id: 'gluc', nom: 'Glucides', unite: 'g' },
    { id: 'lip', nom: 'Lipides', unite: 'g' },
    { id: 'fib', nom: 'Fibres', unite: 'g' },
    { id: 'suc', nom: 'Sucres', unite: 'g' },
    { id: 'sel', nom: 'Sel', unite: 'g' },
  ],

  // Niveau d'activité HORS séances de sport (les séances sont ajoutées à part).
  // Coefficients d'usage courant, multipliés par le métabolisme de base ; modifiables dans les réglages.
  activites: [
    { id: 'sedentaire', nom: 'Sédentaire', detail: 'Travail assis, peu de marche dans la journée', facteur: 1.2 },
    { id: 'leger', nom: 'Légèrement actif', detail: 'Un peu de marche, travail en partie debout', facteur: 1.375 },
    { id: 'modere', nom: 'Modérément actif', detail: 'Souvent debout ou en mouvement', facteur: 1.55 },
    { id: 'actif', nom: 'Très actif', detail: 'Métier physique, beaucoup de déplacements à pied', facteur: 1.725 },
    { id: 'extreme', nom: 'Extrêmement actif', detail: 'Travail physique intense toute la journée', facteur: 1.9 },
  ],

  // Activités physiques et leur MET, reprises sans modification du 2024 Adult Compendium of
  // Physical Activities (code d'activité du Compendium, valeur MET). Libellés traduits en français.
  sources: {
    met: {
      nom: '2024 Adult Compendium of Physical Activities',
      reference: 'Herrmann SD, Willis EA, Ainsworth BE et al. J Sport Health Sci. 2024;13(1):6-12. doi:10.1016/j.jshs.2023.10.010',
      url: 'https://pacompendium.com/',
      conditions: 'Libre d\'usage, y compris commercial, avec citation du site ou de la publication (pacompendium.com, consulté le 13/11/2026).',
    },
    mifflin: {
      nom: 'Équation de Mifflin-St Jeor',
      reference: 'Mifflin MD, St Jeor ST, Hill LA et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247. doi:10.1093/ajcn/51.2.241',
    },
    has: {
      nom: 'Haute Autorité de santé',
      reference: 'Surpoids et obésité de l\'adulte : prise en charge médicale de premier recours, recommandation de bonne pratique, septembre 2011.',
      citation: 'Les régimes très basses calories (moins de 1 000 kcal par jour) ne sont pas indiqués sauf cas exceptionnels. Ils doivent être supervisés par un médecin spécialisé en nutrition.',
      url: 'https://www.has-sante.fr/jcms/c_964938/fr/surpoids-et-obesite-de-l-adulte-prise-en-charge-medicale-de-premier-recours',
    },
  },
  // Seuil d'alerte sur la cible calorique (HAS 2011, citée ci-dessus).
  seuilTresBasCalories: 1000,

  categoriesSport: [
    { id: 'marche', nom: 'Marche et randonnée' },
    { id: 'course', nom: 'Course à pied' },
    { id: 'velo', nom: 'Vélo' },
    { id: 'salle', nom: 'Salle et renforcement' },
    { id: 'sports', nom: 'Sports' },
    { id: 'eau', nom: 'Activités nautiques' },
    { id: 'maison', nom: 'Maison' },
  ],
  sports: [
    { code: '17170', cat: 'marche', nom: 'Marche, environ 4 km/h, terrain plat', met: 3.0 },
    { code: '17190', cat: 'marche', nom: 'Marche, 4,5 à 5,5 km/h, allure modérée', met: 3.8 },
    { code: '17200', cat: 'marche', nom: 'Marche rapide, 5,6 à 6,3 km/h', met: 4.8 },
    { code: '17220', cat: 'marche', nom: 'Marche très rapide, 6,4 à 7,1 km/h', met: 5.5 },
    { code: '17302', cat: 'marche', nom: 'Marche nordique, 4 à 5,6 km/h', met: 4.3 },
    { code: '17304', cat: 'marche', nom: 'Marche nordique, 5,8 à 7,1 km/h', met: 5.3 },
    { code: '17082', cat: 'marche', nom: 'Randonnée, allure normale, sans charge', met: 5.3 },
    { code: '17012', cat: 'marche', nom: 'Randonnée avec sac à dos léger', met: 7.8 },
    { code: '12010', cat: 'course', nom: 'Alternance marche et footing', met: 6.0 },
    { code: '12020', cat: 'course', nom: 'Footing, allure libre', met: 7.5 },
    { code: '12030', cat: 'course', nom: 'Course, 8 à 8,4 km/h', met: 8.5 },
    { code: '12050', cat: 'course', nom: 'Course, 9,7 à 10,1 km/h', met: 9.3 },
    { code: '12060', cat: 'course', nom: 'Course, 10,8 km/h', met: 10.5 },
    { code: '12070', cat: 'course', nom: 'Course, 11,3 km/h', met: 11.0 },
    { code: '12090', cat: 'course', nom: 'Course, 12,9 km/h', met: 12.0 },
    { code: '12110', cat: 'course', nom: 'Course, 14,5 km/h', met: 13.0 },
    { code: '12120', cat: 'course', nom: 'Course, 16,1 km/h', met: 14.8 },
    { code: '01015', cat: 'velo', nom: 'Vélo, allure facile', met: 4.3 },
    { code: '01016', cat: 'velo', nom: 'Vélo, allure modérée', met: 7.0 },
    { code: '01017', cat: 'velo', nom: 'Vélo, allure soutenue', met: 9.0 },
    { code: '01011', cat: 'velo', nom: 'Vélo pour aller au travail, allure libre', met: 6.8 },
    { code: '01009', cat: 'velo', nom: 'VTT, général', met: 8.5 },
    { code: '01200', cat: 'velo', nom: 'Vélo d\'appartement, général', met: 6.8 },
    { code: '01270', cat: 'velo', nom: 'Vélo en salle, cours collectif', met: 9.0 },
    { code: '02054', cat: 'salle', nom: 'Musculation, plusieurs exercices, 8 à 15 répétitions', met: 3.5 },
    { code: '02052', cat: 'salle', nom: 'Musculation, squats et soulevés de terre', met: 5.0 },
    { code: '02050', cat: 'salle', nom: 'Musculation intense (force, poids libres, machines)', met: 6.0 },
    { code: '02061', cat: 'salle', nom: 'Séance en salle, cours et musculation combinés', met: 5.0 },
    { code: '02035', cat: 'salle', nom: 'Circuit training, effort modéré', met: 5.0 },
    { code: '02040', cat: 'salle', nom: 'Circuit training intense, avec kettlebells', met: 7.5 },
    { code: '02210', cat: 'salle', nom: 'Fractionné à haute intensité, effort modéré', met: 7.0 },
    { code: '02214', cat: 'salle', nom: 'Fractionné à haute intensité, effort vigoureux', met: 11.0 },
    { code: '02022', cat: 'salle', nom: 'Renforcement au poids du corps, effort modéré', met: 3.8 },
    { code: '02020', cat: 'salle', nom: 'Renforcement au poids du corps, effort vigoureux', met: 7.5 },
    { code: '02048', cat: 'salle', nom: 'Vélo elliptique, effort modéré', met: 5.0 },
    { code: '02049', cat: 'salle', nom: 'Vélo elliptique, effort vigoureux', met: 9.0 },
    { code: '02071', cat: 'salle', nom: 'Rameur, moins de 100 W, effort modéré', met: 5.0 },
    { code: '02070', cat: 'salle', nom: 'Rameur, effort vigoureux', met: 7.3 },
    { code: '02068', cat: 'salle', nom: 'Corde à sauter', met: 11.0 },
    { code: '02000', cat: 'salle', nom: 'Aérobic, général', met: 7.3 },
    { code: '02105', cat: 'salle', nom: 'Pilates, général', met: 2.8 },
    { code: '02175', cat: 'salle', nom: 'Yoga, général', met: 2.3 },
    { code: '02160', cat: 'salle', nom: 'Yoga dynamique', met: 4.0 },
    { code: '15610', cat: 'sports', nom: 'Football, loisir', met: 7.0 },
    { code: '15605', cat: 'sports', nom: 'Football, compétition', met: 9.5 },
    { code: '15055', cat: 'sports', nom: 'Basket-ball, général', met: 7.5 },
    { code: '15330', cat: 'sports', nom: 'Handball, en équipe', met: 8.0 },
    { code: '15720', cat: 'sports', nom: 'Volley-ball, loisir', met: 3.0 },
    { code: '15675', cat: 'sports', nom: 'Tennis, effort modéré', met: 6.8 },
    { code: '15685', cat: 'sports', nom: 'Tennis, double', met: 4.5 },
    { code: '15030', cat: 'sports', nom: 'Badminton, loisir', met: 5.5 },
    { code: '15660', cat: 'sports', nom: 'Tennis de table', met: 4.0 },
    { code: '15652', cat: 'sports', nom: 'Squash, général', met: 7.3 },
    { code: '15430', cat: 'sports', nom: 'Arts martiaux, allure modérée', met: 10.3 },
    { code: '15110', cat: 'sports', nom: 'Boxe, sac de frappe', met: 5.8 },
    { code: '15534', cat: 'sports', nom: 'Escalade de bloc', met: 8.8 },
    { code: '15591', cat: 'sports', nom: 'Roller en ligne, 14,4 km/h, loisir', met: 7.5 },
    { code: '15255', cat: 'sports', nom: 'Golf, général', met: 4.5 },
    { code: '03025', cat: 'sports', nom: 'Danse de loisir (salsa, danses du monde…)', met: 4.5 },
    { code: '15670', cat: 'sports', nom: 'Tai-chi, qi gong', met: 3.3 },
    { code: '18240', cat: 'eau', nom: 'Natation, crawl lent, loisir', met: 5.8 },
    { code: '18230', cat: 'eau', nom: 'Natation, crawl rapide', met: 9.8 },
    { code: '18265', cat: 'eau', nom: 'Natation, brasse, loisir', met: 5.3 },
    { code: '18100', cat: 'eau', nom: 'Kayak, effort modéré', met: 5.0 },
    { code: '18224', cat: 'eau', nom: 'Stand up paddle, général', met: 6.5 },
    { code: '05030', cat: 'maison', nom: 'Ménage, effort modéré', met: 3.3 },
    { code: '05043', cat: 'maison', nom: 'Passer l\'aspirateur', met: 3.0 },
    { code: '05056', cat: 'maison', nom: 'Monter des courses à l\'étage', met: 5.3 },
    { code: '05150', cat: 'maison', nom: 'Déménagement, porter des cartons ou meubles', met: 9.0 },
  ],

  // Noms de portions proposés : le poids se renseigne une fois par aliment (étiquette ou pesée).
  nomsPortions: ['1 œuf', '1 tranche', '1 yaourt', '1 verre', '1 bol', '1 cuillère à soupe', '1 cuillère à café', '1 part', '1 pot', '1 fruit', '1 poignée', '1 carré'],

  // Couleurs fixes de la charte, dans l'ordre (repas, graphiques).
  couleurs: [
    { id: 'jaune', nom: 'Jaune', hex: '#F5B400' },
    { id: 'rouge', nom: 'Rouge', hex: '#D9302A' },
    { id: 'bleu', nom: 'Bleu', hex: '#1D4E89' },
    { id: 'encre', nom: 'Encre', hex: '#141414' },
  ],
};
