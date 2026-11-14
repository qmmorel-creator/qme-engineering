# Fiche Gumroad · Document unique d'évaluation des risques (T80, DRP)

**Fiche non créée** (mission du 14/11/2026 sans outil Gumroad). Contenu prêt dans `gumroad.json`, à
reporter dans `../gumroad-a-creer.json` au moment de la création. Nom et prix à **confirmer par Quentin**
avant `create_draft_product` (29 € d'après `IDEES.md`, au-dessus du minimum de 12 €).

| Champ | Valeur |
| --- | --- |
| Nom | Document unique d'évaluation des risques |
| Prix | 29 € (`price_cents` 2900), achat unique |
| Permalien prévu | `document-unique-evaluation-risques` (à vérifier : libre sur la boutique) |
| Catégorie | Business and Money (sous-catégorie à vérifier dans `list_categories`) |
| Bouton | « Ouvrir mon document unique » |
| Lien de contenu | https://qm-engineering.fr/connexion/ |
| Couverture | `assets/templates-document-unique-couverture.png` (1280 × 720), une fois en ligne |
| Tags | document-unique, duerp, evaluation-des-risques, prevention, tpe, pme, francais |

## Résumé

Ton document unique d'évaluation des risques (DUERP) tenu à jour : unités de travail, risques cotés gravité ×
probabilité avant et après les mesures, plan d'actions daté, versions archivées, rappels de mise à jour selon
l'effectif et document complet à imprimer.

## Description

Voir `gumroad.json` (champ `description`, HTML prêt à coller). Points clés : démarrage par activité, 20
familles de risques inspirées de l'INRS (reformulées), cotation initiale et résiduelle sur grille
paramétrable, plan d'actions (programme annuel dès 50 salariés), versions datées à conserver 40 ans, rappels,
document imprimable. Mention finale : outil d'aide, ne remplace ni un préventeur ni un conseil juridique ;
obligations sourcées et datées.

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton
document unique s'ouvre. Indique ton activité et ton effectif, coche tes unités de travail, puis cote les
risques proposés. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Étapes à la création (skill `nouveau-template`, § 3)

1. Confirmer nom et prix avec Quentin.
2. `create_draft_product`, puis `update_product` (permalien, catégorie, résumé, tags, détails, reçu, bouton).
3. `add_content_link` vers https://qm-engineering.fr/connexion/, `add_cover` une fois la couverture en ligne.
4. Reporter l'identifiant produit dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad`).
5. **Quentin** active la clé de licence dans l'éditeur Gumroad (Content → Insert → License key) ; le
   `product_id` affiché doit être identique à `gumroad` dans `PRODUITS`.
6. Publication seulement avec son accord explicite, puis passage du site en vente (`section-site.html`,
   liste `reference.md` § « À chaque publication Gumroad »).
7. Avant la mise en vente, revérifier les sources datées de `templates/document-unique/donnees.js`
   (service-public.gouv.fr F35360, INRS) : si une page a changé, mettre à jour le texte et la date.
