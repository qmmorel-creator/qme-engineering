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

## Ordre

| Rang | Produit | Code | Slug | Prix | Pourquoi |
|---|---|---|---|---|---|
| **2** | **Suivi de lecture** | PGS | lecture | 12 € | **En vente depuis le 17/11** |
| **3** | **Notes et moyennes** | NTS | notes | 12 € | **En vente depuis le 17/11** |
| **4** | **Candidatures études, stages, alternance** | CAN | candidatures | 12 € | **En vente depuis le 17/11** |
| **5** | **Planning de mémoire ou de thèse** | MMR | memoire | 15 € | **En vente depuis le 17/11** |
| **6** | **Fiche du Pack Étudiant** | PET | etudiant | 69 € | **En vente depuis le 17/11** |
| 7 | Carnet de voiture | CAR | voiture | 13 € | **En vente depuis le 17/11** |
| 8 | Fiche du Pack Freelance : chiffrer, facturer, encaisser | PFG | freelance-gestion | 118 € | **En vente depuis le 17/11** |
| 9 | Fiche du Pack Voyage | PVY | voyage | 25 € | **En vente depuis le 17/11** |
| 10 | Fiche du Pack Ma voiture | PVT | voiture | 22 € | **En vente depuis le 17/11** |
| 11 | Stocks et inventaire, puis Suivi de TVA | STK, TVA | stocks, tva | 25 €, 19 € | STK et TVA **en vente depuis le 18/11** |
| 12 | Compétition | CMP | competition | 49 € | **En vente depuis le 18/11** |
| 13 | Repas de la semaine, puis Carnet de musculation | RPS, MSC | repas, musculation | 13 €, 19 € | RPS et MSC **en vente depuis le 18/11** |
| **1** | **Fiche du Pack Budget perso et famille** (demande de Quentin, 20/11) | PBF | budget-perso-famille | 47 € (évolutif 59 €) | **Brouillon créé le 21/11** (`FbVA2eJXNqKeGcjM5sA1aQ==`, voir `gumroad-brouillons.md`) : reste la clé de licence et les deux versions (Quentin), puis publication |
| 14 | Les autres templates « prêt » | | | | Dans l'ordre des packs de `packs/gumroad-packs.json`, puis P1, P2, P3 d'`IDEES.md` |

### Pack Budget perso et famille (PBF) : réglages de la fiche

- Nom « Pack Budget perso et famille », 47 €, permalien `pack-budget-perso-famille`, catégorie
  `business-and-money/personal-finance`.
- Description : celle de `packs/gumroad-packs.json` (code PBF), avec ce paragraphe ajouté avant « Après l'achat » :
  « **Votre budget perso reste privé :** pour partager le budget commun avec votre foyer, vous envoyez son code de
  partage, qui n'ouvre que lui. La clé du pack reste pour vous. »
- Résumé : « Votre budget et celui de la famille, enfin d'équerre : budget du foyer, budget commun, abonnements,
  épargne et dettes, 47 € au lieu de 63 €. »
- Tags : budget, pack, francais, famille, couple, économies, épargne, finances-perso.
- Détails : Contenu « 5 templates : Mon Budget, Gestion Dépenses Communes, Suivi des abonnements, Objectif d'épargne,
  Remboursement de dettes » ; Format « Applications web (ordinateur, tablette, téléphone) » ; Accès « Une clé de
  licence pour les 5 » ; Paiement « Achat unique, sans abonnement » ; Langue « Français ».
- Reçu : celui du Pack Argent du quotidien, « 4 templates » remplacé par « 5 templates », plus la ligne
  « 🔒 Pour partager le budget commun, envoie son code de partage (onglet Foyer), jamais la clé du pack. » ;
  bouton « Ouvrir mon pack » ; lien de contenu `https://qm-engineering.fr/connexion/` (« Ouvrir mon pack »).
- Puis Quentin : clé de licence et versions « Pack » (47 €) et « Pack évolutif » (59 €) ; à la publication,
  `gumroad` et `permalien` dans `PACKS.PBF` (`netlify/lib/packs.mjs`), `node outils/packs/generer.mjs`, tests, PR.

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

Mettre ce tableau à jour à chaque création ou publication (déplacer la ligne dans « Déjà fait »).
