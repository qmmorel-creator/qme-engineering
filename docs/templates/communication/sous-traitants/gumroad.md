# Fiche Gumroad · Conformité des sous-traitants

**Non créée** : aucun outil Gumroad utilisé dans cette session. Les valeurs sont dans `gumroad.json` (même
format que les autres templates), à reporter dans `../gumroad-a-creer.json` par l'intégrateur. Nom et prix à
**confirmer par Quentin** avant `create_draft_product` (règle du 13/11/2026 : prix minimum 12 €).

| Champ | Valeur proposée |
| --- | --- |
| Nom | Conformité des sous-traitants |
| Prix | 29 € (d'après `IDEES.md`) |
| Permalien | `conformite-sous-traitants` (à confirmer) |
| Catégorie | Business & Money › Management & Leadership (à vérifier dans `list_categories`) |
| Bouton | « Ouvrir mon registre » |
| Lien de contenu | https://qm-engineering.fr/connexion/ |
| Couverture | `assets/templates-sous-traitants-couverture.png` (1280 × 720), une fois en ligne |
| Préfixe | `STR` (`PRODUITS` de `netlify/lib/templates-acces.mjs`, champ `gumroad` à renseigner) |

## Résumé

Tes sous-traitants par lot et par rang : acceptation et agrément du paiement, attestations de vigilance, Kbis,
liste des salariés étrangers et décennale datés, alertes à J-30 et J-15, relances préparées, registre
imprimable et export CSV.

## Description

Voir le champ `description` de `gumroad.json` (HTML). Points clés : chaîne de sous-traitance lot par lot,
acceptation suivie, pièces datées, alertes, relances, tableau de conformité et registre ; mention « outil
d'aide, ne remplace pas un conseil juridique », règles sourcées et datées (14/11/2026), aucun document stocké.

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton
registre des sous-traitants s'ouvre. Crée ton opération, ajoute les entreprises lot par lot, puis les dates des
pièces reçues : échéances, alertes et relances se calculent. Garde cet e-mail : la même clé fonctionne sur tous
tes appareils.

## Tags

btp, sous-traitance, obligation-de-vigilance, chantier, conformite, conduite-de-travaux, francais

## Étapes (à faire par l'intégrateur, avec l'accord de Quentin)

1. `create_draft_product` puis `update_product` (permalien, catégorie, résumé, description, tags, détails,
   reçu, bouton), `add_content_link` vers https://qm-engineering.fr/connexion/, `add_cover` une fois la
   couverture en ligne.
2. Quentin active le bloc **License key** (onglet Content → Insert → License key, sans multi-postes) et
   vérifie que son `product_id` est celui de `PRODUITS`.
3. Vérifier `"is_licensed":true` sur la page de la fiche avant publication, puis passage « en vente » du site
   (`reference.md` § « À chaque publication Gumroad »).
