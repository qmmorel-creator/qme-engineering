// E-mail « prise en main » de l'essai gratuit (J+2), personnalisé par template (demande de Quentin, 20/11/2026) ;
// templates professionnels ajoutés le 21/11/2026. Aussi repris dans l'e-mail d'achat direct (achats.mjs).
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
    commencer: 'choisissez votre modèle (études et stages, emploi, ou appels d\'offres et plateformes), puis créez la candidature la plus proche de sa date limite : ce qui reste à préparer apparaît.',
    astuces: [
      'une relance est proposée après le délai choisi, avec un message prêt à copier, et les dates s\'exportent vers l\'agenda de votre téléphone ;',
      'pour un appel d\'offres, la grille go/no-go recommande de répondre ou non, puis chaque pièce reçoit une échéance à rebours depuis la date limite.',
    ],
    aide: 'Une procédure de candidature ou un type de consultation particulier ?',
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
  // ---------- Templates professionnels (essai étendu le 21/11/2026) ----------
  TVA: {
    commencer: 'choisissez votre régime (réel normal mensuel ou trimestriel, ou réel simplifié), puis saisissez une vente et un achat du mois en HT ou en TTC : la TVA nette à payer ou le crédit de la période s\'affiche.',
    astuces: [
      'quand la TVA de votre facture diffère de HT × taux, l\'écart est signalé dès la saisie ;',
      'avant de déclarer, les contrôles repèrent une opération hors période, un crédit oublié ou une période non payée.',
    ],
    aide: 'Un taux ou une échéance de déclaration à adapter à votre situation ?',
  },
  DRP: {
    commencer: 'choisissez votre activité et cochez vos unités de travail : les risques à examiner arrivent listés, et la cotation de l\'un d\'eux en gravité × probabilité donne sa priorité.',
    astuces: [
      'chaque risque se cote deux fois, sans puis avec les mesures déjà en place : le risque résiduel apparaît à côté du risque initial ;',
      'quand une action du plan est faite, l\'outil propose de recoter le risque concerné.',
    ],
    aide: 'Une unité de travail ou un risque propre à votre métier qui entre mal dans la grille ?',
  },
  ENP: {
    commencer: 'ajoutez un salarié avec sa date d\'embauche et la date de son dernier entretien professionnel : ses prochaines échéances, jusqu\'à l\'état des lieux des 8 ans, se calculent.',
    astuces: [
      'un questionnaire de préparation se copie pour être envoyé au salarié avant l\'entretien ;',
      'un objectif trop flou est signalé, et chaque objectif revient à l\'entretien suivant pour son bilan.',
    ],
    aide: 'Une périodicité prévue par votre convention collective ou un accord d\'entreprise ?',
  },
  STR: {
    commencer: 'créez une opération et un lot, placez un sous-traitant sous son titulaire et saisissez la date de son attestation Urssaf : l\'échéance à 6 mois et l\'alerte qui la précède s\'affichent.',
    astuces: [
      'une attestation reçue vaut pour toutes les opérations de l\'entreprise : inutile de la saisir chantier par chantier ;',
      'la relance se prépare depuis votre modèle, liste les pièces manquantes de l\'entreprise et s\'ouvre dans votre messagerie.',
    ],
    aide: 'Un seuil, une pièce ou un délai propre à vos marchés ?',
  },
  KRF: {
    commencer: 'créez la fiche d\'une réalisation récente avec son contexte, sa mission et un résultat chiffré : la note de complétude vous dit ce qui lui manque pour convaincre.',
    astuces: [
      'sans accord noté, le client est décrit par sa taille, son secteur et sa région, et un témoignage sans accord de citation n\'est pas imprimé ;',
      'la sélection préparée pour un prospect existe aussi en texte, à coller dans un e-mail.',
    ],
    aide: 'Un type de réalisation ou de résultat difficile à présenter dans une fiche ?',
  },
  TMP: {
    commencer: 'créez une mission au forfait avec son montant et son budget en jours, puis notez une ligne « 1h30 » : la consommation du budget et votre taux horaire effectif s\'affichent.',
    astuces: [
      'le chronomètre lancé sur l\'ordinateur s\'arrête sur le téléphone, et continue même si vous fermez la page ;',
      'le temps non facturable (prospection, devis, administratif) se suit à part, avec votre semaine réelle face à votre semaine type.',
    ],
    aide: 'Un mode de facturation de vos missions que l\'outil gère mal ?',
  },
  RDE: {
    commencer: 'créez l\'opération et ajoutez un lot avec son entreprise : les pièces attendues du DOE arrivent listées, et la complétude du lot s\'affiche.',
    astuces: [
      'une pièce à reprendre garde son motif, et sa date limite peut lui être propre plutôt que celle de l\'opération ;',
      'le bordereau de transmission des pièces validées s\'imprime lot par lot, avec l\'état des pièces manquantes par entreprise.',
    ],
    aide: 'Une liste de pièces imposée par votre CCTP qui diffère de la base proposée ?',
  },
  SDR: {
    commencer: 'créez vos salles avec leur capacité et vos horaires d\'ouverture, puis réservez un créneau d\'une heure : la salle passe occupée jusqu\'à l\'heure dite, avec la prochaine réservation.',
    astuces: [
      'une réservation répétée chaque semaine affiche la liste des dates en conflit avant que vous la validiez ;',
      'le taux d\'occupation heure par heure, sur 1, 4 ou 12 semaines, montre quelle salle manque et laquelle dort.',
    ],
    aide: 'Un équipement prêté ou un bureau en flex qui se réserve autrement qu\'une salle ?',
  },
  CMP: {
    commencer: 'choisissez un format de départ, collez votre liste d\'inscrits depuis votre tableur et saisissez un premier score : le classement de la catégorie se calcule.',
    astuces: [
      'les vagues s\'équilibrent selon le nombre de couloirs, les mieux classés en dernier, avec une alerte quand le repos est trop court ;',
      'un lien en lecture seule affiche le classement sur le téléphone des spectateurs, sans aucune coordonnée publiée.',
    ],
    aide: 'Un format d\'épreuve ou une règle de départage propre à votre compétition ?',
  },
  EQP: {
    commencer: 'ajoutez une personne avec ses heures hebdomadaires, puis affectez-la à un projet sur quelques semaines : son taux de charge s\'affiche semaine par semaine.',
    astuces: [
      'une personne affectée pendant ses congés, ou sans la compétence demandée par le projet, est signalée ;',
      'vous voyez d\'un coup d\'œil qui est disponible la semaine prochaine, et avec quelle compétence.',
    ],
    aide: 'Un rythme de travail particulier, comme des horaires décalés ou des jours variables ?',
  },
  VRF: {
    commencer: 'créez un site, choisissez un contrôle (installations électriques, extincteurs…) et saisissez la date du dernier rapport : la prochaine échéance s\'affiche, avec la source de sa périodicité.',
    astuces: [
      'chaque observation se suit jusqu\'à sa levée, avec sa preuve (référence de facture, bon d\'intervention ou lien) ;',
      'le délai de deux ans des installations électriques n\'est proposé que lorsque le dernier rapport le permet.',
    ],
    aide: 'Un contrôle absent de la liste, ou une périodicité préconisée par votre organisme ?',
  },
  CHT: {
    commencer: 'saisissez le marché d\'un lot, puis le cumul de travaux de sa première situation : les travaux du mois, la retenue de garantie et le net à payer se calculent.',
    astuces: [
      'les jalons se recalent sur les délais des avenants et les intempéries retenues du journal de chantier ;',
      'la revue de projet se prépare toute seule, à imprimer ou à copier.',
    ],
    aide: 'Une formule de révision ou une règle de pénalités particulière dans votre CCAP ?',
  },
  TDB: {
    commencer: 'choisissez votre activité, gardez les indicateurs proposés et saisissez les chiffres du dernier mois : taux de marge, point mort et écarts aux objectifs se calculent.',
    astuces: [
      'un objectif annuel se répartit sur 12 mois selon la saisonnalité de l\'an dernier ;',
      'vous pouvez créer vos propres indicateurs, saisis ou calculés à partir de deux autres.',
    ],
    aide: 'Un indicateur propre à votre métier qui manque à la bibliothèque ?',
  },
  GMA: {
    commencer: 'choisissez un site ou plusieurs, ajoutez une machine à partir de sa famille d\'équipement et relevez son compteur : les opérations du plan type et leurs échéances s\'affichent.',
    astuces: [
      'le rythme d\'utilisation relevé transforme une échéance au compteur en date estimée, et la clôture d\'un bon recale l\'échéance suivante et le coût de l\'équipement ;',
      'avec plusieurs sites, la vue d\'ensemble signale un équipement à l\'arrêt ou un site sans visite, et compare disponibilité et coût par site, en liste ou sur une carte schématique.',
    ],
    aide: 'Une machine dont la notice impose un entretien que le plan type ne prévoit pas, ou un parc qui se range mal par site ?',
  },
  GNT: {
    commencer: 'tapez quelques tâches en une ligne chacune, avec une date, une durée et la tâche qui précède (« après 1 ») : les barres, les liens et le chemin critique apparaissent.',
    astuces: [
      'plusieurs lignes se collent d\'un coup, et une ligne « _Lot_2 » ouvre une section ;',
      'les jours fériés sont recalculés chaque année, avec en option ceux d\'Alsace-Moselle.',
    ],
    aide: 'Un enchaînement de tâches difficile à exprimer avec les liens proposés ?',
  },
  TCH: {
    commencer: 'tapez une tâche en une ligne, comme « Appeler la banque demain 14h #Perso 30min » : date, heure, projet et durée sont reconnus pendant la frappe.',
    astuces: [
      'une tâche répétée « le 31 » tombe le 30 ou le 28 les mois plus courts, sans décaler les mois suivants ;',
      'la clôture du soir reporte ce qui reste, archive ce qui est fait et dresse le bilan de la journée.',
    ],
    aide: 'Une répétition ou une échéance que la saisie rapide ne comprend pas ?',
  },
  CRA: {
    commencer: 'créez une réunion à partir d\'un des 8 modèles et notez une action en une ligne, comme « Marie : envoyer le devis avant vendredi » : responsable et échéance sont reconnus.',
    astuces: [
      'à la réunion suivante de la même série, les actions encore ouvertes reviennent en tête du compte rendu ;',
      'le compte rendu se copie en texte pour votre messagerie : les participants n\'ont besoin d\'aucun accès.',
    ],
    aide: 'Un format de réunion que les modèles proposés ne couvrent pas ?',
  },
  TJM: {
    commencer: 'indiquez le revenu que vous visez, vos frais et votre statut : votre TJM minimum et votre TJM conseillé s\'affichent, et se mettent à jour à chaque saisie.',
    astuces: [
      'trois scénarios se comparent côte à côte, avec la courbe du TJM selon le nombre de jours facturés ;',
      'une alerte prévient quand le chiffre d\'affaires visé approche le plafond de la micro-entreprise ou les seuils de la franchise de TVA.',
    ],
    aide: 'Un statut ou un taux de charges que vous ne savez pas comment saisir ?',
  },
  PRX: {
    commencer: 'partez d\'une des deux structures types et ajustez vos charges et votre rémunération visée : votre coût de revient horaire et votre prix plancher s\'affichent.',
    astuces: [
      'le prix conseillé ajoute votre marge cible exprimée en part du prix de vente : avec 20 %, il vaut le coût divisé par 0,8 ;',
      'les clients dont le taux horaire réel passe sous votre prix plancher sont signalés.',
    ],
    aide: 'Un poste de charges ou une organisation d\'équipe difficile à ramener à l\'heure ?',
  },
  MCE: {
    commencer: 'notez votre dernier encaissement avec sa date, son client et sa catégorie : le chiffre d\'affaires de la période et l\'estimation des cotisations s\'affichent.',
    astuces: [
      'les plafonds du régime sont proratisés la première année, et une alerte part dès 80 % ;',
      'une activité mixte se suit recette par recette : vente, prestations BIC et libérales BNC restent séparées pour la déclaration.',
    ],
    aide: 'Une activité mixte ou un taux réduit, comme l\'ACRE, à paramétrer ?',
  },
  VSA: {
    commencer: 'créez une opération et un lot, puis enregistrez un document reçu avec son indice et ses viseurs : l\'échéance de visa se calcule selon votre délai.',
    astuces: [
      'avec plusieurs viseurs, la synthèse retient l\'avis le plus sévère, et l\'indice se clôt quand tous ont répondu ;',
      'les délais se comptent en jours calendaires ou ouvrés, et chaque opération peut avoir les siens.',
    ],
    aide: 'Un circuit de visa ou un délai propre à votre convention de maîtrise d\'œuvre ?',
  },
  NCF: {
    commencer: 'choisissez BTP ou industrie, puis notez un écart récent avec son lot ou son atelier et sa gravité : il reçoit son numéro et entre dans les indicateurs.',
    astuces: [
      'les 5 pourquoi reprennent à chaque question la réponse précédente, et la cause racine se classe en 6M ;',
      'une non-conformité passe par la vérification d\'efficacité de ses actions avant sa clôture.',
    ],
    aide: 'Une grille de gravité ou une typologie d\'écarts propre à votre système qualité ?',
  },
  DVS: {
    commencer: 'choisissez la liste type de votre métier, renseignez vos prix, puis composez un premier devis de quelques lignes : les totaux HT, TVA et TTC se calculent au centime.',
    astuces: [
      'avant l\'impression, le générateur signale les mentions qui manquent (SIREN, client, objet, assurance…) ;',
      'un devis se duplique en un geste pour servir de base au suivant.',
    ],
    aide: 'Une mention propre à votre secteur, ou un taux de TVA particulier ?',
  },
  TRS: {
    commencer: 'choisissez un profil d\'activité, puis saisissez vos prévisions récurrentes (loyer, salaires, encaissements réguliers) : le solde des 12 mois et son point bas s\'affichent.',
    astuces: [
      'le scénario prudent baisse les encaissements pas encore réalisés, sans toucher aux décaissements ;',
      'chaque mois, le plan se recale sur le solde réellement constaté.',
    ],
    aide: 'Des échéances de TVA, d\'Urssaf ou d\'impôts difficiles à placer dans le plan ?',
  },
  ASC: {
    commencer: 'saisissez votre grille de quotient familial et une activité avec son créneau et sa capacité, puis inscrivez une famille : le bon tarif s\'applique.',
    astuces: [
      'quand une place se libère, la première personne de la liste d\'attente est inscrite automatiquement ;',
      'la liste d\'appel s\'imprime par créneau et par mois, jours de fermeture exclus.',
    ],
    aide: 'Une grille tarifaire ou un échelonnement des paiements propre à votre association ?',
  },
  RSV: {
    commencer: 'depuis votre téléphone, notez une réserve avec son local, son lot et son entreprise : elle reçoit son numéro et son échéance de levée.',
    astuces: [
      'la localisation reste en mémoire pour enchaîner les réserves d\'une même pièce ;',
      'une réserve refusée au contrôle garde son motif et repart avec un délai après refus, réglable.',
    ],
    aide: 'Un délai de levée ou un procès-verbal à adapter aux exigences de votre marché ?',
  },
  ARD: {
    commencer: 'créez l\'arrivée d\'un salarié avec son profil et sa date d\'entrée : sa checklist se remplit, chaque tâche avec son responsable et son échéance.',
    astuces: [
      'chaque responsable voit ce qu\'il doit faire cette semaine, retards en tête ;',
      'le matériel noté à l\'arrivée se retrouve au départ : ce qui n\'est pas rendu passe en alerte.',
    ],
    aide: 'Un poste ou un type de contrat que les cinq profils ne couvrent pas ?',
  },
  CNG: {
    commencer: 'ajoutez un salarié et son équipe, puis saisissez une demande de congés reçue : son solde après validation s\'affiche avant que vous décidiez.',
    astuces: [
      'chaque équipe a un nombre maximal d\'absents simultanés, et un dépassement est signalé dans le calendrier ;',
      'la période de référence, le décompte en jours ouvrables ou ouvrés et les valeurs de votre convention se règlent.',
    ],
    aide: 'Une règle de votre convention collective que les réglages ne permettent pas de reproduire ?',
  },
  NDF: {
    commencer: 'saisissez un repas ou un trajet du mois, avec son montant TTC ou ses kilomètres : il rejoint la note du mois, prête à imprimer.',
    astuces: [
      'les indemnités kilométriques se calculent sur le cumul de l\'année, véhicule par véhicule, avec la régularisation expliquée ;',
      'un justificatif à fournir est signalé, et apparaît comme tel sur la note imprimée.',
    ],
    aide: 'Un barème ou une règle de remboursement propre à votre employeur ?',
  },
  STK: {
    commencer: 'créez un article avec son seuil d\'alerte, puis saisissez une entrée et une vente : son stock, sa valeur au coût moyen pondéré et l\'alerte éventuelle s\'affichent.',
    astuces: [
      'la liste à commander se regroupe par fournisseur, avec un texte de commande prêt à copier ;',
      'à la validation d\'un inventaire, chaque écart devient un ajustement daté ; une ligne non comptée ne change rien.',
    ],
    aide: 'Un article vendu en lot ou au détail qui se suit mal ?',
  },
  CRM: {
    commencer: 'ajoutez un prospect avec sa cadence de relance (ou une prochaine action datée) : il apparaît le jour venu dans la liste des personnes à relancer, retards en tête, avec le message prêt à copier.',
    astuces: [
      'les scripts se remplissent avec le prénom, l\'organisation et la fonction du contact ; quand il répond, la cadence s\'arrête et l\'affaire passe « En échange » ;',
      'une personne qui s\'oppose est arrêtée d\'un geste : plus aucune relance, et seul le minimum est gardé pour ne pas la recontacter.',
    ],
    aide: 'Un cycle de vente, un canal ou un rythme de relance propre à votre activité ?',
  },
  RCV: {
    commencer: 'saisissez une facture impayée avec son montant et son échéance : le retard en jours, les pénalités et l\'indemnité forfaitaire entre professionnels se calculent.',
    astuces: [
      'un paiement partiel est pris en compte : les pénalités courent sur le seul restant dû ;',
      'pour un client particulier, l\'outil retire l\'indemnité forfaitaire et applique l\'intérêt légal à partir de la mise en demeure.',
    ],
    aide: 'Des conditions générales avec un taux de pénalités particulier ?',
  },
  PCM: {
    commencer: 'choisissez la trame de votre métier, fixez le prix de vos trois options et marquez celle que vous recommandez : le tableau de comparaison se construit seul.',
    astuces: [
      'quand une proposition est marquée envoyée, sa date de validité et sa prochaine relance se calculent ;',
      'les blocs que vous réutilisez d\'une proposition à l\'autre se rangent dans une bibliothèque.',
    ],
    aide: 'Une prestation difficile à découper en trois options ?',
  },
  APD: {
    commencer: 'pour votre prochain appel, indiquez la durée prévue et choisissez quelques questions dans la banque : le temps se répartit entre les phases.',
    astuces: [
      'pendant l\'appel, les 25 objections types restent sous la main, avec une piste de réponse et une question de relance ;',
      'le score de qualification sur 8 points suit une règle affichée : besoin, budget, décideur, échéance.',
    ],
    aide: 'Un type d\'interlocuteur ou d\'objection que la banque ne couvre pas ?',
  },
  VHC: {
    commencer: 'ajoutez un véhicule avec sa date de première mise en circulation et son kilométrage : son prochain contrôle technique et ses entretiens dus rejoignent la liste d\'alertes.',
    astuces: [
      'pour une location longue durée, l\'outil projette le kilométrage en fin de contrat et le coût du dépassement ;',
      'une réservation qui en chevauche une autre, pour le même véhicule ou le même conducteur, est refusée.',
    ],
    aide: 'Un véhicule dont le carnet d\'entretien diffère du plan proposé ?',
  },
  PRC: {
    commencer: 'enregistrez un ordinateur avec sa date d\'achat et affectez-le à une personne : sa fin de garantie se calcule et la fiche de remise est prête à imprimer.',
    astuces: [
      'pour chaque licence, les postes achetés se comparent aux postes attribués, et un dépassement est signalé ;',
      'au départ d\'un salarié, la liste du matériel et des licences à récupérer se dresse en une fois.',
    ],
    aide: 'Un matériel ou un abonnement qui se range mal dans les catégories proposées ?',
  },
  CED: {
    commencer: 'choisissez votre métier et vos piliers, puis placez un sujet de la banque sur votre prochain jour de publication : il entre dans le calendrier de la semaine.',
    astuces: [
      'le compteur du brouillon signale les passages entre crochets restant à remplacer et la limite de caractères que vous avez saisie ;',
      'vos meilleurs contenus anciens remontent comme idées à recycler sous une autre forme.',
    ],
    aide: 'Un canal ou un format de publication que le calendrier gère mal ?',
  },
  RVH: {
    commencer: 'choisissez le jour de votre revue de la semaine, puis écrivez une ligne de journal pour aujourd\'hui, avec votre humeur si vous le souhaitez.',
    astuces: [
      'la revue guidée tient en 7 étapes et propose chaque semaine une autre question par étape, parmi 55 que vous pouvez masquer ou compléter ;',
      'l\'historique se cherche sans souci des accents, et la tendance montre la série de semaines tenues et la part des priorités réalisées.',
    ],
    aide: 'Un rituel de fin de semaine qui ne rentre pas dans les 7 étapes ?',
  },
  CRS: {
    commencer: 'entrez un chrono récent, la course visée et vos jours de course : vos allures et le plan semaine par semaine s\'affichent.',
    astuces: [
      'une séance manquée se note ou se déplace dans la semaine, et une semaine allégée vous est proposée quand les séances deviennent trop dures ;',
      'le plan s\'imprime et s\'ajoute à votre agenda en fichier .ics.',
    ],
    aide: 'Une course ou un rythme d\'entraînement que le plan type gère mal ?',
  },
  DMN: {
    commencer: 'indiquez la date du déménagement et votre situation (location ou achat, déménageur ou utilitaire, enfants, animal) : le rétroplanning se crée, semaine par semaine.',
    astuces: [
      'chaque carton reçoit un numéro, une pièce d\'arrivée et un contenu : une recherche retrouve en quel carton est rangé un objet ;',
      'les devis de déménageurs se comparent au prix du m³, et celui que vous retenez entre au budget.',
    ],
    aide: 'Une démarche propre à votre situation qui manque à la liste ?',
  },
  CDX: {
    commencer: 'créez l\'événement (mariage, naissance, anniversaire, retraite ou obsèques) et notez trois cadeaux reçus : un message de remerciement est prêt pour chaque foyer.',
    astuces: [
      'le ton des messages se choisit (chaleureux, sobre, bref ou léger), et le texte se retouche avant d\'être copié ;',
      'les étiquettes d\'adresses s\'impriment sur une planche A4 entamée, en commençant à la bonne case.',
    ],
    aide: 'Une liste de cadeaux tenue ailleurs que vous voudriez reprendre ?',
  },
  CTR: {
    commencer: 'saisissez un contrat avec sa date de fin et son préavis : la date limite de résiliation et la prochaine alerte se calculent.',
    astuces: [
      'les reconductions tacites déjà passées font avancer l\'échéance d\'elles-mêmes, sans rien ressaisir ;',
      'une lettre de résiliation préremplie (fournisseur, numéro de contrat, échéance) se copie ou s\'imprime, à adapter à votre contrat.',
    ],
    aide: 'Un contrat dont l\'échéance ou le préavis se calcule autrement ?',
  },
  BSC: {
    commencer: 'partez d\'une des 5 séquences types, nommez l\'équipe et adaptez les durées : le déroulé horaire et la fin estimée se calculent.',
    astuces: [
      'l\'heure limite du retour arrière (fin de fenêtre moins durée du repli) est calculée, avec une alerte avant qu\'il soit trop tard ;',
      'une répétition se duplique pour préparer la vraie bascule avec les durées réellement mesurées.',
    ],
    aide: 'Une bascule dont l\'enchaînement des étapes ne rentre pas dans le déroulé ?',
  },
  ACH: {
    commencer: 'indiquez vos services, leur budget annuel et votre seuil de validation, puis saisissez une demande à partir du catalogue de fournitures.',
    astuces: [
      'sous le seuil fixé, une demande chiffrée qui tient dans le budget du service est validée tout de suite ;',
      'les demandes validées se regroupent en un bon de commande par fournisseur, et la réception peut être partielle.',
    ],
    aide: 'Un circuit de validation à plusieurs niveaux que le seuil unique ne couvre pas ?',
  },
};
