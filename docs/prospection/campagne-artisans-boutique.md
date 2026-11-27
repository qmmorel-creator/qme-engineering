# Campagne ciblée « artisans-boutique » (préparée le 27/11/2026)

Sous-campagne lancée le 27/11/2026 depuis la session « Audit campagnes ciblées » : présenter le **Pack Commerçant et
artisan** (PCA, en vente) aux artisans qui fabriquent et vendent, comme ensemble prêt à l'emploi, avec l'ouverture sur
du sur-mesure. Skill : `.claude/skills/campagne-ciblee-pack/` ; structure du mail : `docs/prospection/mail-type-packs-niches.md`.

| Élément | Valeur |
|---|---|
| Pack | Commerçant et artisan (`/packs/commercant-artisan/`) : 95 € au lieu de 127 € (relu le 27/11/2026) |
| Outils | Stocks et inventaire (STK, 25 €), Générateur de devis (DVS, 29 €), Trésorerie prévisionnelle (TRS, 29 €), Suivi de TVA (TVA, 19 €), Livre recettes-dépenses micro-entreprise (MCE, 25 €) ; tous en vente (`ecart.mjs` vide le 27/11/2026) |
| Page concept | `https://qm-engineering.fr/concepts/artisans-boutique/` (captures réelles des démos, données fictives) |
| Démos | stocks : atelier de bougies fictif ; trésorerie : « Atelier Exemple » ; livre des recettes : atelier de céramique fictif ; TVA : menuiserie fictive ; devis : artisan du bâtiment fictif (aucun texte métier dans les templates, dit tel quel sur la page) |
| Modèle de mail | `outils/prospection/campagnes/artisans-boutique.mjs` (objet, texte, relance J+7 par profil) ; liens traçables `?utm_campaign=ab-<id>` |
| Profils (`profil` du lot) | `fleuriste`, `brasserie`, `atelier` (céramistes, savonniers, ébénistes, maroquiniers) |
| Envoi | OVH via le site, file `/api/prospection`, campagne `artisans-boutique` créée sans `parJour`, en pause jusqu'au feu vert |
| Copie | copie cachée `quentin.morel@qm-engineering.fr` (serveur) ; pas de Cc (mail de masse) |
| Nexora | concept `cpt-artisans-boutique` (brouillon) ; prospects `vague: "cible-artisans-boutique"` après feu vert |
| Validation | page (aperçu de la PR) et brouillon Gmail « [À valider · campagne artisans-boutique] » validés par Quentin avant toute fusion, mise en file ou envoi |

## Argument propre au pack

Le livre des recettes ne sert qu'aux micro-entrepreneurs et le suivi de TVA qu'aux entreprises qui facturent la TVA :
le mail et la page le disent tels quels, ce qui appuie « chaque outil s'achète aussi seul (de 19 à 29 €) ».

## Cible et exclusions

- Fleuristes indépendants, micro-brasseries et brasseries artisanales, ateliers-boutiques (céramistes, savonniers,
  ébénistes, maroquiniers), site propre, adresse générique ou de l'établissement lue sur une page exacte de ce site.
- Exclus : franchises et réseaux, groupes brassicoles, horlogeries et magasins de sport (concepts déjà faits),
  boutiques de jeux (Royaumes & Légendes), Oh ! Délices Paysans et magasins de producteurs, adresses nominatives,
  toute fiche Nexora, `desinscrits.md`, liste d'opposition.
- Aucun doublon entre campagnes (règle du 27/11/2026) : `campagne.mjs doublons`, Nexora `list_qme` par nom, Gmail
  `in:anywhere <domaine>` ; `doublons` relancé juste avant `file`.

## Lots

Fichiers de lot hors dépôt (adresses ; un lot versé dans `docs/` serait ensuite vu comme « déjà dans le dépôt » par
`campagne.mjs doublons`). Un code postal sert seulement aux fiches Nexora, jamais au mail.

### Lot 1 · fleuristes (27/11/2026)

- 110 candidats examinés, 70 écartés au sourcing : 44 sans adresse lisible (formulaire ou adresse masquée), 5 adresses
  nominatives, 4 adresses douteuses, 4 sans boutique confirmée, 2 réseaux ou franchises, 5 sites injoignables, 4 valides
  gardés en réserve (répartition des départements).
- **40 retenus**, 23 départements. Contrôles : `doublons` 0 écarté ; Nexora (`list_qme` par nom) 0 ; Gmail
  (`in:anywhere <domaine>`, une requête par domaine ou adresse, 64 requêtes) 0 ; opposition 0 ; `desinscrits.md` 0.
- Réserves : 3 adresses sur un domaine différent du site (lues sur le site même) ; 4 maisons locales à plusieurs
  boutiques (sans franchise) ; code postal de Fouras ajouté de mémoire.

### Lot 1 · micro-brasseries (27/11/2026)

- 82 candidats examinés, 38 écartés au sourcing (18 sans adresse lisible, 8 sites vides ou repris, 3 nominatives,
  3 hors cible dont un réseau de brasseries-restaurants, 6 autres), puis 3 retirés par la session : Brasserie du Mont
  Blanc (seule adresse : service marketing ; taille), Page 24 / Saint-Germain (11 500 hl par an), Pays Flamand (deux
  sites de production).
- **41 retenus**, 33 départements. Contrôles : `doublons` 0 ; Nexora 0 ; Gmail 0 (50 requêtes) ; opposition 0 ;
  `desinscrits.md` 0.
- Réserves : codes postaux de Gallia, Paname, Cap d'Ona et Guerlédan complétés hors de la page ; Maison Alaryk lancée
  par un distributeur familial indépendant ; nom « Smeele - Fabrique de bière » ramené à « Smeele » pour le mail.

### Lot 1 · ateliers-boutiques (27/11/2026)

- 84 candidats examinés, 46 écartés au sourcing (19 adresses ou domaines nominatifs ou douteux, 9 sans adresse lisible,
  12 hors cible, 4 trop grands, 2 autres), puis 2 retirés par la session : Plum'paillettes (garage aménagé, vente en
  ligne seulement) et Savonnerie du Cèdre (aucune boutique attestée).
- **36 retenus** : 10 céramistes, 12 savonniers, 8 maroquiniers, 6 ébénistes ; 26 départements. Contrôles :
  `doublons` 0 ; Nexora 0 (36 noms, plus « Savonnerie », « Maroquinerie », « Poterie », « Céramique ») ; Gmail 0
  (46 requêtes, domaines à tirets entre guillemets) ; opposition 0 ; `desinscrits.md` 0.
- Réserves : codes postaux de L'Accroche-Cuir, Miyadori-do, Songes d'ébène, Argasol et Blossom pris hors de la page ;
  ERRO a deux boutiques (Bayonne, Bordeaux) ; les faits de Barbotine (L'Occitane) et d'Auboi (Louvre, Lanvin) citent
  des tiers, tels que le site les présente.

**Total du lot 1 : 117 adresses prêtes** (40 + 41 + 36), aucune mise en file avant le feu vert.

### Contrôles complémentaires du 27/11/2026 (consigne de la session « Audit campagnes ciblées »)

- `doublons … --campagne artisans-boutique` (outil à jour de la PR #330) sur les 117 : 0 écarté.
- Nexora, seconde recherche par **radical de domaine** (une par prospect, celui du site pour une messagerie grand
  public) : 0 correspondance sur 117. Témoins : `cipec` et `mariage-a-soie` sortent (un tiret vaut une espace) ;
  un radical collé (`mariageasoie`) ne trouve pas un nom écrit en plusieurs mots : la recherche par nom reste
  indispensable. La recherche porte aussi sur la ville.
- Gmail, témoins : `"mariage-a-soie.fr"` et `cipec.com` sortent, `"brasserie-inventee-zq7.fr"` ne renvoie rien.

### Méthode Gmail (constat du 27/11/2026)

- Une recherche groupée (`in:anywhere (a OR b OR …)`, 9 à 11 termes) a renvoyé 0 fil pour `pois-de-senteur.fr` alors
  que la recherche isolée en renvoie un : **une requête par domaine**, jamais groupée.
- Un domaine à tirets est découpé en mots par Gmail (`la-fleuriste.com` : 13 fils, `c-ma-nature.fr` : 61) : refaire
  alors la recherche entre guillemets (`"la-fleuriste.com"`) et lire les fils restants. Les 4 cas du lot étaient des
  faux positifs (aucun fil entre guillemets ; « décoration et fleurs » pour `etfleurs.fr`).

## Journal

| Date | Partis | Réponses | Oppositions | Notes |
|---|---|---|---|---|
| 2026-11-27 | 0 | 0 | 0 | Page, captures, modèle de mail (PR #336), concept Nexora `brouillon`, campagne créée en pause ; lot 1 : 117 adresses contrôlées (40 fleuristes, 41 brasseries, 36 ateliers ; 0 écarté par les contrôles) ; brouillon de validation dans Gmail ; en attente du feu vert de Quentin |
