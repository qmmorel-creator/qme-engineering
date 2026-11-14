// Base intégrée du plan d'entraînement course à pied : distances, allures d'entraînement (repères), bibliothèque
// de séances et plans types du 10 km au marathon, échelle de ressenti, conseils et sources.
// Contenu original QME, rédigé pour ce template : aucun plan commercial, aucune méthode déposée, aucun nom de marque.
// Aucune donnée de santé : ni poids, ni fréquence cardiaque, ni blessure. Aucune logique ici.
(() => {
  // Blocs d'une séance (durées en minutes, distances en mètres, secondes pour les accélérations) :
  //   { m, a }            : m minutes à l'allure a
  //   { n, d, a, r }      : n répétitions de d mètres à l'allure a, r minutes de récupération en trottinant
  //   { n, m, a, r }      : n répétitions de m minutes à l'allure a, r minutes de récupération
  //   { n, s, a, r }      : n accélérations de s secondes, r minutes de récupération
  //   { course: true }    : la course elle-même (distance de l'objectif)
  const ECH = { m: 15, a: 'footing' }; // échauffement
  const RET = { m: 10, a: 'footing' }; // retour au calme
  const footing = (m) => ({ type: 'footing', titre: `Footing ${m} min`, blocs: [{ m, a: 'footing' }], consigne: 'Allure de conversation : tu peux parler en phrases complètes. Si tu dois choisir, va moins vite.' });
  const footingAcc = (m) => ({ type: 'footing', titre: `Footing ${m} min et accélérations`, blocs: [{ m: m - 5, a: 'footing' }, { n: 6, s: 20, a: 'acc', r: 1 }], consigne: 'Footing tranquille, puis 6 accélérations progressives d\'environ 20 secondes, sans sprint, retour en trottinant.' });
  const longue = (m) => ({ type: 'longue', titre: `Sortie longue ${m} min`, blocs: [{ m, a: 'longue' }], consigne: 'Régulière du début à la fin, sans accélérer. Bois et mange comme le jour de la course si elle dure plus d\'une heure et quart.' });
  const longueSpe = (m, spe) => ({ type: 'longue', titre: `Sortie longue ${m} min dont ${spe} min à l'allure spécifique`, blocs: [{ m: m - spe, a: 'longue' }, { m: spe, a: 'specifique' }], consigne: 'Le début en endurance, la fin à l\'allure visée pour la course : c\'est la répétition générale. Si l\'allure ne tient pas, finis en endurance.' });
  const seuilRep = (n, m, r) => ({ type: 'seuil', titre: `Seuil ${n} × ${m} min`, blocs: [ECH, { n, m, a: 'seuil', r }, RET], consigne: `Allure « confortablement difficile » : quelques mots possibles, pas une phrase. ${r} min de trot entre les fractions.` });
  const seuilContinu = (m) => ({ type: 'seuil', titre: `Seuil ${m} min continu`, blocs: [ECH, { m, a: 'seuil' }, RET], consigne: 'Une seule fraction à l\'allure seuil, régulière. Commence sur le bas de la fourchette.' });
  const frac = (n, d, r) => ({ type: 'frac', titre: `Fractionné ${n} × ${d >= 1000 ? `${d / 1000} km` : `${d} m`}`, blocs: [ECH, { n, d, a: 'frac', r }, RET], consigne: `À l'allure 5 km, toutes les répétitions à la même vitesse : la dernière doit ressembler à la première. ${r === 1.5 ? '1 min 30' : `${r} min`} de trot entre deux.` });
  const speRep = (n, d, r) => ({ type: 'specifique', titre: `Allure spécifique ${n} × ${d / 1000} km`, blocs: [ECH, { n, d, a: 'specifique', r }, RET], consigne: `À l'allure visée pour ta course, pour l'apprendre et la tenir sans regarder ta montre. ${r === 1.5 ? '1 min 30' : `${r} min`} de trot entre deux.` });
  const speContinu = (d) => ({ type: 'specifique', titre: `Allure spécifique ${d / 1000} km continu`, blocs: [ECH, { n: 1, d, a: 'specifique', r: 0 }, RET], consigne: 'D\'un seul tenant à l\'allure visée pour ta course. Si elle te paraît trop dure, c\'est le moment de revoir ton objectif.' });

  window.BASE = {
    version: '2026-11-14',

    // Distances d'objectif et durée du plan type (semaines, la dernière est celle de la course).
    distances: {
      '10k': { nom: '10 km', km: 10, semaines: 8 },
      semi: { nom: 'Semi-marathon', km: 21.0975, semaines: 12 },
      marathon: { nom: 'Marathon', km: 42.195, semaines: 16 },
    },
    // Distances proposées pour le chrono de référence (ou une distance libre, de 3 à 42,195 km).
    references: [
      ['5k', '5 km', 5], ['10k', '10 km', 10], ['semi', 'Semi-marathon', 21.0975], ['marathon', 'Marathon', 42.195],
    ],
    // Distances affichées dans le tableau des prédictions.
    predictions: [['5 km', 5], ['10 km', 10], ['15 km', 15], ['Semi-marathon', 21.0975], ['Marathon', 42.195]],

    // Allures d'entraînement : repères QME exprimés à partir des allures prédites (formule de Riegel), puis
    // présentés en fourchette. base : allure de référence (m = marathon prédit, h = course d'une heure,
    // c5 = 5 km prédit, objectif = allure visée) ; [lent, rapide] : coefficients appliqués à cette allure
    // (plus grand = plus lent). Ce sont des estimations, à ajuster aux sensations.
    allures: {
      recup: { nom: 'Récupération', base: 'm', f: [1.35, 1.25], couleur: 'sable', sensation: 'Très facile, presque en marchant vite. Pour récupérer le lendemain d\'un effort.' },
      footing: { nom: 'Footing (endurance)', base: 'm', f: [1.25, 1.12], couleur: 'ciel', sensation: 'Facile : tu parles en phrases complètes. L\'essentiel de ton entraînement.' },
      longue: { nom: 'Sortie longue', base: 'm', f: [1.2, 1.08], couleur: 'ciel', sensation: 'Facile et régulière, un peu plus soutenue que le footing en fin de préparation.' },
      seuil: { nom: 'Seuil', base: 'h', f: [1.03, 0.99], couleur: 'beurre', sensation: 'Confortablement difficile : quelques mots, pas une phrase. L\'allure d\'une course d\'environ une heure.' },
      frac: { nom: 'Fractionné (allure 5 km)', base: 'c5', f: [1.02, 0.98], couleur: 'rose', sensation: 'Difficile mais contrôlé : l\'allure que tu tiendrais sur un 5 km.' },
      specifique: { nom: 'Allure spécifique', base: 'objectif', f: [1.01, 0.99], couleur: 'rose', sensation: 'L\'allure visée pour ta course, à apprendre par cœur.' },
      acc: { nom: 'Accélérations', base: 'c5', f: [1, 1], couleur: 'sable', sensation: 'Progressives, environ 20 secondes, sans sprinter.', sansAllure: true },
    },
    ordreAllures: ['recup', 'footing', 'longue', 'seuil', 'frac', 'specifique'],

    types: {
      footing: { nom: 'Footing', court: 'Footing', couleur: 'ciel', qualite: false },
      recup: { nom: 'Récupération', court: 'Récup', couleur: 'sable', qualite: false },
      longue: { nom: 'Sortie longue', court: 'Longue', couleur: 'ciel', qualite: false },
      seuil: { nom: 'Seuil', court: 'Seuil', couleur: 'beurre', qualite: true },
      frac: { nom: 'Fractionné', court: 'Fractionné', couleur: 'rose', qualite: true },
      specifique: { nom: 'Allure spécifique', court: 'Spécifique', couleur: 'rose', qualite: true },
      activation: { nom: 'Activation', court: 'Activation', couleur: 'sable', qualite: false },
      course: { nom: 'Course', court: 'Course', couleur: 'rouge', qualite: false },
    },

    // Bibliothèque des séances des plans types (rédigées pour QME).
    seances: {
      f25: footing(25), f30: footing(30), f35: footing(35), f40: footing(40), f45: footing(45), f50: footing(50), f55: footing(55),
      fa30: footingAcc(30), fa35: footingAcc(35), fa40: footingAcc(40),
      r25: { type: 'recup', titre: 'Récupération 25 min', blocs: [{ m: 25, a: 'recup' }], consigne: 'Très lent, sur terrain plat. Le but est de bouger, pas de s\'entraîner.' },
      l50: longue(50), l60: longue(60), l65: longue(65), l70: longue(70), l75: longue(75), l80: longue(80), l90: longue(90),
      l100: longue(100), l110: longue(110), l120: longue(120), l150: longue(150),
      'ls90-20': longueSpe(90, 20), 'ls100-30': longueSpe(100, 30), 'ls110-30': longueSpe(110, 30), 'ls130-45': longueSpe(130, 45),
      s3x8: seuilRep(3, 8, 2), s3x10: seuilRep(3, 10, 2), s3x12: seuilRep(3, 12, 2), s2x15: seuilRep(2, 15, 3),
      s20: seuilContinu(20), s25: seuilContinu(25),
      i8x400: frac(8, 400, 1.5), i6x800: frac(6, 800, 2), i5x1000: frac(5, 1000, 2), i6x1000: frac(6, 1000, 2),
      p6x1k: speRep(6, 1000, 1.5), p3x2k: speRep(3, 2000, 2), p2x3k: speRep(2, 3000, 3), p3x3k: speRep(3, 3000, 3), p3x5k: speRep(3, 5000, 3),
      p8k: speContinu(8000), p12k: speContinu(12000), p15k: speContinu(15000),
      act: { type: 'activation', titre: 'Activation avant la course', blocs: [{ m: 20, a: 'footing' }, { n: 3, m: 1, a: 'specifique', r: 1 }, { m: 5, a: 'footing' }], consigne: 'Court et léger : 20 min de footing, 3 × 1 min à l\'allure de course, c\'est tout. Tu dois finir avec l\'envie de courir.' },
      course: { type: 'course', titre: 'Le jour de la course', blocs: [{ course: true }], consigne: 'Pars à l\'allure prévue, pas plus vite : les premiers kilomètres paraissent toujours faciles. Échauffe-toi 10 à 15 min avant le départ (moins pour un marathon).' },
    },

    // Plans types : une ligne par semaine. s : séances par ordre de priorité
    // [qualité 1, sortie longue, footing, qualité 2, footing] ; à 3 séances par semaine on garde les 3 premières,
    // à 4 les 4 premières. allegee : semaine d'assimilation (volume réduit, prévu par le plan).
    // La dernière semaine est celle de la course : ses séances se placent avant le jour de la course.
    plans: {
      '10k': [
        { phase: 'developpement', s: ['s3x8', 'l60', 'f40', 'i8x400', 'f35'] },
        { phase: 'developpement', s: ['i6x800', 'l60', 'f40', 's3x8', 'f35'] },
        { phase: 'developpement', s: ['s3x10', 'l70', 'f45', 'p6x1k', 'f40'] },
        { phase: 'developpement', allegee: true, s: ['i8x400', 'l60', 'f40', 's20', 'f30'] },
        { phase: 'specifique', s: ['p3x2k', 'l75', 'f45', 'i5x1000', 'f40'] },
        { phase: 'specifique', s: ['s2x15', 'l75', 'f45', 'p2x3k', 'f40'] },
        { phase: 'affutage', s: ['p3x2k', 'l50', 'f35', 'fa35', 'f30'] },
        { phase: 'course', s: ['act', 'f30', 'fa30', 'r25', 'f25'] },
      ],
      semi: [
        { phase: 'foncier', s: ['fa40', 'l60', 'f40', 's3x8', 'f35'] },
        { phase: 'foncier', s: ['s3x8', 'l65', 'f45', 'i8x400', 'f40'] },
        { phase: 'foncier', s: ['i6x800', 'l70', 'f45', 's3x10', 'f40'] },
        { phase: 'foncier', allegee: true, s: ['fa40', 'l60', 'f40', 's20', 'f30'] },
        { phase: 'developpement', s: ['s3x10', 'l75', 'f45', 'i5x1000', 'f40'] },
        { phase: 'developpement', s: ['i6x1000', 'l80', 'f45', 's2x15', 'f45'] },
        { phase: 'developpement', s: ['s2x15', 'l90', 'f50', 'p3x2k', 'f45'] },
        { phase: 'developpement', allegee: true, s: ['i8x400', 'l70', 'f40', 's20', 'f35'] },
        { phase: 'specifique', s: ['p3x3k', 'ls90-20', 'f50', 's3x12', 'f45'] },
        { phase: 'specifique', s: ['s25', 'ls100-30', 'f50', 'p8k', 'f45'] },
        { phase: 'affutage', s: ['p3x2k', 'l70', 'f40', 'fa35', 'f30'] },
        { phase: 'course', s: ['act', 'f30', 'fa30', 'r25', 'f25'] },
      ],
      marathon: [
        { phase: 'foncier', s: ['fa40', 'l70', 'f45', 's3x8', 'f40'] },
        { phase: 'foncier', s: ['s3x8', 'l75', 'f45', 'i8x400', 'f40'] },
        { phase: 'foncier', s: ['i6x800', 'l80', 'f50', 's3x10', 'f45'] },
        { phase: 'foncier', allegee: true, s: ['fa40', 'l70', 'f40', 's20', 'f35'] },
        { phase: 'developpement', s: ['s3x10', 'l90', 'f50', 'i5x1000', 'f45'] },
        { phase: 'developpement', s: ['i6x1000', 'l100', 'f50', 's2x15', 'f45'] },
        { phase: 'developpement', s: ['s2x15', 'l110', 'f50', 'p3x3k', 'f45'] },
        { phase: 'developpement', allegee: true, s: ['i8x400', 'l80', 'f45', 's20', 'f40'] },
        { phase: 'specifique', s: ['p12k', 'ls110-30', 'f50', 's3x12', 'f50'] },
        { phase: 'specifique', s: ['s25', 'l120', 'f55', 'p3x5k', 'f50'] },
        { phase: 'specifique', s: ['p15k', 'ls130-45', 'f55', 'i5x1000', 'f50'] },
        { phase: 'specifique', allegee: true, s: ['s3x10', 'l90', 'f45', 'p8k', 'f40'] },
        { phase: 'specifique', s: ['p3x5k', 'l150', 'f55', 's2x15', 'f50'] },
        { phase: 'affutage', s: ['p12k', 'l110', 'f50', 's3x8', 'f45'] },
        { phase: 'affutage', s: ['p3x3k', 'l80', 'f45', 'fa40', 'f40'] },
        { phase: 'course', s: ['act', 'f30', 'fa30', 'r25', 'f25'] },
      ],
    },

    phases: {
      foncier: { nom: 'Foncier', texte: 'Construire l\'endurance : beaucoup de footing, un peu de seuil et de vitesse.' },
      developpement: { nom: 'Développement', texte: 'Monter le volume et la qualité : seuil, fractionné, sorties longues plus longues.' },
      specifique: { nom: 'Spécifique', texte: 'Travailler l\'allure de la course et les sorties longues qui la préparent.' },
      affutage: { nom: 'Affûtage', texte: 'Moins de volume, un peu d\'intensité : arriver frais le jour J.' },
      course: { nom: 'Course', texte: 'Semaine de la course : quelques séances courtes, puis le jour J.' },
    },

    // Volume : coefficient appliqué aux durées des footings, sorties longues et récupérations.
    volumes: {
      leger: { nom: 'Léger', f: 0.85, texte: 'Pour une reprise ou peu de temps disponible.' },
      normal: { nom: 'Normal', f: 1, texte: 'Le plan tel qu\'il est rédigé.' },
      soutenu: { nom: 'Soutenu', f: 1.15, texte: 'Si tu cours déjà régulièrement plus de 4 heures par semaine.' },
    },

    // Ressenti noté après chaque séance (effort perçu, pas une donnée de santé).
    ressentis: [
      [1, 'Très facile'], [2, 'Facile'], [3, 'Correct'], [4, 'Dur'], [5, 'Très dur'],
    ],

    jours: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],

    reglages: { exposant: 1.06, volume: 'normal', allegement: 0.7 },

    conseils: [
      ['Va lentement en footing', 'La plupart de tes séances doivent être faciles. C\'est ce qui permet de réussir les séances difficiles.'],
      ['Coche chaque séance', 'Distance réelle et ressenti : le volume de la semaine se calcule, et l\'application te propose d\'alléger si les séances deviennent trop dures.'],
      ['Ne rattrape pas', 'Une séance manquée ne se double pas : déplace-la dans la semaine si un jour est libre, sinon passe à la suivante.'],
      ['Mets ton chrono à jour', 'Un nouveau chrono sur une course ou un test recalcule toutes tes allures.'],
    ],

    sources: [
      ['Prédiction de temps par la formule de Riegel : T2 = T1 × (D2 ÷ D1)^1,06. Une estimation, moins fiable quand on extrapole loin (d\'un 5 km au marathon, elle est souvent trop optimiste pour un coureur amateur).', 'Riegel P. S., « Athletic Records and Human Endurance », American Scientist, vol. 69, n° 3, mai-juin 1981, p. 285-290 (référence vérifiée le 14/11/2026)'],
      ['Allure seuil prise comme l\'allure d\'une course d\'environ une heure : définition d\'usage courant en entraînement, appliquée ici comme repère.', 'Repère QME, rédigé pour ce template'],
      ['Fourchettes des allures de footing, de sortie longue et de récupération (coefficients sur l\'allure marathon prédite), plans types et séances.', 'Repères et contenus rédigés pour QME, sans reprise d\'un plan publié ni d\'une méthode commerciale'],
    ],
  };
})();
