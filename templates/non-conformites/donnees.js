// Base intégrée du registre des non-conformités : typologie des écarts, grille de gravité, modèle des
// 5 pourquoi, familles de causes (6M), décisions sur le produit, lots et ateliers types.
// Repères de méthode rédigés pour ce produit : aucune norme citée comme exigence, aucune donnée datée.
window.BASE = {
  // Grille de gravité : délais de traitement proposés (jours), modifiables dans les réglages.
  gravites: [
    { id: 1, nom: 'Mineure', couleur: '#5E5A52', texte: '#fff', delai: 30,
      definition: 'Écart sans effet sur l\'usage ni sur la sécurité, corrigé simplement.',
      criteres: ['Défaut d\'aspect ou de détail, invisible pour le client final', 'Reprise de moins d\'une heure, sans coût notable', 'Aucun retard sur le planning'],
      verification: 'Vérification d\'efficacité simple (contrôle visuel lors du passage suivant).' },
    { id: 2, nom: 'Significative', couleur: '#F5B400', texte: '#141414', delai: 15,
      definition: 'Écart qui demande une reprise organisée mais reste sans conséquence pour le client.',
      criteres: ['Reprise planifiée (quelques heures à une journée)', 'Coût de reprise identifiable', 'Retard absorbable sans décaler un jalon'],
      verification: 'Vérification d\'efficacité à date prévue, par un tiers si possible.' },
    { id: 3, nom: 'Majeure', couleur: '#D9302A', texte: '#fff', delai: 7,
      definition: 'Écart qui touche la fonction, la durabilité, un engagement contractuel ou qui risque de se répéter.',
      criteres: ['Ouvrage ou pièce non utilisable en l\'état, ou dérogation client nécessaire', 'Coût important ou jalon menacé', 'Écart déjà vu (récurrence)'],
      verification: 'Analyse des causes obligatoire ; vérification d\'efficacité formelle avant clôture.' },
    { id: 4, nom: 'Critique', couleur: '#141414', texte: '#fff', delai: 2,
      definition: 'Écart qui met en jeu la sécurité des personnes, la stabilité d\'un ouvrage ou la conformité d\'une livraison client.',
      criteres: ['Risque pour la sécurité des personnes ou des biens', 'Arrêt de tâche, de chantier ou de livraison', 'Information immédiate de la direction et, si besoin, du client'],
      verification: 'Mesure conservatoire immédiate, analyse des causes en équipe, vérification d\'efficacité par la direction.' },
  ],

  // Typologie des écarts (exemples fictifs).
  types: [
    { id: 'dimension', nom: 'Dimensionnel et géométrie', detail: 'Cotes, tolérances, aplomb, niveau, alignement, position.', btp: 'Voile hors aplomb, réservation décalée, trémie mal positionnée.', industrie: 'Cote hors tolérance, perçage décalé, planéité non tenue.' },
    { id: 'aspect', nom: 'Aspect et finition', detail: 'Défauts visibles sans effet immédiat sur la fonction.', btp: 'Bullage de béton apparent, joints irréguliers, reprises de peinture visibles.', industrie: 'Rayures, coulures de peinture, bavures, marquage illisible.' },
    { id: 'materiau', nom: 'Matériau ou composant', detail: 'Référence, nuance, classe ou lot différent de celui prévu.', btp: 'Isolant d\'une autre résistance thermique que celle prescrite, béton de mauvaise classe livré.', industrie: 'Tôle d\'une autre nuance, visserie de mauvaise classe, lot sans certificat matière.' },
    { id: 'execution', nom: 'Exécution et mise en œuvre', detail: 'Travail réalisé hors plan, hors mode opératoire ou hors règles de l\'art.', btp: 'Recouvrement d\'armatures insuffisant, pente d\'évacuation inversée.', industrie: 'Soudure incomplète, couple de serrage non respecté, montage inversé.' },
    { id: 'documentaire', nom: 'Documentaire et traçabilité', detail: 'Document absent, périmé ou non suivi ; enregistrement manquant.', btp: 'Plan d\'exécution non à jour sur le chantier, autocontrôle non signé.', industrie: 'Gamme périmée au poste, fiche suiveuse incomplète, lot non identifié.' },
    { id: 'fournisseur', nom: 'Produit ou livraison fournisseur', detail: 'Écart constaté à la réception d\'un achat.', btp: 'Menuiseries livrées aux mauvaises dimensions, palette endommagée.', industrie: 'Pièces brutes hors cote, quantité ou emballage non conforme.' },
    { id: 'soustraitance', nom: 'Sous-traitance', detail: 'Prestation d\'un sous-traitant non conforme à la commande.', btp: 'Lot sous-traité livré sans autocontrôle, réserves non levées.', industrie: 'Traitement de surface d\'épaisseur insuffisante chez le sous-traitant.' },
    { id: 'equipement', nom: 'Équipement, outillage et mesure', detail: 'Machine, outil ou instrument défaillant, déréglé ou non étalonné.', btp: 'Laser de chantier déréglé, banche déformée.', industrie: 'Outil usé, réglage machine dérivé, pied à coulisse non vérifié.' },
    { id: 'securite', nom: 'Sécurité et environnement', detail: 'Écart aux consignes de sécurité ou de protection de l\'environnement de l\'entreprise.', btp: 'Protection collective retirée sans remplacement, déchets non triés.', industrie: 'Carter de protection démonté, fuite d\'huile non confinée.' },
    { id: 'client', nom: 'Réclamation client', detail: 'Écart signalé par le client après livraison ou réception.', btp: 'Infiltration signalée après réception, défaut relevé par le maître d\'ouvrage.', industrie: 'Pièces refusées à réception chez le client, retour sous garantie.' },
  ],

  // Origine de la détection.
  origines: [
    { id: 'interne', nom: 'Contrôle interne' },
    { id: 'autocontrole', nom: 'Autocontrôle' },
    { id: 'fournisseur', nom: 'Réception fournisseur' },
    { id: 'soustraitant', nom: 'Sous-traitant' },
    { id: 'client', nom: 'Client' },
    { id: 'audit', nom: 'Audit' },
  ],

  // Familles de causes (6M, diagramme d'Ishikawa).
  causes: [
    { id: 'methode', nom: 'Méthode', couleur: '#1D4E89', questions: 'Le mode opératoire existait-il ? Était-il clair, à jour, applicable ?' },
    { id: 'maindoeuvre', nom: 'Main-d\'œuvre', couleur: '#D9302A', questions: 'La personne était-elle formée, informée, disponible ? Pourquoi l\'écart n\'a-t-il pas été vu ?' },
    { id: 'materiel', nom: 'Matériel', couleur: '#F5B400', questions: 'L\'équipement était-il adapté, entretenu, réglé ?' },
    { id: 'matiere', nom: 'Matière', couleur: '#2E7D4F', questions: 'Le matériau ou le composant était-il le bon, contrôlé à réception ?' },
    { id: 'milieu', nom: 'Milieu', couleur: '#7A3E6B', questions: 'Météo, encombrement, éclairage, bruit, coactivité ont-ils joué ?' },
    { id: 'mesure', nom: 'Mesure', couleur: '#4A90C2', questions: 'Le contrôle était-il prévu, au bon moment, avec un instrument fiable ?' },
  ],

  // Décisions sur le produit ou l'ouvrage (traitement immédiat).
  decisions: [
    { id: 'reprise', nom: 'Reprise', detail: 'Remettre en conformité avec l\'exigence d\'origine.' },
    { id: 'reparation', nom: 'Réparation', detail: 'Rendre apte à l\'usage sans atteindre l\'exigence d\'origine (accord du client si contractuel).' },
    { id: 'rebut', nom: 'Rebut ou démolition', detail: 'Écarter définitivement le produit ou démolir l\'ouvrage.' },
    { id: 'derogation', nom: 'Acceptation par dérogation', detail: 'Accepter en l\'état, avec l\'accord écrit de qui a fixé l\'exigence.' },
    { id: 'declassement', nom: 'Déclassement', detail: 'Réaffecter à un usage moins exigeant.' },
    { id: 'retour', nom: 'Retour fournisseur', detail: 'Renvoyer au fournisseur ou au sous-traitant pour reprise ou remplacement.' },
    { id: 'tri', nom: 'Tri ou contrôle renforcé', detail: 'Isoler et contrôler le reste du lot en attendant l\'analyse.' },
    { id: 'aucune', nom: 'Aucune (écart d\'organisation)', detail: 'Pas de produit concerné : écart de méthode, de document ou de sécurité.' },
  ],

  // Modèle des 5 pourquoi.
  cinqPourquoi: {
    regles: [
      ['Partir d\'un fait constaté', 'Décris l\'écart tel qu\'on l\'a vu (quoi, où, combien), pas une opinion ni un coupable.'],
      ['Une cause par niveau', 'Chaque réponse explique la précédente, et une seule. Si deux causes apparaissent, fais deux analyses.'],
      ['Vérifier sur le terrain', 'Chaque réponse se contrôle : document, mesure, témoignage, observation. Sinon c\'est une hypothèse.'],
      ['Ne pas s\'arrêter à « erreur humaine »', 'Demande pourquoi l\'erreur était possible et pourquoi elle n\'a pas été détectée.'],
      ['S\'arrêter au bon niveau', 'On s\'arrête quand la cause est à notre portée et que la traiter évite la récurrence, parfois avant le cinquième pourquoi.'],
      ['Relire à l\'envers', 'De la dernière réponse au problème, chaque niveau doit se lire avec « donc ». Si la chaîne casse, une étape manque.'],
    ],
    relances: [
      'Qu\'est-ce qui a permis que cela arrive ?',
      'Pourquoi ce n\'a pas été détecté plus tôt ?',
      'Qu\'est-ce qui était différent cette fois ?',
      'Quelle règle, quel contrôle ou quel moyen manquait ?',
      'Qu\'est-ce qui, s\'il avait existé, aurait empêché l\'écart ?',
    ],
    exemples: [
      { titre: 'BTP · réservation oubliée dans un voile', probleme: 'Voile du niveau 1 coulé sans la réservation de gaine de ventilation prévue au plan.',
        pourquoi: [
          'La réservation n\'était pas en place dans le coffrage au moment du coulage.',
          'L\'équipe a coffré avec un plan d\'exécution de l\'indice précédent.',
          'Le nouvel indice, reçu par e-mail, n\'a pas été imprimé pour le chantier.',
          'Aucune règle ne dit qui diffuse les plans mis à jour sur le chantier.',
          'La diffusion des plans n\'a jamais été formalisée dans l\'entreprise.',
        ],
        cause: 'methode', racine: 'Pas de circuit de diffusion des plans mis à jour.',
        actions: ['Corrective : carottage de la réservation après accord du bureau d\'études.', 'Préventive : liste des plans en vigueur affichée au bungalow, mise à jour par le conducteur de travaux à chaque nouvel indice.', 'Préventive : point « indice des plans » ajouté à l\'autocontrôle avant coulage.'] },
      { titre: 'Industrie · cote hors tolérance après changement d\'outil', probleme: 'Lot de 120 pièces avec un alésage à 20,08 mm pour 20,00 ± 0,05 mm.',
        pourquoi: [
          'La fraise montée après le changement d\'outil coupait trop large.',
          'La correction d\'outil n\'a pas été saisie dans la machine.',
          'Le régleur ne savait pas que la nouvelle fraise demandait une correction.',
          'La fiche de réglage du poste ne mentionne pas les corrections par référence d\'outil.',
          'Les fiches de réglage ne sont pas revues quand on change de fournisseur d\'outils.',
        ],
        cause: 'methode', racine: 'Fiches de réglage non revues au changement de référence d\'outil.',
        actions: ['Corrective : tri à 100 % du lot, reprise des pièces récupérables, rebut des autres.', 'Corrective : fiche de réglage du poste complétée avec les corrections par outil.', 'Préventive : contrôle de la première pièce après tout changement d\'outil, sur tous les postes.'] },
    ],
  },

  // Une bonne action corrective.
  bonnesActions: [
    'Elle traite la cause racine, pas seulement le symptôme.',
    'Elle a un responsable unique et une échéance.',
    'Elle est vérifiable : on sait à l\'avance comment on verra qu\'elle a marché.',
    'Corrective : elle évite que cet écart se reproduise ici. Préventive : elle évite qu\'il apparaisse ailleurs.',
  ],

  // Profils proposés au premier lancement.
  profils: [
    { id: 'btp', nom: 'Bâtiment et travaux', detail: 'Les zones sont des lots', zone: 'Lot', lieu: 'Chantier',
      zones: ['Terrassement et VRD', 'Gros œuvre', 'Charpente', 'Couverture et étanchéité', 'Menuiseries extérieures', 'Plâtrerie et cloisons', 'Menuiseries intérieures', 'Électricité', 'Plomberie et CVC', 'Revêtements de sols', 'Peinture', 'Aménagements extérieurs'] },
    { id: 'industrie', nom: 'Industrie et atelier', detail: 'Les zones sont des ateliers', zone: 'Atelier', lieu: 'Site',
      zones: ['Réception', 'Magasin', 'Débit', 'Usinage', 'Chaudronnerie', 'Soudure', 'Traitement de surface', 'Assemblage', 'Contrôle final', 'Expédition'] },
  ],

  delaiVerification: 30,
};
