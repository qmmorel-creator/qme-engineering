// Base intégrée des Vérifications réglementaires : types de contrôles avec leur périodicité SOURCÉE.
// Règle du produit : aucune périodicité sans source officielle datée. Chaque type ci-dessous renvoie à la
// brochure INRS ED 828 « Principales vérifications périodiques » (édition de septembre 2026), page et textes
// cités par l'INRS, consultée le 14/11/2026. Un contrôle absent de cette liste se crée en type « Autre » :
// l'utilisateur saisit lui-même sa périodicité (affichée « saisie par toi »).
// nature : 'reglementaire' (texte de loi ou arrêté) ou 'referentiel' (règle APSAD ou norme citée par l'INRS,
// pas un texte de loi). champ : à qui s'applique la ligne de la brochure.
window.BASE = {
  version: '2026-11-14',

  source: {
    titre: 'INRS, brochure ED 828 « Principales vérifications périodiques »',
    edition: 'septembre 2026',
    url: 'https://www.inrs.fr/media.html?refINRS=ED%20828',
    consulte: '14/11/2026',
  },

  // Fenêtres par défaut (modifiables dans les Réglages) et délais de levée proposés selon la gravité
  // (choix d'organisation, pas des délais réglementaires : modifiables à chaque observation).
  reglages: { alerteJours: 45, levee: { danger: 7, majeure: 30, mineure: 90 } },

  gravites: [
    { id: 'danger', nom: 'Danger', detail: 'Risque grave : mise hors service ou mesure immédiate' },
    { id: 'majeure', nom: 'Majeure', detail: 'Non-conformité à lever rapidement' },
    { id: 'mineure', nom: 'Mineure', detail: 'Amélioration, remarque' },
  ],

  resultats: [
    { id: 'conforme', nom: 'Sans observation' },
    { id: 'observations', nom: 'Avec observations' },
    { id: 'defavorable', nom: 'Défavorable' },
  ],

  typesSite: [
    { id: 'travail', nom: 'Lieu de travail', detail: 'Bureaux, atelier, entrepôt (Code du travail)' },
    { id: 'erp', nom: 'ERP du 1er groupe', detail: 'Établissement recevant du public, catégories 1 à 4' },
    { id: 'erp5', nom: 'ERP de 5e catégorie', detail: 'Petit établissement recevant du public' },
    { id: 'autre', nom: 'Autre', detail: 'Immeuble, site technique, chantier…' },
  ],

  familles: ['Électricité et éclairage', 'Incendie', 'Ascenseurs', 'Levage et manutention', 'Portes et portails', 'Gaz, chauffage et aération', 'Autres contrôles'],

  // Types de contrôles. mois ou jours : périodicité de la brochure. pour : types de site proposés par défaut.
  types: [
    { code: 'ELEC', nom: 'Installations électriques (vérification périodique)', famille: 'Électricité et éclairage', mois: 12, allegeeMois: 24, nature: 'reglementaire', champ: 'Lieux de travail', page: 56,
      textes: 'Code du travail, art. R. 4226-16, R. 4226-17, R. 4226-19 ; arrêté du 26 décembre 2011, art. 3 ; arrêté du 22 décembre 2011, art. 2 et 3',
      qui: 'Organisme accrédité par le Cofrac ou personne qualifiée de l\'entreprise dont la compétence est démontrée',
      resume: 'Vérification annuelle du maintien en état de conformité. L\'article 3 de l\'arrêté du 26 décembre 2011 permet de porter le délai à deux ans si le rapport précédent ne présente aucune observation, ou si les observations ont été levées avant l\'échéance ; le chef d\'établissement adresse alors les justificatifs à l\'inspecteur du travail.',
      pour: ['travail', 'erp', 'erp5', 'autre'] },
    { code: 'ELEC_ERP', nom: 'Installations électriques (ERP, vérification annuelle)', famille: 'Électricité et éclairage', mois: 12, nature: 'reglementaire', champ: 'ERP du 1er groupe', page: 67,
      textes: 'Arrêté du 25 juin 1980, art. GE 10 et EL 19',
      qui: 'Technicien compétent', resume: 'Vérification annuelle de l\'absence de modifications et de l\'état d\'entretien des installations électriques.', pour: ['erp'] },
    { code: 'ECL_SECU', nom: 'Éclairage de sécurité (fonctionnement)', famille: 'Électricité et éclairage', mois: 1, nature: 'reglementaire', champ: 'Lieux de travail', page: 55,
      textes: 'Code du travail, art. R. 4226-7 et R. 4226-13 ; arrêté du 14 décembre 2011, art. 11',
      qui: 'Personne qualifiée de l\'entreprise', resume: 'Vérification mensuelle du passage en fonctionnement et de l\'allumage des lampes ; l\'autonomie d\'au moins une heure se vérifie tous les six mois (type suivant).', pour: ['travail', 'erp', 'erp5'] },
    { code: 'ECL_AUTO', nom: 'Éclairage de sécurité (autonomie)', famille: 'Électricité et éclairage', mois: 6, nature: 'reglementaire', champ: 'Lieux de travail', page: 55,
      textes: 'Code du travail, art. R. 4226-7 et R. 4226-13 ; arrêté du 14 décembre 2011, art. 11',
      qui: 'Personne qualifiée de l\'entreprise', resume: 'Vérification semestrielle de l\'autonomie d\'au moins une heure (automatique possible avec des blocs à test intégré).', pour: ['travail', 'erp', 'erp5'] },
    { code: 'EXT', nom: 'Extincteurs (vérification annuelle)', famille: 'Incendie', mois: 12, nature: 'referentiel', champ: 'Tous les extincteurs', page: 75,
      textes: 'Règle APSAD R4, 4-2 ; norme NF S 61-919, point 5 (référentiels cités par l\'INRS, pas un texte de loi)',
      qui: 'Entreprise certifiée (APSAD, NF Service) ou personne disposant du CAP d\'agent vérificateur', resume: 'Vérification annuelle de l\'aptitude de chaque extincteur, avec une tolérance de plus ou moins 2 mois autour de la date anniversaire. Maintenance approfondie à 5 et 15 ans, révision en atelier à 10 ans.', pour: ['travail', 'erp5', 'autre'] },
    { code: 'EXT_ERP', nom: 'Extincteurs (ERP, vérification annuelle)', famille: 'Incendie', mois: 12, nature: 'reglementaire', champ: 'ERP du 1er groupe', page: 62,
      textes: 'Arrêté du 25 juin 1980, art. MS 73 et GE 8', qui: 'Technicien compétent', resume: 'Vérification annuelle des extincteurs mobiles.', pour: ['erp'] },
    { code: 'SECOURS', nom: 'Matériels d\'extinction et de secours (essai, contrôle visuel)', famille: 'Incendie', mois: 6, nature: 'reglementaire', champ: 'Lieux de travail', page: 75,
      textes: 'Code du travail, art. R. 4227-39', qui: 'Personne compétente', resume: 'Essai et contrôle visuel de l\'accessibilité, de la présence et de l\'état extérieur, au moins tous les six mois ; consigné au registre.', pour: ['travail'] },
    { code: 'RIA', nom: 'Robinets d\'incendie armés (surveillance)', famille: 'Incendie', mois: 3, nature: 'referentiel', champ: 'Installations de RIA', page: 77,
      textes: 'Règle APSAD R5, n° 3.1 et 4.1 (référentiel cité par l\'INRS, pas un texte de loi)', qui: 'Personne compétente spécialement formée ou entreprise certifiée', resume: 'Surveillance trimestrielle des vannes, de l\'accessibilité et de l\'absence de dégradation.', pour: [] },
    { code: 'SSI', nom: 'Système de sécurité incendie (vérification annuelle)', famille: 'Incendie', mois: 12, nature: 'reglementaire', champ: 'ERP du 1er groupe', page: 62,
      textes: 'Arrêté du 25 juin 1980, art. MS 73', qui: 'Technicien compétent', resume: 'Vérification annuelle de tous les systèmes de sécurité incendie ; pour les SSI de catégorie A et B, vérification tous les 3 ans par une personne ou un organisme agréé (type suivant).', pour: ['erp'] },
    { code: 'SSI_AB', nom: 'SSI de catégorie A ou B (vérification triennale)', famille: 'Incendie', mois: 36, nature: 'reglementaire', champ: 'ERP du 1er groupe', page: 64,
      textes: 'Arrêté du 25 juin 1980, art. MS 73', qui: 'Personne ou organisme agréé', resume: 'Vérification tous les 3 ans, rapport de vérifications réglementaires en exploitation (RVRE).', pour: [] },
    { code: 'DESENF', nom: 'Installations de désenfumage', famille: 'Incendie', mois: 12, nature: 'reglementaire', champ: 'ERP du 1er groupe', page: 64,
      textes: 'Arrêté du 25 juin 1980, art. MS 73, GE 8 et DF 10', qui: 'Technicien compétent', resume: 'Vérification annuelle, dont le fonctionnement des commandes manuelles.', pour: ['erp'] },
    { code: 'SPRINK', nom: 'Sprinklers (vérification technique annuelle)', famille: 'Incendie', mois: 12, nature: 'reglementaire', champ: 'ERP du 1er groupe', page: 60,
      textes: 'Arrêté du 25 juin 1980, art. MS 73 ; Code de la construction et de l\'habitation, art. R. 143-44', qui: 'Technicien compétent', resume: 'Vérification technique annuelle des installations fixes d\'extinction automatique à eau ; examen triennal de l\'adéquation par une personne ou un organisme agréé.', pour: [] },
    { code: 'ASC_ENT', nom: 'Ascenseur (visite d\'entretien)', famille: 'Ascenseurs', jours: 42, nature: 'reglementaire', champ: 'Propriétaires d\'ascenseurs', page: 29,
      textes: 'Code de la construction et de l\'habitation, art. L. 134-1, L. 134-3, R. 134-6, R. 134-7, R. 134-10 ; arrêté du 18 novembre 2004, art. 2',
      qui: 'Entreprise d\'entretien spécialisée ou personne formée en interne', resume: 'Visite d\'entretien toutes les 6 semaines au maximum (cabine, verrouillages, demande de secours…) ; freins et câbles au moins tous les 6 mois ; cuvette et machinerie au moins une fois par an. Carnet d\'entretien.', pour: [] },
    { code: 'ASC_CT', nom: 'Ascenseur (contrôle technique quinquennal)', famille: 'Ascenseurs', mois: 60, nature: 'reglementaire', champ: 'Propriétaires d\'ascenseurs', page: 30,
      textes: 'Code de la construction et de l\'habitation, art. L. 134-4, R. 134-11 à R. 134-13 ; arrêté du 7 août 2012 modifié', qui: 'Contrôleur technique agréé ou personne certifiée', resume: 'Contrôle technique de l\'installation tous les 5 ans ; rapport mentionnant les opérations réalisées et les défauts repérés.', pour: [] },
    { code: 'PORTES', nom: 'Portes et portails automatiques ou semi-automatiques', famille: 'Portes et portails', mois: 6, nature: 'reglementaire', champ: 'Lieux de travail', page: 102,
      textes: 'Code du travail, art. R. 4224-12, R. 4224-13, R. 4224-17 ; arrêté du 21 décembre 1993, art. 9', qui: 'Technicien qualifié de l\'entreprise ou prestataire spécialisé', resume: 'Vérification et entretien au moins tous les six mois (périodicité adaptée à la nature de la porte et à la fréquence d\'utilisation), et après toute défaillance. Livret d\'entretien.', pour: ['travail'] },
    { code: 'LEV_FIXE', nom: 'Appareils de levage installés à demeure (VGP)', famille: 'Levage et manutention', mois: 12, nature: 'reglementaire', champ: 'Équipements de travail', page: 42,
      textes: 'Code du travail, art. R. 4323-23 à R. 4323-27 ; arrêté du 1er mars 2004, art. 6, 9, 22 et 23', qui: 'Personne qualifiée, de l\'établissement ou non, dont le nom est tenu à la disposition de l\'inspection du travail', resume: 'Vérification générale périodique annuelle : examen de l\'état de conservation et essais de fonctionnement (ponts roulants, palans fixes, monte-charges d\'atelier…).', pour: [] },
    { code: 'LEV_MOB', nom: 'Chariots élévateurs, nacelles, hayons et grues mobiles (VGP)', famille: 'Levage et manutention', mois: 6, nature: 'reglementaire', champ: 'Équipements de travail', page: 43,
      textes: 'Code du travail, art. R. 4323-23 à R. 4323-27 ; arrêté du 1er mars 2004, art. 6, 9, 22 et 23', qui: 'Personne qualifiée, de l\'établissement ou non', resume: 'Vérification générale périodique tous les 6 mois pour les appareils listés à l\'article 23 : chariots élévateurs, plates-formes élévatrices mobiles de personnes, hayons élévateurs, grues auxiliaires, monte-meubles…', pour: [] },
    { code: 'LEV_ACC', nom: 'Accessoires de levage (élingues, palonniers…)', famille: 'Levage et manutention', mois: 12, nature: 'reglementaire', champ: 'Équipements de travail', page: 47,
      textes: 'Arrêté du 1er mars 2004, art. 24', qui: 'Personne qualifiée, de l\'établissement ou non', resume: 'Examen annuel de l\'état de conservation de tous les accessoires de levage.', pour: [] },
    { code: 'GAZ_ERP', nom: 'Installations de gaz (ERP)', famille: 'Gaz, chauffage et aération', mois: 12, nature: 'reglementaire', champ: 'ERP du 1er groupe', page: 66,
      textes: 'Arrêté du 25 juin 1980, art. GZ 30, GE 8 et GE 10', qui: 'Technicien compétent', resume: 'Vérification annuelle de l\'état d\'entretien, de la ventilation, de l\'évacuation des produits de combustion, des organes de coupure et de l\'étanchéité.', pour: ['erp'] },
    { code: 'CHAUF_ERP', nom: 'Production de chaleur et de froid (ERP)', famille: 'Gaz, chauffage et aération', mois: 12, nature: 'reglementaire', champ: 'ERP du 1er groupe', page: 65,
      textes: 'Arrêté du 25 juin 1980, art. CH 58, GE 8 et GE 10', qui: 'Technicien compétent', resume: 'Vérification annuelle des brûleurs et foyers, des dispositifs de protection et de l\'étanchéité des canalisations.', pour: ['erp'] },
    { code: 'CUIS_ERP', nom: 'Grandes cuisines (ERP)', famille: 'Gaz, chauffage et aération', mois: 12, nature: 'reglementaire', champ: 'ERP du 1er groupe', page: 70,
      textes: 'Arrêté du 25 juin 1980, art. GC 22', qui: 'Technicien qualifié', resume: 'Vérification annuelle de l\'état d\'entretien, de la ventilation et de l\'évacuation des grandes cuisines et appareils à poste fixe.', pour: [] },
    { code: 'AERATION', nom: 'Ventilation des locaux à pollution non spécifique', famille: 'Gaz, chauffage et aération', mois: 12, nature: 'reglementaire', champ: 'Lieux de travail', page: 11,
      textes: 'Code du travail, art. R. 4222-20 à R. 4222-22 ; arrêté du 8 octobre 1987, art. 3', qui: 'Personne compétente', resume: 'Examen et contrôles annuels : état de l\'installation, débit d\'air neuf, filtres, pressions ou vitesses aux points caractéristiques.', pour: ['travail'] },
    { code: 'AUTRE', nom: 'Autre contrôle (périodicité à saisir)', famille: 'Autres contrôles', nature: 'saisie', champ: '', page: null, textes: '', qui: '', resume: 'Contrôle absent de la base : tu saisis toi-même sa périodicité, d\'après le texte qui s\'applique à ton cas ou la préconisation de l\'organisme.', pour: [] },
  ],

  conseils: [
    ['Tes sites', 'Un site par adresse : le registre s\'imprime site par site.'],
    ['Tes équipements', 'Un équipement par installation contrôlée : TGBT, parc d\'extincteurs, porte de quai, chariot n° 2…'],
    ['La dernière vérification', 'Reprends la date du dernier rapport : l\'échéance se calcule toute seule.'],
    ['Les observations', 'Chaque observation du rapport se suit jusqu\'à sa levée, avec la preuve.'],
  ],
};
