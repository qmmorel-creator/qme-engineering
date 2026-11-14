// Base intégrée du carnet de musculation et cross-training : groupes, 150 exercices génériques, formats
// de WOD, modèles de séances rédigés pour QME, formules d'estimation du 1RM, conseils et sources.
// Contenu original QME, aucune logique ici. Aucun nom de marque (matériel, application, méthode déposée),
// aucun WOD de référence nommé : seulement des formats génériques et des modèles décrits par leur contenu.
// Aucune donnée de santé : pas de poids corporel, de mensuration, de fréquence cardiaque ni de blessure.
(() => {
  // Mesures : charge (kg × répétitions), reps (répétitions au poids du corps), temps (secondes tenues),
  // distance (mètres, temps facultatif), calories (calories affichées par la machine, temps facultatif).
  // allure : distance de référence de l'allure (500 m pour les ergomètres, 1 000 m pour la course).
  const G = (groupe, liste) => liste.map(([id, nom, mesure = 'charge', allure]) => ({ id, nom, groupe, mesure, ...(allure ? { allure } : {}) }));

  window.BASE = {
    version: '2026-11-14',

    // Groupes musculaires et familles, dans cet ordre d'affichage.
    groupes: [
      { id: 'pecs', nom: 'Pectoraux' },
      { id: 'dos', nom: 'Dos' },
      { id: 'epaules', nom: 'Épaules' },
      { id: 'biceps', nom: 'Biceps et avant-bras' },
      { id: 'triceps', nom: 'Triceps' },
      { id: 'quadri', nom: 'Quadriceps' },
      { id: 'ischios', nom: 'Ischios et fessiers' },
      { id: 'mollets', nom: 'Mollets' },
      { id: 'abdos', nom: 'Abdominaux et gainage' },
      { id: 'halt', nom: 'Haltérophilie' },
      { id: 'gym', nom: 'Gymnastique' },
      { id: 'fonc', nom: 'Kettlebell et fonctionnel' },
      { id: 'cardio', nom: 'Cardio et machines' },
    ],

    mesures: {
      charge: { nom: 'Charge × répétitions', court: 'charge × reps' },
      reps: { nom: 'Répétitions', court: 'reps' },
      temps: { nom: 'Temps tenu', court: 'temps' },
      distance: { nom: 'Distance', court: 'distance' },
      calories: { nom: 'Calories machine', court: 'calories' },
    },

    exercices: [
      ...G('pecs', [
        ['dev-couche', 'Développé couché barre'], ['dev-couche-halteres', 'Développé couché haltères'],
        ['dev-incline', 'Développé incliné barre'], ['dev-incline-halteres', 'Développé incliné haltères'],
        ['dev-decline', 'Développé décliné barre'], ['ecarte-halteres', 'Écarté couché haltères'],
        ['ecarte-poulie', 'Écarté à la poulie vis-à-vis'], ['pec-machine', 'Écarté à la machine'],
        ['pompes', 'Pompes', 'reps'], ['pompes-declinees', 'Pompes pieds surélevés', 'reps'],
        ['dips-pecs', 'Dips buste penché', 'reps'], ['dev-machine', 'Développé assis à la machine'],
      ]),
      ...G('dos', [
        ['souleve-terre', 'Soulevé de terre'], ['tractions', 'Tractions pronation', 'reps'],
        ['tractions-supi', 'Tractions supination', 'reps'], ['tractions-lestees', 'Tractions lestées (lest seul)'],
        ['rowing-barre', 'Rowing barre buste penché'], ['rowing-sol', 'Rowing barre départ au sol'],
        ['rowing-haltere', 'Rowing haltère un bras'], ['tirage-vertical', 'Tirage vertical à la poulie'],
        ['tirage-horizontal', 'Tirage horizontal assis'], ['rowing-inverse', 'Rowing inversé au poids du corps', 'reps'],
        ['pull-over', 'Pull-over haltère'], ['face-pull', 'Tirage vers le visage à la corde'],
        ['extension-lombaire', 'Extension lombaire au banc', 'reps'], ['shrug', 'Haussement d\'épaules barre'],
      ]),
      ...G('epaules', [
        ['dev-militaire', 'Développé militaire debout'], ['dev-assis-halteres', 'Développé épaules assis haltères'],
        ['push-press', 'Push press'], ['elevations-laterales', 'Élévations latérales haltères'],
        ['elevations-frontales', 'Élévations frontales'], ['oiseau', 'Oiseau buste penché'],
        ['rowing-menton', 'Tirage menton barre'], ['dev-rotation', 'Développé épaules avec rotation'],
        ['landmine', 'Développé à la barre ancrée'], ['pompes-pike', 'Pompes pieds surélevés en V', 'reps'],
        ['elevations-poulie', 'Élévations latérales à la poulie'],
      ]),
      ...G('biceps', [
        ['curl-barre', 'Curl barre'], ['curl-halteres', 'Curl haltères alterné'], ['curl-marteau', 'Curl marteau'],
        ['curl-pupitre', 'Curl au pupitre'], ['curl-poulie', 'Curl à la poulie basse'], ['curl-concentre', 'Curl concentré'],
        ['curl-inverse', 'Curl pronation'], ['flexion-poignets', 'Flexion des poignets'],
        ['suspension', 'Suspension à la barre', 'temps'],
      ]),
      ...G('triceps', [
        ['dev-serre', 'Développé couché prise serrée'], ['barre-front', 'Barre au front'],
        ['extension-poulie', 'Extension à la poulie haute'], ['extension-nuque', 'Extension nuque haltère'],
        ['kickback', 'Extension buste penché haltère'], ['dips', 'Dips aux barres parallèles', 'reps'],
        ['dips-banc', 'Dips entre deux bancs', 'reps'], ['pompes-diamant', 'Pompes mains serrées', 'reps'],
      ]),
      ...G('quadri', [
        ['squat', 'Squat arrière'], ['squat-avant', 'Squat avant'], ['squat-gobelet', 'Squat gobelet'],
        ['presse', 'Presse à cuisses'], ['fentes', 'Fentes marchées haltères'], ['fente-bulgare', 'Fente arrière pied surélevé'],
        ['leg-extension', 'Extension des jambes à la machine'], ['hack-squat', 'Squat à la machine inclinée'],
        ['squat-air', 'Squat au poids du corps', 'reps'], ['pistol', 'Squat sur une jambe', 'reps'],
        ['step-up', 'Montée sur banc'], ['chaise', 'Chaise contre le mur', 'temps'],
      ]),
      ...G('ischios', [
        ['sdt-roumain', 'Soulevé de terre jambes semi-tendues'], ['sdt-sumo', 'Soulevé de terre sumo'],
        ['hip-thrust', 'Poussée de hanches barre'], ['pont-fessier', 'Pont fessier au sol', 'reps'],
        ['leg-curl', 'Flexion des jambes à la machine'], ['leg-curl-assis', 'Flexion des jambes assis'],
        ['good-morning', 'Bonjour barre (good morning)'], ['nordique', 'Flexion nordique des ischios', 'reps'],
        ['abduction', 'Abduction de hanche à la machine'], ['kickback-poulie', 'Extension de hanche à la poulie'],
        ['sdt-une-jambe', 'Soulevé de terre sur une jambe'], ['sdt-hexagonal', 'Soulevé de terre barre hexagonale'],
      ]),
      ...G('mollets', [
        ['mollets-debout', 'Extension des mollets debout'], ['mollets-assis', 'Extension des mollets assis'],
        ['mollets-presse', 'Extension des mollets à la presse'], ['mollets-une-jambe', 'Extension des mollets sur une jambe', 'reps'],
      ]),
      ...G('abdos', [
        ['gainage', 'Gainage ventral', 'temps'], ['gainage-lateral', 'Gainage latéral', 'temps'],
        ['hollow', 'Position creuse tenue (hollow)', 'temps'], ['crunch', 'Crunch', 'reps'],
        ['releve-jambes', 'Relevé de jambes suspendu', 'reps'], ['toes-to-bar', 'Pieds à la barre (toes-to-bar)', 'reps'],
        ['sit-up', 'Redressement assis (sit-up)', 'reps'], ['sit-up-banc', 'Redressement assis au banc à lombaires', 'reps'],
        ['roue', 'Roulé à la roue abdominale', 'reps'], ['russian-twist', 'Rotation du buste assis'],
        ['crunch-poulie', 'Crunch à la poulie haute'], ['pallof', 'Presse anti-rotation à la poulie'],
        ['l-sit', 'Équerre tenue (L-sit)', 'temps'], ['v-up', 'Relevé en V (V-up)', 'reps'],
      ]),
      ...G('halt', [
        ['arrache', 'Arraché'], ['arrache-force', 'Arraché en force'], ['arrache-suspension', 'Arraché depuis la suspension'],
        ['epaule', 'Épaulé'], ['epaule-force', 'Épaulé en force'], ['epaule-suspension', 'Épaulé depuis la suspension'],
        ['epaule-jete', 'Épaulé-jeté'], ['jete', 'Jeté fendu'], ['push-jerk', 'Jeté poussé (push jerk)'],
        ['squat-arrache', 'Squat bras tendus (overhead squat)'], ['tirage-arrache', 'Tirage d\'arraché'],
        ['tirage-epaule', 'Tirage d\'épaulé'], ['thruster', 'Thruster (squat avant et développé)'],
        ['cluster', 'Épaulé-squat et développé enchaînés'],
      ]),
      ...G('gym', [
        ['muscle-up-barre', 'Traction-dips à la barre (muscle-up)', 'reps'], ['muscle-up-anneaux', 'Traction-dips aux anneaux (muscle-up)', 'reps'],
        ['tractions-elan', 'Tractions avec élan', 'reps'], ['tractions-poitrine', 'Tractions poitrine à la barre', 'reps'],
        ['pompes-poirier', 'Pompes en équilibre sur les mains', 'reps'], ['poirier', 'Équilibre sur les mains contre le mur', 'temps'],
        ['marche-mains', 'Marche sur les mains', 'distance'], ['dips-anneaux', 'Dips aux anneaux', 'reps'],
        ['corde', 'Montée à la corde', 'reps'], ['burpees', 'Burpees', 'reps'], ['burpees-saut', 'Burpees saut par-dessus la barre', 'reps'],
        ['box-jump', 'Sauts sur la caisse', 'reps'], ['double-saut', 'Doubles sauts à la corde', 'reps'],
        ['simple-saut', 'Sauts à la corde', 'reps'], ['montee-mur', 'Montée au mur (wall walk)', 'reps'],
        ['anneaux-rowing', 'Rowing aux anneaux', 'reps'],
      ]),
      ...G('fonc', [
        ['kb-swing', 'Balancé kettlebell (swing)'], ['kb-swing-us', 'Balancé kettlebell au-dessus de la tête'],
        ['kb-releve', 'Relevé turc kettlebell'], ['kb-gobelet', 'Squat gobelet kettlebell'],
        ['kb-snatch', 'Arraché kettlebell un bras'], ['wall-ball', 'Lancer de médecine-ball au mur (wall ball)'],
        ['devil-press', 'Burpee et arraché deux haltères'], ['farmer', 'Marche du fermier', 'distance'],
        ['sandbag', 'Port de sac lesté', 'distance'], ['traineau', 'Poussée de traîneau', 'distance'],
      ]),
      ...G('cardio', [
        ['rameur', 'Rameur', 'distance', 500], ['rameur-cal', 'Rameur (calories)', 'calories'],
        ['ski-erg', 'Ski ergomètre', 'distance', 500], ['ski-erg-cal', 'Ski ergomètre (calories)', 'calories'],
        ['velo-air', 'Vélo à air (calories)', 'calories'], ['velo-erg', 'Vélo ergomètre', 'distance', 1000],
        ['course', 'Course à pied', 'distance', 1000], ['course-tapis', 'Course sur tapis', 'distance', 1000],
        ['sprint', 'Sprint', 'distance', 1000], ['navette', 'Course navette', 'distance', 1000],
        ['natation', 'Natation', 'distance', 100], ['marche-inclinee', 'Marche inclinée sur tapis', 'temps'],
        ['escalier', 'Machine à marches', 'temps'], ['corde-ondulatoire', 'Cordes ondulatoires', 'temps'],
      ]),
    ],

    formats: {
      series: { nom: 'Séries', court: 'Séries', aide: 'Séance classique : exercices, séries, charges et répétitions.' },
      amrap: { nom: 'AMRAP', court: 'AMRAP', aide: 'Le plus de tours possible dans un temps donné. Score : tours et répétitions.' },
      emom: { nom: 'EMOM', court: 'EMOM', aide: 'Au début de chaque minute, le travail prévu, puis repos jusqu\'à la minute suivante. Score : minutes réussies.' },
      fortime: { nom: 'For Time', court: 'For Time', aide: 'Le travail prévu le plus vite possible, avec un temps limite facultatif. Score : temps, ou tours faits au temps limite.' },
      intervalles: { nom: 'Intervalles', court: 'Intervalles', aide: 'Alternance de travail et de repos sur plusieurs tours. Score : répétitions totales.' },
    },

    // Formules d'estimation du maximum sur une répétition (1RM) à partir d'une série.
    formules: {
      epley: { nom: 'Epley', texte: '1RM ≈ charge × (1 + répétitions ÷ 30)', source: 'B. Epley, Poundage Chart, Boyd Epley Workout, Lincoln (Nebraska), 1985' },
      brzycki: { nom: 'Brzycki', texte: '1RM ≈ charge × 36 ÷ (37 − répétitions)', source: 'M. Brzycki, « Strength testing: predicting a one-rep max from reps-to-fatigue », Journal of Physical Education, Recreation & Dance, 64 (1), 1993, p. 88-90' },
    },

    reglages: { unite: 'kg', formule: 'epley', repsMax: 10 },

    // Répétitions des records par répétitions (meilleure charge soulevée au moins n fois).
    repsRecords: [1, 3, 5, 8, 10],

    // Modèles de séances rédigés pour QME. Charges vides : chacun met les siennes.
    modeles: [
      { id: 'm-haut-pousse', nom: 'Haut du corps · poussée', type: 'series', exercices: [['dev-couche', 4, 6], ['dev-militaire', 3, 8], ['dev-incline-halteres', 3, 10], ['elevations-laterales', 3, 12], ['extension-poulie', 3, 12]] },
      { id: 'm-haut-tirage', nom: 'Haut du corps · tirage', type: 'series', exercices: [['tractions', 4, 6], ['rowing-barre', 4, 8], ['tirage-horizontal', 3, 10], ['face-pull', 3, 15], ['curl-halteres', 3, 10]] },
      { id: 'm-bas-force', nom: 'Bas du corps · force', type: 'series', exercices: [['squat', 5, 5], ['sdt-roumain', 3, 8], ['fente-bulgare', 3, 8], ['leg-curl', 3, 12], ['mollets-debout', 3, 12]] },
      { id: 'm-trois-mouvements', nom: 'Force · trois mouvements de base', type: 'series', exercices: [['squat', 3, 5], ['dev-couche', 3, 5], ['souleve-terre', 1, 5]] },
      { id: 'm-corps-entier', nom: 'Corps entier · débutant', type: 'series', exercices: [['squat-gobelet', 3, 10], ['pompes', 3, 10], ['rowing-haltere', 3, 10], ['pont-fessier', 3, 12], ['gainage', 3, 30]] },
      { id: 'm-technique-halt', nom: 'Technique d\'haltérophilie · épaulé-jeté', type: 'series', exercices: [['epaule-force', 5, 3], ['jete', 5, 2], ['squat-avant', 4, 4]] },
      { id: 'm-amrap-12', nom: 'AMRAP 12 min · poids du corps', type: 'wod', wod: { format: 'amrap', duree: 12, mouvements: [['burpees', 8], ['squat-air', 15], ['pompes', 10], ['sit-up', 15]] } },
      { id: 'm-emom-10', nom: 'EMOM 10 min · kettlebell et sauts', type: 'wod', wod: { format: 'emom', duree: 10, mouvements: [['kb-swing', 15], ['box-jump', 10]] } },
      { id: 'm-fortime-rameur', nom: 'For Time · rameur, thrusters et tractions', type: 'wod', wod: { format: 'fortime', cap: 15, tours: 3, mouvements: [['rameur', 0, 500], ['thruster', 12], ['tractions', 9]] } },
      { id: 'm-intervalles-20-10', nom: 'Intervalles 20 s / 10 s · 8 tours', type: 'wod', wod: { format: 'intervalles', travail: 20, repos: 10, tours: 8, mouvements: [['squat-air', 0]] } },
      { id: 'm-amrap-20', nom: 'AMRAP 20 min · haltères et course', type: 'wod', wod: { format: 'amrap', duree: 20, mouvements: [['course', 0, 400], ['devil-press', 10], ['fentes', 20]] } },
      { id: 'm-cardio-continu', nom: 'Cardio · rameur en continu', type: 'series', exercices: [['rameur', 1, 0, 5000]] },
    ],

    conseils: [
      ['Note pendant la séance', 'Saisis chaque série juste après l\'avoir faite : charge et répétitions, le RPE si tu le suis.'],
      ['Garde tes modèles', 'Une séance que tu refais se garde comme modèle : la prochaine fois, il ne reste que les charges.'],
      ['Lis les records', 'Les records se détectent seuls. Le 1RM affiché est une estimation par formule, jamais un objectif à tester seul.'],
      ['Suis le volume', 'Les séries par groupe et le tonnage de la semaine montrent si ton entraînement reste équilibré.'],
    ],

    sources: [
      ['Formule d\'Epley (1985) : 1RM ≈ charge × (1 + reps ÷ 30), citée par de nombreux manuels de préparation physique', 'Epley B., Poundage Chart, Boyd Epley Workout, Lincoln (Nebraska), Body Enterprises, 1985'],
      ['Formule de Brzycki (1993) : 1RM ≈ charge × 36 ÷ (37 − reps)', 'Brzycki M., Journal of Physical Education, Recreation & Dance, vol. 64, n° 1, 1993, p. 88-90'],
      ['Échelle de RPE de 1 à 10 fondée sur les répétitions en réserve (10 = aucune répétition de plus possible)', 'Zourdos M. C. et al., Journal of Strength and Conditioning Research, vol. 30, n° 1, 2016, p. 267-275'],
    ],
  };
})();
