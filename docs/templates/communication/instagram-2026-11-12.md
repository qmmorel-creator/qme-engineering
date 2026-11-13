# Instagram · posts du 22/11 au 31/12/2026 (IG-06 à IG-33)

Préparés le 13/11/2026 d'après le planning (Google Sheet, colonne « Programme ») et les textes LinkedIn
du dépôt (`<template>/linkedin.md`), seule source des faits (fonctions, prix, liens). Tous les posts sont
à **18:30**, au format **carrousel de 5 vues**, la vue 5 renvoyant au lien en bio. Relecture de Quentin
avant publication.

**Règles communes**

- Lien cliquable : uniquement en bio (`qm-engineering.fr/templates/` pour les templates,
  `qm-engineering.fr` pour le sur mesure). Les URL de la légende ne sont pas cliquables sur Instagram :
  on les donne en clair, sans compter dessus.
- Visuels : format 4:5 (1080 × 1350). Les couvertures existantes (`assets/templates-*-couverture.png`,
  1280 × 720) et les captures `.webp` sont à recadrer ou à poser sur un fond de la charte. Données
  fictives partout ; la mention « Données fictives » figure sur la vue 2 ou 3.
- **Visuels générés** : `instagram/IG-XX/IG-XX-1.jpg` à `-5.jpg` (1080 × 1350, JPEG). Textes des cartes
  dans `instagram/posts.cjs` ; après modification, régénérer avec
  `node docs/templates/communication/instagram/generer.cjs [IG-29 …]`. Sur les posts sur mesure, les
  passages entre crochets apparaissent en surligné « À compléter » : ne pas publier ces cartes en l'état.
- Templates au statut « prêt » (T24, T25, T28, T29, T30, T32, T35, T36, T42, T15) : ne publier que si la
  fiche Gumroad est en ligne à la date prévue, sinon décaler (même règle que LinkedIn).
- Sur mesure (IG-29 à IG-33) : les publications LinkedIn d'origine (LI-03, LI-24, LI-46, LI-51, LI-72)
  n'étaient pas accessibles depuis cette session (Google Drive et Sheets non connectés). Les textes
  ci-dessous ne contiennent aucun cas client inventé ; **à aligner sur le cas du post LinkedIn** avant
  publication (passages entre crochets).

| ID | Date | Programme | Sujet | Source |
|----|------|-----------|-------|--------|
| IG-06 | 22/11 | Template | T40 Calculateur TJM freelance | LI-77 |
| IG-07 | 24/11 | Template | T41 Livre recettes-dépenses | LI-78 |
| IG-08 | 26/11 | Template | T65 Budget commun | LI-79 |
| IG-09 | 28/11 | Template | T02 Planning Gantt | LI-80 |
| IG-29 | 29/11 | Sur mesure | La fiche d'arrivée qui évite deux litiges | LI-03 |
| IG-10 | 30/11 | Template | T03 Gestionnaire de tâches | LI-81 |
| IG-11 | 02/12 | Template | T05 Budget du foyer | LI-82 |
| IG-12 | 04/12 | Template | T24 Circuit de visa | LI-83 |
| IG-13 | 06/12 | Template | T25 Registre des non-conformités | LI-84 |
| IG-30 | 07/12 | Sur mesure | Maintenance : au compteur, pas au calendrier | LI-24 |
| IG-14 | 08/12 | Template | T28 CRM freelance | LI-85 |
| IG-15 | 10/12 | Template | T29 Gestion de flotte | LI-86 |
| IG-16 | 12/12 | Template | T30 Planner horaire | LI-87 |
| IG-17 | 14/12 | Template | T32 Levée de réserves | LI-88 |
| IG-31 | 15/12 | Sur mesure | Le tableur n'est pas le problème | LI-46 |
| IG-18 | 16/12 | Template | T35 Pipeline de prospection | LI-89 |
| IG-19 | 18/12 | Template | T36 Générateur de devis | LI-90 |
| IG-20 | 20/12 | Template | T42 Trésorerie prévisionnelle | LI-91 |
| IG-32 | 23/12 | Sur mesure | Cinq questions avant de choisir un logiciel | LI-51 |
| IG-21 | 30/12 | Template | T15 Organisateur de mariage | LI-92 |
| IG-33 | 31/12 | Sur mesure | Ce qui fait le prix d'un outil sur mesure | LI-72 |

Vue 5 commune aux templates (seul le nom change) :

> **Essayez la démo, sans inscription.**
> Lien en bio → Templates → <nom>
> Achat unique, sans abonnement · <prix>

---

## IG-06 · 22/11 · T40 Calculateur de TJM freelance

**Vues**
1. Votre TJM paie-t-il vraiment votre salaire ?
2. Un TJM se calcule à l'envers : revenu voulu + frais + cotisations ÷ jours vraiment facturés. Pas 365.
3. Jours ouvrés calculés, fériés retirés · micro (BIC, BNC, Cipav) ou SASU / EURL. (capture téléphone)
4. TJM minimum et TJM conseillé · 3 scénarios côte à côte · alerte plafond micro et franchise de TVA. (capture Scénarios)
5. Vue commune · Calculateur de TJM · 12 €

**Légende**
Beaucoup de freelances fixent leur TJM en regardant celui des autres, puis découvrent en fin d'année
que leurs jours facturés ne suffisent pas.

Le calculateur part du revenu que vous voulez vous verser, ajoute frais et cotisations, et divise par
les jours que vous facturerez vraiment : week-ends, fériés, congés, prospection et administratif retirés.

Taux 2026 intégrés avec leur source, modifiables. Outil d'aide, pas un conseil : il ne remplace pas un
expert-comptable.

Démo libre, lien en bio. 12 €, achat unique.

#freelance #tjm #microentreprise #independant #entrepreneuriat #freelancefrance

**Texte alternatif** : Calculateur de TJM QME sur ordinateur et téléphone, données fictives.

---

## IG-07 · 24/11 · T41 Livre recettes-dépenses micro-entreprise

**Vues**
1. Déclaration URSSAF : fini les trois tableurs.
2. Chaque recette notée en quelques secondes, rangée par activité : vente, services, libéral. (capture téléphone)
3. À chaque échéance, le chiffre d'affaires à déclarer est prêt, avec l'estimation des cotisations. (capture Déclarations)
4. Plafonds du régime et seuils de TVA suivis toute l'année, alerte avant de les atteindre. (capture Seuils)
5. Vue commune · Livre recettes-dépenses · 25 €

**Légende**
En micro-entreprise, le livre des recettes est obligatoire. Beaucoup le tiennent sur papier ou dans un
tableur, et refont les totaux à chaque déclaration.

Ici, chaque encaissement se note avec sa date, son client, sa nature et son mode de règlement. À
l'échéance, mensuelle ou trimestrielle, le montant à déclarer est prêt. Export CSV et impression du
livre.

Ce n'est pas un logiciel comptable : c'est un outil d'aide. Taux 2026 sourcés et modifiables.

Démo libre avec un atelier fictif, lien en bio. 25 €, achat unique.

#microentreprise #autoentrepreneur #urssaf #independant #freelance #gestion

**Texte alternatif** : Livre recettes-dépenses QME sur ordinateur et téléphone, données fictives.

---

## IG-08 · 26/11 · T65 Budget commun couple / colocation

**Vues**
1. « Je t'ai fait un virement pour les courses… ou c'était l'électricité ? »
2. Chacun note ce qu'il paie. Répartition à parts égales, au prorata des revenus, en parts ou au montant exact.
3. Qui doit combien à qui, et le nombre minimal de virements pour solder. (capture téléphone)
4. Loyer, énergie, abonnements ajoutés chaque mois. Une clé pour tout le foyer, chacun sur son téléphone. (capture Mois)
5. Vue commune · Budget commun · 15 €

**Légende**
Partager les dépenses est simple tant que tout est à parts égales. Dès qu'on tient compte des revenus,
d'un enfant ou d'une chambre plus grande, le tableur devient une source de discussions.

Le budget commun fait le calcul au centime et tient les soldes à jour. Si deux personnes saisissent en
même temps, les deux dépenses sont gardées.

Pas de connexion bancaire, pas d'abonnement.

Démo avec un couple fictif, lien en bio. 15 €, une clé pour le foyer.

#budgetcommun #colocation #viedecouple #financespersonnelles #budget #organisation

**Texte alternatif** : Budget commun QME sur téléphone : soldes entre colocataires, données fictives.

---

## IG-09 · 28/11 · T02 Planning Gantt rapide

**Vues**
1. Une date bouge. Vingt cellules à reprendre à la main ?
2. Une ligne suffit : « Pose des meubles 12/12 3j après 7 » crée la tâche, la barre et le lien. (capture Gantt)
3. Les dates se recalculent seules, en jours ouvrés, fériés français compris.
4. Le chemin critique en rouge : les tâches qui décalent la fin du projet. (capture Chemin critique)
5. Vue commune · Planning Gantt · 45 €

**Légende**
Entre le tableur, qui ne calcule rien, et le logiciel de planification, long à prendre en main, il
manquait un outil simple pour les artisans, les PME et les chefs de projet.

Liens fin → début, début → début, fin → fin avec décalage ; suivi de l'avancement face au prévu ;
comparaison avec le planning de référence ; impression A3. Douze modèles fictifs pour démarrer :
rénovation, construction, déménagement, site web…

Démo avec quatre plannings d'exemple, lien en bio. 45 €, achat unique.

#gestiondeprojet #planning #gantt #btp #pme #artisan

**Texte alternatif** : Planning Gantt d'une rénovation de cuisine, chemin critique en rouge (données fictives).

---

## IG-29 · 29/11 · Sur mesure · La fiche d'arrivée qui évite deux litiges

*À aligner sur LI-03 : contexte (métier, client) et nature des deux litiges.*

**Vues**
1. La fiche d'arrivée qui évite deux litiges.
2. Le constat : [ce qui se passait avant, d'après LI-03]. Sans trace écrite, c'est parole contre parole.
3. La réponse : une fiche remplie à l'arrivée, sur téléphone. Date et heure, photos, état constaté, validation.
4. Le résultat : [les deux litiges évités, d'après LI-03]. La preuve existe avant que la question se pose.
5. Un outil construit autour de votre façon de travailler. Parlons-en : lien en bio.

**Légende**
Beaucoup de litiges ne portent pas sur ce qui s'est passé, mais sur ce que chacun peut prouver.

[Contexte du cas, 2 lignes, d'après LI-03.]

Une fiche d'arrivée simple, remplie sur place depuis un téléphone, avec l'heure, les photos et l'état
constaté : l'information est enregistrée au moment où elle est vraie, pas reconstituée des semaines
plus tard.

C'est le genre d'outil que je construis sur mesure : petit, précis, adapté au terrain.

Lien en bio pour en parler.

#outilsurmesure #digitalisation #pme #terrain #organisation

**Texte alternatif** : Fiche d'arrivée sur téléphone avec photos et heure de constat (illustration).

---

## IG-10 · 30/11 · T03 Gestionnaire de tâches

**Vues**
1. Une liste qui s'allonge ne dit pas quoi faire ce matin.
2. Noter vite : « Appeler la banque demain 14h !haute #Perso 30min ». Tout arrive en boîte de réception. (capture téléphone)
3. Trier : urgent ou pas, important ou pas, un élément après l'autre. (capture triage)
4. Choisir : 3 à 5 tâches au focus, le temps prévu face au temps disponible. (capture semaine)
5. Vue commune · Gestionnaire de tâches · 19 €

**Légende**
Le problème n'est pas de noter les tâches, c'est de choisir chaque jour celles qui comptent.

Trois gestes : noter, trier, choisir. Le soir, on reporte ou on archive, la journée est close. Les
répétitions sont fiables : « le 31 » tombe le 30 les mois courts, « dernier jour ouvré » saute week-ends
et fériés.

Outil personnel, pas logiciel d'équipe. Cinq modèles de projets fournis.

Démo libre, lien en bio. 19 €, achat unique.

#organisation #productivite #gestiondutemps #todolist #freelance

**Texte alternatif** : Gestionnaire de tâches QME, vue Aujourd'hui sur téléphone, données fictives.

---

## IG-11 · 02/12 · T05 Budget du foyer

**Vues**
1. Où est passé l'argent ce mois-ci ?
2. Des enveloppes par catégorie, avec report du reste d'un mois sur l'autre. (capture Enveloppes)
3. Le prévu face au réel : les enveloppes dépassées sont signalées tout de suite.
4. Le trajet de l'argent : des revenus vers les besoins, les envies, l'épargne. (capture téléphone du diagramme)
5. Vue commune · Budget du foyer · 15 €

**Légende**
Un relevé bancaire liste les dépenses. Il ne dit ni si vous restez dans ce que vous aviez prévu, ni
quelle part de ce qui rentre part en loyer, en courses ou en épargne.

Le budget du foyer arrive prêt : 22 catégories, 75 sous-catégories, quatre modèles de foyer, les
opérations fixes ajoutées en un geste. Le repère 50/30/20 est affiché pour comparer, pas comme une
règle.

Pas de connexion à la banque : vous saisissez vos montants.

Démo avec un foyer fictif, lien en bio. 15 €, achat unique.

#budget #financespersonnelles #epargne #budgetfamilial #famille

**Texte alternatif** : Budget du foyer : diagramme des flux d'un mois, des revenus vers les dépenses (données fictives).

---

## IG-12 · 04/12 · T24 Circuit de visa des documents

**Vues**
1. Un plan qui attend son visa trois semaines, c'est souvent une relance oubliée.
2. Un registre par lot : indice, réception, échéance, avis de chaque viseur (VSO, VAO, REF). (capture Registre)
3. Échéances calculées avec les délais de votre marché, calendaires ou ouvrés.
4. Chaque matin : qui relancer, avec le message déjà rédigé. (capture téléphone)
5. Vue commune · Circuit de visa · 39 €

**Légende**
Avec dix lots, quatre viseurs et des dizaines de documents à différents indices, le suivi des visas
déborde vite du tableur.

Le registre dit ce qui a été reçu ; l'outil dit aussi qui relancer ce matin. Un tableau de bord suit le
délai moyen face au délai contractuel et la part de documents visés sans observation au premier indice.
Export CSV, impression.

Maîtres d'œuvre, BET, OPC : démo avec trois opérations fictives, lien en bio. 39 €, achat unique.

#btp #maitrisedoeuvre #construction #bureaudetudes #gestiondeprojet

**Texte alternatif** : Suivi du circuit de visa : relances à faire et registre par lot, données fictives.

---

## IG-13 · 06/12 · T25 Registre des non-conformités

**Vues**
1. Le même écart revient trois fois avant qu'on se demande pourquoi.
2. Le constat en 30 secondes, sur le terrain, depuis le téléphone. (capture téléphone)
3. La cause par les 5 pourquoi, guidés, classée en 6M. (capture fiche)
4. Actions suivies, puis vérification d'efficacité. Pas efficace ? Retour à l'analyse. (capture indicateurs)
5. Vue commune · Registre des non-conformités · 20 €

**Légende**
Dans beaucoup de PME, le registre des non-conformités note l'écart, parfois l'action, rarement la
cause, presque jamais la vérification.

Ce registre tient la démarche jusqu'au bout. Il arrive avec une grille de gravité en quatre niveaux,
dix types d'écarts (BTP et industrie), deux exemples complets des 5 pourquoi, et des indicateurs prêts
pour la revue de direction.

Démo avec une entreprise fictive et un an d'historique, lien en bio. 20 €, achat unique.

#qualite #btp #industrie #ameliorationcontinue #pme

**Texte alternatif** : Registre des non-conformités sur téléphone : écarts ouverts, en retard, à vérifier (données fictives).

---

## IG-30 · 07/12 · Sur mesure · Maintenance : au compteur, pas au calendrier

*À aligner sur LI-24 : équipement, compteur utilisé et résultat du cas.*

**Vues**
1. Maintenance : au compteur, pas au calendrier.
2. « Tous les 6 mois » : trop tôt pour une machine qui tourne peu, trop tard pour celle qui tourne jour et nuit.
3. Le compteur suit l'usage réel : heures, kilomètres, cycles. L'entretien se déclenche au premier seuil atteint.
4. [Ce que ça a changé dans le cas LI-24.]
5. Un outil construit autour de vos équipements. Parlons-en : lien en bio.

**Légende**
Un entretien calé sur le calendrier traite toutes les machines de la même façon. Or elles ne s'usent
pas au même rythme.

Suivre un compteur (heures de fonctionnement, kilomètres, cycles) et garder une date limite en
sécurité, c'est déclencher l'intervention quand elle est utile : ni trop tôt, ni trop tard.

[Contexte et résultat du cas, d'après LI-24.]

C'est le type de règle métier que j'intègre dans un outil sur mesure. Lien en bio.

#maintenance #gmao #industrie #outilsurmesure #pme

**Texte alternatif** : Schéma comparant entretien au calendrier et entretien au compteur (illustration).

---

## IG-14 · 08/12 · T28 CRM freelance

**Vues**
1. Le devis envoyé il y a dix jours. Quelqu'un l'a relancé ?
2. Chaque contact a une prochaine action datée. Chaque matin, qui relancer. (capture téléphone)
3. Après un échange : « Fait ». C'est noté, l'action suivante est proposée. (capture fiche contact)
4. Devis et factures suivis : échéances, encaissements, CA par mois et par client. (capture chiffres)
5. Vue commune · CRM freelance · 25 €

**Légende**
Quand on travaille seul, le suivi commercial vit dans la boîte mail, un carnet et un tableur. Tout est
quelque part, rien ne remonte au bon moment.

Ce CRM est volontairement simple : six étapes de vente et quatorze actions types, chacune avec un délai
et un conseil. Ce n'est pas un logiciel de facturation : vos factures restent faites avec votre outil,
le CRM en suit le paiement.

Démo avec des clients fictifs, lien en bio. 25 €, achat unique.

#freelance #crm #independant #relationclient #prospection

**Texte alternatif** : CRM freelance QME sur téléphone : relances du jour, données fictives.

---

## IG-15 · 10/12 · T29 Gestion de flotte de véhicules

**Vues**
1. Contrôle technique, entretien, amende à désigner : qui suit les dates ?
2. Une seule liste d'alertes, retards en tête. (capture Alertes)
3. Réservations par véhicule, chevauchements refusés, kilométrage au retour. (capture téléphone)
4. Coût total et coût au kilomètre ; en location longue durée, le dépassement estimé. (capture LLD / Coûts)
5. Vue commune · Gestion de flotte · 39 €

**Légende**
Quelques véhicules suffisent pour multiplier les dates à surveiller : entretien au kilomètre ou à la
date, contrôle technique, contre-visite, amendes à désigner dans les délais, kilométrage d'un contrat
qui dérape.

Les règles du contrôle technique et le délai de désignation du conducteur viennent des sites
officiels, datés dans l'application. Les intervalles d'entretien sont indicatifs, à adapter au carnet
du constructeur.

Services généraux, mairies, PME : démo avec six véhicules fictifs, lien en bio. 39 €, achat unique.

#gestiondeflotte #pme #collectivites #vehicules #servicesgeneraux

**Texte alternatif** : Gestion de flotte : alertes d'entretien, de contrôle technique et d'amendes, données fictives.

---

## IG-16 · 12/12 · T30 Planner horaire time-blocking

**Vues**
1. Prévoir sa semaine, facile. Voir l'écart avec la réalité, moins.
2. Une grille de 30 minutes. Les blocs se posent et se déplacent au doigt. (capture téléphone)
3. Chaque bloc en un geste : fait, raccourci, déplacé, pas fait.
4. Le bilan : prévu face au réalisé, par catégorie, sur six semaines. (capture Bilan)
5. Vue commune · Planner horaire · 15 €

**Légende**
Le time blocking donne à chaque heure de la semaine une destination : travail de fond le matin,
messages regroupés, sport deux soirs.

Ce planner fait les deux moitiés du travail : planifier et mesurer. Ce qui revient chaque semaine
n'est saisi qu'une fois. Trois semaines types prêtes (cadre, freelance, étudiant), et toute semaine
peut devenir un modèle.

Démo avec la semaine d'une freelance fictive, lien en bio. 15 €, achat unique.

#timeblocking #productivite #organisation #gestiondutemps #freelance

**Texte alternatif** : Planner horaire QME : semaine en blocs de 30 minutes sur téléphone, données fictives.

---

## IG-17 · 14/12 · T32 Levée de réserves (OPR)

**Vues**
1. Des dizaines de réserves, dix entreprises, une liste recopiée à chaque visite.
2. Saisie pendant la visite, sur téléphone : bâtiment, niveau, local, lot, entreprise. (capture téléphone)
3. Le cycle daté : levée, contrôle, refus motivé avec nouvelle échéance.
4. Tableau de bord par entreprise et par lot ; PV de levée prêt à imprimer. (capture Tableau de bord / PV)
5. Vue commune · Levée de réserves · 39 €

**Légende**
Une réserve suit toujours le même chemin : constatée, reprise, contrôlée, acceptée ou refusée. Le
problème, c'est le volume.

Les retards se calculent avec vos propres délais. Pour chaque entreprise, la liste des réserves à lever
ou le procès-verbal de levée sort prêt à imprimer. Export CSV.

Conducteurs de travaux, maîtres d'œuvre, gestionnaires d'immeubles : démo avec une résidence fictive,
lien en bio. 39 €, achat unique.

#btp #construction #conduitedetravaux #maitrisedoeuvre #reception

**Texte alternatif** : Levée de réserves : réserves en retard, à contrôler et ouvertes, par lot, données fictives.

---

## IG-31 · 15/12 · Sur mesure · Le tableur n'est pas le problème

*À aligner sur LI-46 : cas et conclusion du post.*

**Vues**
1. Le tableur n'est pas le problème.
2. Il est souple, connu de tous, gratuit. Il dépanne très bien.
3. Ce qui coince : plusieurs copies, des règles connues d'une seule personne, rien qui alerte.
4. [Ce qui a été fait dans le cas LI-46.] On commence par la façon de travailler, pas par l'outil.
5. Un outil construit autour de votre façon de travailler. Parlons-en : lien en bio.

**Légende**
On accuse souvent le tableur. Le plus souvent, il n'y est pour rien.

Les difficultés viennent d'ailleurs : la version à jour n'est pas celle qu'on a ouverte, une règle de
calcul n'existe que dans la tête de quelqu'un, et personne n'est prévenu quand une échéance passe.

[Cas, 2 lignes, d'après LI-46.]

Changer d'outil sans clarifier le fonctionnement déplace le problème. Je commence toujours par là.

Lien en bio pour en parler.

#outilsurmesure #excel #organisation #pme #digitalisation

**Texte alternatif** : Visuel typographique « Le tableur n'est pas le problème ».

---

## IG-18 · 16/12 · T35 Pipeline de prospection B2B

**Vues**
1. Prospecter seul : les relances glissent.
2. Les prospects avancent par étapes, de « À contacter » à « Gagné ». (capture pipeline)
3. Chaque matin, les relances du jour selon la cadence choisie. (capture téléphone)
4. Un script rempli avec le prénom du prospect, à relire et copier. Rien n'est envoyé à votre place.
5. Vue commune · Pipeline de prospection · 25 €

**Légende**
Quand on prospecte seul, tout tient dans un tableur et dans sa tête, et on réécrit le même message à
chaque fois.

Trois cadences types et dix-neuf scripts sobres, du premier contact au suivi de proposition. Les
chiffres montrent le taux de passage d'une étape à l'autre et ce que donne chaque canal. Les personnes
qui ne veulent plus être contactées sont mises de côté en un clic.

Démo avec des prospects fictifs, lien en bio. 25 €, achat unique.

#prospection #b2b #developpementcommercial #independant #freelance

**Texte alternatif** : Pipeline de prospection QME : étapes et relances du jour sur téléphone, données fictives.

---

## IG-19 · 18/12 · T36 Générateur de devis

**Vues**
1. Un ancien devis modifié… et un total qui n'a pas suivi.
2. Un catalogue de prestations : unité, prix HT, TVA. Les prix, c'est vous.
3. Sections, remises, TVA par ligne, acompte, validité. Totaux calculés au centime. (capture téléphone)
4. Mentions vérifiées avant l'envoi, numéro automatique, impression A4 ou PDF. (aperçu A4)
5. Vue commune · Générateur de devis · 29 €

**Légende**
Beaucoup d'artisans et de freelances font leurs devis à partir d'un ancien devis. Ça marche, jusqu'au
jour où une ligne change et pas le total.

Les mentions d'un devis ont été relevées sur les sites officiels, avec leur source et leur date, et un
contrôle signale ce qui manque. Chaque devis a un statut : brouillon, envoyé, accepté, refusé.

Il fait des devis, pas des factures. Chacun reste responsable des mentions propres à son activité.

Démo avec huit devis fictifs, lien en bio. 29 €, achat unique.

#artisan #devis #freelance #tpe #independant

**Texte alternatif** : Générateur de devis QME : lignes, TVA et totaux, données fictives.

---

## IG-20 · 20/12 · T42 Trésorerie prévisionnelle 12 mois

**Vues**
1. Le creux de trésorerie se voit souvent trop tard.
2. Encaissements et décaissements prévus, ponctuels ou récurrents. (capture Tableau)
3. Le réalisé saisi en regard du prévu : le solde se recalcule. (capture Pointage)
4. Trois scénarios et un seuil d'alerte : le mois à surveiller saute aux yeux. (capture téléphone)
5. Vue commune · Trésorerie prévisionnelle · 29 €

**Légende**
Un achat de matériel, une échéance annuelle et un client qui paie en retard tombent le même mois, et le
découvert arrive sans prévenir.

Le plan couvre 12 mois glissants. Il arrive avec 37 catégories types et 4 profils d'activité
(prestataire, commerce, artisan, société avec salariés). Export CSV pour l'expert-comptable.

Ce n'est pas un logiciel comptable, et il ne contient aucune échéance fiscale ou sociale toute faite :
vous saisissez les vôtres.

Démo avec un atelier fictif, lien en bio. 29 €, achat unique.

#tresorerie #tpe #entrepreneuriat #independant #gestion

**Texte alternatif** : Plan de trésorerie sur 12 mois : alerte sous le seuil en mars (données fictives).

---

## IG-32 · 23/12 · Sur mesure · Cinq questions avant de choisir un logiciel

*À aligner sur LI-51 : reprendre ses cinq questions si elles diffèrent de celles-ci.*

**Vues**
1. Cinq questions avant de choisir un logiciel.
2. ① Quel problème précis doit-il régler ? ② Qui va le remplir, et où : bureau, terrain, téléphone ?
3. ③ Qu'est-ce qui doit déclencher une alerte ? ④ Avec quels outils doit-il échanger ?
4. ⑤ Que deviennent vos données si vous arrêtez ?
5. Un outil construit autour de votre façon de travailler. Parlons-en : lien en bio.

**Légende**
On choisit souvent un logiciel sur sa liste de fonctions. Les questions utiles portent plutôt sur
votre façon de travailler.

Si la réponse à la deuxième question est « sur le terrain, depuis un téléphone », la moitié des
logiciels du marché sort du lot. Si la cinquième reste sans réponse, c'est un risque.

Enregistrez ce post pour votre prochain choix d'outil.

Et si aucun logiciel ne coche les cinq cases, c'est le rôle du sur mesure. Lien en bio.

#logiciel #digitalisation #pme #outilsurmesure #transformationdigitale

**Texte alternatif** : Liste de cinq questions à se poser avant de choisir un logiciel.

---

## IG-21 · 30/12 · T15 Organisateur de mariage

**Vues**
1. Un mariage, c'est un projet. Sans l'outil.
2. Un rétroplanning de 40 tâches calculé depuis la date. La date change ? Tout se recale. (capture téléphone)
3. Le budget poste par poste : prévu, engagé, payé, acomptes et soldes. (capture Budget)
4. Invités, réponses, régimes, puis le plan de table au glisser-déposer. (capture Plan de table)
5. Vue commune · Organisateur de mariage · 29 €

**Légende**
Des dizaines de tâches sur un an, une dizaine de prestataires, des acomptes à des dates différentes,
des invités qui répondent au compte-gouttes.

L'organisateur tient tout au même endroit, sur les deux téléphones et l'ordinateur, même hors
connexion. Les postes de budget sont vides : pas de prix moyens inventés, c'est votre budget. Les
démarches en mairie ne citent que ce qui est vérifié sur service-public.gouv.fr.

Fiancés pendant les fêtes ? Démo avec un mariage fictif, lien en bio. 29 €, achat unique.

#mariage #organisationmariage #futuremariee #mariage2027 #weddingplanner

**Texte alternatif** : Organisateur de mariage QME : compte à rebours, budget et plan de table (données fictives).

*Remarque : l'accroche « fiancés pendant les fêtes » s'appuie sur la période ; à retirer si Quentin la
juge trop appuyée.*

---

## IG-33 · 31/12 · Sur mesure · Ce qui fait le prix d'un outil sur mesure

*À aligner sur LI-72 : ne citer aucune fourchette de prix qui n'y figure pas.*

**Vues**
1. Ce qui fait le prix d'un outil sur mesure.
2. Le nombre d'écrans et de règles métier : calculs, alertes, statuts.
3. Qui l'utilise : une personne ou une équipe, avec des droits différents.
4. Ce qu'il doit relier : documents à produire, imports, autres logiciels.
5. On chiffre après avoir compris votre façon de travailler. Parlons-en : lien en bio.

**Légende**
« Combien coûte un outil sur mesure ? » La réponse honnête : ça dépend de ce qu'il doit faire, et ça
se mesure.

Trois choses pèsent le plus : les règles métier à traduire, le nombre d'utilisateurs et de rôles, et
les branchements avec ce qui existe déjà. L'interface elle-même pèse moins qu'on ne croit.

Pour les besoins courants, il existe des templates prêts à l'emploi, dès 12 €. Au-delà, on part de
votre fonctionnement.

Bonne année, et lien en bio pour en parler en 2027.

#outilsurmesure #pme #digitalisation #developpement #independant

**Texte alternatif** : Visuel typographique listant les trois facteurs du prix d'un outil sur mesure.
