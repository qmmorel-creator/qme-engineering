# Idées de templates QME

Liste vivante des templates prêts à l'emploi à développer et vendre (boutique Gumroad QME, page
`/templates/`). Chaque nouvelle idée de Quentin y est ajoutée dès qu'elle est donnée ; le statut suit le
développement. Développement : skill `.claude/skills/nouveau-template/` (lancé par Quentin, une idée à la fois).

Non publié sur le site (chemin bloqué dans `netlify.toml`).

Sources fusionnées ici : la liste initiale (T01–T22, 12/11/2026) et le backlog de Quentin « 50 outils
prêts à l'emploi à vendre sur Gumroad » (n° 01–50, 12/11/2026). Chaque ligne indique son origine.

**Statuts** : `idée` (une ligne) → `fiche` (fiche détaillée prête à développer) → `en cours` → `prêt`
(testé, PR ouverte) → `en vente` (fiche Gumroad publiée).

**Règles pour toute idée** (tirées du planning de révision) :
- application web à part entière, ouverte avec une clé de licence Gumroad, données synchronisées en ligne ;
- une **base intégrée** qui fait la valeur du produit (un tableau vide se trouve gratuitement) ;
- aucune donnée qui se périme (barèmes, taux, prix, calendriers officiels) sans source datée et plan de
  mise à jour ; préférer ce qui se calcule (jours fériés, dates relatives) ;
- toute base reprise d'une source externe : source et licence vérifiées avant développement ;
- santé et argent : avertissement « ne remplace pas un avis professionnel ».

**Règles ajoutées avec le backlog** :
- **Confidentialité : règle absolue.** Aucune donnée, capture, nom, lieu, montant ou information d'un
  employeur, d'un client ou d'un projet réel dans les produits, leurs exemples, leurs captures ou leur
  communication ; aucune marque tierce. Les artefacts d'origine professionnelle ou nommés d'après un client
  ne servent que d'inspiration de **mécanique** (calculs, écrans), jamais de contenu ; exemples et démo
  fictifs. Lignes marquées **confidentiel** ; **confidentiel à vérifier** quand l'origine de l'artefact
  n'est pas connue (contrôler son contenu avant de s'en inspirer).
- **Aucune marque interne** : les outils personnels de Quentin qui servent de source de code ou
  d'inspiration (son application de pilotage personnelle, son suivi nutritionnel) ne sont jamais nommés
  dans un produit, son nom, ses écrans, sa fiche Gumroad ou sa communication. Chaque template porte un
  nom descriptif propre. Les chemins de code cités dans les fiches sont des repères de développement
  internes, jamais repris dans le produit.
- **Donnée datée** : toute ligne marquée **daté** dépend d'un barème, taux ou règle officielle qui change.
  Mise à jour annuelle obligatoire (source et date affichées dans l'application) ou valeur paramétrable
  par l'utilisateur.
- **Responsabilité** : les lignes marquées **fiscal**, **comptable**, **médical** ou **RGPD** sont des
  outils d'aide, pas un conseil ni un logiciel certifié ; le dire dans l'application, le guide et la
  fiche Gumroad. Données personnelles de tiers (élèves, adhérents, salariés, invités, prospects) :
  rappel des obligations RGPD, et désormais hébergement en ligne (voir « Format »). Données de santé de
  l'acheteur ou de son enfant (T04, T19) : catégorie particulière du RGPD, hébergée en ligne par QME ;
  régime applicable (consentement, hébergement) à vérifier avant développement.

## Format des produits

Le backlog supposait un fichier HTML unique hors ligne, données en `localStorage`, export JSON/CSV.
**Décision appliquée depuis T01 et désormais la norme** : application web hébergée sur
qm-engineering.fr, ouverte avec une clé de licence Gumroad, données synchronisées en ligne, cache local
et fonctionnement hors ligne, installable sur téléphone (manifeste et service worker). Socle commun :
`templates/revision/` (le « socle technique commun » demandé en tête de l'ordre du backlog existe donc
déjà).

- **Tableur** : seulement en option complémentaire quand le backlog prévoit `HTML+tableur`
  (T25, T30, T41, T47, T49, T53, T56, T57, T60). Les idées prévues en tableur seul (T28, T32, T36, T37,
  T40, T44, T45, T59, T61) passent par défaut en application web ; garder un modèle tableur reste à
  trancher par Quentin.
- **Remarques du backlog devenues caduques** :
  - limite `localStorage` d'environ 5 Mo pour les photos (T26) → stockage en ligne des photos à prévoir
    (le stockage actuel des templates ne gère que des données JSON) ;
  - « mono-utilisateur en localStorage » (T46) → un usage partagé est désormais possible (mêmes
    données sur plusieurs appareils), mais un usage **à plusieurs personnes** (droits, conflits,
    lecture seule) reste à concevoir ; idem T15 (RSVP des invités), T48 (affichage public), T62 (couple) ;
  - « stockage local uniquement » pour les données d'élèves (T51) → les données sont désormais en
    ligne : la question RGPD devient plus lourde, à trancher avant développement ;
  - argument « hors ligne » face aux concurrents (T03, T29) → l'argument devient : achat unique, sans
    abonnement, sur tous les appareils, utilisable hors ligne grâce au cache.

## Tableau de bord

| N° | Template | Catégorie | Cible | Statut | Prix | Taille | Priorité | Origine |
|----|----------|-----------|-------|--------|-----------|--------|----------|---------|
| T01 | Planning de révision | Études | Lycéens, étudiants, candidats aux concours | en vente | 14,90 € | M | — | Liste initiale 12/11/2026 |
| T02 | Planning Gantt rapide (chemin critique, jalons à plage) | Gestion de projet | Artisans, PME, chefs de projet, BTP, ingénierie | fiche | 45 € | L | P1 | Quentin 12/11/2026 + Backlog Quentin n° 03 |
| T03 | Gestionnaire de tâches (inbox et triage) | Tâches | Indépendants, cadres, étudiants | fiche | 19 € | M | P1 | Quentin 12/11/2026 + Backlog Quentin n° 01 |
| T04 | Nutrition et dépense énergétique | Santé | Personnes qui gèrent leur poids, sportifs amateurs | fiche | 19 € | L | P1 | Quentin 12/11/2026 + Backlog Quentin n° 47 |
| T05 | Budget du foyer | Budget perso | Particuliers | idée | 15 € | M | P1 | Liste initiale 12/11/2026 + Backlog Quentin n° 43 |
| T06 | Repas de la semaine et liste de courses | Cuisine | Familles, particuliers | idée | 13 € | M | P2 | Liste initiale 12/11/2026 |
| T07 | Carnet de musculation et cross-training | Sport | Pratiquants, coachs | idée | 19 € | M | P2 | Liste initiale 12/11/2026 + Backlog Quentin n° 48 |
| T08 | Suivi d'habitudes et routines | Personnel | Particuliers | idée | 12 € | S | P2 | Liste initiale 12/11/2026 + Backlog Quentin n° 46 |
| T09 | Garde-manger et dates de péremption | Maison | Familles | idée | 10 € | S | P3 | Liste initiale 12/11/2026 |
| T10 | Entretien du véhicule | Véhicule | Particuliers | idée | 10 € | S | P2 | Liste initiale 12/11/2026 |
| T11 | Entretien de la maison | Maison | Propriétaires, locataires | idée | 10 € | S | P2 | Liste initiale 12/11/2026 |
| T12 | Remboursement de dettes | Budget perso | Particuliers endettés | idée | 10 € | S | P2 | Liste initiale 12/11/2026 |
| T13 | Objectif d'épargne | Budget perso | Particuliers | idée | 10 € | S | P3 | Liste initiale 12/11/2026 |
| T14 | Suivi des abonnements | Budget perso | Particuliers | idée | 8 € | S | P2 | Liste initiale 12/11/2026 |
| T15 | Organisateur de mariage | Événementiel perso | Futurs mariés | idée | 29 € | M | P1 | Liste initiale 12/11/2026 + Backlog Quentin n° 28 |
| T16 | Déménagement | Personnel | Particuliers qui déménagent | idée | 10 € | S | P3 | Liste initiale 12/11/2026 |
| T17 | Suivi de lecture | Loisirs | Lecteurs | idée | 8 € | S | P3 | Liste initiale 12/11/2026 |
| T18 | Calendrier du potager | Jardin | Jardiniers amateurs | idée | 13 € | M | P3 | Liste initiale 12/11/2026 |
| T19 | Suivi du bébé | Famille | Jeunes parents | idée | 13 € | M | P3 | Liste initiale 12/11/2026 |
| T20 | Suivi d'un animal de compagnie | Animaux | Propriétaires de chien ou de chat | idée | 10 € | S | P3 | Liste initiale 12/11/2026 |
| T21 | Préparation de voyage | Voyage | Voyageurs, groupes d'amis | idée | 10 € | S | P3 | Liste initiale 12/11/2026 |
| T22 | Tableau de bord annuel et roue de vie | Personnel | Particuliers, coachs | idée | 15 € | M | P3 | Liste initiale 12/11/2026 + Backlog Quentin n° 50 |
| T23 | Planner horaire time-blocking | Emploi du temps | Cadres, freelances | idée | 15 € | M | P1 | Backlog Quentin n° 02 |
| T24 | Compte rendu → plan d'actions | Réunions | Managers, chefs de projet | idée | 15 € | S | P1 | Backlog Quentin n° 04 |
| T25 | Registre des visas documentaires | BTP / ingénierie | MOE, bureaux d'études, OPC | idée | 39 € | M | P1 | Backlog Quentin n° 05 |
| T26 | Levée de réserves (OPR) | BTP | Conducteurs de travaux, MOE, syndics | idée | 39 € | M | P1 | Backlog Quentin n° 06 |
| T27 | Pilotage d'une journée de bascule | Opérations | Responsables production, IT, logistique | idée | 29 € | M | P2 | Backlog Quentin n° 07 |
| T28 | Tableau de bord de pilotage PME | Direction | Dirigeants TPE/PME | idée | 39 € | M | P2 | Backlog Quentin n° 08 |
| T29 | CRM freelance | Commercial | Freelances, consultants | idée | 25 € | M | P1 | Backlog Quentin n° 09 |
| T30 | Pipeline de prospection B2B | Commercial | Commerciaux, indépendants B2B | idée | 25 € | M | P1 | Backlog Quentin n° 10 |
| T31 | Générateur de devis | Commercial | Artisans, freelances | idée | 29 € | M | P1 | Backlog Quentin n° 11 |
| T32 | Coût de revient et prix par client | Finance pro | Prestataires de services | idée | 25 € | S | P1 | Backlog Quentin n° 12 |
| T33 | Préparateur d'appel découverte | Commercial | Consultants, commerciaux | idée | 12 € | S | P2 | Backlog Quentin n° 13 |
| T34 | Kit références et plaquette | Marketing | Indépendants, petites agences | idée | 19 € | S | P3 | Backlog Quentin n° 14 |
| T35 | Calculateur TJM freelance | Finance pro | Freelances débutants | idée | 12 € | S | P1 | Backlog Quentin n° 15 |
| T36 | Livre recettes-dépenses micro-entreprise | Comptabilité | Micro-entrepreneurs | idée | 25 € | S | P1 | Backlog Quentin n° 16 |
| T37 | Trésorerie prévisionnelle 12 mois | Comptabilité | TPE, indépendants | idée | 29 € | M | P1 | Backlog Quentin n° 17 |
| T38 | Relance des impayés | Comptabilité | TPE, freelances | idée | 19 € | S | P2 | Backlog Quentin n° 18 |
| T39 | Notes de frais et indemnités kilométriques | Comptabilité | Salariés, indépendants | idée | 15 € | S | P2 | Backlog Quentin n° 19 |
| T40 | Suivi de TVA | Comptabilité | Petites sociétés au réel | idée | 19 € | S | P3 | Backlog Quentin n° 20 |
| T41 | Gestion de parc de postes de travail | IT / moyens généraux | DSI de PME, office managers | idée | 35 € | M | P1 | Backlog Quentin n° 21 |
| T42 | Onboarding / offboarding salarié | RH | RH de PME, managers | idée | 19 € | S | P2 | Backlog Quentin n° 22 |
| T43 | Planning d'équipe et staffing | RH / opérations | Managers d'équipe, agences | idée | 35 € | L | P2 | Backlog Quentin n° 23 |
| T44 | Suivi congés et absences | RH | TPE sans SIRH | idée | 19 € | S | P2 | Backlog Quentin n° 24 |
| T45 | Matrice compétences et formations | RH | Responsables formation, managers | idée | 25 € | S | P3 | Backlog Quentin n° 25 |
| T46 | Réservation de salles et bureaux | Moyens généraux | PME en flex office | idée | 19 € | M | P3 | Backlog Quentin n° 26 |
| T47 | Pilote événementiel complet | Événementiel | Agences événementielles, chargés de communication | idée | 49 € | L | P1 | Backlog Quentin n° 27 |
| T48 | Gestion de compétition sportive | Événementiel sport | Salles de cross-training, clubs, associations | idée | 49 € | L | P2 | Backlog Quentin n° 29 |
| T49 | Inscriptions associatives | Associatif | Associations, centres sociaux, clubs | idée | 29 € | M | P1 | Backlog Quentin n° 30 |
| T50 | Séminaire / offsite | Événementiel | Assistants de direction, RH | idée | 35 € | M | P3 | Backlog Quentin n° 31 |
| T51 | Gestion de classe | Éducation | Enseignants collège et lycée | idée | 25 € | M | P2 | Backlog Quentin n° 32 |
| T52 | Emploi du temps d'établissement | Éducation / formation | Organismes de formation, écoles privées | idée | 45 € | L | P2 | Backlog Quentin n° 33 |
| T53 | Gestion de flotte auto-école | Éducation / flotte | Auto-écoles | idée | 45 € | L | P1 | Backlog Quentin n° 34 |
| T54 | Banque de questions et quiz formateur | Formation | Formateurs, enseignants | idée | 19 € | M | P3 | Backlog Quentin n° 35 |
| T55 | Progression pédagogique | Éducation | Enseignants, formateurs | idée | 15 € | S | P3 | Backlog Quentin n° 36 |
| T56 | Gestion de flotte d'entreprise | Flotte | PME, collectivités | idée | 39 € | M | P1 | Backlog Quentin n° 37 |
| T57 | Pilotage de parcs multi-sites | Exploitation | Exploitants (immobilier, équipements) | idée | 49 € | L | P2 | Backlog Quentin n° 38 |
| T58 | Maintenance préventive (GMAO légère) | Exploitation | Ateliers, services techniques | idée | 39 € | M | P2 | Backlog Quentin n° 39 |
| T59 | Stocks et inventaire | Commerce | Petits commerces, artisans | idée | 25 € | S | P2 | Backlog Quentin n° 40 |
| T60 | Vérifications réglementaires | Conformité | Responsables QHSE, gestionnaires de bâtiments | idée | 35 € | M | P2 | Backlog Quentin n° 41 |
| T61 | Location saisonnière | Immobilier | Propriétaires de meublés | idée | 25 € | S | P2 | Backlog Quentin n° 42 |
| T62 | Budget commun couple / colocation | Budget perso | Couples, colocataires | idée | 15 € | S | P1 | Backlog Quentin n° 44 |
| T63 | Simulateur leasing vs achat | Budget perso | Particuliers, indépendants | idée | 10 € | S | P2 | Backlog Quentin n° 45 |
| T64 | Pilote de travaux maison | Habitat | Particuliers en rénovation | idée | 25 € | M | P1 | Backlog Quentin n° 49 |

**Taille** : pour T01–T22, S ≈ une session de développement, M ≈ deux, L ≈ trois ou plus ; pour les
idées du backlog, effort estimé par Quentin (S < 1 jour, M 1 à 3 jours, L > 3 jours), repris tel quel.
**Prix** : un prix par idée, en euros ronds (sauf T01, déjà en vente à 14,90 €), à confirmer par Quentin avant la création de chaque fiche Gumroad. Quand la
liste initiale et le backlog divergeaient (T02, T03, T04, T05, T07, T08, T15, T22), le prix du backlog est
retenu : plus récent, périmètre élargi par la fusion. **Priorité** : P1 = à produire en premier, puis P2,
P3. Backlog : priorité de Quentin reprise. Liste initiale sans priorité : attribuée selon la demande
attendue, la taille et le risque (médical, données datées) ; T04 passe en P1 (fiche validée).

## Fusions

Une idée du backlog qui recouvre une idée existante garde le numéro existant ; la fiche ou la ligne de
détail reprend les apports du backlog.

| Backlog n° | Fusionné dans | Décision |
|------------|---------------|----------|
| 01 Inbox & Triage Pro | T03 | Même produit. T03 gagne le triage Eisenhower, le rituel du matin, la clôture du soir et la vue « Aujourd'hui » (proche du Focus). |
| 03 Gantt + chemin critique | T02 | Même produit. T02 gagne le calcul du chemin critique (CPM), les jalons à plage et l'export PDF A3. Produit phare B2B. |
| 43 Budget personnel mensuel | T05 | Même produit. T05 gagne les enveloppes et le diagramme de Sankey des flux. |
| 46 Carnet de routines | T08 | Même produit. T08 gagne les jours non applicables et la vue mensuelle. |
| 47 Nutrition et menus | T04 | Même produit. T04 gagne les menus types et la liste de courses (lien possible avec T06). |
| 48 Carnet cross-training / musculation | T07 | Même produit. T07 gagne les WOD, les records personnels et le chronomètre. |
| 28 Organisateur de mariage | T15 | T15 devient le produit grand public « mariage » ; l'événementiel professionnel part dans T47. |
| 50 Roue de vie | T22 | Même produit. T22 gagne la roue de vie et le bilan par domaine. |

**Non fusionnés, après examen** :
- 27 Pilote événementiel (T47) : cible professionnelle (agences), prix et taille différents de T15 ; même
  moteur que T15, à produire après lui ou en même temps.
- 31 Séminaire / offsite (T50) : déclinaison de T47 (backlog : « variante de ID 27 »), gardée à part car
  vendue seule et dans le pack événements.
- 49 Pilote de travaux maison (T64) : ce n'est pas un événement ; il réutilise T02 (planning), T31
  (devis) et T26 (réserves).
- 37 Flotte d'entreprise (T56) et 34 Auto-école (T53) : deux produits, une base commune (backlog : à
  produire ensemble) ; T10 (véhicule perso) peut en être une version simplifiée.
- 39 GMAO légère (T58) et 41 Vérifications réglementaires (T60) : proches de T11 (entretien maison) par le
  moteur d'échéances, mais cible professionnelle.
- 44 Budget commun (T62) : distinct de T05 (répartition entre personnes) ; proche du partage de dépenses
  de T21.

## Packs

Prix de pack repris du backlog ; valeur = somme des prix unitaires retenus. Technique à concevoir : un pack Gumroad doit ouvrir plusieurs templates (une clé
par produit ou accès groupé dans `PRODUITS`).

| Pack | Produits | Valeur | Prix |
|------|----------|--------|------|
| Freelance complet | T29, T31, T32, T35, T36, T38 | 135 € | 79 € |
| Chef de projet BTP | T02, T24, T25, T26 | 138 € | 99 € |
| Flotte | T53, T56, T39, T63 | 109 € | 69 € |
| Organisateur d'événements | T47, T15, T50 | 113 € | 69 € |
| Productivité perso | T03, T23, T08, T22 | 61 € | 39 € |

## Ordre de production conseillé

1. T01 : fait (en vente).
2. P1 rapides sans donnée datée : T24, T62, T32, T05 (S dans le backlog, M dans la liste initiale).
   T35 et T36 (S, P1) sont **daté** et **fiscal**/**comptable** : à lancer une fois défini le processus
   de mise à jour annuelle (source officielle, date affichée dans l'application, rappel annuel).
3. T03 (fiche validée, logique déjà écrite dans l'outil interne), puis T02, produit phare B2B, qui ouvre le pack BTP.
4. T04 (fiche validée, logique déjà écrite dans l'outil interne), après décision sur l'hébergement des données de santé (**RGPD**)
   et vérification de la licence Ciqual.
5. P1 de taille M : T23, T25, T26, T29, T30, T31, T37, T41, T15, T49, T56, T64.
6. P1 de taille L : T47, puis T53 avec T56 si ce dernier n'est pas fait.
7. P2, puis P3 (les petites tailles S regroupables en lots).

Les petits P1 viennent d'abord parce qu'ils se font vite sur le socle de T01 et alimentent les packs
freelance et budget. T03 et T04 suivent parce que leurs fiches sont validées et que l'outil interne de Quentin fournit déjà
leur logique. T02 est long, mais c'est le produit phare B2B ; il est placé tôt car T26, T64 et le pack
BTP en dépendent. Les produits à données datées (T35, T36, T39, T40) demandent une mise à jour annuelle : ils
attendent que ce processus existe. Les produits à moteur commun se font ensemble (T53 et T56,
T15 et T47, T25 et T60).

## Livrables par produit

Le skill `nouveau-template` fait foi ; le backlog ajoute des éléments à trancher (voir la dernière
colonne).

| Livrable | Skill | Backlog | Pour l'instant |
|----------|-------|---------|----------------|
| L'outil | Application web, clé de licence | Fichier HTML hors ligne | Application web (skill) |
| Données d'exemple | Mode démo (`?demo`), séparé des données de l'acheteur | Données d'exemple supprimables | Mode démo ; données de départ supprimables en option |
| Guide PDF 2 à 4 pages | Absent | Obligatoire | À trancher |
| Visuels Gumroad 1280 × 720 | 1 couverture + captures du site | 3 visuels de couverture | À trancher (1 ou 3) |
| Vidéo 60 s | Facultative, sur demande | Obligatoire | À trancher |
| Code de lancement −30 % | Absent | Pour le lancement LinkedIn | À trancher (outil Gumroad de codes de réduction disponible) |
| Page du site `#<slug>` | Obligatoire | Absent | Obligatoire |
| Publication LinkedIn | Obligatoire (`linkedin.md`) | Canal de vente cité | Obligatoire |
| Prospects | Obligatoire (`prospects.md`) | Absent | Obligatoire |
| Mise à jour de tout le site | Obligatoire (liste à cocher) | Absent | Obligatoire |

---

## T01 · Planning de révision

En vente : `/templates/revision/`, préfixe `REV`, fiche Gumroad
https://qmengineering.gumroad.com/l/planning-revision (clé de licence activée). Référence d'architecture
pour tous les autres templates.

Communication : page `qm-engineering.fr/templates/#revision`,
[publication LinkedIn](communication/revision/linkedin.md), [prospects](communication/revision/prospects.md).

---

## T02 · Planning Gantt rapide

**Pour qui** : artisans, PME, chefs de projet indépendants, particuliers en rénovation, étudiants en projet
de groupe. Ceux pour qui un logiciel de planification professionnel est trop lourd et un tableur trop pauvre.

**Ce qu'il reprend du planning rapide de l'outil interne de Quentin** (code : `apps/nexora-future-optim/src/optim/planning-rapide/`,
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

**En plus de l'outil interne** : export PNG et impression A3/A4 paysage propre, partage en lecture seule
(lien) en option ultérieure.

**Apports du backlog n° 03** (« Pilote de projet : Gantt + chemin critique », 45 €, L, P1, produit phare
B2B ; cible ajoutée : chefs de projet PME, BTP, ingénierie) :
- **chemin critique** (CPM) : marges totale et libre, tâches critiques mises en évidence ; calcul à
  tester sur des cas réels (backlog) et en tests `node --test` ;
- **jalons à plage** (jalon avec une fenêtre de dates plutôt qu'un jour) ;
- **export PDF A3** (rejoint l'impression A3 ci-dessus).
- Artefacts d'inspiration : « Chemin critique » (artefact professionnel), « Jalons à plage »,
  « Jalons Épuré ». **confidentiel** : mécanique seulement ; aucun nom, tâche, date ou capture repris ;
  modèles de planning fictifs.
- Prix retenu : 45 € (backlog), justifié par le chemin critique et la cible B2B (la liste initiale
  prévoyait 24,90 €).

**Points d'attention** : porter le moteur (≈ 960 lignes) sans dépendre de React ni de l'outil interne ; la clé
`nexora:quickPlans` et les styles Bauhaus/Épuré existent déjà ; garder le style Bauhaus QME. Taille L.

---

## T03 · Gestionnaire de tâches

**Pour qui** : indépendants, étudiants, particuliers organisés ; ceux qui ont abandonné une application de tâches
(trop d'options ou abonnement).

**Ce qu'il reprend des tâches de l'outil interne** (code : `src/donnees/modele.ts`, écrans Focus, Semaine, Archive) :
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

**Apports du backlog n° 01** (« Inbox & Triage Pro », 19 €, M, P1 ; cible ajoutée : cadres) :
- **boîte de réception** : tout ce qui est saisi vite arrive dans une inbox, triée ensuite ;
- **triage Eisenhower** (urgent / important) en complément de la criticité ;
- **rituel du matin** (choisir le focus du jour) et **clôture du soir** (reporter, archiver, bilan) ;
- vue « Aujourd'hui » (à rapprocher de la vue Focus).
- Artefacts d'inspiration : Inbox et triage, Rituel du matin, Clôture du soir, Saisie rapide.
- Marché saturé (applications à abonnement) : vendre l'achat unique sans abonnement (l'argument « hors ligne » du
  backlog devient « tous appareils, utilisable hors ligne »).

**Points d'attention** : rester plus simple que l'outil interne (pas d'équipe, pas de connecteurs) ; récurrence
correcte (fin de mois, jours ouvrés). Taille M.

---

## T04 · Nutrition et dépense énergétique

**Pour qui** : personnes qui veulent perdre, maintenir ou prendre du poids sans application à
abonnement ni publicité ; sportifs amateurs.

**Inspiré du suivi nutritionnel personnel de Quentin** (facteur calorique : calories mangées ÷ calories dépensées, objectif
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

**Apports du backlog n° 47** (« Planificateur nutrition et menus », 19 €, M, P2) :
- **menus types** par objectif (kcal, protéines), à composer avec les aliments de la base ;
- **liste de courses** générée depuis les menus (moteur partageable avec T06) ;
- Artefacts d'inspiration : suivi nutritionnel personnel, menu type 1 500 kcal.
- Priorité retenue : P1 (P2 dans le backlog), car la fiche est validée et l'outil interne fournit la logique.
  Prix retenu : 19 € (backlog ; la liste initiale prévoyait 14,90 €).

**Points d'attention** : **médical** : avertissement santé (ne remplace pas un avis médical ; pas de cible
sous un plancher raisonnable), dans l'application et le guide ; taille de la base (charger à la demande,
recherche rapide insensible aux accents) ; valider la palette des graphiques ; **RGPD** : poids et repas
sont des données de santé de l'acheteur, hébergées en ligne par QME (voir les règles en tête). Taille L.

---

## Détails des idées (T05–T64)

Une ligne par idée sans fiche longue. « Backlog » rappelle prix, effort et priorité de la source quand
ils diffèrent ou complètent le tableau de bord. Marques : **confidentiel**, **daté**, **fiscal**,
**comptable**, **médical**, **RGPD** (voir les règles en tête). Argent et sport : avertissement.

| N° | MVP | Base intégrée envisagée | Artefact d'inspiration | Remarques |
|----|-----|-------------------------|------------------------|-----------|
| T05 | Dépenses → tableau de bord, écart au budget ; enveloppes, prévu/réel, Sankey des flux | Catégories et sous-catégories, règle 50/30/20 | Suivi budget 3 800 €, Sankey | Backlog n° 43 : 15 €, S, P1. Marché concurrentiel : le Sankey distingue. Argent : avertissement. Montants de l'artefact non repris. |
| T06 | Repas de la semaine et liste de courses générée | 100 recettes avec ingrédients et quantités | — | Moteur de liste de courses partageable avec T04. Recettes : source et droits à vérifier. |
| T07 | Carnet de musculation et cross-training : séances, WOD, volume, records, progression, chronomètre | 150 exercices par groupe musculaire ; WOD types à définir | Skills WOD et coach sportif de Quentin | Backlog n° 48 : 19 €, M, P2. Noms de WOD de référence : droits à vérifier. Sport : avertissement (pas un programme médical). |
| T08 | Suivi d'habitudes : séries, taux de réussite, jours non applicables, vue mensuelle | 50 habitudes types | Carnet des routines, Rituel du matin | Backlog n° 46 : 12 €, S, P2. |
| T09 | Garde-manger et congélateur : alertes de péremption | Durées de conservation par type d'aliment | — | Durées : source à vérifier. |
| T10 | Entretien du véhicule : échéances selon le kilométrage | Intervalles types (vidange, freins, pneus, contrôle technique) | — | **daté** : périodicité du contrôle technique. Version perso du moteur de T56. |
| T11 | Entretien de la maison : calendrier automatique | 80 tâches avec fréquence (chaudière, ramonage, filtres) | — | **daté** si une fréquence est légale (ramonage, chaudière) : source ou paramétrable. Moteur commun avec T58. |
| T12 | Remboursement de dettes : plan et date de fin | Méthodes boule de neige et avalanche | — | Argent : avertissement. |
| T13 | Objectif d'épargne et fonds d'urgence | Scénarios d'intérêts composés (taux saisi par l'utilisateur) | — | Aucun taux de livret en base (**daté**). Argent : avertissement. |
| T14 | Suivi des abonnements : coût mensuel et annuel, renouvellements | Abonnements courants (streaming, télécom, sport) sans prix figés | — | — |
| T15 | Mariage : budget, prestataires, invités et RSVP, plan de table, rétroplanning 12 mois | Rétroplanning type sur 12 mois, postes de budget | Organisateur de mariage (artefact client) | Backlog n° 28 : 29 €, M, P1 ; forte demande grand public. Événementiel pro : T47. RSVP par les invités = usage partagé à concevoir. **RGPD** (liste d'invités). |
| T16 | Déménagement : avancement, inventaire des cartons | Checklist sur 8 semaines, démarches types | — | Démarches : vérifier qu'aucune n'est datée. |
| T17 | Suivi de lecture : statistiques, objectifs | Genres, objectifs annuels, notation | — | — |
| T18 | Calendrier du potager : semis selon les cultures choisies | 60 légumes : semis, récolte, associations | — | Source des données de culture à vérifier. |
| T19 | Suivi du bébé : repas, sommeil, couches, courbes | Courbes de référence poids et taille (source à vérifier) | — | **médical** : avertissement ; source et licence des courbes. **RGPD** : données de santé d'un enfant hébergées en ligne. |
| T20 | Animal de compagnie : soins, poids, frais | Calendrier vaccinal et antiparasitaire chien et chat | — | **médical** (vétérinaire) : avertissement ; source à vérifier. **daté** : recommandations vaccinales révisées, source datée ou paramétrable. |
| T21 | Préparation de voyage : itinéraire, budget, dépenses partagées | Listes de bagages par type de séjour | — | Dépenses partagées : moteur commun avec T62. |
| T22 | Tableau de bord annuel : roue de vie, objectifs par domaine, actions trimestrielles, score, bilan | Domaines de vie, méthode OKR | Constellations de vie, roue d'action, objectifs et tâches (outil interne) | Backlog n° 50 : 15 €, S, P3. |
| T23 | Grille 30 min, glisser-déposer, catégories couleur, bilan prévu/réalisé hebdomadaire | Semaines types (cadre, freelance, étudiant), catégories préréglées | Planner horaire, grille de planning, planning rapide (outil interne) | — |
| T24 | Modèle de CR, extraction des actions (qui, quoi, quand), suivi des actions ouvertes entre réunions | Modèles de CR (réunion d'équipe, comité de pilotage, chantier) | Compte rendu en actions | Exemples de CR fictifs. **confidentiel à vérifier** (artefact). **RGPD** (noms des participants). |
| T25 | Registre par lot et indice, statuts, délais contractuels, relances, tableau de bord | Statuts de visa (VSO, VAO, REF), lots BTP types, délais paramétrables | Registre des visas, Fiche visa | Format : application + modèle tableur. Niche solvable ; vocabulaire métier à respecter. **confidentiel** : aucun document, lot ou nom de projet réel ; exemples fictifs. |
| T26 | Liste par lot et localisation, photo, entreprise, échéance, statut, PV imprimable | Lots BTP types, modèle de PV de levée | Levée réserves lot 2B | **confidentiel à vérifier** (artefact) ; exemples fictifs. Caduque : limite localStorage ~5 Mo → stockage en ligne des photos à prévoir. Moteur réutilisé par T64. |
| T27 | Séquence horaire, responsables, go/no-go, points d'arrêt, journal d'incidents | Séquences types (migration informatique, déménagement de bureaux, ouverture de site) | Tableau de bascule (artefact) | **confidentiel** : exemples fictifs (informatique, bureaux, commerce). |
| T28 | KPI mensuels, objectifs, écarts, graphiques, saisie simple | Jeu de KPI types (CA, marge, pipe, charge) | Tableaux de bord de pilotage (outil interne) | Backlog : tableur seul ; application web par défaut, à trancher. **confidentiel à vérifier** : aucun tableau de bord interne d'origine professionnelle repris. |
| T29 | Fiches clients, historique, prochaine action, statut, CA par client | Statuts et prochaines actions types | Suivi clients (outil interne) | Concurrence de CRM gratuits : simplicité, achat unique. **RGPD** (données clients). Aucun client réel. |
| T30 | Pipeline par étapes, cadence de relance, scripts de messages, taux de conversion | Scripts de messages et cadences de relance | Suivi commercial (artefact client) | Format : application + modèle tableur. Conçu pour la prospection sur les réseaux professionnels, sans marque dans le nom du produit. **RGPD** (prospects). Aucune automatisation d'un réseau social. |
| T31 | Catalogue de prestations, lignes, remises, TVA, mentions légales, PDF | Catalogues de prestations par métier ; mentions obligatoires | Devis artisan, devis et chiffrages clients (artefacts) | **daté** (TVA, mentions) ; **fiscal** : mentions à vérifier ; devis seulement, pas un logiciel de facturation (facturation électronique obligatoire en cours de déploiement : calendrier à vérifier). **RGPD** (clients). Données des devis réels non reprises. |
| T32 | Coûts directs et indirects, temps passé, marge cible, prix plancher, rentabilité par client | à définir | Coûts et prix par client (outil interne) | Backlog : tableur seul ; à trancher. **daté** si les taux de charges de T35 sont repris. Aucun chiffre réel. |
| T33 | Fiche contexte, questions par phase, objections, prochaine étape, résumé imprimable | Banque de questions par phase, objections types | Briefings d'appels clients (artefacts) | Produit d'appel (prix bas). **RGPD** (prospects). Contenus des briefings réels non repris. |
| T34 | Fiches projets, filtres, page imprimable type plaquette | Modèles de fiches projets et de mise en page | Références et plaquette (outils internes) | Références réelles non reprises ; exemples fictifs. |
| T35 | Revenu cible, charges, jours facturables, statut (micro, SASU, EURL), TJM minimum | Taux de charges par statut | Profils freelance (outil interne) | **daté** : taux de charges, mise à jour annuelle obligatoire ; **fiscal**. |
| T36 | Journal, catégories, plafonds, estimation des cotisations, export annuel | Plafonds et taux de cotisation par activité | Suivi budget 3 800 € | **daté** : plafonds et taux URSSAF, mise à jour annuelle obligatoire ; **comptable** : pas un outil certifié ; **fiscal** (plafonds, versement libératoire). Backlog : tableur seul. |
| T37 | Encaissements et décaissements, scénarios, seuil d'alerte, graphique | à définir (scénarios types) | Suivi budget 3 800 €, Sankey | Backlog : tableur seul ; à trancher. **comptable**. Aucune échéance fiscale ou sociale en base sans source datée (**daté**). |
| T38 | Échéancier, retard en jours, pénalités légales, modèles de mails par palier | Modèles de mails par palier de relance | — | **daté** : taux des pénalités (backlog : taux BCE + 10 points, indemnité 40 €, à vérifier) ; paramétrable. **comptable**. **RGPD** (débiteurs, parfois particuliers). |
| T39 | Saisie des frais, barème kilométrique, justificatifs, récapitulatif mensuel PDF | Barème kilométrique | Ma voiture en leasing | **daté** : barème fiscal, mise à jour annuelle obligatoire ; **fiscal**. Justificatifs : stockage de fichiers à prévoir. |
| T40 | TVA collectée et déductible, échéancier, contrôle de cohérence | Échéances par régime (paramétrables) | — | **daté** (taux, échéances) ; **fiscal** : outil d'aide, pas de conseil. Backlog : tableur seul. |
| T41 | Inventaire, affectations, licences, fin de garantie, historique, alertes | Catégories de matériel et types de licences | Poste central | Demandé explicitement. Format : application + modèle tableur. **RGPD** (affectations nominatives). Pack possible avec T42. **confidentiel à vérifier** (artefact « Poste central »). |
| T42 | Checklists par rôle, responsables, échéances de J-15 à J+90, restitution du matériel | Checklists d'arrivée et de départ par rôle | Poste central | **RGPD** (salariés). Couplé à T41. |
| T43 | Affectation par personne et projet, taux de charge, conflits, vues semaine et mois | à définir | Équipes et staffing (outil interne) | Usage à plusieurs (managers) à concevoir. **RGPD**. **confidentiel à vérifier** : aucune équipe ni personne de l'outil interne reprise. |
| T44 | Soldes, demandes, calendrier d'équipe, chevauchements | Règles d'acquisition paramétrables | — | **daté** (règles légales et conventionnelles) : paramétrable. **RGPD**. Backlog : tableur seul. |
| T45 | Matrice personnes × compétences, niveaux, écarts, plan de formation | à définir | — | Backlog : tableur seul. **RGPD**. |
| T46 | Ressources, créneaux, conflits, vue jour | à définir | Planner horaire | Caduque : « mono-utilisateur en localStorage » ; un usage partagé est désormais possible mais réservations à plusieurs à concevoir (droits, conflits). |
| T47 | Rétroplanning, budget prévu/engagé/payé, prestataires et contrats, invités, checklist jour J | Rétroplanning type, postes de budget, checklist jour J | Organisateur de mariage, gestion de compétition, suivi budget (artefacts) | Demandé explicitement ; produit phare du backlog. Format : application + modèle tableur. Même moteur que T15 et T50. **RGPD** (invités). |
| T48 | Inscriptions, catégories, heats, saisie des scores, classement, affichage | Règles de classement paramétrables, catégories types | Gestion de compétition et feuille de route (artefacts client) | Affichage public = partage en lecture seule à concevoir. **RGPD** (participants). |
| T49 | Fiches adhérents, activités, quotient familial, paiements, listes d'appel | Activités types, tranches de quotient familial paramétrables | Inscriptions d'un centre social (artefact client) | **daté** : tranches de quotient familial, paramétrables. **RGPD** (adhérents, mineurs possibles) : obligations dans le guide. Format : application + modèle tableur. **confidentiel** : aucune donnée de l'artefact. |
| T50 | Participants, transports, chambres, régimes, programme, budget | à définir (reprend T47) | Organisateur de mariage (artefact client) | Déclinaison de T47. **RGPD** : régimes alimentaires et allergies sont des données sensibles. |
| T51 | Élèves, évaluations, compétences, moyennes, appréciations, bulletins | à définir | — | **RGPD** (élèves, mineurs). Caduque : « stockage local uniquement » ; les données sont désormais en ligne, à trancher avant développement. Concurrence des logiciels de vie scolaire. |
| T52 | Classes, formateurs, salles, créneaux, détection des conflits, vues par ressource | à définir | Grille de planning, planner horaire (outil interne) | Pas d'optimisation automatique en V1. **RGPD** (formateurs, apprenants). |
| T53 | Véhicules, kilométrage, entretiens, contrôles techniques, moniteurs, planning de leçons, coût par heure | Intervalles d'entretien types | Ma voiture en leasing | Demandé explicitement. Base commune avec T56. **daté** (contrôle technique). **RGPD** (élèves, moniteurs). Format : application + modèle tableur. |
| T54 | Banque de questions taguée, génération de quiz, correction, statistiques | à définir | Banque de questions d'élèves (artefact client) | Contenu de l'artefact non repris. **RGPD** si résultats nominatifs. |
| T55 | Séquences, séances, objectifs, avancement réel et prévu | à définir | Jalons à plage | **confidentiel** : artefact professionnel ; mécanique seulement. |
| T56 | Véhicules, conducteurs, entretiens, sinistres, amendes, leasing, coût total par véhicule | Intervalles d'entretien types | Ma voiture en leasing | Base commune avec T53 et T10. **daté** (contrôle technique). **RGPD** (conducteurs, amendes). Format : application + modèle tableur. |
| T57 | Sites, équipements, interventions, indicateurs, carte ou liste, alertes | à définir | Pilotage de parcs (artefact professionnel) | **confidentiel** : aucune donnée, nom de site ni chiffre ; exemples fictifs (immobilier, équipements). Format : application + modèle tableur. |
| T58 | Équipements, plans de maintenance, échéances, bons d'intervention, historique | Plans de maintenance types | Artefacts professionnels de maintenance | **confidentiel** : mécanique seulement, aucune donnée ; exemples fictifs. **daté** si des périodicités réglementaires sont en base. Moteur commun avec T11 et T60. |
| T59 | Articles, entrées et sorties, seuils d'alerte, valorisation, inventaire | à définir | — | Backlog : tableur seul. |
| T60 | Registre des contrôles, périodicités, échéances, preuves, alertes | Types de contrôles (électricité, extincteurs…) sans périodicité légale non sourcée | Registre des visas | **daté** : périodicités réglementaires, paramétrables ou sourcées. Preuves : stockage de fichiers à prévoir. Format : application + modèle tableur. |
| T61 | Calendrier, réservations, ménage, taxe de séjour, revenus par plateforme | à définir | Location saisonnière (artefact client) | **daté** : taxe de séjour, paramétrable ; **fiscal**. **RGPD** (voyageurs). Backlog : tableur seul. Aucune donnée de l'artefact. |
| T62 | Dépenses communes, répartition au prorata des revenus, soldes, équilibrage | Méthodes de répartition (égale, prorata, personnalisée) | Budget commun, Budget commun partagé | Usage à deux : désormais possible (mêmes données), accès par deux personnes à concevoir. Argent : avertissement. |
| T63 | LOA, LLD, crédit, comptant : coût total, valeur résiduelle, kilométrage | à définir | Ma voiture en leasing | Produit d'appel. Argent : avertissement. **fiscal** pour les indépendants (déductibilité, TVA) : hors calcul ou signalé. |
| T64 | Comparateur de devis d'artisans, budget, planning, réserves de fin de travaux | Postes de travaux types, modèles de planning de rénovation (T02) | Devis artisan, Levée réserves, Chemin critique | Réutilise T26, T31 et T02. **confidentiel** : « Chemin critique » = mécanique seulement. |
