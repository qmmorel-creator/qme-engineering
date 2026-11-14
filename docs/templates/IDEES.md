# Idées de templates QME

Liste vivante des templates prêts à l'emploi à développer et vendre (boutique Gumroad QME, page
`/templates/`). Chaque nouvelle idée de Quentin y est ajoutée dès qu'elle est donnée ; le statut suit le
développement. Développement : skill `.claude/skills/nouveau-template/` (lancé par Quentin, une idée à la fois).

Non publié sur le site (chemin bloqué dans `netlify.toml`).

Sources fusionnées ici : la liste initiale (T01–T22, 12/11/2026), les idées tirées des documents de
travail de Quentin (T23–T29, 12/11/2026) et le backlog de Quentin « 50 outils prêts à l'emploi à vendre
sur Gumroad » (n° 01–50, 12/11/2026 ; T30 et suivants, sauf fusions). Chaque ligne indique son origine.

**Décision de Quentin (12/11/2026)** : le nom et le prix du tableau de bord valent accord ; les fiches
Gumroad peuvent être créées et publiées sans validation intermédiaire. Restent à Quentin : l'activation de
la clé de licence dans l'éditeur Gumroad, le feu vert de fusion dans `main` et la publication LinkedIn.

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
- **Aucune automatisation ni lien avec une application externe** (règle de Quentin, 13/11/2026) : pas
  d'envoi d'e-mail, de lien d'appel ou de messagerie, d'agenda, de réseau social, de connecteur ni de
  synchronisation avec une autre application. Partage par texte à copier, impression ou export (CSV, JSON).
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
  (T24, T35, T45, T51, T53, T57, T29, T60, T63). Les idées prévues en tableur seul (T34, T37, T41, T42,
  T44, T48, T49, T62, T64) passent par défaut en application web ; garder un modèle tableur reste à
  trancher par Quentin.
- **Remarques du backlog devenues caduques** :
  - limite `localStorage` d'environ 5 Mo pour les photos (T32) → stockage en ligne des photos à prévoir
    (le stockage actuel des templates ne gère que des données JSON) ;
  - « mono-utilisateur en localStorage » (T50) → un usage partagé est désormais possible (mêmes
    données sur plusieurs appareils), mais un usage **à plusieurs personnes** (droits, conflits,
    lecture seule) reste à concevoir ; idem T15 (RSVP des invités), T52 (affichage public), T65 (couple) ;
  - « stockage local uniquement » pour les données d'élèves (T55) → les données sont désormais en
    ligne : la question RGPD devient plus lourde, à trancher avant développement ;
  - argument « hors ligne » face aux concurrents (T03, T28) → l'argument devient : achat unique, sans
    abonnement, sur tous les appareils, utilisable hors ligne grâce au cache.

## Tableau de bord

| N° | Template | Catégorie | Cible | Statut | Prix | Taille | Priorité | Origine |
|----|----------|-----------|-------|--------|-----------|--------|----------|---------|
| T01 | Planning de révision | Études | Lycéens, étudiants, candidats aux concours | en vente | 14,90 € | M | — | Liste initiale 12/11/2026 |
| T02 | Planning Gantt rapide (chemin critique, jalons à plage) | Gestion de projet | Artisans, PME, chefs de projet, BTP, ingénierie | en vente | 45 € | L | P1 | Quentin 12/11/2026 + Backlog Quentin n° 03 |
| T03 | Gestionnaire de tâches (inbox et triage) | Tâches | Indépendants, cadres, étudiants | en vente | 19 € | M | P1 | Quentin 12/11/2026 + Backlog Quentin n° 01 |
| T04 | Nutrition et dépense énergétique | Santé | Personnes qui gèrent leur poids, sportifs amateurs | en vente | 19 € | L | P1 | Quentin 12/11/2026 + Backlog Quentin n° 47 |
| T05 | Budget du foyer | Budget perso | Particuliers | en vente | 15 € | M | P1 | Liste initiale 12/11/2026 + Backlog Quentin n° 43 |
| T06 | Repas de la semaine et liste de courses (fiche en fin de fichier) | Cuisine | Familles, particuliers | prêt | 13 € | M | P2 | Liste initiale 12/11/2026 |
| T07 | Carnet de musculation et cross-training | Sport | Pratiquants, coachs | idée | 19 € | M | P2 | Liste initiale 12/11/2026 + Backlog Quentin n° 48 |
| T08 | Suivi d'habitudes et routines | Personnel | Particuliers | en vente | 12 € | S | P2 | Liste initiale 12/11/2026 + Backlog Quentin n° 46 |
| T09 | Garde-manger et dates de péremption | Maison | Familles | idée | 12 € | S | P3 | Liste initiale 12/11/2026 |
| T10 | Carnet de voiture : entretiens, kilométrage, dépenses | Véhicule | Particuliers, foyers à plusieurs voitures | idée | 13 € | M | P2 | Liste initiale 12/11/2026 + demande Quentin 13/11/2026 |
| T11 | Entretien de la maison | Maison | Propriétaires, locataires | prêt | 12 € | S | P2 | Liste initiale 12/11/2026 |
| T12 | Remboursement de dettes | Budget perso | Particuliers endettés | prêt | 12 € | S | P2 | Liste initiale 12/11/2026 |
| T13 | Objectif d'épargne et fonds d'urgence (fiche en fin de fichier) | Budget perso | Particuliers | prêt | 12 € | S | P3 | Liste initiale 12/11/2026 |
| T14 | Suivi des abonnements | Budget perso | Particuliers | en vente | 12 € | S | P2 | Liste initiale 12/11/2026 |
| T15 | Organisateur de mariage | Événementiel perso | Futurs mariés | en vente | 29 € | M | P1 | Liste initiale 12/11/2026 + Backlog Quentin n° 28 |
| T16 | Déménagement | Personnel | Particuliers qui déménagent | prêt | 12 € | S | P3 | Liste initiale 12/11/2026 |
| T17 | Suivi de lecture | Loisirs | Lecteurs | idée | 12 € | S | P3 | Liste initiale 12/11/2026 |
| T18 | Calendrier du potager | Jardin | Jardiniers amateurs | idée | 13 € | M | P3 | Liste initiale 12/11/2026 |
| T19 | Suivi du bébé | Famille | Jeunes parents | idée | 13 € | M | P3 | Liste initiale 12/11/2026 |
| T20 | Suivi d'un animal de compagnie | Animaux | Propriétaires de chien ou de chat | idée | 12 € | S | P3 | Liste initiale 12/11/2026 |
| T21 | Planificateur de voyage : étapes, nuits, activités, budget | Voyage | Voyageurs, familles, groupes d'amis | prêt | 13 € | M | P3 | Liste initiale 12/11/2026 + demande Quentin 13/11/2026 |
| T22 | Tableau de bord annuel et roue de vie | Personnel | Particuliers, coachs | prêt | 15 € | M | P3 | Liste initiale 12/11/2026 + Backlog Quentin n° 50 |
| T23 | Suivi de chantier par lot (contrat, avenants, non-conformités) | BTP / ingénierie | Maîtres d'œuvre, bureaux d'études, PME du BTP | idée | 40 € | L | P2 | Documents de travail de Quentin 12/11/2026 |
| T22 | Tableau de bord annuel et roue de vie | Personnel | Particuliers, coachs | idée | 15 € | M | P3 | Liste initiale 12/11/2026 + Backlog Quentin n° 50 |
| T23 | Suivi de chantier par lot (contrat, avenants, non-conformités) | BTP / ingénierie | Maîtres d'œuvre, bureaux d'études, PME du BTP | prêt | 40 € | L | P2 | Documents de travail de Quentin 12/11/2026 |
| T24 | Circuit de visa des documents (registre des visas) | BTP / ingénierie | MOE, bureaux d'études, OPC | en vente | 39 € | M | P1 | Documents de travail de Quentin 12/11/2026 + Backlog Quentin n° 05 |
| T25 | Registre des non-conformités et actions correctives | Qualité | PME du BTP et de l'industrie, responsables qualité | en vente | 20 € | M | P1 | Documents de travail de Quentin 12/11/2026 |
| T26 | Notes de frais et indemnités kilométriques | Comptabilité | Salariés, indépendants | prêt | 15 € | S | P2 | Documents de travail de Quentin 12/11/2026 + Backlog Quentin n° 19 |
| T27 | Gestion locative (biens, locataires, loyers) | Immobilier | Propriétaires bailleurs | prêt | 20 € | M | P2 | Documents de travail de Quentin 12/11/2026 |
| T28 | CRM freelance (clients, projets, factures) | Commercial | Freelances, consultants | prêt | 25 € | M | P1 | Documents de travail de Quentin 12/11/2026 + Backlog Quentin n° 09 |
| T29 | Gestion de flotte de véhicules | Flotte | PME, collectivités | prêt | 39 € | M | P1 | Documents de travail de Quentin 12/11/2026 + Backlog Quentin n° 37 |
| T30 | Planner horaire time-blocking | Emploi du temps | Cadres, freelances | prêt | 15 € | M | P1 | Backlog Quentin n° 02 |
| T31 | Compte rendu → plan d'actions | Réunions | Managers, chefs de projet | en vente | 15 € | S | P1 | Backlog Quentin n° 04 |
| T32 | Levée de réserves (OPR) | BTP | Conducteurs de travaux, MOE, syndics | prêt | 39 € | M | P1 | Backlog Quentin n° 06 |
| T33 | Pilotage d'une journée de bascule | Opérations | Responsables production, IT, logistique | idée | 29 € | M | P2 | Backlog Quentin n° 07 |
| T34 | Tableau de bord de pilotage PME | Direction | Dirigeants TPE/PME | prêt | 39 € | M | P2 | Backlog Quentin n° 08 |
| T35 | Pipeline de prospection B2B | Commercial | Commerciaux, indépendants B2B | prêt | 25 € | M | P1 | Backlog Quentin n° 10 |
| T36 | Générateur de devis | Commercial | Artisans, freelances | en vente | 29 € | M | P1 | Backlog Quentin n° 11 |
| T37 | Coût de revient et prix par client | Finance pro | Prestataires de services | en vente | 25 € | S | P1 | Backlog Quentin n° 12 |
| T38 | Préparateur d'appel découverte | Commercial | Consultants, commerciaux | prêt | 12 € | S | P2 | Backlog Quentin n° 13 |
| T39 | Kit références et plaquette | Marketing | Indépendants, petites agences | idée | 19 € | S | P3 | Backlog Quentin n° 14 |
| T40 | Calculateur TJM freelance | Finance pro | Freelances débutants | en vente | 12 € | S | P1 | Backlog Quentin n° 15 |
| T41 | Livre recettes-dépenses micro-entreprise | Comptabilité | Micro-entrepreneurs | en vente | 25 € | S | P1 | Backlog Quentin n° 16 |
| T42 | Trésorerie prévisionnelle 12 mois | Comptabilité | TPE, indépendants | en vente | 29 € | M | P1 | Backlog Quentin n° 17 |
| T43 | Relance des impayés | Comptabilité | TPE, freelances | prêt | 19 € | S | P2 | Backlog Quentin n° 18 |
| T44 | Suivi de TVA | Comptabilité | Petites sociétés au réel | idée | 19 € | S | P3 | Backlog Quentin n° 20 |
| T45 | Gestion de parc de postes de travail | IT / moyens généraux | DSI de PME, office managers | prêt | 35 € | M | P1 | Backlog Quentin n° 21 |
| T46 | Onboarding / offboarding salarié | RH | RH de PME, managers | prêt | 19 € | S | P2 | Backlog Quentin n° 22 |
| T47 | Planning d'équipe et staffing | RH / opérations | Managers d'équipe, agences | prêt | 35 € | L | P2 | Backlog Quentin n° 23 · fiche [`fiches/planning-equipe.md`](fiches/planning-equipe.md) |
| T48 | Suivi congés et absences | RH | TPE sans SIRH | prêt | 19 € | S | P2 | Backlog Quentin n° 24 |
| T49 | Matrice compétences et formations | RH | Responsables formation, managers | idée | 25 € | S | P3 | Backlog Quentin n° 25 |
| T50 | Réservation de salles et bureaux | Moyens généraux | PME en flex office | idée | 19 € | M | P3 | Backlog Quentin n° 26 |
| T51 | Pilote événementiel complet | Événementiel | Agences événementielles, chargés de communication | prêt | 49 € | L | P1 | Backlog Quentin n° 27 |
| T52 | Gestion de compétition sportive | Événementiel sport | Salles de cross-training, clubs, associations | prêt | 49 € | L | P2 | Backlog Quentin n° 29 |
| T53 | Inscriptions associatives | Associatif | Associations, centres sociaux, clubs | en vente | 29 € | M | P1 | Backlog Quentin n° 30 |
| T54 | Séminaire / offsite | Événementiel | Assistants de direction, RH | idée | 35 € | M | P3 | Backlog Quentin n° 31 |
| T55 | Gestion de classe | Éducation | Enseignants collège et lycée | idée | 25 € | M | P2 | Backlog Quentin n° 32 |
| T56 | Emploi du temps d'établissement | Éducation / formation | Organismes de formation, écoles privées | idée | 45 € | L | P2 | Backlog Quentin n° 33 |
| T57 | Gestion de flotte auto-école | Éducation / flotte | Auto-écoles | prêt | 45 € | L | P1 | Backlog Quentin n° 34 |
| T58 | Banque de questions et quiz formateur | Formation | Formateurs, enseignants | idée | 19 € | M | P3 | Backlog Quentin n° 35 |
| T59 | Progression pédagogique | Éducation | Enseignants, formateurs | idée | 15 € | S | P3 | Backlog Quentin n° 36 |
| T60 | Pilotage de parcs multi-sites | Exploitation | Exploitants (immobilier, équipements) | idée | 49 € | L | P2 | Backlog Quentin n° 38 |
| T61 | Maintenance préventive (GMAO légère) | Exploitation | Ateliers, services techniques | prêt | 39 € | M | P2 | Backlog Quentin n° 39 |
| T62 | Stocks et inventaire | Commerce | Petits commerces, artisans | prêt | 25 € | S | P2 | Backlog Quentin n° 40 |
| T63 | Vérifications réglementaires | Conformité | Responsables QHSE, gestionnaires de bâtiments | prêt | 35 € | M | P2 | Backlog Quentin n° 41 ; fiche [`fiches/verifications.md`](fiches/verifications.md) |
| T64 | Location saisonnière | Immobilier | Propriétaires de meublés | prêt | 25 € | S | P2 | Backlog Quentin n° 42 |
| T65 | Budget commun couple / colocation | Budget perso | Couples, colocataires | en vente | 15 € | S | P1 | Backlog Quentin n° 44 |
| T66 | Simulateur leasing vs achat | Budget perso | Particuliers, indépendants | prêt | 12 € | S | P2 | Backlog Quentin n° 45 |
| T67 | Pilote de travaux maison | Habitat | Particuliers en rénovation | en vente | 25 € | M | P1 | Backlog Quentin n° 49 |
| T68 | Secret Santa (amis, famille, collègues) | Événementiel perso | Organisateurs de Secret Santa (familles, groupes d'amis, équipes) | en cours | gratuit (prix libre) | M | P1 | Quentin 13/11/2026 |
| T69 | Inventaire et valorisation du patrimoine matériel (inventaire valorisé) | Budget perso | Particuliers | prêt | 19 € | M | P1 | Quentin 13/11/2026 |
| T70 | Temps de vie : coût réel des dépenses en heures de travail | Budget perso | Particuliers | prêt | 19 € | M | P1 | Quentin 13/11/2026 |
| T71 | Suivi du temps passé et rentabilité par mission | Finance pro | Freelances, consultants | idée | 19 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Freelance gestion) |
| T72 | Propositions commerciales (note de cadrage, options, planning) | Commercial | Freelances, consultants, agences | idée | 19 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Freelance clients) |
| T73 | Calendrier éditorial des réseaux professionnels | Marketing | Freelances, indépendants | idée | 15 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Freelance clients) |
| T74 | Suivi des candidatures aux appels d'offres et plateformes | Commercial | Freelances, PME | idée | 15 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Freelance clients) |
| T75 | Registre du DOE (pièces à remettre par lot, relances) | BTP | MOE, entreprises, OPC | idée | 29 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Chef de projet BTP) |
| T76 | Conformité des sous-traitants (agréments, attestations) | BTP | Entreprises générales, MOE | idée | 29 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Chef de projet BTP) |
| T77 | Entretiens annuels et professionnels | RH | Dirigeants de TPE/PME, managers | idée | 19 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Petite entreprise) |
| T78 | Document unique d'évaluation des risques | RH / sécurité | Employeurs de TPE/PME | idée | 29 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Petite entreprise) |
| T79 | Contrats fournisseurs et échéances de résiliation | Moyens généraux | Office managers, dirigeants | idée | 25 € | S | P2 | Proposition validée par Quentin 14/11/2026 (packs Moyens généraux, Exploitation) |
| T80 | Demandes d'achat et fournitures | Moyens généraux | Office managers | idée | 19 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Moyens généraux) |
| T81 | Papiers du foyer (où est quoi, durée de conservation) | Budget perso | Particuliers | idée | 15 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Argent) |
| T82 | Remboursements santé (soins, Sécurité sociale, mutuelle) | Budget perso | Particuliers, familles | idée | 12 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Argent) |
| T83 | Capacité d'emprunt et comparateur de prêts | Budget perso | Particuliers, primo-accédants | idée | 15 € | S | P2 | Proposition validée par Quentin 14/11/2026 (packs Argent, Propriétaire) |
| T84 | Cadeaux reçus et remerciements | Événementiel perso | Futurs mariés, familles | idée | 12 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Mariage et installation) |
| T85 | Revue hebdomadaire et journal de bord | Personnel | Cadres, indépendants | idée | 12 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Productivité) |
| T86 | Notes et moyennes (coefficients, ECTS, objectifs) | Études | Lycéens, étudiants | idée | 12 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Étudiant) |
| T87 | Candidatures études, stages, alternance | Études | Lycéens, étudiants | idée | 12 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Étudiant) |
| T88 | Planning de mémoire ou de thèse | Études | Étudiants, doctorants | idée | 15 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Étudiant) |
| T89 | Subventions (dossiers, échéances, justificatifs) | Associatif | Associations | idée | 25 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Associations) |
| T90 | Bénévoles et planning des créneaux | Associatif | Associations, clubs, organisateurs | idée | 19 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Associations) |
| T91 | Assemblée générale et vie statutaire | Associatif | Bureaux d'associations | idée | 19 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Associations) |
| T92 | État des lieux d'entrée et de sortie | Immobilier | Propriétaires bailleurs, locataires | idée | 19 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Propriétaire) |
| T93 | Rentabilité d'un investissement locatif | Immobilier | Investisseurs particuliers | idée | 15 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Propriétaire) |
| T94 | Charges et assemblées générales de copropriété | Immobilier | Copropriétaires | idée | 15 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Propriétaire) |
| T95 | Plan d'entraînement course à pied | Sport | Coureurs amateurs | idée | 15 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Forme) |

**Taille** : pour T01–T29, S ≈ une session de développement, M ≈ deux, L ≈ trois ou plus ; pour les
idées du backlog, effort estimé par Quentin (S < 1 jour, M 1 à 3 jours, L > 3 jours), repris tel quel.
**Prix** : un prix par idée, en euros ronds (sauf T01, déjà en vente à 14,90 €), **jamais moins de 12 €**
(règle de Quentin, 13/11/2026 : les idées prévues à 8 ou 10 € passent à 12 €), à confirmer par Quentin avant la création de chaque fiche Gumroad. Quand la
liste initiale et le backlog divergeaient (T02, T03, T04, T05, T07, T08, T15, T22), le prix du backlog est
retenu : plus récent, périmètre élargi par la fusion. **Priorité** : P1 = à produire en premier, puis P2,
P3. Backlog : priorité de Quentin reprise. Liste initiale sans priorité : attribuée selon la demande
attendue, la taille et le risque (médical, données datées) ; T04 passe en P1 (fiche validée).

## Fusions

Une idée du backlog qui recouvre une idée existante garde le numéro existant ; la fiche ou la ligne de
détail reprend les apports du backlog.

| Backlog n° | Fusionné dans | Décision |
|------------|---------------|----------|
| 05 Registre des visas documentaires | T24 | Même produit que le circuit de visa des documents de travail. T24 gagne les délais contractuels, les relances et le tableau de bord. |
| 09 CRM freelance | T28 | Même produit. T28 gagne l'historique, la prochaine action et le CA par client. |
| 19 Notes de frais et IK | T26 | Même produit. T26 gagne le barème kilométrique et le récapitulatif PDF. |
| 37 Flotte d'entreprise | T29 | Même produit. T29 gagne sinistres, amendes, leasing et coût total par véhicule. |
| 01 Inbox & Triage Pro | T03 | Même produit. T03 gagne le triage Eisenhower, le rituel du matin, la clôture du soir et la vue « Aujourd'hui » (proche du Focus). |
| 03 Gantt + chemin critique | T02 | Même produit. T02 gagne le calcul du chemin critique (CPM), les jalons à plage et l'export PDF A3. Produit phare B2B. |
| 43 Budget personnel mensuel | T05 | Même produit. T05 gagne les enveloppes et le diagramme de Sankey des flux. |
| 46 Carnet de routines | T08 | Même produit. T08 gagne les jours non applicables et la vue mensuelle. |
| 47 Nutrition et menus | T04 | Même produit. T04 gagne les menus types et la liste de courses (lien possible avec T06). |
| 48 Carnet cross-training / musculation | T07 | Même produit. T07 gagne les WOD, les records personnels et le chronomètre. |
| 28 Organisateur de mariage | T15 | T15 devient le produit grand public « mariage » ; l'événementiel professionnel part dans T51. |
| 50 Roue de vie | T22 | Même produit. T22 gagne la roue de vie et le bilan par domaine. |

**Non fusionnés, après examen** :
- T23 (suivi de chantier) et T25 (non-conformités) avec 06 Levée de réserves (T32) : même moteur de
  constats, mais moments et usages différents (chantier en cours, qualité, réception) ; vendus séparément,
  T25 et T32 comme produits d'appel de T23.
- T27 (gestion locative, baux) et 42 Location saisonnière (T64) : règles et clientèle différentes.
- 27 Pilote événementiel (T51) : cible professionnelle (agences), prix et taille différents de T15 ; même
  moteur que T15, à produire après lui ou en même temps.
- 31 Séminaire / offsite (T54) : déclinaison de T51 (backlog : « variante de ID 27 »), gardée à part car
  vendue seule et dans le pack événements.
- 49 Pilote de travaux maison (T67) : ce n'est pas un événement ; il réutilise T02 (planning), T36
  (devis) et T32 (réserves).
- 37 Flotte d'entreprise (T29) et 34 Auto-école (T57) : deux produits, une base commune (backlog : à
  produire ensemble) ; T10 (véhicule perso) peut en être une version simplifiée.
- 39 GMAO légère (T61) et 41 Vérifications réglementaires (T63) : proches de T11 (entretien maison) par le
  moteur d'échéances, mais cible professionnelle.
- Demandes du 13/11/2026 : « planificateur de voyage » = T21 (périmètre élargi : nuits, activités, prix) ;
  « gestionnaire de voitures » = T10 (élargi : kilométrage, dépenses, coût au km). Pas de nouveau numéro.
- 44 Budget commun (T65) : distinct de T05 (répartition entre personnes) ; proche du partage de dépenses
  de T21.

## Packs

**Décisions de Quentin (14/11/2026)** : remise progressive selon le nombre de templates, de 10 à 25 % (2 → 10 %,
3 → 15 %, 4 → 20 %, 5 et plus → 25 %), prix arrondi à l'euro inférieur ; même barème pour le **pack sur mesure**
(l'acheteur coche ses templates sur `/packs/composer/`). Un pack est « Bientôt » tant qu'un de ses templates n'est
pas en vente ou que sa fiche Gumroad n'existe pas, avec le bouton « Je suis intéressé(e) » (module `pack-<slug>`).

**Source unique** : composition et préfixes dans `netlify/lib/packs.mjs` ; textes, cibles (pastilles couleur +
forme) et templates à venir dans `outils/packs/donnees.mjs` ; pages générées par `node outils/packs/generer.mjs`
(`/packs/`, `/packs/<slug>/`, `/packs/composer/`, `/packs/espace/`, section `#packs` de `/templates/`). À relancer
après chaque changement de pack, de prix ou de statut d'un template.

**Accès** : une clé de pack (licence Gumroad du produit pack, ou code `PFG-…` généré par `npm run code -- PFG`)
se colle sur `/connexion/` et ouvre le tableau de bord `/packs/espace/` ; le serveur calcule un code par template
(`codePackProduit`), les templates n'ont rien à changer. Pack sur mesure : code `SMP-<préfixes>-…` signé
(`npm run code -- SMP BDG,ABN,DTT`).

**Option « Pack évolutif » (décision de Quentin, 14/11/2026)** : sans option, un pack ouvre les templates qu'il
contenait le jour de l'achat ; avec l'option, il ouvre aussi tous les templates ajoutés ensuite. Prix : 25 % du
prix du pack, arrondi à l'euro supérieur, 9 € minimum. Sur Gumroad : deux versions du produit pack (« Pack » et
« Pack évolutif ») ; le serveur lit la version et la date d'achat dans la licence. À l'ajout d'un template à un
pack : préfixe dans `produits` et date dans `ajouts` (`netlify/lib/packs.mjs`). Codes à la main : `PFG+`.
Pas d'option pour le pack sur mesure (composition fixe).

**Pack sur mesure sur Gumroad (vérifié le 14/11/2026)** : produit unique à prix libre avec clé de licence et
champ « Templates » ; le lien pré-remplit prix et champ (`?wanted=true&price=…&Templates=…`), le serveur relit
prix payé et champ dans la licence et refuse un montant inférieur au barème. Les codes de réduction Gumroad ne
permettent pas une remise par nombre de produits différents (minimum de quantité = exemplaires d'un même produit).

| Pack | Préfixe | Templates prêts | À venir | Valeur | Remise | Prix | Option évolutif |
|------|---------|-------------------------|---------|--------|--------|------|-----------------|
| Freelance : chiffrer, facturer, encaisser | PFG | T40, T37, T36, T41, T43, T42 | T71 | 139 € | 25 % | 104 € | 26 € |
| Freelance : trouver ses clients | PFC | T38, T35, T28 | T39, T72, T73, T74 | 62 € | 15 % | 52 € | 13 € |
| Chef de projet BTP | PBT | T02, T24, T32, T25, T31, T23 | T75, T76 | 198 € | 25 % | 148 € | 37 € |
| Petite entreprise | PPE | T48, T26, T46, T42, T31, T34, T47 | T77, T78 | 171 € | 25 % | 128 € | 32 € |
| Moyens généraux | PMG | T45, T29, T46, T61, T63 | T50, T79, T80 | 167 € | 25 % | 125 € | 32 € |
| Reprendre la main sur son argent | PAR | T05, T14, T12, T70, T69, T13 | T81, T82, T83 | 89 € | 25 % | 66 € | 17 € |
| Mariage et installation à deux | PMR | T15, T65, T05, T16, T21 | T84 | 84 € | 25 % | 63 € | 16 € |
| Productivité perso | PPR | T03, T30, T08, T22 | T85 | 61 € | 20 % | 48 € | 12 € |
| Étudiant | PET | T01, T30, T08 | T86, T87, T88 | 41,90 € | 15 % | 35 € | 9 € |
| Associations et clubs | PAS | T53, T51, T42, T52 | T89, T90, T91 | 156 € | 20 % | 124 € | 31 € |
| Propriétaire | PPB | T64, T67, T11, T27 | T92, T93, T94, T83 | 82 € | 20 % | 65 € | 17 € |
| Forme | PFM | T04, T08, T06 | T07, T95 | 44 € | 15 % | 37 € | 10 € |
| Famille | PFA | T05, T11, T06 | T09, T19, T20 | 40 € | 15 % | 34 € | 9 € |
| Voyage | PVY | T65, T21 | — | 28 € | 10 % | 25 € | 9 € |
| Enseignant et formateur | PNS | — | T59, T58, T55, T56 | 104 € (prévu) | 20 % | 83 € | 21 € |
| Exploitation et maintenance | PXP | T61, T63 | T60, T79 | 74 € | 10 % | 66 € | 17 € |
| Commerçant et artisan | PCA | T62, T36, T41, T42 | — | 108 € | 20 % | 86 € | 22 € |
| Ma voiture | PVT | T66 | T10 | 25 € (prévu) | 10 % | 22 € | 9 € |

Restent à faire : fiche Gumroad de chaque pack (produit simple avec clé de licence, contenu = lien vers
`/connexion/`, identifiant reporté dans `PACKS`), paiement en ligne du pack sur mesure (en attendant : demande
par e-mail, code `SMP` généré à la main). Packs abandonnés : « Flotte » (T57 contient déjà la flotte) et
« Organisateur d'événements » (mélangeait mariage grand public et agences).

## Ordre de production conseillé

1. T01 : fait (en vente).
2. P1 rapides sans donnée datée : T31, T65, T37, T05 (S dans le backlog, M dans la liste initiale).
   T40 et T41 (S, P1) sont **daté** et **fiscal**/**comptable** : à lancer une fois défini le processus
   de mise à jour annuelle (source officielle, date affichée dans l'application, rappel annuel).
3. T03 (fiche validée, logique déjà écrite dans l'outil interne), puis T02, produit phare B2B, qui ouvre le pack BTP.
4. T04 (fiche validée, logique déjà écrite dans l'outil interne), après décision sur l'hébergement des données de santé (**RGPD**)
   et vérification de la licence Ciqual.
5. P1 de taille M : T25, T30, T24, T32, T28, T35, T36, T42, T45, T15, T53, T29, T67.
6. P1 de taille L : T51, puis T57 avec T29 si ce dernier n'est pas fait.
7. P2, puis P3 (les petites tailles S regroupables en lots).

Les petits P1 viennent d'abord parce qu'ils se font vite sur le socle de T01 et alimentent les packs
freelance et budget. T03 et T04 suivent parce que leurs fiches sont validées et que l'outil interne de Quentin fournit déjà
leur logique. T02 est long, mais c'est le produit phare B2B ; il est placé tôt car T32, T67 et le pack
BTP en dépendent. Les produits à données datées (T40, T41, T26, T44) demandent une mise à jour annuelle : ils
attendent que ce processus existe. Les produits à moteur commun se font ensemble (T57 et T29,
T15 et T51, T24 et T63).

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
Publication LinkedIn programmée : ID LI-73 du Google Sheet « Planning publications LinkedIn », le
15/11/2026 à 08:30, statut Programmé ; texte :
https://docs.google.com/document/d/10MrV1xUUH0PGz3S3qqjLqSQBaQKcGF2xNqHSIFFSGns/edit ; image
`LI-73-revision.png`.

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

## Deuxième vague (P1 de taille M et L) · lancée le 12/11/2026

Décision de Quentin : tous les P1 restants sont développés sans validation intermédiaire, publication
autorisée (Gumroad et `main`) ; il active les clés de licence. Fiches dans `docs/templates/fiches/<slug>.md`.
Gumroad limite la création à 10 produits par jour : brouillons créés pour T02, T03, T04, T05 ; les 15 autres
le 13/11 au soir.

À vérifier par Quentin (remontées des agents) : T29, intervalles d'entretien intégrés (ordres de grandeur
non sourcés, présentés comme indicatifs et modifiables) ; T25, délais de traitement par gravité (30, 15, 7,
2 jours : propositions modifiables) ; T67, durées des modèles de planning (non sourcées, indicatives) ;
T36, taux de TVA de 2,1 % repris d'un extrait de recherche (page officielle inaccessible). T04 : **en vente depuis le 13/11/2026** (PR #46, fiche Gumroad `/l/nutrition`, 19 €). Décision de
Quentin : consentement explicite, politique de confidentialité publiée sur `/confidentialite/`, données
hébergées et traitées dans l'Union européenne (stockage `eu-central-1`, fonction en région `fra`). Facteurs
d'activité : moyennes d'usage courant (1,2 à 1,9), présentées comme telles et réglables de 1 à 2,5. Reste
ouvert : certification HDS non vérifiée. Bases intégrées vérifiées : Ciqual 2025 (Licence Ouverte 2.0) et
2024 Adult Compendium (usage commercial autorisé avec citation).

| N° | Slug | Préfixe | Permalien Gumroad |
|----|------|---------|-------------------|
| T02 | `gantt` | GNT | planning-gantt |
| T03 | `taches` | TCH | gestionnaire-taches |
| T04 | `nutrition` | NTR | nutrition |
| T05 | `budget` | BDG | budget-foyer |
| T15 | `mariage` | MRG | organisateur-mariage |
| T24 | `visa` | VSA | circuit-visa |
| T25 | `non-conformites` | NCF | non-conformites |
| T28 | `crm` | CRM | crm-freelance |
| T29 | `flotte` | VHC | gestion-flotte |
| T30 | `planner` | PHR | planner-horaire |
| T32 | `reserves` | RSV | levee-reserves |
| T35 | `prospection` | PRS | pipeline-prospection |
| T36 | `devis` | DVS | generateur-devis |
| T42 | `tresorerie` | TRS | tresorerie-previsionnelle |
| T45 | `parc-informatique` | PRC | parc-informatique |
| T51 | `evenementiel` | EVT | pilote-evenementiel |
| T53 | `inscriptions` | ASC | inscriptions-associatives |
| T57 | `auto-ecole` | AEC | gestion-auto-ecole |
| T67 | `travaux` | TRV | pilote-travaux |
| T08 | `habitudes` | HBT | suivi-habitudes (prévu) |
| T11 | `entretien` | ENT | entretien-maison (prévu) |
| T12 | `dettes` | DTT | remboursement-dettes (prévu) |
| T14 | `abonnements` | ABN | suivi-abonnements (prévu) |
| T26 | `notes-de-frais` | NDF | notes-de-frais (prévu) |
| T38 | `appel-decouverte` | APD | preparateur-appel-decouverte (prévu) |
| T43 | `impayes` | RCV | relance-impayes (prévu) |
| T46 | `onboarding` | ARD | onboarding-offboarding (prévu) |
| T48 | `conges` | CNG | suivi-conges-absences (prévu) |
| T62 | `stocks` | STK | stocks-inventaire (prévu) |
| T64 | `location-saisonniere` | SJR | location-saisonniere (prévu) |
| T66 | `leasing` | VTR | simulateur-leasing-achat (prévu) |
| T13 | `epargne` | EPG | objectif-epargne (prévu) |
| T27 | `gestion-locative` | GRT | gestion-locative (prévu) |
| T23 | `suivi-chantier` | CHT | suivi-chantier-lot (prévu) |
| T47 | `planning-equipe` | EQP | planning-equipe-staffing (prévu) |

## Publications LinkedIn des templates (planning Google Sheet, statut « Programmé »)

LI-73 (T01) existait déjà. Textes : Google Docs du dossier du planning ; lien d'achat en premier
commentaire. Les templates encore « prêt » portent la remarque : ne publier que si la fiche Gumroad est en
ligne à la date prévue, sinon décaler. LI-84 et LI-88 sorties du week-end le 13/11/2026 par échange de lignes
dans le Sheet (fait) : LI-84 ↔ LI-38 (LI-84 ven. 04/12 08:30, LI-38 sam. 05/12 12:15) et LI-88 ↔ LI-87
(LI-88 ven. 11/12 12:15, LI-87 dim. 13/12 12:15). LI-82 décalée au 21/12 pour LI-99 (Secret Santa), décision de Quentin du 13/11. Harmonisation du 13/11 (décision de Quentin : une publication par jour sur LinkedIn et Instagram, jamais plus de deux jours sans) : LI-100 à LI-106 (22/12 → 03/01) et IG-37 à IG-61 ajoutées au statut « À préparer », vidéos tirées de `communication/videos-30-jours.md`. Ce tableau ne recopie que les publications des
templates : le Sheet en programme d'autres (LI-01 à LI-72), une par jour, et reste la référence.

| ID | Template | Date | Heure |
|----|----------|------|-------|
| LI-74 | présentation générale | 2026-11-13 | 13:00 |
| LI-75 | T31 compte-rendu | 2026-11-17 | 12:15 |
| LI-76 | T37 cout-revient | 2026-11-19 | 12:15 |
| LI-77 | T40 tjm | 2026-11-21 | 08:30 |
| LI-78 | T41 micro-entreprise | 2026-11-23 | 12:15 |
| LI-79 | T65 budget-commun | 2026-11-25 | 12:15 |
| LI-80 | T02 gantt | 2026-11-27 | 08:30 |
| LI-81 | T03 taches | 2026-11-29 | 12:15 |
| LI-99 | T68 secret-santa | 2026-12-01 | 12:15 |
| LI-83 | T24 visa | 2026-12-03 | 08:30 |
| LI-84 | T25 non-conformites | 2026-12-04 | 08:30 |
| LI-85 | T28 crm | 2026-12-07 | 12:15 |
| LI-86 | T29 flotte | 2026-12-09 | 08:30 |
| LI-87 | T30 planner | 2026-12-13 | 12:15 |
| LI-88 | T32 reserves | 2026-12-11 | 12:15 |
| LI-89 | T35 prospection | 2026-12-15 | 08:30 |
| LI-90 | T36 devis | 2026-12-17 | 08:30 |
| LI-91 | T42 tresorerie | 2026-12-19 | 08:30 |
| LI-82 | T05 budget | 2026-12-21 | 12:15 |
| LI-92 | T15 mariage | 2026-12-29 | 12:15 |
| LI-93 | T45 parc-informatique | 2026-12-31 | 12:15 |
| LI-94 | T51 evenementiel | 2027-01-05 | 08:30 |
| LI-95 | T53 inscriptions | 2027-01-07 | 12:15 |
| LI-96 | T57 auto-ecole | 2027-01-09 | 12:15 |
| LI-97 | T67 travaux | 2027-01-11 | 08:30 |
| LI-107 | T14 abonnements | 2026-12-20 | 12:15 |
| LI-108 | T08 habitudes | 2027-01-13 | 12:15 |
| LI-109 | T11 entretien | 2027-01-15 | 12:15 |
| LI-110 | T12 dettes | 2027-01-17 | 08:30 |
| LI-112 | T26 notes-de-frais | 2027-01-21 | 12:15 |
| LI-113 | T38 appel-decouverte | 2027-01-23 | 12:15 |
| LI-114 | T43 impayes | 2027-01-25 | 12:15 |
| LI-115 | T46 onboarding | 2027-01-27 | 12:15 |
| LI-116 | T48 conges | 2027-01-29 | 08:30 |
| LI-117 | T62 stocks | 2027-02-03 | 12:15 |
| LI-118 | T64 location-saisonniere | 2027-02-05 | 12:15 |
| LI-119 | T66 leasing | 2027-02-07 | 08:30 |

## Publications Instagram des templates (`@qmengineering`)

Kit de marque : [`communication/instagram/README.md`](communication/instagram/README.md). Planning :
Google Sheet « Planning publications Instagram » (dossier Drive « QME – Publications Instagram »),
créé le 13/11/2026 : IG-01 à IG-03 (lancement, 16/11/2026), puis IG-04 à IG-26, un carrousel par template
le lendemain de son post LinkedIn (LI-75 à LI-97), à 18:30. Toutes les lignes sont « À préparer » ;
publication par Instinct (lignes « Programmé ») après relecture de Quentin. Reel de lancement IG-27 le 17/11. IG-04 (T31, 18/11) et IG-05 (T37, 20/11) prêts le 13/11 : `communication/compte-rendu/instagram.md`, `communication/cout-revient/instagram.md`.

**Lot du 13/11/2026 (T08, T11, T12, T14)**, prêts, « Mise en vente prochaine » (démo libre, bouton « Je suis
intéressé(e) », pas de fiche Gumroad : entrées dans `communication/gumroad-a-creer.json`). Livrables dans
`communication/<slug>/` (linkedin.md, instagram.md, prospects.md, gumroad.md, carrousel `instagram/`) et fiches
`fiches/<slug>.md`. Publications insérées le 13/11 avec la remarque « ne publier que si la fiche Gumroad est en
ligne » : LinkedIn « Programmé » LI-107 (T14, 20/12), LI-108 (T08, 13/01), LI-109 (T11, 15/01), LI-110 (T12,
17/01) ; Instagram « Prêt » (à relire par Quentin avant « Programmé ») IG-62 (T14, 21/12, même créneau que
IG-48 : à arbitrer), IG-63 (T08, 14/01), IG-64 (T11, 16/01), IG-65 (T12, 18/01). Restent à vérifier avant la
vente : sources des réglages types (T08) et régime RGPD des données de santé (T08) ; trois règles d'entretien
non revérifiées (assainissement individuel, contrôle SPANC, débroussaillement, T11) ; repères juridiques de
résiliation (T14) ; points conseil budget en refonte (T12, à revérifier chaque année).
Prix minimum 12 € (règle de Quentin, 13/11/2026) : T11, T12 et T14 passent de 10 / 10 / 8 € à 12 € (textes,
`gumroad-a-creer.json`, vue 5 des carrousels refaite). Drive : légendes IG-62, IG-64, IG-65 recréées (anciennes
renommées `OBSOLETE-…`) et nouvelles vues 5 déposées dans le dossier Images, colonne P mise à jour.

**Lot du 14/11/2026 (T26, T38, T43, T46)**, prêts, « Mise en vente prochaine » (démo libre, bouton « Je suis
intéressé(e) », pas de fiche Gumroad : entrées dans `communication/gumroad-a-creer.json`). Applications
`templates/notes-de-frais/` (NDF, 15 €), `templates/appel-decouverte/` (APD, 12 €), `templates/impayes/` (RCV,
19 €), `templates/onboarding/` (ARD, 19 €) ; pages `catalogue/<slug>/` ; fiches `fiches/<slug>.md` ; livrables
dans `communication/<slug>/` (linkedin.md, instagram.md, prospects.md, gumroad.md, carrousel `instagram/`).
Noms et prix repris du tableau de bord, à confirmer par Quentin avant la création des fiches Gumroad.
Publications insérées le 14/11 avec la remarque « ne publier que si la fiche Gumroad est en ligne » :
LinkedIn « Programmé » LI-112 (T26, 21/01), LI-113 (T38, sam. 23/01 : créneau donné par la règle, à décaler
si besoin), LI-114 (T43, 25/01), LI-115 (T46, 27/01) ; Instagram « Prêt » (à relire par Quentin avant
« Programmé ») IG-67 (T26, 22/01), IG-68 (T38, 24/01), IG-69 (T43, 26/01), IG-70 (T46, 28/01). Restent à
vérifier : T26, majoration de 20 % des véhicules électriques pour les deux-roues, et barème des trajets 2026
(publié au printemps 2027) ; T43, taux de l'intérêt légal (source secondaire, à confirmer au JORF), base
365 jours et pénalités sur le TTC, taux BCE à mettre à jour au 01/01/2027 ; T46, articles R4624-10 et
L1221-13 du Code du travail non relus sur Légifrance ; T38, durée de conservation CNIL des prospects
(3 ans) ; organismes de `prospects.md` marqués « à vérifier ».

**Lot du 14/11/2026, deuxième (T48, T62, T64, T66)**, prêts, « Mise en vente prochaine » (démo libre, bouton
« Je suis intéressé(e) », pas de fiche Gumroad : entrées dans `communication/gumroad-a-creer.json`). Applications
`templates/conges/` (CNG, 19 €), `templates/stocks/` (STK, 25 €), `templates/location-saisonniere/` (SJR, 25 €),
`templates/leasing/` (VTR, 12 €) ; pages `catalogue/<slug>/` ; fiches `fiches/<slug>.md` ; livrables dans
`communication/<slug>/` (linkedin.md, instagram.md, prospects.md, gumroad.md, carrousel `instagram/`). Noms et
prix repris du tableau de bord, à confirmer par Quentin avant la création des fiches Gumroad. Publications
insérées le 14/11 avec la remarque « ne publier que si la fiche Gumroad est en ligne » : LinkedIn « Programmé »
LI-116 (T48, ven. 29/01), LI-117 (T62, 03/02), LI-118 (T64, 05/02), LI-119 (T66, dim. 07/02 : créneau donné
par la règle, à décaler si besoin) ; Instagram « Prêt » (à relire par Quentin avant « Programmé ») IG-71 (T48,
30/01), IG-72 (T62, 04/02), IG-73 (T64, 06/02), IG-74 (T66, 08/02). Restent à vérifier : T48, articles du Code
du travail relus sur code.travail.gouv.fr seulement (Légifrance indisponible), équivalence en jours ouvrés,
samedi en jours ouvrables, report de 15 mois après un arrêt non géré ; T62, obligation d'inventaire annuel
(L123-12 du Code de commerce) non relue, marquée « à vérifier » ; T64, exonération des mineurs pour la taxe de
séjour (source secondaire), collecte de la taxe par les intermédiaires non vérifiée, hashtags hors kit ; T66,
hypothèses par défaut (décote 20 % puis 12 %/an, entretien, assurance) non sourcées, seuil calculé en km/an
seulement ; organismes de `prospects.md` marqués « à vérifier ». Le thème du catalogue de T62 est
« Indépendants » (public : commerces et artisans).

**T27 Gestion locative (14/11/2026)**, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis
intéressé(e) », pas de fiche Gumroad). Application `templates/gestion-locative/` (GRT, 20 €) ; page
`catalogue/gestion-locative/` ; fiche `fiches/gestion-locative.md` (rédigée par délégation de Quentin) ;
livrables `communication/gestion-locative/` (linkedin.md, instagram.md et carrousel `instagram/`, prospects.md,
gumroad.md, gumroad.json). Aucune publication planifiée (LinkedIn, Instagram) ni entrée dans
`communication/gumroad-a-creer.json` : à faire par le coordinateur. Repères légaux relus sur
service-public.gouv.fr le 14/11/2026 (F1311, F13723, F35247, F31269, F947, F2889) ; articles de loi cités
d'après ces fiches, Légifrance non consulté directement. Restent à vérifier : hashtags Instagram hors kit,
catégorie Gumroad, organismes de `prospects.md`.
**T47 Planning d'équipe et staffing (14/11/2026)**, prêt, « Mise en vente prochaine » (démo libre, bouton « Je suis
intéressé(e) », pas de fiche Gumroad : entrée dans `communication/gumroad-a-creer.json`). Cadrage délégué par Quentin :
fiche `fiches/planning-equipe.md`. Application `templates/planning-equipe/` (EQP, 35 €), page `catalogue/planning-equipe/`,
livrables dans `communication/planning-equipe/` (linkedin.md, instagram.md et carrousel `instagram/`, prospects.md,
gumroad.md et gumroad.json, section-site.html, carte anglaise préparée mais non insérée : version anglaise en attente).
Ajouté à `outils/packs/donnees.mjs` (TEMPLATES, retiré de PREVUS et des `prevus` du Pack Petite entreprise) : son
ajout aux `produits` du pack (`netlify/lib/packs.mjs`) reste à faire. **Publications LinkedIn et Instagram non
planifiées** (mission sans Google Sheets) : lignes à insérer selon `reference.md`. Restent à vérifier : articles
L3121-20, L3121-22 et L3121-27 relus sur code.travail.gouv.fr seulement ; organismes de `prospects.md` marqués « à
vérifier ».

## Première vague (P1 de taille S) · lancée le 12/11/2026

Décision de Quentin : les cinq P1 de taille S sont développés d'un bloc, sans validation intermédiaire
(noms et prix du tableau de bord). Socle commun : `templates/revision/`. Chaque application vérifie que la
clé saisie correspond bien à son produit (`corps.produit`), sinon elle refuse : une clé d'un autre template
ne doit jamais écrire dans ses données.

Mis en vente le 13/11/2026 (PR #41, fiches Gumroad publiées avec couverture). Communication : `docs/templates/communication/<slug>/`.

| N° | Slug | Préfixe | Nom de vente | Prix |
|----|------|---------|--------------|------|
| T31 | `compte-rendu` | CRA | Compte rendu et plan d'actions | 15 € |
| T37 | `cout-revient` | PRX | Coût de revient et prix par client | 25 € |
| T40 | `tjm` | TJM | Calculateur de TJM freelance | 12 € |
| T41 | `micro-entreprise` | MCE | Livre recettes-dépenses micro-entreprise | 25 € |
| T65 | `budget-commun` | BCM | Budget commun | 15 € |

### T31 · Compte rendu et plan d'actions

**Pour qui** : managers, chefs de projet, responsables d'association, toute personne qui anime des
réunions récurrentes et perd le fil des actions décidées.

**Écrans** :
- **Réunions** : liste par série (ex. « Point d'équipe du lundi »), nouvelle réunion depuis un modèle ;
- **Compte rendu** : date, participants (carnet de personnes), ordre du jour, notes par point, décisions,
  actions ; impression propre (A4) et copie en texte pour un e-mail ;
- **Actions** : toutes les actions ouvertes de toutes les réunions, par personne, statut (à faire, en
  cours, fait, abandonnée), échéance, retard ; filtre « mes actions » ;
- **Personnes** : carnet des participants (nom, rôle), sans coordonnées obligatoires.

**Saisie rapide d'une action** dans le compte rendu : `Marie : envoyer le devis avant vendredi` →
responsable, quoi, échéance. Dates en français : jour de la semaine, `demain`, `fin du mois`, `J+7`,
`20/11`. Règle pure testée.

**Mécanique clé** : à l'ouverture d'une nouvelle réunion d'une série, les actions encore ouvertes de la
précédente sont reprises en « suivi des actions » en tête du compte rendu.

**Base intégrée** : 8 modèles de compte rendu (point d'équipe hebdomadaire, comité de pilotage, réunion de
chantier, point client, rétrospective, réunion de lancement, conseil d'administration d'association,
entretien individuel), chacun avec ordre du jour type et rubriques.

**Risques** : **RGPD** (noms de participants : rappel dans l'aide) ; exemples fictifs. Taille S.

### T37 · Coût de revient et prix par client

**Pour qui** : prestataires de services, freelances, petites agences qui ne savent pas si un client est
rentable.

**Écrans** :
- **Charges** : charges fixes (mensuelles ou annuelles), rémunération visée, cotisations saisies par
  l'utilisateur (montant ou pourcentage) ;
- **Capacité** : jours ouvrés de l'année **calculés** (week-ends et jours fériés français calculés), moins
  congés, moins part non facturable (prospection, administratif) → heures et jours facturables ;
- **Coût de revient** : coût par heure et par jour = charges ÷ temps facturable ; prix plancher (coût) et
  prix conseillé (coût + marge cible) ;
- **Clients** : par client ou projet, temps passé, frais directs, montant facturé → marge, taux horaire
  réel, écart au prix plancher ;
- **Tableau de bord** : rentabilité par client (classement, clients sous le plancher), répartition du temps.

**Base intégrée** : catalogue d'une trentaine de postes de charges types d'un prestataire (sans montants),
deux structures types (indépendant seul, agence de 3 personnes).

**Risques** : aucun taux de charges sociales en base (saisis par l'utilisateur) ; argent : avertissement.
Taille S.

### T40 · Calculateur de TJM freelance

**Pour qui** : freelances qui démarrent ou révisent leur tarif.

**Écrans** :
- **Objectif** : revenu net visé (mensuel ou annuel), frais professionnels (liste type), marge de sécurité ;
- **Temps** : jours ouvrés **calculés** pour l'année choisie (fériés calculés), congés, jours non
  facturables → jours facturables ;
- **Statut** : micro-entreprise (prestations BIC, BNC, BNC Cipav), avec cotisations, contribution à la
  formation professionnelle et option versement libératoire ; société (SASU, EURL) : taux de charges
  **saisi par l'utilisateur**, aucune valeur intégrée ;
- **Résultat** : TJM minimum et TJM conseillé, chiffre d'affaires annuel nécessaire, alertes de plafond
  (83 600 € en services) et de franchise de TVA (37 500 € / 41 250 €) ;
- **Scénarios** : jusqu'à 3 scénarios comparés côte à côte ; courbe du TJM selon les jours facturables.

**Base intégrée** (**daté**, source et date affichées, valeurs modifiables par l'utilisateur) : taux
micro-entreprise au 1er janvier 2026 : cotisations 21,2 % (prestations BIC), 25,6 % (BNC), 23,2 % (BNC
Cipav, à revérifier) ; versement libératoire 1,7 % (BIC services), 2,2 % (BNC) ; formation professionnelle
0,1 % (commerçants), 0,2 % (libéraux), 0,3 % (artisans) ; plafond 83 600 € (services) ; franchise de TVA
37 500 € (seuil majoré 41 250 €). Sources : urssaf.fr, autoentrepreneur.urssaf.fr, economie.gouv.fr
(consultés le 12/11/2026). Mise à jour annuelle obligatoire.

**Risques** : **daté**, **fiscal** (outil d'aide, pas un conseil). Taille S.

### T41 · Livre recettes-dépenses micro-entreprise

**Pour qui** : micro-entrepreneurs qui tiennent leur livre des recettes sur papier ou tableur.

**Écrans** :
- **Recettes** : livre chronologique : date d'encaissement, client, nature, montant, mode de règlement,
  référence de la pièce justificative ; catégorie d'activité (vente, services BIC, BNC) ;
- **Achats** : registre des achats (activités de vente) ;
- **Dépenses** : suivi des dépenses de l'activité, avec la mention qu'en micro-entreprise elles ne sont pas
  déductibles (abattement forfaitaire) ;
- **Déclarations** : chiffre d'affaires par mois ou par trimestre (périodicité choisie), cotisations
  estimées par catégorie, versement libératoire et formation professionnelle si choisis ; aucune date
  limite de déclaration en base (à vérifier sur autoentrepreneur.urssaf.fr) ;
- **Seuils** : progression vers le plafond (203 100 € vente, 83 600 € services, prorata la première année)
  et vers la franchise de TVA (seuils de base et majorés), alertes ;
- **Export** : CSV annuel et impression du livre des recettes.

**Base intégrée** (**daté**, comme T40) : taux 2026 : cotisations 12,3 % (vente), 21,2 % (services BIC),
25,6 % (BNC), 23,2 % (BNC Cipav) ; versement libératoire 1 %, 1,7 %, 2,2 % ; formation professionnelle
0,1 %, 0,2 %, 0,3 % ; plafonds 203 100 € et 83 600 € ; franchise de TVA 85 000 € / 93 500 € (vente) et
37 500 € / 41 250 € (services). Taux réduit de l'ACRE : saisi par l'utilisateur (règles modifiées au
1er juillet 2026). Mêmes sources que T40.

**Risques** : **daté**, **comptable** (pas un logiciel certifié), **fiscal**. Taille S.

### T65 · Budget commun

**Pour qui** : couples, colocataires, familles recomposées qui partagent des dépenses.

**Écrans** :
- **Membres** : 2 à 6 personnes, revenus facultatifs (pour la répartition au prorata) ;
- **Dépenses** : qui a payé, montant, date, catégorie, répartition (égale, au prorata des revenus, en
  parts, en montants personnalisés) ;
- **Récurrentes** : loyer, énergie, abonnements, générées chaque mois ;
- **Soldes** : qui doit combien à qui, **équilibrage** avec le moins de virements possible, virements
  enregistrés ;
- **Mois** : bilan par catégorie et par personne, graphique.

**Base intégrée** : catégories de dépenses communes, trois modèles de foyer (couple, colocation à trois,
famille), règles de répartition expliquées.

**Partage** : une seule clé ; chaque membre ouvre l'application sur son appareil avec la même clé (mêmes
données). Le dire clairement : partager la clé donne un accès complet.

**Risques** : argent : avertissement ; données du foyer seulement. Taille S.

---

## Détails des idées (T05–T67)

Une ligne par idée sans fiche longue. « Backlog » rappelle prix, effort et priorité de la source quand
ils diffèrent ou complètent le tableau de bord. Marques : **confidentiel**, **daté**, **fiscal**,
**comptable**, **médical**, **RGPD** (voir les règles en tête). Argent et sport : avertissement.

| N° | MVP | Base intégrée envisagée | Artefact d'inspiration | Remarques |
|----|-----|-------------------------|------------------------|-----------|
| T05 | Dépenses → tableau de bord, écart au budget ; enveloppes, prévu/réel, Sankey des flux | Catégories et sous-catégories, règle 50/30/20 | Suivi budget 3 800 €, Sankey | Backlog n° 43 : 15 €, S, P1. Marché concurrentiel : le Sankey distingue. Argent : avertissement. Montants de l'artefact non repris. |
| T06 | Repas de la semaine et liste de courses générée | 100 recettes avec ingrédients et quantités | — | Moteur de liste de courses partageable avec T04. Recettes : source et droits à vérifier. |
| T07 | Carnet de musculation et cross-training : séances, WOD, volume, records, progression, chronomètre | 150 exercices par groupe musculaire ; WOD types à définir | Skills WOD et coach sportif de Quentin | Backlog n° 48 : 19 €, M, P2. Noms de WOD de référence : droits à vérifier. Sport : avertissement (pas un programme médical). |
| T08 | Suivi d'habitudes (habit tracker) : thèmes colorés, habitudes à cocher ou chiffrées (minimum, maximum, pas), thème « une seule habitude par jour » (ex. lieu de travail) ou habitudes indépendantes, jours « non applicable » qui ne cassent pas les séries, journal date × habitude en grille mensuelle, séries et taux de réussite | 50 habitudes types rangées par thèmes, réglages types (eau en verres, sport, sommeil…) | Suivi d'habitudes de l'outil interne de Quentin (demande du 13/11/2026 : « comme celui de l'outil interne ») ; Carnet des routines, Rituel du matin | Backlog n° 46 : 12 €, S, P2. Demande de Quentin du 13/11/2026 (doublon de T08, fusionnée ici). Cochage automatique depuis une application de sport : pas en V1 (aucun connecteur, aucune marque). Aucune habitude ni donnée de l'outil interne reprise. **médical** si des habitudes de santé (médicaments) sont saisies : rappel, et données de santé hébergées (voir T04). |
| T09 | Garde-manger et congélateur : alertes de péremption | Durées de conservation par type d'aliment | — | Durées : source à vérifier. |
| T10 | Carnet de voiture, une à quelques voitures : fiche véhicule, relevés de kilométrage, entretiens faits et à venir (échéance à la date ou au kilométrage, la première atteinte), toutes les dépenses (carburant ou recharge, entretien, réparations, pneus, assurance, péage, stationnement, contrôle technique), consommation calculée entre deux pleins, coût au kilomètre et coût mensuel, historique imprimable pour la revente | Intervalles d'entretien types, modifiables (le carnet du constructeur prime) ; catégories de dépenses | — | Demande Quentin 13/11/2026 fusionnée (gestionnaire de voitures). **daté** : périodicité du contrôle technique, vérifiée sur une source officielle ou saisie. Prix du carburant saisis, jamais intégrés. Argent : avertissement. Version perso du moteur de T29 (sans conducteurs, réservations ni sinistres). Aucune automatisation ni lien externe. |
| T11 | Entretien de la maison : calendrier automatique | 85 tâches avec fréquence (chaudière, ramonage, filtres) | — | **daté** si une fréquence est légale (ramonage, chaudière) : source ou paramétrable. Moteur commun avec T61. |
| T12 | Remboursement de dettes : plan et date de fin | Méthodes boule de neige et avalanche | — | Argent : avertissement. |
| T13 | Objectif d'épargne et fonds d'urgence | Scénarios d'intérêts composés (taux saisi par l'utilisateur) | — | Aucun taux de livret en base (**daté**). Argent : avertissement. |
| T14 | Suivi des abonnements : coût mensuel et annuel, renouvellements | Abonnements courants (streaming, télécom, sport) sans prix figés | — | — |
| T15 | Mariage : budget, prestataires, invités et RSVP, plan de table, rétroplanning 12 mois | Rétroplanning type sur 12 mois, postes de budget | Organisateur de mariage (artefact client) | Backlog n° 28 : 29 €, M, P1 ; forte demande grand public. Événementiel pro : T51. RSVP par les invités = usage partagé à concevoir. **RGPD** (liste d'invités). |
| T16 | Déménagement : avancement, inventaire des cartons | Checklist sur 8 semaines, démarches types | — | Démarches : vérifier qu'aucune n'est datée. |
| T17 | Suivi de lecture : statistiques, objectifs | Genres, objectifs annuels, notation | — | — |
| T18 | Calendrier du potager : semis selon les cultures choisies | 60 légumes : semis, récolte, associations | — | Source des données de culture à vérifier. |
| T19 | Suivi du bébé : repas, sommeil, couches, courbes | Courbes de référence poids et taille (source à vérifier) | — | **médical** : avertissement ; source et licence des courbes. **RGPD** : données de santé d'un enfant hébergées en ligne. |
| T20 | Animal de compagnie : soins, poids, frais | Calendrier vaccinal et antiparasitaire chien et chat | — | **médical** (vétérinaire) : avertissement ; source à vérifier. **daté** : recommandations vaccinales révisées, source datée ou paramétrable. |
| T21 | Planificateur de voyage : itinéraire par étapes, lieu de chaque nuit (hébergement, adresse, arrivée/départ, statut réservé ou à réserver, montant et acompte), activités par jour avec horaire et prix, transports entre étapes, vue jour par jour et carte texte des étapes, budget prévu/réel par poste et par personne, dépenses partagées et « qui doit quoi », listes de bagages, documents à prévoir (cases à cocher) | Listes de bagages par type de séjour ; postes de budget | — | Demande Quentin 13/11/2026 fusionnée (planificateur de voyage). Dépenses partagées : moteur commun avec T65. Aucune réservation ni lien vers une plateforme : saisie et impression uniquement. Formalités (passeport, visa, santé) : renvoi à vérifier sur les sources officielles, rien d'intégré. Argent : avertissement. |
| T22 | Tableau de bord annuel : roue de vie, objectifs par domaine, actions trimestrielles, score, bilan | Domaines de vie, méthode OKR | Constellations de vie, roue d'action, objectifs et tâches (outil interne) | Backlog n° 50 : 15 €, S, P3. |
| T23 | Suivi de chantier par lot : jalons contractuels, avenants, échéancier de paiement, non-conformités, journal de chantier, intempéries, sous-traitants, risques, courriers et ordres de service, synthèse financière | Découpage type en lots, jalons et pièces contractuelles types, typologie des non-conformités et des risques, modèle de revue de projet | Suivi de projet (artefact professionnel) | **confidentiel** : structure seulement, aucune donnée de l'artefact ; exemples fictifs. Avec T24 et T25, le plus différenciant (expérience de chef de projet de Quentin). Proche de T32 (levée de réserves) : **produit séparé** (tranché le 14/11/2026, voir « Fiche T23 » en fin de fichier). **RGPD** (intervenants, sous-traitants). |
| T24 | Circuit de visa : registre des documents soumis par lot, indices de révision, avis (sans observation, avec observations, refusé), délais contractuels, relances, vue chef de projet, tableau de bord | Types de documents par lot, codes de visa (VSO, VAO, REF), lots BTP types, délais de réponse paramétrables | Circuit de visa, registre et fiche visa (artefacts professionnels) | Backlog n° 05 fusionné (même produit). Format : application + modèle tableur. Niche solvable ; vocabulaire métier à respecter. **confidentiel** : structure seulement ; exemples fictifs. Moteur d'échéances commun avec T63. |
| T25 | Registre des non-conformités : constat, gravité, cause, action corrective, vérification, clôture, indicateurs | Typologie des écarts, méthode des 5 pourquoi, grille de gravité | Non-conformités de fabrication et de réalisation (artefact professionnel) | **confidentiel** : structure seulement ; exemples fictifs. Produit d'appel de T23 ; même moteur que T32 (réserves). |
| T26 | Notes de frais : saisie, justificatifs, statut de remboursement, barème kilométrique, récapitulatif et export mensuels (PDF) | Catégories de frais ; barème kilométrique saisi par l'utilisateur | Notes de frais (outil interne), Ma voiture en leasing | Backlog n° 19 fusionné. **daté** : barème kilométrique fiscal, saisi par l'utilisateur ou mis à jour chaque année avec source ; **fiscal**. Justificatifs : stockage de fichiers à prévoir. |
| T27 | Gestion locative : biens, baux, quittances, révision du loyer, charges, rendement | Modèles de quittance et de relance, échéancier des révisions ; indice IRL saisi par l'utilisateur | Gestion locative (outil interne) | **daté** : IRL et règles de révision, saisis ou sourcés ; modèles de quittance à faire vérifier (outil d'aide, pas un conseil juridique). **RGPD** (locataires). Argent : avertissement. Distinct de T64 (location saisonnière). Prêt le 14/11/2026 : fiche [`fiches/gestion-locative.md`](fiches/gestion-locative.md), application `templates/gestion-locative/` (GRT), livrables `communication/gestion-locative/`. |
| T28 | CRM freelance : prospects, clients, historique, prochaine action, projets, devis et factures, encaissements, chiffre d'affaires par client | Étapes de vente, prochaines actions types, modèles de devis et de facture | CRM et prospection (outils internes) | Backlog n° 09 fusionné. **RGPD** (clients, prospects). **daté**/**fiscal** : mentions et taux de TVA vérifiés par l'utilisateur ; factures en suivi seulement, pas un logiciel de facturation (facturation électronique obligatoire : calendrier à vérifier). Frontières avec T35 (pipeline) et T36 (devis) à fixer. Concurrence de CRM gratuits : simplicité, achat unique. |
| T29 | Gestion de flotte : véhicules, conducteurs, réservations, kilométrage, entretiens, sinistres, amendes, leasing, coût total par véhicule | Intervalles d'entretien types (communs avec T10) | Gestion de flotte (outil interne), Ma voiture en leasing | Backlog n° 37 fusionné. Base commune avec T57 (auto-école) et T10. **daté** (contrôle technique). **RGPD** (conducteurs, amendes). Format : application + modèle tableur. |
| T30 | Grille 30 min, glisser-déposer, catégories couleur, bilan prévu/réalisé hebdomadaire | Semaines types (cadre, freelance, étudiant), catégories préréglées | Planner horaire, grille de planning, planning rapide (outil interne) | — |
| T31 | Modèle de CR, extraction des actions (qui, quoi, quand), suivi des actions ouvertes entre réunions | Modèles de CR (réunion d'équipe, comité de pilotage, chantier) | Compte rendu en actions | Exemples de CR fictifs. **confidentiel à vérifier** (artefact). **RGPD** (noms des participants). |
| T32 | Liste par lot et localisation, photo, entreprise, échéance, statut, PV imprimable | Lots BTP types, modèle de PV de levée | Levée réserves lot 2B | **confidentiel à vérifier** (artefact) ; exemples fictifs. Caduque : limite localStorage ~5 Mo → stockage en ligne des photos à prévoir. Moteur réutilisé par T67. |
| T33 | Séquence horaire, responsables, go/no-go, points d'arrêt, journal d'incidents | Séquences types (migration informatique, déménagement de bureaux, ouverture de site) | Tableau de bascule (artefact) | **confidentiel** : exemples fictifs (informatique, bureaux, commerce). |
| T34 | KPI mensuels, objectifs, écarts, graphiques, saisie simple | Jeu de KPI types (CA, marge, pipe, charge) | Tableaux de bord de pilotage (outil interne) | Backlog : tableur seul ; application web par défaut, à trancher. **confidentiel à vérifier** : aucun tableau de bord interne d'origine professionnelle repris. |
| T35 | Pipeline par étapes, cadence de relance, scripts de messages, taux de conversion | Scripts de messages et cadences de relance | Suivi commercial (artefact client) | Format : application + modèle tableur. Conçu pour la prospection sur les réseaux professionnels, sans marque dans le nom du produit. **RGPD** (prospects). Aucune automatisation d'un réseau social. |
| T36 | Catalogue de prestations, lignes, remises, TVA, mentions légales, PDF | Catalogues de prestations par métier ; mentions obligatoires | Devis artisan, devis et chiffrages clients (artefacts) | **daté** (TVA, mentions) ; **fiscal** : mentions à vérifier ; devis seulement, pas un logiciel de facturation (facturation électronique obligatoire en cours de déploiement : calendrier à vérifier). **RGPD** (clients). Données des devis réels non reprises. |
| T37 | Coûts directs et indirects, temps passé, marge cible, prix plancher, rentabilité par client | à définir | Coûts et prix par client (outil interne) | Backlog : tableur seul ; à trancher. **daté** si les taux de charges de T40 sont repris. Aucun chiffre réel. |
| T38 | Fiche contexte, questions par phase, objections, prochaine étape, résumé imprimable | Banque de questions par phase, objections types | Briefings d'appels clients (artefacts) | Produit d'appel (prix bas). **RGPD** (prospects). Contenus des briefings réels non repris. |
| T39 | Fiches projets, filtres, page imprimable type plaquette | Modèles de fiches projets et de mise en page | Références et plaquette (outils internes) | Références réelles non reprises ; exemples fictifs. |
| T40 | Revenu cible, charges, jours facturables, statut (micro, SASU, EURL), TJM minimum | Taux de charges par statut | Profils freelance (outil interne) | **daté** : taux de charges, mise à jour annuelle obligatoire ; **fiscal**. |
| T41 | Journal, catégories, plafonds, estimation des cotisations, export annuel | Plafonds et taux de cotisation par activité | Suivi budget 3 800 € | **daté** : plafonds et taux URSSAF, mise à jour annuelle obligatoire ; **comptable** : pas un outil certifié ; **fiscal** (plafonds, versement libératoire). Backlog : tableur seul. |
| T42 | Encaissements et décaissements, scénarios, seuil d'alerte, graphique | à définir (scénarios types) | Suivi budget 3 800 €, Sankey | Backlog : tableur seul ; à trancher. **comptable**. Aucune échéance fiscale ou sociale en base sans source datée (**daté**). |
| T43 | Échéancier, retard en jours, pénalités légales, modèles de mails par palier | Modèles de mails par palier de relance | — | **daté** : taux des pénalités (backlog : taux BCE + 10 points, indemnité 40 €, à vérifier) ; paramétrable. **comptable**. **RGPD** (débiteurs, parfois particuliers). |
| T44 | TVA collectée et déductible, échéancier, contrôle de cohérence | Échéances par régime (paramétrables) | — | **daté** (taux, échéances) ; **fiscal** : outil d'aide, pas de conseil. Backlog : tableur seul. |
| T45 | Inventaire, affectations, licences, fin de garantie, historique, alertes | Catégories de matériel et types de licences | Poste central | Demandé explicitement. Format : application + modèle tableur. **RGPD** (affectations nominatives). Pack possible avec T46. **confidentiel à vérifier** (artefact « Poste central »). |
| T46 | Checklists par rôle, responsables, échéances de J-15 à J+90, restitution du matériel | Checklists d'arrivée et de départ par rôle | Poste central | **RGPD** (salariés). Couplé à T45. |
| T47 | Affectation par personne et projet en heures par semaine, taux de charge (temps partiel, absences, fériés déduits), conflits, postes à couvrir, vues semaine et mois, disponibles la semaine prochaine | 6 modèles d'équipe (rôles, compétences, postes) ; repères de durée L3121-27, L3121-20, L3121-22 datés et paramétrables | Équipes et staffing (outil interne) : mécanique seulement | Fiche détaillée : `fiches/planning-equipe.md`. Une clé partagée par les managers, saisies simultanées fusionnées (pas de comptes séparés en V1). **RGPD** : aucune donnée de santé, export, effacement, suppression. **confidentiel** : aucune équipe ni personne de l'outil interne reprise, démo fictive. **daté** : repères de durée relevés le 14/11/2026. |
| T48 | Soldes, demandes, calendrier d'équipe, chevauchements | Règles d'acquisition paramétrables | — | **daté** (règles légales et conventionnelles) : paramétrable. **RGPD**. Backlog : tableur seul. |
| T49 | Matrice personnes × compétences, niveaux, écarts, plan de formation | à définir | — | Backlog : tableur seul. **RGPD**. |
| T50 | Ressources, créneaux, conflits, vue jour | à définir | Planner horaire | Caduque : « mono-utilisateur en localStorage » ; un usage partagé est désormais possible mais réservations à plusieurs à concevoir (droits, conflits). |
| T51 | Rétroplanning, budget prévu/engagé/payé, prestataires et contrats, invités, checklist jour J | Rétroplanning type, postes de budget, checklist jour J | Organisateur de mariage, gestion de compétition, suivi budget (artefacts) | Demandé explicitement ; produit phare du backlog. Format : application + modèle tableur. Même moteur que T15 et T54. **RGPD** (invités). |
| T52 | Inscriptions, catégories, heats, saisie des scores, classement, affichage | Règles de classement paramétrables, catégories types | Gestion de compétition et feuille de route (artefacts client) | Affichage public = partage en lecture seule à concevoir. **RGPD** (participants). |
| T53 | Fiches adhérents, activités, quotient familial, paiements, listes d'appel | Activités types, tranches de quotient familial paramétrables | Inscriptions d'un centre social (artefact client) | **daté** : tranches de quotient familial, paramétrables. **RGPD** (adhérents, mineurs possibles) : obligations dans le guide. Format : application + modèle tableur. **confidentiel** : aucune donnée de l'artefact. |
| T54 | Participants, transports, chambres, régimes, programme, budget | à définir (reprend T51) | Organisateur de mariage (artefact client) | Déclinaison de T51. **RGPD** : régimes alimentaires et allergies sont des données sensibles. |
| T55 | Élèves, évaluations, compétences, moyennes, appréciations, bulletins | à définir | — | **RGPD** (élèves, mineurs). Caduque : « stockage local uniquement » ; les données sont désormais en ligne, à trancher avant développement. Concurrence des logiciels de vie scolaire. |
| T56 | Classes, formateurs, salles, créneaux, détection des conflits, vues par ressource | à définir | Grille de planning, planner horaire (outil interne) | Pas d'optimisation automatique en V1. **RGPD** (formateurs, apprenants). |
| T57 | Véhicules, kilométrage, entretiens, contrôles techniques, moniteurs, planning de leçons, coût par heure | Intervalles d'entretien types | Ma voiture en leasing | Demandé explicitement. Base commune avec T29. **daté** (contrôle technique). **RGPD** (élèves, moniteurs). Format : application + modèle tableur. |
| T58 | Banque de questions taguée, génération de quiz, correction, statistiques | à définir | Banque de questions d'élèves (artefact client) | Contenu de l'artefact non repris. **RGPD** si résultats nominatifs. |
| T59 | Séquences, séances, objectifs, avancement réel et prévu | à définir | Jalons à plage | **confidentiel** : artefact professionnel ; mécanique seulement. |
| T60 | Sites, équipements, interventions, indicateurs, carte ou liste, alertes | à définir | Pilotage de parcs (artefact professionnel) | **confidentiel** : aucune donnée, nom de site ni chiffre ; exemples fictifs (immobilier, équipements). Format : application + modèle tableur. |
| T61 | Équipements, plans de maintenance, échéances, bons d'intervention, historique | Plans de maintenance types | Artefacts professionnels de maintenance | **confidentiel** : mécanique seulement, aucune donnée ; exemples fictifs. **daté** si des périodicités réglementaires sont en base. Moteur commun avec T11 et T63. |
| T62 | Articles, entrées et sorties, seuils d'alerte, valorisation, inventaire | à définir | — | Backlog : tableur seul. |
| T63 | Registre des contrôles, périodicités, échéances, preuves, alertes | Types de contrôles (électricité, extincteurs…) sans périodicité légale non sourcée | Registre des visas | **daté** : périodicités réglementaires, paramétrables ou sourcées. Preuves : stockage de fichiers à prévoir. Format : application + modèle tableur. Décision (14/11/2026) : application seule, base sourcée INRS ED 828 datée, preuves en référence et lien (pas de fichiers). |
| T64 | Calendrier, réservations, ménage, taxe de séjour, revenus par plateforme | à définir | Location saisonnière (artefact client) | **daté** : taxe de séjour, paramétrable ; **fiscal**. **RGPD** (voyageurs). Backlog : tableur seul. Aucune donnée de l'artefact. |
| T65 | Dépenses communes, répartition au prorata des revenus, soldes, équilibrage | Méthodes de répartition (égale, prorata, personnalisée) | Budget commun, Budget commun partagé | Usage à deux : désormais possible (mêmes données), accès par deux personnes à concevoir. Argent : avertissement. |
| T66 | LOA, LLD, crédit, comptant : coût total, valeur résiduelle, kilométrage | à définir | Ma voiture en leasing | Produit d'appel. Argent : avertissement. **fiscal** pour les indépendants (déductibilité, TVA) : hors calcul ou signalé. |
| T67 | Comparateur de devis d'artisans, budget, planning, réserves de fin de travaux | Postes de travaux types, modèles de planning de rénovation (T02) | Devis artisan, Levée réserves, Chemin critique | Réutilise T32, T36 et T02. **confidentiel** : « Chemin critique » = mécanique seulement. |
| T68 | L'organisateur (clé `SNT`) crée plusieurs échanges ; les participants s'inscrivent sans compte par un lien (prénom, e-mail, code personnel, idées) ; exclusions ; tirage par le serveur, jamais montré à l'organisateur ; chacun découvre son tirage sur sa page | Modèles famille / amis / collègues (message et budget suggérés) | — | **Mode « ordinateur commun » ajouté le 13/11 (demande de Quentin, Secret Santa en box)** : l'organisateur saisit les prénoms, chacun choisit un code de 4 à 8 chiffres sur un ordinateur partagé (borne `?borne=`), puis y découvre son tirage ; 5 codes faux bloquent le prénom (déblocage ou remise à zéro par l'organisateur), résultat effacé de l'écran après 20 s. Décisions de Quentin (13/11/2026) : **aucun e-mail** (lien personnel ou reconnexion e-mail + code), **gratuit** (prix libre), exclusions, listes d'idées, budget et date, plusieurs échanges ; charte de base + couche Noël. API dédiée `/api/secret-santa/*` (moteur partagé avec la démo : `templates/secret-santa/moteur.js`, store Blobs `secret-santa` à Francfort). **RGPD** (données de tiers) : code personnel haché (scrypt), effacement automatique 60 jours après la date (180 sans date). Tests : `outils/templates/secret-santa.test.mjs`. LinkedIn : LI-99 le 01/12/2026 12:15 ; Instagram : IG-36 (Reel) le 01/12 18:30 ; média = vidéo de motion design de Noël uniquement (`assets/secret-santa-noel.mp4`, 46 s, musique « Christmas is coming » d'Alex-Productions, libre de droits (confirmé par Quentin le 13/11), crédit conservé ; texte et vidéo validés par Quentin le 13/11 ; sources `docs/templates/communication/secret-santa/video/`). Gumroad : fiche à créer (limite quotidienne atteinte le 13/11). |
| T71 | Saisie du temps par mission et par tâche (chronomètre ou saisie), temps facturable ou non, taux horaire réel, comparaison au TJM et au devis, alerte de dépassement | Catégories de tâches types, seuils d'alerte | — | Argent : avertissement. Complète T37 et T40. |
| T72 | Proposition structurée : contexte, objectifs, livrables, options à prix, planning, conditions ; export PDF ; suivi envoyée/acceptée | Trames par métier (conseil, développement, formation, travaux) | — | Distinct de T36 (devis chiffré). Mentions légales : renvoi à T36. |
| T73 | Sujets, formats, piliers éditoriaux, calendrier, régularité, statistiques saisies à la main | Banque d'idées de sujets par métier, formats types | — | Aucune marque dans le nom ; aucune automatisation d'un réseau social ; statistiques saisies. |
| T74 | Registre des consultations et candidatures (date limite, pièces, statut, résultat), taux de réussite, relances | Checklists de pièces types (sans référence réglementaire datée) | — | Pièces des marchés publics : paramétrables, pas de liste réglementaire non sourcée. |
| T75 | Liste des pièces DOE par lot (plans, notices, PV, fiches techniques), statut, relances, complétude par entreprise, bordereau imprimable | Pièces types par lot BTP | — | **confidentiel** : structure seulement. Lien avec T23 et T32. |
| T76 | Sous-traitants par lot, agrément, pièces de vigilance avec date de validité, alertes d'expiration | Types de pièces de vigilance | — | **daté** : périodicité des attestations à sourcer (service-public / Urssaf) ou paramétrable. **RGPD**. |
| T77 | Calendrier des entretiens annuels et professionnels par salarié, trames, objectifs, suivi des formations demandées | Trames d'entretien, questions types | — | **daté** : périodicité de l'entretien professionnel à sourcer (Légifrance) ou paramétrable. **RGPD**. Lien avec T49. |
| T78 | Unités de travail, risques, cotation (gravité × probabilité), actions de prévention, mise à jour, export | Familles de risques types par secteur | — | **daté**/réglementaire : obligations à sourcer (INRS, Légifrance) ; ne remplace pas un préventeur. **confidentiel** : exemples fictifs. |
| T79 | Contrats (assurances, maintenance, télécoms, leasing), échéance, préavis de résiliation calculé, tacite reconduction, coût annuel | Catégories de contrats, préavis types paramétrables | — | Règles de résiliation : paramétrables, aucune règle légale non sourcée. Moteur d'échéances commun avec T63. |
| T80 | Demandes d'achat, validation, commandes, réception, budget par service | Catalogue de fournitures types sans prix | — | Usage à plusieurs (demandeur / valideur) à concevoir. |
| T81 | Inventaire des documents du foyer (où ils sont rangés), durée de conservation, rappels de renouvellement (passeport, assurances) | Types de documents et durées de conservation | — | **daté** : durées à sourcer (service-public.gouv.fr, date de vérification) ou paramétrables. Pas de stockage de pièces d'identité en V1. |
| T82 | Soins, montant payé, remboursé Sécurité sociale et mutuelle, reste à charge, relances des remboursements en attente | Types de soins | — | **médical** : données de santé, hébergement à trancher (comme T04). Aucun taux de remboursement intégré (saisis). |
| T83 | Capacité d'emprunt (revenus, charges, taux d'endettement saisi), comparaison d'offres de prêt (taux, assurance, frais), tableau d'amortissement | Méthode de calcul d'amortissement | — | Taux et seuils saisis par l'utilisateur (**daté** sinon). Argent : avertissement. |
| T84 | Cadeaux reçus (de qui, quoi), carte de remerciement envoyée, adresses | — | — | **RGPD** (adresses de tiers). Complète T15. |
| T85 | Revue hebdomadaire guidée (bilan, priorités, prochaine semaine), journal court, historique | Questions de revue types | — | Complète T03, T30, T08. |
| T86 | Matières, coefficients, notes, moyennes pondérées, crédits ECTS, note nécessaire pour atteindre un objectif | Systèmes de notation (sur 20, ECTS) paramétrables | — | Pas de barème officiel d'examen intégré. |
| T87 | Vœux et candidatures (formation, établissement, pièces, dates saisies, statut, réponse) | Checklists de pièces types | — | **daté** : calendriers officiels non intégrés (saisis). Aucune marque de plateforme dans le nom. |
| T88 | Plan du mémoire, jalons, chapitres, rendez-vous avec le directeur, bibliographie simple, compte de mots | Jalons types (mémoire de master, thèse) | — | — |
| T89 | Dossiers de subvention (financeur, montant, dates saisies, pièces, statut), justificatifs, bilan d'utilisation | Pièces types d'un dossier | — | Aucun calendrier de financeur intégré (**daté**). |
| T90 | Bénévoles (disponibilités, compétences), créneaux d'un événement, affectation, conflits, liste imprimable | Postes types (accueil, buvette, montage) | — | **RGPD** (bénévoles). Lien avec T51 et T52. |
| T91 | Calendrier de l'AG, convocations, ordre du jour, quorum calculé (règle saisie), PV, mandats du bureau | Trames de convocation et de PV | — | Règles de quorum : celles des statuts, saisies. **RGPD**. |
| T92 | Pièces, éléments, état (entrée / sortie), photos, comparaison, relevés de compteurs, document imprimable | Pièces et éléments types | — | Stockage des photos à prévoir (comme T32). Outil d'aide, pas un document juridique certifié. |
| T93 | Prix d'achat, frais, travaux, loyers, charges, crédit (saisi), rendement brut et net, cash-flow | Postes types | — | Fiscalité hors calcul (signalé). Argent : avertissement. |
| T94 | Appels de fonds, charges par poste, AG (résolutions, votes), travaux votés | Postes de charges types | — | Pas de règle de majorité intégrée (saisie). |
| T95 | Objectif (10 km à marathon), allures calculées depuis un chrono de référence, plan par semaines, séances cochées | Plans types par distance | — | Sport : avertissement (pas un programme médical). Allures : formules à sourcer. |


## Fiches T69 et T70 (cahiers des charges de Quentin, 13/11/2026)

### T69 · Inventaire valorisé (`templates/patrimoine/`, préfixe PTM)
- Promesse : « Si tu revendais tout ce que tu possèdes aujourd'hui, combien pourrais-tu récupérer ? »
- Base intégrée : 15 catégories du cahier des charges, 80 sous-catégories, exemples d'objets **sans prix** ;
  7 états ; 5 fréquences d'utilisation ; 8 familles de décote (perte 1re année, perte annuelle, plancher,
  écart de revente, liquidité) ; multiplicateur par tranche de prix ; règles de revente facile.
- Source des coefficients : **hypothèses QME**, ordres de grandeur prudents, sans cotation, site de vente ni
  barème d'assureur ; tous modifiables (onglet Méthode). Aucune donnée qui se périme.
- Trois valeurs distinctes : prix d'achat, valeur actuelle estimée, revente potentielle ; saisie manuelle
  prioritaire. Simulateur (tous, catégorie, peu utilisés, jamais, seuil, nombre ; décote, négociation,
  commission, frais fixes, expédition). Historique mensuel automatique + valorisations manuelles,
  comparaison entre deux dates, projection 5 ans.
- Découverte gratuite : 10 objets, 6 catégories, bilan, répartition, revente potentielle, partage texte/image.
- Statut : prêt, fusionné dans `main` le 13/11/2026 (page « Mise en vente prochaine », démo et découverte en ligne).
  Communication prête : `communication/patrimoine/` (gumroad.md et gumroad.json, linkedin.md, instagram.md et carrousel PNG, prospects.md),
  fiche ajoutée à `communication/gumroad-a-creer.json`. Reste : création de la fiche Gumroad, clé de licence
  (Quentin), passage en vente du site, lignes des plannings LinkedIn et Instagram.

### T70 · Temps de vie (`templates/temps-de-vie/`, préfixe TDV)
- Promesse : « Combien d'heures de ta vie dois-tu travailler pour payer ce que tu consommes ? »
- Base intégrée : 5 profils, 3 conventions (contractuel ; réel avec trajet et frais professionnels ; annuel
  effectif), 6 périodicités, bibliothèque de 7 catégories et 45 sous-catégories (cahier des charges),
  extensible par l'utilisateur. **Aucun montant ni barème fiscal** ; valeurs par défaut du temps de travail
  (35 h, 5 j, 12 mois, 25 j de congés, 8 j non travaillés) uniquement pour compléter un profil partiel,
  signalées comme hypothèses.
- Calculateur instantané (heures, jours, semaines, mois ; 1, 5, 10 ans si récurrent), dépenses récurrentes et
  historique des achats (taux horaire du moment mémorisé), bilan du mode de vie, scénarios A/B/C (achat
  unique amorti sur sa durée), coût total de possession comparé.
- Partage sélectif : revenu jamais affiché sauf case cochée.
- Découverte gratuite : profil, calculateur illimité, 5 dépenses, synthèse, partage.
- Statut : prêt, fusionné dans `main` le 13/11/2026 (page « Mise en vente prochaine », démo et découverte en ligne).
  Communication prête : `communication/temps-de-vie/` (gumroad.md et gumroad.json, linkedin.md, instagram.md et carrousel PNG, prospects.md),
  fiche ajoutée à `communication/gumroad-a-creer.json`. Reste : création de la fiche Gumroad, clé de licence
  (Quentin), passage en vente du site, lignes des plannings LinkedIn et Instagram.

## Fiche T22 (cadrage délégué par Quentin, 14/11/2026)

### T22 · Tableau de bord annuel et roue de vie (`templates/tableau-annuel/`, préfixe RDV, 15 €)
- Promesse : « Ton année, domaine par domaine. » Piloter toute son année, pas seulement le travail : noter sa
  roue de vie, fixer quelques objectifs mesurables, les découper en actions trimestrielles, faire le point
  chaque trimestre et voir sa roue bouger dans le temps. Fusion du backlog n° 50 (roue de vie, bilan par domaine).
- Public : particuliers (cadres, indépendants, personnes en transition, adeptes du bilan de fin d'année) ;
  coachs pour eux-mêmes et en prescription (une licence = un tableau pour une personne ; suivi de plusieurs
  clients = sur mesure).
- Écrans : connexion ; premier lancement (prénom, choix de 4 à 8 domaines) puis point de départ guidé ;
  **Tableau** (roue de la dernière revue contre la précédente en pointillés, tuiles équilibre, score des
  objectifs contre l'attendu à date, actions du trimestre, prochaine revue ; bandeau quand une revue est due ou
  en retard ; objectifs à surveiller ; actions ouvertes) ; **Objectifs** par année (cartes avec résultats clés,
  statut, repère « attendu à date », reprise des objectifs non atteints de l'année précédente) ; **Trimestre**
  (actions par état, priorités choisies à la revue, actions restées ouvertes aux trimestres précédents à
  reporter ou abandonner, idées d'actions) ; **Évolution** (moyenne de la roue par revue, petits multiples par
  domaine sur la même échelle, avancement des objectifs, tableau des données, bilans écrits relus) ; **revue
  guidée** (un domaine par étape avec 3 questions de 0 à 10 et la note précédente rappelée, résultats clés,
  bilan écrit, 1 à 3 priorités avec actions du trimestre suivant, résumé ; brouillon synchronisé, reprise
  possible) ; réglages (domaines personnels, couleurs, questions, export JSON et CSV, « Sur téléphone »).
- Base intégrée (contenu original QME, `donnees.js`) : 12 domaines types (8 proposés par défaut) avec 3 questions
  chacun (36), 33 objectifs modèles avec 1 à 3 résultats clés, 48 idées d'actions, questions de bilan (5
  trimestrielles, 3 annuelles), repères de méthode (roue de vie, OKR, trimestre, revue), unités.
- Calculs (`regles.js`, testés) : note d'un domaine = moyenne de ses questions ; équilibre = moyenne des
  domaines notés ; variations entre deux revues ; domaines faibles suggérés comme priorités ; avancement d'un
  résultat clé du départ vers la cible dans les deux sens, plafonné ; statut d'un objectif contre la part de
  l'année écoulée (atteint, dans les temps, à surveiller à moins de 15 points, en retard, non atteint) ; score de
  l'année ; revue due 21 jours avant la fin du trimestre, revue oubliée signalée en retard, revue du 4e
  trimestre = bilan annuel ; report d'action ; reprise d'objectifs ; export CSV ; texte du bilan.
- Sources : roue de vie (outil classique de coaching) et méthode OKR (largement documentée) citées comme
  méthodes, aucune base externe reprise ; rien ne se périme. Aucune donnée ni contenu de l'outil interne de
  Quentin. Avertissement : outil de réflexion personnelle, ne remplace pas un professionnel ; aucune donnée de
  santé demandée.
- Statut : prêt le 14/11/2026 (branche locale, non poussée, sans PR). Page `catalogue/tableau-annuel/`
  « Mise en vente prochaine », cartes du catalogue FR (Projets de vie) et EN, connexion, `PRODUITS`, en-têtes
  Netlify. Communication prête : `communication/tableau-annuel/` (gumroad.md et gumroad.json, linkedin.md,
  instagram.md et carrousel PNG, prospects.md, section-site.html), fiche ajoutée à
  `communication/gumroad-a-creer.json`. Reste : création de la fiche Gumroad (permalien prévu
  `tableau-annuel-roue-de-vie`), clé de licence (Quentin), passage en vente du site, lignes des plannings
  LinkedIn et Instagram (non planifiées).

## Fiche T13 (décisions de cadrage déléguées par Quentin, 14/11/2026)

### T13 · Objectif d'épargne et fonds d'urgence (`templates/epargne/`, préfixe EPG)
- Promesse : « Chaque euro a un but. » Un montant, un versement mensuel, une date d'atteinte pour chaque
  objectif, en commençant par le fonds d'urgence.
- Public : particuliers et familles qui épargnent pour un projet (jeunes actifs, futurs acheteurs immobiliers,
  indépendants aux revenus variables, parents). Prix 12 € (prix minimum), nom et prix choisis par délégation.
- Base intégrée (`donnees.js`, contenu original QME, **aucun montant, taux, plafond ni produit**) : 13 objectifs
  types (fonds d'urgence, apport immobilier, voiture, voyage, travaux, arrivée d'un enfant, mariage ou fête,
  études d'un enfant, permis, déménagement, dépenses annuelles prévisibles, projet personnel, autre), chacun
  avec ses postes de budget à chiffrer, un horizon indicatif pour la date visée proposée, un conseil de
  support générique (disponible, sans risque…) et un point d'attention ; 11 postes de dépenses essentielles
  pour le fonds d'urgence ; questionnaire de taille du fonds (3 situations, 5 facteurs) ; paliers de jalons
  (10, 25, 50, 75, 100 % et 1, 3, 6 mois couverts) ; 8 conseils, glossaire de 8 termes, mode de calcul.
- Source du repère de taille : « 3 à 6 mois de dépenses », ordre de grandeur courant en éducation financière,
  présenté comme repère ; ajustement par situation (stable 3, variable 5, indépendant 6, + 1 par facteur,
  borné de 3 à 12) = **hypothèses QME**, affichées comme telles. Aucune donnée qui se périme : le taux est
  saisi par l'utilisateur pour chaque objectif (0 % par défaut), capitalisation mensuelle ou annuelle
  (décembre, comme un livret).
- Écrans : Tableau (versements du mois cochés en un geste, alertes retard, capacité dépassée, rythme,
  absence de fonds d'urgence, prochains jalons, épargne totale réelle puis projetée) ; Objectifs (cartes par
  statut, capacité d'épargne, plan des 12 prochains mois ; détail : trajectoire réelle et projetée, budget
  par postes ou fonds d'urgence avec questionnaire, jalons datés, versements ponctuels prévus, historique,
  archivage) ; Scénarios (3 hypothèses versement, taux, apport ; date d'atteinte, total versé, intérêts,
  solde à la date visée ; versement nécessaire pour un mois choisi ; « Appliquer à l'objectif ») ; Historique
  (versements, retraits, intérêts reçus, filtre, export CSV) ; Guide.
- Calculs (`regles.js`, testés dans `outils/templates/epargne.test.mjs`) : projection mensuelle (intérêts
  sur le solde de début de mois, puis versement ; arrêt des versements à l'atteinte, dernier versement
  ajusté), versement nécessaire par recherche dichotomique arrondi à l'euro supérieur, statut (atteint, dans
  les temps, en retard, sans date, en pause, hors d'atteinte), mois couverts, jalons réels et prévus.
- Risques : **argent**, avertissement dans l'application, la page et la fiche Gumroad (aide au calcul, aucun
  produit ni taux recommandé, fiscalité non calculée) ; banques calculant par quinzaine ou au jour près :
  estimation signalée.
- Statut : prêt le 14/11/2026 (page « Mise en vente prochaine », démo libre, bouton « Je suis intéressé(e) »).
  Communication prête : `communication/epargne/` (gumroad.md et gumroad.json, linkedin.md, instagram.md et
  carrousel PNG, prospects.md, section-site.html, cartes). Reste : création de la fiche Gumroad (et ajout à
  `communication/gumroad-a-creer.json`), clé de licence (Quentin), passage en vente du site, lignes des
  plannings LinkedIn et Instagram (non insérées : aucune session n'a eu accès aux plannings pour ce template).

## Fiche T16 · Déménagement (`templates/demenagement/`, préfixe DMN, 12 €)

Cadrage délégué par Quentin (14/11/2026) : fiche rédigée et appliquée sans validation intermédiaire.

- **Promesse** : « Chaque carton à sa place. » Un déménagement calé sur sa date : quoi faire chaque semaine,
  qui prévenir, ce qu'il y a dans chaque carton, ce que ça coûte.
- **Pour qui** : particuliers et familles qui déménagent (location ou achat, avec un déménageur ou par
  leurs propres moyens) ; usage à deux possible (même clé sur plusieurs appareils).
- **Écrans** : tableau de bord (compte à rebours, recherche « dans quel carton est… », à faire maintenant,
  cartons par pièce, budget) ; checklist par phase (plus de deux mois avant → premier mois), filtres par
  catégorie ; cartons (numéro, pièce d'arrivée et sa couleur, contenu, fragile, lourd, à ouvrir en premier,
  état à remplir → fermé → arrivé → déballé, étiquettes A4 huit par page, liste par pièce imprimable,
  manquants signalés après J) ; devis et volume (devis comparés : prix au m³, prestations incluses,
  validité, acompte, devis retenu inscrit au budget ; estimation du volume par meubles et cartons, inventaire
  à copier pour les demandes de devis) ; budget (prévu, réel, payé, reste à payer, CSV).
- **Base intégrée** (`donnees.js`, rédigée pour QME) : 85 tâches types en 7 catégories (logement, adresse,
  contrats, organisation, famille, jour J, installation), échéances relatives de J−90 à J+30, filtrées par la
  situation (départ locataire ou propriétaire, arrivée location ou achat, déménageur ou soi-même, enfants,
  animal, véhicule) ; 8 pièces et 10 couleurs d'étiquette ; 39 meubles avec un volume indicatif ; 13 postes de
  budget ; 3 formules et 8 prestations de devis.
- **Calculs** (`regles.js`, testés dans `outils/templates/demenagement.test.mjs`) : échéances relatives au
  jour J (changer la date recale tout), statuts (en retard, sous 7 jours), progression, changement de
  situation (ajout des tâches devenues utiles, retrait de celles encore à faire, tâches retirées à la main
  jamais remises), recherche sans accents ni casse (numéro exact en tête), volume (meubles + cartons × 0,06 m³
  + marge), comparaison des devis, budget.
- **Données qui se périment : aucune.** Aucune démarche datée ni délai légal chiffré (vérifié par un test
  qui refuse tout « n jours / mois / ans » et toute année dans la base) : préavis, état des lieux, dépôt de
  garantie, carte grise, listes électorales renvoient au bail, au contrat ou à service-public.fr. Volumes des
  meubles : ordres de grandeur indicatifs (hypothèses QME), présentés comme tels. Carton standard de
  55 × 35 × 30 cm ≈ 0,06 m³ (calcul).
- **Risques** : pas un conseil juridique (avertissement dans l'application, la page et la fiche Gumroad) ;
  aucune marque, aucun déménageur réel (démo : « Déménageur A, B, C ») ; aucune automatisation ni envoi.
  À vérifier par Quentin : la mention du téléservice de changement de coordonnées de service-public.fr
  (tâche « a02 », formulée avec « vérifie la liste des organismes couverts »).
- **Statut** : prêt le 14/11/2026, « Mise en vente prochaine » (page `catalogue/demenagement/`, démo libre,
  bouton « Je suis intéressé(e) », carte `carte prochaine` du catalogue, carte « Coming soon » sur
  `/en/templates/`). Communication prête : `communication/demenagement/` (gumroad.md et gumroad.json,
  linkedin.md, instagram.md et carrousel PNG, prospects.md, section-site.html pour la mise en vente).
  Reste : création de la fiche Gumroad et report dans `communication/gumroad-a-creer.json`, clé de licence
  (Quentin), passage en vente du site, lignes des plannings LinkedIn et Instagram (non créées).
## Fiche T34 (cadrage délégué par Quentin, 14/11/2026)

### T34 · Tableau de bord de pilotage PME (`templates/pilotage-pme/`, préfixe TDB)
- Fiche détaillée : [`fiches/pilotage-pme.md`](fiches/pilotage-pme.md). Application web (pas de tableur), 39 €,
  permalien prévu `tableau-de-bord-pme`, catalogue `pro` · thème « Indépendants ».
- Promesse : « Tes chiffres du mois face à tes objectifs, en dix minutes de saisie. »
- Base intégrée : bibliothèque de 45 indicateurs types en 6 domaines (commercial, finances, trésorerie, RH,
  production et activité, qualité) avec définition, formule, sens de lecture, source du chiffre et conseil ;
  14 indicateurs calculés (taux de marge, point mort, autonomie de trésorerie, délai de paiement approché,
  taux de charge, absentéisme…) ; 5 jeux de départ par activité. **Aucun ratio sectoriel de référence.**
- Écrans : tableau de bord du mois (statuts, tendances, mini-courbes), saisie mensuelle rapide, fiches
  indicateurs (courbe réel / objectif / an dernier, cumul, projection), objectifs annuels répartis (égale,
  saisonnière, mois par mois) et seuils, revue mensuelle imprimable avec actions.
- Marques : **comptable** (outil de pilotage, pas un logiciel comptable). Confidentiel vérifié : aucun tableau
  de bord interne repris, démo fictive.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/pilotage-pme/?demo`,
  bouton « Je suis intéressé(e) », carte `carte prochaine` du catalogue, thème « Indépendants », carte anglaise).
  Page `catalogue/pilotage-pme/`, captures `assets/templates-pilotage-pme-*.webp`, couverture
  `assets/templates-pilotage-pme-couverture.png`, tests `outils/templates/pilotage-pme.test.mjs`.
- Communication prête dans `communication/pilotage-pme/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html, cartes d'accueil FR et EN). **Pas de fiche
  Gumroad, pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à
  confirmer, fiche Gumroad (permalien prévu `tableau-de-bord-pme`) et clé de licence (Quentin), entrée dans
  `communication/gumroad-a-creer.json`, plannings, passage en vente du site.
## Fiche T23 · Suivi de chantier par lot (`templates/suivi-chantier/`, préfixe CHT)

Fiche détaillée rédigée le 14/11/2026 sur délégation de Quentin : `fiches/suivi-chantier.md`.
- Périmètre tranché : **produit séparé** de T32 (réserves) et de T25 (non-conformités). Pilotage contractuel
  et financier par lot (marché, avenants, situations de travaux, échéancier, jalons, journal et intempéries,
  sous-traitants, risques, courriers et ordres de service, synthèse financière, revue de projet) avec un
  registre de non-conformités simplifié qui renvoie vers T25 et T32.
- Base intégrée : découpage type en 20 lots, 15 jalons types, 12 pièces de marché, typologies des
  non-conformités (10) et des risques (10), modèle de revue de projet. **Aucun indice, taux ou délai
  réglementaire** : retenue (5 % par défaut), délai de paiement, coefficient de révision K et pénalités
  saisis d'après le marché. Deux repères juridiques cités « à vérifier sur Légifrance » (lois du 16/07/1971
  et du 31/12/1975), non consultés.
- **Confidentiel** : structure seulement, démo entièrement fictive. **RGPD** : intervenants limités à des
  coordonnées professionnelles, rappel dans l'application.
- Statut : prêt le 14/11/2026 (branche locale, non poussée), « Mise en vente prochaine » (démo libre, bouton
  « Je suis intéressé(e) », carte `carte prochaine` du thème « Projets et chantiers »). Communication prête
  dans `communication/suivi-chantier/` (gumroad.md et gumroad.json, linkedin.md, instagram.md et carrousel
  PNG, prospects.md, section-site.html). Reste : confirmation du nom et du prix, création de la fiche
  Gumroad (non ajoutée à `communication/gumroad-a-creer.json`, fichier partagé), clé de licence (Quentin),
  lignes des plannings LinkedIn et Instagram, passage en vente du site.

## Fiche T61 (cadrage délégué par Quentin, 14/11/2026)

### T61 · Maintenance préventive, GMAO légère (`templates/maintenance/`, préfixe GMA)
- Fiche détaillée : [`fiches/maintenance.md`](fiches/maintenance.md). Application web, 39 €, permalien prévu
  `maintenance-preventive`, catalogue `pro` · thème « Équipements et véhicules ». Packs prévus : Moyens généraux,
  Exploitation et maintenance (`GMA` ajouté à `TEMPLATES` et retiré de `PREVUS` dans `outils/packs/donnees.mjs` ;
  ajout aux `produits` des packs laissé au coordinateur).
- Promesse : « Chaque machine entretenue à temps. »
- Base intégrée : 16 familles d'équipements, 54 opérations types avec points de contrôle (périodicités
  **indicatives, non sourcées**, la notice du fabricant prime) ; **daté** : 2 obligations sourcées reprises de
  T11 (chaudières 4–400 kW, art. R224-41-4 à R224-41-9 ; thermodynamiques 4–70 kW, art. R224-44 à R224-44-5),
  vérifiées le 13/11/2026, à revoir chaque année ; 10 vérifications réglementaires **sans périodicité**
  (levage, pression, électricité, incendie, portes automatiques, éclairage de sécurité, fluides frigorigènes,
  conduit de cuisine) : « à paramétrer » jusqu'à la saisie de l'utilisateur.
- Moteur d'échéances commun avec T11 et T29 (date, compteur, premier atteint, date estimée par le rythme,
  recalage glissant ou calendaire) ; bons d'intervention imprimables ; pièces de rechange ; coût par équipement ;
  indicateurs (taux de réalisation du préventif, ponctualité, retards, pannes).
- **Confidentiel** vérifié : aucun artefact professionnel repris, démo fictive (« Atelier Exemple »).
- Statut : **prêt**, « Mise en vente prochaine » (page `catalogue/maintenance/`, démo libre, bouton « Je suis
  intéressé(e) »). Communication : [`communication/maintenance/`](communication/maintenance/) (linkedin.md,
  instagram.md et carrousel PNG, prospects.md, gumroad.md et gumroad.json, section-site.html, cartes). Reste :
  fiche Gumroad (et entrée de `communication/gumroad-a-creer.json`), clé de licence (Quentin), lignes des
  plannings LinkedIn et Instagram, ajout aux packs, version anglaise (en attente).
- À vérifier : périodicités indicatives des plans types ; libellés des vérifications réglementaires (liste non
  exhaustive) ; catégorie Gumroad.

## Fiche T06 · Repas de la semaine et liste de courses (`templates/repas/`, préfixe RPS, 13 €)

Cadrage délégué par Quentin (14/11/2026) : fiche rédigée et appliquée sans validation intermédiaire.

- **Promesse** : « Le menu de la semaine, la liste de courses faite toute seule. » On choisit les repas du midi et
  du soir, la liste se calcule, rangée par rayon, et se coche au magasin sur le téléphone.
- **Pour qui** : familles et foyers qui cuisinent au quotidien (packs « Forme » et « Famille ») ; usage à deux
  (même clé sur les deux téléphones : l'un planifie, l'autre fait les courses). Catalogue : `perso`, thème
  « Santé et forme ».
- **Écrans** (4 onglets) : **Semaine** (planning lundi → dimanche, midi et soir, plusieurs plats par créneau,
  nombre de personnes par repas, texte libre « restes », « dehors » sans courses ; propositions automatiques
  pour les créneaux vides selon la saison et les régimes ; copie de la semaine précédente) ; **Courses** (liste
  agrégée par rayon dans l'ordre de son magasin, unités cohérentes, conditionnements indicatifs, cases à cocher
  en magasin avec progression, « déjà à la maison », articles ajoutés à la main et articles habituels, partage
  en texte) ; **Recettes** (base intégrée et recettes perso, recherche, filtres catégorie, végétarien, sans porc,
  rapide, de saison, favoris ; fiche avec quantités recalculées pour N personnes ; « créer ma version » d'une
  recette de la base) ; **Avec ce qu'il me reste** (ingrédients du frigo → recettes classées par ce qui manque).
- **Base intégrée** (`donnees.js`) : **recettes familiales simples rédigées pour QME** (aucune copiée d'un site
  ou d'un livre : noms de plats courants, quantités et étapes écrites pour le template), ingrédients et
  quantités pour 4 personnes, temps, saisons, catégories ; catalogue d'ingrédients avec rayon, unité, poids
  moyen d'une pièce (hypothèses QME, ordres de grandeur) et marqueurs viande, porc, poisson qui calculent les
  régimes (végétarien, sans porc) au lieu de les déclarer ; 13 rayons.
- **Calculs** (`regles.js`, testés dans `outils/templates/repas.test.mjs`) : mise à l'échelle des quantités,
  conversion d'unités (g, kg, ml, cl, l, cuillères, pièces ; pièces ↔ grammes quand le poids moyen est connu),
  agrégation de la liste par ingrédient et par rayon, arrondis d'achat (pièces entières), lecture d'une ligne
  d'ingrédient saisie (« 200 g de farine »), classement « avec ce qu'il me reste », propositions de repas
  (saison, régimes, pas deux fois la même recette, soirs de semaine rapides), semaine (lundi), saison du mois.
  **Moteur de liste de courses partageable avec T04** : `listeCourses(lignes, catalogue)` ne dépend que de
  lignes `{ ingredient, qte, unite }`, sans rien savoir du planning.
- **Données qui se périment : aucune.** Pas de prix, pas d'enseigne, pas de valeurs nutritionnelles (c'est T04).
  Saisons des recettes : repères de cuisine, pas une donnée réglementaire.
- **Risques** : allergies (les régimes sont calculés depuis les ingrédients de la base, pas une garantie :
  avertissement « vérifie les étiquettes ») ; aucune marque, aucun magasin, aucun drive connecté ; démo fictive.
- **Base livrée** : 82 recettes (47 plats, 6 tartes et pizzas, 8 soupes, 9 salades, 12 desserts ; 48 sans
  viande ni poisson), 126 ingrédients, 14 rayons. Saisie d'une recette perso en texte libre (« 200 g de farine »,
  « 1 boîte de tomates concassées » convertie avec le conditionnement), ingrédient inconnu créé dans « Autres » et
  déplaçable de rayon depuis la liste.
- **Statut** : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/repas/?demo`, bouton
  « Je suis intéressé(e) », carte `carte prochaine` du catalogue, thème « Santé et forme » ; version anglaise en
  attente : aucune carte sur `/en/`). Page `catalogue/repas/`, captures `assets/templates-repas-*.webp`, couverture
  `assets/templates-repas-couverture.png`, tests `outils/templates/repas.test.mjs`. Packs : `RPS` ajouté à
  `TEMPLATES` et retiré de `PREVUS` et des listes `prevus` des packs Forme et Famille dans
  `outils/packs/donnees.mjs` ; **reste à l'ajouter à `produits` des packs Forme (PFM) et Famille (PFA)** dans
  `netlify/lib/packs.mjs` et à régénérer les pages (`node outils/packs/generer.mjs`).
- Communication prête dans `communication/repas/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, cartes d'accueil FR et EN, kanban.txt). **Pas de fiche Gumroad,
  pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer,
  fiche Gumroad (permalien prévu `repas-liste-de-courses`) et clé de licence (Quentin), entrée dans
  `communication/gumroad-a-creer.json`, plannings, carte anglaise, passage en vente du site.


## Fiche T21 (cadrage délégué par Quentin, 14/11/2026)

### T21 · Planificateur de voyage (`templates/voyage/`, préfixe VYG, 13 €)

Fiche rédigée et appliquée sans validation intermédiaire (décisions de cadrage déléguées par Quentin).

- **Promesse** : « Le voyage tient dans ta poche. » L'itinéraire par étapes, le toit de chaque nuit, les
  activités jour par jour, le budget prévu puis réel et, au retour, qui doit quoi à qui.
- **Pour qui** : voyageurs, familles et groupes d'amis (usage `perso`, catalogue « Vie personnelle » ·
  thème « Projets de vie ») ; un voyage à la fois, plusieurs voyageurs sur la même clé (1 à 20). Packs visés :
  « Voyage » (PVY, avec le Budget commun) et « Mariage et installation à deux » (PMR, lune de miel).
- **Écrans** (5 onglets + réglages) : **Aperçu** (J−n, « jour k sur n » ou « terminé » ; chemin des étapes en
  une ligne ; tuiles nuits réservées, à réserver, dépensé sur prévu, préparation ; alertes : nuit sans
  hébergement, deux hébergements la même nuit, hébergement hors dates, étapes qui se chevauchent ;
  programme d'aujourd'hui et de demain ; à réserver ; à payer sur place ; qui doit quoi) ; **Itinéraire**
  (étapes et trajets dans l'ordre, tableau nuit par nuit avec étape, hébergement et état, liste des
  hébergements avec montant, acompte et reste à payer, liste des transports) ; **Jour par jour** (une carte
  par jour : transports et activités à leur heure, nuit du soir, ajout direct ; activités sans date à
  part ; impression ; itinéraire en texte à copier) ; **Budget** (prévu et réel par poste et par personne,
  écart, déjà réservé, barres réel/prévu et tableau ; dépenses filtrées par poste, CSV ; qui doit quoi :
  remboursements proposés, par voyageur payé/part/solde, remboursements faits) ; **Préparer** (bagages par
  liste avec progression, documents à prévoir, sources officielles des formalités). Réglages : voyage,
  voyageurs, archivage, exports, sauvegarde JSON, compte, « Sur téléphone », données personnelles, à propos.
- **Base intégrée** (`donnees.js`, rédigée pour QME) : 9 postes de budget (3 alimentés par le plan :
  transports, hébergements, activités) ; 8 modes de transport ; 9 listes de bagages par type de séjour
  (essentiels, ville, plage, montagne, hiver, camping, vol long-courrier, jeunes enfants, voiture ;
  83 éléments) ; 10 documents à prévoir, chacun avec une consigne sans règle chiffrée ; 4 conseils ;
  4 sources officielles.
- **Calculs** (`regles.js`, `window.VYG`, testés dans `outils/templates/voyage.test.mjs`) : nuits = dates du
  soir (départ exclu) ; couverture nuit par nuit (sans toit, à réserver, réservé, en double) ; reste à
  payer = montant − acompte tant que non soldé ; étape de chaque nuit et étapes du jour de transition ;
  programme trié par heure ; itinéraire et chemin en texte ; à réserver trié par date, urgent à 14 jours ;
  budget prévu = plan + montants saisis, réel = dépenses, engagé = réservé ; **dépenses partagées : moteur
  commun avec T65**, `templates/budget-commun/regles.js` chargé tel quel avant `regles.js` (répartition au
  centime en parts égales, en parts ou en montants, soldes, nombre minimal de remboursements ; mode
  « prorata des revenus » ramené à parts égales) ; dépense créée depuis un élément du plan (liée) ; bagages
  sans doublon ; archivage (résumé gardé, listes décochées) ; fusion entre appareils en cas de conflit 409
  (union, le plus récent l'emporte, aucune dépense perdue) ; CSV des dépenses.
- **Données qui se périment : aucune intégrée.** Aucune règle de formalité (validité des papiers, visa,
  vaccins) ni délai : un test refuse tout « n jours / mois / ans » dans la base. Formalités renvoyées à France
  Diplomatie (Conseils aux voyageurs) et à service-public.fr (Passeport N360, Carte d'identité N358,
  Autorisation de sortie du territoire F1359), adresses vérifiées le 14/11/2026. Aucun taux de change : les
  montants se saisissent en euros (note libre pour le montant d'origine).
- **Risques** : argent (avertissement dans l'application, la page et la fiche Gumroad : ni agence ni conseil
  financier, remboursements = proposition de calcul) ; aucune réservation, aucune plateforme, aucune marque
  (test qui refuse les noms de plateformes et de compagnies) ; démo fictive (« Italie du Nord, exemple
  fictif », hébergements et adresses fictifs) ; données personnelles : rappel de ne saisir ni numéro de
  passeport ni code de carte. Confidentiel vérifié : aucun artefact repris.
- **Statut** : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/voyage/?demo`,
  page `catalogue/voyage/` avec « Je suis intéressé(e) », carte `carte prochaine` du catalogue, thème
  « Projets de vie »). Captures `assets/templates-voyage-*.webp`, couverture
  `assets/templates-voyage-couverture.png`. Communication prête dans `communication/voyage/` (linkedin.md,
  instagram.md et carrousel PNG, prospects.md, gumroad.md et gumroad.json, section-site.html, carte
  d'accueil FR, carte anglaise « Coming soon » non insérée). **Version anglaise en attente** (`en/` non
  modifié). **Pas de fiche Gumroad, pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces
  outils). Restent : fiche Gumroad (permalien prévu `planificateur-voyage`) et clé de licence (Quentin),
  entrée dans `communication/gumroad-a-creer.json`, ajout de `VYG` aux packs PVY et PMR
  (`netlify/lib/packs.mjs`, `PAGES` de `outils/packs/donnees.mjs`, pages `/packs/` régénérées), plannings,
  carte anglaise, passage en vente du site.

## Fiche T63 (cadrage délégué par Quentin, 14/11/2026)

### T63 · Vérifications réglementaires (`templates/verifications/`, préfixe VRF, 35 €)
- Fiche détaillée : [`fiches/verifications.md`](fiches/verifications.md). Application web (pas de tableur),
  permalien prévu `verifications-reglementaires`, catalogue `pro` · thème « Équipements et véhicules ».
  Packs prévus : Moyens généraux (PMG) et Exploitation et maintenance (PXP).
- Promesse : « Aucun contrôle oublié. » Pour responsables QHSE, gestionnaires de bâtiments, dirigeants de PME
  et d'ERP.
- Base intégrée : 22 types de contrôles (électricité, éclairage de sécurité, extincteurs, RIA, SSI,
  désenfumage, sprinklers, ascenseurs, portes automatiques, levage, gaz, chauffage, cuisines, ventilation),
  chacun avec sa périodicité **sourcée** : brochure INRS ED 828 « Principales vérifications périodiques »,
  édition de septembre 2026, page et textes cités, **consultée le 14/11/2026** (date affichée dans
  l'application, le guide et le registre). Règles APSAD et normes signalées « référentiel, pas un texte de
  loi ». Tout autre contrôle : type « Autre », périodicité saisie par l'utilisateur.
- Écrans : bord (alertes, état par site), équipements par site, observations à lever (preuve obligatoire),
  calendrier 12 mois, registre imprimable par site, guide et sources, réglages. Moteur d'échéances commun
  avec T11/T24 (mois bornés à la fin du mois, jours), délai de 2 ans des installations électriques seulement
  s'il est possible (arrêté du 26/12/2011, art. 3).
- Preuves : référence et lien (le service des templates ne stocke que du JSON) ; pas de fichiers en V1.
- Marques : **daté** (revérifier la brochure à chaque édition, au moins une fois par an) ; avertissement « outil
  d'aide, ne remplace ni un organisme agréé ni la réglementation » partout. Confidentiel vérifié : démo fictive.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/verifications/?demo`,
  bouton « Je suis intéressé(e) », carte `carte prochaine` du catalogue, thème « Équipements et véhicules »).
  Page `catalogue/verifications/`, captures `assets/templates-verifications-*.webp`, couverture
  `assets/templates-verifications-couverture.png`, tests `outils/templates/verifications.test.mjs`.
  **Version anglaise en attente** (`en/` non modifié ; carte prête dans `communication/verifications/carte-en-prochaine.html`).
- Communication prête dans `communication/verifications/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html, cartes d'accueil FR et EN). **Pas de fiche
  Gumroad, pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à
  confirmer, fiche Gumroad (permalien prévu `verifications-reglementaires`) et clé de licence (Quentin), entrée
  dans `communication/gumroad-a-creer.json`, ajout aux packs PMG et PXP (`netlify/lib/packs.mjs`) et
  régénération des pages de packs, plannings, page anglaise, passage en vente du site.

## Fiche T52 (cadrage délégué par Quentin, 14/11/2026)

### T52 · Gestion de compétition sportive (`templates/competition/`, préfixe CMP, 49 €)
- Fiche détaillée : [`fiches/competition.md`](fiches/competition.md). Application web, catalogue `pro` · thème
  « Associations, formation et événements », pack « Associations et clubs ».
- Promesse : « Du premier inscrit au podium, sans tableur. »
- Inscriptions (individuel ou équipes), catégories, épreuves (temps avec temps limite et « CAP+ », répétitions,
  charge, points, départage, coefficient), vagues générées avec horaires et feuilles de juge, saisie des scores,
  classement paramétrable (somme des rangs ou barème, départage général).
- Affichage public : mode écran plein écran dans l'application et lien public en lecture seule
  (`/api/competition/*`, instantané sans coordonnées, effacé 30 jours après la compétition).
- Marques : **RGPD** (participants). Aucun nom d'épreuve de référence ou de marque.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/competition/?demo`, bouton
  « Je suis intéressé(e) », carte `carte prochaine` du catalogue, thème « Associations, formation et événements »).
  Page `catalogue/competition/`, captures `assets/templates-competition-*.webp`, couverture
  `assets/templates-competition-couverture.png`, tests `outils/templates/competition.test.mjs`. Pas de carte anglaise
  (version anglaise en attente).
- Communication prête dans `communication/competition/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, carte d'accueil FR). **Pas de fiche Gumroad, pas de ligne aux
  plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer, fiche Gumroad
  (permalien prévu `gestion-competition`) et clé de licence (Quentin), entrée dans `communication/gumroad-a-creer.json`,
  ajout au pack « Associations et clubs » (`netlify/lib/packs.mjs`, pages des packs), carte anglaise, plannings,
  passage en vente du site.
