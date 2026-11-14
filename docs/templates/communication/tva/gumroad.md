# Fiche Gumroad · Suivi de TVA

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Prix prévu dans `IDEES.md` (19 €) : **nom et prix à confirmer par Quentin**.
**Aucun produit Gumroad n'a été créé.** La clé de licence est à activer à la main dans l'éditeur Gumroad
(Content → Insert → License key, sans multi-postes), puis l'identifiant produit reporté dans `PRODUITS`.

- **Produit interne** : `TVA` (préfixe des codes), application `https://qm-engineering.fr/templates/tva/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-tva-couverture.png` (1280 × 720, générée avec les 3 lignes de
  `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir mon suivi de TVA »
- **Catégorie** : `business-and-money` (**à vérifier** à la création)

## Nom

Suivi de TVA

## Prix

19 € (achat unique, au-dessus du minimum de 12 € fixé par Quentin)

## Permalien

`suivi-tva` (à confirmer à la création)

## Résumé (une phrase)

Ventes, achats, frais et immobilisations saisis en HT ou TTC, la TVA collectée et déductible de chaque période, ce qui reste à payer ou le crédit reporté, l'échéancier de tes déclarations et les contrôles avant de déclarer.

## Description (HTML)

Identique au champ `description` de `gumroad.json` (titre « Ta TVA, période par période. », problème, six points
« Ce que tu obtiens », trois étapes « Comment ça marche », mention finale en italique). La mention finale est
**obligatoire** (mention fiscale de `IDEES.md`) :

> Outil d'aide au suivi de la TVA, pas un conseil fiscal : il ne remplace ni ton expert-comptable ni les
> déclarations officielles, et ne transmet rien à l'administration. Aucune connexion à l'espace professionnel des
> impôts, à une banque ou à un logiciel comptable. Taux et échéances par défaut vérifiés le 14/11/2026, sources
> affichées, tout est modifiable ; certaines règles du réel simplifié (réforme annoncée pour 2027) sont à vérifier.
> Non gérés : autoliquidation, TVA sur marge, prorata de déduction, opérations intracommunautaires, outre-mer.

## Tags (7)

1. tva
2. comptabilite
3. declaration-tva
4. petite-entreprise
5. artisan
6. gestion
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton suivi de TVA s'ouvre. Choisis ton régime et la date de début, puis saisis ou importe tes opérations : chaque période se calcule au fur et à mesure. Garde cet e-mail : la même clé fonctionne sur tous tes appareils. Outil d'aide au suivi, pas un conseil fiscal.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Petites sociétés et entrepreneurs au régime réel de TVA

## Données datées (à revoir chaque année)

Taux, périodicité des CA3, jour d'échéance, acomptes, dispense, date de la CA12 et fin annoncée du régime
simplifié : valeurs par défaut et sources dans `templates/tva/donnees.js` (vérifiées le 14/11/2026, voir
`docs/templates/fiches/tva.md`). Si une valeur change, mettre à jour `donnees.js` (et `verifieLe`), la FAQ de la
page catalogue et cette description.
