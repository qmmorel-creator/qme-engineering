// Base intégrée des inscriptions associatives : activités types, modèle de tranches, modes de paiement,
// rappel RGPD sourcé. Aucun barème officiel : les tranches de quotient familial sont celles de l'association.
window.BASE = {
  couleurs: [
    { id: 'rouge', hex: '#D9302A', nom: 'Rouge' },
    { id: 'bleu', hex: '#1D4E89', nom: 'Bleu' },
    { id: 'jaune', hex: '#F5B400', nom: 'Jaune' },
    { id: 'encre', hex: '#141414', nom: 'Noir' },
    { id: 'vert', hex: '#2E7D4F', nom: 'Vert' },
    { id: 'orange', hex: '#E8702A', nom: 'Orange' },
    { id: 'ciel', hex: '#4A90C2', nom: 'Bleu ciel' },
    { id: 'prune', hex: '#7A3E6B', nom: 'Prune' },
  ],

  jours: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],

  categories: ['Sport', 'Bien-être', 'Culture et arts', 'Accompagnement', 'Loisirs et vie de quartier'],

  // Activités types : intitulés génériques et créneau suggéré (jour 0 = lundi), aucun tarif.
  activites: [
    { nom: 'Judo enfants', categorie: 'Sport', public: '6 à 10 ans', jour: 2, debut: '14:00', fin: '15:00', capacite: 16 },
    { nom: 'Multisport', categorie: 'Sport', public: '4 à 6 ans', jour: 2, debut: '10:00', fin: '11:00', capacite: 12 },
    { nom: 'Badminton loisir', categorie: 'Sport', public: 'Adultes', jour: 3, debut: '19:00', fin: '21:00', capacite: 20 },
    { nom: 'Danse enfants', categorie: 'Sport', public: '7 à 11 ans', jour: 5, debut: '10:00', fin: '11:00', capacite: 15 },
    { nom: 'Gym douce', categorie: 'Bien-être', public: 'Adultes, seniors', jour: 1, debut: '10:00', fin: '11:00', capacite: 15 },
    { nom: 'Yoga', categorie: 'Bien-être', public: 'Adultes', jour: 0, debut: '18:30', fin: '19:45', capacite: 14 },
    { nom: 'Marche active', categorie: 'Bien-être', public: 'Adultes', jour: 4, debut: '09:30', fin: '11:00', capacite: 20 },
    { nom: 'Théâtre ados', categorie: 'Culture et arts', public: '11 à 15 ans', jour: 2, debut: '16:00', fin: '17:30', capacite: 12 },
    { nom: 'Arts plastiques', categorie: 'Culture et arts', public: '6 à 12 ans', jour: 2, debut: '10:00', fin: '11:30', capacite: 10 },
    { nom: 'Guitare', categorie: 'Culture et arts', public: 'À partir de 10 ans', jour: 1, debut: '17:30', fin: '18:30', capacite: 6 },
    { nom: 'Chorale', categorie: 'Culture et arts', public: 'Adultes', jour: 3, debut: '20:00', fin: '21:30', capacite: 30 },
    { nom: 'Aide aux devoirs', categorie: 'Accompagnement', public: 'Primaire', jour: 1, debut: '16:30', fin: '18:00', capacite: 12 },
    { nom: 'Atelier de français', categorie: 'Accompagnement', public: 'Adultes', jour: 3, debut: '14:00', fin: '16:00', capacite: 10 },
    { nom: 'Informatique débutants', categorie: 'Accompagnement', public: 'Adultes', jour: 4, debut: '14:00', fin: '15:30', capacite: 8 },
    { nom: 'Couture', categorie: 'Loisirs et vie de quartier', public: 'Adultes', jour: 0, debut: '14:00', fin: '16:30', capacite: 8 },
    { nom: 'Cuisine du monde', categorie: 'Loisirs et vie de quartier', public: 'Adultes', jour: 4, debut: '18:00', fin: '20:30', capacite: 10 },
    { nom: 'Jeux de société', categorie: 'Loisirs et vie de quartier', public: 'Tout public', jour: 4, debut: '18:00', fin: '20:00', capacite: 24 },
    { nom: 'Jardin partagé', categorie: 'Loisirs et vie de quartier', public: 'Tout public', jour: 5, debut: '09:30', fin: '11:30', capacite: 15 },
  ],

  // Modèles de tranches proposés au premier lancement. L'exemple est FICTIF : à remplacer par la grille
  // votée par l'association (aucun barème officiel n'est fourni).
  modelesTranches: {
    unique: [{ nom: 'Tarif unique', max: null }],
    exemple: [{ nom: 'A', max: 600 }, { nom: 'B', max: 900 }, { nom: 'C', max: 1200 }, { nom: 'D', max: null }],
  },

  modesPaiement: ['Espèces', 'Chèque', 'Virement', 'Carte bancaire', 'Prélèvement', 'Aide ou bon d\'un organisme'],

  liens: ['Mère', 'Père', 'Tuteur ou tutrice', 'Grand-parent', 'Autre'],

  // Rappel RGPD : sources CNIL vérifiées le 13/11/2026 (paraphrase, pas de conseil juridique).
  rgpd: {
    consulte: '13/11/2026',
    conservationDefaut: 3,
    sources: [
      { titre: 'CNIL · Guide de sensibilisation au RGPD pour les associations', url: 'https://www.cnil.fr/sites/cnil/files/atoms/files/cnil-guide_association.pdf' },
      { titre: 'CNIL · Les inscriptions aux activités extrascolaires dans le respect de la vie privée (02/09/2024)', url: 'https://www.cnil.fr/fr/les-inscriptions-aux-activites-extrascolaires-dans-le-respect-de-la-vie-privee' },
    ],
    mentions: [
      'l\'identité et les coordonnées de l\'association',
      'à quoi servent les données (gestion des adhésions, des activités, des paiements)',
      'les réponses obligatoires ou facultatives, et ce qui se passe si elles manquent',
      'les destinataires (par exemple une fédération à laquelle le club est affilié)',
      'la durée de conservation',
      'les droits : accès, rectification, effacement, limitation, et comment les exercer',
      'le droit d\'adresser une plainte à la CNIL',
    ],
  },
};
