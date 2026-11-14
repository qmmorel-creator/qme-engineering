// Base intégrée du planning d'équipe et staffing : modèles d'équipe par secteur, couleurs, types d'absence,
// repères de durée du travail et sources. Contenu original rédigé pour QME, aucune logique ici.
// Les durées sont des PARAMÈTRES (relevées le 14/11/2026 sur code.travail.gouv.fr, site du ministère du
// Travail qui reproduit Légifrance) : une convention collective ou un accord peut prévoir autre chose ; tout
// se change dans les Réglages.
(() => {
  window.BASE = {
    version: '2026-11-14',

    reglages: {
      capaciteDefaut: 35,      // h par semaine pour une nouvelle personne à temps complet (art. L3121-27)
      seuilSurcharge: 100,     // % de charge au-delà duquel une personne est « en surcharge »
      seuilDisponible: 80,     // % de charge en dessous duquel une personne a de la place
      plafondSemaine: 48,      // alerte si la charge planifiée dépasse ce nombre d'heures (art. L3121-20) ; 0 = désactivée
      plafondMoyen: 44,        // alerte si la moyenne sur 12 semaines dépasse ce nombre d'heures (art. L3121-22) ; 0 = désactivée
      // Fêtes légales (art. L3133-1) supposées chômées : décocher celles que l'entreprise travaille.
      feriesChomes: ['jan1', 'lundiPaques', 'mai1', 'mai8', 'ascension', 'lundiPentecote', 'juil14', 'aout15', 'nov1', 'nov11', 'dec25'],
      verifieLe: '2026-11-14',
    },

    // Couleurs des projets et postes, dans cet ordre fixe (palette validée : séparation pour les daltonismes ;
    // le nom du projet est toujours écrit à côté de la couleur).
    couleurs: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'],

    // Types d'absence : aucun motif médical, aucune donnée de santé (« Autre absence » suffit).
    typesAbsence: [
      { id: 'conges', nom: 'Congés', lettre: 'C' },
      { id: 'formation', nom: 'Formation', lettre: 'F' },
      { id: 'autre', nom: 'Autre absence', lettre: 'A' },
    ],

    // Modèles d'équipe : rôles, compétences et postes à couvrir suggérés au premier lancement.
    // Rien n'est imposé : tout se renomme, s'ajoute ou se supprime.
    secteurs: [
      {
        id: 'agence', nom: 'Agence, studio, conseil',
        roles: ['Chef de projet', 'Développeur', 'Designer', 'Rédacteur', 'Consultant', 'Support'],
        competences: ['Gestion de projet', 'Développement web', 'Design graphique', 'UX', 'Rédaction', 'Accessibilité', 'Support client', 'Formation'],
        postes: [['Support client', 35, 'Support client'], ['Maintenance des sites', 14, 'Développement web']],
      },
      {
        id: 'btp', nom: 'Bâtiment et artisanat',
        roles: ['Chef d\'équipe', 'Compagnon', 'Apprenti', 'Conducteur de travaux', 'Métreur'],
        competences: ['Maçonnerie', 'Plâtrerie', 'Électricité', 'Plomberie', 'Menuiserie', 'Peinture', 'Conduite d\'engins', 'Travail en hauteur'],
        postes: [['Dépannages', 35, 'Plomberie'], ['Atelier', 35, 'Menuiserie']],
      },
      {
        id: 'commerce', nom: 'Commerce et restauration',
        roles: ['Responsable', 'Vendeur', 'Caissier', 'Cuisinier', 'Serveur', 'Plongeur'],
        competences: ['Caisse', 'Conseil client', 'Cuisine', 'Service en salle', 'Réception des livraisons', 'Ouverture', 'Fermeture'],
        postes: [['Ouverture du magasin', 21, 'Ouverture'], ['Caisse', 70, 'Caisse'], ['Réception des livraisons', 10, 'Réception des livraisons']],
      },
      {
        id: 'atelier', nom: 'Atelier et production',
        roles: ['Chef d\'atelier', 'Opérateur', 'Technicien', 'Magasinier', 'Contrôleur qualité'],
        competences: ['Usinage', 'Montage', 'Soudure', 'Contrôle qualité', 'Cariste', 'Maintenance', 'Expédition'],
        postes: [['Ligne de montage', 70, 'Montage'], ['Expéditions', 35, 'Expédition']],
      },
      {
        id: 'services', nom: 'Services sur site (nettoyage, aide, sécurité)',
        roles: ['Responsable de secteur', 'Agent', 'Intervenant', 'Chef d\'équipe'],
        competences: ['Nettoyage', 'Vitrerie', 'Aide à domicile', 'Accueil', 'Sécurité', 'Permis B'],
        postes: [['Bureaux (client A)', 20, 'Nettoyage'], ['Accueil (client B)', 35, 'Accueil']],
      },
      {
        id: 'etudes', nom: 'Bureau d\'études et ingénierie',
        roles: ['Chef de projet', 'Ingénieur', 'Projeteur', 'Technicien', 'Assistant'],
        competences: ['Gestion de projet', 'Dessin 2D', 'Modélisation 3D', 'Calcul de structure', 'Électricité', 'Thermique', 'Métré', 'Suivi de chantier'],
        postes: [['Réponses aux appels d\'offres', 14, 'Métré']],
      },
    ],

    conseils: [
      ['Des heures par semaine', 'Chaque affectation dit combien d\'heures par semaine une personne donne à un projet, sur une période : la charge se calcule toute seule.'],
      ['La vraie capacité', 'Temps partiel, jours non travaillés, congés, formation et fériés réduisent la capacité de la semaine : le taux de charge en tient compte.'],
      ['Les postes à couvrir', 'Un accueil, une permanence, une ligne de production : indique son besoin en heures par semaine, l\'outil signale les trous.'],
      ['Une clé pour les managers', 'La même clé s\'ouvre sur l\'ordinateur et le téléphone de chaque manager ; les saisies faites en même temps sont fusionnées.'],
    ],

    // Repères de durée du travail (droit français, Code du travail). Outil d'aide : la convention collective,
    // les accords et le Code du travail font foi. La charge planifiée n'est pas le temps de travail effectif.
    reperes: [
      ['Durée légale', '35 heures de travail effectif par semaine pour un salarié à temps complet (art. L3121-27) : c\'est la capacité proposée par défaut, modifiable par personne (temps partiel, forfait…).'],
      ['Durée maximale sur une semaine', '48 heures au cours d\'une même semaine (art. L3121-20), sauf dérogations : alerte « plafond hebdomadaire » des Réglages.'],
      ['Durée maximale en moyenne', '44 heures en moyenne sur une période quelconque de 12 semaines consécutives (art. L3121-22), sauf exceptions prévues par le Code ou un accord : alerte « moyenne sur 12 semaines ».'],
      ['Ce que l\'outil ne vérifie pas', 'Repos quotidien et hebdomadaire, heures supplémentaires, travail de nuit, durées des jeunes travailleurs, forfaits jours : à vérifier avec ta convention et ton gestionnaire de paie.'],
    ],
    sources: [
      ['Code du travail, art. L3121-27 (durée légale : 35 heures par semaine)', 'https://code.travail.gouv.fr/code-du-travail/l3121-27'],
      ['Code du travail, art. L3121-20 (48 heures au cours d\'une même semaine)', 'https://code.travail.gouv.fr/code-du-travail/l3121-20'],
      ['Code du travail, art. L3121-22 (44 heures en moyenne sur 12 semaines consécutives)', 'https://code.travail.gouv.fr/code-du-travail/l3121-22'],
      ['Code du travail, art. L3133-1 (les 11 fêtes légales)', 'https://code.travail.gouv.fr/code-du-travail/l3133-1'],
    ],
    sourceRegles: 'Durées relevées le 14/11/2026 sur code.travail.gouv.fr (articles L3121-27, L3121-20, L3121-22, L3133-1). Des dérogations et des accords peuvent prévoir d\'autres limites : les alertes sont des paramètres.',
  };
})();
