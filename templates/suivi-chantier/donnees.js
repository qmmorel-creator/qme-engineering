// Base intégrée du Suivi de chantier par lot : découpage type en lots, jalons et pièces contractuelles types,
// typologies des non-conformités et des risques, intempéries, rôles des intervenants, modèle de revue de projet.
// Contenu original rédigé pour QME, aucune logique ici. Aucun indice, taux ou délai réglementaire intégré :
// les valeurs de départ (retenue, délai de paiement, alertes) se remplacent par celles du marché.
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Valeurs de départ des réglages d'une opération (modifiables, opération par opération).
    reglages: { rg: 5, delaiPaiement: 30, alerteJours: 7, relanceSousTraitance: 15, delaisNC: { mineure: 30, majeure: 15, critique: 7 } },

    // Découpage type en lots d'un bâtiment (intitulés usuels, à adapter au marché). courant : proposé coché.
    lots: [
      { code: 'VRD', nom: 'VRD et aménagements extérieurs', courant: true },
      { code: 'DEM', nom: 'Démolition et curage' },
      { code: 'TER', nom: 'Terrassements et fondations spéciales' },
      { code: 'GO', nom: 'Gros œuvre', courant: true },
      { code: 'CHA', nom: 'Charpente et ossature bois' },
      { code: 'CM', nom: 'Charpente métallique' },
      { code: 'CE', nom: 'Couverture et étanchéité', courant: true },
      { code: 'FAC', nom: 'Façades, bardage et ravalement' },
      { code: 'ME', nom: 'Menuiseries extérieures', courant: true },
      { code: 'SER', nom: 'Serrurerie et métallerie' },
      { code: 'PLA', nom: 'Plâtrerie, cloisons et faux plafonds', courant: true },
      { code: 'MI', nom: 'Menuiseries intérieures', courant: true },
      { code: 'REV', nom: 'Carrelage, faïence et sols souples', courant: true },
      { code: 'PEI', nom: 'Peinture et revêtements muraux', courant: true },
      { code: 'PLB', nom: 'Plomberie et sanitaires', courant: true },
      { code: 'CVC', nom: 'Chauffage, ventilation et climatisation', courant: true },
      { code: 'ELE', nom: 'Électricité courants forts et faibles', courant: true },
      { code: 'ASC', nom: 'Ascenseurs' },
      { code: 'EV', nom: 'Espaces verts' },
      { code: 'NET', nom: 'Nettoyage de fin de chantier' },
    ],

    // Jalons types. portee : 'operation' (toute l'opération) ou 'lot'. type : contractuel ou interne.
    jalons: [
      { nom: 'Ordre de service de démarrage', portee: 'operation', type: 'contractuel' },
      { nom: 'Fin de la période de préparation', portee: 'operation', type: 'contractuel' },
      { nom: 'Démarrage des travaux du lot', portee: 'lot', type: 'contractuel' },
      { nom: 'Fin du gros œuvre', portee: 'lot', type: 'interne' },
      { nom: 'Hors d\'eau', portee: 'operation', type: 'interne' },
      { nom: 'Hors d\'air', portee: 'operation', type: 'interne' },
      { nom: 'Cloisonnement achevé', portee: 'operation', type: 'interne' },
      { nom: 'Mise en service des installations', portee: 'lot', type: 'interne' },
      { nom: 'Achèvement des travaux du lot', portee: 'lot', type: 'contractuel' },
      { nom: 'Opérations préalables à la réception (OPR)', portee: 'operation', type: 'interne' },
      { nom: 'Réception', portee: 'operation', type: 'contractuel' },
      { nom: 'Levée des réserves', portee: 'operation', type: 'contractuel' },
      { nom: 'Remise du dossier des ouvrages exécutés (DOE)', portee: 'lot', type: 'contractuel' },
      { nom: 'Décompte général', portee: 'operation', type: 'interne' },
      { nom: 'Fin de la garantie de parfait achèvement', portee: 'operation', type: 'interne' },
    ],

    // Pièces contractuelles et documents types d'un marché de travaux (liste à cocher par opération).
    pieces: [
      'Acte d\'engagement',
      'Cahier des clauses administratives particulières (CCAP)',
      'Cahier des clauses techniques particulières (CCTP)',
      'Décomposition du prix global et forfaitaire (DPGF) ou bordereau des prix',
      'Planning contractuel',
      'Plans et pièces graphiques du marché',
      'Plan général de coordination (PGC)',
      'Rapport initial du contrôle technique',
      'Ordre de service de démarrage',
      'Attestations d\'assurance des entreprises',
      'Déclarations de sous-traitance',
      'Caution ou garantie remplaçant la retenue de garantie',
    ],

    // Typologie des non-conformités (registre simplifié ; le détail des causes relève du registre dédié).
    typesNC: [
      { nom: 'Exécution non conforme au CCTP', exemple: 'Épaisseur d\'isolant inférieure au descriptif.' },
      { nom: 'Matériau ou produit non conforme', exemple: 'Menuiseries d\'une autre gamme que celle validée.' },
      { nom: 'Tolérance dimensionnelle dépassée', exemple: 'Planéité de dalle hors tolérance sur 3 m².' },
      { nom: 'Défaut d\'aspect', exemple: 'Reprise d\'enduit visible en façade.' },
      { nom: 'Ouvrage endommagé', exemple: 'Gaine électrique écrasée lors du coulage.' },
      { nom: 'Essai ou contrôle non satisfaisant', exemple: 'Essai d\'étanchéité du réseau non concluant.' },
      { nom: 'Interface entre lots', exemple: 'Réservation absente pour le passage d\'une gaine de ventilation.' },
      { nom: 'Documentaire', exemple: 'Fiche technique ou procès-verbal d\'essai non transmis.' },
      { nom: 'Sécurité du chantier', exemple: 'Garde-corps provisoire déposé sans remplacement.' },
      { nom: 'Environnement et propreté', exemple: 'Laitance de béton rejetée au réseau pluvial.' },
    ],

    // Typologie des risques d'opération, avec un exemple chacune.
    categoriesRisques: [
      { nom: 'Délais', exemple: 'Approvisionnement des menuiseries plus long que prévu.' },
      { nom: 'Technique', exemple: 'Nature du sol différente de l\'étude géotechnique.' },
      { nom: 'Interfaces entre lots', exemple: 'Synthèse des réseaux incomplète avant les cloisons.' },
      { nom: 'Financier', exemple: 'Dérive des quantités sur un lot au prix unitaire.' },
      { nom: 'Défaillance d\'entreprise', exemple: 'Entreprise en difficulté, effectif réduit sur site.' },
      { nom: 'Contractuel', exemple: 'Travaux supplémentaires demandés sans avenant.' },
      { nom: 'Administratif et concessionnaires', exemple: 'Date de raccordement au réseau non confirmée.' },
      { nom: 'Sécurité et coactivité', exemple: 'Plusieurs lots au même niveau sans phasage.' },
      { nom: 'Environnement et riverains', exemple: 'Plaintes pour le bruit ou la poussière.' },
      { nom: 'Météo', exemple: 'Coulage de dalle en période de gel.' },
    ],

    // Échelle de cotation des risques (probabilité et impact de 1 à 4, criticité = produit).
    echelle: {
      probabilite: ['Rare', 'Possible', 'Probable', 'Quasi certain'],
      impact: ['Mineur', 'Modéré', 'Important', 'Majeur'],
    },

    meteo: ['Ensoleillé', 'Nuageux', 'Pluie', 'Forte pluie', 'Gel', 'Neige', 'Vent fort', 'Canicule'],
    naturesIntemperie: ['Pluie', 'Gel', 'Neige', 'Vent fort', 'Canicule', 'Autre'],

    roles: ['Maître d\'ouvrage', 'Assistant à maîtrise d\'ouvrage', 'Maître d\'œuvre', 'Architecte', 'Bureau d\'études', 'Économiste', 'OPC', 'Contrôleur technique', 'Coordonnateur SPS', 'Entreprise titulaire', 'Sous-traitant', 'Concessionnaire', 'Autre'],

    // Modèle de revue de projet : sections du compte rendu et questions à se poser.
    revue: [
      ['Délais', 'Les jalons contractuels tiennent-ils, prolongations comprises ? Quel lot porte le chemin le plus tendu ?'],
      ['Finances', 'Le marché actualisé, les avenants en projet et l\'avancement facturé sont-ils cohérents avec le prévisionnel ?'],
      ['Qualité', 'Quelles non-conformités restent ouvertes, lesquelles sont critiques ou en retard ?'],
      ['Risques', 'Quels risques ont changé de niveau ? Les actions ont-elles un porteur et une date ?'],
      ['Courriers et OS', 'Quelles réponses attendons-nous, quels ordres de service restent à notifier ?'],
      ['Points à arbitrer', 'Ce qui doit être décidé par le maître d\'ouvrage avant la prochaine revue.'],
    ],

    conseils: [
      ['Un lot, un marché', 'Chaque lot porte son entreprise, son montant initial et ses dates : avenants, situations et pénalités s\'y rattachent.'],
      ['La situation en cumul', 'Saisis le montant cumulé des travaux exécutés : le mois, la révision, la retenue et le net se calculent.'],
      ['Rien sans trace', 'Un ordre de service, un courrier ou un avenant se note le jour même, avec la réponse attendue.'],
      ['Le journal tous les jours', 'Météo, effectif, faits marquants et intempéries : c\'est la mémoire du chantier en cas de litige.'],
    ],

    // Repères affichés dans le Guide (paraphrases ; les points juridiques sont à vérifier sur Légifrance).
    reperes: [
      ['Montants hors taxes', 'Tous les montants se saisissent hors taxes. La TVA, les avances et leur remboursement ne sont pas calculés.'],
      ['Révision de prix', 'Le coefficient K de chaque situation vient de la formule de révision de ton marché (indices de référence, par exemple les index BT ou TP, et part fixe). L\'outil n\'intègre aucun indice : tu saisis K, il calcule la révision du mois.'],
      ['Retenue de garantie', 'Le taux se saisit d\'après le marché (5 % proposé par défaut). La loi n° 71-584 du 16 juillet 1971 plafonne la retenue de garantie à 5 % et permet de la remplacer par une caution : à vérifier sur Légifrance avant de t\'y référer.'],
      ['Pénalités de retard', 'Le montant par jour et le plafond viennent du CCAP. L\'outil compte les jours calendaires de retard sur la date recalée : c\'est une estimation, pas une application des pénalités.'],
      ['Intempéries', 'Le marché définit ce qui ouvre droit à prolongation. Tu indiques, jour par jour, si l\'intempérie est retenue : seules celles-là décalent les dates.'],
      ['Sous-traitance', 'La loi n° 75-1334 du 31 décembre 1975 impose de faire accepter chaque sous-traitant et agréer ses conditions de paiement par le maître d\'ouvrage : à vérifier sur Légifrance. L\'outil suit seulement l\'état de chaque demande.'],
      ['Données des intervenants', 'Ne note que des coordonnées professionnelles utiles au chantier, et supprime-les à la fin de l\'opération si elles ne servent plus.'],
    ],
  };
})();
