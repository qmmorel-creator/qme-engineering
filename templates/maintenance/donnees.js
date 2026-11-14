// Base intégrée de Maintenance préventive : familles d'équipements et plans de maintenance types,
// obligations sourcées, unités de compteur, criticités, motifs de panne, conseils. Aucune logique ici.
// Contenu original rédigé pour QME. Les périodicités d'entretien sont des repères indicatifs (pratiques
// courantes, non sourcées) : la notice du fabricant prime. Seules deux obligations réglementaires portent
// une périodicité, avec leur source (donnée datée : à revoir chaque année). Les autres vérifications
// réglementaires n'ont pas de périodicité en base : l'utilisateur la saisit après vérification du texte.
(() => {
  window.BASE = {
    version: '2026-11-14',
    verifieLe: '2026-11-13',

    reglages: {
      alerteJours: 14,        // « bientôt » : échéance sous ce nombre de jours
      alerteCompteurPct: 10,  // « bientôt » : reste au compteur sous ce % de l'intervalle
      toleranceJours: 7,      // ponctualité : fait au plus tard à l'échéance + tolérance
      periodeIndicateurs: 90, // jours analysés par les indicateurs
      tauxHoraire: 0,         // main-d'œuvre interne, centimes HT par heure (0 : non chiffrée)
      prefixeBon: 'BI',
    },

    unitesCompteur: [
      { code: 'h', nom: 'Heures de fonctionnement', court: 'h' },
      { code: 'cycles', nom: 'Cycles', court: 'cycles' },
      { code: 'km', nom: 'Kilomètres', court: 'km' },
      { code: 'unites', nom: 'Unités produites', court: 'unités' },
    ],

    criticites: [
      { code: 'A', nom: 'Critique', detail: 'Son arrêt bloque la production, le site ou la sécurité.' },
      { code: 'B', nom: 'Importante', detail: 'Son arrêt gêne, une solution de secours existe.' },
      { code: 'C', nom: 'Secondaire', detail: 'Son arrêt a peu de conséquences immédiates.' },
    ],

    natures: {
      entretien: { nom: 'Entretien', detail: 'Opération systématique : nettoyage, vidange, remplacement.' },
      controle: { nom: 'Contrôle', detail: 'Inspection, mesure ou essai, sans démontage.' },
      reglementaire: { nom: 'Réglementaire', detail: 'Vérification imposée par un texte : périodicité et référence à saisir.' },
    },

    // Obligations sourcées (donnée datée, relue le verifieLe). Reprises de la base de l'Entretien de la maison.
    regles: {
      chaudiere: {
        titre: 'Entretien annuel des chaudières de 4 à 400 kW',
        texte: 'Chaudières gaz, fioul, bois ou charbon de 4 à 400 kW : un entretien par année civile, par un professionnel qualifié, qui remet une attestation à conserver.',
        source: 'Code de l\'environnement, art. R224-41-4 à R224-41-9 ; arrêté du 15 septembre 2009.',
      },
      thermodynamique: {
        titre: 'Entretien des pompes à chaleur et climatisations de 4 à 70 kW',
        texte: 'Au plus deux ans entre deux entretiens, par un professionnel, avec attestation. Au-delà de 70 kW, d\'autres règles s\'appliquent (inspection) : vérifie le texte.',
        source: 'Code de l\'environnement, art. R224-44 à R224-44-5 (décret n° 2020-912 du 28 juillet 2020) ; arrêté du 24 juillet 2020.',
      },
    },

    // Familles et plans types. p : périodicité à la date [nombre, unité] (j, s, m, a) ou null ;
    // c : intervalle au compteur (unité de la famille) ou null ; d : durée estimée en minutes ;
    // qui : interne ou prestataire ; regle : obligation sourcée ; points : contrôles à cocher.
    familles: [
      { id: 'compresseur', nom: 'Compresseur d\'air', compteur: 'h', plan: [
        { code: 'cmp-hebdo', nom: 'Contrôle hebdomadaire', nature: 'controle', p: [1, 's'], c: null, d: 10, qui: 'interne', points: ['Purger les condensats', 'Contrôler le niveau d\'huile', 'Écouter les fuites d\'air sur le réseau'] },
        { code: 'cmp-filtre', nom: 'Filtre à air : nettoyage ou remplacement', nature: 'entretien', p: [6, 'm'], c: 2000, d: 20, qui: 'interne', points: ['Remplacer ou souffler la cartouche', 'Vérifier l\'indicateur de colmatage'] },
        { code: 'cmp-vidange', nom: 'Vidange et filtre à huile', nature: 'entretien', p: [12, 'm'], c: 4000, d: 60, qui: 'interne', points: ['Vidanger à chaud', 'Remplacer le filtre à huile', 'Refaire le niveau avec l\'huile préconisée', 'Noter le compteur'] },
        { code: 'cmp-separateur', nom: 'Séparateur air-huile', nature: 'entretien', p: null, c: 4000, d: 45, qui: 'interne', points: ['Remplacer l\'élément séparateur', 'Contrôler la pression différentielle'] },
        { code: 'cmp-reservoir', nom: 'Réservoir sous pression : vérification réglementaire', nature: 'reglementaire', p: null, c: null, d: 60, qui: 'prestataire', points: ['Examen extérieur du réservoir', 'Essai de la soupape de sûreté', 'Archiver le rapport'] },
      ] },
      { id: 'usinage', nom: 'Machine-outil (centre d\'usinage, tour, fraiseuse)', compteur: 'h', plan: [
        { code: 'usi-jour', nom: 'Contrôle de début de poste', nature: 'controle', p: [1, 'j'], c: null, d: 5, qui: 'interne', points: ['Niveaux de lubrifiant de glissières', 'Arrêt d\'urgence et carters', 'Copeaux évacués'] },
        { code: 'usi-graissage', nom: 'Graissage et niveaux', nature: 'entretien', p: [1, 'm'], c: 250, d: 30, qui: 'interne', points: ['Graisser les points du schéma constructeur', 'Compléter l\'huile de la centrale de lubrification', 'Contrôler le liquide de coupe (concentration)'] },
        { code: 'usi-coupe', nom: 'Bac de liquide de coupe : vidange et nettoyage', nature: 'entretien', p: [6, 'm'], c: null, d: 120, qui: 'interne', points: ['Vidanger et nettoyer le bac', 'Nettoyer les filtres', 'Préparer le nouveau mélange à la bonne concentration'] },
        { code: 'usi-geometrie', nom: 'Contrôle des jeux et de la géométrie', nature: 'controle', p: [12, 'm'], c: 2000, d: 180, qui: 'prestataire', points: ['Jeux des axes', 'Alignement de la broche', 'Rapport de mesure archivé'] },
      ] },
      { id: 'presse', nom: 'Presse et machine de production', compteur: 'cycles', plan: [
        { code: 'pre-securite', nom: 'Essai des sécurités', nature: 'controle', p: [1, 's'], c: null, d: 10, qui: 'interne', points: ['Barrières immatérielles', 'Commande bimanuelle', 'Arrêt d\'urgence'] },
        { code: 'pre-hydraulique', nom: 'Circuit hydraulique : niveau, fuites, filtre', nature: 'entretien', p: [3, 'm'], c: 200000, d: 45, qui: 'interne', points: ['Niveau et aspect de l\'huile', 'Fuites aux raccords et flexibles', 'Indicateur du filtre'] },
        { code: 'pre-outillage', nom: 'Contrôle de l\'outillage', nature: 'controle', p: null, c: 50000, d: 30, qui: 'interne', points: ['Usure des poinçons et matrices', 'Serrage des fixations'] },
        { code: 'pre-annuel', nom: 'Révision générale', nature: 'entretien', p: [12, 'm'], c: null, d: 240, qui: 'prestataire', points: ['Flexibles et joints', 'Freins et embrayage', 'Rapport archivé'] },
      ] },
      { id: 'chariot', nom: 'Chariot élévateur', compteur: 'h', plan: [
        { code: 'cha-prise', nom: 'Contrôle de prise de poste', nature: 'controle', p: [1, 'j'], c: null, d: 5, qui: 'interne', points: ['Freins et direction', 'Fourches et chaînes', 'Avertisseur et feux', 'Niveau de charge'] },
        { code: 'cha-batterie', nom: 'Batterie de traction : niveaux et nettoyage', nature: 'entretien', p: [1, 's'], c: null, d: 15, qui: 'interne', points: ['Niveau d\'électrolyte après charge', 'Bornes propres et serrées'] },
        { code: 'cha-revision', nom: 'Révision constructeur', nature: 'entretien', p: [12, 'm'], c: 1000, d: 120, qui: 'prestataire', points: ['Graissage du mât', 'Chaînes de levage', 'Circuit hydraulique', 'Rapport archivé'] },
        { code: 'cha-vgp', nom: 'Vérification générale périodique (appareil de levage)', nature: 'reglementaire', p: null, c: null, d: 60, qui: 'prestataire', points: ['Rapport de l\'organisme archivé', 'Observations levées'] },
      ] },
      { id: 'levage', nom: 'Pont roulant et palan', compteur: '', plan: [
        { code: 'lev-visuel', nom: 'Contrôle visuel des accessoires', nature: 'controle', p: [1, 'm'], c: null, d: 20, qui: 'interne', points: ['Câbles, chaînes, élingues', 'Crochets et linguets', 'Fin de course haut et bas'] },
        { code: 'lev-graissage', nom: 'Graissage du chemin de roulement et du câble', nature: 'entretien', p: [6, 'm'], c: null, d: 60, qui: 'interne', points: ['Graisser le câble', 'Contrôler l\'usure des galets'] },
        { code: 'lev-vgp', nom: 'Vérification générale périodique (appareil de levage)', nature: 'reglementaire', p: null, c: null, d: 90, qui: 'prestataire', points: ['Rapport de l\'organisme archivé', 'Observations levées'] },
      ] },
      { id: 'groupe', nom: 'Groupe électrogène', compteur: 'h', plan: [
        { code: 'gro-essai', nom: 'Essai de démarrage', nature: 'controle', p: [1, 'm'], c: null, d: 30, qui: 'interne', points: ['Démarrage et montée en régime', 'Tension et fréquence', 'Niveau de carburant', 'Noter le compteur'] },
        { code: 'gro-vidange', nom: 'Vidange, filtres huile, air et carburant', nature: 'entretien', p: [12, 'm'], c: 250, d: 90, qui: 'prestataire', points: ['Vidange et filtres', 'Liquide de refroidissement', 'Courroies'] },
        { code: 'gro-charge', nom: 'Essai en charge', nature: 'controle', p: [12, 'm'], c: null, d: 120, qui: 'prestataire', points: ['Essai sur charge réelle ou banc', 'Bascule de l\'inverseur de sources'] },
      ] },
      { id: 'chaudiere', nom: 'Chaudière et production de chaleur', compteur: '', plan: [
        { code: 'chd-annuel', nom: 'Entretien annuel par un professionnel', nature: 'reglementaire', p: [12, 'm'], c: null, d: 120, qui: 'prestataire', regle: 'chaudiere', points: ['Attestation d\'entretien archivée', 'Mesure de combustion notée'] },
        { code: 'chd-pression', nom: 'Contrôle de la pression du circuit', nature: 'controle', p: [1, 'm'], c: null, d: 10, qui: 'interne', points: ['Pression dans la plage', 'Purger l\'air si besoin', 'Absence de fuite'] },
        { code: 'chd-desembouage', nom: 'Désembouage du réseau', nature: 'entretien', p: [5, 'a'], c: null, d: 480, qui: 'prestataire', points: ['Qualité de l\'eau mesurée', 'Rapport archivé'] },
      ] },
      { id: 'clim', nom: 'Climatisation et pompe à chaleur', compteur: '', plan: [
        { code: 'cli-filtres', nom: 'Filtres des unités intérieures', nature: 'entretien', p: [3, 'm'], c: null, d: 30, qui: 'interne', points: ['Nettoyer ou remplacer les filtres', 'Bac et évacuation des condensats'] },
        { code: 'cli-exterieur', nom: 'Unité extérieure : nettoyage', nature: 'entretien', p: [6, 'm'], c: null, d: 30, qui: 'interne', points: ['Batterie dégagée et propre', 'Ventilateur libre'] },
        { code: 'cli-legal', nom: 'Entretien par un professionnel (4 à 70 kW)', nature: 'reglementaire', p: [24, 'm'], c: null, d: 120, qui: 'prestataire', regle: 'thermodynamique', points: ['Attestation d\'entretien archivée'] },
        { code: 'cli-etancheite', nom: 'Contrôle d\'étanchéité des fluides frigorigènes', nature: 'reglementaire', p: null, c: null, d: 60, qui: 'prestataire', points: ['Fiche d\'intervention archivée'] },
      ] },
      { id: 'cta', nom: 'Ventilation et traitement d\'air (CTA, VMC)', compteur: '', plan: [
        { code: 'cta-filtres', nom: 'Filtres : contrôle et remplacement', nature: 'entretien', p: [3, 'm'], c: null, d: 45, qui: 'interne', points: ['Perte de charge relevée', 'Filtres remplacés si encrassés'] },
        { code: 'cta-courroie', nom: 'Courroies et paliers', nature: 'controle', p: [6, 'm'], c: null, d: 30, qui: 'interne', points: ['Tension et usure des courroies', 'Bruit des paliers'] },
        { code: 'cta-bouches', nom: 'Bouches et gaines : nettoyage', nature: 'entretien', p: [12, 'm'], c: null, d: 120, qui: 'interne', points: ['Bouches démontées et nettoyées', 'Débits contrôlés'] },
      ] },
      { id: 'pompe', nom: 'Pompe et surpresseur', compteur: 'h', plan: [
        { code: 'pom-controle', nom: 'Contrôle de fonctionnement', nature: 'controle', p: [1, 'm'], c: null, d: 15, qui: 'interne', points: ['Bruit et vibrations', 'Fuite à la garniture', 'Flotteurs ou pressostat'] },
        { code: 'pom-nettoyage', nom: 'Nettoyage de la fosse ou du filtre', nature: 'entretien', p: [6, 'm'], c: null, d: 60, qui: 'interne', points: ['Fosse ou crépine nettoyée', 'Clapet anti-retour contrôlé'] },
        { code: 'pom-revision', nom: 'Révision (garniture, roulements)', nature: 'entretien', p: [36, 'm'], c: 15000, d: 180, qui: 'prestataire', points: ['Garniture mécanique', 'Roulements', 'Isolement du moteur'] },
      ] },
      { id: 'convoyeur', nom: 'Convoyeur et manutention', compteur: 'h', plan: [
        { code: 'con-bande', nom: 'Bande, tension et alignement', nature: 'controle', p: [1, 'm'], c: null, d: 20, qui: 'interne', points: ['Tension de la bande', 'Alignement', 'Racleurs'] },
        { code: 'con-graissage', nom: 'Graissage des paliers et motoréducteur', nature: 'entretien', p: [3, 'm'], c: 1000, d: 30, qui: 'interne', points: ['Paliers graissés', 'Niveau d\'huile du réducteur'] },
        { code: 'con-arret', nom: 'Essai des arrêts d\'urgence à câble', nature: 'controle', p: [1, 'm'], c: null, d: 10, qui: 'interne', points: ['Chaque tirette essayée', 'Réarmement'] },
      ] },
      { id: 'porte', nom: 'Porte, portail et quai automatiques', compteur: 'cycles', plan: [
        { code: 'por-securites', nom: 'Essai des sécurités', nature: 'controle', p: [1, 'm'], c: null, d: 15, qui: 'interne', points: ['Cellules et barre palpeuse', 'Arrêt d\'urgence', 'Débrayage manuel'] },
        { code: 'por-entretien', nom: 'Entretien périodique (porte automatique)', nature: 'reglementaire', p: null, c: null, d: 90, qui: 'prestataire', points: ['Rapport et livret d\'entretien à jour'] },
        { code: 'por-ressorts', nom: 'Ressorts, câbles et galets', nature: 'controle', p: null, c: 20000, d: 45, qui: 'prestataire', points: ['Ressorts équilibrés', 'Câbles sans effilochage', 'Galets graissés'] },
      ] },
      { id: 'electrique', nom: 'Installation électrique et tableaux', compteur: '', plan: [
        { code: 'ele-differentiels', nom: 'Essai des dispositifs différentiels', nature: 'controle', p: [6, 'm'], c: null, d: 30, qui: 'interne', points: ['Bouton test de chaque différentiel', 'Repérage du tableau à jour'] },
        { code: 'ele-thermo', nom: 'Thermographie des tableaux', nature: 'controle', p: [12, 'm'], c: null, d: 120, qui: 'prestataire', points: ['Points chauds relevés', 'Resserrages faits'] },
        { code: 'ele-verif', nom: 'Vérification périodique de l\'installation électrique', nature: 'reglementaire', p: null, c: null, d: 240, qui: 'prestataire', points: ['Rapport archivé', 'Observations levées'] },
      ] },
      { id: 'incendie', nom: 'Sécurité incendie et éclairage de sécurité', compteur: '', plan: [
        { code: 'inc-extincteurs', nom: 'Vérification des extincteurs', nature: 'reglementaire', p: null, c: null, d: 60, qui: 'prestataire', points: ['Étiquettes à jour', 'Accessibilité et signalisation'] },
        { code: 'inc-baes', nom: 'Éclairage de sécurité : essai', nature: 'reglementaire', p: null, c: null, d: 30, qui: 'interne', points: ['Allumage de chaque bloc', 'Autonomie', 'Registre de sécurité renseigné'] },
        { code: 'inc-alarme', nom: 'Alarme incendie : essai', nature: 'reglementaire', p: null, c: null, d: 30, qui: 'interne', points: ['Déclencheur manuel essayé', 'Audibilité', 'Registre de sécurité renseigné'] },
      ] },
      { id: 'cuisine', nom: 'Cuisine professionnelle (hotte, four, froid)', compteur: '', plan: [
        { code: 'cui-filtres', nom: 'Filtres de hotte : nettoyage', nature: 'entretien', p: [1, 's'], c: null, d: 20, qui: 'interne', points: ['Filtres dégraissés', 'Remontage contrôlé'] },
        { code: 'cui-froid', nom: 'Chambre froide : condenseur et joints', nature: 'entretien', p: [3, 'm'], c: null, d: 30, qui: 'interne', points: ['Condenseur dépoussiéré', 'Joints de porte', 'Température relevée'] },
        { code: 'cui-conduit', nom: 'Conduit d\'extraction : nettoyage', nature: 'reglementaire', p: null, c: null, d: 240, qui: 'prestataire', points: ['Certificat de nettoyage archivé'] },
      ] },
      { id: 'batiment', nom: 'Bâtiment (toiture, menuiseries, réseaux)', compteur: '', plan: [
        { code: 'bat-toiture', nom: 'Toiture, chéneaux et descentes', nature: 'controle', p: [6, 'm'], c: null, d: 120, qui: 'prestataire', points: ['Chéneaux dégagés', 'Couverture sans désordre visible'] },
        { code: 'bat-menuiseries', nom: 'Menuiseries et ferme-portes', nature: 'controle', p: [12, 'm'], c: null, d: 90, qui: 'interne', points: ['Ferme-portes réglés', 'Portes coupe-feu fermant seules'] },
        { code: 'bat-reseaux', nom: 'Réseaux d\'eau : purge des points peu utilisés', nature: 'entretien', p: [1, 'm'], c: null, d: 20, qui: 'interne', points: ['Points d\'eau peu utilisés purgés', 'Température d\'eau chaude relevée'] },
      ] },
    ],

    motifsPanne: ['Usure', 'Casse', 'Fuite', 'Défaut électrique', 'Mauvaise utilisation', 'Encrassement', 'Cause inconnue'],
    unitesPieces: ['pièce', 'lot', 'L', 'kg', 'm', 'boîte', 'jeu'],

    conseils: [
      ['Commence par les critiques', 'Crée d\'abord les équipements dont l\'arrêt bloque tout : leurs plans d\'abord, le reste ensuite.'],
      ['Relève les compteurs', 'Un relevé par semaine suffit : les échéances au compteur deviennent des dates estimées.'],
      ['Clôture chaque bon', 'Date, compteur, durée, pièces : c\'est ce qui recale l\'échéance suivante et calcule les coûts.'],
      ['Garde la notice', 'Les périodicités proposées sont des repères : la notice du fabricant et tes textes réglementaires priment.'],
    ],
  };
})();
