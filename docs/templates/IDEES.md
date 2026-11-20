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
| T01 | Planning de révision | Études | Lycéens, étudiants, candidats aux concours | en vente | 14,90 € | M | — | Liste initiale 12/11/2026 ; version 2 (16/11/2026, partenariat Optimind) : jauge jour J, rattrapage, session guidée, import de programme, examens blancs, agenda, partage, Pack Étudiant connecté ; démo `?demo=concours` (concours d'attaché territorial, lien `/demo/yves`, proposition de partenariat Yves Gautier, 16/11/2026) |
| T02 | Planning Gantt rapide (chemin critique, jalons à plage) | Gestion de projet | Artisans, PME, chefs de projet, BTP, ingénierie | en vente | 45 € | L | P1 | Quentin 12/11/2026 + Backlog Quentin n° 03 |
| T03 | Gestionnaire de tâches (inbox et triage) | Tâches | Indépendants, cadres, étudiants | en vente | 19 € | M | P1 | Quentin 12/11/2026 + Backlog Quentin n° 01 |
| T04 | Nutrition et dépense énergétique | Santé | Personnes qui gèrent leur poids, sportifs amateurs | en vente | 19 € | L | P1 | Quentin 12/11/2026 + Backlog Quentin n° 47 |
| T05 | Mon Budget | Budget perso | Particuliers | en vente | 15 € | M | P1 | Liste initiale 12/11/2026 + Backlog Quentin n° 43 |
| T06 | Repas de la semaine et liste de courses | Cuisine | Familles, particuliers | en vente | 13 € | M | P2 | Liste initiale 12/11/2026 |
| T07 | Carnet de musculation et cross-training | Sport | Pratiquants, coachs | en vente | 19 € | M | P2 | Liste initiale 12/11/2026 + Backlog Quentin n° 48 |
| T08 | Suivi d'habitudes et routines | Personnel | Particuliers | en vente | 12 € | S | P2 | Liste initiale 12/11/2026 + Backlog Quentin n° 46 |
| T09 | Garde-manger et dates de péremption | Maison | Familles | prêt | 12 € | S | P3 | Liste initiale 12/11/2026 |
| T10 | Carnet de voiture : entretiens, kilométrage, dépenses | Véhicule | Particuliers, foyers à plusieurs voitures | en vente | 13 € | M | P2 | Liste initiale 12/11/2026 + demande Quentin 13/11/2026 |
| T11 | Entretien de la maison | Maison | Propriétaires, locataires | prêt | 12 € | S | P2 | Liste initiale 12/11/2026 |
| T12 | Remboursement de dettes | Budget perso | Particuliers endettés | en vente | 12 € | S | P2 | Liste initiale 12/11/2026 |
| T13 | Objectif d'épargne et fonds d'urgence (fiche en fin de fichier) | Budget perso | Particuliers | en vente | 12 € | S | P3 | Liste initiale 12/11/2026 |
| T14 | Suivi des abonnements | Budget perso | Particuliers | en vente | 9 € | S | P2 | Liste initiale 12/11/2026 |
| T15 | Organisateur de mariage | Événementiel perso | Futurs mariés | en vente | 29 € | M | P1 | Liste initiale 12/11/2026 + Backlog Quentin n° 28 |
| T16 | Déménagement | Personnel | Particuliers qui déménagent | prêt | 12 € | S | P3 | Liste initiale 12/11/2026 |
| T21 | Planificateur de voyage : étapes, nuits, activités, budget | Voyage | Voyageurs, familles, groupes d'amis | en vente | 13 € | M | P3 | Liste initiale 12/11/2026 + demande Quentin 13/11/2026 |
| T22 | Tableau de bord annuel et roue de vie | Personnel | Particuliers, coachs | en vente | 15 € | M | P3 | Liste initiale 12/11/2026 + Backlog Quentin n° 50 |
| T23 | Suivi de chantier par lot (contrat, avenants, non-conformités) | BTP / ingénierie | Maîtres d'œuvre, bureaux d'études, PME du BTP | en vente | 40 € | L | P2 | Documents de travail de Quentin 12/11/2026 |
| T17 | Suivi de lecture | Loisirs | Lecteurs | en vente | 12 € | S | P3 | Liste initiale 12/11/2026 |
| T18 | Calendrier du potager | Jardin | Jardiniers amateurs | prêt | 13 € | M | P3 | Liste initiale 12/11/2026 |
| T19 | Suivi du bébé | Famille | Jeunes parents | prêt | 13 € | M | P3 | Liste initiale 12/11/2026 |
| T20 | Suivi d'un animal de compagnie | Animaux | Propriétaires de chien ou de chat | prêt | 12 € | S | P3 | Liste initiale 12/11/2026 |
| T24 | Circuit de visa des documents (registre des visas) | BTP / ingénierie | MOE, bureaux d'études, OPC | en vente | 39 € | M | P1 | Documents de travail de Quentin 12/11/2026 + Backlog Quentin n° 05 |
| T25 | Registre des non-conformités et actions correctives | Qualité | PME du BTP et de l'industrie, responsables qualité | en vente | 20 € | M | P1 | Documents de travail de Quentin 12/11/2026 |
| T26 | Notes de frais et indemnités kilométriques | Comptabilité | Salariés, indépendants | en vente | 15 € | S | P2 | Documents de travail de Quentin 12/11/2026 + Backlog Quentin n° 19 |
| T27 | Gestion locative (biens, locataires, loyers) | Immobilier | Propriétaires bailleurs | prêt | 20 € | M | P2 | Documents de travail de Quentin 12/11/2026 |
| T28 | CRM freelance (clients, projets, factures) | Commercial | Freelances, consultants | en vente | 25 € | M | P1 | Documents de travail de Quentin 12/11/2026 + Backlog Quentin n° 09 |
| T29 | Gestion de flotte de véhicules | Flotte | PME, collectivités | en vente | 39 € | M | P1 | Documents de travail de Quentin 12/11/2026 + Backlog Quentin n° 37 |
| T30 | Planner horaire time-blocking | Emploi du temps | Cadres, freelances | en vente | 15 € | M | P1 | Backlog Quentin n° 02 |
| T31 | Compte rendu → plan d'actions | Réunions | Managers, chefs de projet | en vente | 15 € | S | P1 | Backlog Quentin n° 04 |
| T32 | Levée de réserves (OPR) | BTP | Conducteurs de travaux, MOE, syndics | en vente | 39 € | M | P1 | Backlog Quentin n° 06 |
| T33 | Pilotage d'une journée de bascule | Opérations | Responsables production, IT, logistique | prêt | 29 € | M | P2 | Backlog Quentin n° 07 |
| T34 | Tableau de bord de pilotage PME | Direction | Dirigeants TPE/PME | en vente | 39 € | M | P2 | Backlog Quentin n° 08 |
| T35 | Pipeline de prospection B2B | Commercial | Commerciaux, indépendants B2B | en vente | 25 € | M | P1 | Backlog Quentin n° 10 |
| T36 | Générateur de devis | Commercial | Artisans, freelances | en vente | 29 € | M | P1 | Backlog Quentin n° 11 |
| T37 | Coût de revient et prix par client | Finance pro | Prestataires de services | en vente | 25 € | S | P1 | Backlog Quentin n° 12 |
| T38 | Préparateur d'appel découverte | Commercial | Consultants, commerciaux | en vente | 12 € | S | P2 | Backlog Quentin n° 13 |
| T39 | Kit références et plaquette | Marketing | Indépendants, petites agences | en vente | 19 € | S | P3 | Backlog Quentin n° 14 |
| T40 | Calculateur TJM freelance | Finance pro | Freelances débutants | en vente | 12 € | S | P1 | Backlog Quentin n° 15 |
| T41 | Livre recettes-dépenses micro-entreprise | Comptabilité | Micro-entrepreneurs | en vente | 25 € | S | P1 | Backlog Quentin n° 16 |
| T42 | Trésorerie prévisionnelle 12 mois | Comptabilité | TPE, indépendants | en vente | 29 € | M | P1 | Backlog Quentin n° 17 |
| T43 | Relance des impayés | Comptabilité | TPE, freelances | en vente | 19 € | S | P2 | Backlog Quentin n° 18 |
| T44 | Suivi de TVA | Comptabilité | Petites sociétés au réel | en vente | 19 € | S | P3 | Backlog Quentin n° 20 |
| T45 | Gestion de parc de postes de travail | IT / moyens généraux | DSI de PME, office managers | en vente | 35 € | M | P1 | Backlog Quentin n° 21 |
| T46 | Onboarding / offboarding salarié | RH | RH de PME, managers | en vente | 19 € | S | P2 | Backlog Quentin n° 22 |
| T47 | Planning d'équipe et staffing | RH / opérations | Managers d'équipe, agences | en vente | 35 € | L | P2 | Backlog Quentin n° 23 · fiche [`fiches/planning-equipe.md`](fiches/planning-equipe.md) |
| T48 | Suivi congés et absences | RH | TPE sans SIRH | en vente | 19 € | S | P2 | Backlog Quentin n° 24 |
| T49 | Matrice compétences et formations | RH | Responsables formation, managers | prêt | 25 € | S | P3 | Backlog Quentin n° 25 |
| T50 | Réservation de salles et bureaux | Moyens généraux | PME en flex office, coworkings modestes, associations | en vente | 19 € | M | P3 | Backlog Quentin n° 26 |
| T51 | Pilote événementiel complet | Événementiel | Agences événementielles, chargés de communication | prêt | 49 € | L | P1 | Backlog Quentin n° 27 |
| T52 | Gestion de compétition sportive | Événementiel sport | Salles de cross-training, clubs, associations | en vente | 49 € | L | P2 | Backlog Quentin n° 29 |
| T53 | Inscriptions associatives | Associatif | Associations, centres sociaux, clubs | en vente | 29 € | M | P1 | Backlog Quentin n° 30 |
| T54 | Séminaire / offsite | Événementiel | Assistants de direction, RH | prêt | 35 € | M | P3 | Backlog Quentin n° 31 |
| T55 | Gestion de classe | Éducation | Enseignants collège et lycée | prêt | 25 € | M | P2 | Backlog Quentin n° 32 |
| T56 | Emploi du temps d'établissement | Éducation / formation | Organismes de formation, écoles privées | prêt | 45 € | L | P2 | Backlog Quentin n° 33 |
| T57 | Gestion de flotte auto-école | Éducation / flotte | Auto-écoles | prêt | 45 € | L | P1 | Backlog Quentin n° 34 |
| T58 | Banque de questions et quiz formateur | Formation | Formateurs, enseignants | prêt | 19 € | M | P3 | Backlog Quentin n° 35 |
| T59 | Progression pédagogique | Éducation | Enseignants, formateurs | prêt | 15 € | S | P3 | Backlog Quentin n° 36 |
| T60 | Pilotage de parcs multi-sites | Exploitation | Exploitants (immobilier, équipements) | prêt | 49 € | L | P2 | Backlog Quentin n° 38 |
| T61 | Maintenance préventive (GMAO légère) | Exploitation | Ateliers, services techniques | en vente | 39 € | M | P2 | Backlog Quentin n° 39 |
| T62 | Stocks et inventaire | Commerce | Petits commerces, artisans | en vente | 25 € | S | P2 | Backlog Quentin n° 40 |
| T63 | Vérifications réglementaires | Conformité | Responsables QHSE, gestionnaires de bâtiments | en vente | 35 € | M | P2 | Backlog Quentin n° 41 ; fiche [`fiches/verifications.md`](fiches/verifications.md) |
| T64 | Location saisonnière | Immobilier | Propriétaires de meublés | prêt | 25 € | S | P2 | Backlog Quentin n° 42 |
| T65 | Gestion Dépenses Communes couple / colocation | Budget perso | Couples, colocataires | en vente | 15 € | S | P1 | Backlog Quentin n° 44 |
| T66 | Simulateur leasing vs achat | Budget perso | Particuliers, indépendants | en vente | 12 € | S | P2 | Backlog Quentin n° 45 |
| T67 | Pilote de travaux maison | Habitat | Particuliers en rénovation | en vente | 25 € | M | P1 | Backlog Quentin n° 49 |
| T68 | Secret Santa (amis, famille, collègues) | Événementiel perso | Organisateurs de Secret Santa (familles, groupes d'amis, équipes) | en vente | gratuit (prix libre) | M | P1 | Quentin 13/11/2026 |
| T69 | Inventaire et valorisation du patrimoine matériel (inventaire valorisé) | Budget perso | Particuliers | en vente | 19 € | M | P1 | Quentin 13/11/2026 |
| T70 | Temps de vie : coût réel des dépenses en heures de travail | Budget perso | Particuliers | en vente | 19 € | M | P1 | Quentin 13/11/2026 |
| T73 | Suivi du temps passé et rentabilité par mission | Finance pro | Freelances, consultants | en vente | 19 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Freelance gestion) |
| T74 | Propositions commerciales (note de cadrage, options, planning) | Commercial | Freelances, consultants, agences | en vente | 19 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Freelance clients) |
| T75 | Calendrier éditorial des réseaux professionnels | Marketing | Freelances, indépendants | en vente | 15 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Freelance clients) |
| T76 | Suivi des candidatures aux appels d'offres et plateformes | Commercial | Freelances, PME | en vente | 15 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Freelance clients) |
| T77 | Registre du DOE (pièces à remettre par lot, relances) | BTP | MOE, entreprises, OPC | en vente | 29 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Chef de projet BTP) |
| T78 | Conformité des sous-traitants (agréments, attestations) | BTP | Entreprises générales, MOE | en vente | 29 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Chef de projet BTP) |
| T79 | Entretiens annuels et professionnels | RH | Dirigeants de TPE/PME, managers | en vente | 19 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Petite entreprise) |
| T80 | Document unique d'évaluation des risques | RH / sécurité | Employeurs de TPE/PME | en vente | 29 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Petite entreprise) |
| T81 | Contrats fournisseurs et échéances de résiliation | Moyens généraux | Office managers, dirigeants | prêt | 25 € | S | P2 | Proposition validée par Quentin 14/11/2026 (packs Moyens généraux, Exploitation) |
| T82 | Demandes d'achat et fournitures | Moyens généraux | Office managers | prêt | 19 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Moyens généraux) |
| T83 | Papiers du foyer (où est quoi, durée de conservation) | Budget perso | Particuliers | en vente | 15 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Argent) |
| T84 | Remboursements santé (soins, Sécurité sociale, mutuelle) | Budget perso | Particuliers, familles | prêt | 12 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Argent) |
| T85 | Capacité d'emprunt et comparateur de prêts | Budget perso | Particuliers, primo-accédants | en vente | 15 € | S | P2 | Proposition validée par Quentin 14/11/2026 (packs Argent, Propriétaire) |
| T86 | Cadeaux reçus et remerciements | Événementiel perso | Futurs mariés, familles | prêt | 12 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Mariage et installation) |
| T87 | Revue hebdomadaire et journal de bord | Personnel | Cadres, indépendants | prêt | 12 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Productivité) |
| T88 | Notes et moyennes (coefficients, ECTS, objectifs) | Études | Lycéens, étudiants | en vente | 12 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Étudiant) |
| T89 | Candidatures études, stages, alternance | Études | Lycéens, étudiants | en vente | 12 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Étudiant) |
| T90 | Planning de mémoire ou de thèse | Études | Étudiants, doctorants | en vente | 15 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Étudiant) |
| T91 | Subventions (dossiers, échéances, justificatifs) | Associatif | Associations | prêt | 25 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Associations) |
| T92 | Bénévoles et planning des créneaux | Associatif | Associations, clubs, organisateurs | prêt | 19 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Associations) |
| T93 | Assemblée générale et vie statutaire | Associatif | Bureaux d'associations | prêt | 19 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Associations) |
| T94 | État des lieux d'entrée et de sortie | Immobilier | Propriétaires bailleurs, locataires | en vente | 19 € | M | P2 | Proposition validée par Quentin 14/11/2026 (pack Propriétaire) |
| T95 | Rentabilité d'un investissement locatif | Immobilier | Investisseurs particuliers | en vente | 15 € | S | P2 | Proposition validée par Quentin 14/11/2026 (pack Propriétaire) |
| T96 | Charges et assemblées générales de copropriété | Immobilier | Copropriétaires | prêt | 15 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Propriétaire) |
| T97 | Plan d'entraînement course à pied | Sport | Coureurs amateurs | prêt | 15 € | S | P3 | Proposition validée par Quentin 14/11/2026 (pack Forme) |
| T98 | Vivre sans voiture : simulateur du gain annuel, urgences et parades | Budget perso / mobilité | Particuliers, familles qui envisagent de vendre leur voiture | en vente | 9 € | M | P2 | Idée de Quentin 17/11/2026 (prix de 9 € demandé par Quentin, dérogation à la règle des 12 €) |
| T99 | Liaison Mon Budget ↔ Gestion Dépenses Communes : « ma part du commun » reprise dans le budget perso (évolution de T05 et T65, pas un nouveau produit) | Budget perso | Couples, familles, colocataires qui ont un budget perso et des dépenses partagées | idée | — (mise à jour gratuite des deux templates) | M | P2 | Idée de Quentin 20/11/2026 (fiche en fin de fichier) |
| T71 | Dossier sinistre habitation (nom de travail « SinistreFacile ») | Habitat / assurance | Particuliers sinistrés (dégât des eaux, incendie, climat, cambriolage, bris de glace) | en vente | 29 € | L | P1 | Cahier des charges de Quentin 13/11/2026 |
| T72 | Assistant administratif après décès (nom de travail « AprèsVous ») | Famille / administratif | Proches d'une personne décédée | fiche | 39 € | L | P1 | Cahier des charges de Quentin 13/11/2026 |

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
- 44 Gestion Dépenses Communes (T65) : distinct de T05 (répartition entre personnes) ; proche du partage de dépenses
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
| Freelance : chiffrer, facturer, encaisser | PFG | T40, T37, T36, T41, T43, T42, T73 | — | 158 € | 25 % | 118 € | 30 € |
| Freelance : trouver ses clients | PFC | T38, T35, T28, T74, T39, T75, T76 | — | 130 € | 25 % | 97 € | 25 € |
| Chef de projet BTP | PBT | T02, T24, T32, T25, T31, T23, T77, T78 | — | 256 € | 25 % | 192 € | 48 € |
| Petite entreprise | PPE | T48, T26, T46, T42, T31, T34, T47, T79, T80 | — | 219 € | 25 % | 164 € | 41 € |
| Moyens généraux | PMG | T45, T29, T46, T61, T63, T50, T33, T81, T82 | — | 259 € | 25 % | 194 € | 49 € |
| Reprendre la main sur son argent | PAR | T05, T14, T12, T70, T69, T13, T83, T84, T85 | — | 131 € | 25 % | 98 € | 25 € |
| Mariage et installation à deux | PMR | T15, T65, T05, T16, T21, T86 | — | 96 € | 25 % | 72 € | 18 € |
| Productivité perso | PPR | T03, T30, T08, T22, T87 | — | 73 € | 25 % | 54 € | 14 € |
| Étudiant | PET | T01, T30, T08, T17, T88, T89, T90 | — | 92,90 € | 25 % | 69 € | 18 € |
| Associations et clubs | PAS | T53, T51, T42, T52, T91, T92, T93 | — | 219 € | 25 % | 164 € | 41 € |
| Propriétaire | PPB | T64, T67, T11, T27, T71, T85, T95, T96, T94 | — | 175 € | 25 % | 131 € | 33 € |
| Forme | PFM | T04, T08, T06, T07, T97 | — | 78 € | 25 % | 58 € | 15 € |
| Famille | PFA | T05, T11, T06, T09, T19, T20 | — | 77 € | 25 % | 57 € | 15 € |
| Voyage | PVY | T65, T21 | — | 28 € | 10 % | 25 € | 9 € |
| Enseignant et formateur | PNS | T59, T58, T55, T56 | — | 104 € | 20 % | 83 € | 21 € |
| Exploitation et maintenance | PXP | T61, T63, T60, T81 | — | 148 € | 20 % | 118 € | 30 € |
| Commerçant et artisan | PCA | T62, T36, T41, T42, T44 | — | 127 € | 25 % | 95 € | 24 € |
| Ma voiture | PVT | T66, T10 | T98 (prix à sa sortie : 34 €, −15 %, 28 €, option 9 €) | 25 € | 10 % | 22 € | 9 € |
| Budget perso et famille (Quentin, 20/11/2026) | PBF | T05, T65, T14, T13, T12 | — | 63 € | 25 % | 47 € | 12 € |

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
| T43 | `impayes` | RCV | relance-impayes |
| T46 | `onboarding` | ARD | onboarding-offboarding (prévu) |
| T48 | `conges` | CNG | suivi-conges-absences (prévu) |
| T62 | `stocks` | STK | stocks-inventaire (prévu) |
| T64 | `location-saisonniere` | SJR | location-saisonniere (prévu) |
| T66 | `leasing` | VTR | simulateur-leasing-achat (prévu) |
| T13 | `epargne` | EPG | objectif-epargne (prévu) |
| T23 | `suivi-chantier` | CHT | suivi-chantier-lot (prévu) |
| T47 | `planning-equipe` | EQP | planning-equipe-staffing |
| T06 | `repas` | RPS | repas-liste-de-courses (prévu) |
| T07 | `musculation` | MSC | carnet-musculation-cross-training (prévu) |
| T10 | `voiture` | CAR | carnet-voiture (prévu) |
| T27 | `gestion-locative` | GST | gestion-locative (prévu) |
| T33 | `bascule` | BSC | pilotage-bascule (prévu) |
| T55 | `gestion-classe` | CSE | gestion-classe (prévu) |
| T56 | `emploi-du-temps` | EDT | emploi-du-temps-etablissement (prévu) |
| T60 | `parcs-multi-sites` | PRK | pilotage-parcs-multi-sites (prévu) |
| T77 | `doe` | RDE | registre-doe (prévu) |
| T09 | `garde-manger` | GRD | garde-manger-dates-peremption (prévu) |
| T17 | `lecture` | PGS | suivi-lecture (prévu) |
| T20 | `animal` | ANM | suivi-animal-compagnie (prévu) |
| T44 | `tva` | TVA | suivi-tva (prévu) |
| T49 | `competences` | FRM | matrice-competences-formations (prévu) |
| T59 | `progression` | PRG | progression-pedagogique (prévu) |
| T18 | `potager` | PTG | calendrier-potager (prévu) |
| T19 | `bebe` | BBE | suivi-bebe (prévu) |

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
| LI-111 | T71 sinistre | 2027-01-19 | 12:15 |
| LI-112 | T26 notes-de-frais | 2027-01-21 | 12:15 |
| LI-113 | T38 appel-decouverte | 2027-01-23 | 12:15 |
| LI-114 | T43 impayes | 2027-01-25 | 12:15 |
| LI-115 | T46 onboarding | 2027-01-27 | 12:15 |
| LI-116 | T48 conges | 2027-01-29 | 08:30 |
| LI-117 | T62 stocks | 2027-02-03 | 12:15 |
| LI-118 | T64 location-saisonniere | 2027-02-05 | 12:15 |
| LI-119 | T66 leasing | 2027-02-07 | 08:30 |
| LI-120 | T06 repas | 2027-02-09 | 12:15 |
| LI-121 | T07 musculation | 2027-02-11 | 12:15 |
| LI-122 | T10 voiture | 2027-02-13 | 08:30 |
| LI-123 | T27 gestion-locative | 2027-02-15 | 12:15 |
| LI-124 | T33 bascule | 2027-01-30 | 08:30 |
| LI-125 | T55 gestion-classe | 2027-02-17 | 12:15 |
| LI-126 | T56 emploi-du-temps | 2027-02-19 | 08:30 |
| LI-127 | T60 parcs-multi-sites | 2027-02-21 | 12:15 |
| LI-128 | T09 garde-manger | 2027-02-23 | 12:15 |
| LI-129 | T17 lecture | 2027-02-25 | 08:30 |
| LI-130 | T20 animal | 2027-02-27 | 12:15 |
| LI-131 | T44 tva | 2027-03-01 | 12:15 |
| LI-132 | T49 competences | 2027-03-04 | 08:30 |
| LI-133 | T59 progression | 2027-03-06 | 12:15 |
| LI-134 | T18 potager | 2027-03-08 | 12:15 |
| LI-135 | T19 bebe | 2027-03-10 | 08:30 |
| LI-136 | T54 seminaire | 2027-03-12 | 12:15 |
| LI-137 | T58 quiz | 2027-03-14 | 12:15 |

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
**Lot du 14/11/2026, troisième (T06, T07, T10, T27)**, prêts, « Mise en vente prochaine » (démo libre, bouton
« Je suis intéressé(e) », pas de fiche Gumroad : entrées dans `communication/gumroad-a-creer.json`). Applications
`templates/repas/` (RPS, 13 €), `templates/musculation/` (MSC, 19 €), `templates/voiture/` (CAR, 13 €),
`templates/gestion-locative/` (GST, 20 €) ; pages `catalogue/<slug>/` ; fiches `fiches/<slug>.md` ; livrables dans
`communication/<slug>/` (linkedin.md, instagram.md, prospects.md, gumroad.md, carrousel `instagram/`). Noms et
prix repris du tableau de bord, à confirmer par Quentin avant la création des fiches Gumroad. Publications
insérées le 14/11 avec la remarque « ne publier que si la fiche Gumroad est en ligne » : LinkedIn « Programmé »
LI-120 (T06, 09/02), LI-121 (T07, 11/02), LI-122 (T10, sam. 13/02 : créneau donné par la règle), LI-123 (T27,
15/02) ; Instagram « Prêt » (à relire par Quentin avant « Programmé ») IG-75 (T06, 10/02), IG-76 (T07, 12/02),
IG-77 (T10, 14/02), IG-78 (T27, 16/02). Images déposées dans Drive le 14/11 (couvertures `LI-120…123-<slug>.png` dans le dossier Images du planning
LinkedIn, carrousels `IG-75…78-<slug>-1…5.png` dans Images Instagram, IDs en colonne P). Restent à vérifier :
T06, recettes rédigées par QME (quantités et temps non testés), liste des 14 allergènes (règlement UE
1169/2011) non revérifiée sur EUR-Lex, attribution indicative ; T07, aucune donnée de santé, aucun WOD nommé,
le mot « CrossFit » absent ; sources des formules d'Epley et de Brzycki et de l'échelle RPE non consultées
directement ; usage du terme « WOD » à arbitrer ; pas de jeu de hashtags « sport » dans le kit ; T10, contrôle
technique vérifié sur service-public.gouv.fr (F2878) le 14/11/2026, délai d'une contre-visite elle-même
défavorable non vérifié, intervalles d'entretien indicatifs non sourcés ; T27, fiches service-public F1311,
F31269, F947 et article 21 de la loi de 1989 relus le 14/11/2026, autres numéros d'articles, charges
récupérables, gel des loyers des logements classés E à vérifier, aucun calcul d'impôt, hashtags hors kit ;
catégories Gumroad (`food-and-cooking`, `fitness-and-health`, `personal-finance`) à vérifier à la création ;
organismes de `prospects.md` marqués « à vérifier ».

**Lot du 14/11/2026, cinquième (T33, T55)**, prêts, « Mise en vente prochaine » (démo libre, bouton « Je suis
intéressé(e) », pas de fiche Gumroad : entrées dans `communication/gumroad-a-creer.json`). T34 et T61, prévus
dans ce lot, en ont été retirés : déjà développés sur la branche `claude/wonderful-hypatia-ikasey` d'une autre
session. Applications `templates/bascule/` (BSC, 29 €) et `templates/gestion-classe/` (CSE, 25 €) ; pages
`catalogue/<slug>/` ; fiches `fiches/bascule.md` et `fiches/gestion-classe.md` ; livrables dans
`communication/<slug>/` (linkedin.md, instagram.md, prospects.md, gumroad.md, carrousel `instagram/`). Noms et
prix repris du tableau de bord, à confirmer par Quentin avant la création des fiches Gumroad (permaliens
proposés `pilotage-bascule` et `gestion-classe`, catégories `business-and-money/management-and-leadership` et
`education` à vérifier). Publications insérées le 14/11 avec la remarque « ne publier que si la fiche Gumroad
est en ligne » : LinkedIn « Programmé » LI-124 (T33, sam. 30/01 : créneau donné par la règle, à décaler si
besoin) et LI-125 (T55, 17/02) ; Instagram IG-79 (T33, 31/01) et IG-80 (T55, 18/02).
Images déposées dans Drive le 14/11 (couvertures `LI-124-bascule.png` et `LI-125-gestion-classe.png`,
carrousels `IG-79-bascule-1…5.png` et `IG-80-gestion-classe-1…5.png`, IDs en colonne P) : IG-79 et IG-80 passées
en « Prêt », à relire par Quentin avant « Programmé ».
**T55 : point bloquant RGPD** (données d'élèves mineurs hébergées en ligne par QME) à trancher par Quentin
avant toute mise en vente et avant LI-125 / IG-80 : options détaillées dans `fiches/gestion-classe.md`
(minimisation déjà en place : prénom et initiale ou pseudonyme, aucun champ sensible, avertissements,
effacement de fin d'année). Restent à vérifier : T55, articles D122-1 et D122-3 du code de l'éducation lus sur
Légifrance le 14/11/2026 par un outil de lecture résumée (à relire mot pour mot), Éduscol et cnil.fr non
consultés, choix de calcul (moyenne annuelle des moyennes de périodes, bonus seulement s'il fait monter la
moyenne, arrondi des compétences) ; T33, les 5 séquences types fictives et le libellé « point d'arrêt », accès
unique sans rôles ni lecture seule, impression vérifiée dans le code seulement ; organismes de `prospects.md`
marqués « à vérifier ».

**Lot du 14/11/2026, sixième (T56, T60)**, prêts, « Mise en vente prochaine » (démo libre, bouton « Je suis
intéressé(e) », pas de fiche Gumroad : entrées dans `communication/gumroad-a-creer.json`). Applications
`templates/emploi-du-temps/` (EDT, 45 €, démo `/templates/emploi-du-temps/?demo`, page `/catalogue/emploi-du-temps/`) et
`templates/parcs-multi-sites/` (PRK, 49 €, démo `/templates/parcs-multi-sites/?demo`, page
`/catalogue/parcs-multi-sites/`) ; fiches `fiches/emploi-du-temps.md` et `fiches/parcs-multi-sites.md` ; livrables dans
`communication/<slug>/` (linkedin.md, instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et gumroad.json,
cartes FR/EN). Noms et prix repris du tableau, à confirmer par Quentin avant la création des fiches Gumroad (permaliens
proposés `emploi-du-temps-etablissement` et `pilotage-parcs-multi-sites`, catégories à vérifier). Publications insérées
le 14/11 avec la remarque « ne publier que si la fiche Gumroad est en ligne » : LinkedIn « Programmé » LI-126 (T56, ven.
19/02, 08:30) et LI-127 (T60, dim. 21/02, 12:15) ; Instagram « Prêt » IG-81 (T56, 20/02) et IG-82 (T60, 22/02), à
relire par Quentin avant « Programmé ». Couvertures et carrousels déposés dans Drive (IDs dans les colonnes Remarque et
P des plannings). T60 est **confidentiel** : démo entièrement fictive (sites inventés, villes réelles utilisées seulement
comme repères géographiques, à remplacer par des villes fictives si Quentin le préfère), aucune donnée ni chiffre réel,
carte schématique en SVG sans fond de carte ni service externe ; « modèle tableur » traité par import et export CSV
(`;`, UTF-8 avec BOM) et deux modèles vides téléchargeables, pas de fichier tableur séparé. T56 : **RGPD** limité au nom
des formateurs et des groupes, aucun nom d'apprenant (effectif chiffré seulement), avertissement dans les Réglages.
**À faire valider par Quentin** : T56, périmètre V1 (placement manuel seulement, pas de demi-groupes hiérarchiques, une
séance = un groupe, accès unique sans comptes formateurs), alternance A/B qui saute les semaines fermées, « réalisé » =
séance terminée, limite de taille (environ 200 séances par semaine sur l'année, purge des semaines passées), nom de
l'organisme fictif de la démo ; T60, périmètre léger (aucune périodicité réglementaire en base, pas de pièces jointes
ni de bons d'intervention, accès sans droits par personne), thème « Équipements et véhicules », vue 1 du carrousel
(« trente équipements » alors que la démo en compte 29) ; hashtags hors jeux habituels (LinkedIn des deux, Instagram de
T60). Non vérifiés : article L3133-1 du Code du travail (jours fériés repris du template congés), impression papier
réelle, Safari et Firefox réels (émulation Chromium seulement), ouverture des CSV dans Excel ou LibreOffice, organismes
de `prospects.md` (« à vérifier »).

**Lot du 14/11/2026, septième (T09, T17, T20, T44)**, prêts, « Mise en vente prochaine » (démo libre, bouton « Je suis
intéressé(e) », pas de fiche Gumroad : entrées dans `communication/gumroad-a-creer.json`). Applications
`templates/garde-manger/` (GRD, 12 €, démo `/templates/garde-manger/?demo`, page `/catalogue/garde-manger/`),
`templates/lecture/` (PGS, 12 €, démo `/templates/lecture/?demo`, page `/catalogue/lecture/`), `templates/animal/` (ANM,
12 €, démo `/templates/animal/?demo`, page `/catalogue/animal/`) et `templates/tva/` (TVA, 19 €, démo
`/templates/tva/?demo`, page `/catalogue/tva/`) ; fiches `fiches/<slug>.md` ; livrables dans `communication/<slug>/`
(linkedin.md, instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et gumroad.json, cartes FR/EN,
couverture.txt, integration.md). Noms et prix repris du tableau, à confirmer par Quentin avant la création des fiches
Gumroad (permaliens proposés `garde-manger-dates-peremption`, `suivi-lecture`, `suivi-animal-compagnie`, `suivi-tva` ;
catégories à vérifier). Publications insérées le 14/11 avec la remarque « ne publier que si la fiche Gumroad est en
ligne » : LinkedIn « Programmé » LI-128 (T09, mar. 23/02, 12:15), LI-129 (T17, jeu. 25/02, 08:30), LI-130 (T20, sam.
27/02, 12:15) et LI-131 (T44, lun. 01/03, 12:15) ; Instagram « Prêt » IG-83 (T09, 24/02), IG-84 (T17, 26/02), IG-85
(T20, 28/02) et IG-86 (T44, 02/03), à relire par Quentin avant « Programmé ». Couvertures et carrousels déposés dans
Drive (IDs dans les colonnes Remarque et P des plannings). Mentions respectées : T09, rappel « l'emballage et l'aspect
priment », DLC et DDM distinguées, deux seules durées chiffrées (Anses, source et date affichées) ; T20, **médical**
(avertissement partout, aucune posologie) et **daté** (aucun calendrier vaccinal intégré, intervalles saisis d'après le
vétérinaire) ; T44, **daté** (taux et échéances paramétrables, sourcés et datés, statut « à vérifier ») et **fiscal**
(« outil d'aide, pas un conseil fiscal »), application web plutôt que tableur seul. Thèmes du catalogue : T09, T17 et T20
rattachés à « Organisation et études » (pas de puce Maison, Loisirs ni Animaux ; une puce « Maison et loisirs » pourrait
les réunir), T44 à « Indépendants » (pas de puce Comptabilité).
**À faire valider par Quentin** : prix, noms, permaliens et catégories Gumroad des quatre ; thèmes ci-dessus ; T09, choix
de ne fournir que deux durées sourcées, DLC ignorée au congélateur, gaspillage compté en nombre de sorties ; T17, calculs
(rythme sur 14 jours, objectif réparti uniformément, audio hors objectif en pages), périmètre V1 (ni relecture, ni séries,
ni prêt, ni import) ; T20, parti pris « aucun calendrier intégré », traitement en texte libre, un accès par foyer ; T44,
valeurs par défaut « à vérifier » (échéance CA3 au 15, acomptes 55 / 40 % au 15, dispense 1 000 €, CA12 au 2e jour ouvré
après le 1er mai, fin du régime simplifié au 01/01/2027 et ce qui le remplace), base des acomptes, seuil du trimestriel
testé sur la TVA nette des 4 derniers trimestres, garder ou non un modèle tableur ; hashtags hors jeux habituels
(LinkedIn des quatre, Instagram de T09, T17 et T20). Non vérifiés : pages DGCCRF (403) pour T09 ; pages officielles des
acomptes, de la CA12 et de la réforme 2027 pour T44 (sources secondaires) ; homonymies des livres inventés de T17 ;
impression papier réelle, Safari réel (émulation Chromium seulement) ; organismes de `prospects.md` (« à vérifier »).
La capture et la couverture de T44 montrent encore « Prochaine échéance 15/10 » sur la tuile d'une échéance en retard
(libellé corrigé depuis en « Échéance en retard »).

**Lot du 14/11/2026, neuvième (T49, T59, T18, T19)**, prêts, « Mise en vente prochaine » (démo libre, bouton « Je suis
intéressé(e) », pas de fiche Gumroad : entrées dans `communication/gumroad-a-creer.json`). Applications
`templates/competences/` (FRM, 25 €, démo `/templates/competences/?demo`, page `/catalogue/competences/`),
`templates/progression/` (PRG, 15 €, démo `/templates/progression/?demo`, page `/catalogue/progression/`),
`templates/potager/` (PTG, 13 €, démo `/templates/potager/?demo`, page `/catalogue/potager/`) et `templates/bebe/` (BBE,
13 €, démo `/templates/bebe/?demo`, page `/catalogue/bebe/`) ; fiches `fiches/<slug>.md` ; livrables dans
`communication/<slug>/` (linkedin.md, instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et gumroad.json,
cartes FR/EN, couverture.txt, integration.md, qui détaille les points ci-dessous). Préfixe `PRG` (et non `SQC`) et
`BBE`, réservés par les packs : T59 rejoint le pack Enseignant et formateur, T19 le pack Famille ; T49 et T18 ne sont
rattachés à aucun pack. Thèmes du catalogue : T49 « Organisation et réunions », T59 « Associations, formation et
événements », T18 « Organisation et études », T19 « Santé et forme ». Publications insérées le 14/11 avec la remarque
« ne publier que si la fiche Gumroad est en ligne » : LinkedIn « Programmé » LI-132 (T49, jeu. 04/03, 08:30), LI-133
(T59, sam. 06/03, 12:15), LI-134 (T18, lun. 08/03, 12:15) et LI-135 (T19, mer. 10/03, 08:30) ; Instagram « Prêt » IG-87
(T49, 05/03), IG-88 (T59, 07/03), IG-89 (T18, 09/03) et IG-90 (T19, 11/03), à relire par Quentin avant « Programmé ».
Couvertures et carrousels déposés dans Drive (IDs dans les colonnes Remarque et P des plannings).
Sources : T18, **aucune période de culture ni association intégrée** (seule source publique trouvée, DRAAF
Auvergne-Rhône-Alpes, écartée pour licence contradictoire et auteur tiers) ; T19, **aucune courbe de croissance de
référence** (OMS : CC BY-NC-SA 3.0 IGO, usage commercial soumis à autorisation ; AFPA–Inserm 2018 : aucune licence
trouvée) ; T49 et T59, bases rédigées pour QME sans source externe.
**À faire valider par Quentin** : prix, noms, permaliens et catégories Gumroad des quatre ; T19, **RGPD** (vente d'un
outil qui héberge des données de santé d'enfants, consentement explicite repris de T04, certification HDS non vérifiée,
paragraphe pour `/confidentialite/` proposé dans `communication/bebe/integration.md`, non appliqué), absence de courbes
ou demande d'autorisation, numéros d'urgence 15 et 112 dans l'avertissement, fusion des saisies de deux appareils
(dernière modification gagnante, par élément) ; T18, choix de ne fournir aucune date (promesse « vos dates »), rotation
par défaut à 1 an, familles botaniques de la base ; T49, application web au lieu du tableur seul, contenu du référentiel
et des 8 compétences critiques, seuil de couverture 2 et réévaluation à 12 mois, une clé partagée sans droits par
personne ; T59, choix de calcul (prévu posé à la suite sans répartir la réserve, séquence en cours plafonnée, retard en
séances = heures ÷ durée moyenne d'un créneau), alternance A/B qui saute les semaines sans cours, Lundi de Pentecôte sans
cours par défaut ; hashtags hors jeux du kit (les quatre). Non vérifiés : API de data.gouv.fr (T18) ; référentiel CNIL
RH (T49) ; taxonomie de Bloom sur une source primaire et article L3133-1 (T59) ; impression papier réelle, Safari et
Firefox réels (émulation Chromium seulement), ouverture des CSV dans un tableur ; organismes de `prospects.md`
(« à vérifier »).

**Lot du 14/11/2026, dixième et dernier de la série (T54, T58)**, prêts, « Mise en vente prochaine » (démo libre, bouton
« Je suis intéressé(e) », pas de fiche Gumroad : entrées dans `communication/gumroad-a-creer.json`). Applications
`templates/seminaire/` (SMN, 35 €, démo `/templates/seminaire/?demo`, page `/catalogue/seminaire/`) et `templates/quiz/`
(QZZ, 19 €, démo `/templates/quiz/?demo`, page `/catalogue/quiz/`) ; fiches `fiches/seminaire.md` et `fiches/quiz.md` ;
livrables dans `communication/<slug>/` (linkedin.md, instagram.md + carrousel `instagram/`, prospects.md, gumroad.md et
gumroad.json, cartes FR/EN, section-site.html, couverture.txt, integration.md, qui détaille les points ci-dessous).
Préfixe `SMN` nouveau ; `QZZ`, réservé, passe de `PREVUS` aux templates et rejoint le pack Enseignant et formateur (4
templates, 83 € au lieu de 104 €, −20 %, option évolutive 21 € ; argument « La banque de quiz à venir » remplacé par
« Questions, quiz et corrections dans le même pack »). **T54 n'est rattaché à aucun pack** (aucun pack événements ;
Moyens généraux ou Associations et clubs possibles, à trancher). Thème du catalogue : « Associations, formation et
événements » pour les deux. Publications insérées le 14/11 avec la remarque « ne publier que si la fiche Gumroad est en
ligne » : LinkedIn « Programmé » LI-136 (T54, ven. 12/03, 12:15) et LI-137 (T58, dim. 14/03, 12:15) ; Instagram « Prêt »
IG-91 (T54, 13/03) et IG-92 (T58, 15/03), à relire par Quentin avant « Programmé ». Couvertures et carrousels déposés
dans Drive (IDs dans les colonnes Remarque et P des plannings).
**Exigences de Quentin** : T54, régimes et allergies traités comme données sensibles (mention explicite à la saisie, en
tête des participants et dans les réglages ; saisie facultative ; liste fermée de 5 régimes, une case allergie et une
case accessibilité sans aucun détail, pas de champ libre médical ; traiteur informé en nombres ; effacement par
séminaire) ; T58, aucun contenu d'artefact repris (30 questions de démo rédigées pour QME), résultats nominatifs sous
RGPD (copies anonymes par défaut, export JSON et CSV, effacement d'un apprenant, d'une session ou de tout,
anonymisation). Démos entièrement fictives.
**À faire valider par Quentin** : prix (35 € et 19 €), noms, permaliens (`seminaire-offsite`, `banque-questions-quiz`)
et catégories Gumroad (`business-and-money`, `education`, à vérifier) ; pack de T54 ; nouvel argument du pack PNS ;
T54, « sans porc » gardé dans la liste fermée et « sans gluten » passé par la case allergie, présence sur toute la
durée, « en attente » comptés mais jamais placés, répartition par service sans critère de genre, ni accès participant
ni rétroplanning ni badges (renvoi vers T51) ; T58, QCM multiple en tout ou rien, blanc compté faux, note arrondie au
demi-point, réponses courtes « à vérifier », seuils 85 % / 35 % (5 réponses minimum, distracteur dès 15 %),
conservation de 12 mois par défaut (aucune durée légale affirmée), passation sur l'appareil du formateur ; hashtags hors
jeux habituels (`#OfficeManager`, `#AssistantDeDirection`, `#RessourcesHumaines`, `#Formation`, `#Enseignement`,
`#Pédagogie`).
Non vérifiés : définition CNIL « donnée sensible » non relue pour T54 (reprise de T51) ; textes RGPD de T58 sur une
source primaire ; impression papier réelle (vue écran en média « print ») ; Safari et Firefox réels (émulation Chromium
seulement) ; ouverture des CSV dans un tableur ; organismes de `prospects.md` (« à vérifier »).

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
| T65 | `budget-commun` | BCM | Gestion Dépenses Communes | 15 € |
| T16 | `demenagement` | DMN | demenagement (prévu) |
| T21 | `voyage` | VYG | planificateur-voyage (prévu) |
| T22 | `tableau-annuel` | RDV | tableau-annuel-roue-de-vie |
| T34 | `pilotage-pme` | TDB | tableau-de-bord-pme (prévu) |
| T39 | `references-plaquette` | KRF | kit-references-plaquette (prévu) |
| T50 | `salles` | SDR | reservation-salles (prévu) |
| T52 | `competition` | CMP | gestion-competition (prévu) |
| T61 | `maintenance` | GMA | maintenance-preventive (prévu) |
| T63 | `verifications` | VRF | verifications-reglementaires (prévu) |
| T73 | `suivi-temps` | TMP | suivi-temps-rentabilite (prévu) |
| T74 | `propositions` | PCM | propositions-commerciales (prévu) |
| T75 | `calendrier-editorial` | CED | calendrier-editorial (prévu) |
| T76 | `appels-offres` | CND | suivi-appels-offres (prévu) |
| T78 | `sous-traitants` | STR | conformite-sous-traitants (prévu) |
| T79 | `entretiens-annuels` | ENP | entretiens-annuels-professionnels (prévu) |
| T80 | `document-unique` | DRP | document-unique-evaluation-risques |
| T81 | `contrats` | CTR | contrats-fournisseurs (prévu) |
| T82 | `achats` | ACH | demandes-achat-fournitures (prévu) |
| T83 | `papiers` | DCS | papiers-du-foyer (prévu) |
| T84 | `remboursements-sante` | RBS | remboursements-sante (prévu) |
| T85 | `emprunt` | CPT | capacite-emprunt-comparateur-prets (prévu) |
| T86 | `remerciements` | CDX | cadeaux-remerciements (prévu) |
| T87 | `revue-hebdo` | RVH | revue-hebdomadaire (prévu) |
| T88 | `notes` | NTS | notes-moyennes (prévu) |
| T89 | `candidatures` | CAN | candidatures-etudes-stages-alternance (prévu) |
| T90 | `memoire` | MMR | planning-memoire (prévu) |
| T91 | `subventions` | SBV | subventions-association (prévu) |
| T92 | `benevoles` | BNV | benevoles-planning-creneaux (prévu) |
| T93 | `assemblee-generale` | AGS | assemblee-generale-association (prévu) |
| T95 | `investissement-locatif` | RNT | rentabilite-investissement-locatif |
| T54 | `seminaire` | SMN | seminaire-offsite (prévu) |
| T58 | `quiz` | QZZ | banque-questions-quiz (prévu) |

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

### T65 · Gestion Dépenses Communes

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

**Deux fonctionnements** (demande de Quentin du 20/11/2026, d'après son artefact « Gestion Dépenses Communes ») : choix au
premier lancement, modifiable dans les réglages sans rien supprimer (`reglages.fonctionnement`) :
- **Avances et remboursements** (comportement d'origine, valeur des données d'avant l'option) : chacun paie, soldes
  et équilibrage ;
- **Compte commun** : un compte joint paie les dépenses et les récurrentes (payeur `compte`, « pour » le foyer ou une
  personne). Onglet **Compte**, mois par mois : à couvrir = récurrentes communes du compte + dépenses courantes
  prévues + autres sorties (débit différé…) − solde avant les versements ; réparti selon la clé du foyer (égale,
  prorata des revenus, parts), puis chacun ajoute ses charges personnelles (non diminuées par le solde) ;
  versements notés (« C'est fait ») ; solde estimé = solde + versements − dépenses du compte. Démo :
  `?demo=compte`. Règles pures `chargesPrevues`, `alimentation`, `soldeEstime`, `verses` (`regles.js`), testées
  dans `outils/templates/budget-commun.test.mjs`.

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
| T09 | Garde-manger et congélateur : alertes de péremption | Durées de conservation par type d'aliment | — | Durées : seules deux reprises de l'Anses (plat non préemballé sans date 3 j, décongelé 3 j ; page du 04/01/2021 consultée le 14/11/2026), affichées avec la source ; aucune durée après ouverture ni au congélateur fournie (pas de tableau officiel trouvé), saisies par l'utilisateur. |
| T10 | Carnet de voiture, une à quelques voitures : fiche véhicule, relevés de kilométrage, entretiens faits et à venir (échéance à la date ou au kilométrage, la première atteinte), toutes les dépenses (carburant ou recharge, entretien, réparations, pneus, assurance, péage, stationnement, contrôle technique), consommation calculée entre deux pleins, coût au kilomètre et coût mensuel, historique imprimable pour la revente | Intervalles d'entretien types, modifiables (le carnet du constructeur prime) ; catégories de dépenses | — | Demande Quentin 13/11/2026 fusionnée (gestionnaire de voitures). **daté** : périodicité du contrôle technique, vérifiée sur une source officielle ou saisie. Prix du carburant saisis, jamais intégrés. Argent : avertissement. Version perso du moteur de T29 (sans conducteurs, réservations ni sinistres). Aucune automatisation ni lien externe. |
| T11 | Entretien de la maison : calendrier automatique | 85 tâches avec fréquence (chaudière, ramonage, filtres) | — | **daté** si une fréquence est légale (ramonage, chaudière) : source ou paramétrable. Moteur commun avec T61. |
| T12 | Remboursement de dettes : plan et date de fin | Méthodes boule de neige et avalanche | — | Argent : avertissement. |
| T13 | Objectif d'épargne et fonds d'urgence | Scénarios d'intérêts composés (taux saisi par l'utilisateur) | — | Aucun taux de livret en base (**daté**). Argent : avertissement. |
| T14 | Suivi des abonnements : coût mensuel et annuel, renouvellements | Abonnements courants (streaming, télécom, sport) sans prix figés | — | — |
| T15 | Mariage : budget, prestataires, invités et RSVP, plan de table, rétroplanning 12 mois | Rétroplanning type sur 12 mois, postes de budget | Organisateur de mariage (artefact client) | Backlog n° 28 : 29 €, M, P1 ; forte demande grand public. Événementiel pro : T51. RSVP par les invités = usage partagé à concevoir. **RGPD** (liste d'invités). |
| T16 | Déménagement : avancement, inventaire des cartons | Checklist sur 8 semaines, démarches types | — | Démarches : vérifier qu'aucune n'est datée. |
| T17 | Suivi de lecture : statistiques, objectifs | Genres, objectifs annuels, notation | — | — |
| T18 | Calendrier du potager : semis selon les cultures choisies | 60 légumes : nom latin et famille botanique (sans périodes) | — | Aucune période ni association intégrée : seule source publique trouvée (DRAAF Auvergne-Rhône-Alpes, PDF « Calendrier des semis, plantations et récoltes », consulté le 14/11/2026) écartée, licence contradictoire (pied de page etalab-2.0, mentions légales « reprise conditionnée à l'accord de l'auteur ») et auteur probablement tiers ; rien sur data.gouv.fr. Base : 60 légumes avec nom latin et famille botanique (APG IV, connaissance générale) ; fenêtres et voisins saisis par l'utilisateur. |
| T19 | Suivi du bébé : repas, sommeil, couches, courbes | Aucune courbe de référence intégrée | — | **médical** : avertissement partout, aucune norme ni alerte. Courbes : normes OMS sous CC BY-NC-SA 3.0 IGO (usage commercial soumis à autorisation, page copyright OMS consultée le 14/11/2026) ; courbes AFPA–Inserm/CRESS–CompuGroup Medical 2018 sans licence de réutilisation trouvée (communiqués AFPA et Inserm du 05/03/2018) ; mesures saisies tracées seules, sans percentile. **RGPD** : données de santé d'un enfant hébergées en ligne, consentement explicite avant tout enregistrement (repris de T04), à trancher par Quentin avant la vente. |
| T20 | Animal de compagnie : soins, poids, frais | Calendrier vaccinal et antiparasitaire chien et chat | — | **médical** (vétérinaire) : avertissement ; source à vérifier. **daté** : recommandations vaccinales révisées, source datée ou paramétrable. Fait (14/11/2026) : aucun calendrier intégré (modèles de soins = noms seuls, intervalles saisis d'après le vétérinaire), avertissement médical dans l'application, la page catalogue et la fiche Gumroad ; aucune source vétérinaire intégrée, donc rien de daté. |
| T21 | Planificateur de voyage : itinéraire par étapes, lieu de chaque nuit (hébergement, adresse, arrivée/départ, statut réservé ou à réserver, montant et acompte), activités par jour avec horaire et prix, transports entre étapes, vue jour par jour et carte texte des étapes, budget prévu/réel par poste et par personne, dépenses partagées et « qui doit quoi », listes de bagages, documents à prévoir (cases à cocher) | Listes de bagages par type de séjour ; postes de budget | — | Demande Quentin 13/11/2026 fusionnée (planificateur de voyage). Dépenses partagées : moteur commun avec T65. Aucune réservation ni lien vers une plateforme : saisie et impression uniquement. Formalités (passeport, visa, santé) : renvoi à vérifier sur les sources officielles, rien d'intégré. Argent : avertissement. |
| T22 | Tableau de bord annuel : roue de vie, objectifs par domaine, actions trimestrielles, score, bilan | Domaines de vie, méthode OKR | Constellations de vie, roue d'action, objectifs et tâches (outil interne) | Backlog n° 50 : 15 €, S, P3. |
| T23 | Suivi de chantier par lot : jalons contractuels, avenants, échéancier de paiement, non-conformités, journal de chantier, intempéries, sous-traitants, risques, courriers et ordres de service, synthèse financière | Découpage type en lots, jalons et pièces contractuelles types, typologie des non-conformités et des risques, modèle de revue de projet | Suivi de projet (artefact professionnel) | **confidentiel** : structure seulement, aucune donnée de l'artefact ; exemples fictifs. Avec T24 et T25, le plus différenciant (expérience de chef de projet de Quentin). Proche de T32 (levée de réserves) : **produit séparé** (tranché le 14/11/2026, voir « Fiche T23 » en fin de fichier). **RGPD** (intervenants, sous-traitants). |
| T24 | Circuit de visa : registre des documents soumis par lot, indices de révision, avis (sans observation, avec observations, refusé), délais contractuels, relances, vue chef de projet, tableau de bord | Types de documents par lot, codes de visa (VSO, VAO, REF), lots BTP types, délais de réponse paramétrables | Circuit de visa, registre et fiche visa (artefacts professionnels) | Backlog n° 05 fusionné (même produit). Format : application + modèle tableur. Niche solvable ; vocabulaire métier à respecter. **confidentiel** : structure seulement ; exemples fictifs. Moteur d'échéances commun avec T63. |
| T25 | Registre des non-conformités : constat, gravité, cause, action corrective, vérification, clôture, indicateurs | Typologie des écarts, méthode des 5 pourquoi, grille de gravité | Non-conformités de fabrication et de réalisation (artefact professionnel) | **confidentiel** : structure seulement ; exemples fictifs. Produit d'appel de T23 ; même moteur que T32 (réserves). |
| T26 | Notes de frais : saisie, justificatifs, statut de remboursement, barème kilométrique, récapitulatif et export mensuels (PDF) | Catégories de frais ; barème kilométrique saisi par l'utilisateur | Notes de frais (outil interne), Ma voiture en leasing | Backlog n° 19 fusionné. **daté** : barème kilométrique fiscal, saisi par l'utilisateur ou mis à jour chaque année avec source ; **fiscal**. Justificatifs : stockage de fichiers à prévoir. |
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
| T44 | TVA collectée et déductible, échéancier, contrôle de cohérence | Échéances par régime (paramétrables) | — | **daté** (taux, échéances) ; **fiscal** : outil d'aide, pas de conseil. Backlog : tableur seul. Fait (14/11/2026) : application web avec export et import CSV ; taux et échéances en Réglages avec source, statut « vérifié / à vérifier » et date de vérification ; avertissement fiscal dans l'application, la page catalogue et la fiche Gumroad. |
| T45 | Inventaire, affectations, licences, fin de garantie, historique, alertes | Catégories de matériel et types de licences | Poste central | Demandé explicitement. Format : application + modèle tableur. **RGPD** (affectations nominatives). Pack possible avec T46. **confidentiel à vérifier** (artefact « Poste central »). |
| T46 | Checklists par rôle, responsables, échéances de J-15 à J+90, restitution du matériel | Checklists d'arrivée et de départ par rôle | Poste central | **RGPD** (salariés). Couplé à T45. |
| T47 | Affectation par personne et projet en heures par semaine, taux de charge (temps partiel, absences, fériés déduits), conflits, postes à couvrir, vues semaine et mois, disponibles la semaine prochaine | 6 modèles d'équipe (rôles, compétences, postes) ; repères de durée L3121-27, L3121-20, L3121-22 datés et paramétrables | Équipes et staffing (outil interne) : mécanique seulement | Fiche détaillée : `fiches/planning-equipe.md`. Une clé partagée par les managers, saisies simultanées fusionnées (pas de comptes séparés en V1). **RGPD** : aucune donnée de santé, export, effacement, suppression. **confidentiel** : aucune équipe ni personne de l'outil interne reprise, démo fictive. **daté** : repères de durée relevés le 14/11/2026. |
| T48 | Soldes, demandes, calendrier d'équipe, chevauchements | Règles d'acquisition paramétrables | — | **daté** (règles légales et conventionnelles) : paramétrable. **RGPD**. Backlog : tableur seul. |
| T49 | Matrice personnes × compétences, niveaux, écarts, plan de formation | Référentiel générique de 44 compétences en 8 domaines (8 critiques) et 9 modèles de postes, rédigé pour QME sans source externe | — | Backlog : tableur seul (fait en application web ; modèle tableur non fait, à trancher). **RGPD** : données minimales (prénom et initiale, poste, équipe, niveaux), aucune donnée sensible, « une évaluation n'est jamais une sanction », effacement de la fiche au départ, rappel CNIL général à vérifier. Pas un outil de conformité. Aucune donnée datée. |
| T50 | Ressources, créneaux, conflits, vue jour | Types de ressources, équipements de salle, jours fériés calculés | Planner horaire | Usage à plusieurs tranché le 14/11/2026 : une clé partagée par l'équipe, nom saisi à chaque réservation, pas de comptes en V1, conflits refusés (y compris entre deux appareils). Fiche en fin de document. **RGPD** (noms des personnes qui réservent). |
| T51 | Rétroplanning, budget prévu/engagé/payé, prestataires et contrats, invités, checklist jour J | Rétroplanning type, postes de budget, checklist jour J | Organisateur de mariage, gestion de compétition, suivi budget (artefacts) | Demandé explicitement ; produit phare du backlog. Format : application + modèle tableur. Même moteur que T15 et T54. **RGPD** (invités). |
| T52 | Inscriptions, catégories, heats, saisie des scores, classement, affichage | Règles de classement paramétrables, catégories types | Gestion de compétition et feuille de route (artefacts client) | Affichage public = partage en lecture seule à concevoir. **RGPD** (participants). |
| T53 | Fiches adhérents, activités, quotient familial, paiements, listes d'appel | Activités types, tranches de quotient familial paramétrables | Inscriptions d'un centre social (artefact client) | **daté** : tranches de quotient familial, paramétrables. **RGPD** (adhérents, mineurs possibles) : obligations dans le guide. Format : application + modèle tableur. **confidentiel** : aucune donnée de l'artefact. |
| T54 | Participants, transports, chambres, régimes, programme, budget | 2 programmes types (journée, deux jours avec nuitée), 12 postes de budget sans montant, 5 types de chambre, 7 types de session, régimes en liste fermée (5), rédigés pour QME ; aucun horaire ni tarif | Organisateur de mariage (artefact client) ; moteur du pilote événementiel | Déclinaison de T51. **RGPD** : régime en liste fermée, allergie et accessibilité par une case sans détail, saisie facultative, traiteur informé en nombres seulement, effacement par séminaire ; démo fictive. |
| T55 | Élèves, évaluations, compétences, moyennes, appréciations, bulletins | à définir | — | **RGPD** (élèves, mineurs). Caduque : « stockage local uniquement » ; les données sont désormais en ligne, à trancher avant développement. Concurrence des logiciels de vie scolaire. |
| T56 | Classes, formateurs, salles, créneaux, détection des conflits, vues par ressource | à définir | Grille de planning, planner horaire (outil interne) | Pas d'optimisation automatique en V1. **RGPD** (formateurs, apprenants). |
| T57 | Véhicules, kilométrage, entretiens, contrôles techniques, moniteurs, planning de leçons, coût par heure | Intervalles d'entretien types | Ma voiture en leasing | Demandé explicitement. Base commune avec T29. **daté** (contrôle technique). **RGPD** (élèves, moniteurs). Format : application + modèle tableur. |
| T58 | Banque de questions taguée, génération de quiz, correction, statistiques | aucune question fournie ; types, difficultés, format de collage et conseils rédigés pour QME | Banque de questions d'élèves (artefact client) | Contenu de l'artefact non repris (mécanique générique seulement, démo de 30 questions génériques rédigées pour QME). **RGPD** : copies anonymes par défaut ou pseudonymes, mention au premier lancement, export JSON et CSV, effacement d'un apprenant, d'une session ou de tout, anonymisation, rappel de conservation. |
| T59 | Séquences, séances, objectifs, avancement réel et prévu | 5 modèles de structure génériques, déroulé type de séquence, 73 verbes d'objectifs selon la taxonomie de Bloom révisée (rédigés pour QME), fériés calculés ; aucun programme officiel ni calendrier de vacances | Jalons à plage | **confidentiel** : artefact professionnel ; mécanique seulement (fenêtres de fin des séquences) ; démo fictive ; aucune donnée d'élève. |
| T60 | Sites, équipements, interventions, indicateurs, carte ou liste, alertes | à définir | Pilotage de parcs (artefact professionnel) | **confidentiel** : aucune donnée, nom de site ni chiffre ; exemples fictifs (immobilier, équipements). Format : application + modèle tableur. |
| T61 | Équipements, plans de maintenance, échéances, bons d'intervention, historique | Plans de maintenance types | Artefacts professionnels de maintenance | **confidentiel** : mécanique seulement, aucune donnée ; exemples fictifs. **daté** si des périodicités réglementaires sont en base. Moteur commun avec T11 et T63. |
| T62 | Articles, entrées et sorties, seuils d'alerte, valorisation, inventaire | à définir | — | Backlog : tableur seul. |
| T63 | Registre des contrôles, périodicités, échéances, preuves, alertes | Types de contrôles (électricité, extincteurs…) sans périodicité légale non sourcée | Registre des visas | **daté** : périodicités réglementaires, paramétrables ou sourcées. Preuves : stockage de fichiers à prévoir. Format : application + modèle tableur. Décision (14/11/2026) : application seule, base sourcée INRS ED 828 datée, preuves en référence et lien (pas de fichiers). |
| T64 | Calendrier, réservations, ménage, taxe de séjour, revenus par plateforme | à définir | Location saisonnière (artefact client) | **daté** : taxe de séjour, paramétrable ; **fiscal**. **RGPD** (voyageurs). Backlog : tableur seul. Aucune donnée de l'artefact. |
| T65 | Dépenses communes, répartition au prorata des revenus, soldes, équilibrage | Méthodes de répartition (égale, prorata, personnalisée) | Gestion Dépenses Communes, Gestion Dépenses Communes partagé | Usage à deux : désormais possible (mêmes données), accès par deux personnes à concevoir. Argent : avertissement. |
| T66 | LOA, LLD, crédit, comptant : coût total, valeur résiduelle, kilométrage | à définir | Ma voiture en leasing | Produit d'appel. Argent : avertissement. **fiscal** pour les indépendants (déductibilité, TVA) : hors calcul ou signalé. |
| T67 | Comparateur de devis d'artisans, budget, planning, réserves de fin de travaux | Postes de travaux types, modèles de planning de rénovation (T02) | Devis artisan, Levée réserves, Chemin critique | Réutilise T32, T36 et T02. **confidentiel** : « Chemin critique » = mécanique seulement. |
| T73 | Saisie du temps par mission et par tâche (chronomètre ou saisie), temps facturable ou non, taux horaire réel, comparaison au TJM et au devis, alerte de dépassement | Catégories de tâches types, seuils d'alerte | — | Argent : avertissement. Complète T37 et T40. |
| T74 | Proposition structurée : contexte, objectifs, livrables, options à prix, planning, conditions ; export PDF ; suivi envoyée/acceptée | Trames par métier (conseil, développement, formation, travaux) | — | Distinct de T36 (devis chiffré). Mentions légales : renvoi à T36. |
| T75 | Sujets, formats, piliers éditoriaux, calendrier, régularité, statistiques saisies à la main | Banque d'idées de sujets par métier, formats types | — | Aucune marque dans le nom ; aucune automatisation d'un réseau social ; statistiques saisies. |
| T76 | Registre des consultations et candidatures (date limite, pièces, statut, résultat), taux de réussite, relances | Checklists de pièces types (sans référence réglementaire datée) | — | Pièces des marchés publics : paramétrables, pas de liste réglementaire non sourcée. |
| T77 | Liste des pièces DOE par lot (plans, notices, PV, fiches techniques), statut, relances, complétude par entreprise, bordereau imprimable | Pièces types par lot BTP | — | **confidentiel** : structure seulement. Lien avec T23 et T32. Fiche `fiches/doe.md` (cadrage délégué par Quentin, 14/11/2026). Prêt le 14/11/2026, mise en vente prochaine : application `templates/doe/` (RDE), page `catalogue/doe/`, communication `communication/doe/` (section-site, carte EN « Coming soon » non appliquée, fiche Gumroad `gumroad.json` / `gumroad.md`, LinkedIn, Instagram avec carrousel 5 vues, prospects). Seule référence : article 40 du CCAG Travaux 2021 en paraphrase (consulté le 14/11/2026, à revérifier sur Légifrance). Publications LinkedIn et Instagram non planifiées. |
| T78 | Sous-traitants par lot, agrément, pièces de vigilance avec date de validité, alertes d'expiration | Types de pièces de vigilance | — | **daté** : périodicité des attestations à sourcer (service-public / Urssaf) ou paramétrable. **RGPD**. |
| T79 | Calendrier des entretiens annuels et professionnels par salarié, trames, objectifs, suivi des formations demandées | Trames d'entretien, questions types | — | **daté** : périodicité de l'entretien professionnel à sourcer (Légifrance) ou paramétrable. **RGPD**. Lien avec T49. |
| T80 | Unités de travail, risques, cotation (gravité × probabilité), actions de prévention, mise à jour, export | Familles de risques types par secteur | — | **daté**/réglementaire : obligations à sourcer (INRS, Légifrance) ; ne remplace pas un préventeur. **confidentiel** : exemples fictifs. |
| T81 | Contrats (assurances, maintenance, télécoms, leasing), échéance, préavis de résiliation calculé, tacite reconduction, coût annuel | Catégories de contrats, préavis types paramétrables | — | Règles de résiliation : paramétrables, aucune règle légale non sourcée. Moteur d'échéances commun avec T63. |
| T82 | Demandes d'achat, validation, commandes, réception, budget par service | Catalogue de fournitures types sans prix | — | Usage à plusieurs (demandeur / valideur) à concevoir. |
| T83 | Inventaire des documents du foyer (où ils sont rangés), durée de conservation, rappels de renouvellement (passeport, assurances) | Types de documents et durées de conservation | — | **daté** : durées à sourcer (service-public.gouv.fr, date de vérification) ou paramétrables. Pas de stockage de pièces d'identité en V1. |
| T84 | Soins, montant payé, remboursé Sécurité sociale et mutuelle, reste à charge, relances des remboursements en attente | Types de soins | — | **médical** : données de santé, hébergement à trancher (comme T04). Aucun taux de remboursement intégré (saisis). |
| T85 | Capacité d'emprunt (revenus, charges, taux d'endettement saisi), comparaison d'offres de prêt (taux, assurance, frais), tableau d'amortissement | Méthode de calcul d'amortissement | — | Taux et seuils saisis par l'utilisateur (**daté** sinon). Argent : avertissement. |
| T86 | Cadeaux reçus (de qui, quoi), carte de remerciement envoyée, adresses | — | — | **RGPD** (adresses de tiers). Complète T15. |
| T87 | Revue hebdomadaire guidée (bilan, priorités, prochaine semaine), journal court, historique | Questions de revue types | — | Complète T03, T30, T08. |
| T88 | Matières, coefficients, notes, moyennes pondérées, crédits ECTS, note nécessaire pour atteindre un objectif | Systèmes de notation (sur 20, ECTS) paramétrables | — | Pas de barème officiel d'examen intégré. |
| T89 | Vœux et candidatures (formation, établissement, pièces, dates saisies, statut, réponse) | Checklists de pièces types | — | **daté** : calendriers officiels non intégrés (saisis). Aucune marque de plateforme dans le nom. |
| T90 | Plan du mémoire, jalons, chapitres, rendez-vous avec le directeur, bibliographie simple, compte de mots | Jalons types (mémoire de master, thèse) | — | — |
| T91 | Dossiers de subvention (financeur, montant, dates saisies, pièces, statut), justificatifs, bilan d'utilisation | Pièces types d'un dossier | — | Aucun calendrier de financeur intégré (**daté**). |
| T92 | Bénévoles (disponibilités, compétences), créneaux d'un événement, affectation, conflits, liste imprimable | Postes types (accueil, buvette, montage) | — | **RGPD** (bénévoles). Lien avec T51 et T52. |
| T93 | Calendrier de l'AG, convocations, ordre du jour, quorum calculé (règle saisie), PV, mandats du bureau | Trames de convocation et de PV | — | Règles de quorum : celles des statuts, saisies. **RGPD**. |
| T94 | Pièces, éléments, état (entrée / sortie), photos, comparaison, relevés de compteurs, document imprimable | Pièces et éléments types | — | Stockage des photos à prévoir (comme T32). Outil d'aide, pas un document juridique certifié. |
| T95 | Prix d'achat, frais, travaux, loyers, charges, crédit (saisi), rendement brut et net, cash-flow | Postes types | — | Fiscalité hors calcul (signalé). Argent : avertissement. |
| T96 | Appels de fonds, charges par poste, AG (résolutions, votes), travaux votés | Postes de charges types | — | Pas de règle de majorité intégrée (saisie). |
| T97 | Objectif (10 km à marathon), allures calculées depuis un chrono de référence, plan par semaines, séances cochées | Plans types par distance | — | Sport : avertissement (pas un programme médical). Allures : formules à sourcer. |
| T68 | L'organisateur (clé `SNT`) crée plusieurs échanges ; les participants s'inscrivent sans compte par un lien (prénom, e-mail, code personnel, idées) ; exclusions ; tirage par le serveur, jamais montré à l'organisateur ; chacun découvre son tirage sur sa page | Modèles famille / amis / collègues (message et budget suggérés) | — | **Mode « ordinateur commun » ajouté le 13/11 (demande de Quentin, Secret Santa en box)** : l'organisateur saisit les prénoms, chacun choisit un code de 4 à 8 chiffres sur un ordinateur partagé (borne `?borne=`), puis y découvre son tirage ; 5 codes faux bloquent le prénom (déblocage ou remise à zéro par l'organisateur), résultat effacé de l'écran après 20 s. Décisions de Quentin (13/11/2026) : **aucun e-mail** (lien personnel ou reconnexion e-mail + code), **gratuit** (prix libre), exclusions, listes d'idées, budget et date, plusieurs échanges ; charte de base + couche Noël. API dédiée `/api/secret-santa/*` (moteur partagé avec la démo : `templates/secret-santa/moteur.js`, store Blobs `secret-santa` à Francfort). **RGPD** (données de tiers) : code personnel haché (scrypt), effacement automatique 60 jours après la date (180 sans date). Tests : `outils/templates/secret-santa.test.mjs`. LinkedIn : LI-99 le 01/12/2026 12:15 ; Instagram : IG-36 (Reel) le 01/12 18:30 ; média = vidéo de motion design de Noël uniquement (`assets/secret-santa-noel.mp4`, 46 s, musique « Christmas is coming » d'Alex-Productions, libre de droits (confirmé par Quentin le 13/11), crédit conservé ; texte et vidéo validés par Quentin le 13/11 ; sources `docs/templates/communication/secret-santa/video/`). Gumroad : fiche à créer en priorité le 14/11 au soir (prix libre, 0 € possible), puis publication dès que la clé de licence est active (vérification `is_licensed`). |


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

## Fiche T21 (cadrage délégué par Quentin, 14/11/2026)

### T21 · Planificateur de voyage (`templates/voyage/`, préfixe VYG, 13 €)

Fiche rédigée et appliquée sans validation intermédiaire (décisions de cadrage déléguées par Quentin).

- **Promesse** : « Le voyage tient dans ta poche. » L'itinéraire par étapes, le toit de chaque nuit, les
  activités jour par jour, le budget prévu puis réel et, au retour, qui doit quoi à qui.
- **Pour qui** : voyageurs, familles et groupes d'amis (usage `perso`, catalogue « Vie personnelle » ·
  thème « Projets de vie ») ; un voyage à la fois, plusieurs voyageurs sur la même clé (1 à 20). Packs visés :
  « Voyage » (PVY, avec Gestion Dépenses Communes) et « Mariage et installation à deux » (PMR, lune de miel).
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
## T71 · Dossier sinistre habitation (fiche, 13/11/2026)

Source : cahier des charges complet de Quentin (13/11/2026), conservé dans la conversation de développement.
Nom de travail « SinistreFacile » ; nom du produit à confirmer (nom descriptif, règle « aucune marque interne »).
Préfixe proposé `SNH`, slug `sinistre`. Prix 29 € (Quentin). Achat unique.

- **Public** : particulier qui doit constituer, documenter et suivre son dossier de sinistre habitation.
- **Écrans** : tableau de bord (type, date, lieu, statut, assureur et numéros saisis à la main, échéances,
  justificatifs, estimation, progression) ; assistant de création adapté aux réponses (type, dates de
  survenance et de découverte, pièce, biens, tiers, déclaration déjà faite) ; inventaire des dommages ;
  calculateur ; preuves ; chronologie ; rapport imprimable (garde, résumé, chronologie, inventaire, synthèse
  financière, justificatifs, observations) ; exports CSV et JSON. Plusieurs sinistres par acheteur.
- **Base intégrée** : classification des sinistres et des dommages, bibliothèque de biens courants par
  catégorie (mobilier, électroménager, informatique, électronique, vêtements, décoration, revêtements,
  menuiseries, équipements techniques), justificatifs utiles par type de sinistre, mesures conservatoires,
  modèles de courriers à copier ou imprimer, étapes de suivi.
- **Calculs** : prix d'achat, valeur actuelle, réparation, remplacement, vétusté **entièrement paramétrable**
  (aucun barème imposé), montant estimé ; montants déclarés, estimés et reconnus par l'assureur séparés.
- **Sources** : délais indicatifs issus de sources officielles (Code des assurances sur Légifrance,
  Service-Public.fr), avec lien et date de vérification ; jamais présentés comme règle universelle (le
  contrat prime). **daté**.
- **Risques** : **juridique** (ni conseil, ni expertise, ni garantie d'indemnisation : affiché) ;
  photos et documents : le stockage commun n'enregistre que du JSON (900 Ko par acheteur), comme T32 et
  T67 → **décision de Quentin (13/11/2026) : photos et PDF gardés sur l'appareil** (IndexedDB, compressés,
  non synchronisés, copie JSON avec photos possible) ; **RGPD** (minimiser : pas de coordonnées bancaires).

**État au 13/11/2026 : prêt** (branche `claude/fervent-bell-4m5jqu`). Préfixe `SNH`, slug `sinistre`,
application `templates/sinistre/`, page `catalogue/sinistre/` en « Mise en vente prochaine », carte du kanban
(colonne « Projets de vie », à déplacer si Quentin préfère), carte anglaise, portail de connexion, README.
Sources juridiques vérifiées le 13/11/2026 sur Légifrance et Service-Public (L113-2, L114-1, L114-2,
L122-7, L125-2 en vigueur depuis le 28/05/2026, A125-6, fiches F1352, F2027, F2028, F1523, F3075, F3050) ;
la fiche Service-Public F3076 donne encore l'ancien délai de 3 mois pour l'indemnisation des catastrophes
naturelles : le texte de loi est retenu. Prescription de 5 ans limitée à la sécheresse. Aucun taux de
vétusté par défaut. Tests : `outils/templates/sinistre.test.mjs` (14 tests) ; Playwright ordinateur et
iPhone 13 / Pixel 7 (connexion, assistant, saisie, photo, impression, CSV, JSON, synchronisation, conflit
409, hors ligne, rechargement, démo, écran d'accueil). **Décisions de Quentin (13/11/2026)** : pas de nom de marque (nom descriptif « Dossier sinistre
habitation »), prix 29 €. **Communication** (`communication/sinistre/`) : `gumroad.md`, `linkedin.md`,
`instagram.md`, `prospects.md` ; couverture `assets/templates-sinistre-couverture.png`. LinkedIn : **LI-111**
le 19/01/2027 à 12:15 (« Programmé », remarque : ne publier que si la fiche Gumroad est en ligne), doc
`1FM9e8fvQUtfrPGWwAIBeZJ5NJ0Gb1GRYigOTXAQnv8w`. Instagram : **IG-66** le 20/01/2027 à 18:30, carrousel
5 vues, statut « Prêt » (à relire par Quentin avant « Programmé »), légende
`1DTFrckLTRV8DKIqm6Xuk-r2rI-mQk67flouapQqFk2I`. Gumroad : **brouillon créé** (`nSUWbSsPnceWsczHeshUnw==`, `/l/dossier-sinistre`, 29 €, non publié).
**Reste à faire** : activation
de la clé de licence par Quentin, couverture Gumroad après déploiement, publication de la fiche après
fusion, revue annuelle des délais.

## T72 · Assistant administratif après décès (fiche, 13/11/2026)

Source : cahier des charges complet de Quentin (13/11/2026). Nom de travail « AprèsVous » ; nom du produit à
confirmer. Préfixe proposé `DCS`, slug `apres-deces`. Prix 39 € (Quentin). Achat unique, un seul utilisateur
(pas de partage familial).

- **Public** : proche d'une personne décédée, en forte charge administrative.
- **Écrans** : assistant de situation (lien avec le défunt, retraité ou en activité, salarié / indépendant /
  fonctionnaire, propriétaire ou locataire, véhicule, assurances, enfants mineurs, notaire ; aucune question
  obligatoire si elle n'est pas indispensable) ; tableau de bord (urgent, à faire, en attente, documents
  manquants, organismes contactés, échéances, terminé) ; fiches démarches (explication, date cible
  facultative, pièces, statut, historique, notes) ; documents (suivi par case, téléversement non exigé) ;
  inventaire successoral indicatif (montants confirmés ou estimés, **aucun calcul de droits ni répartition**) ;
  modèles de courriers à copier ou imprimer ; impression.
- **Base intégrée** : démarches classées obligatoires / conditionnelles / facultatives ; organismes (mairie,
  banque, assurances, assurance-vie, employeur, retraite, assurance maladie, mutuelle, CAF, prévoyance,
  énergie, bailleur ou syndic, impôts, notaire) avec pourquoi, quand, informations et pièces demandées,
  source officielle, date de vérification, niveau de fiabilité.
- **Moteur de règles** : chaque démarche affichée dit pourquoi ; aucune démarche obligatoire masquée sur une
  hypothèse ; délais avec source, point de départ et conditions. Espace interne des informations à
  réactualiser.
- **Sources** : Service-Public.fr, Notaires de France, impots.gouv.fr, Assurance retraite, Assurance
  maladie, CAF, ministères. **daté**, revue annuelle obligatoire.
- **Risques** : **juridique** et **fiscal** (ne remplace ni notaire, ni avocat, ni conseiller fiscal) ;
  **RGPD** (données du défunt et de l'entourage, minimisation) ; sujet sensible pour la communication.

## Fiche T50 (cadrage délégué par Quentin, 14/11/2026)

### T50 · Réservation de salles et bureaux (`templates/salles/`, préfixe SDR, 19 €)
- Promesse : « Qui a la salle, quand elle se libère, et aucune double réservation. » Catalogue `pro`, thème
  « Équipements et véhicules » ; pack visé « Moyens généraux » (PMG). Permalien prévu `reservation-salles`.
- Public : PME en flex office (office manager, services généraux, dirigeant), petits espaces de coworking,
  associations qui prêtent leurs salles. Une dizaine à quelques dizaines de ressources (40 au plus en V1).
- **Usage à plusieurs (décision de cadrage)** : une seule clé de licence, partagée par l'équipe (même lien,
  mêmes données sur tous les appareils). **Pas de comptes ni de droits en V1** : chacun saisit son nom à la
  réservation (mémorisé sur son appareil seulement, pour pré-remplir et filtrer « Mes réservations »). Toute
  personne qui a la clé peut modifier ou supprimer une réservation : l'outil le dit, et garde l'auteur et la date
  de création. Évolution possible : un code « lecture et réservation » distinct du code « administration ».
- **Conflits refusés** : deux réservations de la même ressource ne peuvent pas se chevaucher (créneaux
  bout à bout autorisés). Contrôle à la saisie, puis **à nouveau au moment de l'enregistrement en ligne** : si un
  autre appareil a écrit entre-temps (conflit 409), les réservations locales en attente sont rejouées sur la
  version du serveur ; celles qui chevauchent une réservation arrivée entre-temps sont refusées et signalées
  (fonction pure `rejouer`, testée). Réservations dans une même journée (pas de nuit) en V1.
- Ressources : salles (capacité, équipements cochés dans une liste intégrée : écran, vidéoprojecteur,
  visioconférence, tableau blanc, paperboard, accès de plain-pied…), bureaux en flex (zone ou étage),
  équipements prêtables (vidéoprojecteur portable, kit de visioconférence…). **Pas de véhicules** (template
  T29 Gestion de flotte). Couleur fixe par ressource dans l'ordre de `BASE.couleurs`. Ressource archivable.
- Réservation : ressource, date, début et fin au pas choisi (15, 30 ou 60 min), objet, nom saisi, nombre de
  personnes (refusé au-delà de la capacité), note ; **récurrence simple « chaque semaine » jusqu'à une date
  (52 occurrences au plus)** : les dates en conflit sont listées avant validation et ne sont pas créées ;
  modifier ou supprimer « cette date » ou « cette date et les suivantes ». « Libérer maintenant » raccourcit une
  réservation en cours.
- Écrans : **Maintenant** (« libre maintenant » : chaque ressource libre ou occupée, jusqu'à quand, prochaine
  réservation, réservation rapide 30 ou 60 min, filtre par type, rafraîchi chaque minute, bon pour une tablette à
  l'entrée) ; **Jour** (grille ressources × heures, toucher une case vide pour réserver) ; **Semaine** (une
  ressource, 7 jours × heures) ; **Réservations** (à venir, mes réservations, passées, recherche, export CSV) ;
  **Occupation** (taux par ressource et par jour de la semaine sur 1, 4 ou 12 semaines : minutes réservées sur
  minutes d'ouverture, jours fermés et fériés exclus ; carte des heures les plus demandées).
- Réglages : horaires d'ouverture, jours ouverts, pas, durée maximale et délai de réservation à l'avance
  (facultatifs), jours fériés fermés (option Alsace-Moselle), ressources, export et import JSON, effacement des
  noms des réservations passées depuis N mois (les créneaux restent pour les taux d'occupation).
- Donnée datée : **jours fériés calculés** (fêtes fixes et mobiles depuis la date de Pâques), liste du Code du
  travail (art. L3133-1) relevée sur service-public.gouv.fr, fiche F2405 « Jours fériés et ponts dans le secteur
  privé » (vérifiée le 01/01/2026 par la DILA, consultée le 14/11/2026) ; Alsace-Moselle : Vendredi saint et
  26 décembre en option. Aucun autre barème.
- Marques : **RGPD** (noms des personnes qui réservent : minimum utile, prénom ou initiales, effacement).
  Aucune automatisation : pas d'agenda externe, pas d'e-mail, pas de badge ni de capteur.
- Confidentialité : démo fictive (« Atelier Exemple »), aucune donnée ni capture d'un espace réel.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/salles/?demo`, bouton
  « Je suis intéressé(e) », carte `carte prochaine` du catalogue, thème « Équipements et véhicules » ; pas de carte
  anglaise : version anglaise en attente). Page `catalogue/salles/`, captures `assets/templates-salles-*.webp`,
  couverture `assets/templates-salles-couverture.png`, tests `outils/templates/salles.test.mjs` (règles, jours
  fériés, série, libre maintenant, occupation, rejeu des réservations en cas de conflit entre appareils).
- Communication prête dans `communication/salles/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, carte d'accueil FR). **Pas de fiche Gumroad, pas de ligne aux
  plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer (dont la question
  d'une clé partagée par toute l'équipe au prix d'un template individuel), fiche Gumroad (permalien prévu
  `reservation-salles`) et clé de licence (Quentin), entrée dans `communication/gumroad-a-creer.json`, ajout de
  SDR au pack « Moyens généraux » (`netlify/lib/packs.mjs`, pages générées), cartes anglaises, plannings,
  passage en vente du site.

## Fiche T73 (cadrage délégué par Quentin, 14/11/2026)

### T73 · Suivi du temps passé et rentabilité par mission (`templates/suivi-temps/`, préfixe TMP)
- Fiche détaillée : [`fiches/suivi-temps.md`](fiches/suivi-temps.md). Application web, 19 €, permalien prévu
  `suivi-temps-rentabilite`, catalogue `pro` · thème « Indépendants ». Pack visé : « Freelance : chiffrer,
  facturer, encaisser » (PFG), où il était prévu (ancien numéro T71, renuméroté T73 le 14/11/2026 :
  T71 et T72 sont pris sur `main`).
- Promesse : « Combien tu gagnes vraiment de l'heure, mission par mission. »
- Base intégrée : 17 catégories de tâches (7 facturables, 10 non facturables : prospection, devis,
  administratif, facturation, comptabilité, formation, veille…), 7 modèles de missions avec leurs tâches
  types, 4 semaines types, seuils d'alerte par défaut. **Aucun taux, barème ni tarif de marché** : TJM cible,
  heures par jour et coût de revient horaire sont saisis (cohérents avec T40 et T37).
- Écrans : Aujourd'hui (chronomètre synchronisé, saisie en une ligne « 1h30 », journée face à la semaine
  type), Semaine (feuille de temps 7 jours, prévu / réalisé, part facturable), Missions (forfait ou régie,
  budget en jours ou heures, avancement, consommation, projection à terminaison, alertes, temps par tâche),
  Rentabilité (taux horaire effectif = montant facturé ÷ temps réel, TJM équivalent, comparaison au TJM
  cible, au taux du devis et au coût de revient, temps non facturable par catégorie, 8 dernières semaines),
  Rapport client imprimable et exports CSV.
- Marques : argent (avertissement « outil de gestion, pas un logiciel de facturation ni un conseil »),
  montants hors taxes. Confidentiel vérifié : démo fictive, aucune donnée réelle.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/suivi-temps/?demo`,
  bouton « Je suis intéressé(e) », carte `carte prochaine` du catalogue, thème « Indépendants »). Page
  `catalogue/suivi-temps/`, captures `assets/templates-suivi-temps-*.webp`, couverture
  `assets/templates-suivi-temps-couverture.png`, tests `outils/templates/suivi-temps.test.mjs`. Produit `TMP`
  déclaré (serveur, connexion, en-têtes Netlify) ; `TMP` passé de `PREVUS` à `TEMPLATES` dans
  `outils/packs/donnees.mjs` (et retiré des `prevus` de la page du pack PFG).
- Communication prête dans `communication/suivi-temps/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html en version « en vente », couverture.txt).
  **Pas de fiche Gumroad, pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent :
  nom et prix à confirmer, fiche Gumroad (permalien prévu `suivi-temps-rentabilite`) et clé de licence
  (Quentin), entrée dans `communication/gumroad-a-creer.json`, ajout de `TMP` aux `produits` du pack PFG
  (`netlify/lib/packs.mjs`) et régénération des pages de packs, carte anglaise (`en/`, en attente),
  plannings, passage en vente du site.

## Fiche T74 (cadrage délégué par Quentin, 14/11/2026)

### T74 · Propositions commerciales (`templates/propositions/`, préfixe PCM, 19 €)

Cadrage délégué par Quentin (14/11/2026) : fiche rédigée et appliquée sans validation intermédiaire. Pack visé :
« Freelance : trouver ses clients » (PFC).

- **Promesse** : « Une proposition claire, trois options, une réponse. » Rédiger en une heure une proposition
  commerciale structurée, la présenter proprement en PDF, puis suivre la réponse jusqu'à la signature.
- **Pour qui** : freelances, consultants, formateurs, développeurs, petites agences et artisans qui répondent à une
  demande par une proposition (avant le devis détaillé). Catalogue `pro`, thème « Commercial » (ou voisin).
- **Distinct de T36** (générateur de devis) : la proposition explique le projet, la méthode, les options et le
  calendrier ; le devis chiffre ligne à ligne avec TVA et mentions légales. La proposition affiche des prix **hors
  taxes** et renvoie le détail chiffré, la TVA et les mentions obligatoires au devis (T36). Aucune règle légale
  intégrée.
- **Écrans** :
  - **Propositions** : tuiles (en attente, à relancer, taux de transformation 12 mois, signé sur 12 mois), filtres
    par statut, recherche, duplication en un clic ;
  - **Édition** : en-tête (client, interlocuteur, titre, trame, date, validité, début prévu), contexte (questions
    d'aide par trame), objectifs, livrables, blocs de la bibliothèque insérés (copies modifiables), **options
    comparées** (bon / mieux / premium : prix HT, contenu, délai, option recommandée, tableau de comparaison
    calculé), **planning** par étapes en semaines (étapes parallèles possibles, dates calculées depuis le début
    prévu), conditions (modèles par trame), notes internes non imprimées ; complétude de la proposition ;
  - **Aperçu A4** : page de garde, sections numérotées, tableau des options, planning en barres, bon pour accord
    avec choix de l'option ; impression ou PDF par le navigateur ;
  - **Suivi** : statuts (brouillon, envoyée, acceptée, refusée, sans suite ; affichés « à relancer » et
    « validité dépassée »), relances datées (intervalle réglable, message de relance à copier, rien n'est
    envoyé), prolongation de validité, option retenue, motif de refus ; statistiques : taux de transformation
    en nombre et en valeur, délai moyen de décision, option la plus choisie, motifs de refus, détail par trame,
    propositions envoyées et acceptées sur 12 mois ;
  - **Bibliothèque** : blocs réutilisables (présentation, méthode, références, engagements, autre), insérés par
    copie dans une proposition ;
  - **Profil** : identité affichée sur les propositions, validité et intervalle de relance par défaut, préfixe
    de numérotation, affichage facultatif du TTC à un taux **saisi par l'utilisateur** (vide par défaut).
- **Base intégrée** (`donnees.js`, rédigée pour QME) : 4 trames métier (conseil, développement, formation,
  travaux) avec questions de contexte, objectifs types, livrables types, étapes de planning types en semaines,
  trois options types et conditions types (commerciales, sans référence légale) ; 10 blocs types de
  bibliothèque à personnaliser (aucune référence réelle : gabarits à remplir avec l'accord des clients) ; motifs
  de refus.
- **Calculs** (`regles.js`, testés dans `outils/templates/propositions.test.mjs`) : montants en centimes,
  numérotation annuelle sans réutilisation, fin de validité, statut affiché, prochaine relance, planning
  (dates des étapes, fin du projet), comparaison des options (écarts, contenu commun et différences),
  montant d'une proposition (option retenue, sinon recommandée), complétude, taux de transformation,
  statistiques, duplication.
- **Données qui se périment : aucune.** Pas de taux de TVA intégré (saisie facultative), pas de délai de paiement
  légal, pas de mention obligatoire : renvoi au devis (T36) et aux sources officielles par l'utilisateur.
- **Risques** : pas un conseil juridique (avertissement dans l'application) ; données de clients (RGPD :
  ne garder que le nécessaire, suppression possible) ; démo 100 % fictive (organisations « exemple »).
- **Statut** : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/propositions/?demo`,
  bouton « Je suis intéressé(e) », carte `carte prochaine` du catalogue, thème « Clients et prospection »). Page
  `catalogue/propositions/`, captures `assets/templates-propositions-*.webp`, couverture
  `assets/templates-propositions-couverture.png`, tests `outils/templates/propositions.test.mjs`. Options types
  nommées Essentiel, Confort (recommandée) et Premium.
- **Communication** prête dans `communication/propositions/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html, carte d'accueil FR, carte anglaise
  `carte-en-prochaine.html` non insérée : version anglaise en attente). **Pas de fiche Gumroad, pas de ligne aux
  plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer, fiche Gumroad
  (permalien prévu `propositions-commerciales`) et clé de licence (Quentin), entrée dans
  `communication/gumroad-a-creer.json`, plannings, carte anglaise, ajout au pack PFC, passage en vente du site.

## Fiche T39 (cadrage délégué par Quentin, 14/11/2026)

### T39 · Kit références et plaquette (`templates/references-plaquette/`, préfixe KRF)
- Fiche détaillée : [`fiches/references-plaquette.md`](fiches/references-plaquette.md). Application web, 19 €, permalien
  prévu `kit-references-plaquette`, catalogue `pro` · thème « Clients et prospection », pack « Freelance : trouver ses
  clients » (PFC ; KRF retiré de `prevus` dans `outils/packs/donnees.mjs`, à ajouter aux `produits` du pack à la fusion).
- Promesse : « Tes réalisations, prêtes à convaincre. »
- Base intégrée : modèles de fiches pour 9 métiers (types de mission, mots-clés, résultats à mesurer sans valeur,
  questions d'aide), 12 secteurs et 8 tailles de client pour décrire sans nommer, trame contexte · mission · résultat,
  verbes d'action, formulations d'anonymisation, demande de témoignage en 5 questions, 3 mises en page A4.
- Écrans : références (filtres, mots-clés, complétude, mise en avant), fiche (aperçu imprimé, manques, alertes),
  sélections par prospect (suggestions par pertinence avec raisons, ordre, options d'affichage), plaquette A4
  (plaquette, fiches, liste ; impression ou PDF du navigateur ; texte pour un e-mail), profil (présentation,
  chiffres clés saisis, couleur).
- **Confidentiel vérifié** : mécanique inspirée des outils internes de références de QME, aucune référence réelle ;
  démo d'une consultante fictive (« Atelier Exemple »), clients fictifs ou anonymisés. Aucune donnée datée ni règle
  légale intégrée : l'accord du client est présenté comme bonne pratique ; chiffres saisis par l'utilisateur.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/references-plaquette/?demo`,
  bouton « Je suis intéressé(e) », carte `carte prochaine` du catalogue). Page `catalogue/references-plaquette/`,
  captures `assets/templates-references-plaquette-*.webp`, couverture `assets/templates-references-plaquette-couverture.png`,
  tests `outils/templates/references-plaquette.test.mjs`. **Version anglaise en attente** (carte prête dans
  `communication/references-plaquette/carte-en-prochaine.html`, non insérée dans `en/`).
- Communication prête dans `communication/references-plaquette/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html, cartes d'accueil FR et EN). **Pas de fiche Gumroad, pas
  de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer, fiche
  Gumroad et clé de licence (Quentin), entrée dans `communication/gumroad-a-creer.json`, plannings, carte anglaise,
  passage en vente du site.

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

## Fiche T75 (cadrage délégué par Quentin, 14/11/2026)

### T75 · Calendrier éditorial des réseaux professionnels (`templates/calendrier-editorial/`, préfixe CED, 15 €)
- Fiche détaillée : [`fiches/calendrier-editorial.md`](fiches/calendrier-editorial.md). Ex-T73, renuméroté T75 le
  14/11/2026 (T71 et T72 déjà pris sur `main`). Application web, permalien prévu `calendrier-editorial`, catalogue
  `pro` · thème « Clients et prospection ». Pack « Freelance : trouver ses clients » (PFC).
- Promesse : « Publier chaque semaine, sans chercher quoi dire. » Pour freelances, consultants et indépendants.
- Piliers avec part visée, objectif de publications par semaine et jours préférés ; banque de 92 sujets (8 métiers
  et sujets généraux) avec 11 trames ; statuts idée → brouillon → programmé → publié ; calendrier mois et semaine ;
  brouillon avec compteur (caractères, mots, hashtags, accroche, crochets restants, limite saisie par canal) ;
  statistiques saisies (vues, réactions, commentaires, partages, contacts générés) ; régularité (semaines tenues,
  pauses, série) ; recyclage des meilleurs contenus anciens.
- Aucune marque de réseau social, aucune connexion ni publication automatique, aucune limite de réseau intégrée
  (saisie par l'utilisateur) ; repères d'écriture QME modifiables. Démo fictive.
- Préfixe `CED` entièrement hexadécimal : la saisie de plus de 19 caractères est traitée comme une clé Gumroad
  (application et `/connexion/`).
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/calendrier-editorial/?demo`,
  bouton « Je suis intéressé(e) », carte `carte prochaine` du catalogue, thème « Clients et prospection »). Page
  `catalogue/calendrier-editorial/`, captures `assets/templates-calendrier-editorial-*.webp`, couverture
  `assets/templates-calendrier-editorial-couverture.png`, tests `outils/templates/calendrier-editorial.test.mjs`.
  **Version anglaise en attente** (`en/` non modifié).
- Communication prête dans `communication/calendrier-editorial/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html, carte du catalogue et carte d'accueil FR). **Pas de
  fiche Gumroad, pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix
  à confirmer, fiche Gumroad et clé de licence (Quentin), entrée dans `communication/gumroad-a-creer.json`, ajout au
  pack PFC (`netlify/lib/packs.mjs`) et régénération des pages de packs, plannings, page anglaise, passage en vente.

## Fiche T78 (cadrage délégué par Quentin, 14/11/2026)

### T78 · Conformité des sous-traitants (`templates/sous-traitants/`, préfixe STR, 29 €)

Fiche détaillée : [`fiches/sous-traitants.md`](fiches/sous-traitants.md). Statut **prêt**, « Mise en vente
prochaine » (démo libre `/templates/sous-traitants/?demo`, page `/catalogue/sous-traitants/`, carte `carte
prochaine` du thème « Projets et chantiers », bouton « Je suis intéressé(e) »), pas de fiche Gumroad (valeurs dans
`communication/sous-traitants/gumroad.json`, permalien proposé `conformite-sous-traitants`). Opérations, lots,
entreprises par rang sous leur donneur d'ordre, acceptation et agrément du paiement, pièces de vigilance par
entreprise avec date de validité, alertes J-30 / J-15 / expirée, relances depuis un modèle, tableau de conformité,
registre imprimable, export CSV. **Daté** : seuil de 5 000 € HT, validité de 6 mois (vigilance, Kbis, liste des
salariés étrangers), décennale, loi de 1975, sourcés (Service-Public F36261, urssaf.fr, Code du travail D8222-5,
D8254-2 et D8254-4, Code des assurances L243-2, Légifrance) et **lus le 14/11/2026**, date affichée dans le Guide ;
tout est paramétrable (seuil, durées, portée, pièces ajoutées). Renforcement annoncé par décret au plus tard le
27/12/2026 : affiché, à revérifier avant la mise en vente. **RGPD** : coordonnées professionnelles, aucun document
stocké. Avertissement « outil d'aide, ne remplace pas un conseil juridique » (Guide, registre, page, Gumroad).
Livrables dans `communication/sous-traitants/` (linkedin.md, instagram.md + carrousel, prospects.md, gumroad.md et
gumroad.json, section-site.html, carte-en-prochaine.html pour `en/` en attente). Publications LinkedIn et Instagram
**non planifiées** (pas d'accès aux plannings dans cette session). À rattacher à `PBT` dans `netlify/lib/packs.mjs`
et à régénérer les pages des packs à la fusion.

## Fiche T76 (cadrage délégué par Quentin, 14/11/2026)

### T76 · Suivi des appels d'offres et candidatures (`templates/appels-offres/`, préfixe CND, 15 €)
- Fiche détaillée : `fiches/appels-offres.md`. Promesse : « Répondre aux bonnes consultations, à temps. » Catalogue
  `pro`, thème « Clients et prospection » ; pack visé « Freelance : trouver ses clients » (PFC). Permalien prévu
  `suivi-appels-offres`.
- Public : freelances, consultants et PME qui répondent à des marchés publics, à des appels d'offres privés, à des
  missions sur plateforme (aucun nom de plateforme ni de marque) et à des consultations directes.
- Écrans : **Échéances** (à faire jusqu'à 7 jours, retards en tête, pièces regroupées par dossier ; calendrier
  mensuel des dates limites, dépôts visés, questions, relances, validité des offres), **Veille** (grille go/no-go de 8
  critères pondérés notés de 0 à 3, 3 éliminatoires, seuils go 65 % et à discuter 45 % réglables ; no-go avec motif),
  **Dossiers** (pièces copiées d'un modèle, statut, responsable, échéance à rebours avancée au vendredi si week-end,
  pièce de bibliothèque liée avec alerte de validité ; dépôt visé = date limite − marge ; relances ; résultat avec
  montant, motif, classement ; temps passé), **Pièces** (bibliothèque : emplacement et date de validité saisie, pas
  de fichier ; modèles de dossiers modifiables), **Bilan** (taux de go, taux de réussite = gagnées ÷ (gagnées +
  perdues), montants, temps, euros par heure, par type, par motif, par mois ; export CSV).
- **Aucune référence réglementaire** : le modèle « Marché public » liste des pièces souvent demandées, présentées
  comme point de départ ; la liste exacte est celle du règlement de chaque consultation (dit dans l'application, la
  page du site et la fiche Gumroad). Dates de validité saisies par l'utilisateur. Aucune donnée datée en base (test).
- Confidentialité : démo fictive (consultant « Alex », acheteurs inventés), aucune donnée réelle. **RGPD** : prénoms
  de responsables et noms d'organisations seulement.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/appels-offres/?demo`, bouton
  « Je suis intéressé(e) », carte `carte prochaine` du catalogue ; pas de carte anglaise : version anglaise en
  attente). Page `catalogue/appels-offres/`, captures `assets/templates-appels-offres-*.webp`, couverture
  `assets/templates-appels-offres-couverture.png`, tests `outils/templates/appels-offres.test.mjs`.
- Communication prête dans `communication/appels-offres/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, couverture.txt, kanban.txt). **Pas de fiche Gumroad, pas de ligne aux
  plannings LinkedIn et Instagram** (mission sans ces outils). Restent : fiche Gumroad et clé de licence (Quentin),
  entrée dans `communication/gumroad-a-creer.json`, ajout de CND au pack PFC (`netlify/lib/packs.mjs`, pages des packs
  régénérées), cartes anglaises, plannings, passage en vente du site.

## Fiche T79 (cadrage délégué par Quentin, 14/11/2026)

### T79 · Entretiens annuels et professionnels (`templates/entretiens-annuels/`, préfixe ENP)
- Fiche détaillée : [`fiches/entretiens-annuels.md`](fiches/entretiens-annuels.md). Application web, 19 €,
  permalien prévu `entretiens-annuels-professionnels`, catalogue `pro` · thème « Organisation et réunions ».
  Pack visé : « Petite entreprise » (PPE), où T79 est prévu.
- Promesse : « Chaque salarié a ses entretiens à jour : échéances calculées, trame prête, compte rendu
  imprimable, objectifs et formations suivis d'une année sur l'autre. »
- **Daté** : entretien de parcours professionnel (loi n° 2025-989 du 24/10/2025) la première année puis tous
  les 4 ans, état des lieux récapitulatif tous les 8 ans, cas du retour d'absence, de la mi-carrière et des
  60 ans, abondement CPF de 3 000 € (50 salariés et plus) : service-public.gouv.fr F32040 (vérifiée le
  01/10/2026), relevé le 14/11/2026 ; périodicités paramétrables ; transition pour les salariés présents avant
  la réforme non tranchée (historique saisi). **RGPD** : données minimales, export et effacement par salarié.
- Écrans : Échéances (tuiles, à traiter, à finaliser, états des lieux à surveiller, formations en attente,
  bandeau RGPD), Salariés (fiche : échéances, historique, objectifs, formations, absences, export, effacement),
  Entretiens (préparation copiable, trame par thème, blocs objectifs, formations et contrôle des 8 ans,
  synthèse, copie remise, impression ; sous-onglet Trames avec questions masquées ou ajoutées et repères
  datés), Objectifs (SMART, avancement, reconduction), Formations (statuts, CSV).
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/entretiens-annuels/?demo`,
  bouton « Je suis intéressé(e) », carte `carte prochaine` du catalogue, thème « Organisation et réunions »).
  Page `catalogue/entretiens-annuels/`, captures `assets/templates-entretiens-annuels-*.webp`, couverture
  `assets/templates-entretiens-annuels-couverture.png`, tests `outils/templates/entretiens-annuels.test.mjs`.
  Produit `ENP` déclaré (serveur, connexion, en-têtes Netlify) ; `ENP` passé de `PREVUS` à `TEMPLATES` dans
  `outils/packs/donnees.mjs` (et retiré des `prevus` de la page du pack PPE).
- Communication prête dans `communication/entretiens-annuels/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html en version « en vente », couverture.txt).
  **Pas de fiche Gumroad, pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent :
  nom et prix à confirmer, fiche Gumroad (permalien prévu `entretiens-annuels-professionnels`) et clé de licence
  (Quentin), entrée dans `communication/gumroad-a-creer.json`, ajout de `ENP` aux `produits` du pack PPE
  (`netlify/lib/packs.mjs`) et régénération des pages de packs, carte anglaise (`en/`, en attente), plannings,
  passage en vente du site. Point à suivre : règles de passage pour les salariés présents avant la réforme
  (questions-réponses du ministère du 12/02/2026 non consulté), revérifier F32040 à chaque mise à jour annuelle.

## Fiche T81 (cadrage délégué par Quentin, 14/11/2026)

### T81 · Contrats fournisseurs et échéances de résiliation (`templates/contrats/`, préfixe CTR, 25 €)
- Fiche détaillée : [`fiches/contrats.md`](fiches/contrats.md). Application web, permalien prévu `contrats-fournisseurs`,
  catalogue `pro` · thème « Équipements et véhicules ». Packs « Moyens généraux » (PMG) et « Exploitation et
  maintenance » (PXP) : CTR ajouté aux `TEMPLATES` et retiré de `PREVUS` et des `prevus` de PMG et PXP dans
  `outils/packs/donnees.mjs` ; à ajouter aux `produits` des packs (`netlify/lib/packs.mjs`) et pages régénérées à la fusion.
- Promesse : « Plus de reconduction subie. » Pour office managers, dirigeants de TPE et PME, services généraux.
- Contrats par fournisseur et catégorie (10 catégories : assurances, maintenance, télécoms, location et leasing,
  logiciels, nettoyage, énergie, sécurité, services, autre ; paramétrables), montant et périodicité, échéance avec
  reconduction tacite avancée automatiquement, préavis (contrat ou défaut de la catégorie), date limite de réception
  et envoi conseillé calculés, alertes J-60 / J-30 / préavis dépassé, décision (renouveler, renégocier, résilier),
  lettre de résiliation à adapter (copie, impression), résiliation notée, coût annuel par catégorie et fournisseur,
  économies, historique, calendrier 12 mois, export CSV. Moteur d'échéances commun avec T63.
- **Règles légales** : aucune intégrée sans source. Seul repère cité : Code des assurances, art. L113-12 (version en
  vigueur depuis le 28/05/2026), lu sur Légifrance le 14/11/2026, d'où le préavis par défaut de 2 mois des assurances
  (la police prime, dérogation possible pour les risques professionnels). Loi Chatel et résiliation infra-annuelle :
  non citées. Avertissement « outil d'aide, ne remplace pas un conseil juridique » partout.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/contrats/?demo`, bouton « Je suis
  intéressé(e) », carte `carte prochaine` du catalogue). Page `catalogue/contrats/`, captures
  `assets/templates-contrats-*.webp`, couverture `assets/templates-contrats-couverture.png`, tests
  `outils/templates/contrats.test.mjs`. **Version anglaise en attente** (`en/` non modifié ; carte prête dans
  `communication/contrats/carte-en-prochaine.html`).
- Communication prête dans `communication/contrats/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, cartes d'accueil FR et EN). **Pas de fiche Gumroad, pas de ligne aux
  plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer, fiche Gumroad
  (permalien prévu `contrats-fournisseurs`) et clé de licence (Quentin), entrée dans
  `communication/gumroad-a-creer.json`, ajout aux packs PMG et PXP et régénération des pages de packs, plannings,
  page anglaise, passage en vente du site.

## Fiche T80 (cadrage délégué par Quentin, 14/11/2026)

### T80 · Document unique d'évaluation des risques (`templates/document-unique/`, préfixe DRP, 29 €)
- Fiche détaillée : [`fiches/document-unique.md`](fiches/document-unique.md). Application web, permalien prévu
  `document-unique-evaluation-risques`, catalogue `pro` · thème « Organisation et réunions ». Pack visé :
  « Petite entreprise » (PPE).
- Promesse : « Tes risques évalués, ton document à jour. » Pour les employeurs de TPE/PME, dès le premier salarié.
- Base intégrée : 20 familles de risques inspirées de la brochure INRS ED 840 (titres, situations et mesures
  reformulés, source citée), 9 secteurs avec unités de travail et risques à examiner, grille 4 × 4 par défaut
  (paramétrable), 6 types de mesures, motifs de mise à jour et types d'événements. **Obligations sourcées et
  datées** : service-public.gouv.fr fiche F35360 (vérifiée le 22/07/2026) et INRS « Document unique, ce qu'il
  faut retenir » (mise à jour le 18/10/2024), consultés le 14/11/2026, articles du Code du travail cités par
  ces pages (Légifrance inaccessible à nos outils). Seuils 11 (mise à jour annuelle) et 50 (programme annuel).
- Écrans : bord (alertes, matrice G × P, unités), évaluation par unité (initial et résiduel), plan d'actions /
  programme annuel, document imprimable (sommaire, inventaire par unité, plan, historique), versions archivées
  et événements, obligations et sources, réglages (grille, entreprise, revue conseillée).
- Marques : **daté** (revérifier les sources chaque année), **confidentiel** vérifié (démo fictive « Menuiserie
  Exemple »), avertissement « outil d'aide, ne remplace ni un préventeur ni un conseil juridique ».
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/document-unique/?demo`,
  bouton « Je suis intéressé(e) », carte `carte prochaine` du catalogue). Page `catalogue/document-unique/`,
  captures `assets/templates-document-unique-*.webp`, couverture `assets/templates-document-unique-couverture.png`,
  tests `outils/templates/document-unique.test.mjs`. Produit `DRP` déclaré (serveur, connexion, en-têtes Netlify) ;
  `DRP` passé de `PREVUS` à `TEMPLATES` dans `outils/packs/donnees.mjs` (et retiré des `prevus` du pack PPE).
- Communication prête dans `communication/document-unique/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html en version « en vente », couverture.txt, carte
  d'accueil FR, carte anglaise `carte-en-prochaine.html` non insérée : version anglaise en attente). **Pas de
  fiche Gumroad, pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et
  prix à confirmer, fiche Gumroad et clé de licence (Quentin), entrée dans `communication/gumroad-a-creer.json`,
  ajout de `DRP` aux `produits` du pack PPE (`netlify/lib/packs.mjs`) et régénération des pages de packs, carte
  anglaise, plannings, passage en vente du site.

## Fiche T84 (cadrage délégué par Quentin, 14/11/2026)

### T84 · Remboursements santé (`templates/remboursements-sante/`, préfixe RBS, 12 €)

Fiche détaillée : [`fiches/remboursements-sante.md`](fiches/remboursements-sante.md). Statut **prêt**, « Mise en
vente prochaine » (démo libre `/templates/remboursements-sante/?demo`, page `/catalogue/remboursements-sante/`, carte
`carte prochaine` du thème « Argent », bouton « Je suis intéressé(e) »), pas de fiche Gumroad (valeurs dans
`communication/remboursements-sante/gumroad.json`, permalien proposé `remboursements-sante`). Membres du foyer, soins
(33 types en 10 familles, date, praticien facultatif, montant payé), Sécurité sociale et mutuelle suivies séparément
(remboursement attendu, tiers payant, pas de prise en charge ; reçu et écart), reste à charge, retards après un délai
réglable (30 / 30 / 15 jours par défaut, **sans valeur officielle**, présentés comme tels), message de relance à copier
et relances notées, bilan annuel par personne et par famille de soins (barres empilées, tableau), mutuelle comparée aux
cotisations **saisies**, export CSV et JSON. **Aucun taux de remboursement intégré**, aucune donnée datée.
**Médical / RGPD** : décision de T04 appliquée (consentement explicite au premier lancement, rien en ligne avant ;
hébergement UE ; « Effacer toutes mes données » = retrait du consentement) ; minimisation : aucun diagnostic, motif,
médicament ni numéro de sécurité sociale, pas de champ de note libre ; seconde case pour les soins des autres membres du
foyer (accord ou représentant légal) ; paragraphe ajouté à `/confidentialite/`. HDS non vérifiée (comme T04).
Avertissement « ne remplace ni un avis professionnel ni les relevés officiels » (consentement, pied de chaque vue,
Réglages, page, Gumroad). Livrables dans `communication/remboursements-sante/` (linkedin.md, instagram.md + carrousel
5 vues, prospects.md, gumroad.md et gumroad.json, section-site.html, carte-en-prochaine.html pour `en/` en attente).
Publications LinkedIn et Instagram **non planifiées**. À rattacher à `PAR` dans `netlify/lib/packs.mjs` et à
régénérer les pages des packs à la fusion.

## Fiche T82 (cadrage délégué par Quentin, 14/11/2026)

### T82 · Demandes d'achat et fournitures (`templates/achats/`, préfixe ACH, 19 €)
- Fiche détaillée : [`fiches/achats.md`](fiches/achats.md). Catalogue `pro` · thème « Équipements et véhicules » ; pack
  visé « Moyens généraux » (PMG). Permalien prévu `demandes-achat-fournitures`.
- Promesse : « Qui a demandé quoi, qui l'a validé, et où en est le budget. » Public : office managers, services
  généraux de PME, petites structures associatives.
- Usage à plusieurs : une clé partagée, nom saisi à chaque étape, pas de comptes en V1 (comme T50). Une demande = un
  article (plusieurs en un envoi) ; circuit demandée → validée/refusée (motif) → commandée → reçue, partielle possible,
  reliquat abandonnable ; seuil de validation automatique (prix estimé, montant sous le seuil, budget suffisant).
- Commandes groupées par fournisseur, bon A4 imprimable (rien n'est envoyé), délai de livraison et retard ; budget
  annuel par service (consommé, engagé, en attente, disponible), exercice décalable ; historique, délais moyens, CSV.
- Base : 104 fournitures types en 6 catégories, **sans prix ni marque** ; aucune donnée datée ni règle légale ou
  fiscale (HT/TTC simple libellé). Conflits 409 : actions rejouées sur la version du serveur (fonction `rejouer`).
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo `/templates/achats/?demo`, page
  `catalogue/achats/`, captures `assets/templates-achats-*.webp`, couverture `assets/templates-achats-couverture.png`,
  tests `outils/templates/achats.test.mjs`). Version anglaise en attente.
- Communication prête dans `communication/achats/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, carte d'accueil FR). **Pas de fiche Gumroad, pas de ligne aux
  plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer (clé partagée au prix
  d'un template individuel), fiche Gumroad et clé de licence, entrée dans `communication/gumroad-a-creer.json`, ajout
  d'ACH au pack PMG (`netlify/lib/packs.mjs`, pages générées), carte anglaise, plannings, passage en vente.

## Fiche T85 (cadrage délégué par Quentin, 14/11/2026)

### T85 · Capacité d'emprunt et comparateur de prêts (`templates/emprunt/`, préfixe CPT, 15 €)
- Fiche détaillée : `fiches/emprunt.md`. Promesse : « Combien emprunter, et à quel coût. » Catalogue `perso`, thème
  « Argent » ; packs visés « Reprendre la main sur son argent » (PAR) et « Propriétaire » (PPB). Permalien prévu
  `capacite-emprunt-comparateur-prets`.
- Public : primo-accédants (seuls ou à deux) et investisseurs particuliers (loyers retenus à une part saisie).
- Écrans : **Capacité** (revenus, crédits en cours, mensualité maximale au taux d'effort saisi, montant empruntable au
  taux, à la durée et à l'assurance saisis, reste à vivre, montant selon la durée), **Projet** (prix, frais de notaire
  saisis ou estimés en hypothèse affichée, travaux, autres frais, apport, besoin de financement, prix maximal),
  **Offres** (2 à 5 : assurance sur capital initial ou restant dû, quotité, frais de dossier, garantie, courtage ; coût
  total, TAEG approché présenté comme estimation, taux d'effort ; graphique en barres empilées ; questions à poser à la
  banque), **Amortissement** (par mois ou par année, graphique capital et intérêts, CSV, impression ; remboursement
  anticipé avec durée raccourcie ou mensualité baissée et indemnités).
- **Aucun taux de marché intégré.** Données datées, toutes modifiables et affichées avec leur source : seuils 35 % et
  25 ans (décision D-HCSF-2021-7 du 29/09/2021, vérifiée le 14/11/2026) ; plafond des indemnités de remboursement
  anticipé (Code de la consommation, L313-47, L313-48, R313-25, lu le 14/11/2026 sur des reprises du code, **à relire
  sur Légifrance**) ; frais de notaire estimés 8 % ancien et 3 % neuf présentés comme hypothèse.
- Confidentialité : démo fictive (Camille et Sam, banques inventées). Argent : avertissement « ne remplace pas le
  conseil d'un professionnel du crédit » sur chaque vue, la page du site et la fiche Gumroad.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/emprunt/?demo`, bouton « Je
  suis intéressé(e) », carte `carte prochaine` du catalogue ; pas de carte anglaise : version anglaise en attente).
  Page `catalogue/emprunt/`, captures `assets/templates-emprunt-*.webp`, couverture
  `assets/templates-emprunt-couverture.png`, tests `outils/templates/emprunt.test.mjs`.
- Communication prête dans `communication/emprunt/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, couverture.txt, kanban.txt). **Pas de fiche Gumroad, pas de ligne aux
  plannings LinkedIn et Instagram** (mission sans ces outils). Restent : fiche Gumroad et clé de licence (Quentin),
  entrée dans `communication/gumroad-a-creer.json`, ajout de CPT aux packs PAR et PPB (`netlify/lib/packs.mjs`, pages
  des packs régénérées ; le tableau « Packs » ci-dessus le liste encore en prévu), cartes anglaises, plannings, passage
  en vente du site.

## Fiche T86 (cadrage délégué par Quentin, 14/11/2026)

### T86 · Cadeaux reçus et remerciements (`templates/remerciements/`, préfixe CDX, 12 €)
- Fiche détaillée : [`fiches/remerciements.md`](fiches/remerciements.md). Application web, 12 €, permalien prévu
  `cadeaux-remerciements`, catalogue `perso` · thème « Projets de vie ». Packs : « Mariage et installation à deux »
  (PMR, où T86 est prévu), utile au pack Famille. Complète T15 (même logique de liste collée).
- Promesse : « Qui a offert quoi, et à qui il reste à dire merci. »
- Cadrage : unité de remerciement = le foyer (statut et message), cadeaux rattachés ; plusieurs événements
  (mariage, naissance ou baptême, anniversaire, retraite, obsèques au ton sobre, autre) ; 9 types de cadeaux ou
  d'attentions, montant facultatif, totaux par cagnotte ; statut à écrire, écrit, envoyé ; 44 modèles de messages
  originaux par événement et par ton ; objectif d'envoi réglé par l'utilisateur (6 semaines par défaut, pas une
  règle) ; étiquettes A4 (4 formats décrits par leurs dimensions, départ, décalage) ; import d'une liste collée ;
  export CSV ; effacement des adresses déjà utilisées et de l'événement. Aucune règle légale ni donnée datée.
  **RGPD** : données de tiers minimisées (nom d'usage, adresse facultative pour la poste, aucun contact).
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/remerciements/?demo`, bouton
  « Je suis intéressé(e) », carte `carte prochaine` du catalogue, thème « Projets de vie »). Page
  `catalogue/remerciements/`, captures `assets/templates-remerciements-*.webp`, couverture
  `assets/templates-remerciements-couverture.png`, tests `outils/templates/remerciements.test.mjs`. Produit `CDX`
  déclaré (serveur, connexion, en-têtes Netlify) ; `CDX` passé de `PREVUS` à `TEMPLATES` dans
  `outils/packs/donnees.mjs` (et retiré des `prevus` de la page du pack PMR).
- Communication prête dans `communication/remerciements/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html en version « en vente », couverture.txt).
  **Pas de fiche Gumroad, pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent :
  nom et prix à confirmer, fiche Gumroad et clé de licence (Quentin), entrée dans
  `communication/gumroad-a-creer.json`, ajout de `CDX` aux `produits` du pack PMR (`netlify/lib/packs.mjs`) et
  régénération des pages de packs, carte anglaise (`en/`, en attente), plannings, passage en vente du site. À
  relire par Quentin : ton des modèles pour les obsèques, hashtags Instagram hors jeux du kit.

## Fiche T87 (cadrage délégué par Quentin, 14/11/2026)

### T87 · Revue hebdomadaire et journal de bord (`templates/revue-hebdo/`, préfixe RVH, 12 €)
- Fiche détaillée : [`fiches/revue-hebdo.md`](fiches/revue-hebdo.md). Application web, permalien prévu
  `revue-hebdomadaire`, catalogue `perso` · thème « Organisation et études » (avec le planner). Pack « Productivité
  perso » (PPR) : RVH ajouté aux `TEMPLATES` et retiré de `PREVUS` et des `prevus` de PPR dans
  `outils/packs/donnees.mjs` ; à ajouter aux `produits` du pack (`netlify/lib/packs.mjs`), à une étape `parcours`
  de PPR et pages régénérées à la fusion.
- Promesse : « Ta semaine, revue en 20 minutes. » Pour cadres, indépendants, managers (rituel du vendredi).
- Revue guidée en 7 étapes (vider la tête, semaine passée et priorités notées, réussites et difficultés,
  apprentissages, 3 priorités pour la semaine suivante, rendez-vous et échéances, énergie et humeur de 1 à 5),
  55 questions de revue originales en rotation (masquables, questions personnelles), journal d'une ligne par jour
  avec humeur facultative, historique cherchable, tendance (série, semaines tenues sur 12, humeur et énergie,
  priorités tenues ; palette validée par le skill dataviz), rappel le jour choisi affiché dans l'outil (aucune
  notification), export texte. Complète T03, T30 et T08 sans connexion automatique.
- **Santé** : humeur et énergie = repères personnels, sans portée médicale (mention dans l'outil, sur la page du
  site, la fiche Gumroad et la communication) ; repère bienveillant après 3 semaines notées à 2 ou moins, sans
  diagnostic ni numéro cité. Aucune base externe, aucune donnée datée.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/revue-hebdo/?demo`, bouton
  « Je suis intéressé(e) », carte `carte prochaine` du catalogue). Page `catalogue/revue-hebdo/`, captures
  `assets/templates-revue-hebdo-*.webp`, couverture `assets/templates-revue-hebdo-couverture.png`, tests
  `outils/templates/revue-hebdo.test.mjs`. **Version anglaise en attente** (`en/` non modifié ; carte prête dans
  `communication/revue-hebdo/carte-en-prochaine.html`).
- Communication prête dans `communication/revue-hebdo/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, cartes d'accueil FR et EN). **Pas de fiche Gumroad, pas de ligne
  aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer, fiche Gumroad
  (permalien prévu `revue-hebdomadaire`) et clé de licence (Quentin), entrée dans
  `communication/gumroad-a-creer.json`, ajout au pack PPR et régénération des pages de packs, plannings, page
  anglaise, passage en vente du site.

## Fiche T88 (cadrage délégué par Quentin, 14/11/2026)

### T88 · Notes et moyennes (`templates/notes/`, préfixe NTS, 12 €)
- Fiche détaillée : [`fiches/notes.md`](fiches/notes.md). Application web, permalien prévu `notes-moyennes`,
  catalogue `perso` · thème « Organisation et études ». Pack visé : « Étudiant » (PET).
- Promesse : « Ta moyenne, au centième près. » Pour les lycéens, étudiants (BTS, BUT, licence, master, écoles) et
  candidats aux concours.
- Fonctions : années et périodes (semestres, trimestres), UE et matières avec coefficients ou crédits ECTS, notes
  avec barème et coefficient propres (contrôles, partiels, oraux, TP, rattrapages, absences neutralisées),
  moyennes par matière, UE, période et année comparées aux seuils au centième, crédits acquis, règles du diplôme
  **saisies par l'utilisateur** (compensation totale, par UE ou aucune, note éliminatoire, rattrapage
  « remplace » ou « meilleure », compensation entre périodes, mentions), simulateur de la note nécessaire aux
  épreuves à venir (dichotomie), courbe de la moyenne (skill `dataviz`, palette validée), relevé imprimable,
  export CSV. Notation sur 20, sur 10, sur 100 ou en lettres (table saisie).
- Marques : **aucun barème officiel ni règle de diplôme intégrés** (valeurs proposées modifiables : seuil 10,
  mentions 12 / 14 / 16, table de lettres) ; aucune donnée datée ; relevé « sans valeur officielle » ; démo
  fictive (« Camille Exemple », établissement inventé).
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/notes/?demo`, bouton
  « Je suis intéressé(e) », carte `carte prochaine` du catalogue). Page `catalogue/notes/`, captures
  `assets/templates-notes-*.webp`, couverture `assets/templates-notes-couverture.png`, tests
  `outils/templates/notes.test.mjs`. Produit `NTS` déclaré (serveur, connexion, en-têtes Netlify) ; `NTS` passé de
  `PREVUS` à `TEMPLATES` dans `outils/packs/donnees.mjs` (et retiré des `prevus` du pack PET).
- Communication prête dans `communication/notes/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html en version « en vente », couverture.txt, carte d'accueil FR,
  carte anglaise `carte-en-prochaine.html` non insérée : version anglaise en attente). **Pas de fiche Gumroad,
  pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer,
  fiche Gumroad et clé de licence (Quentin), entrée dans `communication/gumroad-a-creer.json`, ajout de `NTS` aux
  `produits` du pack PET (`netlify/lib/packs.mjs`) et régénération des pages de packs, carte anglaise, plannings,
  passage en vente du site.

## Fiche T89 (cadrage délégué par Quentin, 14/11/2026)

### T89 · Candidatures études, stages, alternance (`templates/candidatures/`, préfixe CAN, 12 €)
- Fiche détaillée : `fiches/candidatures.md`. Promesse : « Chaque dossier, à temps. » Catalogue `perso`, thème
  « Organisation et études » ; pack visé « Étudiant » (PET). Permalien prévu `candidatures-etudes-stages-alternance`.
- Public : lycéens (orientation après le bac), étudiants (master, écoles), candidats à un stage, une alternance ou un
  job étudiant.
- Écrans : **Tableau de bord** (à envoyer avec pièces manquantes, relances dues, 14 prochains jours, compteurs par
  statut), **Candidatures** (filtres type et statut, fiche : statut en 7 étapes, pièces à statut au toucher, dates,
  relances avec message à copier, lettre, entretien, notes ; dupliquer, imprimer), **Vœux** (classement par type),
  **Échéances** (à traiter puis mois par mois, export .ics), **Lettres et entretiens** (5 trames originales avec aperçu
  et champs manquants surlignés ; 32 questions types avec piste, notes, fiche imprimable).
- Base : 4 types, 7 statuts, 23 pièces types (4 après acceptation), 6 listes de départ, 7 thèmes de questions,
  3 messages. **Aucune date ni calendrier officiel** (test), **aucune plateforme nommée** (test sur la base,
  l'interface et la page). Relance : délai réglable (10 jours par défaut) hors formation ; pour une formation,
  seulement après la date de réponse annoncée ; remerciement après un entretien passé.
- Confidentialité : démo fictive (étudiant « Noa », établissements et entreprises inventés). **À trancher par
  Quentin** : public en partie mineur (achat par un parent, données saisies par le candidat lui-même, aucune note ni
  pièce stockée).
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/candidatures/?demo`, bouton
  « Je suis intéressé(e) », carte `carte prochaine` du catalogue ; pas de carte anglaise : version anglaise en
  attente). Page `catalogue/candidatures/`, captures `assets/templates-candidatures-*.webp`, couverture
  `assets/templates-candidatures-couverture.png`, tests `outils/templates/candidatures.test.mjs`. CAN retiré de
  `PREVUS` et de la liste `prevus` du pack PET (`outils/packs/donnees.mjs`), ajouté à `TEMPLATES`.
- Communication prête dans `communication/candidatures/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, couverture.txt, carte-en-prochaine.html). **Pas de fiche Gumroad,
  pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : fiche Gumroad et clé de
  licence (Quentin), entrée dans `communication/gumroad-a-creer.json`, ajout de CAN au pack PET
  (`netlify/lib/packs.mjs`, pages des packs régénérées), cartes anglaises, plannings, passage en vente du site.

## Fiche T91 (cadrage délégué par Quentin, 14/11/2026)

### T91 · Subventions (`templates/subventions/`, préfixe SBV, 25 €)
- Fiche détaillée : [`fiches/subventions.md`](fiches/subventions.md). Catalogue `pro` · thème « Associations,
  formation et événements » ; pack visé « Associations et clubs » (PAS). Permalien prévu `subventions-association`.
- Promesse : « Chaque dossier déposé à temps, chaque euro justifié. » Public : associations, clubs, centres sociaux,
  petites structures culturelles. Une clé partagée par le bureau, aucune donnée personnelle demandée.
- Financeurs typés (public / privé), projets avec budget prévisionnel par poste, un dossier par financeur et par
  projet (demandé, accordé, statut, dates toutes saisies), pièces types proposées selon le financeur, versements en
  plusieurs fois et reste à percevoir, échéances (dépôt, réponse à relancer, versements, bilan, convention) avec
  alertes, dépenses justificatives imputables à un dossier, trame du bilan imprimable, tableau de bord annuel, CSV.
- **Aucun calendrier de financeur intégré** (daté). Rappels des subventions publiques sourcés : service-public.gouv.fr
  F3180 (vérifiée le 01/01/2026 : convention au-delà de 23 000 €, comptes annuels au-delà de 153 000 €) et R46623
  (vérifiée le 30/12/2025 : compte rendu financier Cerfa n° 15059*02 dans les 6 mois suivant la fin de l'exercice),
  consultées le 14/11/2026, désactivables.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo `/templates/subventions/?demo`, page
  `catalogue/subventions/`, captures `assets/templates-subventions-*.webp`, couverture
  `assets/templates-subventions-couverture.png`, tests `outils/templates/subventions.test.mjs`). Version anglaise en
  attente.
- Communication prête dans `communication/subventions/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, carte-prochaine.html, couverture.txt). **Pas de fiche Gumroad, pas
  de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer, fiche
  Gumroad et clé de licence, entrée dans `communication/gumroad-a-creer.json`, ajout de SBV au pack PAS
  (`netlify/lib/packs.mjs`, pages générées), carte anglaise, plannings, passage en vente.

## Fiche T92 (cadrage délégué par Quentin, 14/11/2026)

### T92 · Bénévoles et planning des créneaux (`templates/benevoles/`, préfixe BNV, 19 €)
- Fiche détaillée : [`fiches/benevoles.md`](fiches/benevoles.md). Catalogue `pro` · thème « Associations, formation et
  événements » ; pack visé « Associations et clubs » (PAS). Permalien prévu `benevoles-planning-creneaux`.
- Promesse : « Chaque créneau tenu, sans trou ni doublon. » Public : associations, clubs sportifs, comités des fêtes,
  organisateurs de festivals ou de compétitions.
- Usage à plusieurs : une clé partagée par les responsables, prénom saisi sur l'appareil, pas de comptes ; saisies
  simultanées fusionnées (`fusionner`), une double affectation née d'une fusion apparaît en conflit. **Pas
  d'inscription en ligne des bénévoles en V1** (le responsable saisit les réponses).
- Annuaire (coordonnées minimales, compétences, postes préférés et à éviter), événements créés depuis 6 modèles (33
  postes types, créneaux types avec besoin en personnes), réponses par événement (disponible, en partie avec plages,
  indisponible, sans réponse, maximum d'heures), affectation manuelle et suggestion (disponible, compétence,
  équité de charge), remplissage automatique des trous (le créneau le plus contraint d'abord), conflits (double,
  indisponible, sans pause, journée trop longue, maximum, compétence), plannings A4 par poste et par personne,
  message à copier par bénévole, bilan des heures (part du quart le plus investi), duplication d'un événement, CSV.
- **Aucune règle légale ni donnée datée** : repères de pause et d'heures choisis par l'association (les bénévoles ne
  relèvent pas du Code du travail) ; RGPD (art. 5.1.c, 5.1.e, 13, 15, 17) lu sur cnil.fr le 14/11/2026 ; durée de
  conservation choisie par l'association (24 mois par défaut, bénévoles inactifs signalés). Lien avec T51 et T52 :
  modèle « Compétition sportive » et postes « Sport », sans lien technique.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo `/templates/benevoles/?demo`, page
  `catalogue/benevoles/`, captures `assets/templates-benevoles-*.webp`, couverture
  `assets/templates-benevoles-couverture.png`, tests `outils/templates/benevoles.test.mjs`). Version anglaise en attente.
- Communication prête dans `communication/benevoles/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, couverture.txt, carte-prochaine.html). **Pas de fiche Gumroad, pas
  de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer (clé
  partagée par le bureau au prix d'un template individuel), fiche Gumroad et clé de licence, entrée dans
  `communication/gumroad-a-creer.json`, ajout de BNV au pack PAS (`netlify/lib/packs.mjs`, pages des packs
  régénérées ; BNV retiré des prévus dans `outils/packs/donnees.mjs`), carte anglaise, plannings, passage en vente.

## Fiche T90 (cadrage délégué par Quentin, 14/11/2026)

### T90 · Planning de mémoire ou de thèse (`templates/memoire/`, préfixe MMR, 15 €)

Fiche détaillée : [`fiches/memoire.md`](fiches/memoire.md). Statut **prêt**, « Mise en vente prochaine » (démo libre
`/templates/memoire/?demo`, page `/catalogue/memoire/`, carte `carte prochaine` du thème « Organisation et études »,
bouton « Je suis intéressé(e) »), pas de fiche Gumroad (valeurs dans `communication/memoire/gumroad.json`, permalien
proposé `planning-memoire`, catégorie `education`). Cible : étudiants de master, élèves ingénieurs en PFE, doctorants.
Projet (type master, PFE, thèse ou autre ; dates de début, de rendu, de soutenance ; mots visés saisis ; mots par page ;
jours de travail), plan hiérarchique partie / chapitre / section avec statut (à écrire, brouillon, relu, final), mots
écrits et visés, plans de départ ; rétroplanning calculé à rebours depuis le rendu ou la soutenance (4 modèles de jalons
types, resserrés quand le temps manque, dates fixables, jalon « fin de la rédaction ») ; rythme nécessaire en mots par
jour de travail, rythme réel sur 14 jours (relevé quotidien du total) et date projetée ; courbe d'avancement et barres
par statut (skill `dataviz`, palette validée) ; rendez-vous avec le directeur (points, notes, actions à échéance, ordre
du jour à copier) ; bibliographie simple (export texte auteur-date, **aucune norme revendiquée**) ; journal de séances ;
synthèse imprimable, exports CSV et JSON. **Aucune donnée datée ni règle d'établissement** : jalons et mots proposés
présentés comme repères indicatifs. Le texte du mémoire n'est jamais lu. Livrables dans `communication/memoire/`
(linkedin.md, instagram.md + carrousel 5 vues, prospects.md, gumroad.md et gumroad.json, couverture.txt,
section-site.html, carte-en-prochaine.html pour `en/` en attente). Publications LinkedIn et Instagram **non
planifiées**. À rattacher à `PET` dans `netlify/lib/packs.mjs` et à régénérer les pages des packs à la fusion.

## Fiche T93 (cadrage délégué par Quentin, 14/11/2026)

### T93 · Assemblée générale et vie statutaire (`templates/assemblee-generale/`, préfixe AGS, 19 €)
- Fiche détaillée : [`fiches/assemblee-generale.md`](fiches/assemblee-generale.md). Application web, 19 €, permalien
  prévu `assemblee-generale-association`, catalogue `pro` · thème « Associations, formation et événements ». Pack :
  « Associations et clubs » (PAS, où T93 est prévu).
- Promesse : « Une AG en règle, sans stress. »
- Cadrage : quatre instances (AG ordinaire, AG extraordinaire, conseil, bureau) ; **aucune règle légale intégrée** :
  délai de convocation, quorum (fraction au moins / plus de, nombre, aucun ; pouvoirs comptés ou non ; seconde
  convocation), pouvoirs (admis, plafond), majorités nommées (base, fraction) et durée des mandats saisis d'après
  les statuts, valeurs de départ marquées « à vérifier » jusqu'à confirmation ; calculs en entiers. Membres votants
  = case « cotisation à jour » ; conseil et bureau = mandats en cours. Rétroplanning daté depuis la date limite de
  convocation ; trames originales de convocation (formelle, conviviale, conseil), de pouvoir et de PV ; feuille de
  présence et pouvoirs vérifiés ; votes pour / contre / abstentions ; PV imprimable ; mandats avec échéances,
  alertes et renouvellement ; archive par année ; exports CSV. Avertissement : outil d'aide, les statuts font foi,
  ne remplace pas un conseil juridique. **RGPD** : nom, catégorie, e-mail facultatif ; suppression d'un membre.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/assemblee-generale/?demo`,
  bouton « Je suis intéressé(e) », carte `carte prochaine` du catalogue). Page `catalogue/assemblee-generale/`,
  captures `assets/templates-assemblee-generale-*.webp`, couverture `assets/templates-assemblee-generale-couverture.png`,
  tests `outils/templates/assemblee-generale.test.mjs`. Produit `AGS` déclaré (serveur, connexion, en-têtes
  Netlify) ; `AGS` passé de `PREVUS` à `TEMPLATES` dans `outils/packs/donnees.mjs` (et retiré des `prevus` de la
  page du pack PAS).
- Communication prête dans `communication/assemblee-generale/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html en version « en vente », couverture.txt).
  **Pas de fiche Gumroad, pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent :
  nom et prix à confirmer, fiche Gumroad et clé de licence (Quentin), entrée dans
  `communication/gumroad-a-creer.json`, ajout de `AGS` aux `produits` du pack PAS (`netlify/lib/packs.mjs`) et
  régénération des pages de packs, carte anglaise (`en/`, en attente), plannings, passage en vente du site. À
  relire par Quentin : trames de convocation et de PV, hashtags Instagram hors jeux du kit.

## Fiche T95 (cadrage délégué par Quentin, 14/11/2026)

### T95 · Rentabilité d'un investissement locatif (`templates/investissement-locatif/`, préfixe RNT, 15 €)
- Fiche détaillée : `fiches/investissement-locatif.md`. Promesse : « Ce bien, rentable ou pas ? » Catalogue `perso`,
  thème « Argent » ; pack visé « Propriétaire » (PPB). Permalien prévu `rentabilite-investissement-locatif`.
- Public : particuliers qui étudient l'achat d'un bien locatif (nu, meublé, colocation, location saisonnière).
- Écrans : **Comparatif** (jusqu'à 5 biens, verdict, barres signées du cash-flow, côte à côte, prix maximal pour un
  rendement visé brut ou net), **Analyse** (tuiles, cascade loyers → vacance → charges → crédit → cash-flow, détail du
  calcul, points à vérifier par bien), **Sensibilité** (loyer − 10 %, vacance + 1 mois, taux + 1 point, cumul ; tous les
  biens face aux mêmes chocs), **Fiche** d'analyse imprimable ; export CSV.
- Calculs : coût total (notaire saisi ou estimé, hypothèse 8 % ancien / 3 % neuf affichée et modifiable), loyers par
  lot ou à la nuitée, vacance en mois par an, charges (taxe foncière saisie obligatoire), crédit aux formules de T85
  (`templates/emprunt/`), rendement brut (sur le prix) et net de charges (sur le coût total), cash-flow avant impôt,
  effort d'épargne, prix maximal. **Aucun** taux de marché, prix au m², loyer de référence ni taux d'impôt intégré
  (test). **Fiscalité hors calcul**, signalée partout ; avertissement « ne remplace pas un conseil en investissement ni
  un conseil fiscal ».
- Confidentialité : démo fictive (quatre biens sans adresse, montants et taux inventés).
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/investissement-locatif/?demo`,
  bouton « Je suis intéressé(e) », carte `carte prochaine` du catalogue ; pas de carte anglaise : version anglaise en
  attente). Page `catalogue/investissement-locatif/`, captures `assets/templates-investissement-locatif-*.webp`,
  couverture `assets/templates-investissement-locatif-couverture.png`, tests
  `outils/templates/investissement-locatif.test.mjs`. RNT retiré de `PREVUS` et de la liste `prevus` du pack PPB
  (`outils/packs/donnees.mjs`), ajouté à `TEMPLATES`.
- Communication prête dans `communication/investissement-locatif/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html, couverture.txt, carte-en-prochaine.html). **Pas de fiche
  Gumroad, pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : fiche Gumroad et clé
  de licence (Quentin), entrée dans `communication/gumroad-a-creer.json`, ajout de RNT au pack PPB
  (`netlify/lib/packs.mjs`, pages des packs régénérées), carte anglaise, plannings, passage en vente du site.

## Fiche T96 (cadrage délégué par Quentin, 14/11/2026)

### T96 · Charges et assemblées générales de copropriété (`templates/copropriete/`, préfixe CPR, 15 €)
- Fiche détaillée : [`fiches/copropriete.md`](fiches/copropriete.md). Catalogue `perso` · thème « Argent » ; pack visé
  « Propriétaire » (PPB). Permalien prévu `charges-ag-copropriete`.
- Promesse : « Chaque appel payé, chaque vote préparé. » Public : copropriétaires occupants ou bailleurs, membres de
  conseil syndical. Plusieurs copropriétés par clé, aucune donnée personnelle demandée.
- Lots et tantièmes (quote-part estimée), appels de fonds (provisions, fonds de travaux, échéances de travaux votés)
  payés ou à payer, 4 appels trimestriels générés depuis le budget, décompte annuel par poste (15 postes types),
  régularisation (charges réelles − provisions appelées), part récupérable sur le locataire saisie par poste (aide
  limitée aux catégories citées par F947), répartition par poste et évolution sur plusieurs exercices (graphiques
  dataviz), AG (convocation, ordre du jour collé, majorité **saisie**, intention de vote, résultat), travaux votés avec
  échéancier, documents à conserver (référence de rangement, aucun fichier), alertes, CSV, impressions.
- **Aucune règle de majorité intégrée**. Repères sourcés service-public.gouv.fr, consultés le 14/11/2026,
  désactivables : F20586 (vérifiée le 04/08/2026 : provisions au quart du budget, 1er jour du trimestre), F34026
  (vérifiée le 09/06/2026 : fonds de travaux ≥ 5 % du budget prévisionnel), F947 (vérifiée le 15/04/2025 : liste des
  charges récupérables, décret n° 87-713). Avertissement : outil d'aide, le règlement de copropriété et le syndic font
  foi, ne remplace pas un conseil juridique.
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo `/templates/copropriete/?demo`, page
  `catalogue/copropriete/`, captures `assets/templates-copropriete-*.webp`, couverture
  `assets/templates-copropriete-couverture.png`, tests `outils/templates/copropriete.test.mjs`). Version anglaise en
  attente.
- Communication prête dans `communication/copropriete/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, carte-prochaine.html, couverture.txt). **Pas de fiche Gumroad, pas
  de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer, fiche
  Gumroad et clé de licence, entrée dans `communication/gumroad-a-creer.json`, ajout de CPR au pack PPB
  (`netlify/lib/packs.mjs`, pages générées), carte anglaise, plannings, passage en vente.

## Fiche T94 (cadrage délégué par Quentin, 14/11/2026)

### T94 · État des lieux d'entrée et de sortie (`templates/etat-des-lieux/`, préfixe ETD, 19 €)
- Fiche détaillée : [`fiches/etat-des-lieux.md`](fiches/etat-des-lieux.md). Application web, permalien prévu
  `etat-des-lieux`, catalogue `perso` · thème « Argent ». Pack visé : « Propriétaire » (PPB).
- Promesse : « Entrée, sortie, et ce qui a changé. » Pour les propriétaires bailleurs (vide ou meublé), les
  locataires et les petites agences.
- Fonctions : un dossier par bail (logement, parties, mandataire, dates, dépôt de garantie), 12 types de pièce et
  leurs éléments (mobilier ajouté en meublé), 6 modèles de logement, état codé en un toucher (neuf, bon, usage
  normal, dégradé, hors service) avec commentaire et photo, compteurs et clés, sortie comparée à l'entrée (usure
  normale distinguée des dégradations), vétusté selon la grille **saisie** (aucune intégrée), retenues proposées,
  date limite de restitution du dépôt et délai de rectification de l'entrée, document imprimable à signer (une ou
  deux colonnes), points à compléter, « Nouveau locataire » (entrée = sortie précédente), export CSV.
- Photos : vignettes JPEG réduites dans le navigateur (≤ 20 000 caractères), synchronisées avec le dossier, une par
  élément et par constat, 30 par compte (réglable jusqu'à 60) ; originaux non gardés (dit à l'utilisateur).
- Marques : outil d'aide, **pas un document juridique certifié** ; délais (1 et 2 mois, 10 jours) relevés sur
  service-public.gouv.fr (F31270, F33671, F31269) le 14/11/2026, modifiables ; démo fictive (« Claire Exemple »,
  « Ville-Exemple », « Agence Démo Immobilier »).
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo libre `/templates/etat-des-lieux/?demo`, bouton
  « Je suis intéressé(e) », carte `carte prochaine` du catalogue). Page `catalogue/etat-des-lieux/`, captures
  `assets/templates-etat-des-lieux-*.webp`, couverture `assets/templates-etat-des-lieux-couverture.png`, tests
  `outils/templates/etat-des-lieux.test.mjs`. Produit `ETD` déclaré (serveur, connexion, en-têtes Netlify) ; `ETD`
  passé de `PREVUS` à `TEMPLATES` dans `outils/packs/donnees.mjs` (et retiré des `prevus` du pack PPB).
- Communication prête dans `communication/etat-des-lieux/` (linkedin.md, instagram.md et carrousel PNG,
  prospects.md, gumroad.md et gumroad.json, section-site.html en version « en vente », couverture.txt, carte
  d'accueil FR, carte anglaise `carte-en-prochaine.html` non insérée : version anglaise en attente). **Pas de fiche
  Gumroad, pas de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à
  confirmer, fiche Gumroad et clé de licence (Quentin), entrée dans `communication/gumroad-a-creer.json`, ajout de
  `ETD` aux `produits` du pack PPB (`netlify/lib/packs.mjs`) et régénération des pages de packs, carte anglaise,
  plannings, passage en vente du site.

## Fiche T97 (cadrage délégué par Quentin, 14/11/2026)

### T97 · Plan d'entraînement course à pied (`templates/course-a-pied/`, préfixe CRS, 15 €)
- Fiche détaillée : [`fiches/course-a-pied.md`](fiches/course-a-pied.md). Catalogue `perso` · thème « Santé et forme » ;
  pack visé « Forme » (PFM). Permalien prévu `plan-entrainement-course-a-pied`.
- Promesse : « Tes allures et tes semaines, jusqu'au jour J. » Public : coureurs amateurs qui préparent un 10 km, un
  semi-marathon ou un marathon.
- Chrono de référence (le plus récent l'emporte), objectif (distance, date, temps visé facultatif, nom), disponibilité
  (3 à 5 séances, jours, jour de la sortie longue, volume). Allures en fourchettes (récupération, footing, sortie
  longue, seuil, fractionné, spécifique) depuis les allures prédites ; prédiction par la **formule de Riegel**
  (Riegel P. S., American Scientist, vol. 69, n° 3, 1981, p. 285-290, référence vérifiée le 14/11/2026), exposant
  réglable ; fourchettes = **repères QME présentés comme des estimations**. Avis sur le temps visé, avertissements
  (chrono ancien, extrapolation lointaine).
- Plans types originaux : 8 semaines (10 km), 12 (semi), 16 (marathon), 46 séances rédigées pour QME, progression puis
  affûtage, semaines d'assimilation ; placement sur les jours choisis ; plan raccourci si la course est proche (3
  semaines au moins). Séances cochées (distance, durée, ressenti, note) ou manquées, déplacement dans la semaine avec
  avertissements, semaine allégée (proposée après 3 séances dures sur 4 ou 2 manquées en 7 jours), recalcul des
  séances à venir, volume hebdomadaire prévu et fait (graphique, skill `dataviz`), impression, exports CSV et .ics.
- **Aucune donnée de santé** ; avertissement (ni programme médical ni avis médical, avis d'un médecin avant de
  commencer) ; aucune marque, méthode ni plan commercial (test automatique) ; aucune règle d'inscription aux courses
  intégrée (renvoi à l'organisateur).
- Statut : **prêt** le 14/11/2026, « Mise en vente prochaine » (démo `/templates/course-a-pied/?demo`, page
  `catalogue/course-a-pied/`, captures `assets/templates-course-a-pied-*.webp`, couverture
  `assets/templates-course-a-pied-couverture.png`, tests `outils/templates/course-a-pied.test.mjs`). Version anglaise en
  attente.
- Communication prête dans `communication/course-a-pied/` (linkedin.md, instagram.md et carrousel PNG, prospects.md,
  gumroad.md et gumroad.json, section-site.html, couverture.txt, carte-prochaine.html). **Pas de fiche Gumroad, pas
  de ligne aux plannings LinkedIn et Instagram** (mission sans ces outils). Restent : nom et prix à confirmer, fiche
  Gumroad et clé de licence, entrée dans `communication/gumroad-a-creer.json`, ajout de CRS au pack PFM
  (`netlify/lib/packs.mjs`, pages des packs régénérées ; CRS retiré des prévus dans `outils/packs/donnees.mjs`, et la
  phrase « Le plan de course à pied à venir » des arguments de PFM à revoir), carte anglaise, plannings, passage en
  vente.

## Fiche T98 (idée de Quentin, 17/11/2026)

### T98 · Vivre sans voiture (`templates/sans-voiture/`, préfixe SVT, 9 €)
- Fiche détaillée : [`fiches/sans-voiture.md`](fiches/sans-voiture.md). Permalien prévu
  `simulateur-vivre-sans-voiture`. Prix de **9 €** demandé explicitement par Quentin le 17/11/2026, en dérogation
  à la règle du prix minimum de 12 € (13/11/2026). **Pack Ma voiture (PVT), décision de Quentin du 17/11/2026.**
- Promesse : « Ta voiture te coûte combien, vraiment ? Et sans elle, tu gagnes combien ? » Public : particuliers et
  familles qui envisagent de vendre leur voiture et de vivre avec le vélo, les transports, le train et une
  location de temps en temps.
- Questionnaire qui n'ouvre que les champs utiles : vélo (électrique ou non, déjà utilisé, équipement enfant et
  courses), transports en commun (abonnement, part employeur, tickets, enfants), travail, école, santé, usages
  actuels de la voiture, entourage.
- Tout est saisi et paramétrable : voiture (mode de détention achat, crédit, LOA ou LLD, perte de valeur,
  assurance, entretien, carburant en € par an ou km × consommation × prix, stationnement, péages), sortie (vente,
  rachat anticipé de LOA au barème saisi, restitution, indemnité de LLD, délai avant sortie), remplacement
  (location à la journée et à la semaine, franchise, autopartage, taxis, train, livraisons, vélo, rehausseur),
  temps perdu facultatif, horizon.
- Résultat : **gain annuel ou perte** de se passer de voiture, gain mensuel, gain cumulé coût de sortie compris,
  meilleur moment de sortie, sensibilité (location + 30 %, jours de location en plus possibles), amortissement
  implicite d'une LOA, score de faisabilité avec verdict bloquant.
- **Urgences et parades mises en avant** : urgence médicale de nuit (15, 112), enfant malade à l'école, siège
  auto, panne ou vol du vélo, grève, retour tardif, météo, gros achats, vacances, disponibilité et caution des
  locations, siège vélo trop petit, bonus d'assurance, contrat en cours, évolution de la famille. Organisation
  proposée et phase de test avant de vendre.
- Origine : simulateur personnel de Quentin (17/11/2026) ; **seule la mécanique est reprise**, aucun montant,
  lieu, contrat, réseau ni marque. Aucune donnée datée intégrée (tarifs saisis). Argent : avertissement.
- Statut : **fiche** le 17/11/2026 ; **en cours** puis **prêt** le 17/11/2026 (skill `nouveau-template`, branche
  `claude/car-free-lifestyle-eval-n586ko`). Application `templates/sans-voiture/` (SVT dans `PRODUITS`, démo fictive),
  tests `outils/templates/sans-voiture.test.mjs` (15), page `catalogue/sans-voiture/` « Mise en vente prochaine »,
  cartes FR (Argent) et EN, connexion, fiche courte dans `outils/packs/donnees.mjs` (**aucun pack modifié**).
- Sources vérifiées le 17/11/2026 : numéros d'urgence (service-public.gouv.fr F33954 : 15, 17, 18, 112, 114 ;
  116 117 « ou 15 selon la région ») ; siège enfant jusqu'à 10 ans et dispense des taxis (code de la route R412-2,
  F628) ; **VTC : dispense non prévue par le texte, écrit « à vérifier »** ; casque à vélo avant 12 ans (F34169).
- Requête principale : « vivre sans voiture » (autocomplétion du 17/11/2026, ligne dans `docs/seo/mots-cles.md`).
- Communication : `communication/sans-voiture/` (`gumroad.md`, `gumroad.json`, `linkedin.md`, `instagram.md` +
  carrousel de 5 vues, `prospects.md`). Programmée le 17/11/2026 à la demande de Quentin : **LinkedIn LI-155** le
  24/11/2026 à 12:15 et **Instagram IG-151** (carrousel) le 25/11/2026 à 18:30. Fiche Gumroad : création du brouillon
  prévue le 18/11/2026 (quota Gumroad de 10 produits par jour atteint le 17/11).
- Pack Ma voiture (PVT), décision de Quentin du 17/11/2026. Le pack étant déjà en vente sur Gumroad (22 €, PR #145),
  SVT est **annoncé** (`prevus: ['SVT']` dans `outils/packs/donnees.mjs`, « À venir » sur la page du pack, inclus avec
  l'option Pack évolutif) mais **pas encore dans `produits`** : le contenu vendu et le prix ne changent pas avant la
  sortie de T98. Le générateur des packs accepte désormais un template existant annoncé hors de `produits`.
  **À la mise en vente de T98** (feu vert de Quentin) : SVT dans `produits` de PVT avec sa date dans `ajouts`
  (`netlify/lib/packs.mjs`), `prevus` vidé, pages régénérées, et prix du pack sur Gumroad passé à **28 €**
  (12 + 13 + 9 = 34 €, −15 % pour 3 templates, arrondi à l'euro inférieur), option évolutif **9 €** (25 % = 7 €,
  relevé au minimum de 9 €).
- Site publié le 17/11/2026 avec le feu vert de Quentin (fusion de la PR #146) : T98 en « Mise en vente prochaine »,
  démo libre.
- Décidé par Quentin le 17/11/2026 : accueil « dès 9 € » (PR #148). **En vente le 18/11/2026** (« publie tout ce qui a
  une clé ») : fiche Gumroad `1DfML3czjZu5bg95z3KuRg==` (/l/simulateur-vivre-sans-voiture), clé de licence vérifiée
  (`is_licensed` true), SVT dans `produits` du pack Ma voiture avec `ajouts: { SVT: '2026-11-18' }`, pack à 28 € (34 €,
  −15 %). Option Pack évolutif : 9 €, soit la version « Pack évolutif » à 37 € à régler par Quentin dans l'éditeur
  Gumroad (versions non modifiables par les outils).

## T99 · Liaison Mon Budget ↔ Gestion Dépenses Communes (idée de Quentin, 20/11/2026)

**Besoin** : chacun tient son budget privé (Mon Budget, T05) et partage les dépenses du foyer (Gestion Dépenses
Communes, T65). Aujourd'hui, la part de chacun dans le commun se recopie à la main dans le budget perso.

**Principe** :
- Dans Mon Budget, réglage « Lier à Gestion Dépenses Communes » : coller le code de partage du commun, choisir qui on
  est parmi les membres, et la catégorie qui reçoit la dépense (par défaut « Dépenses communes »).
- Chaque mois, Mon Budget lit le commun **en lecture seule** et ajoute une opération « Ma part du commun » :
  mode avances = ma quote-part des dépenses du mois (pas ce que j'ai avancé) ; mode compte commun = mon versement du mois.
  Remboursements et virements d'équilibrage : à trancher (voir plus bas).
- La liaison est **à sens unique** : les autres membres du commun ne voient rien du budget perso, et le commun ne lit
  jamais Mon Budget.

**Confidentialité** : le code du commun est enregistré dans les données de Mon Budget ; qui a la clé de Mon Budget
peut donc ouvrir le commun (même personne en pratique, à écrire dans l'aide). Rien ne change pour le commun.

**Technique** : lecture du commun avec son propre code via `/api/templates/donnees` (aujourd'hui l'application refuse
le code d'un autre template, à ouvrir pour ce seul usage, en lecture) ; calcul par les règles existantes de
`templates/budget-commun/regles.js` (`quotesDepense`, `alimentation`) ; opération marquée « importée » (non modifiable,
remplacée à chaque mise à jour du mois, jamais en double).

**Questions pour Quentin** :
- Mode avances : compter ma quote-part (coût réel pour moi) ou les sommes réellement versées (avances et virements) ?
- Réservé aux acheteurs des deux templates (ou d'un pack qui les contient) ou ouvert à tout code de partage ?
- Mise à jour automatique à l'ouverture, ou bouton « Mettre à jour » ?

