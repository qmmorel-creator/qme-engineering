# Priorité de la file Gumroad

**Liste unique et à jour**, à lire par toute session ou tâche planifiée qui crée des produits sur Gumroad (point
d'étape quotidien, session de pilotage stratégique, lots de templates). Elle remplace toute liste de priorité
écrite ailleurs (consignes d'une tâche planifiée comprises). Décision de Quentin du 16/11/2026. Non publié
(`/docs/*` en 404).

## Qui gère la file (16/11/2026)

- **Une seule session** : la session de pilotage stratégique QME (claude.ai/code, session_0183EW51qk2gGvogKDTrV6Qz),
  par la tâche planifiée « File Gumroad quotidienne QME », **chaque jour à 8 h 45** (Paris) : publication des
  brouillons dont la clé est active, mise en vente sur le site, création des brouillons suivants, insertion des
  publications en attente dans les plannings, compte rendu à Quentin. L'ancienne routine « Point d'étape quotidien
  templates » (23 h 47) est supprimée par Quentin.
- **Feu vert permanent de Quentin (16/11/2026)** pour fusionner dans `main` les PR **de mise en vente** :
  identifiants Gumroad dans `PRODUITS` ou `PACKS`, pages catalogue passées en vente, packs et JSON-LD régénérés,
  registres. Toute autre fusion reste soumise à son accord (CLAUDE.md).
- Reste à Quentin : activer la clé de licence de chaque brouillon, et ajouter les versions « Pack » et
  « Pack évolutif » de chaque pack.

## Règles

1. `list_products` d'abord (toutes les pages, brouillons compris) : ne jamais recréer un produit du même nom.
2. Limite Gumroad : **10 créations par 24 h glissantes**, pour tout le compte. À la première création refusée,
   s'arrêter et noter l'heure annoncée.
3. Un brouillon n'est **jamais** publié avant que Quentin ait activé sa clé de licence (`is_licensed` à true sur
   `https://qmengineering.gumroad.com/l/<permalien>`) ; un pack attend aussi ses deux versions (« Pack » et
   « Pack évolutif »).
4. L'identifiant Gumroad n'entre dans `PRODUITS` (ou `PACKS`) **qu'à la publication** : avant, il ferait passer
   le template « en vente » sur le site. Les brouillons sont notés dans `gumroad-brouillons.md`.
5. Un pack n'est créé que lorsque tous ses templates sont en vente.
6. Les templates « Bloquant » dans `docs/templates/QUESTIONS.md` (T19 bébé, T55 gestion de classe, T84
   remboursements santé) passent en dernier, et seulement après la décision de Quentin.
7. À la publication : `publish_product`, `gumroad` dans `PRODUITS`, `python3 outils/templates/mettre-en-vente.py
   "slug:prix:permalien:Txx"`, meta description de la page catalogue ≤ 160 caractères, `node outils/packs/generer.mjs`,
   `node outils/seo/donnees-structurees.mjs`, `npm test`, PR, vérification en ligne.

## Ordre (revu le 22/11/2026, demande de Quentin)

Critère : finir les packs. Chaque création débloque le plus de chiffre d'affaires possible (une fiche de pack complet,
puis les templates qui manquent à un pack). Rappel de la règle 5 : une fiche de pack n'est créée que lorsque tous ses
templates sont en vente.

**Études** (vérifié le 22/11 contre la boutique) : le Pack Étudiant (PET) est complet et en vente, ainsi que les
5 outils budget proposés à Odélia (BDG, ABN, BCM, EPG, RPS). Rien à créer pour ce partenariat. Le seul pack du
domaine éducation incomplet est le Pack Enseignant et formateur (PNS), bloqué par T55 (voir plus bas).

### Vague du 22/11 : 10 brouillons créés (détail dans `gumroad-brouillons.md`)

| Rang | Produit | Code | Prix | Débloque |
|---|---|---|---|---|
| 1 | Fiche du Pack Petite entreprise | PPE | 164 € (évolutif 205 €) | pack complet (9/9 en vente) |
| 2 | Fiche du Pack Commerçant et artisan | PCA | 95 € (évolutif 119 €) | pack complet (5/5 en vente) |
| 3 | Revue hebdomadaire | RVH | 12 € | dernier template du Pack Productivité perso (PPR) |
| 4 | Plan d'entraînement course à pied | CRS | 15 € | dernier template du Pack Forme (PFM) |
| 5 | Déménagement | DMN | 12 € | Pack Mariage et installation (PMR) |
| 6 | Cadeaux reçus et remerciements | CDX | 12 € | dernier template du Pack Mariage et installation (PMR) |
| 7 | Contrats fournisseurs | CTR | 25 € | packs Exploitation (PXP) et Moyens généraux (PMG) |
| 8 | Pilotage de parcs multi-sites | PRK | 49 € | dernier template du Pack Exploitation et maintenance (PXP) |
| 9 | Pilotage d'une journée de bascule | BSC | 29 € | Pack Moyens généraux (PMG) |
| 10 | Demandes d'achat et fournitures | ACH | 19 € | dernier template du Pack Moyens généraux (PMG) |

À faire par Quentin : clé de licence des 10, versions « Pack » et « Pack évolutif » de PPE et PCA. Puis publication
et mise en vente (règle 7).

### Vague suivante (dès que la limite le permet et que la vague du 22/11 est publiée)

| Rang | Produit | Code | Prix | Pourquoi |
|---|---|---|---|---|
| 11 | Fiche du Pack Productivité perso | PPR | 54 € | complet une fois RVH en vente |
| 12 | Fiche du Pack Forme | PFM | 58 € | complet une fois CRS en vente |
| 13 | Fiche du Pack Mariage et installation à deux | PMR | 72 € | complet une fois DMN et CDX en vente |
| 14 | Fiche du Pack Exploitation et maintenance | PXP | 118 € | complet une fois CTR et PRK en vente |
| 15 | Fiche du Pack Moyens généraux | PMG | 194 € | complet une fois CTR, BSC et ACH en vente |
| 16 | Garde-manger et dates de péremption | GRD | 12 € | dernier template manquant du Pack Cuisine (PCS) ; sert aussi au Pack Famille |
| 17 | Fiche du Pack Cuisine (demande de Quentin, 22/11) | PCS | 22 € (évolutif 9 €) | complet une fois GRD en vente (RPS déjà en vente) |
| 18 | Location saisonnière, Entretien de la maison, Gestion locative, Copropriété | SJR, ENT, GST, CPR | 25, 12, 20, 15 € | Pack Propriétaire (PPB) ; ENT sert aussi au Pack Famille |
| 19 | Fiche du Pack Propriétaire | PPB | 131 € | après le rang 18 |
| 20 | Pilote événementiel, Subventions, Bénévoles, Assemblée générale | EVT, SBV, BNV, AGS | 49, 25, 19, 19 € | Pack Associations et clubs (PAS) |
| 21 | Fiche du Pack Associations et clubs | PAS | 164 € | après le rang 20 |
| 22 | Progression pédagogique, Banque de questions et quiz, Emploi du temps d'établissement | PRG, QZZ, EDT | 15, 19, 45 € | Pack Enseignant (PNS), vendus seuls en attendant T55 |
| 23 | Suivi d'un animal | ANM | 12 € | Pack Famille (PFA), qui attend aussi T19 |
| 24 | Hors pack : Compétences, Potager, Auto-école, Séminaire | FRM, PTG, AEC, SMN | 25, 13, 45, 35 € | aucun pack à finir |

**Pack Cuisine (PCS, décision de Quentin du 22/11/2026)** : Repas de la semaine et liste de courses (RPS, 13 €, en
vente) + Garde-manger et dates de péremption (GRD, 12 €, prêt). Valeur 25 €, remise 10 %, prix 22 €, option évolutif
9 € (minimum). Accroche proposée : « Le menu de la semaine, la liste de courses, et rien ne se perd au frigo. » Avant la
fiche Gumroad : ajouter `PCS` à `PACKS` (`netlify/lib/packs.mjs`), ses textes et sa cible dans `outils/packs/donnees.mjs`,
régénérer les pages (`node outils/packs/generer.mjs`) et sa fiche dans `packs/gumroad-packs.json`.

**Bloqués par une décision de Quentin** (règle 6) : Remboursements santé (RBS, seul manquant du Pack Reprendre la main
sur son argent, PAR), Suivi du bébé (BBE, Pack Famille), Gestion de classe (CSE, Pack Enseignant).

Les prix sont ceux de `outils/packs/donnees.mjs` (et d'`IDEES.md`) ; les fiches sont dans
`docs/templates/communication/<slug>/gumroad.json` ou `gumroad.md`, et celles des packs dans
`packs/gumroad-packs.json`.

## Déjà fait (16/11/2026)

Publiés et en vente : Secret Santa, Pack Argent du quotidien, Pack Bien démarrer l'année, Suivi du temps,
Remboursement de dettes, Temps de vie, Inventaire valorisé, Objectif d'épargne, Papiers du foyer, Capacité
d'emprunt, Planificateur de voyage, Simulateur leasing ou achat (38 templates en vente). Prochaine création
possible : 17/11 à 08:39 (Paris).

17/11 : **Planner horaire publié et en vente** (39 templates en vente) ; PGS, NTS, CAN, MMR, CAR publiés et en vente (44 templates en vente) ;
Pack Étudiant et Pack Freelance publiés et en vente ; Pack Voyage et Pack Ma voiture publiés et en vente ; limite atteinte, prochaine création le 18/11 à 08:48 (Paris).

18/11 : STK, TVA, CMP, RPS, MSC et APD (rang 14, Pack Freelance : trouver ses clients) en vente.

19/11 : rang 14, Pack Freelance « trouver ses clients » (PRS, PCM, KRF, CED, CND), Pack Chef de projet BTP (CHT, RDE, STR),
CNG et NDF en vente ; fiches des packs PFC et PBT à créer.

20/11 : Pack Freelance « trouver ses clients », Pack Chef de projet BTP, ARD, TDB, ENP en vente.

22/11 : Pack Budget perso et famille publié et en vente. Vague de 10 brouillons créée vers 12 h 45 (Paris) :
PPE, PCA, RVH, CRS, DMN, CDX, CTR, PRK, BSC, ACH ; prochaine création possible le 23/11 après 13 h (Paris).

Mettre ce tableau à jour à chaque création ou publication (déplacer la ligne dans « Déjà fait »).
