# Suivi culturel (PGS) · extension du Suivi de lecture

Réalisation interne du Master Production (décision de Quentin du 27/11/2026, transmise par le GOD). Sous-session
`[Prod] Suivi culturel`. Branche `claude/prod-suivi-culturel`, PR vers `main` **non fusionnée** : le nom et l'aperçu
sont validés par Quentin (via le GOD) avant toute fusion.

## 1. Ce qui change

| Sujet | Avant | Après |
|---|---|---|
| Médias | livres (papier, numérique, audio) | livres, livres audio, films, séries (saisons, épisodes), podcasts |
| Saisie | tout à la main | recherche au fil de la frappe (Open Library, TMDB, iTunes), tolérante aux accents et aux fautes ; saisie à la main toujours possible |
| Objectifs | livres, pages | livres (audio compris), pages, films, séries, podcasts, épisodes |
| Nom | Suivi de lecture | **Suivi culturel** (retenu le 28/11/2026) |
| Code, fiche Gumroad, URL, prix | PGS, `cfXnYcVohgvMwrn0ONglsQ==`, `/templates/lecture/`, 12 € | **inchangés** (licences et données des acheteurs valables), reste dans le Pack Étudiant |

Noms proposés : 1) **Suivi culturel** (recommandé) ; 2) Carnet de culture ; 3) Mes lectures et écrans.

**Nom retenu par Quentin le 28/11/2026 : « Suivi culturel »** (via le GOD). Commit de renommage `35d8bb8` repris dans la
PR #357 par cherry-pick. « Suivi de lecture » ne reste que dans les textes pour les acheteurs existants (FAQ, phrase
« Anciennement… », mention de la clé et À propos de l'application). Le nom
s'écrit dans `templates/lecture/donnees.js` (`nom`), `netlify/lib/templates-acces.mjs` (`PRODUITS.PGS.nom`),
`outils/packs/donnees.mjs`, la page `catalogue/lecture/` et les cartes ; relancer ensuite `node outils/packs/generer.mjs`,
`node outils/connexion/generer.mjs`, `node outils/packs/generer.mjs`, `node outils/essai/generer.mjs`,
`node outils/seo/donnees-structurees.mjs`.

## 2. Données et migration

- Les œuvres restent dans le tableau `livres` (nom historique), chacune avec un champ `media`. Une donnée v1 est une
  donnée v2 valide : le média se déduit du format (`audio` → livre audio, sinon livre). Aucun champ n'est retiré.
- Testé sur des données v1 réelles (`outils/templates/lecture.test.mjs`, « migration v1 → v2 sans perte ») :
  livres, sessions, citations, avis, objectifs et champs inconnus identiques ; idempotent ; statistiques v1 inchangées.
- Risque résiduel faible : une ancienne version de l'application, restée hors ligne sur un appareil, qui modifierait
  un film avant de se mettre à jour, le ramènerait à un livre papier (elle ne connaît pas `media`). Le service worker
  charge le réseau d'abord : la mise à jour se fait au premier chargement en ligne.

## 3. Recherche : proxy `/api/oeuvres`

- `netlify/functions/oeuvres.mjs` (région fra), logique dans `netlify/lib/oeuvres.mjs`, tests
  `outils/templates/oeuvres.test.mjs`.
- Cache Netlify Blobs `oeuvres-cache` (eu-central-1) : recherches 7 jours ; index partagé par média (5 000 fiches au
  plus) alimenté par les œuvres que les utilisateurs ajoutent. Seules des fiches lues par le serveur chez la source
  y entrent (pas d'empoisonnement possible depuis un navigateur).
- Accès : code PGS ou code d'essai PGS ; démo limitée à 60 appels par jour et par IP (IP hachée, jamais stockée en clair).
- Ce qui part vers les sources : les mots tapés seulement. Aucune image téléchargée.
- Serveur local : `/api/oeuvres` répond avec des sources simulées (titres inventés) ; `QME_OEUVRES_RESEAU=1` pour
  interroger les vraies sources.

## 4. Clé TMDB : consigne pour Quentin

Variable Netlify **`TMDB_JETON`** = « jeton d'accès en lecture à l'API » (API Read Access Token, v4). Il passe dans
l'en-tête `Authorization: Bearer`, jamais dans une URL ni dans le navigateur. (`TMDB_API_KEY`, clé v3, est accepté en
secours.) Sans variable : films et séries en saisie manuelle, tout le reste fonctionne.

1. themoviedb.org › « Rejoindre TMDB » : créer le compte, valider l'e-mail.
2. Avatar › Paramètres › API › « Créer » (ou « Demander une clé d'API ») › type **Developer**. Usage : application web
   personnelle de suivi de films et séries ; URL `https://qm-engineering.fr` ; accepter les conditions.
3. Sur la page API, copier le **Jeton d'accès en lecture à l'API** (longue chaîne commençant par `eyJ`), pas la clé v3.
4. Netlify › site qm-engineering › Site configuration › Environment variables › Add a variable : `TMDB_JETON`, portée
   Functions, toutes les branches de déploiement. Redéploiement nécessaire pour la prise en compte.

## 5. Points ouverts

- **Logo TMDB** : fait. Logo officiel « blue_short » téléchargé le 27/11/2026 depuis themoviedb.org (page « Logos &
  Attribution »), rangé dans `templates/lecture/tmdb-logo.svg` (SVG d'origine, sans script), affiché sans déformation
  à 70 px de large à côté de la mention « This product uses the TMDB API but is not endorsed or certified by TMDB. »
  (résultats de recherche, fiche préremplie, Réglages › Sources).
- **iTunes Search API** : gratuite et sans clé, environ 20 appels par minute ; ses conditions visent la promotion des
  contenus Apple. Seuls titre, créateur et année sont utilisés. À valider par Quentin.
- **Pages anglaises** (`en/templates/`, `en/english-version/`) : texte « Reading tracker » non modifié.
- **Communication** (cartes d'accueil, publications) : hors de cette PR.

## 6. Fiche Gumroad (à transmettre à l'agent Gumroad par le master, à la mise en ligne seulement)

- Nom : « Suivi culturel : livres, films, séries, podcasts » (ou le nom retenu). Permalien `suivi-lecture` inchangé,
  12 €.
- Résumé : « Tes livres, livres audio, films, séries et podcasts au même endroit : cherche le titre, la fiche se
  remplit ; note ta page ou ton épisode en deux secondes ; ton rythme, la date où tu finiras, tes objectifs de l'année
  au jour près et tes statistiques. »
- Description, ajouts à la fiche actuelle (`docs/templates/communication/lecture/gumroad.json`) : remplacer « Tout se
  saisit à la main : aucun livre n'est cherché en ligne… » par « Recherche des titres (Open Library, TMDB, Apple) : seuls
  les mots tapés sont envoyés, jamais ta bibliothèque ; saisie à la main toujours possible. » ; ajouter les puces films
  (minutes, « Vu en entier »), séries (saison et épisode, « 1 épisode »), podcasts (épisodes), objectifs par média ;
  phrase « Tu as acheté le Suivi de lecture ? Cette version est incluse, ta clé l'ouvre. »
- Bouton du reçu : « Ouvrir mon suivi culturel ».
