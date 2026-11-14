// Matrice compétences et formations QME · base intégrée (aucune logique).
// Référentiel générique de compétences transverses et modèles de postes, rédigés pour QME sans source
// externe : à adapter à chaque entreprise. Aucune personne, aucune marque, aucun organisme cité.
(function (racine) {
  'use strict';
  const c = (id, nom, desc, critique = false) => ({ id, nom, desc, critique });
  racine.BASE = {
    version: '2026-11-14',
    // Échelle par défaut (0 à 4), libellés modifiables dans le référentiel.
    echelle: [
      { nom: 'Non acquis', desc: 'Ne connaît pas encore la compétence.' },
      { nom: 'Notions', desc: 'Connaît le principe, a besoin d\'aide pour l\'appliquer.' },
      { nom: 'Opérationnel', desc: 'Réalise seul les situations courantes.' },
      { nom: 'Maîtrise', desc: 'Gère les situations difficiles ou inhabituelles sans aide.' },
      { nom: 'Expert', desc: 'Fait référence, peut former et faire évoluer les pratiques.' },
    ],
    domaines: [
      { id: 'bureautique', nom: 'Bureautique et numérique', competences: [
        c('bur-texte', 'Traitement de texte et mise en page', 'Documents structurés, styles, modèles, publipostage simple.'),
        c('bur-tableur', 'Tableur : formules et tableaux de synthèse', 'Formules courantes, filtres, tableaux croisés, graphiques.'),
        c('bur-presentation', 'Supports de présentation', 'Diaporama clair, lisible et à la charte de l\'entreprise.'),
        c('bur-messagerie', 'Messagerie et agenda partagés', 'Classement, règles, invitations, partage de calendrier.'),
        c('bur-fichiers', 'Partage et classement des fichiers', 'Arborescence commune, nommage, versions, droits d\'accès.'),
        c('bur-cyber', 'Bonnes pratiques de cybersécurité', 'Mots de passe, hameçonnage, mises à jour, signalement d\'un incident.', true),
      ] },
      { id: 'securite', nom: 'Sécurité et prévention', competences: [
        c('sec-risques', 'Connaissance des risques du poste', 'Risques identifiés pour le poste et mesures de prévention associées.', true),
        c('sec-secours', 'Gestes de premiers secours', 'Protéger, alerter, secourir en attendant les secours.', true),
        c('sec-incendie', 'Évacuation et première intervention incendie', 'Consignes, rôle de guide-file ou serre-file, usage d\'un extincteur.', true),
        c('sec-epi', 'Équipements de protection individuelle', 'Choix, port, entretien et remplacement des équipements.'),
        c('sec-gestes', 'Gestes et postures', 'Manutention, port de charges, aménagement du poste.'),
        c('sec-electrique', 'Consignes de sécurité électrique', 'Travail à proximité d\'installations électriques selon les autorisations de l\'entreprise.', true),
      ] },
      { id: 'management', nom: 'Management', competences: [
        c('man-entretiens', 'Conduite des entretiens individuels', 'Préparer, mener et formaliser un entretien annuel ou professionnel.'),
        c('man-objectifs', 'Fixer et suivre des objectifs', 'Objectifs clairs, mesurables, revus régulièrement.'),
        c('man-delegation', 'Délégation et suivi', 'Confier une mission, donner le cadre, suivre sans reprendre la main.'),
        c('man-retour', 'Donner un retour constructif', 'Reconnaître, recadrer sur des faits, proposer une suite.'),
        c('man-tensions', 'Gestion des tensions et des désaccords', 'Repérer, écouter les parties, faire émerger une solution.'),
        c('man-accueil', 'Recrutement et intégration', 'Définir le besoin, mener un entretien, accueillir un nouvel arrivant.'),
      ] },
      { id: 'qualite', nom: 'Qualité et amélioration continue', competences: [
        c('qua-procedures', 'Application des procédures', 'Connaît et applique les procédures et modes opératoires du poste.'),
        c('qua-ecarts', 'Traitement des non-conformités', 'Signaler, analyser, proposer une action corrective.'),
        c('qua-resolution', 'Résolution de problèmes', 'Méthodes simples : causes, actions, vérification de l\'efficacité.'),
        c('qua-indicateurs', 'Suivi d\'indicateurs', 'Lire, mettre à jour et commenter les indicateurs du service.'),
        c('qua-audit', 'Audit interne', 'Préparer, conduire et restituer un audit interne.'),
      ] },
      { id: 'relation', nom: 'Communication et relation client', competences: [
        c('rel-accueil', 'Accueil et écoute', 'Accueil physique et téléphonique, reformulation du besoin.'),
        c('rel-ecrit', 'Communication écrite professionnelle', 'Courriels, comptes rendus, courriers clairs et sans faute.'),
        c('rel-oral', 'Prise de parole en réunion', 'Présenter un sujet, défendre une proposition, tenir le temps.'),
        c('rel-reclamation', 'Traitement des réclamations', 'Écouter, qualifier, proposer une réponse et la suivre.'),
        c('rel-negociation', 'Négociation commerciale', 'Préparer, argumenter, traiter les objections, conclure.'),
        c('rel-anglais', 'Anglais professionnel', 'Échanges écrits et oraux courants avec des interlocuteurs étrangers.'),
      ] },
      { id: 'projet', nom: 'Gestion de projet', competences: [
        c('pro-planning', 'Planification et jalons', 'Découper, estimer, planifier et suivre l\'avancement.'),
        c('pro-budget', 'Suivi budgétaire', 'Prévu, engagé, réalisé ; alerter en cas de dérive.'),
        c('pro-risques', 'Analyse des risques projet', 'Identifier, coter et traiter les risques d\'un projet.'),
        c('pro-animation', 'Animation de réunions', 'Ordre du jour, tour de table, décisions et actions notées.'),
        c('pro-reporting', 'Reporting et tableaux de bord', 'Synthèse régulière, factuelle et lisible pour la direction.'),
      ] },
      { id: 'organisation', nom: 'Organisation et transmission', competences: [
        c('org-priorites', 'Gestion des priorités', 'Distinguer l\'urgent de l\'important, arbitrer, prévenir.'),
        c('org-temps', 'Organisation du temps', 'Planifier sa semaine, tenir ses délais, anticiper les pics.'),
        c('org-modes', 'Rédaction de modes opératoires', 'Décrire une tâche pour qu\'un autre puisse la réaliser.'),
        c('org-tutorat', 'Transmission des savoir-faire', 'Tutorat, compagnonnage, accompagnement d\'un nouvel arrivant.', true),
      ] },
      { id: 'technique', nom: 'Technique et production', competences: [
        c('tec-preventif', 'Maintenance préventive', 'Réaliser les opérations planifiées et tracer les interventions.'),
        c('tec-diagnostic', 'Diagnostic de panne', 'Méthode de recherche de cause, remise en service, compte rendu.', true),
        c('tec-plans', 'Lecture de plans et de schémas', 'Plans, schémas électriques ou hydrauliques, nomenclatures.'),
        c('tec-controle', 'Contrôles et mesures', 'Instruments de mesure, relevés, comparaison aux tolérances.'),
        c('tec-stocks', 'Réception et gestion des stocks', 'Contrôle à réception, rangement, inventaire, réapprovisionnement.'),
        c('tec-conduite', 'Conduite d\'équipements de manutention', 'Utilisation selon les autorisations délivrées par l\'entreprise.', true),
      ] },
    ],
    // Modèles de postes génériques : niveau requis (échelle 0 à 4) par compétence.
    postes: [
      { id: 'assistant', nom: 'Assistant(e) administratif(ve)', requis: { 'bur-texte': 3, 'bur-tableur': 2, 'bur-messagerie': 3, 'bur-fichiers': 3, 'bur-cyber': 2, 'rel-accueil': 3, 'rel-ecrit': 3, 'org-priorites': 2, 'org-temps': 2, 'qua-procedures': 2, 'sec-incendie': 1 } },
      { id: 'clientele', nom: 'Chargé(e) de clientèle', requis: { 'rel-accueil': 3, 'rel-reclamation': 3, 'rel-ecrit': 2, 'rel-oral': 2, 'bur-messagerie': 2, 'bur-tableur': 1, 'bur-cyber': 2, 'org-priorites': 2, 'qua-procedures': 2 } },
      { id: 'commercial', nom: 'Commercial(e)', requis: { 'rel-negociation': 3, 'rel-oral': 3, 'rel-ecrit': 2, 'rel-anglais': 2, 'bur-tableur': 2, 'bur-presentation': 3, 'pro-reporting': 2, 'org-temps': 3, 'bur-cyber': 2 } },
      { id: 'technicien', nom: 'Technicien(ne) de maintenance', requis: { 'tec-preventif': 3, 'tec-diagnostic': 3, 'tec-plans': 2, 'tec-controle': 2, 'sec-risques': 3, 'sec-epi': 3, 'sec-electrique': 2, 'sec-secours': 1, 'sec-gestes': 2, 'qua-procedures': 3, 'qua-ecarts': 2, 'org-modes': 1 } },
      { id: 'logistique', nom: 'Agent(e) logistique', requis: { 'tec-stocks': 3, 'tec-conduite': 2, 'sec-risques': 2, 'sec-epi': 2, 'sec-gestes': 3, 'sec-incendie': 1, 'qua-procedures': 2, 'bur-tableur': 1 } },
      { id: 'chef-equipe', nom: 'Chef(fe) d\'équipe', requis: { 'man-objectifs': 2, 'man-retour': 2, 'man-delegation': 2, 'man-tensions': 2, 'sec-risques': 3, 'sec-secours': 2, 'qua-resolution': 2, 'qua-indicateurs': 2, 'pro-animation': 2, 'org-tutorat': 3, 'org-priorites': 3 } },
      { id: 'manager', nom: 'Manager', requis: { 'man-entretiens': 3, 'man-objectifs': 3, 'man-delegation': 3, 'man-retour': 3, 'man-tensions': 3, 'man-accueil': 2, 'pro-budget': 2, 'pro-reporting': 2, 'rel-oral': 3, 'bur-tableur': 2, 'org-priorites': 3 } },
      { id: 'chef-projet', nom: 'Chef(fe) de projet', requis: { 'pro-planning': 3, 'pro-budget': 3, 'pro-risques': 3, 'pro-animation': 3, 'pro-reporting': 3, 'rel-oral': 3, 'rel-ecrit': 3, 'bur-tableur': 3, 'bur-presentation': 3, 'man-delegation': 2, 'rel-anglais': 2 } },
      { id: 'qualite', nom: 'Responsable qualité', requis: { 'qua-procedures': 4, 'qua-ecarts': 4, 'qua-resolution': 3, 'qua-indicateurs': 3, 'qua-audit': 3, 'org-modes': 3, 'pro-animation': 2, 'rel-ecrit': 3, 'sec-risques': 2 } },
    ],
    conseils: [
      ['Partir du poste', 'Chaque poste dit quel niveau il demande : les écarts se calculent tout seuls pour chaque personne.'],
      ['Évaluer sur des faits', 'Un niveau décrit ce que la personne sait faire au travail, observé ou discuté en entretien. Jamais une sanction.'],
      ['Surveiller les compétences rares', 'Une compétence critique tenue par une seule personne est un risque : la matrice le signale.'],
      ['Former là où ça compte', 'Le plan de formation part des écarts, avec son coût, sa date et le niveau atteint ensuite.'],
    ],
    // Rampes de la matrice (un seul ton, du clair au foncé), validées pour 3, 4 et 5 niveaux non nuls
    // (luminosité monotone, écarts visibles, extrémité claire ≥ 2:1 sur fond blanc). Le niveau 0 est un fond neutre.
    rampes: {
      3: ['#9DB8D6', '#5F87B5', '#2E5A88'],
      4: ['#9DB8D6', '#6E93BC', '#45709F', '#24466C'],
      5: ['#9DB8D6', '#7397C0', '#4F79A7', '#2E5A88', '#1C3A5A'],
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
