// Base intégrée de l'État des lieux d'entrée et de sortie : états codés, types de pièces et leurs éléments types,
// modèles de logement, compteurs et clés types, réglages par défaut, contenu minimal rappelé, sources, conseils.
// Aucune logique ici. AUCUNE grille de vétusté n'est intégrée : elle se convient dans le bail et se saisit dans le
// dossier. Les règles citées (délais de restitution du dépôt de garantie, délai de rectification, contenu minimal)
// sont des PARAMÈTRES relevés le 14/11/2026 sur service-public.gouv.fr, modifiables dans les Réglages.
(() => {
  window.BASE = {
    version: '2026-11-14',

    // États codés, du meilleur au moins bon : le rang sert à comparer la sortie à l'entrée.
    etats: [
      { code: 'neuf', nom: 'Neuf', court: 'N', aide: 'Neuf ou refait à neuf, sans trace d\'usage.' },
      { code: 'bon', nom: 'Bon état', court: 'B', aide: 'Propre, fonctionne, quelques traces légères.' },
      { code: 'usage', nom: 'Usage normal', court: 'U', aide: 'Usure normale liée au temps et à un usage normal.' },
      { code: 'degrade', nom: 'Dégradé', court: 'D', aide: 'Taché, abîmé, cassé en partie : à reprendre.' },
      { code: 'hs', nom: 'Hors service', court: 'HS', aide: 'Ne fonctionne plus ou à remplacer.' },
    ],

    // Catégories d'éléments (ordre d'affichage dans une pièce).
    categories: [
      { code: 'sols', nom: 'Sols' },
      { code: 'murs', nom: 'Murs' },
      { code: 'plafonds', nom: 'Plafonds' },
      { code: 'menuiseries', nom: 'Menuiseries' },
      { code: 'electricite', nom: 'Électricité' },
      { code: 'plomberie', nom: 'Plomberie' },
      { code: 'chauffage', nom: 'Chauffage, ventilation' },
      { code: 'equipements', nom: 'Équipements' },
      { code: 'mobilier', nom: 'Mobilier (meublé)' },
    ],

    // Types de pièces : éléments proposés [nom, catégorie]. `meuble` : ajoutés seulement en location meublée.
    pieces: [
      { code: 'entree', nom: 'Entrée', elements: [['Porte d\'entrée', 'menuiseries'], ['Serrure et verrous', 'menuiseries'], ['Sol', 'sols'], ['Murs', 'murs'], ['Plafond', 'plafonds'], ['Placard', 'menuiseries'], ['Prises et interrupteurs', 'electricite'], ['Éclairage', 'electricite'], ['Interphone ou visiophone', 'equipements']], meuble: [['Portemanteau ou rangement', 'mobilier']] },
      { code: 'sejour', nom: 'Séjour', elements: [['Sol', 'sols'], ['Murs', 'murs'], ['Plafond', 'plafonds'], ['Porte', 'menuiseries'], ['Fenêtres', 'menuiseries'], ['Volets ou stores', 'menuiseries'], ['Prises et interrupteurs', 'electricite'], ['Éclairage', 'electricite'], ['Radiateur', 'chauffage']], meuble: [['Canapé ou fauteuils', 'mobilier'], ['Table', 'mobilier'], ['Chaises', 'mobilier'], ['Rangements', 'mobilier'], ['Luminaires', 'mobilier']] },
      { code: 'cuisine', nom: 'Cuisine', elements: [['Sol', 'sols'], ['Murs et crédence', 'murs'], ['Plafond', 'plafonds'], ['Porte', 'menuiseries'], ['Fenêtre', 'menuiseries'], ['Évier et robinetterie', 'plomberie'], ['Plan de travail', 'equipements'], ['Placards et tiroirs', 'equipements'], ['Plaques de cuisson', 'equipements'], ['Four', 'equipements'], ['Hotte', 'equipements'], ['Prises et interrupteurs', 'electricite'], ['Éclairage', 'electricite'], ['Radiateur', 'chauffage'], ['Ventilation', 'chauffage']], meuble: [['Réfrigérateur et congélateur', 'mobilier'], ['Four à micro-ondes', 'mobilier'], ['Vaisselle et ustensiles', 'mobilier'], ['Table et chaises', 'mobilier'], ['Ustensiles d\'entretien', 'mobilier']] },
      { code: 'chambre', nom: 'Chambre', elements: [['Sol', 'sols'], ['Murs', 'murs'], ['Plafond', 'plafonds'], ['Porte', 'menuiseries'], ['Fenêtre', 'menuiseries'], ['Volets ou stores', 'menuiseries'], ['Placard', 'menuiseries'], ['Prises et interrupteurs', 'electricite'], ['Éclairage', 'electricite'], ['Radiateur', 'chauffage']], meuble: [['Lit', 'mobilier'], ['Literie (matelas, couette, oreillers)', 'mobilier'], ['Rideaux ou occultation', 'mobilier'], ['Rangements', 'mobilier'], ['Luminaire', 'mobilier']] },
      { code: 'sdb', nom: 'Salle de bains', elements: [['Sol', 'sols'], ['Murs et faïence', 'murs'], ['Plafond', 'plafonds'], ['Porte', 'menuiseries'], ['Baignoire ou douche', 'plomberie'], ['Lavabo et robinetterie', 'plomberie'], ['Joints', 'plomberie'], ['Meuble vasque et miroir', 'equipements'], ['Chauffe-eau', 'plomberie'], ['Prises et interrupteurs', 'electricite'], ['Éclairage', 'electricite'], ['Sèche-serviettes', 'chauffage'], ['Ventilation (VMC)', 'chauffage']], meuble: [['Rideau de douche ou paroi', 'mobilier']] },
      { code: 'wc', nom: 'WC', elements: [['Sol', 'sols'], ['Murs', 'murs'], ['Plafond', 'plafonds'], ['Porte', 'menuiseries'], ['Cuvette, abattant et chasse d\'eau', 'plomberie'], ['Lave-mains', 'plomberie'], ['Éclairage', 'electricite'], ['Ventilation', 'chauffage']], meuble: [] },
      { code: 'degagement', nom: 'Couloir, dégagement', elements: [['Sol', 'sols'], ['Murs', 'murs'], ['Plafond', 'plafonds'], ['Placard', 'menuiseries'], ['Prises et interrupteurs', 'electricite'], ['Éclairage', 'electricite']], meuble: [] },
      { code: 'bureau', nom: 'Bureau', elements: [['Sol', 'sols'], ['Murs', 'murs'], ['Plafond', 'plafonds'], ['Porte', 'menuiseries'], ['Fenêtre', 'menuiseries'], ['Prises et interrupteurs', 'electricite'], ['Éclairage', 'electricite'], ['Radiateur', 'chauffage']], meuble: [['Bureau et chaise', 'mobilier'], ['Rangements', 'mobilier']] },
      { code: 'buanderie', nom: 'Buanderie, cellier', elements: [['Sol', 'sols'], ['Murs', 'murs'], ['Plafond', 'plafonds'], ['Arrivée et évacuation d\'eau', 'plomberie'], ['Prises', 'electricite'], ['Éclairage', 'electricite']], meuble: [['Lave-linge', 'mobilier']] },
      { code: 'exterieur', nom: 'Balcon, terrasse, jardin', elements: [['Sol', 'sols'], ['Garde-corps ou clôture', 'menuiseries'], ['Éclairage extérieur', 'electricite'], ['Robinet extérieur', 'plomberie'], ['Végétation', 'equipements']], meuble: [['Mobilier de jardin', 'mobilier']] },
      { code: 'annexe', nom: 'Cave, garage, parking', elements: [['Porte ou portail', 'menuiseries'], ['Sol', 'sols'], ['Murs', 'murs'], ['Éclairage', 'electricite']], meuble: [] },
      { code: 'autre', nom: 'Autre pièce', elements: [['Sol', 'sols'], ['Murs', 'murs'], ['Plafond', 'plafonds'], ['Porte', 'menuiseries'], ['Éclairage', 'electricite']], meuble: [] },
    ],

    // Modèles de logement : pièces créées au départ (tout se modifie ensuite).
    modeles: [
      { code: 'studio', nom: 'Studio', aide: 'Entrée, pièce principale, coin cuisine, salle d\'eau avec WC', pieces: [['entree', 'Entrée'], ['sejour', 'Pièce principale'], ['cuisine', 'Coin cuisine'], ['sdb', 'Salle d\'eau et WC']] },
      { code: 't2', nom: 'T2', aide: 'Entrée, séjour, cuisine, chambre, salle de bains, WC', pieces: [['entree', 'Entrée'], ['sejour', 'Séjour'], ['cuisine', 'Cuisine'], ['chambre', 'Chambre'], ['sdb', 'Salle de bains'], ['wc', 'WC']] },
      { code: 't3', nom: 'T3', aide: 'Comme le T2, avec deux chambres et un couloir', pieces: [['entree', 'Entrée'], ['sejour', 'Séjour'], ['cuisine', 'Cuisine'], ['degagement', 'Couloir'], ['chambre', 'Chambre 1'], ['chambre', 'Chambre 2'], ['sdb', 'Salle de bains'], ['wc', 'WC']] },
      { code: 't4', nom: 'T4', aide: 'Trois chambres, couloir, cave', pieces: [['entree', 'Entrée'], ['sejour', 'Séjour'], ['cuisine', 'Cuisine'], ['degagement', 'Couloir'], ['chambre', 'Chambre 1'], ['chambre', 'Chambre 2'], ['chambre', 'Chambre 3'], ['sdb', 'Salle de bains'], ['wc', 'WC'], ['annexe', 'Cave']] },
      { code: 'maison', nom: 'Maison', aide: 'Trois chambres, buanderie, garage, jardin', pieces: [['entree', 'Entrée'], ['sejour', 'Séjour'], ['cuisine', 'Cuisine'], ['chambre', 'Chambre 1'], ['chambre', 'Chambre 2'], ['chambre', 'Chambre 3'], ['sdb', 'Salle de bains'], ['wc', 'WC'], ['buanderie', 'Buanderie'], ['annexe', 'Garage'], ['exterieur', 'Jardin']] },
      { code: 'vide', nom: 'Sans pièce', aide: 'Tu ajoutes toi-même chaque pièce', pieces: [] },
    ],

    // Compteurs individuels : relevés à l'entrée et à la sortie.
    compteurs: [
      { code: 'eau-froide', nom: 'Eau froide', unite: 'm³' },
      { code: 'eau-chaude', nom: 'Eau chaude', unite: 'm³' },
      { code: 'elec-base', nom: 'Électricité (base)', unite: 'kWh' },
      { code: 'elec-hp', nom: 'Électricité heures pleines', unite: 'kWh' },
      { code: 'elec-hc', nom: 'Électricité heures creuses', unite: 'kWh' },
      { code: 'gaz', nom: 'Gaz', unite: 'm³' },
      { code: 'chauffage', nom: 'Chauffage (répartiteur ou calorimètre)', unite: 'unités' },
      { code: 'autre', nom: 'Autre compteur', unite: '' },
    ],

    // Clés et moyens d'accès.
    cles: [
      { code: 'porte', nom: 'Clé de la porte d\'entrée' },
      { code: 'immeuble', nom: 'Clé ou badge de l\'immeuble' },
      { code: 'boite', nom: 'Clé de la boîte aux lettres' },
      { code: 'cave', nom: 'Clé de la cave' },
      { code: 'garage', nom: 'Clé du garage ou du parking' },
      { code: 'telecommande', nom: 'Télécommande de portail' },
      { code: 'autre', nom: 'Autre accès' },
    ],

    // Réglages par défaut, relevés le 14/11/2026 sur service-public.gouv.fr (voir `sources`), modifiables.
    reglages: {
      restitutionConforme: 1,    // dépôt de garantie rendu au plus 1 mois après la remise des clés si la sortie est conforme à l'entrée (F31269)
      restitutionNonConforme: 2, // 2 mois sinon (F31269)
      rectificationJours: 10,    // le locataire peut demander de compléter l'état des lieux d'entrée dans les 10 jours (F31270)
      photosMax: 30,             // vignettes gardées par compte (taille des données limitée à 900 Ko)
      verifieLe: '2026-11-14',
    },

    // Contenu minimal d'un état des lieux, d'après service-public.gouv.fr (F31270 entrée, F33671 sortie).
    contenu: {
      entree: ['Type d\'état des lieux (entrée)', 'Date d\'établissement', 'Localisation du logement', 'Nom des parties et domicile du bailleur (ou de son représentant)', 'S\'il y a lieu, personnes mandatées pour le réaliser', 'S\'il y a lieu, relevés des compteurs individuels', 'Clés et moyens d\'accès', 'Pour chaque pièce : sols, murs, plafonds, équipements et meubles', 'Signature des parties'],
      sortie: ['Type d\'état des lieux (sortie)', 'Date d\'établissement', 'Localisation du logement', 'Nom des parties et domicile du bailleur', 'S\'il y a lieu, personnes mandatées pour le réaliser', 'Relevés des compteurs individuels', 'Clés et moyens d\'accès', 'Pour chaque pièce : sols, murs, plafonds, équipements et meubles', 'Signature des parties', 'Adresse du nouveau domicile du locataire', 'Date de l\'état des lieux d\'entrée', 'Évolutions constatées depuis l\'entrée'],
    },

    sources: [
      ['État des lieux d\'entrée (service-public.gouv.fr, fiche F31270, vérifiée le 10/03/2026 par l\'éditeur, consultée le 14/11/2026)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F31270'],
      ['État des lieux de sortie (service-public.gouv.fr, fiche F33671, vérifiée le 10/03/2026 par l\'éditeur, consultée le 14/11/2026)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F33671'],
      ['Dépôt de garantie (service-public.gouv.fr, fiche F31269, vérifiée le 09/06/2026 par l\'éditeur, consultée le 14/11/2026)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F31269'],
      ['Décret n° 2016-382 du 30 mars 2016 (établissement de l\'état des lieux et prise en compte de la vétusté), Légifrance', 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000032320564/'],
    ],
    sourceRegles: 'Règles relevées le 14/11/2026 sur service-public.gouv.fr (fiches F31270, F33671 et F31269). Elles peuvent changer : vérifie-les avant de t\'en servir.',

    conseils: [
      ['Un dossier par bail', 'Logement, parties, dates du bail et dépôt de garantie : l\'entrée et la sortie se remplissent dans le même dossier, pièce par pièce.'],
      ['Un état par élément', 'Neuf, bon, usage normal, dégradé ou hors service, en un toucher, avec un commentaire et une photo si besoin.'],
      ['La sortie comparée à l\'entrée', 'Chaque élément moins bon qu\'à l\'entrée ressort, avec la vétusté de la grille convenue dans le bail si tu la saisis.'],
      ['Un document à signer', 'Le document s\'imprime avec une colonne entrée et une colonne sortie, les compteurs, les clés et les cases de signature.'],
    ],
  };
})();
