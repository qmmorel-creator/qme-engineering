# Fiche Gumroad · Rentabilité d'un investissement locatif (T95, RNT)

**Pas encore créée** (aucun outil Gumroad utilisé dans cette session). Données prêtes dans `gumroad.json`, au même
format que `../gumroad-a-creer.json` (à y reporter par l'orchestrateur du lot).

| Champ | Valeur |
|-------|--------|
| Nom | Rentabilité d'un investissement locatif |
| Prix | 15 € (d'après `IDEES.md`) |
| Permalien proposé | `rentabilite-investissement-locatif` (à vérifier : libre sur la boutique) |
| Catégorie | `business-and-money/personal-finance` (comme T85 ; à vérifier dans la liste des catégories Gumroad) |
| Bouton | « Ouvrir mon étude » |
| Contenu | lien vers `https://qm-engineering.fr/connexion/` |
| Couverture | `assets/templates-investissement-locatif-couverture.png` (1280 × 720), une fois en ligne |
| Clé de licence | **à activer par Quentin** dans l'éditeur (Content → Insert → License key, sans multi-postes) |

## Résumé

Jusqu'à 5 biens locatifs comparés : coût total, loyers et vacance, charges, crédit saisi, rendement brut et net,
cash-flow mensuel avant impôt, effort d'épargne, prix maximal pour un rendement visé, sensibilité et fiche d'analyse.

## Description

Voir `description` dans `gumroad.json` (HTML). Mentions de limite : simulation **avant impôt** (fiscalité non
calculée), ne remplace pas un conseil en investissement ni un conseil fiscal, aucun prix au m², loyer de référence ni
taux du marché intégré, frais de notaire estimés selon une hypothèse affichée.

## Après publication

Reporter l'identifiant produit dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad`), ajouter RNT aux
`produits` du pack PPB (`netlify/lib/packs.mjs`, avec `ajouts` daté si le pack est en vente) puis régénérer les pages
de packs, et appliquer la liste « À chaque publication Gumroad » du skill (page catalogue au prix, carte en vitrine,
lien `.bientot-demo` retiré de la démo avec un nouveau `?v=`). Version « en vente » de la page : `section-site.html`.
