// Base intégrée du suivi d'habitudes : couleurs fixes, thèmes, habitudes types, routines types.
// Contenu original rédigé pour QME. Les réglages chiffrés (verres d'eau, heures de sommeil, minutes de
// marche…) sont des valeurs indicatives, modifiables ; leurs sources sont citées dans `sources` (à vérifier).
// Jours : 0 = lundi … 6 = dimanche. Une habitude « case » se coche ; une habitude « nombre » se compte,
// réussie si la valeur est au moins `min` (si défini) et au plus `max` (si défini) ; `pas` = bouton + / −.
(() => {
  const TOUS = [0, 1, 2, 3, 4, 5, 6];
  const SEM = [0, 1, 2, 3, 4];
  const c = (theme, id, nom, extra = {}) => ({ id, theme, nom, type: 'case', jours: TOUS, ...extra });
  const n = (theme, id, nom, unite, { min = null, max = null, pas = 1, jours = TOUS, ...extra } = {}) => ({ id, theme, nom, type: 'nombre', unite, min, max, pas, jours, ...extra });

  window.BASE = {
    // Une couleur par thème, dans cet ordre (jamais générée). Palette validée (contraste, daltonisme)
    // avec le validateur du skill dataviz ; le jaune, peu contrasté, est toujours accompagné d'un texte.
    couleurs: [
      { id: 'bleu', hex: '#2B5DA3', nom: 'Bleu', texte: '#fff', teinte: '#D8E4F0' },
      { id: 'rouge', hex: '#B84A34', nom: 'Brique', texte: '#fff', teinte: '#F8DCD3' },
      { id: 'jaune', hex: '#C99A1E', nom: 'Moutarde', texte: '#24221F', teinte: '#FBEBC2' },
      { id: 'vert', hex: '#2E7D4F', nom: 'Vert', texte: '#fff', teinte: '#D7EBDD' },
      { id: 'prune', hex: '#7A3E6B', nom: 'Prune', texte: '#fff', teinte: '#EBDBE6' },
      { id: 'ciel', hex: '#4A90C2', nom: 'Bleu ciel', texte: '#24221F', teinte: '#DCEBF5' },
      { id: 'orange', hex: '#D5732F', nom: 'Orange', texte: '#24221F', teinte: '#F9E0CC' },
      { id: 'framboise', hex: '#A23E6E', nom: 'Framboise', texte: '#fff', teinte: '#F1D8E3' },
    ],

    // Thèmes types. mode « independant » : chaque habitude se coche seule.
    // mode « unique » : une seule habitude du thème par jour (un choix parmi plusieurs).
    themes: [
      { id: 'sommeil', nom: 'Sommeil', couleur: 'bleu', mode: 'independant' },
      { id: 'sport', nom: 'Sport et mouvement', couleur: 'rouge', mode: 'independant' },
      { id: 'travail', nom: 'Travail et apprentissage', couleur: 'jaune', mode: 'independant' },
      { id: 'alimentation', nom: 'Alimentation et hydratation', couleur: 'vert', mode: 'independant' },
      { id: 'esprit', nom: 'Esprit et relations', couleur: 'prune', mode: 'independant' },
      { id: 'lieu', nom: 'Lieu de travail', couleur: 'ciel', mode: 'unique' },
      { id: 'maison', nom: 'Maison et argent', couleur: 'orange', mode: 'independant' },
      { id: 'soins', nom: 'Soins et traitements', couleur: 'framboise', mode: 'independant' },
    ],

    // 50 habitudes types, rangées par thème, avec leurs réglages types.
    habitudes: [
      // Sommeil
      n('sommeil', 'sommeil-heures', 'Heures de sommeil', 'h', { min: 7, max: 9, pas: 0.5, source: 'sommeil' }),
      c('sommeil', 'coucher-23h', 'Couché avant 23 h'),
      c('sommeil', 'lever-fixe', 'Lever à heure fixe', { jours: SEM }),
      c('sommeil', 'ecran-lit', 'Pas d\'écran au lit'),
      n('sommeil', 'sieste', 'Sieste courte', 'min', { max: 20, pas: 5, jours: [5, 6] }),
      c('sommeil', 'chambre', 'Chambre aérée'),

      // Sport et mouvement
      n('sport', 'pas', 'Pas dans la journée', 'pas', { min: 8000, pas: 1000, source: 'pas' }),
      c('sport', 'seance', 'Séance de sport', { jours: [0, 2, 4] }),
      n('sport', 'marche', 'Marche', 'min', { min: 30, pas: 5, source: 'activite' }),
      n('sport', 'etirements', 'Étirements', 'min', { min: 10, pas: 5 }),
      n('sport', 'gainage', 'Gainage', 'min', { min: 3, pas: 1, jours: SEM }),
      c('sport', 'escaliers', 'Escaliers plutôt qu\'ascenseur', { jours: SEM }),
      c('sport', 'trajet-actif', 'Trajet à pied ou à vélo', { jours: SEM }),
      n('sport', 'course', 'Course à pied', 'km', { min: 5, pas: 0.5, jours: [1, 5] }),

      // Travail et apprentissage
      c('travail', 'tache-1', 'Tâche importante faite en premier', { jours: SEM }),
      n('travail', 'lecture', 'Lecture', 'pages', { min: 10, pas: 5 }),
      n('travail', 'langue', 'Langue étrangère', 'min', { min: 15, pas: 5 }),
      c('travail', 'boite-zero', 'Boîte de réception triée', { jours: SEM }),
      c('travail', 'planifier', 'Lendemain planifié', { jours: SEM }),
      n('travail', 'instrument', 'Pratique d\'un instrument', 'min', { min: 20, pas: 5 }),
      n('travail', 'concentration', 'Plages de concentration', 'plages', { min: 2, pas: 1, jours: SEM }),

      // Alimentation et hydratation
      n('alimentation', 'eau', 'Eau', 'verres', { min: 8, pas: 1, source: 'eau' }),
      n('alimentation', 'fruits-legumes', 'Fruits et légumes', 'portions', { min: 5, pas: 1, source: 'fruits' }),
      c('alimentation', 'petit-dej', 'Petit-déjeuner pris'),
      n('alimentation', 'cafe', 'Cafés', 'tasses', { max: 3, pas: 1 }),
      c('alimentation', 'grignotage', 'Pas de grignotage'),
      c('alimentation', 'sucre', 'Pas de boisson sucrée'),
      c('alimentation', 'maison', 'Repas cuisiné maison'),
      n('alimentation', 'alcool', 'Verres d\'alcool', 'verres', { max: 0, pas: 1, source: 'alcool' }),

      // Esprit et relations
      n('esprit', 'meditation', 'Méditation', 'min', { min: 10, pas: 5 }),
      c('esprit', 'gratitude', 'Trois bonnes choses notées'),
      n('esprit', 'ecran-loisir', 'Écran de loisir', 'h', { max: 2, pas: 0.5 }),
      n('esprit', 'dehors', 'Temps dehors', 'min', { min: 20, pas: 10 }),
      c('esprit', 'matin-sans-reseaux', 'Matin sans réseaux sociaux'),
      c('esprit', 'proche', 'Appel à un proche', { jours: [2, 6] }),
      c('esprit', 'repas-sans-tel', 'Repas sans téléphone'),

      // Lieu de travail (une seule réponse par jour)
      c('lieu', 'bureau', 'Bureau', { jours: SEM }),
      c('lieu', 'teletravail', 'Télétravail', { jours: SEM }),
      c('lieu', 'deplacement', 'Déplacement', { jours: SEM }),

      // Maison et argent
      c('maison', 'lit', 'Lit fait'),
      c('maison', 'vaisselle', 'Cuisine rangée le soir'),
      n('maison', 'rangement', 'Rangement', 'min', { min: 10, pas: 5 }),
      c('maison', 'plantes', 'Plantes arrosées', { jours: [0, 3] }),
      c('maison', 'depenses', 'Dépenses notées'),
      c('maison', 'achat-impulsif', 'Aucun achat impulsif'),
      c('maison', 'gamelle', 'Déjeuner apporté au travail', { jours: SEM }),

      // Soins et traitements (habitudes de santé : rappel « ne remplace pas un avis médical »)
      c('soins', 'traitement-matin', 'Traitement du matin pris', { sante: true }),
      c('soins', 'traitement-soir', 'Traitement du soir pris', { sante: true }),
      c('soins', 'dents', 'Dents brossées matin et soir'),
      c('soins', 'creme-solaire', 'Protection solaire', { jours: SEM }),
    ],

    // Routines types proposées au premier lancement : un clic coche leurs habitudes.
    routines: [
      { id: 'matin', nom: 'Rituel du matin', detail: 'Démarrer la journée sans écran ni précipitation.', habitudes: ['lever-fixe', 'lit', 'eau', 'matin-sans-reseaux', 'petit-dej', 'tache-1'] },
      { id: 'soir', nom: 'Routine du soir', detail: 'Préparer une bonne nuit.', habitudes: ['vaisselle', 'planifier', 'ecran-lit', 'coucher-23h', 'sommeil-heures'] },
      { id: 'forme', nom: 'Bouger plus', detail: 'Du mouvement chaque jour, sans salle obligatoire.', habitudes: ['pas', 'seance', 'etirements', 'escaliers'] },
      { id: 'teletravail', nom: 'Semaine en télétravail', detail: 'Lieu du jour et pauses actives.', habitudes: ['bureau', 'teletravail', 'deplacement', 'dehors', 'gamelle', 'concentration'] },
      { id: 'sante', nom: 'Bien manger', detail: 'Eau, fruits et légumes, moins de café.', habitudes: ['eau', 'fruits-legumes', 'cafe', 'grignotage', 'maison'] },
      { id: 'serenite', nom: 'Esprit serein', detail: 'Quelques minutes pour soi.', habitudes: ['meditation', 'gratitude', 'ecran-loisir', 'lecture', 'proche'] },
    ],

    // Unités proposées à la création d'une habitude chiffrée.
    unites: ['fois', 'min', 'h', 'verres', 'pages', 'pas', 'km', 'portions', 'tasses', 'plages', '€'],

    // Repères pour les réglages types (valeurs indicatives, modifiables, à vérifier).
    sources: {
      eau: 'Environ 1 à 1,5 litre d\'eau par jour pour un adulte, soit 6 à 8 verres : repère du Programme national nutrition santé (site mangerbouger.fr). À vérifier.',
      fruits: 'Au moins 5 portions de fruits et légumes par jour : repère du Programme national nutrition santé (site mangerbouger.fr). À vérifier.',
      activite: 'Au moins 30 minutes d\'activité physique d\'intensité modérée par jour : repère du Programme national nutrition santé ; l\'Organisation mondiale de la santé recommande 150 à 300 minutes par semaine pour un adulte. À vérifier.',
      sommeil: '7 à 9 heures par nuit pour un adulte : fourchette couramment citée par les sociétés savantes du sommeil. À vérifier et à adapter.',
      pas: 'Aucune valeur officielle : 8 000 pas est un objectif courant, à adapter à ton niveau.',
      alcool: 'Repères de consommation à moindre risque de Santé publique France : pas plus de 10 verres standard par semaine, pas plus de 2 par jour, et des jours sans. À vérifier.',
    },
    sourcesDate: 'novembre 2026',
  };
})();
