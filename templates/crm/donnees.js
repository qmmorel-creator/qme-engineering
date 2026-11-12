// Base intégrée du CRM freelance : étapes de vente, prochaines actions types, listes de saisie.
// Aucun taux de TVA ni mention légale de facture : saisis par l'utilisateur.
// Repères réglementaires datés et sourcés (à revérifier chaque année).
globalThis.BASE = {
  couleurs: [
    { id: 'rouge', hex: '#D9302A', nom: 'Rouge' },
    { id: 'bleu', hex: '#1D4E89', nom: 'Bleu' },
    { id: 'jaune', hex: '#F5B400', nom: 'Jaune' },
    { id: 'encre', hex: '#141414', nom: 'Noir' },
    { id: 'vert', hex: '#2E7D4F', nom: 'Vert' },
    { id: 'gris', hex: '#8A857B', nom: 'Gris' },
  ],

  // Étapes de vente, dans l'ordre. ouverte : l'affaire est encore à gagner.
  etapes: [
    { id: 'piste', nom: 'Piste', couleur: 'gris', ouverte: true, action: 'premier-contact',
      detail: 'Contact identifié, pas encore d\'échange sur un besoin.' },
    { id: 'qualifie', nom: 'Qualifié', couleur: 'jaune', ouverte: true, action: 'decouverte',
      detail: 'Besoin, budget et délai connus : il vaut la peine de faire une proposition.' },
    { id: 'proposition', nom: 'Proposition envoyée', couleur: 'bleu', ouverte: true, action: 'relance-devis',
      detail: 'Devis ou proposition envoyé, en attente de réponse.' },
    { id: 'negociation', nom: 'Négociation', couleur: 'rouge', ouverte: true, action: 'point-decision',
      detail: 'Le client discute le périmètre, le prix ou le calendrier.' },
    { id: 'gagne', nom: 'Gagné', couleur: 'vert', ouverte: false, action: 'lancement',
      detail: 'Accord obtenu : le projet est à réaliser puis à facturer.' },
    { id: 'perdu', nom: 'Perdu', couleur: 'encre', ouverte: false, action: 'raison-refus',
      detail: 'Pas retenu ou abandonné : garde le motif pour progresser.' },
  ],

  avancements: [
    { id: 'a-venir', nom: 'À démarrer' },
    { id: 'en-cours', nom: 'En cours' },
    { id: 'termine', nom: 'Terminé' },
  ],

  // Prochaines actions types : délai par défaut (jours) et conseil. suite : action proposée une fois faite.
  actions: [
    { id: 'premier-contact', nom: 'Premier contact', delai: 0, suite: 'relance-silence',
      conseil: 'Présente-toi en deux phrases, dis pourquoi tu écris à cette personne précisément et pose une seule question.' },
    { id: 'relance-silence', nom: 'Relancer après un message sans réponse', delai: 5, suite: 'recontacter',
      conseil: 'Message court, qui apporte un élément nouveau (exemple, idée, disponibilité). Pas plus de deux relances.' },
    { id: 'decouverte', nom: 'Rendez-vous de découverte', delai: 3, suite: 'proposition',
      conseil: 'Fais parler du besoin, du budget, du délai et de qui décide. Note les mots exacts du client.' },
    { id: 'proposition', nom: 'Envoyer la proposition', delai: 3, suite: 'relance-devis',
      conseil: 'Reprends le besoin avec ses mots, propose une option principale et une variante, donne une date de validité.' },
    { id: 'relance-devis', nom: 'Relancer le devis', delai: 7, suite: 'point-decision',
      conseil: 'Demande si la proposition répond au besoin et ce qui manque pour décider. Propose un créneau précis.' },
    { id: 'point-decision', nom: 'Faire le point sur la décision', delai: 5, suite: 'recontacter',
      conseil: 'Clarifie le dernier point bloquant (prix, périmètre, calendrier) et ce que tu peux ajuster sans brader.' },
    { id: 'lancement', nom: 'Planifier le lancement du projet', delai: 2, suite: 'point-avancement',
      conseil: 'Confirme par écrit le périmètre, le calendrier, les livrables et les conditions de paiement.' },
    { id: 'point-avancement', nom: 'Point d\'avancement', delai: 14, suite: 'livraison',
      conseil: 'Montre ce qui est fait, ce qui vient et ce dont tu as besoin du client. Signale tôt tout retard.' },
    { id: 'livraison', nom: 'Livrer et facturer', delai: 1, suite: 'temoignage',
      conseil: 'Fais valider la livraison par écrit puis envoie la facture le jour même.' },
    { id: 'relance-facture', nom: 'Relancer une facture impayée', delai: 3, suite: 'relance-facture',
      conseil: 'Rappel courtois avec le numéro, le montant et l\'échéance de la facture. Demande une date de paiement.' },
    { id: 'temoignage', nom: 'Demander un témoignage', delai: 15, suite: 'nouvelles',
      conseil: 'Pose deux questions précises : ce qui a changé grâce au projet, et ce qu\'il dirait à un confrère.' },
    { id: 'nouvelles', nom: 'Prendre des nouvelles', delai: 90, suite: 'nouvelles',
      conseil: 'Sans rien vendre : un article, une idée, une question sur leurs projets. Le prochain contrat vient souvent de là.' },
    { id: 'raison-refus', nom: 'Demander la raison du refus', delai: 3, suite: 'recontacter',
      conseil: 'Remercie, demande ce qui a fait pencher la décision et si tu peux revenir vers eux plus tard.' },
    { id: 'recontacter', nom: 'Recontacter plus tard', delai: 180, suite: 'nouvelles',
      conseil: 'Le besoin a peut-être changé : reprends contact avec une raison concrète.' },
  ],

  typesEchange: [
    { id: 'appel', nom: 'Appel' },
    { id: 'email', nom: 'E-mail' },
    { id: 'rdv', nom: 'Rendez-vous' },
    { id: 'visio', nom: 'Visio' },
    { id: 'message', nom: 'Message' },
    { id: 'autre', nom: 'Autre' },
  ],

  origines: ['Recommandation', 'Réseau professionnel', 'Site internet', 'Salon ou événement', 'Ancien client', 'Plateforme de mise en relation', 'Prospection directe', 'Autre'],
  motifsPerte: ['Prix', 'Délai', 'Autre prestataire retenu', 'Projet abandonné ou reporté', 'Pas de réponse', 'Autre'],
  modesPaiement: ['Virement', 'Chèque', 'Carte bancaire', 'Espèces', 'Autre'],

  // Repères réglementaires : affichés dans l'aide avec leur source. Seul delaiPaiement.defaut sert au calcul,
  // comme valeur par défaut modifiable dans les réglages.
  reperes: {
    consulteLe: '2026-11-12',
    delaiPaiement: {
      defaut: 30,
      texte: 'Entre professionnels, à défaut d\'accord, le délai de paiement est de 30 jours après la réalisation de la prestation. Un délai plus long peut être convenu, jusqu\'à 60 jours après l\'émission de la facture. Une facture payée en retard ouvre droit à une indemnité forfaitaire de 40 € pour frais de recouvrement, en plus des pénalités de retard ; les deux doivent figurer sur la facture.',
      source: 'entreprendre.service-public.gouv.fr (fiche F23211, vérifiée le 07/08/2026)',
      url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23211',
    },
    facturationElectronique: {
      texte: 'Toutes les entreprises doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026. Les PME et micro-entreprises devront les émettre au format électronique au plus tard le 1er septembre 2027, via une plateforme agréée.',
      source: 'impots.gouv.fr (« Je découvre la facturation électronique »)',
      url: 'https://www.impots.gouv.fr/professionnel/je-decouvre-la-facturation-electronique',
    },
    conservation: {
      ans: 3,
      texte: 'La CNIL indique, dans un référentiel non contraignant, qu\'un prospect peut être conservé 3 ans à compter de la collecte ou du dernier contact venant de lui, et un client 3 ans après la fin de la relation commerciale. Ensuite, les données sont supprimées ou archivées, sauf accord explicite de la personne.',
      source: 'cnil.fr (questions-réponses sur les référentiels « gestion des activités commerciales »)',
      url: 'https://www.cnil.fr/fr/questions-reponses-sur-les-referentiels-relatifs-la-gestion-des-activites-commerciales-et-des',
    },
  },
};
