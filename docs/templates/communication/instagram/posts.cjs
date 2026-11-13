// Données des carrousels Instagram IG-06 à IG-33 (textes : ../instagram-2026-11-12.md).
// Chaque post : 5 vues. `img` = capture de assets/ (null = vue texte). Les passages entre crochets
// [ … ] sont à compléter (sur mesure) : ils s'affichent surlignés « à compléter ».
// Après modification : node docs/templates/communication/instagram/generer.cjs
module.exports = [
  { id: 'IG-06', tag: 'T40 · Calculateur de TJM', nom: 'Calculateur de TJM', prix: '12 €', vues: [
    { t: 'Votre TJM paie-t-il vraiment votre salaire ?' },
    { t: 'Un TJM se calcule à l\'envers : revenu voulu + frais + cotisations, divisé par les jours vraiment facturés. Pas 365.' },
    { t: 'Jours ouvrés calculés, fériés retirés. Micro (BIC, BNC, Cipav) ou SASU / EURL.', img: 'templates-tjm-tel.webp' },
    { t: 'TJM minimum et TJM conseillé, trois scénarios côte à côte.', img: 'templates-tjm-scenarios.webp' },
  ]},
  { id: 'IG-07', tag: 'T41 · Livre recettes-dépenses', nom: 'Livre recettes-dépenses', prix: '25 €', vues: [
    { t: 'Déclaration URSSAF : fini les trois tableurs.' },
    { t: 'Chaque recette notée en quelques secondes, rangée par activité.', img: 'templates-micro-entreprise-tel.webp' },
    { t: 'À chaque échéance, le chiffre d\'affaires à déclarer est prêt, cotisations estimées.', img: 'templates-micro-entreprise-declarations.webp' },
    { t: 'Plafonds et seuils de TVA suivis toute l\'année, alerte avant de les atteindre.', img: 'templates-micro-entreprise-seuils.webp' },
  ]},
  { id: 'IG-08', tag: 'T65 · Budget commun', nom: 'Budget commun', prix: '15 €', vues: [
    { t: '« Je t\'ai fait un virement pour les courses… ou c\'était l\'électricité ? »' },
    { t: 'Chacun note ce qu\'il paie. Parts égales, prorata des revenus, parts ou montant exact.' },
    { t: 'Qui doit combien à qui, et le nombre minimal de virements pour solder.', img: 'templates-budget-commun-tel.webp' },
    { t: 'Loyer et abonnements ajoutés chaque mois. Une clé pour tout le foyer.', img: 'templates-budget-commun-mois.webp' },
  ]},
  { id: 'IG-09', tag: 'T02 · Planning Gantt', nom: 'Planning Gantt', prix: '45 €', vues: [
    { t: 'Une date bouge. Vingt cellules à reprendre à la main ?' },
    { t: 'Une ligne suffit : « Pose des meubles 12/12 3j après 7 ».', img: 'templates-gantt-gantt.webp' },
    { t: 'Les dates se recalculent seules, en jours ouvrés, fériés français compris.' },
    { t: 'Le chemin critique : les tâches qui décalent la fin du projet.', img: 'templates-gantt-critique.webp' },
  ]},
  { id: 'IG-29', tag: 'Sur mesure', sur: true, vues: [
    { t: 'La fiche d\'arrivée qui évite deux litiges.' },
    { t: 'Le constat : [ce qui se passait avant, d\'après LI-03]. Sans trace écrite, c\'est parole contre parole.' },
    { t: 'La réponse : une fiche remplie à l\'arrivée, sur téléphone. Heure, photos, état constaté, validation.' },
    { t: 'Le résultat : [les deux litiges évités, d\'après LI-03]. La preuve existe avant que la question se pose.' },
  ]},
  { id: 'IG-10', tag: 'T03 · Gestionnaire de tâches', nom: 'Gestionnaire de tâches', prix: '19 €', vues: [
    { t: 'Une liste qui s\'allonge ne dit pas quoi faire ce matin.' },
    { t: 'Noter vite : « Appeler la banque demain 14h !haute #Perso 30min ».', img: 'templates-taches-tel.webp' },
    { t: 'Trier : urgent ou pas, important ou pas, un élément après l\'autre.', img: 'templates-taches-triage.webp' },
    { t: 'Choisir : 3 à 5 tâches au focus, le temps prévu face au temps disponible.', img: 'templates-taches-semaine.webp' },
  ]},
  { id: 'IG-11', tag: 'T05 · Budget du foyer', nom: 'Budget du foyer', prix: '15 €', vues: [
    { t: 'Où est passé l\'argent ce mois-ci ?' },
    { t: 'Des enveloppes par catégorie, avec report du reste d\'un mois sur l\'autre.', img: 'templates-budget-enveloppes.webp' },
    { t: 'Le prévu face au réel : les enveloppes dépassées sont signalées tout de suite.' },
    { t: 'Le trajet de l\'argent : des revenus vers les besoins, les envies, l\'épargne.', img: 'templates-budget-tel.webp' },
  ]},
  { id: 'IG-12', tag: 'T24 · Circuit de visa', nom: 'Circuit de visa', prix: '39 €', vues: [
    { t: 'Un plan qui attend son visa trois semaines, c\'est souvent une relance oubliée.' },
    { t: 'Un registre par lot : indice, réception, échéance, avis de chaque viseur.', img: 'templates-visa-registre.webp' },
    { t: 'Échéances calculées avec les délais de votre marché, calendaires ou ouvrés.' },
    { t: 'Chaque matin : qui relancer, avec le message déjà rédigé.', img: 'templates-visa-tel.webp' },
  ]},
  { id: 'IG-13', tag: 'T25 · Non-conformités', nom: 'Registre des non-conformités', prix: '20 €', vues: [
    { t: 'Le même écart revient trois fois avant qu\'on se demande pourquoi.' },
    { t: 'Le constat en 30 secondes, sur le terrain, depuis le téléphone.', img: 'templates-non-conformites-tel.webp' },
    { t: 'La cause par les 5 pourquoi, guidés, classée en 6M.', img: 'templates-non-conformites-fiche.webp' },
    { t: 'Actions suivies, puis vérification d\'efficacité avant de clore.', img: 'templates-non-conformites-indicateurs.webp' },
  ]},
  { id: 'IG-30', tag: 'Sur mesure', sur: true, vues: [
    { t: 'Maintenance : au compteur, pas au calendrier.' },
    { t: '« Tous les 6 mois » : trop tôt pour une machine qui tourne peu, trop tard pour celle qui tourne jour et nuit.' },
    { t: 'Le compteur suit l\'usage réel : heures, kilomètres, cycles. L\'entretien se déclenche au premier seuil atteint.' },
    { t: '[Ce que ça a changé dans le cas LI-24.]' },
  ]},
  { id: 'IG-14', tag: 'T28 · CRM freelance', nom: 'CRM freelance', prix: '25 €', vues: [
    { t: 'Le devis envoyé il y a dix jours. Quelqu\'un l\'a relancé ?' },
    { t: 'Chaque contact a une prochaine action datée. Chaque matin, qui relancer.', img: 'templates-crm-tel.webp' },
    { t: 'Après un échange : « Fait ». L\'action suivante est proposée.', img: 'templates-crm-contacts.webp' },
    { t: 'Devis et factures suivis : échéances, encaissements, CA par client.', img: 'templates-crm-chiffres.webp' },
  ]},
  { id: 'IG-15', tag: 'T29 · Gestion de flotte', nom: 'Gestion de flotte', prix: '39 €', vues: [
    { t: 'Contrôle technique, entretien, amende à désigner : qui suit les dates ?' },
    { t: 'Une seule liste d\'alertes, retards en tête.', img: 'templates-flotte-bord.webp' },
    { t: 'Réservations par véhicule, chevauchements refusés, kilométrage au retour.', img: 'templates-flotte-tel.webp' },
    { t: 'Coût total et coût au kilomètre de chaque véhicule.', img: 'templates-flotte-couts.webp' },
  ]},
  { id: 'IG-16', tag: 'T30 · Planner horaire', nom: 'Planner horaire', prix: '15 €', vues: [
    { t: 'Prévoir sa semaine, facile. Voir l\'écart avec la réalité, moins.' },
    { t: 'Une grille de 30 minutes. Les blocs se posent et se déplacent au doigt.', img: 'templates-planner-tel.webp' },
    { t: 'Chaque bloc en un geste : fait, raccourci, déplacé, pas fait.' },
    { t: 'Le bilan : prévu face au réalisé, par catégorie, sur six semaines.', img: 'templates-planner-bilan.webp' },
  ]},
  { id: 'IG-17', tag: 'T32 · Levée de réserves', nom: 'Levée de réserves', prix: '39 €', vues: [
    { t: 'Des dizaines de réserves, dix entreprises, une liste recopiée à chaque visite.' },
    { t: 'Saisie pendant la visite, sur téléphone : bâtiment, niveau, local, lot.', img: 'templates-reserves-tel.webp' },
    { t: 'Le cycle daté : levée, contrôle, refus motivé avec nouvelle échéance.' },
    { t: 'Tableau de bord par entreprise et par lot, PV de levée prêt à imprimer.', img: 'templates-reserves-bord.webp' },
  ]},
  { id: 'IG-31', tag: 'Sur mesure', sur: true, vues: [
    { t: 'Le tableur n\'est pas le problème.' },
    { t: 'Il est souple, connu de tous, gratuit. Il dépanne très bien.' },
    { t: 'Ce qui coince : plusieurs copies, des règles connues d\'une seule personne, rien qui alerte.' },
    { t: '[Ce qui a été fait dans le cas LI-46.] On commence par la façon de travailler, pas par l\'outil.' },
  ]},
  { id: 'IG-18', tag: 'T35 · Pipeline de prospection', nom: 'Pipeline de prospection', prix: '25 €', vues: [
    { t: 'Prospecter seul : les relances glissent.' },
    { t: 'Les prospects avancent par étapes, de « À contacter » à « Gagné ».', img: 'templates-prospection-pipeline.webp' },
    { t: 'Chaque matin, les relances du jour selon la cadence choisie.', img: 'templates-prospection-tel.webp' },
    { t: 'Un script rempli avec le prénom du prospect, à relire et copier. Rien n\'est envoyé à votre place.' },
  ]},
  { id: 'IG-19', tag: 'T36 · Générateur de devis', nom: 'Générateur de devis', prix: '29 €', vues: [
    { t: 'Un ancien devis modifié… et un total qui n\'a pas suivi.' },
    { t: 'Un catalogue de prestations : unité, prix HT, TVA. Les prix, c\'est vous.' },
    { t: 'Sections, remises, TVA par ligne, acompte. Totaux calculés au centime.', img: 'templates-devis-tel.webp' },
    { t: 'Mentions vérifiées avant l\'envoi, impression A4 ou PDF.', img: 'templates-devis-apercu.webp' },
  ]},
  { id: 'IG-20', tag: 'T42 · Trésorerie prévisionnelle', nom: 'Trésorerie prévisionnelle', prix: '29 €', vues: [
    { t: 'Le creux de trésorerie se voit souvent trop tard.' },
    { t: 'Encaissements et décaissements prévus, ponctuels ou récurrents.', img: 'templates-tresorerie-tableau.webp' },
    { t: 'Le réalisé saisi en regard du prévu : le solde se recalcule.', img: 'templates-tresorerie-pointage.webp' },
    { t: 'Trois scénarios et un seuil d\'alerte : le mois à surveiller saute aux yeux.', img: 'templates-tresorerie-tel.webp' },
  ]},
  { id: 'IG-32', tag: 'Sur mesure', sur: true, vues: [
    { t: 'Cinq questions avant de choisir un logiciel.' },
    { t: '① Quel problème précis doit-il régler ?\n② Qui va le remplir, et où : bureau, terrain, téléphone ?' },
    { t: '③ Qu\'est-ce qui doit déclencher une alerte ?\n④ Avec quels outils doit-il échanger ?' },
    { t: '⑤ Que deviennent vos données si vous arrêtez ?' },
  ]},
  { id: 'IG-21', tag: 'T15 · Organisateur de mariage', nom: 'Organisateur de mariage', prix: '29 €', vues: [
    { t: 'Un mariage, c\'est un projet. Sans l\'outil.' },
    { t: 'Un rétroplanning de 40 tâches calculé depuis la date. Elle change ? Tout se recale.', img: 'templates-mariage-tel.webp' },
    { t: 'Le budget poste par poste : prévu, engagé, payé, acomptes et soldes.', img: 'templates-mariage-budget.webp' },
    { t: 'Invités, réponses, régimes, puis le plan de table au glisser-déposer.', img: 'templates-mariage-tables.webp' },
  ]},
  { id: 'IG-33', tag: 'Sur mesure', sur: true, cta: 'On chiffre après avoir compris votre façon de travailler.', vues: [
    { t: 'Ce qui fait le prix d\'un outil sur mesure.' },
    { t: 'Le nombre d\'écrans et de règles métier : calculs, alertes, statuts.' },
    { t: 'Qui l\'utilise : une personne ou une équipe, avec des droits différents.' },
    { t: 'Ce qu\'il doit relier : documents à produire, imports, autres logiciels.' },
  ]},
];
