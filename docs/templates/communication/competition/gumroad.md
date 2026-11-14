# Fiche Gumroad · Gestion de compétition sportive

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Prix prévu : 49 € (prix de la ligne T52 dans `IDEES.md`, au-dessus du minimum de 12 €).
**Aucun produit Gumroad n'a été créé** (consigne de la mission). La clé de licence est à activer à la main
dans l'éditeur Gumroad (Content → Insert → License key, sans multi-postes), puis l'identifiant produit reporté
dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, ligne `CMP`). La fiche n'a pas été ajoutée à
`../gumroad-a-creer.json` (fichier partagé) : à y reporter au moment de la création groupée.

- **Produit interne** : `CMP` (préfixe des codes), application `https://qm-engineering.fr/templates/competition/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-competition-couverture.png` (1280 × 720, entrée `competition` de
  `outils/templates/couvertures-gumroad.cjs`, textes de `couverture.txt`), à téléverser une fois en ligne
- **Bouton** : « Ouvrir ma compétition »
- **Catégorie** : `self-improvement/productivity` (Self Improvement › Productivity), faute de mieux ; une
  catégorie sport plus juste est à chercher avec `list_categories`
- **Pack** : « Associations et clubs » (PAS), à ajouter à la composition du pack lors de la fusion

## Nom

Gestion de compétition sportive

## Prix

49 € (achat unique)

## Permalien

`gestion-competition` (à confirmer à la création)

## Résumé (une phrase)

Inscriptions par catégorie, vagues et horaires calculés, scores saisis au bord du plateau, classement à tes règles, mode écran et lien public en lecture seule pour les spectateurs.

## Description (HTML)

```html
<h2>Du premier inscrit au podium.</h2><p>Une compétition, c'est 40 athlètes, quatre épreuves, des vagues à caler, des feuilles de juge et un classement que tout le plateau réclame entre deux vagues. Le template Gestion de compétition sportive réunit tout au même endroit : inscriptions, vagues et horaires, scores saisis au bord du plateau, classement calculé en direct et affiché sur grand écran.</p><h3>Ce que tu obtiens</h3><ul><li><strong>Les inscriptions par catégorie</strong> : athlètes ou équipes (2 à 12), dossard automatique, statut, paiement, pièces vérifiées ; une liste collée depuis ton tableur ou ton formulaire s'importe en une fois.</li><li><strong>Les vagues et leurs horaires</strong> : vagues équilibrées selon le nombre de couloirs, les mieux classés en dernier (ou dossard, ou tirage), horaires calculés depuis le temps limite et le battement, alertes de repos, feuilles de juge imprimables.</li><li><strong>Les scores au bord du plateau</strong> : temps, répétitions au temps limite (« CAP+7 »), répétitions, charge ou points, départage au temps, absent ou disqualifié ; le rang se recalcule à chaque saisie, depuis plusieurs téléphones avec la même clé.</li><li><strong>Un classement à tes règles</strong> : somme des rangs ou barème de points, coefficient par épreuve, départage du général (meilleures places ou dernière épreuve), ex aequo gérés.</li><li><strong>Le classement affiché</strong> : mode écran plein écran pour la télévision, et un lien en lecture seule pour les spectateurs (classement, programme des vagues, recherche d'un nom), mis à jour seul.</li><li><strong>Six formats de départ</strong> et douze épreuves génériques à renommer, sans épreuve de référence imposée.</li></ul><h3>Comment ça marche</h3><ol><li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li><li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li><li>Choisis un format de départ, inscris les participants, génère les vagues. Tes données sont enregistrées en ligne et suivent la clé sur ordinateur, tablette et téléphone, même hors connexion.</li></ol><p>Rien à installer, aucun compte à créer. Achat unique, sans abonnement.</p><p><em>Outil d'organisation, pas un logiciel fédéral homologué : les règles de classement sont celles que tu choisis. Données des participants (RGPD) : collecte limitée, aucune donnée de santé, coordonnées jamais publiées, classement public effacé 30 jours après la compétition, mention d'information fournie. Aucun e-mail envoyé, aucun paiement encaissé. Démo disponible sur qm-engineering.fr/catalogue/competition.</em></p>
```

## Tags

competition, cross-training, club, association, classement, sport, francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ta compétition s'ouvre. Choisis un format de départ, puis inscris les participants. Garde cet e-mail : la même clé fonctionne sur tous les appareils de l'organisation (table de marque, téléphones des juges).

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Salles de cross-training, clubs et associations sportives

## Points à vérifier avant publication

- Nom et prix confirmés par Quentin (49 €, prix du tableau de bord).
- Aucune marque ni nom d'épreuve protégé dans la fiche, les captures ou la couverture (vérifié le 14/11/2026 :
  épreuves génériques, compétition fictive « Défi d'hiver Exemple »). Le tag « cross-training » est un terme
  générique ; ne pas utiliser de nom de marque de la discipline.
- Le lien public utilise une API propre (`/api/competition/*`) : vérifier après déploiement le `PUT` (401
  sans clé), `GET /api/competition/public/inconnu0000000` (404) et l'en-tête `netlify-cdn-cache-control`.
