// Base intégrée du template « Objectif d'épargne et fonds d'urgence » : objectifs types et postes de
// budget, dépenses essentielles du fonds d'urgence, repère de taille du fonds, jalons, conseils, glossaire.
// Contenu original rédigé pour QME. Aucun taux, plafond, prix ni barème : l'utilisateur saisit le taux
// de son propre placement (zéro par défaut) et ses propres montants. Le repère « 3 à 6 mois de dépenses »
// est un ordre de grandeur courant en éducation financière, présenté comme tel, pas une règle.
(() => {
  window.BASE = {
    version: '2026-11-14',

    // Objectifs types : postes du budget à chiffrer (sans montant), horizon indicatif proposé pour la date
    // visée (modifiable), conseil de placement générique (aucun produit, aucun taux), points d'attention.
    // `urgence` : objectif calculé en mois de dépenses essentielles.
    types: [
      { id: 'urgence', nom: 'Fonds d\'urgence', court: 'Fonds d\'urgence', forme: 'rond', couleur: 0, urgence: true, horizon: 12,
        promesse: 'De quoi tenir plusieurs mois si les revenus s\'arrêtent ou qu\'un gros imprévu tombe.',
        support: 'Une épargne disponible à tout moment, sans risque de perte, séparée du compte courant.',
        attention: 'C\'est le premier objectif à remplir : il évite de recréer une dette au premier imprévu. On n\'y touche que pour une vraie urgence, puis on le reconstitue.' },
      { id: 'apport', nom: 'Apport immobilier', court: 'Apport', forme: 'carre', couleur: 1, horizon: 36,
        postes: ['Apport personnel visé', 'Frais de notaire (estimation du notaire)', 'Frais de garantie du prêt', 'Frais de dossier bancaire', 'Frais d\'agence s\'ils sont à ta charge', 'Déménagement', 'Premiers travaux et équipement', 'Marge pour imprévus'],
        support: 'Horizon de quelques années : une épargne sans risque de perte en capital, disponible à la date de l\'achat.',
        attention: 'Demande à ta banque l\'apport qu\'elle attend et au notaire une estimation des frais : ce sont eux qui fixent la cible, pas un pourcentage tout fait.' },
      { id: 'voiture', nom: 'Voiture ou deux-roues', court: 'Voiture', forme: 'carre', couleur: 2, horizon: 18,
        postes: ['Prix du véhicule', 'Carte grise', 'Première année d\'assurance', 'Équipement (pneus, siège enfant…)', 'Premier entretien', 'Marge pour imprévus'],
        support: 'Horizon court : une épargne disponible, sans risque.',
        attention: 'Payer comptant évite le coût d\'un crédit ; garde quand même ton fonds d\'urgence intact.' },
      { id: 'voyage', nom: 'Voyage', court: 'Voyage', forme: 'triangle', couleur: 3, horizon: 10,
        postes: ['Transport aller-retour', 'Hébergement', 'Repas', 'Activités et visites', 'Transports sur place', 'Assurance voyage', 'Visa ou formalités', 'Marge pour imprévus'],
        support: 'Horizon court : une épargne disponible.',
        attention: 'Fixe la date de départ comme date visée : le versement nécessaire chaque mois se calcule tout seul.' },
      { id: 'travaux', nom: 'Travaux ou équipement de la maison', court: 'Travaux', forme: 'carre', couleur: 4, horizon: 18,
        postes: ['Devis principal', 'Matériaux en plus', 'Électroménager ou mobilier', 'Location de matériel', 'Marge pour dépassement'],
        support: 'Horizon court ou moyen : une épargne disponible.',
        attention: 'Ajoute une marge : les travaux dépassent souvent le devis. Les aides éventuelles se déduisent une fois accordées, pas avant.' },
      { id: 'naissance', nom: 'Arrivée d\'un enfant', court: 'Bébé', forme: 'rond', couleur: 5, horizon: 9,
        postes: ['Poussette et siège auto', 'Chambre (lit, commode)', 'Vêtements', 'Alimentation et couches des premiers mois', 'Baisse de revenus pendant le congé', 'Marge pour imprévus'],
        support: 'Horizon court : une épargne disponible.',
        attention: 'Pense à la baisse de revenus éventuelle pendant le congé : c\'est souvent le plus gros poste.' },
      { id: 'mariage', nom: 'Mariage ou fête', court: 'Fête', forme: 'triangle', couleur: 0, horizon: 18,
        postes: ['Lieu', 'Traiteur', 'Tenues', 'Photographe', 'Musique', 'Décoration et fleurs', 'Faire-part et papeterie', 'Marge pour imprévus'],
        support: 'Horizon court ou moyen : une épargne disponible.',
        attention: 'Les acomptes tombent avant la date : prévois-les comme retraits dans le plan.' },
      { id: 'etudes', nom: 'Études d\'un enfant', court: 'Études', forme: 'carre', couleur: 1, horizon: 120,
        postes: ['Frais d\'inscription', 'Logement étudiant', 'Équipement informatique', 'Transport', 'Vie courante'],
        support: 'Horizon long : l\'épargne peut être placée autrement qu\'en disponible, avec un risque à mesurer. Ce n\'est pas l\'objet de cet outil.',
        attention: 'Un petit versement régulier sur longtemps fait beaucoup grâce aux intérêts composés : compare les scénarios.' },
      { id: 'permis', nom: 'Permis de conduire', court: 'Permis', forme: 'triangle', couleur: 2, horizon: 12,
        postes: ['Forfait d\'auto-école', 'Heures supplémentaires', 'Code', 'Frais d\'examen', 'Marge pour heures en plus'],
        support: 'Horizon court : une épargne disponible.',
        attention: 'Demande le prix de l\'heure supplémentaire : c\'est le poste qui fait dépasser le budget.' },
      { id: 'demenagement', nom: 'Déménagement', court: 'Déménagement', forme: 'carre', couleur: 3, horizon: 6,
        postes: ['Dépôt de garantie', 'Premier loyer', 'Frais d\'agence', 'Location de camion ou déménageur', 'Ouverture des contrats', 'Premiers achats'],
        support: 'Horizon court : une épargne disponible.',
        attention: 'Le dépôt de garantie de l\'ancien logement revient souvent après l\'entrée dans le nouveau : ne compte pas dessus pour le départ.' },
      { id: 'annuel', nom: 'Dépenses annuelles prévisibles', court: 'Annuel', forme: 'quart', couleur: 4, horizon: 12,
        postes: ['Assurances payées à l\'année', 'Taxe ou impôt non mensualisé', 'Rentrée scolaire', 'Cadeaux de fin d\'année', 'Vacances d\'été', 'Entretien de la voiture'],
        support: 'Une épargne disponible, alimentée chaque mois et vidée au fil de l\'année.',
        attention: 'Divise le total par 12 : c\'est le versement qui lisse ces dépenses et évite les mois dans le rouge.' },
      { id: 'projet', nom: 'Projet personnel', court: 'Projet', forme: 'rond', couleur: 5, horizon: 24,
        postes: ['Formation', 'Matériel', 'Période sans revenus', 'Marge pour imprévus'],
        support: 'Selon l\'horizon : disponible à court terme, autre chose à long terme.',
        attention: 'Année sabbatique, reconversion, création d\'activité : chiffre aussi les mois sans revenus.' },
      { id: 'autre', nom: 'Autre objectif', court: 'Autre', forme: 'quart', couleur: 0, horizon: 12,
        postes: [],
        support: 'Choisis un support adapté à l\'horizon et au risque que tu acceptes.',
        attention: 'Un objectif clair a un montant et une date : sans date, le versement nécessaire ne peut pas se calculer.' },
    ],

    // Couleurs des objectifs, dans l'ordre (validées par le script dataviz : contraste ≥ 3:1, ΔE daltonisme ≥ 9
    // entre voisines ; toutes paires confondues certaines se ressemblent, d'où nom à côté de chaque couleur,
    // légende et tableau des données).
    couleurs: ['#2A63B0', '#C0502F', '#1E8A6E', '#8E5BB0', '#B07A12', '#C23F7A'],

    // Fonds d'urgence : dépenses essentielles d'un mois (les postes, pas les montants).
    depensesEssentielles: [
      'Loyer ou mensualité du prêt immobilier', 'Charges, eau et énergie', 'Courses alimentaires', 'Transport (carburant, abonnement)',
      'Assurances (habitation, voiture, santé)', 'Téléphone et internet', 'Frais de santé restant à charge', 'Enfants (garde, cantine)',
      'Crédits en cours (mensualités)', 'Impôts et taxes mensualisés', 'Autres dépenses incontournables',
    ],

    // Repère de taille du fonds : mois de dépenses essentielles selon la situation, + 1 par facteur.
    // Ordre de grandeur pédagogique (3 à 6 mois couramment cité), borné de 3 à 12 mois : pas une règle.
    questions: {
      situations: [
        { id: 'stable', nom: 'Revenus stables', detail: 'Salaire régulier en contrat durable, pension.', mois: 3 },
        { id: 'variable', nom: 'Revenus variables', detail: 'Contrat court, intérim, primes ou commissions importantes.', mois: 5 },
        { id: 'independant', nom: 'Indépendant ou dirigeant', detail: 'Chiffre d\'affaires qui varie, pas d\'allocation chômage garantie.', mois: 6 },
      ],
      facteurs: [
        { id: 'seul', nom: 'Un seul revenu fait vivre le foyer', plus: 1 },
        { id: 'charge', nom: 'Des personnes à charge (enfants, proche)', plus: 1 },
        { id: 'proprietaire', nom: 'Propriétaire (gros travaux imprévus possibles)', plus: 1 },
        { id: 'vehicule', nom: 'Un véhicule indispensable et ancien', plus: 1 },
        { id: 'sante', nom: 'Des frais de santé difficiles à prévoir', plus: 1 },
      ],
    },

    // Paliers suivis pour chaque objectif (pourcentages de la cible).
    paliers: [10, 25, 50, 75, 100],

    // Mode de calcul affiché dans l'application.
    calcul: [
      'Chaque mois, les intérêts valent : solde × taux annuel ÷ 12, arrondis au centime. Le taux est celui que tu saisis (zéro par défaut) : aucun taux n\'est fourni par l\'outil.',
      'Capitalisation mensuelle : les intérêts s\'ajoutent au solde chaque mois et rapportent à leur tour (intérêts composés).',
      'Capitalisation annuelle : les intérêts du mois s\'accumulent et sont ajoutés au solde en décembre, comme sur la plupart des livrets.',
      'Puis le versement du mois s\'ajoute, ainsi que les versements ou retraits ponctuels prévus. Une fois la cible atteinte, les versements s\'arrêtent (le dernier est ajusté).',
      'Le solde réel part du solde saisi à la création de l\'objectif, plus les versements, moins les retraits, plus les intérêts que tu notes dans l\'historique.',
      'Le versement nécessaire est le plus petit versement mensuel, arrondi à l\'euro supérieur, qui atteint la cible au plus tard le mois visé.',
      'Limites : les banques calculent souvent les intérêts par quinzaine ou au jour près, et des prélèvements fiscaux et sociaux peuvent réduire les intérêts. Saisis un taux net si tu le connais. Le résultat est une estimation.',
    ],

    glossaire: [
      ['Fonds d\'urgence', 'Une réserve disponible tout de suite pour faire face à une perte de revenus ou à une dépense imprévue, sans s\'endetter. On l\'exprime en mois de dépenses essentielles.'],
      ['Dépenses essentielles', 'Ce que tu dois payer chaque mois quoi qu\'il arrive : logement, énergie, nourriture, transport, assurances, crédits.'],
      ['Intérêts composés', 'Les intérêts gagnés s\'ajoutent au capital et rapportent à leur tour des intérêts. L\'effet grandit avec le temps.'],
      ['Taux annuel', 'Le pourcentage que rapporte l\'épargne sur un an. Il peut changer en cours de route : mets-le à jour quand ta banque l\'annonce.'],
      ['Taux net', 'Le taux après prélèvements fiscaux et sociaux, quand il y en a. C\'est le plus proche de ce que tu toucheras.'],
      ['Capitalisation', 'Le moment où les intérêts sont ajoutés au solde : chaque mois, ou une fois par an.'],
      ['Épargne disponible', 'Une épargne que tu peux retirer à tout moment, sans pénalité ni perte. Indispensable pour un fonds d\'urgence.'],
      ['Inflation', 'La hausse des prix : un objectif lointain coûtera peut-être plus cher qu\'aujourd\'hui. Ajoute une marge, ou revois la cible chaque année.'],
    ],

    conseils: [
      ['Commence par le fonds d\'urgence', 'Même un premier mois de dépenses change tout : l\'imprévu ne devient plus une dette.'],
      ['Programme un virement automatique', 'Le lendemain de la paie, vers une épargne séparée : on épargne d\'abord, on dépense ensuite.'],
      ['Donne une date à chaque objectif', 'Avec une date, l\'outil calcule le versement nécessaire et te dit si tu es dans les temps.'],
      ['Chiffre poste par poste', 'Un budget détaillé tient mieux qu\'un montant rond : les oublis se voient.'],
      ['Épargne les hausses', 'Augmentation, prime, fin d\'un crédit : verse une partie de la différence avant de t\'y habituer.'],
      ['Note les intérêts reçus', 'Une fois par an, ajoute les intérêts crédités : ton solde réel reste juste.'],
      ['Reconstitue après un retrait', 'Utiliser le fonds d\'urgence est normal ; le plan montre ensuite combien de mois pour le remplir.'],
      ['Ne vise pas trop haut au départ', 'Un versement tenu tous les mois vaut mieux qu\'un gros versement abandonné au bout de trois.'],
    ],

    avertissement: 'Outil d\'aide au calcul : il ne remplace pas un conseil financier personnalisé. Aucun taux ni produit n\'est recommandé : les résultats dépendent du taux que tu saisis, de ses changements, des règles de calcul de ta banque et de la fiscalité éventuelle. Une épargne placée avec un risque peut perdre de la valeur.',
    sources: 'Aucune donnée de marché intégrée. Repère « 3 à 6 mois de dépenses » : ordre de grandeur courant en éducation financière, ajusté ici par des facteurs de situation choisis par QME (hypothèses modifiables, à ton appréciation).',
  };
})();
