# Idées de templates QME

Liste vivante des templates prêts à l'emploi à développer et vendre (boutique Gumroad QME, page
`/templates/`). Chaque nouvelle idée de Quentin y est ajoutée dès qu'elle est donnée ; le statut suit le
développement. Développement : skill `.claude/skills/nouveau-template/` (lancé par Quentin, une idée à la fois).

Non publié sur le site (chemin bloqué dans `netlify.toml`).

**Statuts** : `idée` (une ligne) → `fiche` (fiche détaillée prête à développer) → `en cours` → `prêt`
(testé, PR ouverte) → `en vente` (fiche Gumroad publiée).

**Règles pour toute idée** (tirées du planning de révision) :
- application web à part entière, ouverte avec une clé de licence Gumroad, données synchronisées en ligne ;
- une **base intégrée** qui fait la valeur du produit (un tableau vide se trouve gratuitement) ;
- aucune donnée qui se périme (barèmes, taux, prix, calendriers officiels) sans source datée et plan de
  mise à jour ; préférer ce qui se calcule (jours fériés, dates relatives) ;
- toute base reprise d'une source externe : source et licence vérifiées avant développement ;
- santé et argent : avertissement « ne remplace pas un avis professionnel ».

## Tableau de bord

| N° | Template | Statut | Prix visé | Taille | Origine |
|----|----------|--------|-----------|--------|---------|
| T01 | Planning de révision | prêt (Gumroad : paiement à connecter) | 14,90 € | M | Liste initiale, 12/11/2026 |
| T02 | Planning Gantt rapide | fiche | 24,90 € | L | Quentin, 12/11/2026 (Planning rapide de Nexora) |
| T03 | Gestionnaire de tâches | fiche | 19,90 € | M | Quentin, 12/11/2026 (tâches de Nexora) |
| T04 | Nutrition et dépense énergétique | fiche | 14,90 € | L | Quentin, 12/11/2026 (NutriQuest) |
| T05 | Budget du foyer | idée | 14,90 € | M | Liste initiale, 12/11/2026 |
| T06 | Repas de la semaine et liste de courses | idée | 12,90 € | M | Liste initiale |
| T07 | Carnet de musculation | idée | 12,90 € | M | Liste initiale |
| T08 | Suivi d'habitudes | idée | 9,90 € | S | Liste initiale |
| T09 | Garde-manger et dates de péremption | idée | 9,90 € | S | Liste initiale |
| T10 | Entretien du véhicule | idée | 9,90 € | S | Liste initiale |
| T11 | Entretien de la maison | idée | 9,90 € | S | Liste initiale |
| T12 | Remboursement de dettes | idée | 9,90 € | S | Liste initiale |
| T13 | Objectif d'épargne | idée | 9,90 € | S | Liste initiale |
| T14 | Suivi des abonnements | idée | 7,90 € | S | Liste initiale |
| T15 | Organisation de mariage ou d'événement | idée | 19,90 € | M | Liste initiale |
| T16 | Déménagement | idée | 9,90 € | S | Liste initiale |
| T17 | Suivi de lecture | idée | 7,90 € | S | Liste initiale |
| T18 | Calendrier du potager | idée | 12,90 € | M | Liste initiale |
| T19 | Suivi du bébé | idée | 12,90 € | M | Liste initiale |
| T20 | Suivi d'un animal de compagnie | idée | 9,90 € | S | Liste initiale |
| T21 | Préparation de voyage | idée | 9,90 € | S | Liste initiale |
| T22 | Tableau de bord annuel (objectifs trimestriels) | idée | 12,90 € | M | Liste initiale |

Taille : S ≈ une session de développement, M ≈ deux, L ≈ trois ou plus. Prix visés indicatifs, à
confirmer par Quentin avant la création de chaque fiche Gumroad.

**Ordre conseillé** : T04 et T03 (forte demande, réutilisent ce qui existe dans Nexora), puis T02
(le plus différenciant, le plus long), puis T05 et T15 (fort panier). Les S peuvent se regrouper en lots.

---

## T01 · Planning de révision

Prêt : `/templates/revision/`, préfixe `REV`, fiche Gumroad `planning-revision` (clé de licence activée ;
publication en attente d'un moyen de paiement connecté au compte Gumroad). Référence d'architecture
pour tous les autres templates.

Communication : page `qm-engineering.fr/templates/#revision`,
[publication LinkedIn](communication/revision/linkedin.md), [prospects](communication/revision/prospects.md).

---

## T02 · Planning Gantt rapide

**Pour qui** : artisans, PME, chefs de projet indépendants, particuliers en rénovation, étudiants en projet
de groupe. Ceux pour qui MS Project est trop lourd et un tableur trop pauvre.

**Ce qu'il reprend du Planning rapide de Nexora** (`apps/nexora-future-optim/src/optim/planning-rapide/`,
moteur et règles pures dans `src/donnees/planning-rapide.ts`) :
- **saisie rapide en une ligne** : `Maquette accueil 12/11 5j 40% après 2` (nom, début, durée, avancement,
  lien vers la tâche 2) ; option « Enchaîner » (chaque tâche sans date suit la précédente) ;
- **mini-plannings** rangés en **sections** repliables (`_Lot_1`), panneau « Dossiers » pour afficher ou
  masquer plannings, sections et calques ;
- **tableau éditable et Gantt SVG synchronisés** ;
- **dépendances** FD, DD, FF, DF avec décalage en jours (`3, 5DD+2`), tracées à angle droit, création au
  glisser, boucles refusées, successeurs poussés ;
- **dates de référence** (planning initial) et écart affiché ; **progression** et statut (en retard si
  l'avancement est sous l'attendu du jour) ;
- **repères verticaux** et **périodes hachurées** (communs ou propres à un planning) ;
- **zoom continu** (jour → année, Ctrl + molette, pincement), « Aujourd'hui », « Ajuster » ; annuler.

**Base intégrée** :
- 10 à 15 **modèles de plannings** prêts à dupliquer : rénovation de cuisine, de salle de bains,
  construction de maison (grandes phases), déménagement, création d'entreprise, lancement d'un site web,
  organisation d'un événement, mémoire ou thèse, recrutement, salon professionnel ;
- **jours fériés français calculés** (Pâques par algorithme : aucune mise à jour annuelle), affichés en
  période hachurée ; option jours ouvrés (durées hors week-ends et fériés) ;
- vacances scolaires : **pas en base** (dates officielles annuelles) ; l'utilisateur les ajoute en période.

**En plus de Nexora** : export PNG et impression A3/A4 paysage propre, partage en lecture seule
(lien) en option ultérieure.

**Points d'attention** : porter le moteur (≈ 960 lignes) sans dépendre de React ni de Nexora ; la clé
`nexora:quickPlans` et les styles Bauhaus/Épuré existent déjà ; garder le style Bauhaus QME. Taille L.

---

## T03 · Gestionnaire de tâches

**Pour qui** : indépendants, étudiants, particuliers organisés ; ceux qui ont abandonné Todoist ou Notion
(trop d'options ou abonnement).

**Ce qu'il reprend des tâches de Nexora** (`src/donnees/modele.ts`, écrans Focus, Semaine, Archive) :
- **projets** colorés rangés en dossiers ; **statuts** personnalisables ; **types** de tâche ;
- **criticité** et **focus du jour** (les 3 à 5 tâches qui comptent aujourd'hui) ;
- échéances avec heure, **durée estimée**, **sous-tâches en liste à cocher**, **récurrence** ;
- **dépendances** simples (« après »), description, pièces jointes (option, stockage à prévoir) ;
- vues **Liste**, **Kanban par statut**, **Semaine** (agenda), **Focus** ;
- **archive restaurable** (une tâche supprimée est archivée) ; recherche et filtres.

**Saisie rapide** : `Appeler la banque demain 14h !haute #Perso 30min` (date en français naturel,
criticité, projet, durée).

**Base intégrée** :
- modèles de projets : démarches administratives de l'année (impôts, assurances, contrôle technique,
  renouvellements de papiers), rentrée scolaire, freelance (prospection, facturation, relances),
  maison (saisons), étudiant (semestre) ;
- jeux de statuts et de types préréglés (simple, Kanban, GTD).

**Points d'attention** : rester plus simple que Nexora (pas d'équipe, pas de connecteurs) ; récurrence
correcte (fin de mois, jours ouvrés). Taille M.

---

## T04 · Nutrition et dépense énergétique

**Pour qui** : personnes qui veulent perdre, maintenir ou prendre du poids sans application à
abonnement ni publicité ; sportifs amateurs.

**Inspiré de NutriQuest** (facteur calorique de Nexora : calories mangées ÷ calories dépensées, objectif
≤ 1), mais **sans IA ni connexion à une montre** : tout est saisi à la main, la base est dans le template.

**Journal des repas** :
- repas de la journée (petit-déjeuner, déjeuner, dîner, collations) ; ajout d'un aliment par **recherche
  dans la base intégrée**, quantité en grammes ou en **portions types** (1 œuf, 1 tranche de pain,
  1 yaourt, 1 verre) ;
- favoris, **repas enregistrés** (« mon petit-déjeuner habituel »), copie de la veille, aliments perso ;
- totaux du jour : kcal, protéines, glucides, lipides, fibres, sucres, sel ; cibles par macro.

**Base aliments intégrée** : table **Ciqual de l'ANSES** (environ 3 000 aliments, valeurs pour 100 g),
réduite aux colonnes utiles, avec un jeu de portions types. *À vérifier avant développement : licence
de réutilisation (Licence Ouverte attendue) et mention de la source dans l'application.*

**Module dépense énergétique** :
- profil : sexe, âge, taille, **poids** (courbe de poids), **niveau d'activité** hors sport ;
- **métabolisme de base** (formule de Mifflin-St Jeor) :
  homme `10 × poids(kg) + 6,25 × taille(cm) − 5 × âge + 5`, femme même formule `− 161` ;
- **dépense journalière** = métabolisme de base × facteur d'activité : sédentaire 1,2 ; légèrement actif
  1,375 ; modérément actif 1,55 ; très actif 1,725 ; extrêmement actif 1,9 ;
- **sport ajouté** par l'utilisateur : liste intégrée d'activités avec leur **MET** (Compendium of Physical
  Activities) ; calories = `(MET − 1) × poids(kg) × durée(h)` ajoutées à la dépense du jour.
  Le « − 1 » retire la dépense de repos déjà comptée dans le métabolisme ; le niveau d'activité choisi
  doit donc décrire la vie **hors séances de sport** (le dire clairement dans l'interface) ;
- si l'utilisateur ne donne que son poids : estimation dégradée signalée comme telle (taille, âge et sexe
  améliorent nettement le calcul).

**Bilan** : facteur calorique du jour et de la semaine (mangé ÷ dépensé), objectif (perte, maintien,
prise, en % de déficit ou d'excédent), moyenne sur 7 jours, macros, courbe de poids.

**Points d'attention** : avertissement santé (ne remplace pas un avis médical ; pas de cible sous un
plancher raisonnable) ; taille de la base (charger à la demande, recherche rapide insensible aux
accents) ; valider la palette des graphiques. Taille L.

---

## T05 à T22 · Idées de la liste initiale (12/11/2026)

| N° | Idée | Base intégrée prévue |
|----|------|----------------------|
| T05 | Budget du foyer : dépenses → tableau de bord, écart au budget | Catégories et sous-catégories, règle 50/30/20 |
| T06 | Repas de la semaine et liste de courses générée | 100 recettes avec ingrédients et quantités |
| T07 | Carnet de musculation : volume, records, progression | 150 exercices par groupe musculaire |
| T08 | Suivi d'habitudes : séries, taux de réussite | 50 habitudes types |
| T09 | Garde-manger et congélateur : alertes de péremption | Durées de conservation par type d'aliment |
| T10 | Entretien du véhicule : échéances selon le kilométrage | Intervalles types (vidange, freins, pneus, contrôle technique) |
| T11 | Entretien de la maison : calendrier automatique | 80 tâches avec fréquence (chaudière, ramonage, filtres) |
| T12 | Remboursement de dettes : plan et date de fin | Méthodes boule de neige et avalanche |
| T13 | Objectif d'épargne et fonds d'urgence | Scénarios d'intérêts composés (taux saisi par l'utilisateur) |
| T14 | Suivi des abonnements : coût mensuel et annuel, renouvellements | Abonnements courants (streaming, télécom, sport) sans prix figés |
| T15 | Mariage ou événement : rétroplanning, budget, invités, plan de table | Rétroplanning type sur 12 mois, postes de budget |
| T16 | Déménagement : avancement, inventaire des cartons | Checklist sur 8 semaines, démarches types |
| T17 | Suivi de lecture : statistiques, objectifs | Genres, objectifs annuels, notation |
| T18 | Calendrier du potager : semis selon les cultures choisies | 60 légumes : semis, récolte, associations |
| T19 | Suivi du bébé : repas, sommeil, couches, courbes | Courbes de référence poids et taille (source à vérifier) |
| T20 | Animal de compagnie : soins, poids, frais | Calendrier vaccinal et antiparasitaire chien et chat |
| T21 | Préparation de voyage : itinéraire, budget, dépenses partagées | Listes de bagages par type de séjour |
| T22 | Tableau de bord annuel : objectifs trimestriels et score | Domaines de vie, méthode OKR |
