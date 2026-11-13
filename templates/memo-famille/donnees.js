// MémoFamille · base intégrée (aucune logique ici) : catégories et modèles de champs.
// Principe : on note OÙ trouver une information sensible, jamais l'information elle-même
// (aucun champ de mot de passe, de code ou de numéro bancaire).
window.BASE = {
  version: '2026-11-13',
  securite: 'Ne note jamais de mot de passe, de code (carte, alarme, digicode, téléphone) ni de numéro de carte bancaire, d\'IBAN ou de sécurité sociale : indique plutôt où les trouver. Tes fiches sont enregistrées en ligne par QME (hébergement en Europe, Francfort), protégées par ta clé de licence, sans chiffrement de bout en bout : MémoFamille est un aide-mémoire, pas un coffre-fort numérique certifié.',
  rgpd: 'Tu y notes des informations sur tes proches : garde-les à jour, limitées à l\'utile, et partage le dossier imprimé seulement avec des personnes de confiance.',

  // type : texte, long (plusieurs lignes), date, tel, email, choix (options).
  categories: [
    { id: 'membres', nom: 'Membres du foyer', titre: 'Prénom et nom', aide: 'Une fiche par personne du foyer.', champs: [
      { id: 'naissance', libelle: 'Date de naissance', type: 'date' },
      { id: 'role', libelle: 'Rôle dans le foyer', type: 'texte', exemple: 'Parent, enfant, grand-parent' },
      { id: 'medecin', libelle: 'Médecin traitant', type: 'texte' },
      { id: 'urgence', libelle: 'Informations utiles en cas d\'urgence', type: 'long', exemple: 'Allergies, traitement en cours (sans détail médical inutile)' },
      { id: 'carte-vitale', libelle: 'Où se trouve sa carte Vitale', type: 'texte', exemple: 'Portefeuille, tiroir du bureau' },
    ] },
    { id: 'contacts', nom: 'Contacts importants', titre: 'Nom', aide: 'Proches, voisins, employeurs, notaire, médecin…', champs: [
      { id: 'relation', libelle: 'Relation ou rôle', type: 'texte' },
      { id: 'telephone', libelle: 'Téléphone', type: 'tel' },
      { id: 'email', libelle: 'E-mail', type: 'email' },
      { id: 'adresse', libelle: 'Adresse', type: 'long' },
    ] },
    { id: 'contrats', nom: 'Contrats et abonnements', titre: 'Contrat', aide: 'Assurances, énergie, internet, banque, crédit, mutuelle…', champs: [
      { id: 'type', libelle: 'Type', type: 'choix', options: ['Assurance habitation', 'Assurance auto', 'Complémentaire santé', 'Prévoyance ou assurance-vie', 'Électricité', 'Gaz', 'Eau', 'Internet et téléphone', 'Banque', 'Crédit', 'Abonnement', 'Autre'] },
      { id: 'organisme', libelle: 'Organisme', type: 'texte' },
      { id: 'numero', libelle: 'Numéro de contrat ou de client', type: 'texte', aide: 'Jamais un numéro de carte ou un IBAN.' },
      { id: 'titulaire', libelle: 'Titulaire', type: 'texte' },
      { id: 'echeance', libelle: 'Échéance ou renouvellement', type: 'date' },
      { id: 'joindre', libelle: 'Comment les joindre', type: 'texte', exemple: 'Service client, agence, application' },
      { id: 'ou', libelle: 'Où se trouve le contrat', type: 'texte', exemple: 'Classeur bleu, espace client en ligne' },
    ] },
    { id: 'logement', nom: 'Logement', titre: 'Logement', aide: 'Ce qu\'il faut savoir pour s\'occuper de la maison.', champs: [
      { id: 'adresse', libelle: 'Adresse', type: 'long' },
      { id: 'statut', libelle: 'Statut', type: 'choix', options: ['Propriétaire', 'Locataire', 'Hébergé', 'Autre'] },
      { id: 'gestion', libelle: 'Bailleur, agence ou syndic', type: 'texte' },
      { id: 'electricite', libelle: 'Compteur et tableau électrique', type: 'texte', exemple: 'Placard de l\'entrée' },
      { id: 'eau', libelle: 'Robinet d\'arrivée d\'eau', type: 'texte' },
      { id: 'gaz', libelle: 'Robinet de gaz', type: 'texte' },
      { id: 'chauffage', libelle: 'Chauffage et entretien', type: 'long' },
      { id: 'cles', libelle: 'Qui a un double des clés', type: 'texte' },
      { id: 'alarme', libelle: 'Alarme : prestataire et où trouver la procédure', type: 'texte', aide: 'Jamais le code.' },
    ] },
    { id: 'equipements', nom: 'Équipements', titre: 'Équipement', aide: 'Chaudière, électroménager, informatique…', champs: [
      { id: 'modele', libelle: 'Marque et modèle', type: 'texte' },
      { id: 'achat', libelle: 'Date d\'achat', type: 'date' },
      { id: 'garantie', libelle: 'Garantie jusqu\'au', type: 'date' },
      { id: 'facture', libelle: 'Où sont la facture et la notice', type: 'texte' },
      { id: 'entretien', libelle: 'Entretien', type: 'long' },
    ] },
    { id: 'prestataires', nom: 'Prestataires habituels', titre: 'Prestataire', aide: 'Plombier, électricien, ramoneur, aide à domicile…', champs: [
      { id: 'metier', libelle: 'Métier', type: 'texte' },
      { id: 'telephone', libelle: 'Téléphone', type: 'tel' },
      { id: 'email', libelle: 'E-mail', type: 'email' },
      { id: 'derniere', libelle: 'Dernière intervention', type: 'date' },
    ] },
    { id: 'vehicules', nom: 'Véhicules', titre: 'Véhicule', champs: [
      { id: 'modele', libelle: 'Modèle', type: 'texte' },
      { id: 'immatriculation', libelle: 'Immatriculation', type: 'texte' },
      { id: 'assurance', libelle: 'Assureur', type: 'texte' },
      { id: 'controle', libelle: 'Prochain contrôle technique', type: 'date' },
      { id: 'papiers', libelle: 'Où sont la carte grise et l\'attestation d\'assurance', type: 'texte' },
      { id: 'cles', libelle: 'Double des clés', type: 'texte' },
    ] },
    { id: 'documents', nom: 'Documents importants', titre: 'Document', aide: 'Où se trouvent les originaux et les copies.', champs: [
      { id: 'type', libelle: 'Type', type: 'choix', options: ['Pièce d\'identité', 'Passeport', 'Livret de famille', 'Actes notariés', 'Titre de propriété', 'Bail', 'Impôts', 'Bulletins de salaire', 'Retraite', 'Carnet de santé', 'Diplômes', 'Testament ou dispositions', 'Autre'] },
      { id: 'concerne', libelle: 'Concerne', type: 'texte' },
      { id: 'original', libelle: 'Où est l\'original', type: 'texte' },
      { id: 'copie', libelle: 'Où est la copie', type: 'texte' },
      { id: 'validite', libelle: 'Valable jusqu\'au', type: 'date' },
    ] },
    { id: 'consignes', nom: 'Consignes pratiques', titre: 'Situation', aide: 'Ce que tu veux que tes proches sachent si tu es indisponible.', champs: [
      { id: 'quand', libelle: 'Quand l\'appliquer', type: 'texte', exemple: 'Si je suis hospitalisé, en déplacement long…' },
      { id: 'consigne', libelle: 'Consigne', type: 'long' },
      { id: 'contact', libelle: 'Personne à prévenir', type: 'texte' },
    ] },
    { id: 'enfants', nom: 'Enfants', titre: 'Prénom', aide: 'Ce qu\'il faut savoir pour s\'occuper des enfants.', champs: [
      { id: 'ecole', libelle: 'École ou mode de garde', type: 'texte' },
      { id: 'contact-ecole', libelle: 'Contact de l\'école ou de la garde', type: 'tel' },
      { id: 'autorises', libelle: 'Personnes autorisées à le récupérer', type: 'long' },
      { id: 'activites', libelle: 'Activités et horaires', type: 'long' },
      { id: 'sante', libelle: 'Informations utiles (allergies, habitudes)', type: 'long' },
    ] },
    { id: 'animaux', nom: 'Animaux', titre: 'Nom de l\'animal', champs: [
      { id: 'espece', libelle: 'Espèce et race', type: 'texte' },
      { id: 'veterinaire', libelle: 'Vétérinaire', type: 'texte' },
      { id: 'identification', libelle: 'Numéro d\'identification', type: 'texte' },
      { id: 'alimentation', libelle: 'Alimentation', type: 'texte' },
      { id: 'soins', libelle: 'Soins et habitudes', type: 'long' },
      { id: 'garde', libelle: 'Qui peut le garder', type: 'texte' },
    ] },
  ],

  // Mots et expressions refusés : une information de connexion ou un code ne doit jamais être noté.
  motsInterdits: [
    ['mot de passe', 'un mot de passe'], ['mots de passe', 'des mots de passe'], ['mdp', 'un mot de passe'], ['password', 'un mot de passe'], ['passcode', 'un code'],
    ['code pin', 'un code PIN'], ['code secret', 'un code secret'], ['code confidentiel', 'un code confidentiel'], ['cryptogramme', 'un cryptogramme de carte'], ['cvv', 'un cryptogramme de carte'],
    ['code d\'alarme', 'un code d\'alarme'], ['code alarme', 'un code d\'alarme'], ['digicode', 'un digicode'], ['code d\'accès', 'un code d\'accès'], ['code de déverrouillage', 'un code de déverrouillage'],
    ['identifiant de connexion', 'un identifiant de connexion'], ['login', 'un identifiant de connexion'], ['puk', 'un code PUK'],
  ],

  conseils: [
    ['Où, pas quoi', 'Pour un document ou un code, note où le trouver (« classeur bleu », « gestionnaire de mots de passe ») : jamais le code lui-même.'],
    ['Petit à petit', 'Commence par les contacts, les contrats et le logement : ce sont les informations les plus cherchées.'],
    ['Choisir ce qu\'on partage', 'Chaque fiche peut être marquée « privée » : elle reste hors du dossier imprimé, sauf si tu la coches.'],
    ['Revoir chaque année', 'Les fiches non revues depuis un an sont signalées : un aide-mémoire périmé induit en erreur.'],
  ],
};
