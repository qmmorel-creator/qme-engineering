# Fiche Gumroad · Propositions commerciales (T74, PCM)

**Fiche non créée** (mission du 14/11/2026 sans outil Gumroad). Contenu prêt dans `gumroad.json`, à
reporter dans `../gumroad-a-creer.json` au moment de la création. Nom et prix à **confirmer par Quentin**
avant `create_draft_product` (19 € d'après `IDEES.md`, au-dessus du minimum de 12 €).

| Champ | Valeur |
| --- | --- |
| Nom | Propositions commerciales |
| Prix | 19 € (`price_cents` 1900), achat unique |
| Permalien prévu | `propositions-commerciales` (à vérifier : libre sur la boutique) |
| Catégorie | Business and Money › Sales (à vérifier dans `list_categories`) |
| Bouton | « Ouvrir mes propositions » |
| Lien de contenu | https://qm-engineering.fr/connexion/ |
| Couverture | `assets/templates-propositions-couverture.png` (1280 × 720), une fois en ligne |
| Tags | proposition-commerciale, freelance, consultant, devis, prospection, vente, francais |

## Résumé

Tes propositions commerciales structurées : contexte, objectifs, livrables, trois options comparées,
planning et conditions dans un PDF soigné, puis le suivi jusqu'à la signature (relances, validité, taux de
transformation).

## Description

Voir `gumroad.json` (champ `description`, HTML prêt à coller). Points clés : proposition structurée, 4 trames
par métier, trois options comparées, bibliothèque de blocs, planning en semaines, PDF soigné, suivi
(validité, relances avec message à copier, taux de transformation), duplication. Mention finale : une
proposition n'est pas un devis ; prix hors taxes, aucune règle légale intégrée, devis détaillé à
l'acceptation (Générateur de devis QME).

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et tes
propositions s'ouvrent. Choisis la trame de ton métier, personnalise tes blocs de présentation et de
méthode, puis crée ta première proposition. Garde cet e-mail : la même clé fonctionne sur tous tes
appareils.

## Étapes à la création (skill `nouveau-template`, § 3)

1. Confirmer nom et prix avec Quentin.
2. `create_draft_product`, puis `update_product` (permalien, catégorie, résumé, tags, détails, reçu, bouton).
3. `add_content_link` vers https://qm-engineering.fr/connexion/, `add_cover` une fois la couverture en ligne.
4. Reporter l'identifiant produit dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad`).
5. **Quentin** active la clé de licence dans l'éditeur Gumroad (Content → Insert → License key) ; le
   `product_id` affiché doit être identique à `gumroad` dans `PRODUITS`.
6. Publication seulement avec son accord explicite, puis passage du site en vente (`section-site.html`,
   liste `reference.md` § « À chaque publication Gumroad »).
