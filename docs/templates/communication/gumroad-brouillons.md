# Brouillons Gumroad (14/11/2026)

> **Priorité de la file Gumroad** : voir `gumroad-priorite.md` (liste unique, Pack Étudiant en tête depuis le 16/11/2026).


**Mise à jour 14/11, 23 h 30** : les 8 produits créés sont publiés (en vente) et le site est passé à « en
vente » pour chacun. T12 et T68 restent à créer.

Choix de Quentin (13/11) : T08, T12, T14, T15, T24, T36, T42, T53, T67, T68. Brouillons **non publiés**.
Avant publication : Quentin active la clé de licence (Content → Insert → License key) ; puis appliquer
`reference.md` § « À chaque publication Gumroad ». Limite Gumroad : 10 créations par 24 h glissantes.

| N° | Slug | Préfixe | Identifiant Gumroad | Lien | Fiche remplie | Lien contenu + couverture |
|----|------|---------|---------------------|------|---------------|---------------------------|
| T08 | habitudes | HBT | DvjP1MxGl7bGDZiHfGgcfQ== | /l/suivi-habitudes | oui | fait |
| T14 | abonnements | ABN | 5wUF3mCVqbG3yAF-coM12A== | /l/suivi-abonnements | oui | fait |
| T15 | mariage | MRG | TmtmeDwq1OsE2Y9gL6rDag== | /l/organisateur-mariage | oui | fait |
| T36 | devis | DVS | RmzvzczQ7xnP2IP7yRfwBg== | /l/generateur-devis | oui | fait |
| T42 | tresorerie | TRS | no1AEwLFPlXydqFGU7vRzg== | /l/tresorerie-previsionnelle | oui | fait |
| T24 | visa | VSA | zJsheWedmR4QFEZA1e15mA== | /l/circuit-visa | oui | fait |
| T53 | inscriptions | ASC | 5XuVWuitD2ZzpVkwQFHlVw== | /l/inscriptions-associatives | oui | fait |
| T67 | travaux | TRV | leplToyYwMtXCmdXZa9T4Q== | /l/pilote-travaux | oui | fait |
| T12 | dettes | DTT | brouillon créé le 16/11/2026 (voir lot du 16/11), `-5-cTF1xpPORIx5P_zGn7w==`, clé à activer | | | |
| T68 | secret-santa | SNT | brouillon créé le 15/11/2026 (prix libre 0 €), `fCyii9wIVdIfFc1YQdbZzQ==`, clé de licence à activer | | | |

T24 visa : 2 couvertures (doublon à supprimer dans l'éditeur Gumroad).

Hors de ce choix, créés par d'autres sessions : « Dossier sinistre habitation », « Registre des non-conformités ».

## Lot du 14/11/2026, 22 h 30 UTC (choix de Quentin : les 8 à plus forte probabilité de vente)

Fiches créées et remplies (permalien, catégorie, résumé, tags, détails, reçu, bouton, lien vers
`/connexion/`, couverture). **Publication seulement quand `is_licensed` vaut `true`** (bloc License key
inséré par Quentin dans l'éditeur Gumroad).

| N° | Slug | Préfixe | Identifiant Gumroad | Lien | Clé de licence | Statut |
|----|------|---------|---------------------|------|----------------|--------|
| T80 | document-unique | DRP | KZHfWPckpGMOxeFYDPcrow== | /l/document-unique-evaluation-risques | oui | **publié**, site en vente |
| T43 | impayes | RCV | xbHURXS0w79P1ap-nFBbWQ== | /l/relance-impayes | oui | **publié**, site en vente |
| T32 | reserves | RSV | 1xyF3Lz36TxDCOz4KnVB4A== | /l/levee-reserves | oui | **publié**, site en vente |
| T94 | etat-des-lieux | ETD | eo2d-2oYp7KgqGwQQ_v4OA== | /l/etat-des-lieux | oui | **publié**, site en vente |
| T22 | tableau-annuel | RDV | XMvZIWF4YueA-fSR5lunEg== | /l/tableau-annuel-roue-de-vie | oui | **publié**, site en vente |
| T47 | planning-equipe | EQP | uGMwDvkv48r4plEy5vFJNQ== | /l/planning-equipe-staffing | oui | **publié**, site en vente |
| T28 | crm | CRM | OGiloE9iB6oIL0UuitwyBA== | /l/crm-freelance | oui | **publié**, site en vente |
| T95 | investissement-locatif | RNT | geVSrMzs3CshVaDi9IeCaQ== | /l/rentabilite-investissement-locatif | oui | **publié**, site en vente |

Écarts avec les `gumroad.json` (limites Gumroad : tag de 2 à 20 caractères, bouton de 26 caractères au plus) :
tags `evaluation-risques` (T80), `developpement-perso` (T22), `invest-locatif` (T95) ; bouton du reçu de T47
« Ouvrir mon planning ». T12 et T68 restent à créer.

## Lot du 16/11/2026, 08 h 45 UTC (demande de Quentin : « les 10 prochains produits, pour que je mette les clés »)

Brouillons **non publiés**, fiches remplies (permalien, résumé, catégorie, tags, détails, reçu, bouton, lien
vers `/connexion/`, couverture). Identifiants **non ajoutés** à `PRODUITS` (`netlify/lib/templates-acces.mjs`) :
l'ajout ferait passer le template « en vente » sur le site avant la publication. À faire pour chacun : activer
la clé de licence (Content → Insert → License key), publier, puis appliquer `reference.md` § « À chaque
publication Gumroad » (dont l'ajout de `gumroad: '<id>'` dans `PRODUITS`).

| Préfixe | Slug | Identifiant Gumroad | Permalien | Prix | Statut |
|---------|------|---------------------|-----------|------|--------|
| TMP | suivi-temps | u-ySqLkS21aA1mhfeG9EFQ== | /l/suivi-temps-rentabilite | 19 € | **en vente** (publié le 16/11/2026) |
| DTT | dettes | -5-cTF1xpPORIx5P_zGn7w== | /l/remboursement-dettes | 12 € | **en vente** (publié le 16/11/2026) |
| TDV | temps-de-vie | sz94ceBG8cN4BLBpImKYxQ== | /l/temps-de-vie | 19 € | **en vente** (publié le 16/11/2026) |
| PTM | patrimoine | A8JdI_BV8_BHRmFHWK4r3A== | /l/inventaire-valorise | 19 € | **en vente** (publié le 16/11/2026) |
| EPG | epargne | sEO7sJxS14azsCZ761I-yQ== | /l/objectif-epargne | 12 € | **en vente** (publié le 16/11/2026) |
| DCS | papiers | uJxPWSYtiXp3nixYfudDoQ== | /l/papiers-du-foyer | 15 € | clé non détectée le 16/11 (`is_licensed` false) |
| CPT | emprunt | -yAS1RKHFCUmacHWd-lOAw== | /l/capacite-emprunt-comparateur-prets | 15 € | clé non détectée le 16/11 (`is_licensed` false) |

Prix identiques dans IDEES.md, la fiche et `outils/packs/donnees.mjs` (les pages catalogue affichent « Mise en
vente prochaine », sans prix). Écarts avec les `gumroad.json` : tag `finances-perso` au lieu de
`finances-personnelles` (TDV, EPG), `amortissement` au lieu de `tableau-amortissement` (CPT) ; catégorie
« Gigs & Side Projects » pour TMP et « Real Estate » pour CPT (plus proches que les fiches). Gumroad accentue
certains tags (« rentabilité », « dépenses », « économies », « épargne »).

**Limite Gumroad atteinte** au 8e : création refusée à 08 h 45 UTC, prochaine possible après le 16/11 à
02:41 PST (10 h 41 UTC, 11 h 41 à Paris). Restent à créer, dans l'ordre : VYG voyage (complète le Pack
Voyage), puis VTR leasing et CAR voiture (complètent le Pack Ma voiture). RBS remboursements-sante sauté
(point **bloquant** de `QUESTIONS.md` : données de santé).

## Lot du 17/11/2026, 07 h 47 UTC (file `gumroad-priorite.md`, Pack Étudiant en tête)

Brouillons **non publiés**, fiches remplies (permalien, résumé, catégorie, tags, détails, reçu, bouton, lien
vers `/connexion/`, couverture). Identifiants **non ajoutés** à `PRODUITS`.

| Préfixe | Slug | Identifiant Gumroad | Permalien | Prix | Statut |
|---------|------|---------------------|-----------|------|--------|
| PHR | planner | 6uyeEBR91feI1tM2Wbij8Q== | /l/planner-horaire | 15 € | **en vente** (clé activée et publié le 17/11/2026, 08 h 00 UTC) |
| PGS | lecture | cfXnYcVohgvMwrn0ONglsQ== | /l/suivi-lecture | 12 € | **en vente** (clé activée et publié le 17/11/2026) |
| NTS | notes | mfJW49fm4F0bQ7rUSdY8Kw== | /l/notes-moyennes | 12 € | **en vente** (clé activée et publié le 17/11/2026) |
| CAN | candidatures | 3hYVauouIDMw3cQ-RA5gCQ== | /l/candidatures-etudes-stages-alternance | 12 € | **en vente** (clé activée et publié le 17/11/2026) |
| MMR | memoire | -JA7LGCBFecmAERfqUDnZQ== | /l/planning-memoire | 15 € | **en vente** (clé activée et publié le 17/11/2026) |
| CAR | voiture | -cFP8vq3TQIStzfF1gSA-w== | /l/carnet-voiture | 13 € | **en vente** (clé activée et publié le 17/11/2026) |

Catégorie « Self Improvement » (la fiche `planner/gumroad.md` n'en donne pas) ; détail « Pour » ajouté :
étudiants, cadres, freelances. **Limite Gumroad atteinte** à la 2e création : prochaine possible le 17/11 à
00:15 PST (09:15 à Paris). Reprise à 09:16 : PGS, NTS, CAN, MMR et CAR créés (08 h 16-08 h 22 UTC). Boutons du reçu
raccourcis à 26 caractères au plus (limite Gumroad) : « Ouvrir mon suivi » (PGS), « Ouvrir mon carnet » (CAR).
Nouvelle limite atteinte sur la fiche du Pack Freelance : prochaine création à 09:38 (Paris), reprise programmée
pour PFG puis PVY.

### Fiches de packs du 17/11/2026, 08 h 40 UTC

Brouillons **non publiés** ; identifiants **non ajoutés** à `PACKS`. Avant publication : clé de licence **et**
versions « Pack » et « Pack évolutif » (prix ci-dessous), à ajouter par Quentin.

| Code | Pack | Identifiant Gumroad | Permalien | Pack | Pack évolutif | Statut |
|------|------|---------------------|-----------|------|---------------|--------|
| PET | Pack Étudiant | YtS6AIhqXdCedt-AqQtjmw== | /l/pack-etudiant | 69 € | 87 € | **en vente** (clé, versions et publication le 17/11/2026) |
| PFG | Pack Freelance : chiffrer, facturer, encaisser | TdGXvyeaHjN_iKZ4zHr9gw== | /l/pack-freelance-gestion | 118 € | 148 € | **en vente** (clé, versions et publication le 17/11/2026) |

| PVY | Pack Voyage | Kwfo3TDSuJWfngx4ZTJ4xQ== | /l/pack-voyage | 25 € | 34 € | **en vente** (clé, versions et publication le 17/11/2026) |
| PVT | Pack Ma voiture | nVivzNvD6qcdSi5wf1UqXQ== | /l/pack-voiture | 22 € | 31 € | **en vente** (clé, versions et publication le 17/11/2026) |

PVY et PVT créés à 10 h 54 UTC. **Limite Gumroad atteinte** sur Stocks et inventaire (STK) : prochaine création
le 17/11 à 23:48 PST (18/11 à 08:48, Paris). Reprise programmée le 18/11 à 08:50 : STK, TVA (publication après
accord de Quentin sur les valeurs « à vérifier », `QUESTIONS.md` § T44), CMP, RPS, MSC.

## Lot du 18/11/2026

| Préfixe | Slug | Identifiant Gumroad | Permalien | Prix | Statut |
|---------|------|---------------------|-----------|------|--------|
| STK | stocks | 4yl9UwCwQPGWahkhI0oJUA== | /l/stocks-inventaire | 25 € | **en vente** (créé à 07 h 51 UTC, clé activée et publié le 18/11/2026) |

Suivi de TVA refusé à 07 h 51 UTC (limite Gumroad) : prochaine création à 09:17 (Paris), reprise programmée à 09:18
pour TVA, CMP, RPS, MSC.

Reprise du 18/11/2026 (session « Sans voiture à Tassin », demande de Quentin « publie tout ce qui a une clé ») :

| Préfixe | Slug | Identifiant Gumroad | Permalien | Prix | Statut |
|---------|------|---------------------|-----------|------|--------|
| SVT | sans-voiture | 1DfML3czjZu5bg95z3KuRg== | /l/simulateur-vivre-sans-voiture | 9 € | **en vente** (clé vérifiée, publié le 18/11/2026) ; pack Ma voiture passé à 28 € |
| TVA | tva | aGMrUCFVZ9yzLWfaNIWQ1w== | /l/suivi-tva | 19 € | **en vente** (clé vérifiée, publié le 18/11/2026) ; tags « gestión » et « comptabilité » : Gumroad garde les accents malgré la mise à jour (à corriger dans l'éditeur) |
| CMP | competition | 1evFhHOrqZyrgIdg9T483A== | /l/odhsh | 49 € | brouillon **non publié** : clé active mais fiche inachevée (ni couverture, ni résumé, ni catégorie, ni tags, ni reçu, permalien par défaut) |

Doublon `Xw7qeUhC65CrQW-X8XjqVQ==` (« DOUBLON À SUPPRIMER – Vivre sans voiture », /l/wdipoh) créé par erreur le 18/11 :
absent de la liste des produits à 09 h 40, supprimé par Quentin.

### Suite du 18/11/2026

| Préfixe | Slug | Identifiant Gumroad | Permalien | Prix | Statut |
|---------|------|---------------------|-----------|------|--------|
| TVA | tva | aGMrUCFVZ9yzLWfaNIWQ1w== | /l/suivi-tva | 19 € | **en vente** (créé ici, publié et mis en vente par une autre session, PR #157) |
| CMP | competition | 1evFhHOrqZyrgIdg9T483A== | /l/gestion-competition | 49 € | **en vente** (18/11/2026) |
| RPS | repas | EnpmgktOylLJZJST9_Tfhg== | /l/repas-liste-de-courses | 13 € | **en vente** (18/11/2026) |
| MSC | musculation | 1T1zE6319ZF9qexKr8Kzzw== | /l/carnet-musculation-cross-training | 19 € | clé à activer (https://gumroad.com/products/ttzjjr/edit) |
| APD | appel-decouverte | NOhwt805chMWKwJGEDhgJQ== | /l/pjimd (permalien à poser : preparateur-appel-decouverte) | 12 € | fiche à compléter (update_product interrompu), clé à activer (https://gumroad.com/products/pjimd/edit) |

Hors de cette session : deux brouillons « Vivre sans voiture » créés le 18/11 par une autre session ; l'un est publié
(`1DfML3czjZu5bg95z3KuRg==`), l'autre a disparu. Pack Ma voiture passé à 28 € (3 templates) sur Gumroad.
