# Fiche Gumroad · Candidatures études, stages, alternance (T89, CAN)

**Pas encore créée** (aucun outil Gumroad utilisé dans cette session). Données prêtes dans `gumroad.json`, au même
format que `../gumroad-a-creer.json` (à y reporter par l'orchestrateur du lot).

| Champ | Valeur |
|-------|--------|
| Nom | Candidatures études, stages, alternance |
| Prix | 12 € (d'après `IDEES.md`, minimum autorisé) |
| Permalien proposé | `candidatures-etudes-stages-alternance` (à vérifier : libre sur la boutique) |
| Catégorie | `education` (à vérifier dans la liste des catégories Gumroad) |
| Bouton | « Ouvrir mes candidatures » |
| Contenu | lien vers `https://qm-engineering.fr/connexion/` |
| Couverture | `assets/templates-candidatures-couverture.png` (1280 × 720), une fois en ligne |
| Clé de licence | **à activer par Quentin** dans l'éditeur (Content → Insert → License key, sans multi-postes) |

## Résumé

Toutes tes candidatures au même endroit : formations, stages, alternance, jobs étudiants. Pièces à fournir, dates
que tu saisis, statuts et réponses, vœux classés, relances, entretiens préparés et lettres de motivation sur trame.

## Description

Voir `description` dans `gumroad.json` (HTML). Mentions de limite : aucun calendrier officiel ni plateforme de
candidature (ni nommée, ni connectée), dates saisies à vérifier à la source, listes de pièces indicatives, rien n'est
déposé ni envoyé à la place de l'utilisateur.

## Point à trancher par Quentin

Public en partie mineur (lycéens) : l'achat sur Gumroad se fait en pratique par un parent. Les données saisies sont
celles du candidat (intitulés, établissements, dates, notes libres) ; aucune note scolaire ni pièce n'est demandée.
Voir la fiche `docs/templates/fiches/candidatures.md` § Risques.

## Après publication

Reporter l'identifiant produit dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad`) et appliquer la
liste « À chaque publication Gumroad » du skill (page catalogue au prix, carte en vitrine, lien `.bientot-demo` retiré
de la démo avec un nouveau `?v=`). Version « en vente » de la page : `section-site.html`.
