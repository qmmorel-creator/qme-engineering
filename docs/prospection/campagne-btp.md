# Campagne ciblée « btp » (préparée le 25/11/2026)

Demande de Quentin du 25/11/2026 : campagne ciblée sur un **pack** et non un template seul, le **Pack Chef de projet BTP**
(`PBT`, en vente, 192 € au lieu de 256 €), présenté comme prêt à l'emploi avec l'ouverture sur du sur-mesure.
Skill : `.claude/skills/campagne-ciblee-pack/`.

| Élément | Valeur |
|---|---|
| Produit | Pack Chef de projet BTP : Planning Gantt (GNT), Circuit de visa (VSA), Levée de réserves (RSV), Non-conformités (NCF), Compte rendu → plan d'actions (CRA), Suivi de chantier par lot (CHT), Registre du DOE (RDE), Conformité des sous-traitants (STR) ; tous en vente (`outils/gumroad/ecart.mjs` du 25/11/2026 : aucun écart) |
| Page concept | `https://qm-engineering.fr/concepts/btp/` : déroulé d'une opération en 8 étapes, une capture réelle de chaque démo `?demo` (données fictives) et un lien vers chaque démo, bloc « Prêt à l'emploi, ou sur mesure » |
| Modèle de mail | `outils/prospection/campagnes/btp.mjs` : deux profils (`profil: "moe"` → réserves et DOE, entrée Levée de réserves ; `profil: "eg"` → pièces de vigilance des sous-traitants et avenants, entrée Conformité des sous-traitants), puis le pack complet ; relance J+7 |
| Cible | maîtres d'œuvre d'exécution indépendants, petits cabinets d'architectes qui assurent la direction des travaux, économistes de la construction, OPC, petites entreprises générales ; exclus : majors, grands groupes d'ingénierie, réseaux nationaux, fiches déjà dans Nexora |
| Envoi | OVH via le site, file `/api/prospection` (campagne `btp`, `parJour: 12`, relances J+7 comprises), lundi–samedi, 8 h–18 h |
| Nexora | concept `cpt-btp` (brouillon) ; prospects `vague: "cible-btp"` |
| Validation | page (aperçu Netlify de la PR) et brouillon du mail type validés par Quentin avant tout envoi |

## Captures (production, 25/11/2026)

| Étape | Template | Vue de la démo | Fichier |
|---|---|---|---|
| 01 Préparation | GNT | `#gantt` (seul planning de démo du bâtiment : « Rénovation de cuisine ») | `planning.webp` |
| 02 Préparation | STR | `#bord` (alertes) | `sous-traitants.webp` |
| 03 Études d'exécution | VSA | `#registre` | `visas.webp` |
| 04 Chantier | CHT | `#tableau` | `suivi-lots.webp` |
| 05 Chantier | CRA | `#modeles`, modèle « Réunion de chantier » (les réunions de la démo ne sont pas des réunions de chantier) | `comptes-rendus.webp` |
| 06 Chantier | NCF | `#registre` | `non-conformites.webp` |
| 07 Réception | RSV | `#reserves` | `reserves.webp` |
| 08 Réception | RDE | `#pieces` | `doe.webp` |

## Concurrents relevés (réserves, OPR, suivi de chantier), non cités dans les mails

Archipad (module OPR et levée de réserves ; prix affiché sur Capterra à partir de 54,99 €), BatiScript (tarif sur
demande), Kaliti et Finalcad (prix par chantier selon la surface ; Finalcad à partir de 39 €/mois selon Appvizer),
Fieldwire (version gratuite), BulldozAIR (location mensuelle ou annuelle), Procore, Onaya. Sources : annuaires
(Appvizer, Capterra, GetApp, La Fabrique du Net), non vérifiées auprès des éditeurs. Le pack se distingue par l'achat
unique (pas d'abonnement) et la couverture du circuit de visa, du DOE et de la conformité des sous-traitants ; il
n'a ni plans annotés ni photos géolocalisées.

## Points ouverts

- **Parallèle** (25/11/2026) : les campagnes actives se relaient mail par mail ; `btp` n'attend plus qu'`auto-ecole`
  ait vidé sa file.
- **Quota** (dépassé : plafond global de 50 par jour supprimé le 25/11/2026, envoi toutes les 2 minutes ; la
  campagne `btp` peut être créée avec son propre `parJour` sans retoucher les autres) : au 25/11/2026, la campagne `auto-ecole` est active avec `parJour: 50` (et `test-envoi` en pause,
  `parJour: 1`). Avec `btp` à 12, la somme dépasserait 50 : la campagne `btp` n'est **pas créée** sur le serveur tant
  que Quentin n'a pas décidé (aucune modification du `parJour` d'une autre campagne). Par ailleurs, la tâche
  d'envoi parcourt les campagnes dans l'ordre et en envoie une par passage : tant qu'`auto-ecole` a des mails en
  file et n'a pas atteint son plafond, elle prend les 50 créneaux du jour.

## Lots de sourcing

| Lot | Fichier | Adresses | Profils | Contrôles (25/11/2026) |
|---|---|---|---|---|
| 1 | `docs/prospection/lots/btp-lot1.json` (écartés : `btp-lot1-ecartes.md`) | 71, 40 départements | 47 `moe` (22 MOE d'exécution, 10 architectes, 12 économistes, 3 OPC), 24 `eg` | adresse lue sur la page `source` du site de l'entreprise, domaine avec serveur de messagerie ; désinscrits : 0 ; opposition (API) : 0 ; Nexora : 0 doublon ; Gmail (`in:anywhere`, domaine ou adresse) : 0 échange |

À surveiller dans le lot 1 : cinq entreprises générales travaillent surtout pour des particuliers (Aedis Rénovation,
MB Rénovation, 4S Rénovation, Renov Maison Sud, BR Habitat Espace Harnois), l'angle « sous-traitants » leur convient
moins ; sept adresses en webmail générique affichées sur le site ; Bloc Construction : adresse reconstituée depuis
« contact[at]… » ; Auxilium Projets : deux domaines sur le site, seul le `.fr` reçoit du courrier.

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-25 | 0 | 0 | 0 | Page (PR #302, aperçu contrôlé), captures, modèle de mail, brouillon Gmail de validation, concept Nexora `cpt-btp` (brouillon), lot 1 (71 adresses vérifiées) ; en attente de validation et de décision sur le quota |
