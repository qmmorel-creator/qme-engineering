// Base intégrée du suivi des appels d'offres et candidatures : statuts, types de consultation, grille de
// décision go/no-go, modèles de dossiers (pièces types), types de pièces réutilisables, motifs de perte.
// Aucune logique ici. Grille et modèles sont copiés dans les données de l'utilisateur au premier lancement :
// il les modifie sans toucher à cette base.
// Aucune référence réglementaire : les pièces exigées sont celles du règlement de chaque consultation.
window.BASE = {
  couleurs: [
    { id: 'rouge', hex: '#B84A34', nom: 'Rouge' },
    { id: 'bleu', hex: '#2E5A88', nom: 'Bleu' },
    { id: 'jaune', hex: '#E8B93A', nom: 'Jaune' },
    { id: 'encre', hex: '#24221F', nom: 'Encre' },
    { id: 'vert', hex: '#2E7D4F', nom: 'Vert' },
    { id: 'orange', hex: '#C9772B', nom: 'Orange' },
  ],

  // Cycle d'une consultation. « fin » : résultat connu ou dossier clos ; « actif » : demande une action.
  statuts: [
    { id: 'reperee', nom: 'Repérée', couleur: 'encre', actif: true, definition: 'Consultation repérée en veille, décision go/no-go à prendre.' },
    { id: 'preparation', nom: 'En préparation', couleur: 'jaune', actif: true, definition: 'Go décidé : le dossier se monte, pièce par pièce, avant la date limite.' },
    { id: 'deposee', nom: 'Déposée', couleur: 'bleu', actif: true, definition: 'Offre ou candidature remise ; on attend la réponse et on relance.' },
    { id: 'gagnee', nom: 'Gagnée', couleur: 'vert', fin: true, definition: 'Retenue : marché, contrat ou mission obtenu.' },
    { id: 'perdue', nom: 'Perdue', couleur: 'rouge', fin: true, definition: 'Non retenue, avec le motif s\'il est connu.' },
    { id: 'sanssuite', nom: 'Sans suite', couleur: 'orange', fin: true, definition: 'Consultation annulée ou déclarée sans suite par l\'acheteur.' },
    { id: 'nogo', nom: 'No-go', couleur: 'encre', fin: true, definition: 'Écartée après la grille de décision : pas de réponse.' },
    { id: 'abandon', nom: 'Abandonnée', couleur: 'encre', fin: true, definition: 'Go décidé, mais dossier non déposé.' },
  ],

  // Types de consultation. « relance » : délai par défaut (jours après le dépôt) avant de relancer pour le
  // résultat ; valeur de départ modifiable dans chaque dossier, pas une règle.
  types: [
    { id: 'public', nom: 'Marché public', court: 'Public', relance: 30, modele: 'public' },
    { id: 'prive', nom: 'Appel d\'offres privé', court: 'Privé', relance: 21, modele: 'prive' },
    { id: 'plateforme', nom: 'Mission sur plateforme', court: 'Plateforme', relance: 5, modele: 'plateforme' },
    { id: 'directe', nom: 'Consultation directe', court: 'Directe', relance: 10, modele: 'directe' },
    { id: 'autre', nom: 'Autre appel à candidatures', court: 'Autre', relance: 21, modele: 'directe' },
  ],

  // Grille go/no-go : note de 0 à 3 par critère, pondérée. Un critère « éliminatoire » noté 0 conduit à un
  // no-go conseillé, quel que soit le score. Poids modifiables dans les réglages.
  notes: ['Non', 'Faible', 'Moyen', 'Fort'],
  criteres: [
    { id: 'metier', nom: 'Cœur de métier', question: 'Le besoin correspond-il à ce que je fais le mieux ?', poids: 3, eliminatoire: true },
    { id: 'capacite', nom: 'Capacité à réaliser', question: 'Ai-je la disponibilité et les moyens aux dates prévues ?', poids: 3, eliminatoire: true },
    { id: 'temps', nom: 'Temps pour répondre', question: 'Reste-t-il assez de temps pour une réponse soignée ?', poids: 2, eliminatoire: true },
    { id: 'references', nom: 'Références', question: 'Ai-je des références comparables à montrer ?', poids: 2 },
    { id: 'rentabilite', nom: 'Rentabilité', question: 'Le budget probable couvre-t-il mon prix et le temps de réponse ?', poids: 2 },
    { id: 'chances', nom: 'Chances de gagner', question: 'Face à la concurrence probable, suis-je bien placé ?', poids: 2 },
    { id: 'client', nom: 'Connaissance du client', question: 'Est-ce que je connais l\'acheteur, son contexte, ses attentes ?', poids: 1 },
    { id: 'strategie', nom: 'Intérêt stratégique', question: 'Ouvre-t-il un secteur, une référence ou un client visé ?', poids: 1 },
  ],
  seuils: { go: 65, discuter: 45 },

  // Types de pièces de la bibliothèque (pièces réutilisables : on note la référence et la validité, pas le fichier).
  typesPieces: [
    { id: 'reference', nom: 'Référence client', validite: false },
    { id: 'cv', nom: 'CV', validite: false },
    { id: 'attestation', nom: 'Attestation', validite: true },
    { id: 'assurance', nom: 'Attestation d\'assurance', validite: true },
    { id: 'immatriculation', nom: 'Extrait d\'immatriculation', validite: true },
    { id: 'certification', nom: 'Certification ou qualification', validite: true },
    { id: 'financier', nom: 'Éléments financiers', validite: false },
    { id: 'presentation', nom: 'Présentation de l\'entreprise', validite: false },
    { id: 'methode', nom: 'Note méthodologique type', validite: false },
    { id: 'autre', nom: 'Autre pièce', validite: false },
  ],

  // Modèles de dossiers : pièces fréquemment demandées, point de départ à compléter selon le règlement de
  // chaque consultation. « delai » : jours avant la date limite où la pièce doit être prête (rétroplanning).
  // « type » : type de pièce de la bibliothèque qui peut la couvrir.
  modeles: [
    { id: 'public', nom: 'Marché public', description: 'Pièces souvent demandées : la liste exacte est celle du règlement de la consultation de l\'acheteur.', pieces: [
      { libelle: 'Lire le règlement de la consultation et lister les pièces exigées', delai: 14 },
      { libelle: 'Questions à poser à l\'acheteur (avant la date fixée pour les questions)', delai: 10 },
      { libelle: 'Formulaires de candidature demandés par l\'acheteur', delai: 4 },
      { libelle: 'Attestations demandées (situation fiscale, sociale, assurance…)', delai: 4, type: 'attestation' },
      { libelle: 'Extrait d\'immatriculation', delai: 4, type: 'immatriculation' },
      { libelle: 'Références de prestations comparables', delai: 5, type: 'reference' },
      { libelle: 'CV des intervenants', delai: 5, type: 'cv' },
      { libelle: 'Mémoire technique (compréhension, méthode, planning, moyens)', delai: 3, type: 'methode' },
      { libelle: 'Offre de prix (bordereau, décomposition ou devis)', delai: 2 },
      { libelle: 'Pièces à signer, signature prévue', delai: 1 },
      { libelle: 'Relecture finale et dépôt sur le profil d\'acheteur', delai: 1 },
    ] },
    { id: 'prive', nom: 'Appel d\'offres privé', description: 'Réponse à un cahier des charges d\'entreprise ou d\'association.', pieces: [
      { libelle: 'Relire le cahier des charges et noter les critères de choix', delai: 10 },
      { libelle: 'Questions au client', delai: 8 },
      { libelle: 'Présentation de l\'entreprise', delai: 4, type: 'presentation' },
      { libelle: 'Compréhension du besoin et proposition de démarche', delai: 3, type: 'methode' },
      { libelle: 'Planning et livrables', delai: 3 },
      { libelle: 'Références', delai: 4, type: 'reference' },
      { libelle: 'CV', delai: 4, type: 'cv' },
      { libelle: 'Proposition financière', delai: 2 },
      { libelle: 'Attestation d\'assurance (si demandée)', delai: 3, type: 'assurance' },
      { libelle: 'Relecture et envoi', delai: 1 },
    ] },
    { id: 'plateforme', nom: 'Mission sur plateforme', description: 'Candidature à une mission publiée sur une plateforme de freelances.', pieces: [
      { libelle: 'Profil à jour (titre, compétences, disponibilité)', delai: 1 },
      { libelle: 'Message de candidature adapté à la mission', delai: 0 },
      { libelle: 'Tarif proposé (TJM ou forfait)', delai: 0 },
      { libelle: 'Réalisations ou références à joindre', delai: 0, type: 'reference' },
      { libelle: 'Questions au client', delai: 0 },
    ] },
    { id: 'directe', nom: 'Consultation directe', description: 'Demande de proposition ou de devis reçue d\'un client.', pieces: [
      { libelle: 'Échange de cadrage avec le client', delai: 7 },
      { libelle: 'Proposition commerciale', delai: 2, type: 'methode' },
      { libelle: 'Devis', delai: 2 },
      { libelle: 'Références', delai: 3, type: 'reference' },
      { libelle: 'Relecture et envoi', delai: 1 },
    ] },
  ],

  statutsPiece: [
    { id: 'afaire', nom: 'À faire' },
    { id: 'encours', nom: 'En cours' },
    { id: 'pret', nom: 'Prête' },
    { id: 'sansobjet', nom: 'Sans objet' },
  ],

  motifsPerte: [
    { id: 'prix', nom: 'Prix' },
    { id: 'technique', nom: 'Valeur technique' },
    { id: 'references', nom: 'Références insuffisantes' },
    { id: 'delai', nom: 'Délai ou disponibilité' },
    { id: 'irrecevable', nom: 'Dossier incomplet ou hors délai' },
    { id: 'concurrent', nom: 'Prestataire en place reconduit' },
    { id: 'inconnu', nom: 'Motif non communiqué' },
    { id: 'autre', nom: 'Autre' },
  ],

  sources: ['Veille sur les profils d\'acheteurs', 'Alerte par e-mail', 'Plateforme de freelances', 'Réseau ou recommandation', 'Client existant', 'Presse ou annonces légales', 'Autre'],
};
