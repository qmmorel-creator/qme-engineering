# Fiche Gumroad · Papiers du foyer (T83, DCS)

**Pas encore créée** (aucun outil Gumroad utilisé dans cette session). Données prêtes dans `gumroad.json`, au même
format que `../gumroad-a-creer.json` (à y reporter par l'orchestrateur du lot).

| Champ | Valeur |
|-------|--------|
| Nom | Papiers du foyer |
| Prix | 15 € (d'après `IDEES.md`, au-dessus du minimum de 12 €) |
| Permalien proposé | `papiers-du-foyer` (à vérifier : libre sur la boutique) |
| Catégorie | `business-and-money/personal-finance` (même choix que les autres templates « Argent », à vérifier) |
| Bouton | « Ouvrir mes papiers » |
| Contenu | lien vers `https://qm-engineering.fr/connexion/` |
| Couverture | `assets/templates-papiers-couverture.png` (1280 × 720), une fois en ligne |
| Clé de licence | **à activer par Quentin** dans l'éditeur (Content → Insert → License key, sans multi-postes) |

## Résumé

Où est chaque papier du foyer, combien de temps le garder (durées de service-public.gouv.fr, datées), ce qui peut
être jeté, les pièces d'identité à renouveler, et une fiche « en cas d'urgence » pour un proche.

## Description

Voir `description` dans `gumroad.json` (HTML). Points clés : recherche « où est… », 77 documents types en 9
catégories, durée de conservation sourcée et datée (modifiable), « peut être jeté » calculé, renouvellements saisis
avec rappel, fiche d'urgence, inventaire imprimable, CSV. Mentions de limite : durées minimales indicatives (pas un
conseil juridique), aucune pièce d'identité ni numéro stocké, pas d'e-mail de rappel.

## Texte du reçu

Voir `receipt` dans `gumroad.json`.

## Après publication

Reporter l'identifiant produit dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad`) et
appliquer la liste « À chaque publication Gumroad » du skill (page catalogue au prix, carte en vitrine, lien
`.bientot-demo` retiré de la démo avec un nouveau `?v=`). Version « en vente » de la page : `section-site.html`.
