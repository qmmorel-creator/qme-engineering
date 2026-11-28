# Campagne ciblée « hôtels » (préparée le 27/11/2026)

Sous-campagne lancée depuis la session « Audit campagnes ciblées » (27/11/2026) : présenter le **Pack Exploitation et
maintenance** (PXP, en vente, 95 € au lieu de 119 €) aux hôtels indépendants, comme ensemble prêt à l'emploi, avec
l'ouverture sur du sur-mesure. Skill : `.claude/skills/campagne-ciblee-pack/`. Mail type :
`docs/prospection/mail-type-packs-niches.md` (exemple hôtels).

| Élément | Valeur |
|---|---|
| Page concept | `https://qm-engineering.fr/concepts/hotels/` : une section par outil, captures réelles des applications remplies avec un hôtel fictif (« Hôtel Exemple ») |
| Pack | `https://qm-engineering.fr/packs/exploitation/` : Vérifications réglementaires (VRF, 35 €), Maintenance préventive (GMA, 39 €), Stocks et inventaire (STK, 25 €), Non-conformités (NCF, 20 €) ; 119 € séparément, 95 € en pack (page du pack et `outils/packs/donnees.mjs`, lus le 27/11/2026) ; tous en vente (`node outils/gumroad/ecart.mjs` : aucun écart) |
| Modèle de mail | `outils/prospection/campagnes/hotels.mjs` (objet, texte, relance J+7) ; liens traçables `?utm_campaign=hotels-<id>` vers la page concept et la page du pack |
| Envoi | OVH via le site, file `/api/prospection` (campagne `hotels`, sans `parJour`, créée en pause), un mail toutes les 2 minutes, lundi–samedi, 8 h–18 h, campagnes en parallèle à tour de rôle |
| Copie | copie cachée `quentin.morel@qm-engineering.fr` (mail de masse : pas de Floriane en copie) |
| Nexora | concept `cpt-hotels` (brouillon) ; prospects `vague: "cible-hotels"` |
| Projets Nexora | seulement pour les retours intéressés, après accord de Quentin |
| Validation | page (aperçu de la PR) et brouillon Gmail « [À valider · campagne hotels] » validés par Quentin avant toute fusion, mise en file ou envoi |

## Cible et exclusions

- Hôtels indépendants, avec ou sans restaurant ; adresse générique de l'établissement (contact@, reception@, info@…)
  lue sur la page exacte de son propre site.
- Exclus : chaînes, franchises, groupes hôteliers, résidences de tourisme, campings (campagne séparée `campings`),
  gîtes et chambres d'hôtes (adresses de la campagne `gites`), hôtels déjà dans Nexora (vague 13 « Hébergement et
  loisirs » notamment), `desinscrits.md`, liste d'opposition.
- **Aucun doublon entre campagnes** (règle de Quentin du 27/11/2026) : chaque lot passe `campagne.mjs doublons`, puis
  Nexora `list_qme` (nom de l'entreprise), puis Gmail `in:anywhere <domaine>` ; `doublons` est relancé juste avant `file`.

## Captures (27/11/2026)

Les démos `?demo` des quatre outils sont remplies de données d'atelier, de logistique et de chantier. Pour montrer le
quotidien d'un hôtel sans rien truquer à l'écran, les données fictives de chaque démo ont été transformées en un hôtel
fictif (« Hôtel Exemple (fictif) » : chambres et étages, restaurant et cuisine, salons ; linge, produits d'accueil,
bar ; réclamations par service), injectées dans le stockage local de l'application de production, puis capturées.
Scripts : `docs/prospection/captures-hotels/` (`extraire-demo.cjs`, `donnees-hotel.cjs`, `capturer.cjs`). La page le
signale. Les démos ouvertes depuis la page restent les démos génériques (atelier, chantier).

## Lots

| Lot | Sourcés | Doublons (outil) | Nexora | Gmail | Opposition | Retenus |
|---|---|---|---|---|---|---|
| 1 | 83 (21 départements) | 0 écarté (`doublons --campagne hotels`, outil du commit 001e536) | 1 écarté (Les Châtaigniers, Privas : vague 13), recherche par nom puis radical de domaine, témoins positif et négatif conformes | 1 écarté (même hôtel : mail du 02/11 et relance du 25/11), une requête par domaine, témoins conformes | 0 opposée (API), 0 dans `desinscrits.md` | **82** |

Lot 1, réserves : 6 fiches sans fait relevé (phrase sans fait) ; 17 adresses en messagerie grand public au nom de
l'hôtel (gmail, orange, wanadoo) ; Hôtel de France à Chaudeyrac (aussi camping et pods) et quelques hôtels labellisés
Logis ou Relais & Châteaux, gardés comme indépendants. Fichier de lot hors dépôt (adresses), comme pour `gites`.
Les doublons sont relancés juste avant `file` (d'autres campagnes tournent en même temps).

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-27 | 0 | 0 | 0 | Page `/concepts/hotels/` (PR #338, aperçu contrôlé), captures, modèle de mail, brouillon Gmail « [À valider · campagne hotels] », concept `cpt-hotels` (brouillon), campagne `hotels` créée en pause sans `parJour` ; lot 1 : 82 adresses prêtes, rien en file ; en attente de validation de Quentin |
