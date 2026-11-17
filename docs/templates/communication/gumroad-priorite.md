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
| **2** | **Suivi de lecture** | PGS | lecture | 12 € | Brouillon créé le 17/11, clé à activer |
| **3** | **Notes et moyennes** | NTS | notes | 12 € | Brouillon créé le 17/11, clé à activer |
| **4** | **Candidatures études, stages, alternance** | CAN | candidatures | 12 € | Brouillon créé le 17/11, clé à activer |
| **5** | **Planning de mémoire ou de thèse** | MMR | memoire | 15 € | Brouillon créé le 17/11, clé à activer |
| **6** | **Fiche du Pack Étudiant** | PET | etudiant | 69 € | Dès que ses 7 templates sont en vente |
| 7 | Carnet de voiture | CAR | voiture | 13 € | Brouillon créé le 17/11, clé à activer |
| 8 | Fiche du Pack Freelance : chiffrer, facturer, encaisser | PFG | freelance-gestion | 118 € | 7 templates en vente depuis le 16/11 |
| 9 | Fiche du Pack Voyage | PVY | voyage | 25 € | 2 templates en vente depuis le 16/11 |
| 10 | Fiche du Pack Ma voiture | PVT | voiture | 22 € | Après le Carnet de voiture |
| 11 | Stocks et inventaire, puis Suivi de TVA | STK, TVA | stocks, tva | 25 €, 19 € | Pack Commerçant et artisan |
| 12 | Compétition | CMP | competition | 49 € | |
| 13 | Repas de la semaine, puis Carnet de musculation | RPS, MSC | repas, musculation | 13 €, 19 € | Pack Forme |
| 14 | Les autres templates « prêt » | | | | Dans l'ordre des packs de `packs/gumroad-packs.json`, puis P1, P2, P3 d'`IDEES.md` |

Les prix sont ceux de `outils/packs/donnees.mjs` (et d'`IDEES.md`) ; les fiches sont dans
`docs/templates/communication/<slug>/gumroad.json` ou `gumroad.md`, et celles des packs dans
`packs/gumroad-packs.json`.

## Déjà fait (16/11/2026)

Publiés et en vente : Secret Santa, Pack Argent du quotidien, Pack Bien démarrer l'année, Suivi du temps,
Remboursement de dettes, Temps de vie, Inventaire valorisé, Objectif d'épargne, Papiers du foyer, Capacité
d'emprunt, Planificateur de voyage, Simulateur leasing ou achat (38 templates en vente). Prochaine création
possible : 17/11 à 08:39 (Paris).

17/11 : **Planner horaire publié et en vente** (39 templates en vente) ; brouillons PGS, NTS, CAN, MMR, CAR créés ;
fiches PFG et PVY en attente de la limite (prochaine création possible le 17/11 à 09:38, Paris).

Mettre ce tableau à jour à chaque création ou publication (déplacer la ligne dans « Déjà fait »).
