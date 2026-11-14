# Fiche Gumroad · Plan d'entraînement course à pied

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json` dans
`gumroad.json`. Prix prévu dans `IDEES.md` (15 €) : **nom et prix à confirmer par Quentin**. **Aucun produit Gumroad
n'a été créé** (consigne de la mission du 14/11/2026). La clé de licence est à activer à la main dans l'éditeur
Gumroad (Content → Insert → License key, sans multi-postes), puis l'identifiant produit reporté dans `PRODUITS`
(`netlify/lib/templates-acces.mjs`, champ `gumroad` de `CRS`). L'entrée n'a pas été ajoutée à
`../gumroad-a-creer.json` (fichier partagé, laissé au coordinateur).

- **Produit interne** : `CRS` (préfixe des codes), application `https://qm-engineering.fr/templates/course-a-pied/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-course-a-pied-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir mon plan »
- **Catégorie** : `fitness-and-health` (Fitness & Health, comme le carnet de musculation), **à confirmer** dans la liste Gumroad.

## Nom

Plan d'entraînement course à pied

## Prix

15 € (achat unique)

## Permalien

`plan-entrainement-course-a-pied` (à confirmer à la création)

## Résumé (une phrase)

Tes allures calculées depuis un chrono récent, un plan de 8 à 16 semaines du 10 km au marathon placé sur tes jours, chaque séance cochée avec sa distance et ton ressenti, le volume de la semaine. Achat unique.

## Description (HTML)

```html
<h2>Tes allures et tes semaines, jusqu'au jour J.</h2><p>Un plan trouvé en ligne ne connaît ni ton chrono, ni tes jours libres : les allures se recopient à la main, les séances tombent un mauvais jour, et les footings se courent trop vite. Le plan d'entraînement course à pied part de toi.</p><h3>Ce que tu obtiens</h3><ul><li><strong>Tes allures, calculées</strong> : à partir d'un chrono récent (5 km, 10 km, semi, marathon ou autre distance), les fourchettes de footing, sortie longue, seuil, fractionné et allure spécifique, en min/km et en km/h. Ce sont des estimations.</li><li><strong>Une prédiction de temps sourcée</strong> : formule de Riegel (American Scientist, 1981), et ton temps visé jugé prudent, réaliste ou ambitieux.</li><li><strong>Un plan type rédigé pour ce template</strong> : 8 semaines pour le 10 km, 12 pour le semi, 16 pour le marathon, de 3 à 5 séances par semaine, progression puis affûtage, placé sur tes jours.</li><li><strong>Chaque séance cochée</strong> : distance, durée et ressenti ; une séance manquée se note ou se déplace dans la semaine.</li><li><strong>Le volume et l'adaptation</strong> : kilomètres prévus et faits par semaine, semaine allégée en un geste, proposée quand les séances deviennent trop dures.</li><li><strong>Imprimer et exporter</strong> : plan imprimable, ajout à ton agenda (.ics), export CSV.</li></ul><h3>Comment ça marche</h3><ol><li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li><li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li><li>Entre un chrono récent, ta course et tes jours : ton plan est prêt.</li></ol><p>Rien à installer, aucune montre à connecter. Achat unique, sans abonnement, sur ordinateur et téléphone.</p><p><em>Ce n'est ni un programme médical ni un avis médical : demande l'avis d'un médecin avant de commencer. Aucune donnée de santé n'est demandée. Plans rédigés pour QME, sans reprise d'un plan publié ni d'une méthode commerciale. Démo disponible sur qm-engineering.fr/catalogue/course-a-pied.</em></p>
```

## Tags (7)

- `course-a-pied`
- `running`
- `plan-entrainement`
- `semi-marathon`
- `marathon`
- `10-km`
- `francais`

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, puis entre un chrono récent, ta course et tes jours de course : ton plan est prêt. Garde cet e-mail : la même clé fonctionne sur tous tes appareils. Avant de commencer, demande l'avis d'un médecin.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Coureurs amateurs, du 10 km au marathon

## Avertissement (repris dans la description)

Ni programme médical ni avis médical, avis d'un médecin avant de commencer, aucune donnée de santé ; allures
présentées comme des estimations (formule de Riegel, source citée dans l'application) ; plans rédigés pour QME.

## Point à trancher par Quentin

- Nom (« Plan d'entraînement course à pied ») et prix (15 €, comme prévu dans `IDEES.md`).
- Catégorie Gumroad et tags.
