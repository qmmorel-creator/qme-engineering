#!/usr/bin/env python3
"""Construit publications-2.html (carrousels IG-06 à IG-33 et stories des templates) et les fiches
instagram.md, au gabarit des carrousels publiés (IG-04, IG-05 : template ; IG-28 : sur mesure).

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/construire_ig_06_33.py
  node docs/templates/communication/instagram/rendre.mjs publications-2.html

Sources des faits : <template>/linkedin.md (templates) ; Google Docs LinkedIn LI-03, LI-24, LI-46,
LI-51, LI-72 (sur mesure). Prix : Gumroad le 13/11/2026 pour les templates en vente ; IDEES.md pour les
autres (fiche Gumroad pas encore en ligne).
"""
import html
import pathlib
import re

ICI = pathlib.Path(__file__).resolve().parent
COMM = ICI.parent
A = '../../../../assets/'

# ---------------------------------------------------------------- templates
# v3 et v4 : (sourcil, titre, capture, [points], note) ; points en HTML (<b>…</b>).
T = [
 dict(id='IG-06', slug='tjm', dossier='tjm', nom='Calculateur de TJM', titre='T40 · Calculateur TJM freelance',
  date='22/11/2026', li='LI-77', li_date='21/11', prix=12, gumroad=True, couleur='Indépendants',
  h1='<mark>Votre TJM</mark> paie-t-il votre salaire ?', sous="Un TJM se calcule à l'envers.",
  p2=("Beaucoup de freelances fixent leur TJM en regardant celui des autres.",
      "Puis découvrent en fin d'année que leurs jours facturés ne suffisent pas."),
  v3=('Calculateur de TJM', 'Du revenu visé au TJM.', 'tjm-objectif', [
      "<b>Revenu voulu, frais, cotisations</b>, divisés par les jours vraiment facturés.",
      "<b>Jours ouvrés calculés</b>, fériés retirés (Pâques, Ascension, Pentecôte compris).",
      "<b>Micro-entreprise ou société</b> : BIC, BNC, Cipav, ou SASU / EURL avec votre taux."], 'Données fictives'),
  v4=('Trois scénarios', 'Micro ou société ? Plus ou moins ?', 'tjm-scenarios', [
      "<b>TJM minimum et TJM conseillé</b> pour chaque scénario.",
      "<b>Alertes</b> : plafond de la micro-entreprise, seuils de la franchise de TVA."],
      "Outil d'aide, pas un conseil · données fictives"),
  demo='trois scénarios fictifs', plus="Relié à votre facturation ou à votre suivi des temps",
  story="Partir du revenu visé, pas du tarif des autres.",
  legende="""Votre TJM paie-t-il vraiment votre salaire ?

Beaucoup de freelances fixent leur tarif en regardant celui des autres. Un TJM se calcule à l'envers : le revenu que vous voulez vous verser, plus les frais et les cotisations, divisé par les jours que vous facturerez vraiment.

Le Calculateur de TJM :
▪ calcule les jours ouvrés de l'année, fériés retirés, puis retire congés, prospection et administratif ;
▪ gère la micro-entreprise (BIC, BNC, Cipav) ou la société avec votre propre taux de charges ;
▪ donne un TJM minimum et un TJM conseillé, et compare trois scénarios côte à côte.

Taux 2026 intégrés avec leur source, modifiables. C'est un outil d'aide, pas un conseil : il ne remplace pas un expert-comptable. Achat unique, 12 €.

Besoin de le relier à votre facturation ou à votre suivi des temps ? Je construis la version sur mesure.

Démo libre avec trois scénarios fictifs, et contact : lien en bio.

#Freelance #TJM #MicroEntreprise #Indépendant #OutilsSurMesure"""),

 dict(id='IG-07', slug='micro-entreprise', dossier='micro-entreprise', nom='Livre recettes-dépenses',
  titre='T41 · Livre recettes-dépenses micro-entreprise', date='24/11/2026', li='LI-78', li_date='23/11',
  prix=25, gumroad=True, couleur='Indépendants',
  h1='Déclaration URSSAF : <mark>le montant</mark> est prêt.', sous='Le livre des recettes, tenu au fil des encaissements.',
  p2=("Fin de trimestre : le carnet, le relevé bancaire et trois tableurs pour retrouver son chiffre d'affaires.",
      "Il y a plus simple."),
  v3=('Livre recettes-dépenses', 'Chaque recette en quelques secondes.', 'micro-entreprise-recettes', [
      "<b>Date, client, nature, montant, règlement</b> et référence de la pièce.",
      "<b>Rangée par activité</b> : vente, services, libéral.",
      "<b>Export CSV</b> et livre des recettes imprimable."], 'Données fictives'),
  v4=('À chaque échéance', 'Le chiffre à déclarer, prêt.', 'micro-entreprise-declarations', [
      "<b>Mensuelle ou trimestrielle</b> : chiffre d'affaires et estimation des cotisations.",
      "<b>Plafonds et seuils de TVA</b> suivis toute l'année, alerte avant de les atteindre."],
      "Outil d'aide, pas un logiciel comptable · données fictives"),
  demo='un atelier fictif', plus="Relié à vos devis et à vos factures",
  story="Le chiffre d'affaires à déclarer, prêt à chaque échéance.",
  legende="""Déclaration URSSAF : et si le montant était déjà prêt ?

En micro-entreprise, le livre des recettes est obligatoire. Beaucoup le tiennent sur papier ou dans un tableur, et refont les totaux à chaque déclaration.

Le Livre recettes-dépenses :
▪ note chaque recette en quelques secondes, avec sa date, son client, sa nature et son mode de règlement ;
▪ prépare, à chaque échéance mensuelle ou trimestrielle, le chiffre d'affaires à déclarer et une estimation des cotisations ;
▪ suit les plafonds du régime et les seuils de franchise de TVA, avec une alerte avant de les atteindre.

Taux 2026 sourcés et modifiables, export CSV, livre imprimable. Ce n'est pas un logiciel comptable : c'est un outil d'aide. Achat unique, 25 €.

Besoin de le relier à vos devis et à vos factures ? Je construis la version sur mesure.

Démo libre avec un atelier fictif, et contact : lien en bio.

#MicroEntreprise #AutoEntrepreneur #Indépendant #Freelance #OutilsSurMesure"""),

 dict(id='IG-08', slug='budget-commun', dossier='budget-commun', nom='Budget commun',
  titre='T65 · Budget commun couple / colocation', date='26/11/2026', li='LI-79', li_date='25/11',
  prix=15, gumroad=True, couleur='Maison', prix_txt='15 € · tout le foyer',
  h1='Qui doit <mark>combien</mark> à qui ?', sous='Partager les dépenses à deux, à trois ou en famille.',
  p2=("« Je t'ai fait un virement pour les courses… ou c'était pour l'électricité ? »",
      "Les comptes communs tiennent souvent dans une note de téléphone."),
  v3=('Budget commun', "Chacun note ce qu'il paie.", 'budget-commun-depenses', [
      "<b>Parts égales, prorata des revenus, parts ou montants exacts</b>, au centime près.",
      "<b>Loyer, énergie, abonnements</b> ajoutés chaque mois avec la bonne répartition.",
      "<b>Une clé pour le foyer</b> : chacun l'ouvre sur son téléphone."], 'Données fictives'),
  v4=('Les soldes', 'Le moins de virements possible.', 'budget-commun-soldes', [
      "<b>Soldes à jour</b> : qui doit combien à qui.",
      "<b>Nombre minimal de virements</b> pour remettre les comptes à zéro."],
      'Pas de connexion bancaire · données fictives'),
  demo='un couple fictif', plus="Une association, un club, vos propres règles de partage",
  story="Qui doit combien à qui, sans discussion.",
  legende="""Qui doit combien à qui ? Sans tableur ni discussion.

Partager à parts égales, c'est simple. Dès qu'on tient compte des revenus de chacun, d'un enfant ou d'une chambre plus grande, le tableur devient vite une source de discussions.

Le Budget commun :
▪ répartit chaque dépense à parts égales, au prorata des revenus, en parts ou en montants exacts, au centime près ;
▪ tient les soldes à jour et calcule le nombre minimal de virements pour remettre les comptes à zéro ;
▪ ajoute chaque mois le loyer, l'énergie et les abonnements avec la bonne répartition.

Une seule clé pour le foyer, chacun sur son téléphone. Pas de connexion bancaire, pas d'abonnement : achat unique, 15 €.

Une association, un club, d'autres règles de partage ? Je construis la version sur mesure.

Démo libre avec un couple fictif, et contact : lien en bio.

#BudgetCommun #Colocation #BudgetFamilial #Organisation #OutilsSurMesure"""),

 dict(id='IG-09', slug='gantt', dossier='gantt', nom='Planning Gantt rapide', titre='T02 · Planning Gantt rapide',
  date='28/11/2026', li='LI-80', li_date='27/11', prix=45, gumroad=True, couleur='Travail',
  h1='Une date bouge. <mark>Tout</mark> se recale.', sous='Un planning Gantt qui se tape en une ligne par tâche.',
  p2=("Un planning tenu dans un tableur, c'est une date qui bouge et vingt cellules à reprendre.",
      "Sans oublier le jour férié du mois prochain."),
  v3=('Planning Gantt rapide', 'Une ligne par tâche.', 'gantt-gantt', [
      "<b>« Pose des meubles 12/12 3j après 7 »</b> crée la tâche, sa barre et son lien.",
      "<b>Dates recalculées</b> en jours ouvrés, jours fériés français compris.",
      "<b>Douze modèles</b> : rénovation, construction, déménagement, site web…"], 'Données fictives'),
  v4=('Chemin critique', 'Ce qui décale la fin.', 'gantt-critique', [
      "<b>Tâches critiques</b> en évidence, et la marge des autres.",
      "<b>Avancement face au prévu</b>, planning de référence, impression A3."], 'Données fictives'),
  demo='quatre plannings fictifs', plus="Plusieurs chantiers, vos équipes, vos ressources",
  story="Une ligne par tâche, les dates se recalculent seules.",
  legende="""Une date bouge. Et tout le planning se recale.

Entre le tableur, qui ne calcule rien, et le logiciel de planification, long à prendre en main, il manquait un outil simple pour les artisans, les PME et les chefs de projet.

Le Planning Gantt rapide :
▪ crée une tâche, sa barre et son lien en une ligne : « Pose des meubles 12/12 3j après 7 » ;
▪ recalcule les dates en jours ouvrés, jours fériés français compris ;
▪ calcule le chemin critique : les tâches qui décalent la fin du projet, et la marge des autres.

Suivi de l'avancement, planning de référence, impression A3, douze modèles pour démarrer. Achat unique, 45 €.

Plusieurs chantiers, vos équipes, vos ressources ? Je construis la version sur mesure.

Démo libre avec quatre plannings fictifs, et contact : lien en bio.

#GestionDeProjet #Planning #BTP #PME #OutilsSurMesure"""),

 dict(id='IG-10', slug='taches', dossier='taches', nom='Gestionnaire de tâches', titre='T03 · Gestionnaire de tâches',
  date='30/11/2026', li='LI-81', li_date='29/11', prix=19, gumroad=True, couleur='Travail',
  h1='Quoi faire <mark>ce matin</mark> ?', sous='Noter vite, trier, choisir 3 à 5 tâches.',
  p2=("Une liste de tâches qui ne fait que s'allonger ne dit pas quoi faire ce matin.",
      "Elle dit seulement qu'on est en retard."),
  v3=('Gestionnaire de tâches', 'Noter, trier, choisir.', 'taches-triage', [
      "<b>Une ligne</b> : « Appeler la banque demain 14h !haute #Perso 30min ».",
      "<b>Trier</b> : urgent ou pas, important ou pas.",
      "<b>Choisir</b> 3 à 5 tâches au focus, le temps prévu face au temps disponible."], 'Données fictives'),
  v4=("Aujourd'hui", 'Une journée qui se clôt.', 'taches-aujourdhui', [
      "<b>Le soir</b> : on reporte, on archive, la journée est close.",
      "<b>Répétitions fiables</b> : « le 31 » tombe le 30 les mois courts."],
      "Outil personnel, pas logiciel d'équipe · données fictives"),
  demo='des tâches fictives', plus="Pour une équipe, avec vos rôles et vos validations",
  story="Chaque jour, quelques tâches au focus.",
  legende="""Une liste qui s'allonge ne dit pas quoi faire ce matin.

Le problème n'est pas de noter les tâches. C'est de choisir, chaque jour, celles qui comptent vraiment, sans perdre le reste de vue.

Le Gestionnaire de tâches, autour de trois gestes :
▪ noter vite : « Appeler la banque demain 14h !haute #Perso 30min » donne la date, l'heure, la priorité, le projet et la durée ;
▪ trier : urgent ou pas, important ou pas, un élément après l'autre ;
▪ choisir : 3 à 5 tâches au focus, avec le temps prévu face au temps disponible.

Des répétitions fiables et cinq modèles de projets. C'est un outil personnel, pas un logiciel d'équipe. Achat unique, 19 €.

Pour une équipe, avec vos rôles et vos validations ? Je construis la version sur mesure.

Démo libre avec des tâches fictives, et contact : lien en bio.

#Organisation #Productivité #GestionDuTemps #Freelance #OutilsSurMesure"""),

 dict(id='IG-11', slug='budget', dossier='budget', nom='Budget du foyer', titre='T05 · Budget du foyer',
  date='02/12/2026', li='LI-82', li_date='01/12', prix=15, gumroad=True, couleur='Maison',
  h1="Où est passé <mark>l'argent</mark> ce mois-ci ?", sous='Le prévu face au réel, et le trajet de chaque euro.',
  p2=("Un relevé bancaire liste les dépenses une par une.",
      "Il ne dit pas si vous restez dans ce que vous aviez prévu."),
  v3=('Budget du foyer', 'Des enveloppes par catégorie.', 'budget-enveloppes', [
      "<b>Une enveloppe par catégorie</b>, reste reporté d'un mois sur l'autre.",
      "<b>Prévu face au réel</b> : les enveloppes dépassées sont signalées.",
      "<b>22 catégories, 75 sous-catégories</b>, quatre modèles de foyer."], 'Données fictives'),
  v4=("Le trajet de l'argent", 'Des revenus à chaque catégorie.', 'budget-flux', [
      "<b>Diagramme des flux</b> : besoins, envies, épargne, puis chaque catégorie.",
      "<b>Repère 50/30/20</b> affiché pour comparer, pas comme une règle."],
      'Pas de connexion à la banque · données fictives'),
  demo='un foyer fictif', plus="Une association, un petit commerce, vos propres catégories",
  story="Le trajet de chaque euro, d'un seul regard.",
  legende="""Où est passé l'argent ce mois-ci ?

Un relevé bancaire liste les dépenses une par une. Il ne dit ni si vous restez dans ce que vous aviez prévu, ni quelle part de ce qui rentre part en loyer, en courses ou en épargne.

Le Budget du foyer :
▪ des enveloppes par catégorie, avec report du reste d'un mois sur l'autre ;
▪ le prévu face au réel, avec les enveloppes dépassées signalées dès qu'elles le sont ;
▪ un diagramme des flux : chaque mois, le trajet de l'argent des revenus vers chaque catégorie.

22 catégories, 75 sous-catégories, quatre modèles de foyer. Pas de connexion à la banque : vous saisissez vos montants. Achat unique, 15 €.

Une association, un petit commerce, vos propres catégories ? Je construis la version sur mesure.

Démo libre avec un foyer fictif, et contact : lien en bio.

#Budget #BudgetFamilial #Organisation #Maison #OutilsSurMesure"""),

 dict(id='IG-12', slug='visa', dossier='visa', nom='Circuit de visa', titre='T24 · Circuit de visa des documents',
  date='04/12/2026', li='LI-83', li_date='03/12', prix=39, gumroad=False, couleur='BTP · maîtrise d\'œuvre',
  h1='Qui relancer <mark>ce matin</mark> ?', sous='Le circuit de visa des documents, suivi par lot.',
  p2=("Un plan d'exécution qui attend son visa trois semaines, c'est rarement un problème technique.",
      "C'est souvent une relance que personne n'a envoyée."),
  v3=('Circuit de visa', 'Un registre par lot.', 'visa-registre', [
      "<b>Indice, réception, échéance</b>, avis de chaque viseur (VSO, VAO, REF).",
      "<b>Échéances calculées</b> avec les délais de votre marché.",
      "<b>Relances du jour</b>, message déjà rédigé, prêt à copier."], 'Données fictives'),
  v4=('Tableau de bord', 'Les délais tenus ?', 'visa-bord', [
      "<b>Délai moyen de visa</b> face au délai contractuel.",
      "<b>Part de documents visés sans observation</b> dès le premier indice."], 'Données fictives'),
  demo='trois opérations fictives', plus="Relié à votre GED, vos mails ou vos autres registres",
  story="Le registre des visas qui dit qui relancer.",
  legende="""Un plan qui attend son visa trois semaines ? Souvent, c'est une relance que personne n'a envoyée.

Avec dix lots, quatre viseurs et des dizaines de documents à différents indices, le suivi des visas déborde vite du tableur.

Le Circuit de visa :
▪ un registre par lot : indice, réception, échéance, avis de chaque viseur (VSO, VAO, REF) ;
▪ des échéances calculées avec les délais de votre marché, calendaires ou ouvrés ;
▪ chaque matin, qui relancer, avec le message de relance déjà rédigé.

Un tableau de bord suit le délai moyen face au délai contractuel. Export CSV, impression. Achat unique, 39 €.

Relié à votre GED, vos mails ou vos autres registres ? Je construis la version sur mesure.

Démo libre avec trois opérations fictives, et contact : lien en bio.

#BTP #MaîtriseDŒuvre #Chantier #GestionDeProjet #OutilsSurMesure"""),

 dict(id='IG-13', slug='non-conformites', dossier='non-conformites', nom='Registre des non-conformités',
  titre='T25 · Registre des non-conformités', date='06/12/2026', li='LI-84', li_date='04/12', prix=20,
  gumroad=False, couleur='Qualité · BTP et industrie',
  h1='Le même écart, <mark>trois fois</mark> ?', sous="De la non-conformité à la vérification d'efficacité.",
  p2=("Dans beaucoup de registres, on note l'écart, parfois l'action, rarement la cause.",
      "Presque jamais la vérification."),
  v3=('Registre des non-conformités', 'Du constat à la cause.', 'non-conformites-fiche', [
      "<b>Constat en 30 secondes</b>, sur le terrain, depuis le téléphone.",
      "<b>5 pourquoi guidés</b>, cause racine classée en 6M.",
      "<b>Actions puis vérification</b> : si l'action n'a pas marché, retour à l'analyse."], 'Données fictives'),
  v4=('Indicateurs', 'Prêts pour la revue.', 'non-conformites-indicateurs', [
      "<b>Ouvertes, en retard, délai moyen de clôture</b>.",
      "<b>Répartition par cause et par gravité</b>, export CSV, fiche imprimable."], 'Données fictives'),
  demo="un an d'historique fictif", plus="Vos procédures, vos audits, vos modèles de fiches",
  story="De l'écart à la vérification, sans rien perdre.",
  legende="""Le même écart revient trois fois avant qu'on se demande vraiment pourquoi.

Dans beaucoup de PME, le registre des non-conformités note l'écart, parfois l'action, rarement la cause, presque jamais la vérification.

Le Registre des non-conformités :
▪ le constat se saisit en 30 secondes, sur le terrain, depuis le téléphone ;
▪ la cause se cherche avec les 5 pourquoi guidés, puis se classe en 6M ;
▪ les actions sont suivies, puis une vérification d'efficacité décide de la clôture.

Grille de gravité, dix types d'écarts (BTP et industrie), indicateurs prêts pour la revue de direction. Achat unique, 20 €.

Vos procédures, vos audits, vos modèles de fiches ? Je construis la version sur mesure.

Démo libre avec un an d'historique fictif, et contact : lien en bio.

#Qualité #BTP #Industrie #PME #OutilsSurMesure"""),

 dict(id='IG-14', slug='crm', dossier='crm', nom='CRM freelance', titre='T28 · CRM freelance',
  date='08/12/2026', li='LI-85', li_date='07/12', prix=25, gumroad=False, couleur='Indépendants',
  h1="Qui relancer <mark>aujourd'hui</mark> ?", sous='Un CRM simple pour qui travaille seul.',
  p2=("Le devis envoyé il y a dix jours, le client qui devait rappeler, la facture d'octobre.",
      "Tout est quelque part, rien ne remonte au bon moment."),
  v3=('CRM freelance', 'Une prochaine action par contact.', 'crm-jour', [
      "<b>Chaque matin</b> : qui relancer, retards en tête.",
      "<b>« Fait »</b> : l'échange est noté, l'action suivante proposée.",
      "<b>Six étapes de vente, quatorze actions types</b>, chacune avec un délai."], 'Données fictives'),
  v4=('Devis et factures', 'Ce qui reste à encaisser.', 'crm-chiffres', [
      "<b>Échéances, encaissements, retards</b> suivis.",
      "<b>Chiffre d'affaires</b> par mois et par client."],
      'Pas un logiciel de facturation · données fictives'),
  demo='des clients fictifs', plus="Pour une équipe, relié à votre facturation ou à vos mails",
  story="La relance qu'on n'oublie plus.",
  legende="""Le devis envoyé il y a dix jours : quelqu'un l'a relancé ?

Quand on travaille seul, le suivi commercial vit dans la boîte mail, un carnet et un tableur. Tout est quelque part, rien ne remonte au bon moment.

Le CRM freelance :
▪ une prochaine action datée par contact, et chaque matin la liste de qui relancer ;
▪ après un échange, un clic sur « Fait » : il est noté et l'action suivante est proposée ;
▪ devis et factures suivis, avec le chiffre d'affaires par mois et par client.

Six étapes de vente et quatorze actions types. Ce n'est pas un logiciel de facturation : il en suit le paiement. Achat unique, 25 €.

Pour une équipe, relié à votre facturation ou à vos mails ? Je construis la version sur mesure.

Démo libre avec des clients fictifs, et contact : lien en bio.

#Freelance #Indépendant #Prospection #Entrepreneur #OutilsSurMesure"""),

 dict(id='IG-15', slug='flotte', dossier='flotte', nom='Gestion de flotte', titre='T29 · Gestion de flotte de véhicules',
  date='10/12/2026', li='LI-86', li_date='09/12', prix=39, gumroad=False, couleur='PME et collectivités',
  h1='Aucune échéance <mark>oubliée</mark>.', sous='Entretiens, contrôles, amendes, réservations.',
  p2=("Quelques véhicules suffisent pour multiplier les dates à surveiller.",
      "Entretien, contrôle technique, amende à désigner dans les délais."),
  v3=('Gestion de flotte', "Une seule liste d'alertes.", 'flotte-bord', [
      "<b>Retards en tête</b> : entretien dû, contrôle technique, contre-visite, amende, sinistre.",
      "<b>Entretien au premier critère</b> atteint, kilomètres ou date.",
      "<b>Réservations</b> sans chevauchement, kilométrage au retour."], 'Données fictives'),
  v4=('Coûts', 'Combien coûte chaque kilomètre ?', 'flotte-couts', [
      "<b>Coût total et coût au kilomètre</b> de chaque véhicule.",
      "<b>Location longue durée</b> : projection en fin de contrat, dépassement estimé."],
      "Intervalles d'entretien indicatifs · données fictives"),
  demo='six véhicules fictifs', plus="Vos engins, vos habilitations, vos cartes carburant",
  story="Toutes les échéances de vos véhicules, retards en tête.",
  legende="""Contrôle technique, entretien, amende à désigner : qui suit les dates ?

Quelques véhicules suffisent pour multiplier les échéances : entretien au kilomètre ou à la date, contrôle technique, contre-visite, amendes à désigner dans les délais.

La Gestion de flotte :
▪ une seule liste d'alertes, retards en tête ;
▪ des réservations par véhicule, sans chevauchement, avec le kilométrage au retour ;
▪ le coût total et le coût au kilomètre, et pour la location longue durée le dépassement estimé.

Règles du contrôle technique et délai de désignation datés depuis les sites officiels. Intervalles d'entretien indicatifs. Achat unique, 39 €.

Vos engins, vos habilitations, vos cartes carburant ? Je construis la version sur mesure.

Démo libre avec six véhicules fictifs, et contact : lien en bio.

#GestionDeFlotte #PME #Collectivités #Organisation #OutilsSurMesure"""),

 dict(id='IG-16', slug='planner', dossier='planner', nom='Planner horaire', titre='T30 · Planner horaire time-blocking',
  date='12/12/2026', li='LI-87', li_date='13/12', prix=15, gumroad=False, couleur='Travail',
  h1='Prévu, <mark>réalisé</mark> : l\'écart.', sous='Une semaine en blocs de 30 minutes.',
  p2=("Donner à chaque heure de la semaine une destination, c'est facile.",
      "Voir l'écart avec la réalité, beaucoup moins."),
  v3=('Planner horaire', 'La semaine en blocs.', 'planner-semaine', [
      "<b>Grille de 30 minutes</b>, blocs posés et déplacés au glisser-déposer.",
      "<b>Saisi une fois</b> : ce qui revient chaque semaine.",
      "<b>Chaque bloc en un geste</b> : fait, raccourci, déplacé, pas fait."], 'Données fictives'),
  v4=('Le bilan', 'Ce qui a vraiment eu lieu.', 'planner-bilan', [
      "<b>Prévu face au réalisé</b> par catégorie, taux de réalisation.",
      "<b>Tendance sur six semaines</b> ; semaines types cadre, freelance, étudiant."], 'Données fictives'),
  demo="la semaine d'une freelance fictive", plus="Le planning d'une équipe, avec vos contraintes",
  story="Le prévu face au réalisé, chaque semaine.",
  legende="""Prévoir sa semaine, c'est facile. Voir l'écart avec la réalité, beaucoup moins.

Le time blocking donne à chaque heure de la semaine une destination : travail de fond le matin, messages regroupés, sport deux soirs.

Le Planner horaire :
▪ une grille de 30 minutes où les blocs se posent et se déplacent au glisser-déposer ;
▪ chaque bloc se marque en un geste : fait, raccourci, déplacé ou pas fait ;
▪ le bilan compare le prévu et le réalisé par catégorie, avec la tendance des six dernières semaines.

Trois semaines types (cadre, freelance, étudiant), et toute semaine peut devenir un modèle. Achat unique, 15 €.

Le planning d'une équipe, avec vos contraintes ? Je construis la version sur mesure.

Démo libre avec la semaine d'une freelance fictive, et contact : lien en bio.

#Productivité #Organisation #GestionDuTemps #Freelance #OutilsSurMesure"""),

 dict(id='IG-17', slug='reserves', dossier='reserves', nom='Levée de réserves', titre='T32 · Levée de réserves (OPR)',
  date='14/12/2026', li='LI-88', li_date='11/12', prix=39, gumroad=False, couleur='BTP · réception',
  h1='Chaque réserve <mark>levée</mark>, jusqu\'au bout.', sous='Des OPR au procès-verbal de levée.',
  p2=("Des dizaines de réserves, plusieurs bâtiments, dix entreprises.",
      "Et une liste recopiée à chaque visite."),
  v3=('Levée de réserves', 'Saisie pendant la visite.', 'reserves-reserves', [
      "<b>Sur téléphone</b> : bâtiment, niveau, local, lot, entreprise, numéro automatique.",
      "<b>Cycle daté</b> : levée, contrôle, refus motivé, nouvelle échéance.",
      "<b>Retards calculés</b> avec vos propres délais."], 'Données fictives'),
  v4=('Par entreprise', 'Le PV, prêt à imprimer.', 'reserves-pv', [
      "<b>Tableau de bord</b> par entreprise et par lot.",
      "<b>Liste des réserves à lever</b> ou procès-verbal de levée, export CSV."], 'Données fictives'),
  demo='une résidence fictive', plus="Photos, plans, vos modèles de procès-verbaux",
  story="Chaque réserve suivie jusqu'à sa levée.",
  legende="""Des dizaines de réserves, dix entreprises, et une liste recopiée à chaque visite.

Une réserve suit toujours le même chemin : constatée, reprise, contrôlée, acceptée ou refusée. Le problème, c'est le volume.

La Levée de réserves :
▪ la saisie pendant la visite, sur téléphone : bâtiment, niveau, local, lot, entreprise ;
▪ le cycle complet daté : levée, contrôle, refus motivé avec une nouvelle échéance ;
▪ un tableau de bord par entreprise et par lot, et le procès-verbal de levée prêt à imprimer.

Retards calculés avec vos propres délais, export CSV. Achat unique, 39 €.

Photos, plans, vos modèles de procès-verbaux ? Je construis la version sur mesure.

Démo libre avec une résidence fictive, et contact : lien en bio.

#BTP #Chantier #ConducteurDeTravaux #MaîtriseDŒuvre #OutilsSurMesure"""),

 dict(id='IG-18', slug='prospection', dossier='prospection', nom='Pipeline de prospection',
  titre='T35 · Pipeline de prospection B2B', date='16/12/2026', li='LI-89', li_date='15/12', prix=25,
  gumroad=False, couleur='Indépendants · B2B',
  h1='Les relances <mark>du jour</mark>, sans y penser.', sous='Un pipeline de prospection volontairement simple.',
  p2=("Quand on prospecte seul, tout tient dans un tableur et dans sa tête.",
      "Les relances glissent, et on réécrit le même message à chaque fois."),
  v3=('Pipeline de prospection', 'De « À contacter » à « Gagné ».', 'prospection-pipeline', [
      "<b>Les prospects avancent par étapes</b>, en glissant une carte.",
      "<b>Relances du jour</b> selon la cadence choisie, retards en tête.",
      "<b>Scripts remplis</b> avec le prénom du prospect, à relire et copier."], 'Données fictives'),
  v4=('Les chiffres', 'Ce que donne chaque canal.', 'prospection-chiffres', [
      "<b>Taux de passage</b> d'une étape à l'autre.",
      "<b>Rien n'est automatisé</b> : vous envoyez vous-même."], 'Données fictives'),
  demo='des prospects fictifs', plus="Pour une équipe commerciale, relié à vos mails",
  story="Les relances du jour, prêtes à envoyer.",
  legende="""Prospecter seul : les relances glissent.

Quand on prospecte seul, tout tient dans un tableur et dans sa tête. On oublie qui relancer, et on réécrit le même message de zéro à chaque fois.

Le Pipeline de prospection :
▪ les prospects avancent par étapes, de « À contacter » à « Gagné » ;
▪ chaque matin, les relances du jour selon la cadence choisie, retards en tête ;
▪ pour chaque relance, un script rempli avec le prénom du prospect, à relire et copier.

Trois cadences types, dix-neuf scripts. Rien n'est automatisé : vous envoyez vous-même, et les personnes qui ne veulent plus être contactées sont mises de côté en un clic. Achat unique, 25 €.

Pour une équipe commerciale, relié à vos mails ? Je construis la version sur mesure.

Démo libre avec des prospects fictifs, et contact : lien en bio.

#Prospection #B2B #Indépendant #Entrepreneur #OutilsSurMesure"""),

 dict(id='IG-19', slug='devis', dossier='devis', nom='Générateur de devis', titre='T36 · Générateur de devis',
  date='18/12/2026', li='LI-90', li_date='17/12', prix=29, gumroad=False, couleur='Artisans et indépendants',
  h1='Des totaux justes <mark>au centime</mark>.', sous='Un générateur de devis, pas un ancien devis modifié.',
  p2=("Beaucoup de devis partent d'un ancien devis modifié.",
      "Jusqu'au jour où une ligne a changé, mais pas le total."),
  v3=('Générateur de devis', 'Des lignes, des totaux justes.', 'devis-edition', [
      "<b>Catalogue de prestations</b> : unité, prix HT, TVA. Les prix, c'est vous.",
      "<b>Sections, remises, TVA par ligne</b>, acompte, durée de validité.",
      "<b>Totaux calculés en centimes</b>, la TVA par taux."], 'Données fictives'),
  v4=("Avant l'envoi", 'Rien ne manque.', 'devis-apercu', [
      "<b>Mentions relevées sur les sites officiels</b>, contrôle avant l'envoi.",
      "<b>Numéro et statut</b> automatiques, impression A4 ou PDF."],
      'Des devis, pas des factures · données fictives'),
  demo='huit devis fictifs', plus="Votre bibliothèque d'ouvrages, vos métrés, vos modèles",
  story="Des devis aux totaux justes, mentions vérifiées.",
  legende="""Un ancien devis modifié… et un total qui n'a pas suivi.

Beaucoup d'artisans et de freelances font leurs devis à partir d'un ancien devis. Ça marche, jusqu'au jour où une ligne a changé, mais pas le total.

Le Générateur de devis :
▪ un catalogue de prestations (unité, prix HT, TVA) : les prix, c'est vous ;
▪ des devis par lignes et sections, remises, TVA par ligne, acompte ; totaux calculés en centimes ;
▪ les mentions d'un devis relevées sur les sites officiels, avec un contrôle de ce qui manque avant l'envoi.

Il fait des devis, pas des factures. Chacun reste responsable des mentions propres à son activité. Achat unique, 29 €.

Votre bibliothèque d'ouvrages, vos métrés, vos modèles ? Je construis la version sur mesure.

Démo libre avec huit devis fictifs, et contact : lien en bio.

#Artisan #Devis #Freelance #Indépendant #OutilsSurMesure"""),

 dict(id='IG-20', slug='tresorerie', dossier='tresorerie', nom='Trésorerie prévisionnelle',
  titre='T42 · Trésorerie prévisionnelle 12 mois', date='20/12/2026', li='LI-91', li_date='19/12', prix=29,
  gumroad=False, couleur='TPE et indépendants',
  h1='Voir le creux <mark>avant</mark> qu\'il arrive.', sous='Une trésorerie prévisionnelle sur 12 mois.',
  p2=("Un achat de matériel, une échéance annuelle, un client qui paie en retard.",
      "Le même mois. Et le découvert arrive sans prévenir."),
  v3=('Trésorerie prévisionnelle', "Douze mois d'avance.", 'tresorerie-tableau', [
      "<b>Encaissements et décaissements prévus</b>, ponctuels ou récurrents.",
      "<b>Le réalisé en regard du prévu</b> : le solde se recalcule.",
      "<b>37 catégories, 4 profils</b> d'activité pour démarrer."], 'Données fictives'),
  v4=('Trois scénarios', 'Le mois à surveiller.', 'tresorerie-synthese', [
      "<b>Prudent, central, optimiste</b>, avec un seuil d'alerte.",
      "<b>Export CSV</b> pour le tableur ou l'expert-comptable."],
      'Pas un logiciel comptable · données fictives'),
  demo='un atelier fictif', plus="Relié à vos factures et à vos devis signés",
  story="Le creux de trésorerie, vu avant qu'il arrive.",
  legende="""Le creux de trésorerie se voit souvent trop tard.

Un achat de matériel, une échéance annuelle et un client qui paie en retard tombent le même mois, et le découvert arrive sans prévenir.

La Trésorerie prévisionnelle, sur 12 mois glissants :
▪ les encaissements et décaissements prévus, ponctuels ou récurrents ;
▪ le réalisé saisi en regard du prévu : le solde se recalcule avec le réel ;
▪ trois scénarios et un seuil d'alerte : le mois à surveiller apparaît tout de suite.

37 catégories types et 4 profils d'activité pour démarrer. Ce n'est pas un logiciel comptable, et il ne contient aucune échéance fiscale toute faite. Achat unique, 29 €.

Relié à vos factures et à vos devis signés ? Je construis la version sur mesure.

Démo libre avec un atelier fictif, et contact : lien en bio.

#Trésorerie #TPE #Entrepreneur #Indépendant #OutilsSurMesure"""),

 dict(id='IG-21', slug='mariage', dossier='mariage', nom='Organisateur de mariage', titre='T15 · Organisateur de mariage',
  date='30/12/2026', li='LI-92', li_date='29/12', prix=29, gumroad=False, couleur='Maison',
  h1='Un mariage, <mark>c\'est un projet</mark>.', sous='Rétroplanning, budget, invités et plan de table.',
  p2=("Des dizaines de tâches sur un an, une dizaine de prestataires, des invités au compte-gouttes.",
      "C'est de la gestion de projet, sans l'outil."),
  v3=('Organisateur de mariage', 'Tout se recale sur la date.', 'mariage-apercu', [
      "<b>40 tâches</b> calculées depuis la date ; les retards en tête.",
      "<b>Budget poste par poste</b> : prévu, engagé, payé, acomptes et soldes.",
      "<b>Sur les deux téléphones</b> et l'ordinateur, même hors connexion."], 'Données fictives'),
  v4=('Invités', 'Chacun à sa place.', 'mariage-tables', [
      "<b>Réponses et régimes</b> de chaque invité.",
      "<b>Plan de table</b> au glisser-déposer, alerte quand une table déborde."],
      'Aucun prix moyen inventé · données fictives'),
  demo='un mariage fictif', plus="Organisateurs d'événements : vos prestataires, vos clients",
  story="Tout le mariage au même endroit.",
  legende="""Un mariage, c'est un projet. Sans l'outil.

Des dizaines de tâches étalées sur un an, une dizaine de prestataires, des acomptes à des dates différentes, des invités qui répondent au compte-gouttes.

L'Organisateur de mariage :
▪ un rétroplanning de 40 tâches calculé depuis la date : si elle change, tout se recale ;
▪ le budget poste par poste : prévu, engagé, payé, acomptes et soldes compris ;
▪ les invités, leurs réponses et leurs régimes, puis un plan de table au glisser-déposer.

Postes de budget vides : pas de prix moyens inventés, c'est votre budget. Sur les deux téléphones et l'ordinateur, même hors connexion. Achat unique, 29 €.

Organisateur d'événements, avec vos prestataires et vos clients ? Je construis la version sur mesure.

Démo libre avec un mariage fictif, et contact : lien en bio.

#Mariage #Organisation #GestionDeProjet #Événement #OutilsSurMesure"""),
]

# ---------------------------------------------------------------- sur mesure
S = [
 dict(id='IG-29', slug='fiche-arrivee', titre="Sur mesure · La fiche d'arrivée qui évite deux litiges",
  date='29/11/2026', li='LI-03', sourcil='Sur mesure · cas réel',
  h1="La fiche d'arrivée qui évite <mark>deux</mark> litiges.", sous="Un outil d'atelier vélo, dès le dépôt.",
  p2=("« Je vous avais laissé le chargeur. »",
      "« Vous auriez dû m'appeler avant de changer la cassette. »"),
  p2_bas="Tous les ateliers de réparation connaissent ces deux phrases.",
  v3=("À l'arrivée du vélo", 'Tout est noté.', [
      ('carre', 'Ce qui est laissé', "Batterie, chargeur, clé de batterie, antivol, sacoches, siège enfant : case par case.", 'Réponse au chargeur'),
      ('rond', "L'accord sans rappel", "Jusqu'à … € TTC. 150 € proposés par défaut ; à 0 €, « Rappeler avant tout travail ».", 'Réponse à la cassette'),
      ('quart', "L'état au dépôt", "Date et heure, état général, kilométrage obligatoire pour un vélo électrique.", None)],
      'Cas réel, présenté sans aucune donnée du client'),
  v4=('Le détail en plus', 'Le constat, à 0 €.', [
      ('Une ligne non facturée', "« Constat : plaquettes arrière à 30 % », à 0 minute et 0 €."),
      ('Écrite sur la facture', "Sous « Constats de l'atelier » : le client repart avec un conseil écrit."),
      ('La prochaine visite préparée', "L'atelier garde la trace de ce qu'il a signalé.")]),
  v5=('Un client vous confie un objet ?', ['Garagiste, réparateur, cordonnier, retoucheuse', 'Ces deux règles valent aussi pour vous']),
  alt=["Titre « La fiche d'arrivée qui évite deux litiges. » Un outil d'atelier vélo, dès le dépôt.",
       "Fond noir : deux phrases que connaissent tous les ateliers : « Je vous avais laissé le chargeur. » et « Vous auriez dû m'appeler avant de changer la cassette. »",
       "À l'arrivée du vélo : ce qui est laissé coché case par case (batterie, chargeur, antivol…) ; accord du client sans rappel jusqu'à un montant, 150 € par défaut ; date, état et kilométrage. Cas réel, sans donnée du client.",
       "Le constat : une ligne à 0 minute et 0 €, non facturée, écrite sur la facture sous « Constats de l'atelier » ; le client repart avec un conseil, la prochaine visite est préparée.",
       "Fond rouge : un client vous confie un objet ? Garagiste, réparateur, cordonnier, retoucheuse : ces règles valent aussi pour vous. Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""« Je vous avais laissé le chargeur. » « Vous auriez dû m'appeler avant de changer la cassette. »

Tous les ateliers de réparation connaissent ces deux phrases. Dans l'outil d'atelier vélo que j'ai conçu, chacune a sa réponse dès l'arrivée du vélo :

▪ ce qui est laissé avec le vélo se coche case par case : batterie, chargeur, clé de batterie, antivol, sacoches, siège enfant ;
▪ une ligne « Accord du client sans rappel jusqu'à … € TTC », 150 € par défaut ; à 0 €, la fiche affiche « Rappeler avant tout travail » ;
▪ la date et l'heure de dépôt, l'état général et le kilométrage, obligatoire pour un vélo électrique.

Un détail en plus : le constat. « Plaquettes arrière à 30 % », à 0 minute et 0 €. Non facturé, il apparaît sur la facture : le client repart avec un conseil écrit, et la prochaine visite est déjà préparée.

Garagiste, réparateur, cordonnier, retoucheuse : dès qu'un client vous confie un objet, ces règles valent aussi pour vous.

Votre métier a ses règles ? Parlons-en : lien en bio.

#OutilsSurMesure #Artisan #Réparation #RelationClient #PME"""),

 dict(id='IG-30', slug='maintenance-compteur', titre='Sur mesure · Maintenance : au compteur, pas au calendrier',
  date='07/12/2026', li='LI-24', sourcil='Sur mesure · méthode',
  h1='Entretenir <mark>au compteur</mark>, pas au calendrier.', sous='Une machine ne s\'use pas au rythme du calendrier.',
  p2=("« Vidange de la presse tous les six mois. »",
      "Sauf que la presse a tourné 200 heures au premier semestre, et 900 au second."),
  p2_bas="Trop tôt sur une machine peu utilisée, trop tard sur une machine en trois-huit.",
  v3=('Au compteur', 'Le rythme réel de chaque machine.', [
      ('barres', 'Un compteur par équipement', 'Heures de marche, cycles, kilomètres, pièces produites.', None),
      ('rond', 'Un seuil par opération', '500 heures, ou 500 heures ou 12 mois : au premier atteint.', None),
      ('quart', 'Un relevé simple', 'Saisi en fin de poste, ou récupéré automatiquement quand la machine le permet.', None)],
      'Exemple illustratif, données fictives'),
  v4=('Ce que ça change', 'La panne qui n\'arrive pas.', [
      ('Une échéance projetée', '« Vidange dans 60 heures, vers le 18 février. »'),
      ("Des tâches avant l'arrêt", 'Avec les pièces à prévoir.'),
      ('Moins de gaspillage', 'On arrête de changer des filtres encore propres.')]),
  v5=('Vos machines tournent-elles au calendrier ?', ['Un compteur par équipement', 'Un seuil par opération']),
  alt=["Titre « Entretenir au compteur, pas au calendrier. » Une machine ne s'use pas au rythme du calendrier.",
       "Fond noir : « Vidange de la presse tous les six mois. » Sauf que la presse a tourné 200 heures au premier semestre, et 900 au second.",
       "Au compteur : un compteur par équipement (heures, cycles, kilomètres, pièces produites), un seuil par opération avec limite calendaire au premier atteint, un relevé simple. Exemple illustratif.",
       "Ce que ça change : une échéance projetée (« vidange dans 60 heures, vers le 18 février »), des tâches préparées avant l'arrêt, moins de filtres changés encore propres.",
       "Fond rouge : vos machines tournent-elles au calendrier ? Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""« Vidange de la presse tous les six mois. » Sauf que la presse a tourné 200 heures au premier semestre, et 900 au second.

L'entretien au calendrier est simple à suivre. Mais il tombe souvent trop tôt sur une machine peu utilisée, et trop tard sur une machine qui tourne en trois-huit.

Pour un atelier, je construirais plutôt un entretien au compteur :
▪ chaque équipement a le sien : heures de marche, cycles, kilomètres, pièces produites ;
▪ chaque opération a un seuil, avec si besoin une limite calendaire : 500 heures ou 12 mois, au premier atteint ;
▪ le compteur se relève en fin de poste, ou automatiquement quand la machine le permet.

L'outil projette l'échéance (« vidange dans 60 heures, vers le 18 février ») et prépare les tâches avec les pièces, avant l'arrêt. Le bénéfice se voit le jour où la panne n'arrive pas.

Votre métier a ses règles ? Parlons-en : lien en bio.

#OutilsSurMesure #Maintenance #GMAO #Industrie #PME"""),

 dict(id='IG-31', slug='tableur', titre="Sur mesure · Le tableur n'est pas le problème",
  date='15/12/2026', li='LI-46', sourcil='Sur mesure · point de vue',
  h1="Le tableur n'est pas <mark>le problème</mark>.", sous="Je conçois des outils sur mesure. Je ne dis jamais « il faut arrêter le tableur ».",
  p2=("Rapide, souple, tout le monde sait s'en servir : le tableur est un excellent outil.",
      "Les ennuis viennent de ce qu'on lui demande au bout de deux ans."),
  p2_bas=None,
  v3=("Ce qu'on lui demande", "Ce qu'il ne fait pas du tout.", [
      ('carre', 'Être partagé par dix personnes', 'Qui ne doivent pas toutes tout voir.', None),
      ('barres', "Garder l'historique", "De ce qui a changé, et de qui l'a changé.", None),
      ('rond', 'Envoyer, être rempli sur le terrain', 'Une relance, une alerte ; sur un téléphone, au bord d\'un chantier.', None)],
      'Ce sont des personnes qui compensent'),
  v4=('Ma première question', 'Que fait ce tableur que personne ne voit ?', [
      ('Trois ou quatre règles', 'La réponse tient souvent en quelques règles métier.'),
      ('Parfois, garder le tableur', 'Et ajouter seulement ce qui manque.')]),
  v5=('Votre tableur fait-il plus qu\'on ne le croit ?', ["On part de ce qu'il fait aujourd'hui", "Pas du choix d'un logiciel"]),
  alt=["Titre « Le tableur n'est pas le problème. » Je conçois des outils sur mesure, je ne dis jamais « il faut arrêter le tableur ».",
       "Fond noir : rapide, souple, tout le monde sait s'en servir : le tableur est un excellent outil. Les ennuis viennent de ce qu'on lui demande au bout de deux ans.",
       "Ce qu'on lui demande et qu'il ne fait pas du tout : être partagé par dix personnes qui ne doivent pas toutes tout voir, garder l'historique, envoyer une relance, être rempli sur un téléphone.",
       "Ma première question : que fait ce tableur que personne ne voit ? Souvent trois ou quatre règles ; parfois, garder le tableur et ajouter seulement ce qui manque.",
       "Fond rouge : votre tableur fait-il plus qu'on ne le croit ? Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""Je conçois des outils sur mesure. Pourtant, je ne dis jamais « il faut arrêter le tableur ».

Le tableur est un excellent outil : rapide, souple, tout le monde sait s'en servir. Les ennuis viennent de ce qu'on lui demande au bout de deux ans :
▪ être partagé par dix personnes qui ne doivent pas toutes tout voir ;
▪ garder l'historique de ce qui a changé, et de qui l'a changé ;
▪ envoyer une relance, une facture, une alerte ;
▪ être rempli sur un téléphone, au bord d'un chantier ou dans un entrepôt.

Tout ça, un tableur ne le fait pas du tout, et ce sont des personnes qui compensent.

Ma première question n'est donc jamais « quel logiciel ? », mais « qu'est-ce que ce tableur fait aujourd'hui que personne ne voit ? ». Et parfois, le plus sensé est de le garder en ajoutant seulement ce qui manque.

Votre métier a ses règles ? Parlons-en : lien en bio.

#OutilsSurMesure #Tableur #PME #Organisation #Entrepreneur"""),

 dict(id='IG-32', slug='cinq-questions', titre='Sur mesure · Cinq questions avant de choisir un logiciel',
  date='23/12/2026', li='LI-51', sourcil='Sur mesure · méthode',
  h1='Cinq questions avant de choisir un <mark>logiciel</mark>.', sous='Je les pose toujours, avant de parler d\'outil.',
  p2=("1. Qui saisit l'information, et à quel moment ?",
      "2. Où est-elle ressaisie ensuite ?"),
  p2_bas="Chaque ressaisie, c'est une erreur possible et du temps perdu.",
  v3=('Questions 3 et 4', 'Qui la voit, et combien ?', [
      ('barres', '3. Qui doit la voir, et comment ?', 'Le dirigeant veut un chiffre, l\'équipe une liste, le client un état d\'avancement.', None),
      ('carre', '4. Quel est le volume réel ?', 'Dix dossiers par mois ou dix par jour : pas le même outil.', None)],
      None),
  v4=('Question 5', "Qu'est-ce qui doit rester humain ?", [
      ('Un appel, une validation, un geste commercial', "L'outil doit les faciliter, pas les supprimer."),
      ('Parfois, un tableur bien rangé suffit', "Ou un logiciel qui existe déjà. Je cherche l'outil le plus simple qui suffit.")]),
  v5=("L'outil le plus simple qui suffit.", ['Parfois un tableur bien rangé', 'Parfois un logiciel existant', 'Parfois du sur mesure']),
  alt=["Titre « Cinq questions avant de choisir un logiciel. » Je les pose toujours, avant de parler d'outil.",
       "Fond noir : 1. Qui saisit l'information, et à quel moment ? 2. Où est-elle ressaisie ensuite ? Chaque ressaisie, c'est une erreur possible et du temps perdu.",
       "Questions 3 et 4 : qui doit voir l'information, et sous quelle forme ; quel est le volume réel, dix dossiers par mois ou dix par jour.",
       "Question 5 : qu'est-ce qui doit rester humain ? Un appel, une validation, un geste commercial. Parfois, un tableur bien rangé ou un logiciel existant suffit.",
       "Fond rouge : l'outil le plus simple qui suffit : parfois un tableur, parfois un logiciel existant, parfois du sur mesure. Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""Avant de parler de logiciel, je pose toujours les cinq mêmes questions.

1. Qui saisit l'information, et à quel moment ? Au bureau le soir, sur un chantier, au comptoir entre deux clients ?
2. Où est-elle ressaisie ensuite ? Chaque ressaisie, c'est une erreur possible et du temps perdu.
3. Qui doit la voir, et sous quelle forme ? Le dirigeant veut un chiffre, l'équipe une liste, le client un état d'avancement.
4. Quel est le volume réel ? Dix dossiers par mois ou dix par jour, ça ne demande pas le même outil.
5. Qu'est-ce qui doit rester humain ? Un appel, une validation, un geste commercial.

Parfois, ces cinq réponses mènent à un tableur bien rangé, ou à un logiciel qui existe déjà. Tant mieux : je cherche l'outil le plus simple qui suffit.

Votre métier a ses règles ? Parlons-en : lien en bio.

#OutilsSurMesure #Méthode #PME #Organisation #Entrepreneur"""),

 dict(id='IG-33', slug='prix-sur-mesure', titre="Sur mesure · Ce qui fait le prix d'un outil sur mesure",
  date='31/12/2026', li='LI-72', sourcil='Sur mesure · point de vue',
  h1="Ce qui fait <mark>le prix</mark> d'un outil sur mesure.", sous='Ça dépend. Mais on peut dire précisément de quoi.',
  p2=("« Combien coûte un outil sur mesure ? »",
      "Honnêtement, ça dépend. Voici de quoi, dans l'ordre où je le regarde."),
  p2_bas=None,
  v3=('Ce qui fait varier le prix', 'Les utilisateurs, l\'existant, l\'historique.', [
      ('carre', '1. Les utilisateurs et leurs droits', 'Une personne ou trente, avec des rôles et des accès différents.', None),
      ('quart', "2. Les liens avec l'existant", 'Caisse, comptabilité, agenda : selon la qualité de leurs accès.', None),
      ('barres', '3. La reprise des données', 'Partir de zéro ou reprendre dix ans de tableurs.', None)],
      None),
  v4=('Ce qui fait varier le prix', 'Le terrain et les documents.', [
      ('4. Le terrain', 'Un écran de bureau est plus simple qu\'une vue sur téléphone, avec des gants, hors connexion.'),
      ('5. Les documents produits', 'Devis, factures, rapports, étiquettes : chacun a ses règles.')]),
  v5=('Les écrans « au cas où » ne devraient pas peser.', ['On commence par le module qui rapporte le plus vite', 'Les suivants, quand il a fait ses preuves']),
  alt=["Titre « Ce qui fait le prix d'un outil sur mesure. » Ça dépend, mais on peut dire précisément de quoi.",
       "Fond noir : « Combien coûte un outil sur mesure ? » Honnêtement, ça dépend. Voici de quoi, dans l'ordre où je le regarde.",
       "Ce qui fait varier le prix : 1. les utilisateurs et leurs droits ; 2. les liens avec l'existant (caisse, comptabilité, agenda) ; 3. la reprise des données.",
       "4. Le terrain : téléphone, gants, hors connexion. 5. Les documents produits : devis, factures, rapports, étiquettes.",
       "Fond rouge : les écrans « au cas où » ne devraient pas peser sur le prix ; on commence par le module qui rapporte le plus vite. Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""« Combien coûte un outil sur mesure ? » Honnêtement, ça dépend. Mais je peux dire précisément de quoi.

Dans l'ordre où je le regarde :
1. Le nombre de personnes qui s'en servent, et leurs droits.
2. Les liens avec l'existant : lire ou écrire dans une caisse, une comptabilité ou un agenda dépend de la qualité de leurs accès.
3. La reprise des données : partir de zéro ou reprendre dix ans d'historique dans plusieurs tableurs.
4. Le terrain : une vue sur téléphone, avec des gants, hors connexion, au bord d'un chantier.
5. Les documents produits : devis, factures, rapports, étiquettes, chacun avec ses règles.

Le nombre d'écrans « au cas où », en revanche, ne devrait pas peser sur le prix. Je préfère commencer par le module qui rapporte le plus vite, et ajouter les suivants quand le premier a fait ses preuves.

Votre métier a ses règles ? Parlons-en : lien en bio.

#OutilsSurMesure #PME #Budget #Organisation #Entrepreneur"""),
]

COULEURS_COUV = [('bleu', 'rouge'), ('rouge', 'bleu'), ('bleu', 'jaune'), ('rouge', 'jaune')]
MARQUE = ('<div class="pied"><span class="marque"><svg viewBox="0 0 80 80"><use href="#{s}"/></svg>'
          '<span>Q<span class="m"{ms}>M</span><span class="e"{es}>E</span></span></span><span>{url}</span></div>')


def e(s):
    s = html.escape(s, quote=False)
    # Typographie française : pas de coupure avant €, ?, !, :, ; ni dans « … ».
    s = re.sub(r' ([€?!:;»])', '\u00a0\\1', s)
    return s.replace('« ', '«\u00a0')


def couv(pid, slug, sourcil, coul_sourcil, h1, sous, i):
    # Le surlignage ne se coupe pas sur deux lignes.
    h1 = re.sub(r'<mark>(.*?)</mark>', lambda m: '<mark>' + m.group(1).replace(' ', '\u00a0') + '</mark>', h1)
    a, c = COULEURS_COUV[i % len(COULEURS_COUV)]
    return f'''<section class="cadre couv" id="{pid}-{slug}-1">
  <div class="fa" style="background:var(--{a})"></div><div class="fb"></div><div class="fc" style="background:var(--{c})"></div>
  <span class="compteur" style="right:auto;left:84px">1 / 5</span>
  <div class="titre">
    <p class="sourcil" style="color:var(--{coul_sourcil})">{e(sourcil)}</p>
    <h1 style="margin-top:30px;font-size:{104 if len(re.sub('<[^>]+>', '', h1)) > 34 else 112}px">{h1}</h1>
    <p class="sous">{e(sous)}</p>
  </div>
  <p class="glisser">Faites glisser <span></span></p>
</section>'''


def probleme(pid, slug, p2, bas, forme):
    t, em = p2
    taille = 76 if len(t) + len(em) < 130 else 64
    bas_html = (f'<p style="position:absolute;left:84px;right:84px;top:1010px;font-size:40px;line-height:1.3;'
                f'color:#D9D4C8;font-weight:500;max-width:720px">{e(bas)}</p>') if bas else ''
    return f'''<section class="cadre probleme" id="{pid}-{slug}-2">
  <span class="compteur">2 / 5</span>
  <p class="t" style="font-size:{taille}px">{e(t)}<br><br><em>{e(em)}</em></p>
  {bas_html}<div class="f" style="background:var(--{forme})"></div>
</section>'''


def ecran(pid, slug, n, couleur, sourcil, h2, img, points, note):
    fond = 'background:var(--bleu);color:#fff' if couleur == 'bleu' else 'background:var(--jaune)'
    op = ' style="opacity:.85"' if couleur == 'bleu' else ''
    pts = '\n    '.join(f'<div>{p}</div>' for p in points)
    return f'''<section class="cadre choix" id="{pid}-{slug}-{n}">
  <div class="bandeau" style="{fond}"><p class="sourcil"{op}>{e(sourcil)}</p><h2 style="max-width:none">{e(h2)}</h2></div>
  <span class="compteur">{n} / 5</span>
  <div class="ecran" style="top:360px;height:{520 if len(points) == 3 else 560}px"><img src="{A}templates-{img}.webp" alt=""></div>
  <div class="trois" style="top:{940 if len(points) == 3 else 980}px">
    {pts}
  </div>
  <p style="position:absolute;left:84px;right:84px;bottom:76px;font-size:24px;color:var(--discret)">{e(note)}</p>
</section>'''


def cta_template(t):
    prix = t.get('prix_txt', f"{t['prix']} € · accès à vie")
    return f'''<section class="cadre cta" id="{t['id']}-{t['slug']}-5">
  <span class="compteur">5 / 5</span>
  <div class="bloc">
    <h2 style="font-size:{100 if len(t['demo']) < 22 else 84}px">Essayez-le avec {e(t['demo'])}.</h2>
    <div class="liste"><div><i></i>Démo libre, sans inscription</div><div><i></i>Ordinateur, tablette, téléphone</div><div><i></i>Achat unique, sans abonnement</div></div>
  </div>
  <div class="plus" style="top:{800 if len(t['demo']) >= 22 else (720 if len(t['plus']) > 52 else 760)}px"><b>Besoin de plus ?</b> {e(t['plus'])} : <b>je le construis sur mesure.</b></div>
  <div class="bouton"><b>Lien en bio</b><span>{e(prix)}</span></div>
  {MARQUE.format(s='symbole', ms='', es=' style="color:var(--surface)"', url='qm-engineering.fr')}
</section>'''


def story(t):
    return f'''<section class="cadre story-t" id="{t['id']}-{t['slug']}-story">
  <span class="px">{t['prix']} €</span>
  <div class="c"><p class="sourcil">Template QME</p><h1>{e(t['nom'])}</h1><p class="s">{e(t['story'])}</p></div>
  <div class="tel"><img src="{A}templates-{t['dossier']}-tel.webp" alt=""></div>
  <div class="lien">Essayer la démo ↗</div>
</section>'''


ICONES = {
    'carre': '<rect x="6" y="6" width="88" height="88" fill="#D9302A"/><rect x="30" y="30" width="40" height="40" fill="#F0EDE6"/>',
    'rond': '<circle cx="50" cy="50" r="46" fill="#F5B400"/><circle cx="50" cy="50" r="18" fill="#141414"/>',
    'quart': '<path d="M6 94 V6 A88 88 0 0 1 94 94 Z" fill="#1D4E89"/><circle cx="34" cy="64" r="11" fill="#F0EDE6"/>',
    'barres': '<rect x="6" y="6" width="88" height="88" fill="#D9302A"/><rect x="22" y="52" width="14" height="30" fill="#F0EDE6"/><rect x="43" y="36" width="14" height="46" fill="#F0EDE6"/><rect x="64" y="20" width="14" height="62" fill="#F0EDE6"/>',
}


def sur_mesure(s, i):
    pid, slug = s['id'], s['slug']
    out = [couv(pid, slug, s['sourcil'], 'rouge', s['h1'], s['sous'], i + 1),
           probleme(pid, slug, s['p2'], s['p2_bas'], ['bleu', 'jaune', 'rouge'][i % 3])]
    sourcil, h2, items, note = s['v3']
    roles = '\n    '.join(
        f'<div class="role"><div class="ic"><svg viewBox="0 0 100 100" width="150" height="150">{ICONES[ic]}</svg></div>'
        f'<div><b>{e(b)}</b><span>{e(sp)}</span>' + (f'<em>{e(em)}</em>' if em else '') + '</div></div>'
        for ic, b, sp, em in items)
    note_html = f'<p class="note" style="left:84px;right:auto">{e(note)}</p>' if note else ''
    out.append(f'''<section class="cadre choix" id="{pid}-{slug}-3">
  <div class="bandeau" style="background:var(--encre);color:var(--papier)"><p class="sourcil" style="color:var(--jaune)">{e(sourcil)}</p><h2 style="max-width:none">{e(h2)}</h2></div>
  <span class="compteur">3 / 5</span>
  <div class="roles">
    {roles}
  </div>
  {note_html}
</section>''')
    sourcil, h2, pts = s['v4']
    pts_html = '\n    '.join(f'<div><b>{e(b)}</b>{e(t)}</div>' for b, t in pts)
    out.append(f'''<section class="cadre choix" id="{pid}-{slug}-4">
  <div class="bandeau" style="background:var(--jaune)"><p class="sourcil">{e(sourcil)}</p><h2 style="max-width:none">{e(h2)}</h2></div>
  <span class="compteur">4 / 5</span>
  <div class="pts large grand" style="top:410px;gap:{64 if len(pts) == 3 else 90}px">
    {pts_html}
  </div>
  {MARQUE.format(s='symbole', ms='', es='', url='qm-engineering.fr/sur-mesure')}
</section>''')
    h2, liste = s['v5']
    li = ''.join(f'<div><i></i>{e(x)}</div>' for x in liste)
    out.append(f'''<section class="cadre cta rouge" id="{pid}-{slug}-5">
  <span class="compteur">5 / 5</span>
  <div class="bloc">
    <h2 style="font-size:{90 if len(h2) < 40 else 76}px">{e(h2)}</h2>
    <div class="liste">{li}</div>
  </div>
  <div class="plus" style="color:var(--encre);top:{780 if len(liste) < 3 else 840}px"><b>Votre métier a ses règles ?</b> Parlons-en : un échange de 30 minutes, puis je construis l'outil sur mesure.</div>
  <div class="bouton"><b>Lien en bio</b><span>« Parler de votre projet »</span></div>
  {MARQUE.format(s='symbole-clair', ms=' style="color:#fff"', es='', url='qm-engineering.fr/sur-mesure')}
</section>''')
    return out


def alt_template(t):
    t3, t4 = t['v3'], t['v4']
    nettoie = lambda h: re.sub('<[^>]+>', '', h)
    return [
        f"Titre « {nettoie(t['h1'])} » {t['sous']}",
        f"Fond noir : {t['p2'][0]} {t['p2'][1]}",
        f"Le template {t['nom']} : {t3[1]} " + ' '.join(nettoie(p) for p in t3[3]) + ' Capture, données fictives.',
        f"{t4[0]} : {t4[1]} " + ' '.join(nettoie(p) for p in t4[3]) + ' Capture, données fictives.',
        f"Fond jaune : essayez-le avec {t['demo']}, démo libre, achat unique à {t['prix']} €. Besoin de plus ? {t['plus']} : version sur mesure. Lien en bio.",
    ]


def main():
    source = (ICI / 'publications.html').read_text(encoding='utf-8')
    tete = source.split('<!-- ============ IG-01')[0]
    tete = tete.replace('Visuels des publications Instagram IG-01 à IG-03 (lancement du 16/11/2026), 1080 × 1350.',
                        'Visuels des publications Instagram IG-06 à IG-33 (22/11 au 31/12/2026), 1080 × 1350.\n'
                        '     Généré par construire_ig_06_33.py (styles repris de publications.html).')
    tete = tete.replace('rendre.mjs publications.html', 'rendre.mjs publications-2.html')
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', '<title>Publications Instagram IG-06 à IG-33</title>')
    corps = []
    ordre = sorted([('t', x) for x in T] + [('s', x) for x in S], key=lambda p: p[1]['date'][3:5] + p[1]['date'][:2])
    for i, (genre, p) in enumerate(ordre):
        corps.append(f"\n<!-- ============ {p['id']} · {p['titre']} (d'après {p['li']}) ============ -->")
        if genre == 't':
            corps.append(couv(p['id'], p['slug'], p['couleur'], 'bleu', p['h1'], p['sous'], i))
            corps.append(probleme(p['id'], p['slug'], p['p2'], None, ['bleu', 'rouge', 'jaune'][i % 3]))
            corps.append(ecran(p['id'], p['slug'], 3, 'bleu', *p['v3']))
            corps.append(ecran(p['id'], p['slug'], 4, 'jaune', *p['v4']))
            corps.append(cta_template(p))
            corps.append(story(p))
        else:
            corps.extend(sur_mesure(p, i))
    (ICI / 'publications-2.html').write_text(tete + '\n'.join(corps) + '\n\n</body>\n</html>\n', encoding='utf-8')

    # Fiches instagram.md
    for t in T:
        alts = alt_template(t)
        t['alt'] = alts
        prix = (f"Prix vérifié sur Gumroad le 13/11/2026 : {t['prix']} €." if t['gumroad'] else
                f"Prix {t['prix']} € d'après IDEES.md, **non vérifié** : fiche Gumroad pas encore en ligne le 13/11/2026. "
                "Ne publier que si la fiche est en ligne à la date prévue, sinon décaler.")
        md = f"""# Publication Instagram · {t['nom']} ({t['id']})

{t['date']} à 18:30, lendemain de {t['li']} ({t['li_date']}). Carrousel 5 vues au gabarit des posts
template (IG-04, IG-05), vue 5 avec renvoi au sur mesure. Kit : `../instagram/README.md`. Visuels :
`../instagram/publications-2.html` → `../instagram/png/{t['id']}-{t['slug']}-*.png` (et `-story.png`).

- Démo (autocollant lien de la story) : https://qm-engineering.fr/templates/{t['dossier']}/?demo
- {prix}
- Faits repris de `linkedin.md` uniquement.

## Vues

1. Couverture : {re.sub('<[^>]+>', '', t['h1'])} / {t['sous']}
2. Problème (fond encre) : {t['p2'][0]} {t['p2'][1]}
3. {t['v3'][1]} (bandeau bleu, capture `templates-{t['v3'][2]}.webp`, 3 points).
4. {t['v4'][1]} (bandeau jaune, capture `templates-{t['v4'][2]}.webp`).
5. Appel à l'action (fond jaune), {t['prix']} €, renvoi au sur mesure : {t['plus']}.

## Légende (Google Doc « {t['id']} · {t['titre']} · légende », publié tel quel)

```
{t['legende']}
```

## Textes alternatifs

""" + '\n'.join(f"{k + 1}. {a}" for k, a in enumerate(alts)) + f"""

## Story d'annonce

`{t['id']}-{t['slug']}-story.png` (1080 × 1920) : à publier à la main le {t['date'][:5]}, autocollant « Lien » vers
la démo, puis à la une « Templates ».
"""
        (COMM / t['dossier'] / 'instagram.md').write_text(md, encoding='utf-8')
    for s in S:
        md = f"""# Instagram {s['id']} · {s['titre']}

{s['date']} à 18:30. Carrousel 5 vues au gabarit d'IG-28, adapté de {s['li']} (Google Doc du planning
LinkedIn) ; seuls ses faits sont repris. Aucune capture d'outil client.
Visuels : `../instagram/publications-2.html` → `../instagram/png/{s['id']}-{s['slug']}-1..5.png`.

## Légende (Google Doc « {s['id']} · {s['titre']} · légende », publié tel quel)

```
{s['legende']}
```

## Textes alternatifs

""" + '\n'.join(f"{k + 1}. {a}" for k, a in enumerate(s['alt'])) + '\n'
        (COMM / 'sur-mesure' / f"{s['id']}-{s['slug']}.md").write_text(md, encoding='utf-8')

    # Export pour le planning (JSON consommé à la main lors de l'envoi dans Drive)
    import json
    export = [dict(id=p['id'], slug=p['slug'], titre=p['titre'], legende=p['legende'], alt=p['alt'],
                   story=('t' == g), gumroad=p.get('gumroad', True), prix=p.get('prix'))
              for g, p in ordre]
    (pathlib.Path('/tmp') / 'ig-06-33.json').write_text(json.dumps(export, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(corps), 'blocs ;', len(T), 'templates ;', len(S), 'sur mesure')


if __name__ == '__main__':
    main()
