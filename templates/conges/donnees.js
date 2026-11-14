// Base intégrée du suivi des congés et absences : réglages par défaut, types d'absence, couleurs,
// repères et sources. Contenu original rédigé pour QME, aucune logique ici.
// Les règles légales sont des PARAMÈTRES (relevés le 14/11/2026 sur code.travail.gouv.fr, site du
// ministère du Travail qui reproduit Légifrance) : une convention collective, un accord d'entreprise ou un
// usage plus favorable peut les modifier ; tout se change dans les Réglages.
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Acquisition par défaut selon l'unité de décompte choisie.
    // Jours ouvrables : 2,5 jours par mois de travail effectif, 30 jours au plus (art. L3141-3) ;
    // arrêt maladie non professionnel : 2 jours par mois, 24 jours au plus par période (art. L3141-5-1,
    // créé par la loi n° 2024-364 du 22/04/2024).
    // Jours ouvrés : équivalence courante 30 ouvrables = 25 ouvrés (× 5/6), soit 2,0833 jours par mois ;
    // la même conversion donne 1,6667 et 20 jours pour la maladie (équivalence à vérifier selon ta convention).
    acquisitions: {
      ouvrables: { mois: 2.5, plafond: 30, maladieMois: 2, maladiePlafond: 24 },
      ouvres: { mois: 2.0833, plafond: 25, maladieMois: 1.6667, maladiePlafond: 20 },
    },

    reglages: {
      decompte: 'ouvrables',
      moisDebut: 6,            // 1er juin (art. R3141-4) ; 1 = année civile (accord d'entreprise ou convention)
      debutSuivi: null,        // date de départ du suivi : fixée au premier lancement
      joursTravailles: [1, 2, 3, 4, 5],
      acquisition: { mois: 2.5, plafond: 30, maladieMois: 2, maladiePlafond: 24 },
      arrondiSup: true,        // art. L3141-7 : nombre entier immédiatement supérieur
      // Fêtes légales (art. L3133-1) supposées chômées. Seul le 1er mai est chômé de droit (art. L3133-4) :
      // les autres le sont selon la convention ou l'usage. Alsace-Moselle : ajouter Vendredi saint et 26 décembre.
      feriesChomes: ['jan1', 'lundiPaques', 'mai1', 'mai8', 'ascension', 'lundiPentecote', 'juil14', 'aout15', 'nov1', 'nov11', 'dec25'],
      rttMode: 'prorata',
      verifieLe: '2026-11-14',
    },

    // Couleurs des types, dans cet ordre fixe (palette validée : séparation pour les daltonismes,
    // lettre dans chaque case du calendrier en plus de la couleur). « texte » : couleur de la lettre.
    couleurs: [
      { fond: '#2a78d6', texte: '#FFFFFF' },
      { fond: '#eb6834', texte: '#24221F' },
      { fond: '#1baf7a', texte: '#24221F' },
      { fond: '#eda100', texte: '#24221F' },
      { fond: '#e87ba4', texte: '#24221F' },
      { fond: '#008300', texte: '#FFFFFF' },
      { fond: '#6250d6', texte: '#FFFFFF' },
    ],

    // Types d'absence par défaut. decompte : compteur débité (« cp », « rtt » ou « aucun ») ;
    // acquiert : effet sur l'acquisition des congés payés (« oui » : période assimilée à du travail
    // effectif, « maladie » : règle de l'arrêt maladie non professionnel, « non » : rien n'est acquis) ;
    // demande : passe par une demande à valider ; sante : aucune note (pas de détail de santé).
    types: [
      { id: 'cp', nom: 'Congés payés', lettre: 'C', decompte: 'cp', acquiert: 'oui', couleur: 0, demande: true },
      { id: 'rtt', nom: 'RTT', lettre: 'R', decompte: 'rtt', acquiert: 'oui', couleur: 1, demande: true },
      { id: 'maladie', nom: 'Arrêt maladie', lettre: 'M', decompte: 'aucun', acquiert: 'maladie', couleur: 2, demande: false, sante: true },
      { id: 'famille', nom: 'Événement familial', lettre: 'F', decompte: 'aucun', acquiert: 'oui', couleur: 3, demande: true },
      { id: 'sansSolde', nom: 'Congé sans solde', lettre: 'S', decompte: 'aucun', acquiert: 'non', couleur: 4, demande: true },
      { id: 'atmp', nom: 'Accident du travail, maladie pro.', lettre: 'A', decompte: 'aucun', acquiert: 'oui', couleur: 5, demande: false, sante: true },
      { id: 'autre', nom: 'Autre absence', lettre: 'X', decompte: 'aucun', acquiert: 'oui', couleur: 6, demande: true },
    ],

    conseils: [
      ['Une demande, une trace', 'Chaque absence passe par une demande datée, validée ou refusée : tu sais qui a dit oui, et quand.'],
      ['Le seuil de l\'équipe', 'Fixe combien de personnes peuvent manquer en même temps : les chevauchements s\'affichent avant de valider.'],
      ['Le minimum sur la santé', 'Le type « Arrêt maladie » suffit : jamais de motif médical, ni de pièce, dans cet outil.'],
      ['Vérifier sa convention', 'Les règles par défaut sont celles du Code du travail : ta convention collective peut être plus favorable.'],
    ],

    // Repères (droit français, Code du travail). Outil d'aide : la convention collective et le Code du travail font foi.
    reperes: [
      ['Acquisition', '2,5 jours ouvrables par mois de travail effectif chez le même employeur, 30 jours ouvrables au plus par an (art. L3141-3). En jours ouvrés, l\'équivalence courante est de 25 jours par an. Certaines absences comptent comme du travail effectif (congés payés, maternité, paternité, accident du travail…, art. L3141-5).'],
      ['Période de référence', 'Du 1er juin au 31 mai à défaut d\'accord (art. R3141-4) ; un accord d\'entreprise ou la convention peut retenir une autre période, par exemple l\'année civile (art. L3141-10).'],
      ['Arrêt maladie', 'Depuis la loi du 22 avril 2024, un arrêt maladie non professionnel ouvre 2 jours ouvrables par mois, 24 au plus par période (art. L3141-5-1) ; un accident du travail ou une maladie professionnelle compte comme du travail effectif. Des règles de report et d\'information du salarié s\'appliquent en plus : à vérifier.'],
      ['Arrondi', 'Un droit non entier est porté au nombre entier immédiatement supérieur (art. L3141-7).'],
      ['Décompte', 'En jours ouvrables, tous les jours sauf le dimanche et les fériés chômés : une semaine de congé compte 6 jours. En jours ouvrés, les jours travaillés dans l\'entreprise (5 par semaine en général).'],
      ['Calcul simplifié', 'L\'outil répartit l\'acquisition au prorata des jours de chaque mois. Le Code assimile aussi à un mois de travail effectif quatre semaines ou 24 jours de travail (art. L3141-4) : en cas de doute sur un cas précis, ton gestionnaire de paie ou ta convention font foi.'],
    ],
    sources: [
      ['Code du travail, art. L3141-3 (2,5 jours ouvrables par mois, 30 jours au plus)', 'https://code.travail.gouv.fr/code-du-travail/l3141-3'],
      ['Code du travail, art. L3141-5 (périodes assimilées à du travail effectif)', 'https://code.travail.gouv.fr/code-du-travail/l3141-5'],
      ['Code du travail, art. L3141-5-1 (arrêt maladie non professionnel : 2 jours par mois, 24 au plus ; loi n° 2024-364 du 22/04/2024)', 'https://code.travail.gouv.fr/code-du-travail/l3141-5-1'],
      ['Code du travail, art. L3141-7 (arrondi au nombre entier supérieur)', 'https://code.travail.gouv.fr/code-du-travail/l3141-7'],
      ['Code du travail, art. R3141-4 (période de référence au 1er juin)', 'https://code.travail.gouv.fr/code-du-travail/r3141-4'],
      ['Code du travail, art. L3133-1 (les 11 fêtes légales)', 'https://code.travail.gouv.fr/code-du-travail/l3133-1'],
    ],
    sourceRegles: 'Règles relevées le 14/11/2026 sur code.travail.gouv.fr (articles L3141-3, L3141-5, L3141-5-1, L3141-7, R3141-4, L3133-1). L\'équivalence en jours ouvrés (× 5/6) est une pratique courante, pas un texte : à vérifier selon ta convention.',
  };
})();
