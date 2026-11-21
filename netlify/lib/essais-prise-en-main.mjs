// E-mail « prise en main » de l'essai gratuit (J+2), personnalisé par template (demande de Quentin, 20/11/2026).
//
// Pour chaque template ouvert à l'essai (PRODUITS_ESSAI) :
//  - commencer : le premier pas utile, faisable en quelques minutes ;
//  - astuces : deux fonctions qu'on ne remarque pas au premier coup d'œil ;
//  - aide : ce que Quentin propose de régler avec la personne, si elle répond.
// Source : la page catalogue du template (« Ce que vous obtenez »). Ne rien promettre qui n'y figure pas, et ne pas
// citer de libellé de bouton non vérifié dans l'application.
// Un template ouvert à l'essai sans fiche ici fait échouer `npm test` (outils/templates/essai.test.mjs).
export const PRISE_EN_MAIN = {
  REV: {
    commencer: 'collez votre programme en une fois (ou partez d\'une des 12 formations préremplies) et indiquez la date de l\'examen : la liste du jour se remplit, retards compris.',
    astuces: [
      'le plan de rattrapage répartit vos retards en un geste, et place des examens blancs à J-10 et J-4 ;',
      'la session guidée lance un minuteur Pomodoro et compare votre feuille blanche aux mots-clés du chapitre.',
    ],
    aide: 'Votre programme ne rentre pas bien dans le planning ?',
  },
  BCM: {
    commencer: 'ajoutez les personnes du foyer, choisissez la répartition (à parts égales, au prorata des revenus, en parts) et notez les trois dernières dépenses : le solde « qui doit combien à qui » s\'affiche.',
    astuces: [
      'le loyer, l\'énergie et les abonnements peuvent être déclarés comme dépenses récurrentes : ils s\'ajoutent seuls chaque mois ;',
      'avec un compte joint, l\'application calcule plutôt ce que chacun doit y verser chaque mois.',
    ],
    aide: 'Votre façon de partager les frais ne rentre dans aucune case ?',
  },
  NTR: {
    commencer: 'renseignez votre profil et votre objectif (perte, maintien ou prise), puis notez un seul repas d\'aujourd\'hui : la dépense du jour et le facteur calorique se calculent.',
    astuces: [
      'la copie de la veille et les repas enregistrés évitent de tout ressaisir les jours qui se ressemblent ;',
      'vos séances de sport s\'ajoutent à la dépense du jour, chacune avec son MET.',
    ],
    aide: 'Un aliment introuvable ou un chiffre qui vous paraît faux ?',
  },
  BDG: {
    commencer: 'choisissez le modèle de foyer le plus proche du vôtre, saisissez vos revenus du mois et répartissez-les en enveloppes : le diagramme des flux se dessine aussitôt.',
    astuces: [
      'le loyer, les abonnements et le salaire s\'enregistrent comme opérations fixes, ajoutées en un geste chaque mois ;',
      'le reste d\'une enveloppe peut être reporté sur le mois suivant (vacances, cadeaux, impôts).',
    ],
    aide: 'Vos catégories ne correspondent pas à votre façon de dépenser ?',
  },
  MRG: {
    commencer: 'saisissez la date du mariage : les 40 tâches du rétroplanning se calent sur cette date, et la prochaine échéance apparaît.',
    astuces: [
      'si la date change, tout le rétroplanning se recale seul ;',
      'les régimes et allergies notés pour chaque invité se retrouvent dans la liste à transmettre au traiteur.',
    ],
    aide: 'Votre organisation ne colle pas au rétroplanning type ?',
  },
  PHR: {
    commencer: 'partez de la semaine type la plus proche de vous (cadre, freelance ou étudiant) et déplacez deux ou trois blocs pour l\'adapter à votre vraie semaine.',
    astuces: [
      'un bloc récurrent n\'est saisi qu\'une fois, et se modifie pour une seule semaine ou pour toutes ;',
      'marquer chaque bloc (fait, raccourci, déplacé, pas fait) alimente le bilan du vendredi, catégorie par catégorie.',
    ],
    aide: 'Vos catégories ou vos horaires ne rentrent pas dans la grille ?',
  },
  TRV: {
    commencer: 'choisissez le modèle le plus proche de votre chantier (cuisine, salle de bains, rénovation complète) et saisissez le premier devis reçu.',
    astuces: [
      'pour chaque poste, les devis se comparent côte à côte (HT, TTC, ce qui est inclus ou non) ; le moins cher et les écarts sont calculés ;',
      'le planning signale les interventions qui se chevauchent dans une même pièce, et les ordres inhabituels.',
    ],
    aide: 'Un devis qui ne rentre pas dans un poste ?',
  },
  HBT: {
    commencer: 'choisissez une routine prête (matin, soir, bouger plus…) ou trois habitudes parmi les 50 proposées, puis cochez celles d\'aujourd\'hui.',
    astuces: [
      'les habitudes chiffrées ont un minimum, un maximum et un pas : « au moins 8 verres d\'eau », « au plus 3 cafés » ;',
      'un jour « non applicable » (malade, en congés) ne casse pas vos séries.',
    ],
    aide: 'Une habitude que vous n\'arrivez pas à paramétrer ?',
  },
  DTT: {
    commencer: 'listez vos dettes (solde, taux, mensualité) et le budget que vous pouvez y consacrer chaque mois : la date de fin et les intérêts payés s\'affichent.',
    astuces: [
      'les méthodes boule de neige et avalanche se comparent côte à côte, ou avec votre propre ordre ;',
      'un versement exceptionnel (une prime, une vente) montre combien de mois et d\'intérêts il vous fait gagner.',
    ],
    aide: 'Un crédit dont les conditions ne rentrent pas dans le modèle ?',
  },
  ABN: {
    commencer: 'cochez dans la base les abonnements que vous payez et saisissez votre prix : le vrai total par mois et par an apparaît.',
    astuces: [
      'les fins d\'essai gratuit et d\'engagement passent dans « À décider avant le … » ;',
      'marquer un abonnement « à résilier » calcule l\'économie annuelle ; pour un abonnement partagé, seule votre part compte.',
    ],
    aide: 'Un abonnement à la périodicité ou au prix particulier ?',
  },
  PTM: {
    commencer: 'commencez par une seule pièce : un toucher sur l\'objet, un prix, une date approximative. Dix objets suffisent pour voir les trois valeurs (achat, actuelle, revente).',
    astuces: [
      'le simulateur de revente donne le montant net d\'une vente (une catégorie, les objets inutilisés…), décote, commission et expédition déduites ;',
      'l\'inventaire montre ce qui dort sans servir : objets de valeur utilisés quelques fois par an ou jamais.',
    ],
    aide: 'Une estimation qui vous paraît loin de la réalité ?',
  },
  TDV: {
    commencer: 'saisissez votre revenu et votre temps de travail, puis passez votre dernier achat dans le calculateur : vous le voyez en heures et en jours de travail.',
    astuces: [
      'une dépense récurrente se lit aussi sur un an, cinq ans et dix ans ;',
      'les scénarios A, B, C chiffrent un changement (voiture, loyer, restaurants) en heures de travail récupérées.',
    ],
    aide: 'Votre revenu ou vos horaires sont difficiles à saisir (indépendant, temps partiel, variable) ?',
  },
  VTR: {
    commencer: 'reportez la première offre reçue (comptant, crédit, LOA ou LLD) et vos kilomètres par an : le coût total net sur la période s\'affiche.',
    astuces: [
      'le simulateur donne le kilométrage à partir duquel une offre devient moins chère qu\'une autre ;',
      'une liste de questions à poser au vendeur, par type d\'offre, est prête à cocher et à copier.',
    ],
    aide: 'Une offre dont une ligne ne rentre pas dans le simulateur ?',
  },
  RDV: {
    commencer: 'notez votre roue de vie : trois questions par domaine, environ 10 minutes. Le domaine le plus bas vous dira où fixer votre premier objectif.',
    astuces: [
      '33 objectifs modèles, au format OKR, sont prêts à adapter ;',
      'la revue trimestrielle est guidée, en 20 à 30 minutes, et ce qui est resté ouvert remonte tout seul.',
    ],
    aide: 'Vos domaines de vie ne correspondent pas aux 12 proposés ?',
  },
  EPG: {
    commencer: 'choisissez un objectif type (fonds d\'urgence, apport, voyage…), indiquez son montant et ce que vous avez déjà : la date d\'atteinte au rythme actuel s\'affiche.',
    astuces: [
      'pour une date visée, l\'outil donne le versement mensuel nécessaire ;',
      'le fonds d\'urgence se calcule en mois de vos dépenses essentielles, poste par poste.',
    ],
    aide: 'Plusieurs objectifs à mener en même temps ?',
  },
  RPS: {
    commencer: 'planifiez seulement les trois prochains dîners, avec le nombre de personnes : la liste de courses se calcule, rangée par rayon.',
    astuces: [
      'ce que vous avez déjà au placard ou au frigo sort de la liste ;',
      'une semaine réussie s\'enregistre comme semaine type, à réappliquer en un geste.',
    ],
    aide: 'Il vous manque des recettes de famille, ou vos rayons sont dans un autre ordre ?',
  },
  VYG: {
    commencer: 'créez les étapes du voyage avec leurs nuits : les nuits sans hébergement sont signalées, et la liste de ce qui reste à réserver se remplit.',
    astuces: [
      'chaque dépense indique qui a payé et pour qui ; au retour, le nombre minimal de remboursements est calculé au centime ;',
      'une fois chargé, le programme se consulte sur téléphone même sans réseau.',
    ],
    aide: 'Un itinéraire ou un partage des frais compliqué ?',
  },
  SNH: {
    commencer: 'répondez aux six questions de la déclaration guidée : le délai pour déclarer à votre assureur est calculé en jours ouvrés, avec sa source officielle.',
    astuces: [
      'chaque photo, facture ou devis se rattache à un bien ou à une étape du dossier ;',
      'le rapport imprimable rassemble résumé, chronologie, inventaire chiffré et justificatifs, prêt à envoyer à l\'assureur.',
    ],
    aide: 'Un cas particulier (copropriété, locataire, plusieurs assureurs) ?',
  },
  MSC: {
    commencer: 'notez votre prochaine séance, ou la dernière : exercice, séries, charges, répétitions. La fois suivante, la séance précédente s\'affiche sous chaque exercice.',
    astuces: [
      'les records (charge, répétitions, temps) sont détectés tout seuls, avec un 1RM estimé ;',
      'le minuteur AMRAP, EMOM, For Time et intervalles fonctionne sans réseau et reporte le score dans la séance.',
    ],
    aide: 'Un exercice ou un format de WOD qui manque ?',
  },
  CAR: {
    commencer: 'saisissez la voiture, son kilométrage et la date du dernier entretien et du dernier contrôle technique : les prochaines échéances se calculent.',
    astuces: [
      'la consommation réelle se calcule d\'un plein à l\'autre (ou d\'une recharge à l\'autre) ;',
      'l\'historique d\'entretien s\'imprime, utile au moment de la revente.',
    ],
    aide: 'Votre carnet constructeur diffère du plan indicatif ?',
  },
  PGS: {
    commencer: 'ajoutez le livre que vous lisez et la page où vous en êtes : à la prochaine lecture, notez la nouvelle page, et la date de fin estimée apparaît.',
    astuces: [
      'les livres déjà lus cette année se marquent « lu » avec leur date de fin, sans détailler les sessions : ils comptent dans votre objectif ;',
      'les livres audio se suivent en minutes écoutées.',
    ],
    aide: 'Un format ou une habitude de lecture que l\'outil gère mal ?',
  },
  NTS: {
    commencer: 'saisissez la maquette du semestre en cours (matières et coefficients ou crédits ECTS), puis vos notes déjà connues : les moyennes se calculent au centième.',
    astuces: [
      'l\'outil donne la note qu\'il vous faut au prochain partiel pour atteindre votre objectif de moyenne ;',
      'les règles de votre diplôme (compensation, note éliminatoire, rattrapage) se saisissent une fois.',
    ],
    aide: 'Les règles de votre diplôme sont difficiles à traduire dans l\'outil ?',
  },
  ETD: {
    commencer: 'créez le dossier du bail (vide ou meublé) et faites une pièce : chaque élément se note en un toucher, avec un commentaire et une photo si besoin.',
    astuces: [
      'à la sortie, l\'outil compare à l\'entrée et distingue les dégradations de l\'usure normale ;',
      'le document s\'imprime avec une colonne entrée et une colonne sortie, à signer à la main.',
    ],
    aide: 'Un logement dont les pièces ne correspondent pas aux pièces types ?',
  },
  DCS: {
    commencer: 'notez où sont rangés les cinq papiers que vous cherchez le plus souvent : la recherche « Où est… ? » vous répondra la prochaine fois.',
    astuces: [
      'pour chaque document, la durée de conservation est reprise de service-public.gouv.fr, et la liste « peut être jeté » se remplit seule ;',
      'la date d\'expiration d\'une carte d\'identité ou d\'un passeport déclenche un rappel des mois avant.',
    ],
    aide: 'Un type de document absent de la liste ?',
  },
  CPT: {
    commencer: 'saisissez vos revenus, vos crédits en cours et votre apport : votre capacité d\'emprunt et le prix maximal à votre portée s\'affichent.',
    astuces: [
      'les offres de prêt se comparent côte à côte, de 2 à 5, assurance et frais compris ;',
      'un remboursement anticipé montre les intérêts économisés et les indemnités.',
    ],
    aide: 'Une offre de prêt difficile à lire ou à saisir ?',
  },
  CAN: {
    commencer: 'créez la candidature la plus proche de sa date limite et choisissez sa liste de pièces de départ : ce qui reste à préparer apparaît.',
    astuces: [
      'une relance est proposée après le délai choisi, avec un message prêt à copier ;',
      'les dates limites et entretiens s\'exportent vers l\'agenda de votre téléphone.',
    ],
    aide: 'Une procédure de candidature particulière ?',
  },
  MMR: {
    commencer: 'saisissez votre date de rendu et le nombre de mots visé, puis partez du plan type : le nombre de mots à écrire par jour s\'affiche.',
    astuces: [
      'votre rythme réel des deux dernières semaines donne la date où vous finirez à ce train-là ;',
      'après chaque rendez-vous avec votre directeur, un ordre du jour pour le suivant est prêt à envoyer.',
    ],
    aide: 'Votre école impose un découpage ou des jalons différents ?',
  },
  RNT: {
    commencer: 'saisissez le bien que vous étudiez (prix, loyer, charges, crédit) : rendement net et cash-flow mensuel s\'affichent.',
    astuces: [
      'l\'outil donne le prix à ne pas dépasser pour atteindre le rendement que vous visez ;',
      'la sensibilité montre l\'effet d\'un loyer à −10 %, d\'un mois de vacance de plus ou d\'un taux à +1 point.',
    ],
    aide: 'Un montage particulier (colocation, saisonnier, travaux lourds) ?',
  },
  SVT: {
    commencer: 'saisissez ce que votre voiture vous coûte aujourd\'hui (même approximativement) : le coût complet par an apparaît, perte de valeur comprise.',
    astuces: [
      'le gain ne commence qu\'à la sortie : vente, fin de LOA ou de LLD sont chiffrées selon votre contrat ;',
      'pour 14 situations (urgence de nuit, enfant malade, grève…), un plan B est proposé.',
    ],
    aide: 'Une situation où la voiture vous semble indispensable ?',
  },
};
