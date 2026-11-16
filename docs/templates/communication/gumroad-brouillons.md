# Brouillons Gumroad (14/11/2026)

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
| TMP | suivi-temps | u-ySqLkS21aA1mhfeG9EFQ== | /l/suivi-temps-rentabilite | 19 € | clé à activer |
| DTT | dettes | -5-cTF1xpPORIx5P_zGn7w== | /l/remboursement-dettes | 12 € | clé à activer |
| TDV | temps-de-vie | sz94ceBG8cN4BLBpImKYxQ== | /l/temps-de-vie | 19 € | clé à activer |
| PTM | patrimoine | A8JdI_BV8_BHRmFHWK4r3A== | /l/inventaire-valorise | 19 € | clé à activer |
| EPG | epargne | sEO7sJxS14azsCZ761I-yQ== | /l/objectif-epargne | 12 € | clé à activer |
| DCS | papiers | uJxPWSYtiXp3nixYfudDoQ== | /l/papiers-du-foyer | 15 € | clé à activer |
| CPT | emprunt | -yAS1RKHFCUmacHWd-lOAw== | /l/capacite-emprunt-comparateur-prets | 15 € | clé à activer |

Prix identiques dans IDEES.md, la fiche et `outils/packs/donnees.mjs` (les pages catalogue affichent « Mise en
vente prochaine », sans prix). Écarts avec les `gumroad.json` : tag `finances-perso` au lieu de
`finances-personnelles` (TDV, EPG), `amortissement` au lieu de `tableau-amortissement` (CPT) ; catégorie
« Gigs & Side Projects » pour TMP et « Real Estate » pour CPT (plus proches que les fiches). Gumroad accentue
certains tags (« rentabilité », « dépenses », « économies », « épargne »).

**Limite Gumroad atteinte** au 8e : création refusée à 08 h 45 UTC, prochaine possible après le 16/11 à
02:41 PST (10 h 41 UTC, 11 h 41 à Paris). Restent à créer, dans l'ordre : VYG voyage (complète le Pack
Voyage), puis VTR leasing et CAR voiture (complètent le Pack Ma voiture). RBS remboursements-sante sauté
(point **bloquant** de `QUESTIONS.md` : données de santé).
