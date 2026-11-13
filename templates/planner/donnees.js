// Base intégrée du planner horaire : couleurs fixes, catégories préréglées et semaines types.
// Contenu original rédigé pour QME : aucune source externe, aucune donnée datée.
// Heures en minutes depuis minuit ; jours : 0 = lundi … 6 = dimanche.
(() => {
  const h = (t) => { const [a, b = 0] = String(t).split('h').map(Number); return a * 60 + b; };
  const SEM = [0, 1, 2, 3, 4];
  const b = (titre, cat, jours, debut, fin) => ({ titre, cat, jours, debut: h(debut), duree: h(fin) - h(debut) });

  window.BASE = {
    // Une catégorie par couleur, dans cet ordre (jamais de couleur générée).
    couleurs: [
      { id: 'bleu', hex: '#1D4E89', nom: 'Bleu', texte: '#fff' },
      { id: 'rouge', hex: '#D9302A', nom: 'Rouge', texte: '#fff' },
      { id: 'jaune', hex: '#F5B400', nom: 'Jaune', texte: '#141414' },
      { id: 'vert', hex: '#2E7D4F', nom: 'Vert', texte: '#fff' },
      { id: 'ciel', hex: '#4A90C2', nom: 'Bleu ciel', texte: '#141414' },
      { id: 'prune', hex: '#7A3E6B', nom: 'Prune', texte: '#fff' },
      { id: 'encre', hex: '#141414', nom: 'Noir', texte: '#fff' },
      { id: 'orange', hex: '#E8702A', nom: 'Orange', texte: '#141414' },
    ],

    // Catégories préréglées (reprises par les semaines types).
    categories: [
      { id: 'fond', nom: 'Travail de fond', couleur: 'bleu' },
      { id: 'reunions', nom: 'Réunions', couleur: 'rouge' },
      { id: 'admin', nom: 'Messages et admin', couleur: 'jaune' },
      { id: 'equipe', nom: 'Équipe', couleur: 'vert' },
      { id: 'pauses', nom: 'Pauses et repas', couleur: 'ciel' },
      { id: 'perso', nom: 'Sport et perso', couleur: 'prune' },
      { id: 'prepa', nom: 'Préparation', couleur: 'encre' },
      { id: 'production', nom: 'Production client', couleur: 'bleu' },
      { id: 'prospection', nom: 'Prospection', couleur: 'rouge' },
      { id: 'factures', nom: 'Admin et factures', couleur: 'jaune' },
      { id: 'veille', nom: 'Formation et veille', couleur: 'vert' },
      { id: 'cours', nom: 'Cours', couleur: 'encre' },
      { id: 'revisions', nom: 'Révisions', couleur: 'bleu' },
      { id: 'projets', nom: 'Devoirs et projets', couleur: 'rouge' },
      { id: 'job', nom: 'Job étudiant', couleur: 'jaune' },
      { id: 'sport', nom: 'Sport', couleur: 'vert' },
      { id: 'loisirs', nom: 'Loisirs', couleur: 'prune' },
      { id: 'travail', nom: 'Travail', couleur: 'bleu' },
      { id: 'rdv', nom: 'Rendez-vous', couleur: 'rouge' },
      { id: 'taches', nom: 'Tâches courantes', couleur: 'jaune' },
    ],

    // Semaines types : catégories (dans l'ordre d'affichage) et blocs récurrents proposés.
    semainesTypes: [
      {
        id: 'cadre', nom: 'Cadre', detail: 'Travail de fond protégé le matin, réunions regroupées',
        heures: [7 * 60, 21 * 60],
        categories: ['fond', 'reunions', 'admin', 'equipe', 'pauses', 'perso', 'prepa'],
        blocs: [
          b('Messages du matin', 'admin', SEM, '8h30', '9h'),
          b('Travail de fond', 'fond', SEM, '9h', '11h'),
          b('Réunion d\'équipe', 'reunions', [0], '11h', '12h'),
          b('Déjeuner', 'pauses', SEM, '12h30', '13h30'),
          b('Créneau réunions', 'reunions', [1, 3], '14h', '16h'),
          b('Points individuels', 'equipe', [2], '14h', '15h30'),
          b('Travail de fond', 'fond', [4], '14h', '16h'),
          b('Messages du soir', 'admin', [0, 1, 2, 3], '16h30', '17h'),
          b('Bilan et préparation de la semaine', 'prepa', [4], '16h', '17h'),
          b('Sport', 'perso', [1, 3], '18h30', '19h30'),
        ],
      },
      {
        id: 'freelance', nom: 'Freelance', detail: 'Production le matin, commercial et admin regroupés',
        heures: [7 * 60, 21 * 60],
        categories: ['production', 'prospection', 'factures', 'veille', 'pauses', 'perso'],
        blocs: [
          b('Messages et planning du jour', 'factures', SEM, '8h30', '9h'),
          b('Production client', 'production', SEM, '9h', '12h'),
          b('Déjeuner', 'pauses', SEM, '12h30', '13h30'),
          b('Production client', 'production', [0, 1, 3], '14h', '16h30'),
          b('Prospection et relances', 'prospection', [2], '14h', '16h'),
          b('Suivi commercial', 'prospection', [0], '16h30', '17h30'),
          b('Facturation et comptabilité', 'factures', [4], '14h', '15h30'),
          b('Formation et veille', 'veille', [4], '15h30', '17h'),
          b('Sport', 'perso', [0, 2, 4], '18h', '19h'),
        ],
      },
      {
        id: 'etudiant', nom: 'Étudiant', detail: 'Cours, révisions régulières, job le week-end',
        heures: [8 * 60, 21 * 60],
        categories: ['cours', 'revisions', 'projets', 'job', 'sport', 'pauses', 'loisirs'],
        blocs: [
          b('Cours', 'cours', SEM, '8h30', '12h'),
          b('Déjeuner', 'pauses', SEM, '12h', '13h30'),
          b('Cours', 'cours', [0, 1, 3], '13h30', '16h30'),
          b('Devoirs et projets', 'projets', [2], '14h', '17h'),
          b('Révisions', 'revisions', [0, 1, 2, 3], '17h30', '19h'),
          b('Sport', 'sport', [1, 3], '19h', '20h'),
          b('Job étudiant', 'job', [5], '9h', '13h'),
          b('Sortie, loisirs', 'loisirs', [5], '15h', '18h'),
          b('Révisions', 'revisions', [6], '15h', '17h'),
        ],
      },
      {
        id: 'vierge', nom: 'Semaine vierge', detail: 'Catégories génériques, aucun bloc',
        heures: [7 * 60, 21 * 60],
        categories: ['travail', 'rdv', 'taches', 'sport', 'pauses', 'loisirs'],
        blocs: [],
      },
    ],

    // Conseils affichés dans l'onglet Modèles.
    conseils: [
      ['Protège un bloc de fond', 'Deux heures sans messages ni réunion, de préférence le matin, pour le travail qui demande de la concentration.'],
      ['Regroupe ce qui se ressemble', 'Messages, appels, administratif : deux créneaux courts par jour plutôt qu\'au fil de l\'eau.'],
      ['Garde des marges', 'Laisse une demi-heure libre entre les gros blocs : les imprévus s\'y logent sans tout décaler.'],
      ['Marque au fil de la journée', 'Fait, raccourci, déplacé ou pas fait : un geste suffit, et le bilan du vendredi est juste.'],
      ['Fais le bilan en fin de semaine', 'Compare le prévu et le réalisé par catégorie, puis ajuste la semaine suivante plutôt que d\'en prévoir plus.'],
    ],
  };
})();
