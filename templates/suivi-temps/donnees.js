// Suivi du temps passé et rentabilité par mission QME · base intégrée (aucune logique).
// Rédaction QME, aucune source externe. Aucun taux, barème ni tarif de marché : le TJM cible, les heures par
// jour et le coût de revient horaire sont saisis par l'utilisateur.
window.BASE = {
  version: '2026-11-14',

  // Catégories de tâches. facturable : valeur par défaut de la case « facturable » à la saisie.
  categories: [
    { id: 'realisation', nom: 'Réalisation', facturable: true, detail: 'Le cœur de la mission : production, développement, conseil.' },
    { id: 'analyse', nom: 'Analyse et conception', facturable: true, detail: 'Cadrage, diagnostic, maquettes, plan.' },
    { id: 'livrables', nom: 'Rédaction et livrables', facturable: true, detail: 'Rapports, documents, supports remis au client.' },
    { id: 'reunion', nom: 'Réunions client', facturable: true, detail: 'Ateliers, points d\'avancement, restitutions.' },
    { id: 'animation', nom: 'Animation de formation', facturable: true, detail: 'Temps en salle ou à distance devant les stagiaires.' },
    { id: 'support', nom: 'Support et corrections', facturable: true, detail: 'Retours, corrections demandées, assistance.' },
    { id: 'deplacement', nom: 'Déplacement facturé', facturable: true, detail: 'Trajet prévu au devis ou refacturé au temps.' },
    { id: 'prospection', nom: 'Prospection', facturable: false, detail: 'Recherche de clients, appels, rendez-vous découverte.' },
    { id: 'avant-vente', nom: 'Devis et avant-vente', facturable: false, detail: 'Chiffrage, proposition, négociation.' },
    { id: 'admin', nom: 'Administratif', facturable: false, detail: 'Courriels, classement, démarches, outils.' },
    { id: 'facturation', nom: 'Facturation et relances', facturable: false, detail: 'Émettre, envoyer, relancer, rapprocher.' },
    { id: 'compta', nom: 'Comptabilité', facturable: false, detail: 'Saisie, justificatifs, échanges avec le comptable.' },
    { id: 'formation', nom: 'Formation personnelle', facturable: false, detail: 'Apprendre un outil, une méthode, une certification.' },
    { id: 'veille', nom: 'Veille', facturable: false, detail: 'Lectures, conférences, tests d\'outils.' },
    { id: 'communication', nom: 'Communication et réseau', facturable: false, detail: 'Publications, site, événements, réseau.' },
    { id: 'trajet', nom: 'Déplacement non facturé', facturable: false, detail: 'Trajet compris dans le prix ou offert.' },
    { id: 'reprise', nom: 'Reprise ou geste commercial', facturable: false, detail: 'Temps offert sur une mission : corrections hors périmètre, garantie.' },
  ],

  // Modèles de missions : mode proposé, unité de budget et tâches types [nom, catégorie].
  modeles: [
    { id: 'conseil', nom: 'Conseil ou audit', mode: 'forfait', unite: 'jour', taches: [['Cadrage et entretiens', 'analyse'], ['Analyse', 'analyse'], ['Rédaction du rapport', 'livrables'], ['Restitution', 'reunion'], ['Suivi après remise', 'support']] },
    { id: 'site', nom: 'Site ou application', mode: 'forfait', unite: 'jour', taches: [['Ateliers et cadrage', 'reunion'], ['Maquettes', 'analyse'], ['Développement', 'realisation'], ['Contenus et intégration', 'realisation'], ['Tests et corrections', 'support'], ['Mise en ligne', 'realisation']] },
    { id: 'formation', nom: 'Formation', mode: 'forfait', unite: 'jour', taches: [['Préparation et supports', 'livrables'], ['Animation', 'animation'], ['Évaluation et bilan', 'livrables'], ['Déplacement', 'deplacement']] },
    { id: 'design', nom: 'Design graphique', mode: 'forfait', unite: 'heure', taches: [['Brief et recherches', 'analyse'], ['Pistes créatives', 'realisation'], ['Déclinaisons', 'realisation'], ['Allers-retours client', 'reunion'], ['Fichiers finaux', 'livrables']] },
    { id: 'redaction', nom: 'Rédaction', mode: 'forfait', unite: 'heure', taches: [['Recherche et interviews', 'analyse'], ['Rédaction', 'livrables'], ['Relecture et corrections', 'support']] },
    { id: 'regie', nom: 'Accompagnement en régie', mode: 'regie', unite: 'jour', taches: [['Production', 'realisation'], ['Réunions', 'reunion'], ['Comptes rendus', 'livrables']] },
    { id: 'libre', nom: 'Mission libre', mode: 'forfait', unite: 'jour', taches: [['Réalisation', 'realisation'], ['Réunions client', 'reunion']] },
  ],

  // Semaines types : heures prévues du lundi au dimanche.
  semaines: [
    { id: 'cinq', nom: '5 jours de 7 h', heures: [7, 7, 7, 7, 7, 0, 0] },
    { id: 'quatre', nom: '4 jours de 8 h', heures: [8, 8, 8, 8, 0, 0, 0] },
    { id: 'partiel', nom: 'Temps partiel (5 × 4 h)', heures: [4, 4, 4, 4, 4, 0, 0] },
    { id: 'libre', nom: 'Libre (à régler)', heures: [6, 6, 6, 6, 6, 0, 0] },
  ],

  // Valeurs par défaut des réglages (modifiables).
  defauts: { heuresJour: 7, seuilVigilance: 80, objectifFacturable: 70, arrondi: 0, derive: 15, chronoLong: 10 },

  // Couleurs des missions, dans cet ordre (jamais générées).
  couleurs: ['#2E5A88', '#B84A34', '#C99A1E', '#2E7D4F', '#7A4E8C', '#24221F', '#B8741A', '#4F7FA8'],

  conseils: [
    ['Saisis au fil de l\'eau', 'Un chronomètre lancé ou une ligne « 1h30 » en fin de tâche : la mémoire du vendredi oublie un quart du temps.'],
    ['Note aussi l\'invisible', 'Devis, relances, comptabilité : ce temps non facturable doit être payé par tes missions.'],
    ['Mets à jour l\'avancement', 'Un pourcentage par semaine suffit pour voir le dépassement venir avant la fin.'],
  ],
};
