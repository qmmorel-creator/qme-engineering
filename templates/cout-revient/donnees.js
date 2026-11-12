// Base intégrée du template « Coût de revient et prix par client » : postes de charges types
// (sans montants) et deux structures types. Aucun taux de cotisations ni montant réglementaire :
// ces valeurs dépendent du statut de chacun et sont saisies par l'utilisateur.
window.BASE = {
  // Couleurs des clients, attribuées dans cet ordre, jamais générées.
  couleurs: [
    { id: 'rouge', hex: '#D9302A', nom: 'Rouge' },
    { id: 'bleu', hex: '#1D4E89', nom: 'Bleu' },
    { id: 'jaune', hex: '#F5B400', nom: 'Jaune' },
    { id: 'encre', hex: '#141414', nom: 'Noir' },
    { id: 'vert', hex: '#2E7D4F', nom: 'Vert' },
    { id: 'orange', hex: '#E8702A', nom: 'Orange' },
    { id: 'ciel', hex: '#4A90C2', nom: 'Bleu ciel' },
    { id: 'prune', hex: '#7A3E6B', nom: 'Prune' },
  ],

  categories: [
    { id: 'local', nom: 'Local et bureau' },
    { id: 'materiel', nom: 'Matériel' },
    { id: 'logiciels', nom: 'Logiciels et numérique' },
    { id: 'assurances', nom: 'Assurances et protection' },
    { id: 'services', nom: 'Services et gestion' },
    { id: 'deplacements', nom: 'Déplacements' },
    { id: 'commercial', nom: 'Commercial' },
    { id: 'formation', nom: 'Formation et réseau' },
    { id: 'divers', nom: 'Divers' },
  ],

  // Postes de charges types d'un prestataire de services. periode : saisie conseillée (mois ou an).
  postes: [
    { id: 'loyer', nom: 'Loyer du bureau ou du coworking', categorie: 'local', periode: 'mois' },
    { id: 'charges-locatives', nom: 'Charges locatives', categorie: 'local', periode: 'mois' },
    { id: 'energie', nom: 'Électricité et chauffage', categorie: 'local', periode: 'mois' },
    { id: 'domiciliation', nom: 'Domiciliation', categorie: 'local', periode: 'mois' },
    { id: 'ordinateur', nom: 'Ordinateur et écrans (amortissement)', categorie: 'materiel', periode: 'an' },
    { id: 'telephone', nom: 'Téléphone (amortissement)', categorie: 'materiel', periode: 'an' },
    { id: 'mobilier', nom: 'Mobilier de bureau', categorie: 'materiel', periode: 'an' },
    { id: 'petit-materiel', nom: 'Petit matériel et fournitures', categorie: 'materiel', periode: 'an' },
    { id: 'logiciels', nom: 'Logiciels et abonnements', categorie: 'logiciels', periode: 'mois' },
    { id: 'hebergement', nom: 'Hébergement web et nom de domaine', categorie: 'logiciels', periode: 'an' },
    { id: 'stockage', nom: 'Stockage et sauvegarde en ligne', categorie: 'logiciels', periode: 'mois' },
    { id: 'internet', nom: 'Accès internet', categorie: 'logiciels', periode: 'mois' },
    { id: 'mobile', nom: 'Forfait mobile', categorie: 'logiciels', periode: 'mois' },
    { id: 'rc-pro', nom: 'Responsabilité civile professionnelle', categorie: 'assurances', periode: 'an' },
    { id: 'prevoyance', nom: 'Prévoyance', categorie: 'assurances', periode: 'mois' },
    { id: 'mutuelle', nom: 'Complémentaire santé', categorie: 'assurances', periode: 'mois' },
    { id: 'assurance-materiel', nom: 'Assurance du matériel et du local', categorie: 'assurances', periode: 'an' },
    { id: 'comptable', nom: 'Expert-comptable', categorie: 'services', periode: 'an' },
    { id: 'banque', nom: 'Compte bancaire professionnel', categorie: 'services', periode: 'mois' },
    { id: 'juridique', nom: 'Conseil juridique', categorie: 'services', periode: 'an' },
    { id: 'facturation', nom: 'Outil de facturation et de devis', categorie: 'services', periode: 'mois' },
    { id: 'vehicule', nom: 'Véhicule (part professionnelle)', categorie: 'deplacements', periode: 'mois' },
    { id: 'transports', nom: 'Transports et péages', categorie: 'deplacements', periode: 'mois' },
    { id: 'repas', nom: 'Repas et rendez-vous clients', categorie: 'deplacements', periode: 'mois' },
    { id: 'site', nom: 'Site internet et visibilité', categorie: 'commercial', periode: 'an' },
    { id: 'publicite', nom: 'Publicité et prospection', categorie: 'commercial', periode: 'an' },
    { id: 'salons', nom: 'Salons et événements', categorie: 'commercial', periode: 'an' },
    { id: 'formation', nom: 'Formation', categorie: 'formation', periode: 'an' },
    { id: 'documentation', nom: 'Livres et documentation', categorie: 'formation', periode: 'an' },
    { id: 'reseau', nom: 'Adhésions et réseaux professionnels', categorie: 'formation', periode: 'an' },
    { id: 'impots-locaux', nom: 'Impôts et taxes de l\'entreprise', categorie: 'divers', periode: 'an' },
    { id: 'imprevus', nom: 'Réserve pour imprévus', categorie: 'divers', periode: 'an' },
  ],

  // Structures types : postes cochés d'office et réglages de capacité de départ (modifiables).
  structures: [
    {
      id: 'solo', nom: 'Indépendant seul', detail: 'Une personne qui facture son temps',
      personnes: 1, partNonFacturable: 30, conges: 25, absences: 5, heuresJour: 7,
      postes: ['loyer', 'ordinateur', 'telephone', 'logiciels', 'hebergement', 'internet', 'mobile', 'rc-pro', 'prevoyance', 'mutuelle', 'comptable', 'banque', 'transports', 'site', 'formation', 'impots-locaux'],
    },
    {
      id: 'agence', nom: 'Agence de 3 personnes', detail: 'Trois personnes qui facturent, un bureau',
      personnes: 3, partNonFacturable: 35, conges: 25, absences: 5, heuresJour: 7,
      postes: ['loyer', 'charges-locatives', 'energie', 'ordinateur', 'telephone', 'mobilier', 'petit-materiel', 'logiciels', 'hebergement', 'stockage', 'internet', 'mobile', 'rc-pro', 'prevoyance', 'mutuelle', 'assurance-materiel', 'comptable', 'banque', 'juridique', 'facturation', 'vehicule', 'transports', 'repas', 'site', 'publicite', 'salons', 'formation', 'reseau', 'impots-locaux', 'imprevus'],
    },
  ],
};
