# T38 · Préparateur d'appel découverte

Slug `appel-decouverte`, préfixe `APD` (clés locales `qme-apd-*`), prix prévu 12 €, permalien Gumroad prévu
`preparateur-appel-decouverte`, catégorie Gumroad `business-and-money/marketing-and-sales` (à vérifier dans la
liste des catégories Gumroad au moment de créer la fiche), taille S, priorité P2. Origine : backlog de Quentin n° 13
(ligne T38 de `IDEES.md` : fiche contexte, questions par phase, objections, prochaine étape, résumé
imprimable ; base : banque de questions par phase, objections types ; produit d'appel, prix bas ; **RGPD**
(prospects) ; contenus des briefings réels non repris). Fiche rédigée le 13/11/2026. Catalogue : thème
« Clients et prospection » (`data-pour="pro" data-theme="clients-et-prospection"`, `--c:var(--encre)`).
Marques de risque : **données de tiers** (prospects : données minimales, effacement, repère de conservation
CNIL daté et sourcé, « à vérifier »). Pas d'argent ni de santé.

## Pour qui

Consultants, freelances et commerciaux (indépendants ou en petite équipe) qui mènent des premiers rendez-vous
avec des prospects et veulent les préparer vite, les mener sans oublier l'essentiel et en sortir avec une
décision claire. Distinct du **CRM freelance** (T28, `templates/crm/`, la relation dans la durée) et du
**Pipeline de prospection B2B** (T35, `templates/prospection/`, les étapes et relances d'un portefeuille) :
ici, un appel à la fois, de la préparation au compte rendu.

## Promesse

Prépare l'appel en dix minutes, mène-le avec les bonnes questions et les objections sous la main, et repars
avec une qualification claire et une prochaine étape datée.

## Écrans (5 onglets + réglages)

1. **Appels** : tuiles (à préparer et prêts, appels des 7 prochains jours, prochaines étapes en retard et
   appels à clôturer, qualifiés sur appels faits) ; recherche ; « Prochaines étapes en retard » (« C'est
   fait », « Reporter d'une semaine ») ; « À venir » (du plus proche au plus lointain, état prêt ou à
   préparer avec ce qui manque) ; « À clôturer » (date passée, pas marqué fait) ; « Faits » (score, étape
   suivante, « sans prochaine étape datée ») ; annulés repliés.
2. **Préparer** : en-tête de l'appel ; objectif (saisie libre) ; hypothèses à vérifier ; **plan minuté**
   (une barre par phase sur l'axe de la durée, minutes et bornes, alerte si trop de questions) ; questions
   retenues par phase (monter, descendre, retirer) ; **banque** par phase (puces des 7 phases avec le
   nombre retenu, but de la phase, « Ajouter les essentielles manquantes », ajout question par question,
   mes questions) ; formulaire « Ta propre question » (phase, « Garder dans mes questions ») ; impression
   de la feuille de préparation.
3. **En appel** (téléphone et ordinateur) : barre fixe avec chronomètre, phase prévue selon le plan (temps
   dépassé signalé), questions posées / total, « Objection ? », « Terminer » ; questions par phase (la
   phase en cours surlignée), case à cocher de 26 px, réponse sous chaque question (saisir une réponse
   coche la question) ; question imprévue ; à côté (sous les questions sur téléphone) : **signaux** besoin,
   budget, décideur, échéance (Inconnu / Non / Partiel / Oui, note facultative) avec le score en direct et
   la règle affichée ; hypothèses (à vérifier, confirmée, infirmée) ; objections entendues ; notes libres.
   « Objection ? » ouvre les 25 objections types (recherche, filtre par catégorie, piste, relance, « Noter
   qu'elle est survenue »). « Terminer » demande la prochaine étape et sa date (une semaine par défaut).
4. **Synthèse** : prochaine étape (quoi, quand, faite ; raccourcis +2 jours, +1 semaine, +2 semaines,
   +1 mois ; en retard en rouge) ; synthèse en trois phrases ; hypothèses ; « Ce que tu as appris »
   (questions posées avec réponse, notes) ; qualification ; objections entendues ; données du prospect
   (effacer le prénom, supprimer l'appel) ; **compte rendu à copier** (presse-papiers) ; **résumé
   imprimable** (impression → PDF).
5. **Banque** : questions par phase (essentielles, signal éclairé), objections par catégorie avec pistes
   et relances, mes questions (suppression) ; recherche.
6. **Réglages** : prénom, durée proposée pour un nouvel appel, données des prospects (texte RGPD, repère
   CNIL, « Effacer les appels clos depuis plus de 3 ans »), sauvegarde JSON (export, import), compte,
   « Sur téléphone », à propos.

Premier lancement en 2 étapes : prénom, 4 conseils de méthode et mention RGPD ; puis le premier appel
(organisation, fonction, date, heure, durée, format) ou « Commencer sans appel ».

## Saisie (fiche contexte)

Organisation (nom ou simple activité, obligatoire), fonction de l'interlocuteur (suggestions), prénom
**facultatif**, secteur (suggestions), taille (indépendant, 1-9, 10-49, 50-249, 250-4 999, 5 000 et plus,
organisme public, association), date, heure facultative, durée prévue (15, 20, 30, 45, 60, 90 min), format
(téléphone, visio, sur place), objectif. Annuler l'appel, le reprogrammer. **Aucun nom de famille, e-mail
ni téléphone** : la fiche ne les demande pas.

## Calculs (règles pures, `templates/appel-decouverte/regles.js`, `window.APD`)

- **Qualification** : oui = 2 points, partiel = 1, non ou inconnu = 0, total sur 8. Hors cible si le
  besoin est « non » (quel que soit le reste) ; qualifié si total ≥ 6 **et** besoin « oui » ; à creuser si
  total ≥ 3 ; froid sinon. Liste des signaux encore inconnus.
- **Préparation** : prêt si objectif écrit, fonction connue et au moins 3 questions ; sinon « à préparer »
  avec la liste de ce qui manque. **État** : annulé, fait, à clôturer (date passée, pas fait), prêt, à préparer.
- **Prochaine étape en retard** : texte présent, datée, pas faite, date passée (pas pour un appel annulé).
- **Classement** : étapes en retard (plus ancienne d'abord), à venir (date et heure croissantes), à
  clôturer, faits (plus récent d'abord), annulés ; compteurs du tableau de bord.
- **Plan minuté** : la durée est répartie entre les phases qui ont au moins une question, au prorata de
  leur poids (ouverture 10, situation 25, problème 20, impact 15, décision et budget 15, délais 5,
  conclusion 10), en minutes entières par la méthode du plus fort reste (la somme fait exactement la
  durée), au moins 1 minute par phase si la durée le permet. Capacité conseillée : 1 question pour
  2 minutes (alerte au-delà). Phase prévue à la minute m du chronomètre.
- Déplacement d'une question dans sa phase, ajout sans doublon, avancement (posées / total).
- **Conservation** : appels faits ou annulés, sans étape ouverte, dont la dernière activité (date de
  l'appel ou de l'étape) a plus de 36 mois → proposés à l'effacement.
- **Compte rendu** : texte simple (organisation, interlocuteur, format, objectif, synthèse, qualification
  et signaux, réponses par phase, hypothèses, objections, notes, prochaine étape), sans ligne vide inutile.
- Dates françaises (« vendredi 13 novembre 2026 », « 1er décembre »), durées (« 1 h 30 »), chronomètre ;
  normalisation tolérante des anciennes données.

## Base intégrée (`templates/appel-decouverte/donnees.js`)

- **7 phases** avec leur but et leur poids dans le plan minuté.
- **84 questions** (12 par phase), ouvertes, rédigées pour QME ; 28 « essentielles » (4 par phase) ;
  chacune peut indiquer le signal qu'elle éclaire (besoin, budget, décideur, échéance).
- **25 objections types** en 9 catégories (prix, budget, moment, besoin, confiance, concurrence,
  décision, informations, risques), chacune avec une piste de réponse et une question de relance.
- 4 signaux et leurs libellés par niveau ; 4 niveaux de qualification avec leur conseil.
- Listes de saisie : 9 tailles, 17 secteurs, 15 fonctions, 3 formats, 6 durées ; 4 conseils de méthode.
- **Aucune marque, aucune méthode commerciale déposée nommée, aucun contenu de briefing réel** (test
  automatique sur une liste de noms) ; aucun lien externe.

## Sources et risques

- **RGPD** (données de prospects) : la fiche ne demande que l'organisation, la fonction et un prénom
  facultatif ; texte d'information dans le premier lancement, la fiche contexte, la synthèse et les
  réglages ; effacement du prénom, suppression d'un appel, effacement groupé des appels clos depuis plus
  de 3 ans. Repère : « les données d'un prospect peuvent être conservées 3 ans à compter de la collecte
  ou du dernier contact venant du prospect » (CNIL, questions-réponses sur les référentiels « gestion des
  activités commerciales »,
  https://www.cnil.fr/fr/questions-reponses-sur-les-referentiels-relatifs-la-gestion-des-activites-commerciales-et-des,
  consulté le 13/11/2026) : **à vérifier** pour chaque activité ; l'utilisateur reste responsable de son
  traitement. Les notes libres sont un risque (données sensibles) : avertissement affiché.
- Rien ne se périme dans la base (questions et objections génériques) ; le repère CNIL est daté.
- Aucune automatisation : pas d'agenda, pas d'e-mail, pas de lien vers un logiciel tiers, pas de
  `mailto`. Compte rendu copié dans le presse-papiers, impression (PDF par le navigateur), sauvegarde JSON.
- Risque produit : listes de questions gratuites en ligne et fonctions de notes des CRM ; se distinguer
  par le plan minuté, le mode « en appel » sur téléphone, le score à règle affichée et la prochaine étape
  suivie, pour un achat unique à petit prix (produit d'appel).

## Choix d'implémentation (13/11/2026)

- Socle copié du suivi des abonnements (connexion, synchronisation, 409, démo, modales, toast avec
  « Annuler », fenêtre « Comme une application » reprise du bloc de `templates/gantt/app.js`, bandeau
  « Bientôt en vente »).
- Saisie libre (objectif, réponses, notes, synthèse, étape) enregistrée au fil de la frappe sans redessiner
  la vue (le focus reste en place) ; le rafraîchissement depuis le serveur attend qu'aucun champ n'ait le
  focus.
- Impression : un bloc `#impression` rempli juste avant `window.print()` ; en impression, seul ce bloc
  s'affiche (résumé de l'appel, ou feuille de préparation avec lignes pour noter à la main).
- Démo : activité fictive d'une consultante, 12 appels décrits par l'activité de l'organisation (aucun nom
  d'entreprise) : prêt aujourd'hui, à préparer demain, 15 min, trop de questions pour 20 min, 90 min avec
  28 questions et un intitulé très long, passé à clôturer avec réponses partielles, qualifié (7/8) avec
  étape à venir, à creuser (4/8) avec étape en retard, froid (1/8), hors cible, qualifié 8/8 avec étape
  faite, annulé.
- Graphique (skill dataviz) : le plan minuté est une seule série (bleu `--bleu`) sur un axe de temps,
  valeurs écrites en texte d'encre à droite de chaque barre (pas de légende ni de palette catégorielle),
  barres à bout arrondi de 4 px, repères tous les 10 % ; le détail est aussi lisible en texte (minutes et
  bornes de chaque phase), et la feuille imprimée le reprend en tableau.
