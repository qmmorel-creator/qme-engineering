# Fiche Gumroad · Registre du DOE (T77, RDE)

**Pas encore créée** (aucun outil Gumroad utilisé dans cette session). Données prêtes dans `gumroad.json`, au même
format que `../gumroad-a-creer.json` (à y reporter par l'orchestrateur du lot).

| Champ | Valeur |
|-------|--------|
| Nom | Registre du DOE |
| Prix | 29 € (d'après `IDEES.md`, au-dessus du minimum de 12 €) |
| Permalien proposé | `registre-doe` (à vérifier : libre sur la boutique) |
| Catégorie | `business-and-money/management-and-leadership` (même choix que les autres templates BTP, à vérifier) |
| Bouton | « Ouvrir mon registre du DOE » |
| Contenu | lien vers `https://qm-engineering.fr/connexion/` |
| Couverture | `assets/templates-doe-couverture.png` (1280 × 720), une fois en ligne |
| Clé de licence | **à activer par Quentin** dans l'éditeur (Content → Insert → License key, sans multi-postes) |

## Résumé

Les pièces du dossier des ouvrages exécutés par opération, lot et entreprise : pièces types par lot, statuts,
relances datées avec courrier, complétude par lot et par entreprise, bordereau de transmission imprimable.

## Description

Voir `description` dans `gumroad.json` (HTML). Points clés : base de 20 lots types, DIUO en option, quatre
statuts, retard calculé, relances avec courrier à copier ou imprimer, complétude, bordereau et état des pièces
manquantes, export CSV. Mentions de limite : pas un conseil juridique, le marché fait foi, documents non stockés,
aucune relance envoyée par l'outil, pas de comptes pour les entreprises.

## Texte du reçu

Voir `receipt` dans `gumroad.json`.

## Après publication

Reporter l'identifiant produit dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad`) et
appliquer la liste « À chaque publication Gumroad » du skill (page catalogue au prix, carte en vitrine, lien
`.bientot-demo` retiré de la démo avec un nouveau `?v=`). Version « en vente » de la page : `section-site.html`.
