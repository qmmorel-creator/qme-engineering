// FêteBudget · base intégrée (aucune logique ici).
// Quantités : ESTIMATIONS INDICATIVES établies par QME pour une première liste, ajustables ligne par
// ligne. Ce ne sont pas des prescriptions : appétits, chaleur, âge des invités et menu les font varier.
// Aucun prix fourni : chaque utilisateur saisit ses prix.
window.BASE = {
  version: '2026-11-13',
  sourceQuantites: 'Quantités indicatives établies par QME (13/11/2026) pour démarrer une liste : à ajuster selon tes invités, ton menu et la saison. Boissons alcoolisées : avec modération, à adapter ou à mettre à zéro.',

  types: [
    { id: 'anniv-adulte', nom: 'Anniversaire (adultes)', formule: 'dinatoire', duree: 5 },
    { id: 'anniv-enfant', nom: 'Anniversaire d\'enfant', formule: 'gouter', duree: 3 },
    { id: 'soiree', nom: 'Soirée entre amis', formule: 'dinatoire', duree: 5 },
    { id: 'barbecue', nom: 'Barbecue', formule: 'barbecue', duree: 4 },
    { id: 'repas-famille', nom: 'Repas de famille', formule: 'repas', duree: 4 },
    { id: 'pot', nom: 'Pot ou apéritif', formule: 'apero', duree: 2 },
    { id: 'autre', nom: 'Autre événement', formule: 'buffet', duree: 4 },
  ],
  formules: [
    { id: 'apero', nom: 'Apéritif' }, { id: 'dinatoire', nom: 'Apéritif dînatoire' }, { id: 'buffet', nom: 'Buffet' },
    { id: 'repas', nom: 'Repas assis' }, { id: 'barbecue', nom: 'Barbecue' }, { id: 'gouter', nom: 'Goûter' },
  ],
  categories: [
    { id: 'lieu', nom: 'Lieu' }, { id: 'decoration', nom: 'Décoration' }, { id: 'repas', nom: 'Repas' }, { id: 'boissons', nom: 'Boissons' },
    { id: 'materiel', nom: 'Matériel et vaisselle' }, { id: 'animations', nom: 'Animations' }, { id: 'transport', nom: 'Transport' }, { id: 'divers', nom: 'Divers' },
  ],

  // Besoins : quantité par adulte selon la formule (0 = sans objet), coefficient enfant,
  // « parHeure » : multiplié par la durée ; conditionnement pour la liste de courses.
  besoins: [
    { id: 'aperitifs', nom: 'Pièces apéritives salées', categorie: 'repas', unite: 'pièce', q: { apero: 6, dinatoire: 15, buffet: 5, repas: 4, barbecue: 4, gouter: 0 }, enfant: 0.5 },
    { id: 'sucres', nom: 'Pièces sucrées ou mignardises', categorie: 'repas', unite: 'pièce', q: { apero: 0, dinatoire: 4, buffet: 2, repas: 0, barbecue: 0, gouter: 3 }, enfant: 1 },
    { id: 'plat', nom: 'Plat principal', categorie: 'repas', unite: 'portion', q: { apero: 0, dinatoire: 0, buffet: 1, repas: 1, barbecue: 0, gouter: 0 }, enfant: 0.6 },
    { id: 'grillades', nom: 'Viandes ou grillades', categorie: 'repas', unite: 'g', q: { apero: 0, dinatoire: 0, buffet: 0, repas: 0, barbecue: 250, gouter: 0 }, enfant: 0.5, cond: 1000, uc: 'kg' },
    { id: 'accompagnements', nom: 'Salades et accompagnements', categorie: 'repas', unite: 'g', q: { apero: 0, dinatoire: 100, buffet: 200, repas: 150, barbecue: 200, gouter: 0 }, enfant: 0.6, cond: 1000, uc: 'kg' },
    { id: 'pain', nom: 'Pain', categorie: 'repas', unite: 'g', q: { apero: 0, dinatoire: 60, buffet: 100, repas: 100, barbecue: 100, gouter: 0 }, enfant: 0.5, cond: 250, uc: 'baguette de 250 g' },
    { id: 'fromage', nom: 'Fromage', categorie: 'repas', unite: 'g', q: { apero: 0, dinatoire: 40, buffet: 50, repas: 60, barbecue: 0, gouter: 0 }, enfant: 0.3 },
    { id: 'dessert', nom: 'Dessert ou gâteau', categorie: 'repas', unite: 'part', q: { apero: 0, dinatoire: 1, buffet: 1, repas: 1, barbecue: 1, gouter: 1 }, enfant: 1 },
    { id: 'bonbons', nom: 'Bonbons et friandises', categorie: 'repas', unite: 'g', q: { apero: 0, dinatoire: 0, buffet: 0, repas: 0, barbecue: 0, gouter: 0 }, enfant: 80, enfantSeul: true },
    { id: 'eau', nom: 'Eau', categorie: 'boissons', unite: 'L', parHeure: true, q: { apero: 0.2, dinatoire: 0.25, buffet: 0.25, repas: 0.2, barbecue: 0.3, gouter: 0.15 }, enfant: 1, cond: 1.5, uc: 'bouteille de 1,5 L' },
    { id: 'soft', nom: 'Boissons sans alcool (jus, sodas)', categorie: 'boissons', unite: 'L', parHeure: true, q: { apero: 0.15, dinatoire: 0.15, buffet: 0.1, repas: 0.1, barbecue: 0.15, gouter: 0.15 }, enfant: 1.5, cond: 1.5, uc: 'bouteille de 1,5 L' },
    { id: 'vin', nom: 'Vin (adultes, avec modération)', categorie: 'boissons', unite: 'L', q: { apero: 0, dinatoire: 0.25, buffet: 0.25, repas: 0.25, barbecue: 0.25, gouter: 0 }, enfant: 0, cond: 0.75, uc: 'bouteille de 75 cl' },
    { id: 'cafe', nom: 'Café ou thé', categorie: 'boissons', unite: 'tasse', q: { apero: 0, dinatoire: 0.5, buffet: 1, repas: 1, barbecue: 1, gouter: 0.5 }, enfant: 0 },
    { id: 'glacons', nom: 'Glaçons', categorie: 'boissons', unite: 'kg', q: { apero: 0.2, dinatoire: 0.3, buffet: 0.3, repas: 0.2, barbecue: 0.4, gouter: 0.1 }, enfant: 1, cond: 2, uc: 'sac de 2 kg' },
    { id: 'assiettes', nom: 'Assiettes', categorie: 'materiel', unite: 'u', q: { apero: 1, dinatoire: 2, buffet: 2, repas: 3, barbecue: 2, gouter: 2 }, enfant: 1, cond: 25, uc: 'paquet de 25' },
    { id: 'verres', nom: 'Verres ou gobelets', categorie: 'materiel', unite: 'u', q: { apero: 2, dinatoire: 3, buffet: 3, repas: 3, barbecue: 3, gouter: 2 }, enfant: 1, cond: 25, uc: 'paquet de 25' },
    { id: 'serviettes', nom: 'Serviettes', categorie: 'materiel', unite: 'u', q: { apero: 2, dinatoire: 3, buffet: 3, repas: 2, barbecue: 3, gouter: 3 }, enfant: 1, cond: 50, uc: 'paquet de 50' },
  ],

  // Liste de préparation : décalage en jours par rapport au jour J (négatif = avant).
  preparation: [
    [-45, 'Fixer la date, le budget et la liste des invités'],
    [-30, 'Réserver le lieu et le matériel à louer'],
    [-21, 'Envoyer les invitations'],
    [-14, 'Commander le gâteau ou le traiteur'],
    [-14, 'Prévoir les animations'],
    [-7, 'Relancer les invités sans réponse et arrêter le nombre'],
    [-5, 'Faire les courses non périssables'],
    [-2, 'Faire les courses fraîches'],
    [-1, 'Préparer la salle, la décoration et la vaisselle'],
    [0, 'Sortir les boissons au frais et les glaçons'],
    [1, 'Ranger, rendre le matériel loué'],
    [3, 'Saisir les dépenses réelles et équilibrer les comptes'],
  ],

  conseils: [
    ['Budget d\'abord', 'Fixe un budget global ou par personne : chaque dépense prévue montre ce qu\'il reste.'],
    ['Estimer, puis ajuster', 'Les quantités de repas et de boissons sont des estimations : modifie-les selon tes invités.'],
    ['Comparer', 'Crée deux scénarios (traiteur ou fait maison, salle louée ou jardin) et compare les totaux.'],
    ['Partager', 'Si plusieurs personnes paient, la répartition calcule qui rembourse qui, en un minimum de virements.'],
  ],
};
