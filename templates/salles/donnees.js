// Base intégrée de la réservation de salles et bureaux : types de ressources, équipements de salle,
// réglages par défaut, conseils, couleurs fixes des ressources, sources des jours fériés.
// Contenu original rédigé pour QME. Seule donnée réglementaire : la liste des jours fériés (calculée dans
// regles.js), relevée le 14/11/2026 ; à revérifier si la loi change.
(() => {
  window.BASE = {
    version: '2026-11-14',

    types: [
      { id: 'salle', nom: 'Salle', pluriel: 'Salles', aide: 'Salle de réunion, de formation, d\'activité : capacité et équipements.' },
      { id: 'bureau', nom: 'Bureau', pluriel: 'Bureaux', aide: 'Poste de travail en flex office, cabine, bureau fermé.' },
      { id: 'equipement', nom: 'Équipement', pluriel: 'Équipements', aide: 'Matériel prêté pour quelques heures : vidéoprojecteur portable, kit de visio…' },
    ],

    // Équipements que l'on coche sur une salle (liste ouverte : l'utilisateur peut en ajouter).
    equipements: ['Écran', 'Vidéoprojecteur', 'Visioconférence', 'Tableau blanc', 'Paperboard', 'Téléphone de conférence', 'Prises au plateau', 'Accès de plain-pied', 'Point d\'eau', 'Lumière du jour'],

    reglages: {
      ouverture: '08:00',
      fermeture: '19:00',
      jours: [1, 2, 3, 4, 5],   // 0 = dimanche … 6 = samedi
      pas: 30,                  // minutes
      dureeMax: null,           // minutes, null = sans limite
      avanceMax: 90,            // jours, null = sans limite
      feries: true,             // fermé les jours fériés
      alsaceMoselle: false,     // ajoute le Vendredi saint et le 26 décembre
    },

    // Couleurs des ressources, dans cet ordre (jamais générées). Palette catégorielle validée (lumière, chroma,
    // daltonisme) ; toujours accompagnée du nom de la ressource, jamais seule porteuse de l'information.
    couleurs: ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#6250D6', '#E34948'],
    // Carte des heures (occupation) : une seule teinte, du clair au foncé.
    rampe: ['#F3EDE3', '#CDE2FB', '#9EC5F4', '#6DA7EC', '#3987E5', '#256ABF', '#184F95', '#0D366B'],

    conseils: [
      ['Une clé pour toute l\'équipe', 'Partage la clé de licence avec les personnes qui réservent : chacune la saisit une fois sur son appareil, et tout le monde voit les mêmes réservations, sur ordinateur comme sur téléphone.'],
      ['Ton nom à chaque réservation', 'Pas de compte à créer : chacun saisit son nom (un prénom suffit). Il est retenu sur ton appareil pour la fois suivante.'],
      ['Aucune double réservation', 'Une salle déjà prise sur un créneau est refusée, même si deux personnes réservent au même moment depuis deux appareils.'],
      ['Libre maintenant', 'L\'écran « Maintenant » montre ce qui est libre et jusqu\'à quand : idéal sur une tablette à l\'entrée.'],
    ],

    sourceFeries: 'Jours fériés calculés chaque année (1er janvier, lundi de Pâques, 1er mai, 8 mai, Ascension, lundi de Pentecôte, 14 juillet, 15 août, 1er novembre, 11 novembre, 25 décembre ; en Alsace-Moselle, Vendredi saint et 26 décembre en plus). Liste du Code du travail (art. L3133-1) relevée le 14/11/2026 ; un jour férié n\'est pas forcément chômé dans ton organisation : désactive l\'option si tu ouvres ces jours-là.',
    sources: [
      ['Service-public.gouv.fr, « Jours fériés et ponts dans le secteur privé » (fiche F2405, vérifiée le 01/01/2026 par la DILA, consultée le 14/11/2026)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2405'],
    ],
  };
})();
