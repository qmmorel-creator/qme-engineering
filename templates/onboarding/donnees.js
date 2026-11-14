// Base intégrée de l'onboarding et offboarding salarié : profils, checklists d'arrivée et de départ, repères.
// Contenu original rédigé pour QME. Chaque tâche : échéance relative (J = date d'arrivée ou dernier jour),
// responsable par fonction (jamais une personne nommée). Modèles de départ, modifiables dans l'application.
// Repères réglementaires relevés le 13/11/2026 sur service-public.gouv.fr et cnil.fr : à revérifier chaque
// année (mise à jour annuelle de ce fichier). L'outil ne remplace pas un conseil juridique ou RH.
(() => {
  // t(J relatif, responsable, titre, repère facultatif)
  const t = (j, resp, titre, r = '') => ({ j, resp, titre, r });

  window.BASE = {
    version: '2026-11-13',

    // Responsables par fonction. « manager » : le manager de la personne qui arrive ou qui part.
    responsables: [
      { id: 'rh', nom: 'RH', long: 'Ressources humaines' },
      { id: 'manager', nom: 'Manager', long: 'Manager de la personne' },
      { id: 'info', nom: 'Informatique', long: 'Informatique' },
      { id: 'sg', nom: 'Services généraux', long: 'Services généraux' },
      { id: 'salarie', nom: 'Salarié', long: 'La personne elle-même' },
    ],

    contrats: ['CDI', 'CDD', 'Apprentissage', 'Contrat de professionnalisation', 'Stage', 'Autre'],

    // Bornes des échéances proposées (en jours autour de J).
    bornes: { arrivee: [-15, 90], depart: [-30, 30] },

    etatsMateriel: [
      { id: 'neuf', nom: 'Neuf' },
      { id: 'bon', nom: 'Bon état' },
      { id: 'usage', nom: 'Usé' },
      { id: 'abime', nom: 'Abîmé' },
      { id: 'perdu', nom: 'Perdu' },
    ],
    materielCourant: ['Ordinateur portable', 'Chargeur et accessoires', 'Écran', 'Téléphone professionnel', 'Badge d\'accès', 'Clés', 'Équipements de protection individuelle', 'Véhicule de service', 'Carte carburant', 'Outillage', 'Casque audio', 'Tenue de travail'],

    // Profils : « commun » s'applique à tout le monde ; les autres s'ajoutent selon le poste.
    profils: [
      { id: 'commun', nom: 'Commun à tous', desc: 'Formalités, accueil, points d\'étape, documents de fin de contrat.', fixe: true,
        arrivee: [
          t(-15, 'rh', 'Vérifier que le contrat ou la promesse d\'embauche est signé et classé'),
          t(-15, 'manager', 'Préparer le programme des deux premières semaines'),
          t(-14, 'manager', 'Choisir un parrain ou une marraine dans l\'équipe'),
          t(-10, 'rh', 'Demander au salarié les pièces administratives prévues par l\'entreprise'),
          t(-10, 'sg', 'Préparer le badge d\'accès et les clés'),
          t(-7, 'rh', 'Faire la déclaration préalable à l\'embauche (DPAE), au plus tôt 8 jours avant l\'arrivée', 'dpae'),
          t(-5, 'manager', 'Annoncer l\'arrivée à l\'équipe'),
          t(-3, 'rh', 'Envoyer le message de bienvenue : horaires, adresse, personne qui accueille'),
          t(-2, 'rh', 'Préparer le livret d\'accueil et les documents à remettre'),
          t(0, 'manager', 'Accueillir la personne et présenter l\'équipe'),
          t(0, 'rh', 'Inscrire au registre unique du personnel', 'registre'),
          t(0, 'rh', 'Remettre le livret d\'accueil et le règlement intérieur s\'il existe'),
          t(0, 'sg', 'Remettre le badge et les clés (noter dans le matériel)'),
          t(0, 'salarie', 'Lire les documents remis et poser ses questions'),
          t(1, 'rh', 'Remettre la notice de la complémentaire santé de l\'entreprise'),
          t(2, 'rh', 'Présenter les consignes de sécurité et d\'évacuation du site'),
          t(5, 'manager', 'Faire le point de fin de première semaine'),
          t(10, 'rh', 'Demander la visite d\'information et de prévention au service de santé au travail', 'vip'),
          t(30, 'manager', 'Point d\'étape à un mois : objectifs, besoins, premières impressions'),
          t(30, 'salarie', 'Donner son avis sur l\'accueil'),
          t(45, 'rh', 'Noter la fin de la période d\'essai prévue au contrat et préparer le point avec le manager'),
          t(60, 'manager', 'Point d\'étape à deux mois'),
          t(85, 'rh', 'Vérifier que la visite d\'information et de prévention a eu lieu', 'vip'),
          t(90, 'manager', 'Bilan d\'intégration à trois mois'),
        ],
        depart: [
          t(-30, 'rh', 'Confirmer la date du dernier jour dans le dossier'),
          t(-30, 'manager', 'Annoncer le départ à l\'équipe'),
          t(-25, 'manager', 'Organiser la reprise des dossiers : qui reprend quoi'),
          t(-20, 'salarie', 'Rédiger la note de passation'),
          t(-15, 'rh', 'Faire le point sur les congés restants'),
          t(-10, 'manager', 'Planifier l\'entretien de départ'),
          t(-7, 'sg', 'Lister avec la personne le matériel à restituer'),
          t(-5, 'manager', 'Faire l\'entretien de départ'),
          t(-2, 'salarie', 'Transmettre les fichiers et contacts utiles à la personne qui reprend'),
          t(0, 'sg', 'Récupérer le badge et les clés (cocher dans le matériel)'),
          t(0, 'rh', 'Tenir prêts le certificat de travail, le solde de tout compte et l\'attestation France Travail', 'fin'),
          t(0, 'rh', 'Préparer l\'état récapitulatif de l\'épargne salariale si l\'entreprise a un PEE, un PEI ou un Perco', 'fin'),
          t(0, 'manager', 'Dire au revoir avec l\'équipe'),
          t(1, 'info', 'Désactiver les accès et badges restants'),
          t(5, 'rh', 'Vérifier que tout le matériel est rendu, relancer sinon'),
          t(15, 'rh', 'Clôturer le parcours (les archives RH obligatoires sont tenues ailleurs)'),
          t(30, 'rh', 'Effacer la fiche de cet outil une fois le parcours terminé', 'rgpd'),
        ] },
      { id: 'bureau', nom: 'Poste de bureau', desc: 'Ordinateur, comptes, accès aux logiciels et dossiers.',
        arrivee: [
          t(-15, 'info', 'Commander ou réserver l\'ordinateur et les accessoires'),
          t(-10, 'sg', 'Préparer le bureau : place, mobilier, fournitures'),
          t(-5, 'info', 'Créer le compte et l\'adresse de messagerie'),
          t(-5, 'info', 'Ouvrir les accès aux logiciels et dossiers partagés du poste'),
          t(-3, 'info', 'Préparer l\'ordinateur : installation, mises à jour'),
          t(0, 'info', 'Remettre l\'ordinateur et expliquer la connexion (noter dans le matériel)'),
          t(1, 'info', 'Présenter les règles de sécurité informatique : mots de passe, sauvegardes, hameçonnage'),
          t(3, 'salarie', 'Vérifier ses accès et signaler ce qui manque'),
        ],
        depart: [
          t(-10, 'info', 'Prévoir la réponse automatique et le transfert de la messagerie'),
          t(-3, 'info', 'Sauvegarder les fichiers professionnels à garder'),
          t(0, 'info', 'Récupérer l\'ordinateur et les accessoires'),
          t(1, 'info', 'Réinitialiser l\'ordinateur avant de le réattribuer'),
          t(7, 'info', 'Supprimer ou archiver le compte selon la règle de l\'entreprise'),
        ] },
      { id: 'terrain', nom: 'Poste terrain', desc: 'Équipements de protection, véhicule, sécurité sur site, binôme.',
        arrivee: [
          t(-15, 'sg', 'Commander les équipements de protection individuelle à la bonne taille'),
          t(-10, 'sg', 'Réserver le véhicule de service ou préciser le mode de déplacement'),
          t(-7, 'manager', 'Vérifier les habilitations et autorisations nécessaires au poste'),
          t(-5, 'info', 'Préparer le téléphone professionnel et l\'application de terrain'),
          t(0, 'sg', 'Remettre les équipements de protection et le vestiaire (noter dans le matériel)'),
          t(0, 'manager', 'Présenter les risques du poste et les consignes de sécurité sur site'),
          t(1, 'manager', 'Première intervention en binôme avec un collègue expérimenté'),
          t(15, 'manager', 'Vérifier l\'autonomie sur les interventions courantes'),
          t(20, 'rh', 'Planifier les formations nécessaires au poste'),
        ],
        depart: [
          t(-10, 'sg', 'Planifier la restitution du véhicule de service'),
          t(-3, 'manager', 'Faire l\'état du matériel de terrain et de l\'outillage'),
          t(0, 'sg', 'Récupérer le téléphone, le véhicule et les équipements réutilisables'),
          t(1, 'info', 'Désactiver le téléphone et l\'application de terrain'),
          t(5, 'manager', 'Réaffecter les interventions en cours'),
        ] },
      { id: 'manager', nom: 'Manager', desc: 'Équipe, droits de validation, processus RH du manager.',
        arrivee: [
          t(-15, 'rh', 'Préparer la liste de l\'équipe et l\'organigramme'),
          t(-10, 'info', 'Ouvrir les droits de validation : congés, notes de frais, achats'),
          t(3, 'manager', 'Présenter les objectifs et le budget de l\'équipe'),
          t(5, 'rh', 'Présenter les processus RH du manager : recrutement, entretiens, absences'),
          t(10, 'salarie', 'Rencontrer chaque membre de l\'équipe en tête-à-tête'),
          t(30, 'manager', 'Faire le point sur les premiers constats et les priorités'),
        ],
        depart: [
          t(-30, 'rh', 'Désigner la personne qui reprend l\'équipe, même temporairement'),
          t(-20, 'manager', 'Transférer les droits de validation'),
          t(-10, 'salarie', 'Faire le point avec chaque membre de l\'équipe'),
          t(1, 'info', 'Retirer les droits de validation restants'),
        ] },
      { id: 'alternant', nom: 'Alternant ou stagiaire', desc: 'Tuteur, calendrier école, suivi pédagogique.',
        arrivee: [
          t(-15, 'rh', 'Vérifier que la convention de stage ou le contrat d\'alternance est signé'),
          t(-10, 'rh', 'Noter le calendrier de l\'alternance ou du stage'),
          t(-7, 'manager', 'Désigner le tuteur ou le maître d\'apprentissage'),
          t(0, 'manager', 'Présenter les missions et les objectifs pédagogiques'),
          t(15, 'manager', 'Point avec le tuteur sur la progression'),
          t(30, 'rh', 'Premier point de suivi avec l\'école'),
          t(60, 'manager', 'Préparer l\'évaluation demandée par l\'école'),
        ],
        depart: [
          t(-30, 'rh', 'Vérifier la date de fin du contrat ou de la convention'),
          t(-15, 'manager', 'Remplir l\'évaluation finale demandée par l\'école'),
          t(-5, 'rh', 'Préparer l\'attestation de fin de stage, s\'il s\'agit d\'un stage'),
          t(10, 'rh', 'Informer l\'école de la fin du parcours'),
        ] },
    ],

    // Repères réglementaires (droit du travail français). Textes volontairement généraux ; la source fait foi.
    reperes: {
      dpae: { titre: 'Déclaration préalable à l\'embauche', texte: 'À transmettre à l\'Urssaf (ou à la MSA) avant la prise de poste, au plus tôt dans les 8 jours qui précèdent l\'embauche.', source: 'service-public.gouv.fr, fiche « Déclaration préalable à l\'embauche » (F23107), vérifiée par le site le 01/06/2026, relevée le 13/11/2026.' },
      vip: { titre: 'Visite d\'information et de prévention', texte: 'Dans les 3 mois suivant la prise effective du poste ; avant l\'affectation pour un travailleur de nuit ou une personne de moins de 18 ans ; remplacée par un examen d\'aptitude avant l\'affectation pour les postes à suivi renforcé.', source: 'service-public.gouv.fr, fiche F34061, et Code du travail numérique, relevés le 13/11/2026. Article R4624-10 du Code du travail : à vérifier sur Légifrance.' },
      fin: { titre: 'Documents de fin de contrat', texte: 'Certificat de travail, solde de tout compte, attestation France Travail, et état récapitulatif de l\'épargne salariale si l\'entreprise propose un PEE, un PEI ou un Perco. Tenus à disposition dès la fin du contrat (fin du préavis, même non effectué).', source: 'service-public.gouv.fr, fiche « Fin de contrat : documents à remettre au salarié » (F21789), vérifiée par le site le 24/02/2026, relevée le 13/11/2026.' },
      registre: { titre: 'Registre unique du personnel', texte: 'Chaque salarié y est inscrit lors de son embauche ; la CNIL indique une conservation de 5 ans après la sortie des effectifs. À vérifier : article L1221-13 du Code du travail.', source: 'Référentiel CNIL « Gestion des ressources humaines » (2026), relevé le 13/11/2026 : à vérifier.' },
      rgpd: { titre: 'Données des salariés', texte: 'Ne garder que le nécessaire, le temps nécessaire. Cet outil suit un parcours d\'arrivée ou de départ : prénom et initiale, poste, dates. Les archives RH obligatoires se tiennent dans les outils de paie et le dossier du personnel, pas ici.', source: 'Référentiel CNIL « Gestion des ressources humaines » (2026), repère général relevé le 13/11/2026 : à vérifier.' },
    },
    sourceReperes: 'Repères relevés le 13/11/2026 sur service-public.gouv.fr et cnil.fr : à vérifier, les règles changent. Ta convention collective, ton contrat et les textes font foi.',

    conseils: [
      ['Une personne, un parcours', 'Une arrivée ou un départ, avec sa date : toutes les échéances se calculent depuis ce jour J.'],
      ['Des fonctions, pas des noms', 'Chaque tâche revient à une fonction : RH, manager, informatique, services généraux ou la personne elle-même.'],
      ['Le minimum de données', 'Prénom et initiale du nom, poste, contrat, dates. Aucune donnée de santé, de salaire ou d\'adresse.'],
      ['Le matériel en deux temps', 'Noté à la remise, coché à la restitution : ce qui n\'est pas rendu au dernier jour passe en alerte.'],
    ],
  };
})();
