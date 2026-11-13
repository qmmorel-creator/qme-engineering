// Base intégrée du générateur de devis : taux de TVA (modifiables), unités, catalogues types par métier
// (sans prix), mentions d'un devis et sources officielles datées. Aucune logique ici.
// Mise à jour : revérifier chaque année les taux et les mentions (sources ci-dessous).
globalThis.BASE = {
  consulteLe: '2026-11-12',

  // Taux en centièmes de pourcent (2000 = 20 %). L'utilisateur peut les modifier dans l'onglet Entreprise.
  tva: [
    { taux: 2000, libelle: 'Taux normal' },
    { taux: 1000, libelle: 'Taux réduit (dont certains travaux dans les logements)' },
    { taux: 550, libelle: 'Taux réduit (dont rénovation énergétique des logements)' },
    { taux: 210, libelle: 'Taux particulier' },
    { taux: 0, libelle: 'Exonéré ou non soumis' },
  ],

  unites: ['u', 'h', 'j', 'forfait', 'm²', 'm', 'm³', 'kg', 'lot', 'mois', 'page', 'mot'],

  // Catalogues types par métier, sans prix (chaque prix dépend de toi). batiment : rappel décennale.
  metiers: [
    { id: 'plomberie', nom: 'Plomberie, chauffage', batiment: true, lignes: [
      ['Déplacement', 'forfait'], ['Main-d\'œuvre', 'h'], ['Recherche de fuite', 'forfait'], ['Remplacement d\'un mitigeur', 'u'],
      ['Fourniture et pose d\'un WC suspendu', 'u'], ['Remplacement d\'un chauffe-eau', 'u'], ['Détartrage d\'un chauffe-eau', 'u'],
      ['Entretien annuel de chaudière', 'u'], ['Désembouage d\'un circuit de chauffage', 'forfait'], ['Fourniture et pose de tuyauterie', 'm'],
      ['Débouchage de canalisation', 'forfait'], ['Évacuation des déchets', 'forfait'] ] },
    { id: 'electricite', nom: 'Électricité', batiment: true, lignes: [
      ['Déplacement', 'forfait'], ['Main-d\'œuvre', 'h'], ['Diagnostic et recherche de panne', 'forfait'], ['Fourniture et pose d\'une prise', 'u'],
      ['Fourniture et pose d\'un point lumineux', 'u'], ['Fourniture et pose d\'un interrupteur', 'u'], ['Remplacement du tableau électrique', 'u'],
      ['Fourniture et pose de câble', 'm'], ['Fourniture et pose de goulotte', 'm'], ['Mise en sécurité de l\'installation', 'forfait'],
      ['Pose d\'un radiateur électrique', 'u'] ] },
    { id: 'peinture', nom: 'Peinture, revêtements', batiment: true, lignes: [
      ['Protection des sols et des meubles', 'forfait'], ['Lessivage des murs', 'm²'], ['Rebouchage et ponçage', 'm²'], ['Impression (sous-couche)', 'm²'],
      ['Peinture des murs, deux couches', 'm²'], ['Peinture des plafonds, deux couches', 'm²'], ['Peinture des boiseries', 'm'],
      ['Pose de papier peint', 'm²'], ['Dépose de revêtement mural', 'm²'], ['Fourniture de peinture', 'lot'], ['Nettoyage de fin de chantier', 'forfait'] ] },
    { id: 'menuiserie', nom: 'Menuiserie', batiment: true, lignes: [
      ['Prise de cotes', 'forfait'], ['Fourniture et pose d\'une porte intérieure', 'u'], ['Fourniture et pose d\'une fenêtre', 'u'],
      ['Fourniture et pose d\'un placard sur mesure', 'u'], ['Pose de parquet', 'm²'], ['Pose de plinthes', 'm'], ['Ajustage et réglage de portes', 'u'],
      ['Fabrication d\'étagères', 'u'], ['Main-d\'œuvre', 'h'], ['Évacuation des déchets', 'forfait'] ] },
    { id: 'maconnerie', nom: 'Maçonnerie', batiment: true, lignes: [
      ['Installation de chantier', 'forfait'], ['Terrassement', 'm³'], ['Fondations', 'm'], ['Dalle béton', 'm²'], ['Élévation de mur en parpaings', 'm²'],
      ['Ouverture dans un mur porteur', 'u'], ['Enduit de façade', 'm²'], ['Chape', 'm²'], ['Location de matériel', 'j'], ['Évacuation des gravats', 'm³'] ] },
    { id: 'carrelage', nom: 'Carrelage, faïence', batiment: true, lignes: [
      ['Dépose de l\'ancien carrelage', 'm²'], ['Ragréage du sol', 'm²'], ['Pose de carrelage au sol', 'm²'], ['Pose de faïence murale', 'm²'],
      ['Pose de plinthes carrelées', 'm'], ['Joints', 'm²'], ['Fourniture de carrelage', 'm²'], ['Fourniture de colle et de joints', 'lot'], ['Évacuation des déchets', 'forfait'] ] },
    { id: 'jardin', nom: 'Jardin, paysage', batiment: false, lignes: [
      ['Tonte de pelouse', 'm²'], ['Taille de haie', 'm'], ['Élagage', 'u'], ['Débroussaillage', 'm²'], ['Ramassage des feuilles', 'h'],
      ['Plantation', 'u'], ['Engazonnement', 'm²'], ['Évacuation des déchets verts', 'm³'], ['Contrat d\'entretien', 'mois'], ['Main-d\'œuvre', 'h'] ] },
    { id: 'web', nom: 'Développement web', batiment: false, lignes: [
      ['Atelier de cadrage', 'j'], ['Maquettes des pages', 'u'], ['Intégration d\'une page', 'u'], ['Développement de fonctionnalité', 'j'],
      ['Mise en ligne et configuration', 'forfait'], ['Référencement naturel de base', 'forfait'], ['Formation à l\'administration du site', 'h'],
      ['Maintenance et mises à jour', 'mois'], ['Hébergement (refacturé)', 'mois'], ['Recette et corrections', 'j'] ] },
    { id: 'graphisme', nom: 'Graphisme', batiment: false, lignes: [
      ['Brief et recherche', 'forfait'], ['Création de logo', 'forfait'], ['Charte graphique', 'forfait'], ['Déclinaison de support', 'u'],
      ['Mise en page', 'page'], ['Cartes de visite', 'u'], ['Visuels pour réseaux sociaux', 'u'], ['Aller-retour de corrections supplémentaire', 'u'],
      ['Préparation des fichiers d\'impression', 'forfait'], ['Cession de droits d\'auteur', 'forfait'] ] },
    { id: 'redaction', nom: 'Rédaction, traduction', batiment: false, lignes: [
      ['Rédaction d\'article', 'mot'], ['Rédaction de page web', 'u'], ['Fiche produit', 'u'], ['Relecture et correction', 'page'],
      ['Traduction', 'mot'], ['Révision de traduction', 'mot'], ['Entretien et recherche', 'h'], ['Livraison en urgence', 'forfait'] ] },
    { id: 'conseil', nom: 'Conseil, formation', batiment: false, lignes: [
      ['Entretien de cadrage', 'h'], ['Audit', 'j'], ['Mission de conseil', 'j'], ['Journée de formation', 'j'], ['Demi-journée de formation', 'u'],
      ['Préparation des supports', 'forfait'], ['Accompagnement individuel', 'h'], ['Rapport et restitution', 'forfait'], ['Frais de déplacement', 'forfait'] ] },
    { id: 'photo', nom: 'Photographie, vidéo', batiment: false, lignes: [
      ['Séance photo', 'h'], ['Reportage', 'j'], ['Demi-journée de prise de vue', 'u'], ['Retouche', 'u'], ['Montage vidéo', 'j'],
      ['Tournage', 'j'], ['Livraison des fichiers', 'forfait'], ['Tirages', 'u'], ['Frais de déplacement', 'forfait'], ['Cession de droits d\'utilisation', 'forfait'] ] },
  ],

  conditionsTypes: [
    'Paiement à réception de facture.',
    'Paiement à 30 jours à compter de la date de facture.',
    'Acompte à la signature, solde à la fin des travaux.',
    'Paiement par virement bancaire.',
  ],

  // Mentions d'un devis, telles que relevées sur les sources officielles (voir `sources`).
  mentions: [
    { titre: 'Devis de travaux et de dépannage (bâtiment, équipement de la maison)', source: 'F31144', points: [
      'Date de rédaction', 'Nom et adresse de l\'entreprise', 'Nom du client', 'Lieu d\'exécution de l\'opération',
      'Nature exacte des réparations à effectuer', 'Décompte détaillé, en quantité et en prix, de chaque prestation et produit nécessaires',
      'Taux horaire de main-d\'œuvre TTC', 'Modalités de décompte du temps estimé', 'Frais de déplacement, s\'il y en a',
      'Somme globale à payer HT et TTC, avec le taux de TVA', 'Durée de validité de l\'offre', 'Devis gratuit ou payant, et son coût s\'il est payant' ] },
    { titre: 'Identification de l\'entreprise', source: 'F37370 · F37371', points: [
      'Entreprise individuelle : nom et prénom accompagnés de la mention « Entrepreneur individuel » ou « EI »',
      'Numéro SIREN et adresse', 'Activité commerciale : « RCS » suivi de la ville du greffe ; activité artisanale, libérale ou agricole : numéro RNE',
      'Société : forme juridique et montant du capital social' ] },
    { titre: 'Assurance professionnelle', source: 'L132-1 · F37370 · L243-2', points: [
      'Entreprise du secteur des métiers et de l\'artisanat dont l\'assurance professionnelle est obligatoire : l\'indiquer sur chaque devis, avec les coordonnées de l\'assureur ou du garant et la couverture géographique du contrat',
      'Travaux soumis à l\'assurance décennale : les attestations d\'assurance sont jointes aux devis et factures' ] },
    { titre: 'TVA', source: 'F21746 · F23568', points: [
      'Franchise en base : mention « TVA non applicable - article 293 B du CGI »',
      'Taux réduit pour des travaux dans un logement achevé depuis plus de 2 ans : le client certifie sur le devis ou la facture que les conditions sont remplies' ] },
    { titre: 'Acceptation par le client', source: 'F2533', points: [
      'Le devis signé par les deux parties devient un contrat ; le client signe en ajoutant « bon pour travaux » ou « bon pour accord » au-dessus de sa signature',
      'Le devis est en général gratuit ; il peut être payant (déplacement, étude particulière) si le client en est informé avant',
      'Acompte ou arrhes : si rien n\'est indiqué sur le devis, la somme versée est considérée comme des arrhes' ] },
  ],

  sources: [
    { code: 'F31144', nom: 'Devis obligatoire : activités concernées', site: 'entreprendre.service-public.gouv.fr', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F31144', verifie: 'vérifiée le 09/09/2022' },
    { code: 'F37370', nom: 'Documents commerciaux d\'une entreprise individuelle', site: 'entreprendre.service-public.gouv.fr', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F37370', verifie: 'vérifiée le 08/12/2025' },
    { code: 'F37371', nom: 'Documents commerciaux d\'une société', site: 'entreprendre.service-public.gouv.fr', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F37371', verifie: 'vérifiée le 08/12/2025' },
    { code: 'L132-1', nom: 'Code de l\'artisanat, article L132-1', site: 'legifrance.gouv.fr', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047362294', verifie: 'en vigueur depuis le 01/07/2023' },
    { code: 'L243-2', nom: 'Code des assurances, article L243-2', site: 'legifrance.gouv.fr', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031010272', verifie: 'version en vigueur depuis le 08/08/2015' },
    { code: 'F2533', nom: 'Doit-on signer un devis ou un contrat avant de faire réaliser des travaux ?', site: 'service-public.gouv.fr', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2533', verifie: 'vérifiée le 16/10/2026' },
    { code: 'F21746', nom: 'Franchise en base de TVA', site: 'entreprendre.service-public.gouv.fr', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F21746', verifie: 'vérifiée le 01/01/2026' },
    { code: 'F23568', nom: 'Taux de TVA pour les travaux de rénovation d\'un logement', site: 'entreprendre.service-public.gouv.fr', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23568', verifie: 'vérifiée le 21/02/2026' },
    { code: 'TVA', nom: 'Plusieurs taux de TVA (20 %, 10 %, 5,5 %)', site: 'impots.gouv.fr', url: 'https://www.impots.gouv.fr/particulier/plusieurs-taux-de-tva', verifie: 'page modifiée le 19/09/2016' },
    { code: 'TVA-2,1', nom: 'Entreprises : ce que vous devez savoir sur la TVA (taux particulier de 2,1 %)', site: 'economie.gouv.fr', url: 'https://www.economie.gouv.fr/entreprises/gerer-sa-fiscalite-et-ses-impots/autres-impots-et-taxes/entreprises-ce-que-vous-devez-savoir-sur-la-tva', verifie: '' },
    { code: 'DOM', nom: 'Quels sont les différents taux de TVA applicables dans les DOM ?', site: 'impots.gouv.fr', url: 'https://www.impots.gouv.fr/professionnel/questions/quels-sont-les-differents-taux-de-tva-applicables-dans-les-dom', verifie: 'page modifiée le 13/10/2026' },
  ],
};
