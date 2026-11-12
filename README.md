# Quentin Morel Engineering

Site promotionnel de Quentin Morel Engineering (QME).

## Structure

- `index.html` : page principale (français)
- `en/index.html` : version anglaise (`/en/`), mêmes sections ; drapeaux français / anglais en tête de
  page pour passer de l'une à l'autre, balises `hreflang` sur les deux pages
- `assets/QME-brochure-en.pdf`, `assets/QME-references-en.pdf`, `assets/qme-presentation-en.mp4` (et son
  affiche) : plaquette, références et vidéo en anglais. Sources et scripts de génération dans le dépôt
  Nexora, `docs/qme/en/`
- `assets/qme-presentation.mp4` et `assets/qme-presentation-en.mp4` (60 s) : vidéo de démonstration. Depuis le
  03/11/2026 (nexora#1488), musique « Corporate » de litesaturation (Pixabay, licence Pixabay : usage
  commercial sans attribution), normalisée à -16 LUFS, fondu de sortie de 3 s ; image inchangée. Les
  musiques des vidéos tournent sur 4 pistes, décrites dans le dépôt Nexora, `docs/qme/musiques/`
- `assets/site.css` : styles
- `assets/site.js` : interactions du menu et soumission du formulaire (Netlify Forms)
- `assets/*.png` : identité visuelle QME
- `assets/*.webp` : captures des références (données fictives ou anonymisées). Thalvego (`thalvego-*.webp`,
  bloc mis en avant en tête des références) vient du site vitrine du dépôt `thalvego` ; NutriQuest
  (`nutriquest-journee.webp`) est rendu avec des données inventées. Sources et PDF : dépôt Nexora, `docs/qme/`
  (`node docs/qme/build.mjs`, puis `node docs/qme/en/build.mjs`)
- `assets/thalvego-film.mp4` (52 s, 1280 × 720, 6,9 Mo) et son affiche : film du site vitrine Thalvego
  (dépôt `thalvego`, `site-vitrine/film/`), réencodé en 720p ; lu seulement au clic (`preload="none"`)
- Section « Vidéos » (`#videos`, FR et EN) : film Thalvego et `assets/wod-motion-competition.mp4` (30 s,
  720p, 3,1 Mo, spot WOD Motion d'une compétition fictive « QME Affiliates Cup », musique synthétisée ;
  générateur dans le dépôt Nexora, `docs/qme/wod-competition/`). Plaquette et références y renvoient.
- `assets/wod-motion-competition-en.mp4` (30 s, 720p, 3,1 Mo) et son affiche : version anglaise du spot, servie
  par `en/index.html` depuis le 03/11/2026 (nexora#1491). Textes de `config-en.json`, musique « Motivational
  Corporate Bed Music » d'osynthw (Pixabay, piste 2 de la rotation), normalisée à -14 LUFS
- `netlify.toml` : configuration de publication Netlify

## Développement local

Le site est statique (pas d'étape de compilation). Pour tester la page seule, ouvrir `index.html`
directement ou lancer un serveur HTTP local. L'envoi du formulaire ne fonctionne qu'une fois
le site publié sur Netlify (Netlify Forms).

## Formulaire

Le formulaire de contact (pages française et anglaise) utilise **Netlify Forms** : formulaire
`contact`, déclaré par `data-netlify="true"` dans le HTML et envoyé en `fetch` (encodage
`application/x-www-form-urlencoded`) vers la racine du site par `assets/site.js`. Le champ caché
`company_website` sert de pot de miel (`netlify-honeypot`) ; le champ caché `langue` indique la page
d'origine (`fr` ou `en`).

Sur la page anglaise, les libellés sont traduits mais les valeurs envoyées (`need`) restent en français.

Prérequis côté Netlify (site `qme-engineering`) :

- détection des formulaires activée (Site configuration → Forms → Enable form detection) ;
- notification par email de chaque demande vers `quentin.morel@qm-engineering.fr`
  (Forms → Form notifications).

Les demandes sont aussi consultables dans l'interface Netlify (Forms → `contact`). Un lien `mailto:`
reste disponible en repli si l'envoi échoue.

L'ancien relais signé vers Nexora (`netlify/functions/contact.mts`) a été retiré : l'endpoint
d'ingestion côté Nexora a été supprimé le 21/10/2026 (nexora#1223).

## Domaines

- Domaine principal : **https://qm-engineering.fr** (adresse de contact `quentin.morel@qm-engineering.fr`).
- `www.qm-engineering.fr`, `qm-engineering.cloud`, `www.qm-engineering.cloud` et l'ancien sous-domaine
  Netlify du site redirigent en 301 vers le domaine principal, chemin conservé (règles `[[redirects]]`
  de `netlify.toml`, seul endroit où l'ancien sous-domaine reste écrit, pour pouvoir le rediriger).
- Côté Netlify (site `qme-engineering`) : `qm-engineering.fr` en domaine principal, les trois autres
  en alias. Côté registrar : faire pointer les deux domaines vers Netlify (serveurs de noms Netlify DNS,
  ou enregistrements `A`/`CNAME` indiqués par Netlify), sans toucher aux enregistrements `MX` de la
  messagerie de `qm-engineering.fr`.

## Déploiement

Le dépôt est destiné au site web QME uniquement. La publication Netlify utilise la racine du dépôt
pour les fichiers statiques.
Aucune fusion ni publication sans feu vert explicite de Quentin (déploiements Netlify facturés).

## Idées et développement des templates

Liste des idées : `docs/templates/IDEES.md`. Méthode de développement : skill
`.claude/skills/nouveau-template/`. Ces chemins et `CLAUDE.md` ne sont pas servis par Netlify.

## Pages du site

- `/` et `/en/` : deux offres présentées à égalité en tête (« Sur mesure » et « Templates »), puis une
  section `#templates` après l'offre sur mesure.
- `/templates/` : catalogue des templates (indexé), fiche du planning de révision, fonctionnement, FAQ.
- `/connexion/` : espace acheteurs. Accepte une clé de licence Gumroad ou un code `REV-…`, l'enregistre
  pour le template concerné et l'ouvre ; liste les templates déjà ouverts sur l'appareil.
- Captures et couverture Gumroad : `assets/templates-revision-*.webp`, `assets/templates-revision-couverture.png`.

## Templates payants (`/templates/`)

Applications web vendues à l'unité, ouvertes avec un **code d'accès** remis à l'achat. Les données de
l'acheteur sont enregistrées en ligne (Netlify Blobs) et suivent le code sur tous ses appareils ; une
copie est gardée dans le navigateur pour le hors-ligne. Pages non indexées (`X-Robots-Tag`).

- `templates/revision/` : **planning de révision** par répétition espacée (J+1, J+3, J+7, J+14, J+30,
  ajustés selon la réponse « difficile / moyen / facile », bornés par la date d'examen, révision finale
  2 jours avant). Base intégrée dans `donnees.js` : 12 formations avec leurs matières, 12 méthodes de
  révision. Installable sur téléphone (manifeste + service worker). Mode démo sans code (données
  d'exemple, locales).
- `netlify/functions/templates.mjs` : API `/api/templates/*` (connexion, lecture, enregistrement, conflit
  entre appareils en 409). Logique testable dans `netlify/lib/templates-acces.mjs`.

**Vente (Gumroad).** Fiche « Planning de révision » sur la boutique Gumroad QME (14,90 €). Gumroad envoie à
l'acheteur une **clé de licence** ; à la connexion, la fonction la vérifie auprès de l'API Gumroad
(`/v2/licenses/verify`, identifiant produit dans `PRODUITS` de `netlify/lib/templates-acces.mjs`) puis la
convertit en code interne stable : mêmes données sur tous les appareils. Achat remboursé ou contesté :
accès refusé à la connexion suivante. Prérequis Gumroad : clés de licence activées sur le produit.

**Codes d'accès (hors Gumroad).** Format `REV-XXXX-XXXX-XXXX-XXXX` : 40 bits aléatoires + 40 bits de signature HMAC.
Aucun code n'est stocké, la signature suffit à le valider.

- Prérequis Netlify : variable **`TEMPLATES_SECRET`** (32 caractères minimum, ex. `openssl rand -hex 32`).
  Ne jamais la changer après les premières ventes : tous les codes deviendraient invalides et les données
  inaccessibles.
- Générer des codes : `TEMPLATES_SECRET=… npm run code -- REV 10` (même secret que sur Netlify), ou sous
  Windows `outils/templates/generer-codes-REV.bat` (double-clic, secret gardé à côté du script, historique CSV).
- Révoquer un code : ajouter ses 8 caractères aléatoires (2e et 3e blocs, sans tiret) à la variable
  `TEMPLATES_CODES_REVOQUES` (liste séparée par des virgules).

**Tester en local** : `npm install`, puis `npm run dev:templates` (serveur sur le port 8888, stockage en
mémoire, un code valide est affiché au démarrage). Tests de l'API : `npm test`.
