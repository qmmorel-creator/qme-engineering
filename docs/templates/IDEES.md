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
- **CNR : règle absolue.** Aucune donnée, capture ou information liée à la CNR (employeur de Quentin), ni
  à l'hydroélectricité ou à l'énergie de la CNR, dans les produits, leurs exemples, leurs captures ou leur
  communication. Les artefacts qui évoquent PCH, CTEX, barrage, DREAL (« Chemin critique PCH VA »,
  « Déversoir sur clapet ») ne servent que d'inspiration de **mécanique** (calculs, écrans), jamais de
  contenu. Les lignes concernées portent la mention **CNR**.
- **Aucune donnée réelle tirée des artefacts** (clients, montants, noms, lieux) : les artefacts nommés
  d'après un client ou un lieu (Givry, Charpennes Tonkin, Antarès, Vigiski, BikePulse Gear, Nozze
  Maestria, GLHF, Vensolair…) ne donnent que la mécanique. Exemples et démo : fictifs.
- **Donnée datée** : toute ligne marquée **daté** dépend d'un barème, taux ou règle officielle qui change.
  Mise à jour annuelle obligatoire (source et date affichées dans l'application) ou valeur paramétrable
  par l'utilisateur.
- **Responsabilité** : les lignes marquées **fiscal**, **comptable**, **médical** ou **RGPD** sont des
  outils d'aide, pas un conseil ni un logiciel certifié ; le dire dans l'application, le guide et la
  fiche Gumroad. Données personnelles de tiers (élèves, adhérents, salariés, invités, prospects) :
  rappel des obligations RGPD, et désormais hébergement en ligne (voir « Format »).

## Format des produits

Le backlog supposait un fichier HTML unique hors ligne, données en `localStorage`, export JSON/CSV.
**Décision appliquée depuis T01 et désormais la norme** : application web hébergée sur
qm-engineering.fr, ouverte avec une clé de licence Gumroad, données synchronisées en ligne, cache local
et fonctionnement hors ligne, installable sur téléphone (manifeste et service worker). Socle commun :
`templates/revision/` (le « socle technique commun » demandé en tête de l'ordre du backlog existe donc
déjà).

- **Sheets / Excel** : seulement en option complémentaire quand le backlog prévoit `HTML+Sheets`
  (T25, T30, T41, T47, T49, T53, T56, T57, T60). Les idées prévues en `Sheets` seul (T28, T32, T36, T37,
  T40, T44, T45, T59, T61) passent par défaut en application web ; garder un modèle Sheets reste à
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

| N° | Template | Catégorie | Cible | Statut | Prix visé | Taille | Priorité | Origine |
|----|----------|-----------|-------|--------|-----------|--------|----------|---------|
| T01 | Planning de révision | Études | Lycéens, étudiants, candidats aux concours | en vente | 14,90 € | M | — | Liste initiale 12/11/2026 |
| T02 | Planning Gantt rapide (chemin critique, jalons à plage) | Gestion de projet | Artisans, PME, chefs de projet, BTP, ingénierie | fiche | 24,90 € (backlog : 45 €) | L | P1 | Quentin 12/11/2026 + Backlog Quentin n° 03 |
| T03 | Gestionnaire de tâches (inbox et triage) | Tâches | Indépendants, cadres, étudiants | fiche | 19,90 € (backlog : 19 €) | M | P1 | Quentin 12/11/2026 + Backlog Quentin n° 01 |
| T04 | Nutrition et dépense énergétique | Santé | Personnes qui gèrent leur poids, sportifs amateurs | fiche | 14,90 € (backlog : 19 €) | L | P1 (backlog : P2) | Quentin 12/11/2026 + Backlog Quentin n° 47 |
| T05 | Budget du foyer | Budget perso | Particuliers | idée | 14,90 € (backlog : 15 €) | M | P1 | Liste initiale 12/11/2026 + Backlog Quentin n° 43 |
| T06 | Repas de la semaine et liste de courses | Cuisine | Familles, particuliers | idée | 12,90 € | M | à fixer | Liste initiale 12/11/2026 |
| T07 | Carnet de musculation et CrossFit | Sport | Pratiquants, coachs | idée | 12,90 € (backlog : 19 €) | M | P2 | Liste initiale 12/11/2026 + Backlog Quentin n° 48 |
| T08 | Suivi d'habitudes et routines | Personnel | Particuliers | idée | 9,90 € (backlog : 12 €) | S | P2 | Liste initiale 12/11/2026 + Backlog Quentin n° 46 |
| T09 | Garde-manger et dates de péremption | Maison | Familles | idée | 9,90 € | S | à fixer | Liste initiale 12/11/2026 |
| T10 | Entretien du véhicule | Véhicule | Particuliers | idée | 9,90 € | S | à fixer | Liste initiale 12/11/2026 |
| T11 | Entretien de la maison | Maison | Propriétaires, locataires | idée | 9,90 € | S | à fixer | Liste initiale 12/11/2026 |
| T12 | Remboursement de dettes | Budget perso | Particuliers endettés | idée | 9,90 € | S | à fixer | Liste initiale 12/11/2026 |
| T13 | Objectif d'épargne | Budget perso | Particuliers | idée | 9,90 € | S | à fixer | Liste initiale 12/11/2026 |
| T14 | Suivi des abonnements | Budget perso | Particuliers | idée | 7,90 € | S | à fixer | Liste initiale 12/11/2026 |
| T15 | Organisateur de mariage | Événementiel perso | Futurs mariés | idée | 19,90 € (backlog : 29 €) | M | P1 | Liste initiale 12/11/2026 + Backlog Quentin n° 28 |
| T16 | Déménagement | Personnel | Particuliers qui déménagent | idée | 9,90 € | S | à fixer | Liste initiale 12/11/2026 |
| T17 | Suivi de lecture | Loisirs | Lecteurs | idée | 7,90 € | S | à fixer | Liste initiale 12/11/2026 |
| T18 | Calendrier du potager | Jardin | Jardiniers amateurs | idée | 12,90 € | M | à fixer | Liste initiale 12/11/2026 |
| T19 | Suivi du bébé | Famille | Jeunes parents | idée | 12,90 € | M | à fixer | Liste initiale 12/11/2026 |
| T20 | Suivi d'un animal de compagnie | Animaux | Propriétaires de chien ou de chat | idée | 9,90 € | S | à fixer | Liste initiale 12/11/2026 |
| T21 | Préparation de voyage | Voyage | Voyageurs, groupes d'amis | idée | 9,90 € | S | à fixer | Liste initiale 12/11/2026 |
| T22 | Tableau de bord annuel et roue de vie | Personnel | Particuliers, coachs | idée | 12,90 € (backlog : 15 €) | M | P3 | Liste initiale 12/11/2026 + Backlog Quentin n° 50 |
| T23 | Planner horaire time-blocking | Emploi du temps | Cadres, freelances | idée | 15 € | M | P1 | Backlog Quentin n° 02 |
| T24 | Compte rendu → plan d'actions | Réunions | Managers, chefs de projet | idée | 15 € | S | P1 | Backlog Quentin n° 04 |
| T25 | Registre des visas documentaires | BTP / ingénierie | MOE, bureaux d'études, OPC | idée | 39 € | M | P1 | Backlog Quentin n° 05 |
| T26 | Levée de réserves (OPR) | BTP | Conducteurs de travaux, MOE, syndics | idée | 39 € | M | P1 | Backlog Quentin n° 06 |
| T27 | Changeover Day Board | Opérations | Responsables production, IT, logistique | idée | 29 € | M | P2 | Backlog Quentin n° 07 |
| T28 | Tableau de bord de pilotage PME | Direction | Dirigeants TPE/PME | idée | 39 € | M | P2 | Backlog Quentin n° 08 |
| T29 | CRM freelance | Commercial | Freelances, consultants | idée | 25 € | M | P1 | Backlog Quentin n° 09 |
| T30 | Pipeline de prospection LinkedIn | Commercial | Commerciaux, indépendants B2B | idée | 25 € | M | P1 | Backlog Quentin n° 10 |
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
| T48 | Gestion de compétition sportive | Événementiel sport | Box CrossFit, clubs, associations | idée | 49 € | L | P2 | Backlog Quentin n° 29 |
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
**Prix visés** indicatifs, à confirmer par Quentin avant la création de chaque fiche Gumroad. Quand les
deux sources divergent, les deux prix sont indiqués : à trancher. **Priorité** : P1 = à produire en
premier, P2, P3 (backlog) ; « à fixer » = idée de la liste initiale sans priorité donnée.

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
| 48 Carnet CrossFit / musculation | T07 | Même produit. T07 gagne les WOD, les records personnels et le chronomètre. |
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

Prix de pack repris du backlog. Les prix unitaires ayant changé pour les idées fusionnées, la valeur du
pack est à recalculer. Technique à concevoir : un pack Gumroad doit ouvrir plusieurs templates (une clé
par produit ou accès groupé dans `PRODUITS`).

| Pack | Produits | Prix |
|------|----------|------|
| Freelance complet | T29, T31, T32, T35, T36, T38 | 79 € |
| Chef de projet BTP | T02, T24, T25, T26 | 99 € |
| Flotte | T53, T56, T39, T63 | 69 € |
| Organisateur d'événements | T47, T15, T50 | 69 € |
| Productivité perso | T03, T23, T08, T22 | 39 € |

## Ordre de production conseillé

1. T01 : fait (en vente).
2. P1 rapides (S) : T24, T35, T32, T36, T05, T62.
3. T03 (fiche validée, base Nexora), puis T02, produit phare B2B, qui ouvre le pack BTP.
4. T04 (fiche validée, base Nexora).
5. P1 de taille M : T23, T25, T26, T29, T30, T31, T37, T41, T15, T49, T56, T64.
6. P1 de taille L : T47, puis T53 avec T56 si ce dernier n'est pas fait.
7. P2, puis P3, puis les idées « à fixer » (regroupables en lots de S).

Les petits P1 viennent d'abord parce qu'ils se font vite sur le socle de T01 et alimentent les packs
freelance et budget. T03 et T04 suivent parce que leurs fiches sont validées et que Nexora fournit déjà
leur logique. T02 est long, mais c'est le produit phare B2B ; il est placé tôt car T26, T64 et le pack
BTP en dépendent. Les produits à données datées (T35, T36) demandent une mise à jour annuelle : à
prendre en compte avant de les multiplier. Les produits à moteur commun se font ensemble (T53 et T56,
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

**Apports du backlog n° 03** (« Pilote de projet : Gantt + chemin critique », 45 €, L, P1, produit phare
B2B ; cible ajoutée : chefs de projet PME, BTP, ingénierie) :
- **chemin critique** (CPM) : marges totale et libre, tâches critiques mises en évidence ; calcul à
  tester sur des cas réels (backlog) et en tests `node --test` ;
- **jalons à plage** (jalon avec une fenêtre de dates plutôt qu'un jour) ;
- **export PDF A3** (rejoint l'impression A3 ci-dessus).
- Artefacts d'inspiration : « Chemin critique PCH VA », « Jalons à plage », « Jalons Épuré ».
  **CNR** : « Chemin critique PCH VA » ne sert que d'inspiration de mécanique ; aucun nom, tâche, date ou
  capture n'en est repris, et aucun modèle de planning n'évoque l'hydroélectricité.
- Prix : 24,90 € (fiche) contre 45 € (backlog), à trancher ; l'ajout du CPM et la cible B2B vont dans le
  sens du prix haut.

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

**Apports du backlog n° 01** (« Inbox & Triage Pro », 19 €, M, P1 ; cible ajoutée : cadres) :
- **boîte de réception** : tout ce qui est saisi vite arrive dans une inbox, triée ensuite ;
- **triage Eisenhower** (urgent / important) en complément de la criticité ;
- **rituel du matin** (choisir le focus du jour) et **clôture du soir** (reporter, archiver, bilan) ;
- vue « Aujourd'hui » (à rapprocher de la vue Focus).
- Artefacts d'inspiration : Inbox et triage, Rituel du matin, Clôture du soir, Saisie rapide.
- Marché saturé (Todoist, Notion) : vendre l'achat unique sans abonnement (l'argument « hors ligne » du
  backlog devient « tous appareils, utilisable hors ligne »).

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

**Apports du backlog n° 47** (« Planificateur nutrition et menus », 19 €, M, P2) :
- **menus types** par objectif (kcal, protéines), à composer avec les aliments de la base ;
- **liste de courses** générée depuis les menus (moteur partageable avec T06) ;
- Artefacts d'inspiration : NutriQuest, Menu type 1 500 kcal.
- Priorité : P2 dans le backlog, mais T04 est placé tôt dans l'ordre conseillé (fiche validée, base
  Nexora) ; à confirmer par Quentin. Prix : 14,90 € (fiche) contre 19 € (backlog), à trancher.

**Points d'attention** : **médical** : avertissement santé (ne remplace pas un avis médical ; pas de cible
sous un plancher raisonnable), dans l'application et le guide ; taille de la base (charger à la demande,
recherche rapide insensible aux accents) ; valider la palette des graphiques. Taille L.

---

## Détails des idées (T05–T64)

Une ligne par idée sans fiche longue. « Backlog » rappelle prix, effort et priorité de la source quand
ils diffèrent ou complètent le tableau de bord. Marques : **CNR**, **daté**, **fiscal**, **comptable**,
**médical**, **RGPD** (voir les règles en tête).

| N° | MVP | Base intégrée envisagée | Artefact d'inspiration | Remarques |
|----|-----|-------------------------|------------------------|-----------|
| T05 | Dépenses → tableau de bord, écart au budget ; enveloppes, prévu/réel, Sankey des flux | Catégories et sous-catégories, règle 50/30/20 | Suivi budget 3 800 €, Sankey | Backlog n° 43 : 15 €, S, P1. Marché concurrentiel : le Sankey distingue. Argent : avertissement. Montants de l'artefact non repris. |
| T06 | Repas de la semaine et liste de courses générée | 100 recettes avec ingrédients et quantités | — | Moteur de liste de courses partageable avec T04. Recettes : source et droits à vérifier. |
| T07 | Carnet de musculation et CrossFit : séances, WOD, volume, records, progression, chronomètre | 150 exercices par groupe musculaire ; WOD types à définir | WOD Motion, Coach CrossFit | Backlog n° 48 : 19 €, M, P2. Noms de WOD de référence : droits à vérifier. |
| T08 | Suivi d'habitudes : séries, taux de réussite, jours non applicables, vue mensuelle | 50 habitudes types | Carnet des routines, Rituel du matin | Backlog n° 46 : 12 €, S, P2. |
| T09 | Garde-manger et congélateur : alertes de péremption | Durées de conservation par type d'aliment | — | Durées : source à vérifier. |
| T10 | Entretien du véhicule : échéances selon le kilométrage | Intervalles types (vidange, freins, pneus, contrôle technique) | — | **daté** : périodicité du contrôle technique. Version perso du moteur de T56. |
| T11 | Entretien de la maison : calendrier automatique | 80 tâches avec fréquence (chaudière, ramonage, filtres) | — | **daté** si une fréquence est légale (ramonage, chaudière) : source ou paramétrable. Moteur commun avec T58. |
| T12 | Remboursement de dettes : plan et date de fin | Méthodes boule de neige et avalanche | — | Argent : avertissement. |
| T13 | Objectif d'épargne et fonds d'urgence | Scénarios d'intérêts composés (taux saisi par l'utilisateur) | — | Aucun taux de livret en base (**daté**). |
| T14 | Suivi des abonnements : coût mensuel et annuel, renouvellements | Abonnements courants (streaming, télécom, sport) sans prix figés | — | — |
| T15 | Mariage : budget, prestataires, invités et RSVP, plan de table, rétroplanning 12 mois | Rétroplanning type sur 12 mois, postes de budget | Nozze Maestria | Backlog n° 28 : 29 €, M, P1 ; forte demande grand public. Événementiel pro : T47. RSVP par les invités = usage partagé à concevoir. **RGPD** (liste d'invités). |
| T16 | Déménagement : avancement, inventaire des cartons | Checklist sur 8 semaines, démarches types | — | Démarches : vérifier qu'aucune n'est datée. |
| T17 | Suivi de lecture : statistiques, objectifs | Genres, objectifs annuels, notation | — | — |
| T18 | Calendrier du potager : semis selon les cultures choisies | 60 légumes : semis, récolte, associations | — | Source des données de culture à vérifier. |
| T19 | Suivi du bébé : repas, sommeil, couches, courbes | Courbes de référence poids et taille (source à vérifier) | — | **médical** : avertissement ; source et licence des courbes. |
| T20 | Animal de compagnie : soins, poids, frais | Calendrier vaccinal et antiparasitaire chien et chat | — | **médical** (vétérinaire) : avertissement ; source à vérifier. |
| T21 | Préparation de voyage : itinéraire, budget, dépenses partagées | Listes de bagages par type de séjour | — | Dépenses partagées : moteur commun avec T62. |
| T22 | Tableau de bord annuel : roue de vie, objectifs par domaine, actions trimestrielles, score, bilan | Domaines de vie, méthode OKR | Constellations de vie, Roue d'action d'Optim, Objectifs et tâches | Backlog n° 50 : 15 €, S, P3. |
| T23 | Grille 30 min, glisser-déposer, catégories couleur, bilan prévu/réalisé hebdomadaire | Semaines types (cadre, freelance, étudiant), catégories préréglées | Planner horaire, Grille Planning Optim, Planning rapide | — |
| T24 | Modèle de CR, extraction des actions (qui, quoi, quand), suivi des actions ouvertes entre réunions | Modèles de CR (réunion d'équipe, comité de pilotage, chantier) | Compte rendu en actions | Exemples de CR fictifs, hors énergie. |
| T25 | Registre par lot et indice, statuts, délais contractuels, relances, tableau de bord | Statuts de visa (VSO, VAO, REF), lots BTP types, délais paramétrables | Registre des visas, Fiche visa | Format : application + modèle Sheets. Niche solvable ; vocabulaire métier à respecter. **CNR** : vérifier que l'artefact ne reprend aucun document, lot ou nom de projet CNR ; exemples hors hydroélectricité. |
| T26 | Liste par lot et localisation, photo, entreprise, échéance, statut, PV imprimable | Lots BTP types, modèle de PV de levée | Levée réserves lot 2B | Caduque : limite localStorage ~5 Mo → stockage en ligne des photos à prévoir. Moteur réutilisé par T64. |
| T27 | Séquence horaire, responsables, go/no-go, points d'arrêt, journal d'incidents | Séquences types (migration informatique, déménagement de bureaux, ouverture de site) | Changeover Day Board | **CNR** : exemples hors mise en service d'ouvrages énergétiques. |
| T28 | KPI mensuels, objectifs, écarts, graphiques, saisie simple | Jeu de KPI types (CA, marge, pipe, charge) | Pilotage QME, Nexora Tableaux de bord | Backlog : Sheets seul ; application web par défaut, à trancher. |
| T29 | Fiches clients, historique, prochaine action, statut, CA par client | Statuts et prochaines actions types | Suivi clients QME | Concurrence de CRM gratuits : simplicité, achat unique. **RGPD** (données clients). Aucun client QME réel. |
| T30 | Pipeline par étapes, cadence de relance, scripts de messages, taux de conversion | Scripts de messages et cadences de relance | Suivi commercial BikePulse Gear | Format : application + modèle Sheets. Cohérent avec le canal LinkedIn. **RGPD** (prospects). Pas d'automatisation de LinkedIn. |
| T31 | Catalogue de prestations, lignes, remises, TVA, mentions légales, PDF | Catalogues de prestations par métier ; mentions obligatoires | Devis artisan, Devis Givry, Chiffrage Charpennes Tonkin | **daté** (TVA, mentions) ; **fiscal** : mentions à vérifier ; pas un logiciel de facturation. Données des devis réels non reprises. |
| T32 | Coûts directs et indirects, temps passé, marge cible, prix plancher, rentabilité par client | à définir | QME · Coûts et prix par client | Backlog : Sheets seul ; à trancher. Aucun chiffre QME réel. |
| T33 | Fiche contexte, questions par phase, objections, prochaine étape, résumé imprimable | Banque de questions par phase, objections types | Briefing appel Antarès / Givry / Charpennes | Produit d'appel (prix bas). Contenus des briefings réels non repris. |
| T34 | Fiches projets, filtres, page imprimable type plaquette | Modèles de fiches projets et de mise en page | Références QME, Plaquette QME | Références QME réelles non reprises (sauf exemples fictifs). |
| T35 | Revenu cible, charges, jours facturables, statut (micro, SASU, EURL), TJM minimum | Taux de charges par statut | Profils freelance QME | **daté** : taux de charges, mise à jour annuelle obligatoire ; **fiscal**. |
| T36 | Journal, catégories, plafonds, estimation des cotisations, export annuel | Plafonds et taux de cotisation par activité | Suivi budget 3 800 € | **daté** : plafonds et taux URSSAF, mise à jour annuelle obligatoire ; **comptable** : pas un outil certifié. Backlog : Sheets seul. |
| T37 | Encaissements et décaissements, scénarios, seuil d'alerte, graphique | à définir (scénarios types) | Suivi budget 3 800 €, Sankey | Backlog : Sheets seul ; à trancher. **comptable**. |
| T38 | Échéancier, retard en jours, pénalités légales, modèles de mails par palier | Modèles de mails par palier de relance | — | **daté** : taux des pénalités (backlog : taux BCE + 10 points, indemnité 40 €, à vérifier) ; paramétrable. **comptable**. |
| T39 | Saisie des frais, barème kilométrique, justificatifs, récapitulatif mensuel PDF | Barème kilométrique | Ma voiture en leasing | **daté** : barème fiscal, mise à jour annuelle obligatoire ; **fiscal**. Justificatifs : stockage de fichiers à prévoir. |
| T40 | TVA collectée et déductible, échéancier, contrôle de cohérence | Échéances par régime (paramétrables) | — | **daté** (taux, échéances) ; **fiscal** : outil d'aide, pas de conseil. Backlog : Sheets seul. |
| T41 | Inventaire, affectations, licences, fin de garantie, historique, alertes | Catégories de matériel et types de licences | Poste central | Demandé explicitement. Format : application + modèle Sheets. **RGPD** (affectations nominatives). Pack possible avec T42. |
| T42 | Checklists par rôle, responsables, échéances de J-15 à J+90, restitution du matériel | Checklists d'arrivée et de départ par rôle | Poste central | **RGPD** (salariés). Couplé à T41. |
| T43 | Affectation par personne et projet, taux de charge, conflits, vues semaine et mois | à définir | Nexora (équipes et staffing) | Usage à plusieurs (managers) à concevoir. **RGPD**. |
| T44 | Soldes, demandes, calendrier d'équipe, chevauchements | Règles d'acquisition paramétrables | — | **daté** (règles légales et conventionnelles) : paramétrable. **RGPD**. Backlog : Sheets seul. |
| T45 | Matrice personnes × compétences, niveaux, écarts, plan de formation | à définir | — | Backlog : Sheets seul. **RGPD**. |
| T46 | Ressources, créneaux, conflits, vue jour | à définir | Planner horaire | Caduque : « mono-utilisateur en localStorage » ; un usage partagé est désormais possible mais réservations à plusieurs à concevoir (droits, conflits). |
| T47 | Rétroplanning, budget prévu/engagé/payé, prestataires et contrats, invités, checklist jour J | Rétroplanning type, postes de budget, checklist jour J | Nozze Maestria, GLHF Compétition, Suivi budget | Demandé explicitement ; produit phare du backlog. Format : application + modèle Sheets. Même moteur que T15 et T50. **RGPD** (invités). |
| T48 | Inscriptions, catégories, heats, saisie des scores, classement, affichage | Règles de classement paramétrables, catégories types | GLHF Compétition, Roadmap GLHF | Affichage public = partage en lecture seule à concevoir. **RGPD** (participants). |
| T49 | Fiches adhérents, activités, quotient familial, paiements, listes d'appel | Activités types, tranches de quotient familial paramétrables | Inscriptions Centre social Charpennes Tonkin | **RGPD** (adhérents, mineurs possibles) : obligations dans le guide. Format : application + modèle Sheets. Aucune donnée du centre social. |
| T50 | Participants, transports, chambres, régimes, programme, budget | à définir (reprend T47) | Nozze Maestria | Déclinaison de T47. **RGPD** : régimes alimentaires et allergies sont des données sensibles. |
| T51 | Élèves, évaluations, compétences, moyennes, appréciations, bulletins | à définir | — | **RGPD** (élèves, mineurs). Caduque : « stockage local uniquement » ; les données sont désormais en ligne, à trancher avant développement. Concurrence Pronote. |
| T52 | Classes, formateurs, salles, créneaux, détection des conflits, vues par ressource | à définir | Grille Planning Optim, Planner horaire | Pas d'optimisation automatique en V1. |
| T53 | Véhicules, kilométrage, entretiens, contrôles techniques, moniteurs, planning de leçons, coût par heure | Intervalles d'entretien types | Ma voiture en leasing | Demandé explicitement. Base commune avec T56. **daté** (contrôle technique). Format : application + modèle Sheets. |
| T54 | Banque de questions taguée, génération de quiz, correction, statistiques | à définir | Toxicologie – Questions des élèves magistrats | Contenu de l'artefact non repris. |
| T55 | Séquences, séances, objectifs, avancement réel et prévu | à définir | Jalons à plage | — |
| T56 | Véhicules, conducteurs, entretiens, sinistres, amendes, leasing, coût total par véhicule | Intervalles d'entretien types | Ma voiture en leasing | Base commune avec T53 et T10. **daté** (contrôle technique). **RGPD** (conducteurs, amendes). Format : application + modèle Sheets. |
| T57 | Sites, équipements, interventions, indicateurs, carte ou liste, alertes | à définir | Vensolair · pilotage des parcs | **CNR** : retirer toute donnée Vensolair ; aucune donnée ni exemple d'énergie hydraulique ou de la CNR ; exemples fictifs (immobilier, équipements). Format : application + modèle Sheets. |
| T58 | Équipements, plans de maintenance, échéances, bons d'intervention, historique | Plans de maintenance types | Vensolair, Déversoir sur clapet | **CNR** : « Déversoir sur clapet » et Vensolair = mécanique seulement, aucune donnée ; exemples hors ouvrages hydrauliques. Moteur commun avec T11 et T60. |
| T59 | Articles, entrées et sorties, seuils d'alerte, valorisation, inventaire | à définir | — | Backlog : Sheets seul. |
| T60 | Registre des contrôles, périodicités, échéances, preuves, alertes | Types de contrôles (électricité, extincteurs…) sans périodicité légale non sourcée | Registre des visas | **daté** : périodicités réglementaires, paramétrables ou sourcées. Preuves : stockage de fichiers à prévoir. Format : application + modèle Sheets. |
| T61 | Calendrier, réservations, ménage, taxe de séjour, revenus par plateforme | à définir | Vigiski Saint-François-Longchamp | **daté** : taxe de séjour, paramétrable ; **fiscal**. Backlog : Sheets seul. Aucune donnée de l'artefact. |
| T62 | Dépenses communes, répartition au prorata des revenus, soldes, équilibrage | Méthodes de répartition (égale, prorata, personnalisée) | Budget commun, Budget commun partagé | Usage à deux : désormais possible (mêmes données), accès par deux personnes à concevoir. |
| T63 | LOA, LLD, crédit, comptant : coût total, valeur résiduelle, kilométrage | à définir | Ma voiture en leasing | Produit d'appel. Argent : avertissement. |
| T64 | Comparateur de devis d'artisans, budget, planning, réserves de fin de travaux | Postes de travaux types, modèles de planning de rénovation (T02) | Devis artisan, Levée réserves, Chemin critique | Réutilise T26, T31 et T02. **CNR** : « Chemin critique » = mécanique seulement. |
