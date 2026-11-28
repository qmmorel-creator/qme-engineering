# Suivi culturel (PGS) · extension du Suivi de lecture

Réalisation interne du Master Production (décision de Quentin du 27/11/2026, transmise par le GOD). Sous-session
`[Prod] Suivi culturel`. Branche `claude/prod-suivi-culturel`, PR vers `main` **non fusionnée** : le nom et l'aperçu
sont validés par Quentin (via le GOD) avant toute fusion.

## 1. Ce qui change

| Sujet | Avant | Après |
|---|---|---|
| Médias | livres (papier, numérique, audio) | livres, livres audio, films, séries (saisons, épisodes), podcasts |
| Saisie | tout à la main | recherche au fil de la frappe (Open Library, Wikidata, iTunes), tolérante aux accents et aux fautes ; saisie à la main toujours possible |
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

## 4. Films et séries : Wikidata (décision de Quentin du 28/11/2026)

TMDB est abandonné : ses conditions interdisent l'usage commercial sans accord écrit, et le template est vendu.
Aucune clé, aucune variable Netlify (`TMDB_JETON` et `TMDB_API_KEY` ne sont plus lues ; ne pas les créer).

- **Source** : point SPARQL `https://query.wikidata.org/sparql`, une requête par recherche (POST, délai 5 s). Recherche
  plein texte de Wikidata (service `Search` : par mots, accents ignorés, article initial non requis ; le service
  `EntitySearch` cherche par début de libellé et ne trouvait pas « bureau des légendes », dont le libellé commence par
  « Le »), filtre film
  `Q11424` ou série télévisée `Q5398426` (sous-classes comprises), puis titre français (anglais à défaut), année la plus
  ancienne (P577 ou P580), réalisation P57 (film) ou création P170 (série), durée P2047 normalisée (film), nombre de
  saisons P2437 et d'épisodes P1113 (série). `hint:optimizer "None"` : sans lui, plus de 10 s ; avec, 0,5 à 1 s.
- **Séries** : épisodes par saison (items « saison » liés par P179, rang P1545) repris seulement si toutes les saisons
  sont renseignées ; sinon la fiche garde « N épisodes au total », modifiable (le champ « Épisodes par saison » accepte
  un nombre total ou la liste par saison).
- **Faute de frappe** : même repli que les livres (`intouchabls` → `intouch*`), puis tri par ressemblance.
- **User-Agent** : `QME-SuiviCulturel/1.0 (https://qm-engineering.fr; quentin.morel@qm-engineering.fr)` (politique
  Wikimedia : nom, version, contact ; adresse professionnelle choisie par Quentin le 28/11/2026). Constante unique `UA`
  de `netlify/lib/oeuvres.mjs`.
- **Limites de débit** (mediawiki.org « Wikimedia APIs/Rate limits », 2026) : client non identifié 10 requêtes/min,
  client identifié 200/min ; SPARQL : 60 s de calcul par minute et 5 requêtes parallèles par IP. Les IP partagées
  (conteneur de test, Netlify) peuvent recevoir des 429 : le proxy répond alors « indisponible » (saisie à la main), ne
  garde rien en cache et suspend tout appel à Wikidata pendant la durée `Retry-After` (60 s par défaut, 1 h au plus,
  clé `pause/wikidata` du store, commune à toutes les instances). Réponses Wikidata gardées 30 jours (7 pour Open
  Library et iTunes), plus l'index partagé.
- **Licence** : CC0, usage commercial permis, aucune attribution obligatoire ; mention « Films et séries : Wikidata
  (CC0) » affichée dans les résultats, Réglages › Sources et À propos.
- **Vérifié en réel le 28/11/2026** : « Intouchables » (2011, Éric Toledano et Olivier Nakache, 112 min),
  « intouchabls » (faute) → Intouchables, « bureau des legendes » → Le Bureau des légendes (2015, Éric Rochant,
  5 saisons, 50 épisodes ; épisodes par saison connus pour les saisons 1 et 2 seulement).
- **Ce qui manque par rapport à TMDB** : épisodes par saison souvent incomplets (total seulement) ; durée et
  réalisation parfois absentes pour les œuvres récentes ou confidentielles (l'utilisateur les complète) ; pas de tri par
  popularité ; nouveautés ajoutées avec quelques jours ou semaines de retard ; risque de 429 aux heures chargées.

## 5. Points ouverts

- **iTunes Search API** : gratuite et sans clé, environ 20 appels par minute ; acceptée par Quentin le 28/11/2026 (noms
  et années seulement).
- **Pages anglaises** (`en/templates/`, `en/english-version/`) : texte « Reading tracker » non modifié.
- **Communication** (cartes d'accueil, publications) : hors de cette PR.

## 6. Fiche Gumroad (à transmettre à l'agent Gumroad par le master, à la mise en ligne seulement)

- Nom : « Suivi culturel : livres, films, séries, podcasts » (ou le nom retenu). Permalien `suivi-lecture` inchangé,
  12 €.
- Résumé : « Tes livres, livres audio, films, séries et podcasts au même endroit : cherche le titre, la fiche se
  remplit ; note ta page ou ton épisode en deux secondes ; ton rythme, la date où tu finiras, tes objectifs de l'année
  au jour près et tes statistiques. »
- Description, ajouts à la fiche actuelle (`docs/templates/communication/lecture/gumroad.json`) : remplacer « Tout se
  saisit à la main : aucun livre n'est cherché en ligne… » par « Recherche des titres (Open Library, Wikidata, Apple) : seuls
  les mots tapés sont envoyés, jamais ta bibliothèque ; saisie à la main toujours possible. » ; ajouter les puces films
  (minutes, « Vu en entier »), séries (saison et épisode, « 1 épisode »), podcasts (épisodes), objectifs par média ;
  phrase « Tu as acheté le Suivi de lecture ? Cette version est incluse, ta clé l'ouvre. »
- Bouton du reçu : « Ouvrir mon suivi culturel ».
