// Base intégrée du suivi du bébé : libellés, choix proposés à la saisie, conseils d'usage, sources.
// AUCUNE valeur médicale : pas de quantité de lait, de nombre de repas, de durée de sommeil ni de nombre de
// couches « normal » ; pas de courbe de croissance de référence ni de percentile ; pas de calendrier vaccinal ;
// pas de posologie ; aucune marque (lait, couches). Voir docs/templates/fiches/bebe.md.
window.BASE = {
  version: '2026-11-14',

  // Réglages de départ (modifiables dans les Réglages) : nombre de jours des résumés.
  reglages: { resumeJours: 7 },

  // Contenus proposés pour un biberon (texte libre possible), sans marque.
  contenus: ['Lait maternel', 'Préparation infantile', 'Eau', 'Autre'],

  // Interlocuteurs proposés pour un rendez-vous (texte libre possible).
  interlocuteurs: ['Médecin traitant', 'Pédiatre', 'PMI', 'Sage-femme', 'Autre professionnel'],

  // Durées proposées en un geste pour une tétée notée après coup (minutes). Ce ne sont pas des recommandations.
  durees: [5, 10, 15, 20, 30],

  conseils: [
    ['Une main suffit', 'Sur le téléphone, l\'onglet Aujourd\'hui note une tétée, un biberon, un sommeil ou une couche en un ou deux gestes, même la nuit.'],
    ['Le minuteur tourne sans réseau', 'Démarre une tétée ou un sommeil, ferme l\'application : le temps est compté depuis l\'heure de début, en ligne ou non.'],
    ['À deux, sur deux téléphones', 'Ouvre le suivi avec la même clé sur le téléphone de l\'autre parent : vos saisies se rejoignent.'],
    ['Pour le rendez-vous', 'Le récapitulatif reprend les jours notés, les dernières mesures, tes notes et tes questions. Tu l\'imprimes ou tu le copies.'],
  ],

  // Courbes de croissance : vérification des sources (14/11/2026). Aucune n'est intégrée, faute de licence
  // compatible avec un produit vendu. Les mesures saisies sont tracées seules.
  sources: {
    courbes: 'Aucune courbe de croissance de référence n\'est intégrée. Les normes de croissance de l\'OMS sont publiées sous une licence qui exclut l\'usage commercial sans autorisation (CC BY-NC-SA 3.0 IGO) et les courbes AFPA–Inserm 2018 du carnet de santé n\'indiquent aucune licence de réutilisation. Reporte les mesures sur le carnet de santé de ton enfant : ses courbes y figurent, et le médecin ou la PMI les interprète.',
  },
};
