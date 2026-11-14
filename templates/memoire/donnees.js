// Base intégrée du planning de mémoire ou de thèse : types de travaux, jalons types (rétroplanning relatif à la
// date de rendu ou de soutenance), plans de départ, statuts, couleurs, conseils.
// Aucune règle d'établissement intégrée : les délais des jalons sont des repères indicatifs, sans valeur
// réglementaire, modifiables jalon par jalon. Le nombre de mots visé, les dates de rendu et de soutenance et
// le calendrier de l'école doctorale se saisissent d'après les consignes de chaque établissement.
window.BASE = {
  version: '2026-11-14',

  // Valeurs de départ proposées au premier lancement (modifiables, sans valeur officielle).
  types: {
    master: { nom: 'Mémoire de master', court: 'Mémoire', mots: 20000, duree: 180 },
    pfe: { nom: 'Projet de fin d\'études (PFE)', court: 'Rapport de PFE', mots: 12000, duree: 150 },
    these: { nom: 'Thèse de doctorat', court: 'Thèse', mots: 80000, duree: 1095 },
    autre: { nom: 'Autre travail long', court: 'Travail', mots: 15000, duree: 120 },
  },
  motsParPage: 300,

  // Jalons types : `decalage` en jours par rapport à l'ancre (négatif = avant). Les jalons ancrés au rendu sont
  // resserrés à la même proportion quand le temps disponible depuis la date de début est plus court que le
  // modèle. `fin` : jalon qui marque la fin de la rédaction (échéance du rythme en mots par jour).
  jalons: {
    master: [
      ['Sujet et problématique validés', 'rendu', -165],
      ['Bibliographie de départ constituée', 'rendu', -140],
      ['Plan détaillé validé avec le directeur', 'rendu', -120],
      ['Recueil des données terminé (terrain, corpus, enquête)', 'rendu', -80],
      ['Premier jet de la moitié des chapitres', 'rendu', -55],
      ['Premier jet complet', 'rendu', -30, true],
      ['Version envoyée au directeur pour relecture', 'rendu', -25],
      ['Corrections du directeur intégrées', 'rendu', -10],
      ['Bibliographie, annexes, mise en page et relecture', 'rendu', -4],
      ['Rendu du mémoire', 'rendu', 0],
      ['Diaporama de soutenance prêt', 'soutenance', -7],
      ['Répétition de la soutenance', 'soutenance', -3],
      ['Soutenance', 'soutenance', 0],
    ],
    pfe: [
      ['Cahier des charges et objectifs validés avec le tuteur', 'rendu', -140],
      ['Plan du rapport validé', 'rendu', -90],
      ['Point d\'étape à mi-parcours (rapport intermédiaire)', 'rendu', -75],
      ['Résultats techniques figés', 'rendu', -35],
      ['Premier jet complet du rapport', 'rendu', -21, true],
      ['Relecture par le tuteur entreprise et l\'encadrant école', 'rendu', -14],
      ['Vérification de la confidentialité avec l\'entreprise', 'rendu', -10],
      ['Corrections, résumé, annexes et mise en page', 'rendu', -3],
      ['Rendu du rapport', 'rendu', 0],
      ['Diaporama de soutenance prêt', 'soutenance', -7],
      ['Répétition de la soutenance', 'soutenance', -2],
      ['Soutenance', 'soutenance', 0],
    ],
    these: [
      ['Plan détaillé de la thèse validé', 'rendu', -540],
      ['État de l\'art rédigé', 'rendu', -420],
      ['Chapitre de méthode rédigé', 'rendu', -330],
      ['Premier chapitre de résultats rédigé', 'rendu', -240],
      ['Deuxième chapitre de résultats rédigé', 'rendu', -170],
      ['Troisième chapitre de résultats rédigé', 'rendu', -110],
      ['Introduction et conclusion générales rédigées', 'rendu', -75],
      ['Manuscrit complet envoyé au directeur', 'rendu', -60, true],
      ['Corrections du directeur intégrées', 'rendu', -25],
      ['Relecture finale, bibliographie et mise en page', 'rendu', -7],
      ['Dépôt du manuscrit (date fixée avec l\'école doctorale)', 'rendu', 0],
      ['Diaporama de soutenance prêt', 'soutenance', -10],
      ['Soutenance blanche', 'soutenance', -5],
      ['Soutenance', 'soutenance', 0],
    ],
    autre: [
      ['Sujet et plan validés', 'rendu', -90],
      ['Premier jet de la moitié', 'rendu', -45],
      ['Premier jet complet', 'rendu', -20, true],
      ['Relecture et corrections', 'rendu', -7],
      ['Rendu', 'rendu', 0],
    ],
  },

  // Plans de départ : [profondeur (0 à la racine, 1 sous la partie qui précède), titre, part des mots visés en %].
  // Une entrée de racine à 0 % est une partie (elle reçoit les chapitres qui la suivent) ; les autres sont des
  // chapitres. Les sections s'ajoutent ensuite dans l'application.
  plans: {
    master: [
      [0, 'Introduction', 8],
      [0, 'Partie 1 · Cadre théorique', 0],
      [1, 'Chapitre 1 · Revue de la littérature', 18],
      [1, 'Chapitre 2 · Problématique et hypothèses', 10],
      [0, 'Partie 2 · Étude', 0],
      [1, 'Chapitre 3 · Méthodologie', 14],
      [1, 'Chapitre 4 · Résultats', 22],
      [1, 'Chapitre 5 · Discussion', 18],
      [0, 'Conclusion', 6],
      [0, 'Bibliographie et annexes', 4],
    ],
    pfe: [
      [0, 'Introduction et présentation de l\'entreprise', 10],
      [0, 'Contexte et cahier des charges', 12],
      [0, 'État de l\'art et solutions existantes', 14],
      [0, 'Solution proposée', 20],
      [0, 'Mise en œuvre et résultats', 24],
      [0, 'Bilan technique, économique et personnel', 12],
      [0, 'Conclusion et perspectives', 5],
      [0, 'Bibliographie, glossaire et annexes', 3],
    ],
    these: [
      [0, 'Introduction générale', 6],
      [0, 'Partie I · État de l\'art', 0],
      [1, 'Chapitre 1', 10],
      [1, 'Chapitre 2', 10],
      [0, 'Partie II · Méthode', 0],
      [1, 'Chapitre 3', 12],
      [0, 'Partie III · Résultats', 0],
      [1, 'Chapitre 4', 15],
      [1, 'Chapitre 5', 15],
      [1, 'Chapitre 6', 14],
      [0, 'Discussion générale', 10],
      [0, 'Conclusion générale et perspectives', 5],
      [0, 'Bibliographie et annexes', 3],
    ],
    autre: [
      [0, 'Introduction', 10],
      [0, 'Développement, partie 1', 40],
      [0, 'Développement, partie 2', 40],
      [0, 'Conclusion', 10],
    ],
  },

  // Poids des statuts dans l'avancement (une section « relue » compte pour 80 %).
  statuts: [
    { code: 'aecrire', nom: 'À écrire', poids: 0 },
    { code: 'brouillon', nom: 'Brouillon', poids: 0.5 },
    { code: 'relu', nom: 'Relu', poids: 0.8 },
    { code: 'final', nom: 'Final', poids: 1 },
  ],

  typesReference: ['Article', 'Ouvrage', 'Chapitre d\'ouvrage', 'Thèse ou mémoire', 'Rapport', 'Communication', 'Page web', 'Données ou logiciel', 'Autre'],

  // Rampe séquentielle d'un seul bleu (à écrire → final), validée avec le skill dataviz : ordre fixe.
  couleursStatut: { aecrire: '#E4DCCE', brouillon: '#B7CBE4', relu: '#6F95C6', final: '#2E62A8' },

  conseils: [
    ['Pose ton projet', 'Type de travail, date de rendu et de soutenance, nombre de mots visé d\'après les consignes de ton établissement.'],
    ['Construis ton plan', 'Parties, chapitres, sections, chacun avec son statut (à écrire, brouillon, relu, final) et ses mots, recopiés de ton traitement de texte.'],
    ['Tiens le rythme', 'Le rétroplanning part de ta date de rendu ; le template calcule les mots par jour qu\'il te reste à écrire et note ton avancement chaque jour.'],
    ['Garde le fil', 'Rendez-vous avec ton directeur (points abordés, actions à faire), bibliographie lue ou à lire, journal de tes séances de travail.'],
  ],
};
