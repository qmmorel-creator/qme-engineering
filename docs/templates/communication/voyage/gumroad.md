# Fiche Gumroad · Planificateur de voyage

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json` (même contenu, prêt pour la création groupée). Prix prévu : 13 € (ligne T21 de
`IDEES.md`, au-dessus du minimum de 12 €). **Aucun produit Gumroad n'a été créé** (consigne de la mission).
La clé de licence est à activer à la main dans l'éditeur Gumroad (Content → Insert → License key, sans
multi-postes), puis l'identifiant produit reporté dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, ligne
`VYG`). La fiche n'a pas été ajoutée à `../gumroad-a-creer.json` (fichier partagé) : à y reporter au moment
de la création groupée.

- **Produit interne** : `VYG` (préfixe des codes), application `https://qm-engineering.fr/templates/voyage/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-voyage-couverture.png` (1280 × 720, entrée `voyage` de
  `outils/templates/couvertures-gumroad.cjs`, 3 lignes dans `couverture.txt`), à téléverser une fois en ligne
- **Bouton** : « Ouvrir mon voyage »
- **Catégorie** : `self-improvement/productivity` (une catégorie « Voyage », si Gumroad en propose une, est à
  vérifier à la création)
- **Packs** : « Voyage » (PVY) et « Mariage et installation à deux » (PMR, lune de miel) ; l'ajout du
  préfixe `VYG` aux packs (`netlify/lib/packs.mjs`) et la régénération des pages `/packs/` sont faits à la
  fusion.

## Nom

Planificateur de voyage

## Prix

13 € (achat unique)

## Permalien

`planificateur-voyage` (à confirmer à la création)

## Résumé (une phrase)

L'itinéraire par étapes, le toit de chaque nuit, les activités jour par jour, le budget prévu et réel, et au retour, qui doit quoi à qui. Aucune réservation, aucune publicité.

## Description (HTML)

Voir `description` dans `gumroad.json` (texte identique). Points clés, dans l'ordre : itinéraire par
étapes ; un toit pour chaque nuit (réservé / à réserver, acompte, reste à payer, nuits sans toit
signalées) ; programme jour par jour et liste « à réserver » ; budget prévu et réel par poste et par
personne ; qui doit quoi (moteur du budget commun, remboursements minimaux) ; bagages et documents.
Mention finale : outil d'aide à l'organisation, ni agence ni conseil financier, aucune plateforme
connectée, montants en euros saisis par l'utilisateur, formalités renvoyées aux sources officielles.

## Tags

voyage, itineraire, budget, depenses-partagees, organisation, vacances, francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton
voyage s'ouvre. Indique les dates et les voyageurs, puis ajoute tes étapes. Garde cet e-mail : la même clé
fonctionne sur tous tes appareils, et tes compagnons de route peuvent l'utiliser aussi.

## Détails

| Champ | Valeur |
|---|---|
| Format | Application web (ordinateur, tablette, téléphone) |
| Accès | Clé de licence envoyée par e-mail |
| Langue | Français |
| Paiement | Achat unique, sans abonnement |
| Pour | Voyageurs, familles et groupes d'amis |

## À vérifier avant publication

- La phrase « tes compagnons de route peuvent l'utiliser aussi » : une clé Gumroad sans multi-postes reste
  utilisable sur plusieurs appareils (la vérification de licence n'incrémente pas le compteur,
  `increment_uses_count=false`), comme pour le Budget commun. À confirmer par Quentin pour l'usage à
  plusieurs personnes.
