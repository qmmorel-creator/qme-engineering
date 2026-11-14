// Base intégrée des remboursements santé : familles et types de soins, couleurs, conseils, modèles de relance.
// Contenu original rédigé pour QME. Aucun tarif, aucun taux de remboursement, aucun délai officiel : les montants
// attendus et les délais de relance sont saisis par l'utilisateur. Rien ne se périme dans ce fichier.
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Familles de soins (totaux du bilan, utiles pour comparer sa complémentaire) et types de soins.
    // Noms génériques, sans diagnostic : le type de soin suffit à suivre un remboursement.
    familles: [
      { id: 'consultations', nom: 'Consultations', types: [
        ['generaliste', 'Médecin généraliste'],
        ['specialiste', 'Médecin spécialiste'],
        ['teleconsultation', 'Téléconsultation'],
        ['sage-femme', 'Sage-femme'],
      ] },
      { id: 'dentaire', nom: 'Dentaire', types: [
        ['dentiste', 'Soins dentaires (consultation, détartrage)'],
        ['prothese-dentaire', 'Prothèse dentaire (couronne, bridge)'],
        ['orthodontie', 'Orthodontie'],
        ['implant', 'Implant dentaire'],
      ] },
      { id: 'optique', nom: 'Optique', types: [
        ['lunettes', 'Lunettes (monture et verres)'],
        ['lentilles', 'Lentilles de contact'],
        ['orthoptiste', 'Orthoptiste'],
      ] },
      { id: 'audition', nom: 'Audition', types: [
        ['aides-auditives', 'Aides auditives'],
        ['audition-entretien', 'Piles, entretien ou réglage'],
      ] },
      { id: 'pharmacie', nom: 'Pharmacie', types: [
        ['pharmacie', 'Médicaments sur ordonnance'],
        ['pharmacie-materiel', 'Matériel médical et pansements'],
        ['vaccin', 'Vaccin'],
      ] },
      { id: 'auxiliaires', nom: 'Auxiliaires médicaux', types: [
        ['kine', 'Kinésithérapie'],
        ['infirmier', 'Soins infirmiers'],
        ['orthophonie', 'Orthophonie'],
        ['podologue', 'Pédicure-podologue'],
      ] },
      { id: 'examens', nom: 'Analyses et imagerie', types: [
        ['laboratoire', 'Analyses de laboratoire'],
        ['radiologie', 'Radiologie et échographie'],
        ['imagerie-lourde', 'IRM ou scanner'],
      ] },
      { id: 'hopital', nom: 'Hôpital', types: [
        ['hospitalisation', 'Hospitalisation'],
        ['chambre', 'Chambre particulière'],
        ['urgences', 'Passage aux urgences'],
        ['transport', 'Transport sanitaire'],
      ] },
      { id: 'douces', nom: 'Médecines douces et bien-être', types: [
        ['osteopathe', 'Ostéopathie'],
        ['psychologue', 'Psychologue'],
        ['dieteticien', 'Diététicien'],
      ] },
      { id: 'autres', nom: 'Autres', types: [
        ['cure', 'Cure thermale'],
        ['appareillage', 'Appareillage et orthèses'],
        ['autre', 'Autre soin'],
      ] },
    ],

    // Couleurs des membres du foyer, dans l'ordre fixe de la charte (jamais générées).
    couleurs: ['#2E5A88', '#E8B93A', '#B84A34', '#24221F', '#6E685F', '#22476E', '#8A3322', '#6E5310'],

    // Trois cas par organisme.
    modes: [
      { id: 'attendu', nom: 'Remboursement attendu', aide: 'Tu as payé et tu attends ton remboursement.' },
      { id: 'tiers', nom: 'Tiers payant', aide: 'Payé directement au praticien : rien à attendre.' },
      { id: 'aucun', nom: 'Pas de prise en charge', aide: 'Cet organisme ne rembourse pas ce soin.' },
    ],

    organismes: {
      ss: { court: 'Sécu', nom: 'Sécurité sociale', long: 'l\'Assurance Maladie' },
      mut: { court: 'Mutuelle', nom: 'Mutuelle', long: 'ta complémentaire santé' },
    },

    // Délais de départ (jours) : valeurs choisies pour l'outil, sans valeur officielle, réglables.
    delais: { ss: 30, mut: 30, relance: 15 },

    conseils: [
      ['Note le soin le jour même', 'Le type de soin, la date et ce que tu as payé suffisent. Aucun diagnostic n\'est demandé.'],
      ['Reprends les montants attendus du décompte ou du devis', 'L\'outil ne contient aucun taux de remboursement : c\'est ton relevé qui fait foi.'],
      ['Coche « reçu » quand l\'argent arrive', 'Le reste à charge se calcule et les retards apparaissent seuls.'],
      ['Relance au bon moment', 'Après le délai que tu choisis, un message de relance prêt à copier s\'affiche.'],
    ],

    // Modèles de relance. Champs remplacés : {organisme} {soin} {date} {montant} {attendu} {transmis} {personne} {reference} {prenom}
    relances: {
      ss: 'Objet : remboursement en attente\n\nBonjour,\n\nJe n\'ai pas encore reçu le remboursement du soin suivant :\n- {soin} du {date} ({personne})\n- montant payé : {montant}\n{transmis}{reference}\nPourriez-vous me dire où en est ce remboursement, ou ce qu\'il manque à mon dossier\u00a0?\n\nMerci d\'avance,\n{prenom}\n[Ton numéro de sécurité sociale, à ajouter au moment d\'envoyer]',
      mut: 'Objet : remboursement complémentaire en attente\n\nBonjour,\n\nJe n\'ai pas encore reçu le remboursement de {organisme} pour le soin suivant :\n- {soin} du {date} ({personne})\n- montant payé : {montant}\n- remboursement attendu : {attendu}\n{transmis}{reference}\nPourriez-vous me dire où en est ce remboursement, ou quelle pièce vous manque\u00a0?\n\nMerci d\'avance,\n{prenom}\n[Ton numéro d\'adhérent, à ajouter au moment d\'envoyer]',
    },
  };
})();
