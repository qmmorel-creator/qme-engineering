# Quentin Morel Engineering

Site promotionnel de Quentin Morel Engineering (QME).

## Structure

- Référencement : `robots.txt` (déclare le sitemap ; administration, API, connexion et espace client exclus) et
  `sitemap.xml` (pages publiques à leur URL canonique), généré par `node outils/sitemap/generer.mjs` ; les
  applications `/templates/<slug>/` restent en `noindex` (en-têtes de `netlify.toml`).
  Données structurées JSON-LD (depuis le 14/11/2026) : générées depuis le contenu visible par
  `node outils/seo/donnees-structurees.mjs` (Organization et WebSite sur l'accueil, Product + Offer sur les pages
  catalogue en vente, BreadcrumbList, FAQPage là où une FAQ est affichée ; jamais de note ni d'avis), automatiquement
  pour les packs par `outils/packs/generer.mjs`, contrôlées par `outils/templates/seo.test.mjs` (à relancer après
  tout changement de prix, de FAQ ou de fil d'Ariane). Audit statique : `node outils/seo/audit.mjs`. Dossier de
  référencement (audit, mots-clés, guides proposés, Gumroad, plan d'action) : `docs/seo/`.
- Site en pages (depuis le 13/11/2026, plus de page unique à faire défiler ; réorganisé le 20/11/2026 pour séparer
  nettement les deux offres) :
  - menu : Sur mesure · Templates · Packs · Connexion (lien discret) · « Parler de votre projet » ; pied de page identique
    sur toutes les pages (Accueil, Sur mesure, Templates, Packs, Guides, Contact, Connexion, Confidentialité). Plus
    d'enchaînement « page précédente / suivante » entre les pages principales (seuls restent les retours au catalogue
    ou aux packs en bas des fiches) ;
  - `index.html` (accueil) : aiguillage entre les deux offres, puis le film ;
  - `sur-mesure/` : une seule page pour le volet entreprise, avec les PDF à télécharger, l'offre, `#references`,
    `#videos`, `#methode` (méthode, formats, présentation de Quentin) et un appel au contact. Les anciennes pages
    `/references/` et `/methode/` (et `/en/references/`, `/en/method/`) redirigent en 301 vers ces sections
    (`netlify.toml`), pour les liens déjà publiés. Depuis le 22/11/2026, références en cartes compactes (Thalvego en
    carte de tête sur deux colonnes, puis une carte par référence ; cartes horizontales sur mobile) et vidéos côte à
    côte. Images : vignettes `assets/vignettes/ref-*.webp` tirées de la capture d'origine (`data-source` de chaque
    `<img>`) par `node outils/references/vignettes.mjs` (FR et EN), qui réécrit `src`, `width` et `height` ;
  - `templates/` (catalogue, simplifié le 20/11/2026) : recherche et filtre Professionnel / Vie personnelle en tête,
    puis une tuile par thème (nombre d'outils, prix d'entrée, trois exemples), groupées Pro / Perso ; un clic sur une
    tuile affiche les outils du thème (`?theme=…`), chacun avec sa vignette, « Tous les thèmes » ramène aux tuiles ;
    une recherche affiche directement les outils trouvés. Vignettes : `assets/vignettes/<slug>.webp` (480 × 300,
    12 Ko en moyenne, chargées seulement à l'ouverture d'un thème), tirées de la capture choisie dans
    `outils/x/templates-en.json` (`_captures`) par `node outils/templates/vignettes.mjs`, qui écrit aussi l'attribut
    `data-vignette` des cartes. Templates en préparation masqués par défaut (« Afficher aussi les N en
    préparation », `?avenir=1`), toujours montrés pendant une recherche. Les anciennes vues « Disponibles maintenant »,
    accordéon et « Sommaire » sont supprimées (`?vue=sommaire` est ignoré). Les tuiles et la liste sont construites par
    `assets/site.js` à partir des cartes du HTML (`.vitrine-piste` pour les templates en vente, `.liste-bientot` pour
    ceux en préparation, dont la démo affiche un bandeau « Bientôt en vente ») et des puces de thème, affichées telles
    quelles sans JS. En bas, un bandeau compact vers les packs (généré par `outils/packs/generer.mjs` ; la carte des
    prix complète est sur `/packs/` seulement) ; lien « Proposer une idée de template » en tête du catalogue, relié au
    formulaire Netlify `idee` ;
  - `catalogue/<slug>/` (une page par template), `contact/` (formulaire Netlify `contact`). Les anciennes ancres
    (`/#contact`, `/#references`, `/templates/#gantt`…) redirigent vers la bonne page.
- Compteur d'intérêt : bouton « Je suis intéressé(e) » des pages « Mise en vente prochaine » →
  `POST /api/interets` (`netlify/functions/interets.mjs`, logique `netlify/lib/interets.mjs`, Netlify
  Blobs à Francfort ; le clic n'enregistre aucune donnée personnelle). Après le clic, e-mail facultatif
  pour être prévenu de la mise en vente (export CSV et effacement sur la page admin ; à effacer après
  l'e-mail de mise en vente, au plus tard 12 mois, cf. politique de confidentialité). Suivi en temps réel et export CSV sur `/admin/interets/`
  (non indexée), avec le code administrateur donné par `outils/templates/code-admin-interets.bat`
  (ou `npm run code-admin` avec `TEMPLATES_SECRET`), ou la variable Netlify `INTERETS_ADMIN`.
- Essai gratuit (depuis le 18/11/2026 ; pro depuis le 21/11/2026) : templates vie personnelle et pro en vente, **14 jours sans carte**, puis 30 jours en
  lecture seule, puis effacement ; données reprises à l'achat (clé saisie dans « J'ai acheté »). Page `/essai/` et pages
  catalogue générées par `node outils/essai/generer.mjs` ; API `POST /api/essai` (`netlify/functions/essai.mjs`,
  logique `netlify/lib/essais.mjs`), code d'essai daté et signé accepté par `/api/templates/*` ; module commun
  `assets/essai.js` dans chaque application (bandeau, lecture seule, achat) ; e-mails (merci, prise en main J+2
  propre à chaque template, J-3, fin, avant effacement ; remerciement à l'achat via le ping Gumroad
  `/api/achat`, qui arrête la séquence dès le paiement) envoyés depuis la boîte de Quentin par SMTP (variables `ESSAI_SMTP_*`), tâche quotidienne
  `essais-quotidien.mjs`. Détail, configuration et tests : `docs/templates/essai-gratuit.md`.
- Espace acheteurs `/connexion/` (refait le 22/11/2026) : dès qu'un template est enregistré sur l'appareil, la page
  devient « Mes templates » : épinglés (étoile), récemment ouverts depuis la page, puis regroupement par thème du
  catalogue (repliable, état retenu) avec puces de saut ; recherche instantanée sur le nom, la phrase et le thème
  (Entrée ouvre le premier résultat ; sans résultat, lien vers le catalogue). Recherche, thèmes et récents à partir
  de 5 templates ; en dessous, simple liste. Le formulaire de clé passe dessous (« Ajouter un template »). Épinglés,
  récents et thèmes ouverts restent sur l'appareil (`qme-espace-*` dans `localStorage`). Liste générée par
  `node outils/connexion/generer.mjs` (PRODUITS + cartes de `templates/index.html`), contrôlée par
  `outils/templates/connexion.test.mjs`. Composant commun `assets/espace.js` / `espace.css`, aussi utilisé par le
  tableau de bord des packs `/packs/espace/` (généré par `outils/packs/generer.mjs`, données de thèmes comprises) :
  templates de tous les packs de l'appareil réunis, même recherche, épinglés, récents et thèmes ; bouton « copier le
  code de partage » sur chaque tuile ; « Gérer mes packs » (oublier un pack) et « Ajouter un pack » en dessous.
- Comptes acheteurs (22/11/2026, décision de Quentin) : connexion **par lien envoyé par e-mail, sans mot de passe**
  (`netlify/lib/comptes.mjs`, fonction `/api/compte`, store des essais à Francfort, préfixes `compte/`, `lien/`,
  `limite/`). Un compte est un trousseau : les clés (licences, codes QME, packs, essais) et les préférences de
  l'espace (prénom, noms donnés, masquées, épinglées) ; les applications vérifient toujours leur clé à l'ouverture.
  Chaque achat vérifié par le ping Gumroad (`achats.mjs`) est rangé sous l'adresse de l'acheteur (compte créé au
  besoin) ; les essais sont lus dans l'index des essais par adresse. Lien valable 15 min, à usage unique ; 5 liens par
  heure et par adresse ; session de 90 jours, « déconnecter tous mes appareils », suppression du compte par
  l'acheteur. Client : `assets/compte.js` (synchronisation appareil ↔ compte). Purge quotidienne des traces
  anti-abus (`purgerComptes`, dans `essais-quotidien.mjs`). Tests : `outils/templates/comptes.test.mjs`.
  Politique de confidentialité : section « Compte acheteur ».
- Tableau de bord administrateur centralisé (22/11/2026) : **`/admin/`** (code administrateur), période 7, 30 ou 90
  jours. Indicateurs (visites, essais, ventes, revenu, abonnés réseaux, abonnés aux informations), audience du site
  (GoatCounter : pages vues par jour, pages, sources, pays), entonnoir visites → essais → ventes, essais (par jour, par
  template, conversion, tests exclus), ventes Gumroad (revenu par jour, produits, sources), réseaux (abonnés, vues des
  publications), comptes et préférences, intérêts, **données saisies dans les applications** (espaces de données d'achat et
  d'essai par application, modifiés sur la période, nombre d'éléments, dernière modification ; espaces administrateur et
  essais de test exclus ; contenu jamais transmis, un espace d'achat n'est relié à aucune personne). API `GET /api/tableau?jours=` (`netlify/lib/tableau.mjs`, chaque
  source indépendante). Variables : `GOATCOUNTER_TOKEN` (jeton GoatCounter « Read statistics », créé par Quentin et ajouté sur Netlify le 23/11/2026 ; profil GoatCounter → API, `/user/api`),
  `COMPTEUR_SHEET_PUB` (déjà en place). Montants Gumroad en dollars avec leur équivalent en euros (taux BCE du jour,
  via Frankfurter, sans clé ; dollars seuls si le taux est indisponible). Tests : `outils/templates/tableau.test.mjs`.
- Préférences d'information (22/11/2026) : liste d'opposition (`netlify/lib/preferences.mjs`, adresses et domaines)
  alimentée par le lien « Ne plus recevoir les informations » des annonces (`/api/compte/stop`), la page publique
  `/ne-plus-recevoir/?email=…` (lien de **tout e-mail de prospection**, règle absolue :
  `docs/templates/communication/REGLES-PROSPECTION.md`), la désinscription des e-mails d'essai et l'ajout administrateur
  (`POST /api/compte/opposition`) ; vérification avant envoi `GET /api/compte/opposition?email=` et
  `POST /api/compte/opposition/verifier` ; registre `/admin/registre/` (CSV). Conservation 3 ans.
- Espace personnel (refonte du 23/11/2026) : connecté (ou applications sur l'appareil), `/connexion/` devient un écran
  d'accueil : carte de profil (avatar aux initiales, prénom, e-mail, « Client depuis », synchronisation) et menu
  (Accueil, Mes applications, Mes achats, Préférences ; colonne fixe sur ordinateur, onglets sur téléphone) ;
  « Bonjour / Bonsoir <prénom> » et dernière application ouverte ; cartes « Reprendre » ; alertes d'essai ; lanceur
  d'icônes (`templates/<slug>/icone.svg`, option `grille` d'`assets/espace.js`, favoris, filtres par thème) ; achats
  datés (compte) ; préférences : prénom, interrupteur « Recevoir les informations QME » (liste d'opposition) et actions
  du compte. La clé s'ajoute par la fenêtre « Ajouter une clé » ; l'aide aux visiteurs n'apparaît plus une fois dans
  l'espace.
- Espace personnalisé (`/connexion/`) : « Bonjour <prénom> », situation (achetées, essais avec jours restants et
  bouton d'achat quand connecté), mode « Personnaliser » (renommer, masquer, ordre des épinglés), suggestions
  (compléter le pack le plus avancé, sinon même thème). Un template acheté s'appelle une **application** dans les
  espaces acheteurs ; le catalogue garde « template ».
- Bandeau QME au-dessus de chaque application (23/11/2026, `assets/mes-templates.js`) : « Mon espace » (initiale du
  prénom si connecté) et liens Site QME, Templates, Packs, Sur mesure ; défilant sur téléphone, masqué à l'impression.
- Panneau « Mes templates » dans chaque application (22/11/2026) : `assets/mes-templates.js`, chargé par les 97
  `templates/<slug>/index.html`. Le logo QME de l'en-tête (`.barre .marque`, marqué d'une petite grille) ouvre un
  panneau qui liste les autres templates enregistrés sur l'appareil, avec un badge **Acheté**, **Essai** (code égal
  à `qme-<pre>-essai`, écrit par `essai.js`) ou **Admin** (code `ADM-…`), le template ouvert en tête, puis
  « Mon espace : tout voir » (`/connexion/`) et « Site QME ». Données chargées à la première ouverture :
  `assets/espace-donnees.js` (généré par `node outils/connexion/generer.mjs`). Mêmes badges sur `/connexion/`.
- Le même code administrateur ouvre aussi tous les templates à titre personnel : saisi dans une
  application (elle envoie son préfixe), il donne un espace de données propre à Quentin pour ce template
  (`codeAdminProduit`) ; saisi sur `/connexion/`, il est enregistré pour tous les templates de `PRODUITS`.
- `en/` : version anglaise, mêmes rubriques (`en/custom/` avec `#references`, `#videos` et `#method`, `en/templates/`,
  `en/contact/`) ; drapeaux français / anglais en tête de page, balises `hreflang` entre
  pages jumelles
- `assets/QME-brochure-en.pdf`, `assets/QME-references-en.pdf`, `assets/qme-presentation-en.mp4` (et son
  affiche) : plaquette, références et vidéo en anglais. Sources et scripts de génération dans le dépôt
  Nexora, `docs/qme/en/`
- `assets/qme-presentation.mp4` et `assets/qme-presentation-en.mp4` (60 s) : vidéo de démonstration. Depuis le
  03/11/2026 (nexora#1488), musique « Corporate » de litesaturation (Pixabay, licence Pixabay : usage
  commercial sans attribution), normalisée à -16 LUFS, fondu de sortie de 3 s ; image inchangée. Les
  musiques des vidéos tournent sur 4 pistes, décrites dans le dépôt Nexora, `docs/qme/musiques/`
- `diagnostic/` : test « Combien te coûte ta désorganisation ? » pour Instagram et TikTok (étudiants et jeunes adultes,
  en tutoiement ; 4 questions universelles : budget, tâches, papiers, habitudes ; résultat en euros, heures et séances
  par an, euros convertis en heures de travail si le revenu est donné (méthode du template Temps de vie) ; renvoi à
  l'essai de Mon Budget, Temps de vie, Gestionnaire de tâches, Papiers du foyer et Suivi d'habitudes ; image story
  partageable ; questions des quiz : `assets/quiz-qme.js`), lien court
  `/jeu`. Script `assets/diagnostic.js` (calcul testé par `outils/templates/diagnostic.test.mjs`), styles
  `assets/diagnostic.css`. Plan des jeux et quiz d'acquisition (stories quiz, vidéos TikTok, suites) :
  `docs/templates/communication/jeux/README.md` (depuis le 21/11/2026).
- `defi/` : défi 7 jours entre potes (décision de Quentin du 21/11/2026) : chacun choisit une habitude, invite ses potes
  par lien (jusqu'à 6), coche ses journées tenues pendant 7 jours (le jour même, ou la veille en rattrapage), tableau
  commun, le perdant paie le pari. API `/api/defi` (`netlify/functions/defi.mjs`, logique `netlify/lib/defi.mjs`,
  stockage `netlify/lib/defi-store.mjs` : Netlify Blobs à Francfort, un fichier par participant), jetons personnels
  signés (HMAC de `TEMPLATES_SECRET`), aucune donnée hors pseudo, habitude, pari et jours cochés ; effacement 30 jours
  après la fin (`defi-purge.mjs`, quotidien) ; mention dans `confidentialite/`. Tests : `outils/templates/defi.test.mjs`.
- `en/english-version/` : page de la campagne X (anglais, sur mesure), générée par `node outils/x/generer.mjs` depuis
  `outils/x/templates-en.json` et les pages `catalogue/` : les 97 templates avec une capture, la mention « French
  interface » et un bouton « I'd like it in English » (compteur `/api/interets`, modules `en-<slug>`, e-mail
  facultatif). Lien court `/x` (302, `utm_campaign=x-custom`). Image de partage `assets/x-english-version.png`
  (source `docs/templates/communication/x/partage.html`).
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
- `/guides/` (depuis le 15/11/2026) : guides pratiques indexés (facture impayée, levée des réserves, budget à deux),
  reliés depuis le pied de page et les pages catalogue concernées ; styles `assets/guides.css`, calculateur et
  impression de la check-list `assets/guides.js` (le calculateur charge `templates/budget-commun/regles.js`). Suivi et
  règles de rédaction : `docs/seo/guides.md` ; tests `outils/templates/guides.test.mjs`.
- `/connexion/` : espace acheteurs. Accepte une clé de licence Gumroad ou un code `REV-…`, l'enregistre
  pour le template concerné et l'ouvre ; liste les templates déjà ouverts sur l'appareil.
- `/pro/` et `/perso/` (22/11/2026, `docs/templates/RATIONALISATION.md`) : le catalogue filtré sur une partie (pros ou
  vie perso), son accroche et ses packs ; générées par `outils/parties/generer.mjs`, appelé à la fin de
  `node outils/packs/generer.mjs`, contrôlées par `outils/templates/parties.test.mjs`. Menu de toutes les pages :
  « Pros · Vie perso · Packs · Sur mesure » ; accueil : deux portes et le sur mesure en dessous.
- `/packs/` : packs de templates (une clé, remise de 10 à 25 % selon le nombre de templates), une page par
  pack (`/packs/<slug>/`), pack sur mesure (`/packs/composer/`) et tableau de bord de l'acheteur
  (`/packs/espace/`, non indexé). La page `/packs/` présente une carte par pack (depuis le 20/11/2026 : mosaïque
  des vignettes de ses templates, nom, nombre de templates, remise, prix ; un clic ouvre `/packs/<slug>/`, où sont
  le contenu détaillé, l'achat ou « Je suis intéressé(e) »), filtrée par « Je suis… » sur les publics présents
  dans au moins deux packs ; les anciens liens `/packs/#<slug>` mènent à la page du pack. Les cartes de templates
  des pages de pack portent aussi leur vignette. Vignettes lues sur `templates/index.html` (`data-vignette`) :
  lancer `node outils/templates/vignettes.mjs` avant ce générateur. Pages générées : `node outils/packs/generer.mjs` (données dans
  `netlify/lib/packs.mjs` et `outils/packs/donnees.mjs`). Codes : `npm run code -- PFG`, `npm run code -- SMP BDG,ABN`.
  Depuis le 22/11/2026, une page de pack en vente annonce l'essai gratuit sous les boutons d'achat et propose « Essai gratuit »
  sur chaque outil ouvert à l'essai. Fiches Gumroad des packs (même source) : `node outils/packs/fiches-gumroad.mjs` ; couvertures
  Gumroad des packs (1280 × 720, mosaïque des vignettes) : `node outils/packs/couvertures-gumroad.cjs <slug>…` →
  `assets/packs-<slug>-couverture.png` (serveur local sur le port 8899).
- Téléphone (audit du 22/11/2026, rapport `docs/templates/audit-etudiants-2026-11-22.md`) : sous 640 px, le prix et les boutons
  d'une page catalogue passent avant la liste des fonctions ; sous 600 px, les liens LinkedIn et Instagram sont dans le flux au-dessus
  du pied de page (`assets/site.css`). Aucune démo d'un template en vente n'affiche « Bientôt en vente »
  (`outils/templates/audit-etudiants.test.mjs`).
- Captures et couverture Gumroad : `assets/templates-revision-*.webp`, `assets/templates-revision-couverture.png`.

## Templates payants (`/templates/`)

Applications web vendues à l'unité, ouvertes avec un **code d'accès** remis à l'achat. Les données de
l'acheteur sont enregistrées en ligne (Netlify Blobs, région Francfort `eu-central-1` depuis le 13/11/2026 ; les enregistrements de l'ancienne région par défaut sont recopiés puis effacés à leur première lecture) et suivent le code sur tous ses appareils ; une
copie est gardée dans le navigateur pour le hors-ligne. Pages non indexées (`X-Robots-Tag`).

- `templates/revision/` : **planning de révision** par répétition espacée (J+1, J+3, J+7, J+14, J+30,
  ajustés selon la réponse « difficile / moyen / facile », bornés par la date d'examen, révision finale
  2 jours avant). Base intégrée dans `donnees.js` : 12 formations avec leurs matières, 12 méthodes de
  révision. Installable sur téléphone (manifeste + service worker). Mode démo sans code (données
  d'exemple, locales) : `?demo` (Terminale) ou `?demo=pass` (première année de santé), `&prenom=…` pour
  une démo personnalisée. Depuis le 16/11/2026, règles métier pures dans `regles.js` (tests
  `outils/templates/revision.test.mjs`) : jauge « Prêt pour le jour J » (projection du planning jusqu'à
  l'examen), plan de rattrapage des retards, session guidée (minuteur Pomodoro, feuille blanche comparée
  aux mots-clés, temps de concentration), import d'un programme par copier-coller (chapitres « à venir »),
  force du souvenir estimée, examens blancs à J-10 et J-4, export agenda `.ics` avec rappels, carte de
  régularité et paliers, image de la semaine à partager, lecture facilitée. **Pack Étudiant** : lecture
  seule des templates Notes et moyennes, Planner horaire et Habitudes ouverts sur le même appareil
  (priorités selon les coefficients, créneau libre du jour, sommeil et réussite).
- Première vague (même socle : clé de licence, démo, synchronisation, hors ligne ; règles métier en
  fonctions pures testées dans `outils/templates/<slug>.test.mjs`) :
  - `templates/compte-rendu/` (CRA) : **compte rendu et plan d'actions**, saisie d'action en une ligne,
    actions ouvertes reprises à la réunion suivante de la série, 8 modèles de réunion ;
  - `templates/cout-revient/` (PRX) : **coût de revient et prix par client**, jours ouvrés calculés,
    prix plancher et conseillé, rentabilité par client ;
  - `templates/tjm/` (TJM) : **calculateur de TJM freelance**, taux micro-entreprise 2026 sourcés et
    modifiables, alertes de plafond et de franchise de TVA, 3 scénarios ;
  - `templates/micro-entreprise/` (MCE) : **livre recettes-dépenses micro-entreprise**, registres,
    déclarations, seuils, export CSV ;
  - `templates/budget-commun/` (BCM) : **budget commun**, deux fonctionnements au choix : avances et
    remboursements (répartitions au centime, équilibrage en un minimum de virements) ou compte commun
    (versement mensuel de chacun : charges prévues − solde, selon une clé égale, prorata ou parts, plus les
    charges personnelles ; versements notés, solde estimé) ; fusion des saisies de plusieurs appareils.
- Deuxième vague, en vente : `templates/gantt/` (GNT) **planning Gantt rapide** (chemin critique,
    jours ouvrés, jalons à plage) ; `templates/taches/` (TCH) **gestionnaire de tâches** (boîte de
    réception, triage, rituels) ; `templates/budget/` (BDG) **budget du foyer** (enveloppes, Sankey).
  Chaque application refuse une clé d'un autre produit (`corps.produit`). Taux datés : mise à jour
  annuelle obligatoire (`donnees.js`).
- `templates/secret-santa/` (SNT) : **Secret Santa**, **en vente** (Gumroad, prix libre, 0 €), **gratuit**
  (prix libre sur Gumroad). L'organisateur (clé de licence) crée ses échanges et partage un lien
  d'invitation ; les participants s'inscrivent sans compte (prénom, e-mail, code personnel, idées) ;
  exclusions ; tirage fait par le serveur, jamais montré à l'organisateur ; aucun e-mail envoyé. API
  propre `/api/secret-santa/*` (`netlify/functions/secret-santa.mjs`, moteur partagé avec la démo dans
  `templates/secret-santa/moteur.js`, règles dans `regles.js`, tests `outils/templates/secret-santa.test.mjs`),
  Netlify Blobs à Francfort (magasin `secret-santa`), code personnel haché (scrypt), effacement de
  l'échange 60 jours après sa date (180 jours sans date). Page `catalogue/secret-santa/`, démo
  `/templates/secret-santa/?demo`.
- Lot du 13/11/2026, prêts, « Mise en vente prochaine » (démo libre, pas encore de fiche Gumroad ;
  fiches à créer dans `docs/templates/communication/gumroad-a-creer.json`) : `templates/habitudes/` (HBT)
  **suivi d'habitudes et routines** (cochées ou chiffrées, jours non applicables, séries, grille du mois) ;
  `templates/entretien/` (ENT) **entretien de la maison** (89 tâches types, échéances calculées,
  obligations sourcées et paramétrables) ; `templates/dettes/` (DTT) **remboursement de dettes**
  (boule de neige, avalanche, échéancier et date de fin) ; `templates/abonnements/` (ABN) **suivi des
  abonnements** (coût mensuel et annuel, prélèvements, « à décider avant le … », sans marque ni prix figé).
- Lot du 14/11/2026, prêts, « Mise en vente prochaine » (démo libre, fiches Gumroad à créer dans
  `docs/templates/communication/gumroad-a-creer.json`) : `templates/notes-de-frais/` (NDF) **notes de frais et
  indemnités kilométriques** (justificatifs référencés sans fichier stocké, barème kilométrique fiscal daté et
  modifiable appliqué au cumul annuel, note du mois imprimable) ; `templates/appel-decouverte/` (APD)
  **préparateur d'appel découverte** (84 questions en 7 phases, 25 objections, mode « en appel », score de
  qualification) ; `templates/impayes/` (RCV) **relance des impayés**, en vente depuis le 14/11/2026 (19 €, Gumroad `/l/relance-impayes`) (retard par ancienneté, pénalités
  L441-10 et indemnité D441-5 à taux datés modifiables, messages par palier à copier, rien n'est envoyé) ;
  `templates/onboarding/` (ARD) **onboarding et offboarding salarié** (checklists par profil de J-15 à J+90,
  responsables, matériel remis et rendu). Règles dans `regles.js`, tests `outils/templates/<slug>.test.mjs`.
- Lot du 14/11/2026 (2), prêts, « Mise en vente prochaine » (démo libre, fiches Gumroad à créer dans
  `docs/templates/communication/gumroad-a-creer.json`) : `templates/conges/` (CNG) **suivi des congés et
  absences** (soldes en jours ouvrables ou ouvrés, règles du Code du travail paramétrables, demandes et
  validation, calendrier d'équipe avec fériés et seuil d'absents, aucune donnée de santé) ;
  `templates/stocks/` (STK) **stocks et inventaire** (stock calculé par les mouvements, seuils et liste à
  commander, valeur au coût moyen pondéré ou au dernier prix, inventaire tournant avec écarts) ;
  `templates/location-saisonniere/` (SJR) **location saisonnière** (calendrier sans double réservation,
  ménages, taxe de séjour au tarif saisi de la commune, net par canal nommé par l'utilisateur, aucune
  plateforme connectée) ; `templates/leasing/` (VTR) **simulateur leasing ou achat** (comptant, crédit, LOA,
  LLD comparés sur la même période, revente estimée, coût par mois et par km, seuils de kilométrage).
- `templates/planning-equipe/` (EQP) : **planning d'équipe et staffing**, **en vente** depuis le 14/11/2026 (35 €,
  Gumroad `/l/planning-equipe-staffing`). Affectations par
  personne et par projet ou poste en heures par semaine, taux de charge avec temps partiel, absences et fériés
  déduits, alertes (surcharge, affectation pendant une absence, compétence manquante, poste non couvert, durées
  L3121-20 et L3121-22 paramétrables), vues semaine et mois, « qui est disponible la semaine prochaine ». Une clé
  partagée par les managers : saisies simultanées fusionnées (`fusionner`). Règles dans `regles.js`, tests
  `outils/templates/planning-equipe.test.mjs`.
- `templates/tableau-annuel/` (RDV) : **tableau de bord annuel et roue de vie**, **en vente** depuis le 14/11/2026
  (15 €, Gumroad `/l/tableau-annuel-roue-de-vie`). Roue de vie
  notée par 3 questions par domaine (12 domaines types, 8 au plus), objectifs et résultats clés (méthode OKR, 33
  modèles, cibles à la hausse ou à la baisse) comparés à la part de l'année écoulée, actions trimestrielles (48 idées,
  report des actions restées ouvertes), revue guidée chaque trimestre (bilan annuel au 4e), évolution de la roue
  revue après revue. Règles dans `regles.js`, tests `outils/templates/tableau-annuel.test.mjs`.
- `templates/epargne/` (EPG) : **objectif d'épargne et fonds d'urgence**, prêt, « Mise en vente prochaine »
  (12 €, démo libre, fiche Gumroad à créer : `docs/templates/communication/epargne/gumroad.json`). 12 objectifs
  types (plus « Autre ») avec postes de budget, fonds d'urgence en mois de dépenses essentielles avec repère de taille selon la
  situation, date d'atteinte et versement nécessaire, scénarios d'intérêts composés au taux saisi (aucun taux
  intégré), jalons, historique des versements, plan des 12 prochains mois. Règles dans `regles.js`, tests
  `outils/templates/epargne.test.mjs`.
- `templates/demenagement/` (DMN) : **déménagement**, prêt, « Mise en vente prochaine » (12 €, démo libre, fiche
  Gumroad à créer : `docs/templates/communication/demenagement/gumroad.json`). Rétroplanning de 85 tâches types
  relatif au jour J et filtré par la situation, démarches et contrats sans délai légal chiffré (renvoi au bail,
  aux contrats ou à service-public.fr), cartons numérotés par pièce avec recherche et étiquettes A4, volume
  estimé, devis comparés au m³, budget. Règles dans `regles.js`, tests `outils/templates/demenagement.test.mjs`.
- `templates/propositions/` (PCM) : **propositions commerciales** (T74), prêt, « Mise en vente prochaine » (19 €, démo
  libre, fiche Gumroad à créer : `docs/templates/communication/propositions/gumroad.json`). Contexte, objectifs,
  livrables, blocs de bibliothèque (présentation, méthode, références), options comparées (bon, mieux, premium), planning
  en semaines, conditions, aperçu A4 imprimable ; suivi (validité, relances avec message à copier, réponse et motif,
  taux de transformation en nombre et en valeur), duplication. Prix hors taxes, aucune règle légale : mentions et TVA
  renvoyées au devis (T36). Règles dans `regles.js`, tests `outils/templates/propositions.test.mjs`.
- `templates/document-unique/` (DRP) : **document unique d'évaluation des risques** (T80), **en vente** depuis le
  14/11/2026 (29 €, Gumroad `/l/document-unique-evaluation-risques`, fiche : `docs/templates/communication/document-unique/gumroad.json`).
  Unités de travail, 20 familles de risques inspirées de l'INRS ED 840 (reformulées), démarrage par secteur, cotation
  gravité × probabilité sur grille paramétrable, risque initial et résiduel, matrice, plan d'actions (programme
  annuel dès 50 salariés), événements, versions archivées et figées, document imprimable. Obligations selon
  l'effectif sourcées et datées (service-public.gouv.fr et INRS, consultés le 14/11/2026 : à revérifier chaque
  année). Règles dans `regles.js`, tests `outils/templates/document-unique.test.mjs`.
- `templates/notes/` (NTS) : **notes et moyennes** (T88), prêt, « Mise en vente prochaine » (12 €, démo libre, fiche
  Gumroad à créer : `docs/templates/communication/notes/gumroad.json`). Années, semestres ou trimestres, UE et
  matières avec coefficients ou crédits ECTS, notes avec barème et coefficient propres (sur 20, 10, 100 ou lettres),
  moyennes pondérées comparées aux seuils au centième, règles du diplôme saisies (compensation totale, par UE ou
  aucune, note éliminatoire, rattrapage, compensation entre semestres, mentions), note nécessaire aux épreuves à
  venir (dichotomie), courbe de la moyenne, relevé imprimable, export CSV. Aucun barème officiel intégré. Règles dans
  `regles.js`, tests `outils/templates/notes.test.mjs`.
- `templates/etat-des-lieux/` (ETD) : **état des lieux d'entrée et de sortie** (T94), **en vente** depuis le 14/11/2026
  (19 €, Gumroad `/l/etat-des-lieux`, fiche : `docs/templates/communication/etat-des-lieux/gumroad.json`). Un dossier par
  bail, pièces et éléments types modifiables (mobilier en meublé), état codé (neuf, bon, usage normal, dégradé, hors
  service) avec commentaire et vignette photo (réduite dans le navigateur, synchronisée, 30 par compte par défaut),
  compteurs et clés, sortie comparée à l'entrée (usure normale distinguée des dégradations), vétusté selon la grille
  saisie (aucune intégrée), retenues proposées, délai de restitution du dépôt de garantie et de rectification de
  l'entrée (service-public.gouv.fr F31270, F33671, F31269, consultées le 14/11/2026), document imprimable à signer,
  export CSV. Outil d'aide, pas un document certifié. Règles dans `regles.js`, tests
  `outils/templates/etat-des-lieux.test.mjs`.
- `templates/seminaire/` (SMN) : **séminaire / offsite** (T54), prêt, « Mise en vente prochaine » (35 €, démo libre,
  fiche Gumroad à créer : `docs/templates/communication/seminaire/gumroad.json`). Déclinaison du pilote événementiel pour
  les assistants de direction, RH et office managers : plusieurs séminaires par clé ; participants et réponses (saisie
  rapide depuis un tableur, relance après la date limite, suivi par service) ; trajets aller et retour avec places et
  passagers, horaires comparés au programme ; chambres, occupants et répartition automatique des confirmés par service,
  liste imprimable pour l'hébergement ; programme en salles parallèles, chevauchements, décalage en cascade ; budget
  prévu / engagé / payé, paiements en retard, coût par participant confirmé. **RGPD** : régime en liste fermée, cases
  allergie et accessibilité sans détail, saisie facultative, fiche traiteur en nombres seulement, export CSV sans données
  sensibles par défaut, effacement des données sensibles d'un séminaire. Rattaché à aucun pack. Règles dans `regles.js`,
  tests `outils/templates/seminaire.test.mjs`.
- `templates/quiz/` (QZZ) : **banque de questions et quiz** (T58), prêt, « Mise en vente prochaine » (19 €, démo libre,
  fiche Gumroad à créer : `docs/templates/communication/quiz/gumroad.json`). Questions étiquetées (QCM à une ou plusieurs
  bonnes réponses, vrai ou faux, réponse courte avec variantes), difficulté, points, explication ; collage d'une liste ;
  quiz tirés par étiquettes, difficulté et type, propositions mélangées ; sujet imprimable et corrigé à part ; sessions
  anonymes ou nominatives (prénom et initiale, ou pseudonyme), note automatique, réponses courtes non reconnues « à
  vérifier » ; statistiques par question et par étiquette, questions trop faciles ou trop difficiles, distracteur le plus
  choisi. **RGPD** : mention au premier lancement, export JSON et CSV, effacement d'un apprenant, d'une session ou de tous
  les résultats, anonymisation, rappel de conservation ; aucune question fournie. Rejoint le Pack Écoles et formateurs.
  Règles dans `regles.js`, tests `outils/templates/quiz.test.mjs`.
- `templates/pilotage-pme/` (TDB) : **tableau de bord de pilotage PME**, prêt, « Mise en vente prochaine » (39 €, démo
  libre, fiche Gumroad à créer : `docs/templates/communication/pilotage-pme/gumroad.json`). Bibliothèque de 45 indicateurs
  types en 6 domaines (définition, formule, sens de lecture, source), 14 calculés, 5 jeux de départ, aucun ratio
  sectoriel de référence ; saisie mensuelle, objectifs annuels répartis (égale, saisonnière, mois par mois), seuils,
  écarts, tendances, projection, revue mensuelle imprimable avec actions. Règles dans `regles.js`, tests
  `outils/templates/pilotage-pme.test.mjs`.
- `templates/suivi-chantier/` (CHT) : **suivi de chantier par lot**, prêt, mise en vente prochaine (40 €, démo
  libre, fiche Gumroad à créer : `docs/templates/communication/suivi-chantier/gumroad.json`). Marché et avenants
  par lot, situations de travaux calculées depuis le cumul (révision par coefficient K saisi, retenue de
  garantie, pénalités, date de paiement), échéancier et courbe prévu / réalisé, jalons recalés par les avenants
  et les intempéries retenues du journal, sous-traitants, non-conformités simplifiées, risques en matrice
  4 × 4, courriers et ordres de service, revue de projet imprimable ; plusieurs opérations par clé. Aucun
  indice ni taux réglementaire intégré. Règles dans `regles.js`, tests `outils/templates/suivi-chantier.test.mjs`.
- `templates/maintenance/` (GMA) : **maintenance préventive (GMAO légère)**, prêt, « Mise en vente prochaine » (39 €,
  démo libre, fiche Gumroad à créer : `docs/templates/communication/maintenance/gumroad.json`). 16 familles
  d'équipements et leurs plans types (périodicités indicatives ; seules les chaudières 4–400 kW et climatisations 4–70 kW
  portent une obligation sourcée, datée ; autres vérifications réglementaires à paramétrer), échéances à la date, au
  compteur ou au premier atteint, bons d'intervention imprimables, pièces de rechange, coût par équipement, indicateurs.
  Règles dans `regles.js`, tests `outils/templates/maintenance.test.mjs`.
- `templates/voyage/` (VYG) : **planificateur de voyage**, prêt, « Mise en vente prochaine » (13 €, démo libre, fiche
  Gumroad à créer : `docs/templates/communication/voyage/gumroad.json`). Étapes, hébergement de chaque nuit (réservé
  ou à réserver, acompte, reste à payer, nuits sans toit signalées), transports, activités jour par jour, budget
  prévu et réel par poste et par personne, dépenses partagées et qui doit quoi, bagages par type de séjour et
  documents à prévoir (formalités renvoyées aux sources officielles). Dépenses partagées : moteur du budget commun,
  `templates/budget-commun/regles.js` chargé tel quel (et gardé hors ligne par `sw.js`). Règles dans `regles.js`,
  tests `outils/templates/voyage.test.mjs`.
- `templates/calendrier-editorial/` (CED) : **calendrier éditorial des réseaux professionnels**, prêt, « Mise en vente
  prochaine » (15 €, démo libre, fiche Gumroad à créer : `docs/templates/communication/calendrier-editorial/gumroad.json`).
  Piliers avec part visée, objectif de publications par semaine, banque de 92 sujets pour 8 métiers avec 11 trames,
  statuts idée → brouillon → programmé → publié, calendrier mois et semaine, brouillon avec compteur de caractères
  (limite saisie par canal, aucune règle de réseau intégrée), statistiques saisies à la main, régularité (semaines
  tenues, pauses, série) et recyclage. Aucune marque ni connexion à un réseau social. Préfixe entièrement hexadécimal :
  une saisie de plus de 19 caractères est lue comme une clé Gumroad. Règles dans `regles.js`, tests
  `outils/templates/calendrier-editorial.test.mjs`. Version anglaise en attente.
- `templates/verifications/` (VRF) : **vérifications réglementaires**, prêt, « Mise en vente prochaine » (35 €, démo
  libre, fiche Gumroad à créer : `docs/templates/communication/verifications/gumroad.json`). Registre des contrôles
  périodiques par site : 22 types avec périodicité sourcée (brochure INRS ED 828, édition de septembre 2026, page et
  textes cités, consultée le 14/11/2026, à revérifier à chaque édition) ou saisie par l'utilisateur, échéances,
  organismes, observations suivies jusqu'à leur levée avec preuve (référence et lien, pas de fichiers), délai de
  2 ans des installations électriques sous conditions, calendrier, registre imprimable par site. Règles dans
  `regles.js`, tests `outils/templates/verifications.test.mjs`. Version anglaise en attente.
- `templates/competition/` (CMP) : **gestion de compétition sportive**, prêt, « Mise en vente prochaine » (49 €, démo
  libre, fiche Gumroad à créer : `docs/templates/communication/competition/gumroad.json`). Inscriptions par catégorie
  (individuel ou équipes), épreuves au temps (temps limite, « CAP+n »), aux répétitions, à la charge ou aux points,
  départage, vagues équilibrées et horaires, alertes de repos, feuilles de juge, saisie des scores, classement
  paramétrable (somme des rangs ou barème, coefficient, départage général), mode écran. **Lien public en lecture
  seule** : API propre `/api/competition/*` (`netlify/functions/competition.mjs`, moteur
  `templates/competition/moteur.js`, dépendances `netlify/lib/competition.mjs`), magasin Netlify Blobs
  `competition-public` à Francfort, instantané reconstruit champ par champ (aucune coordonnée), mis en cache 15 s par
  le CDN, effacé 30 jours après la compétition (à la lecture et par `competition-purge.mjs`, quotidienne). Page
  publique `/templates/competition/?ecran=<id>`. Règles dans `regles.js`, tests `outils/templates/competition.test.mjs`.
- Lot du 14/11/2026 (3), prêts, « Mise en vente prochaine » (démo libre, fiches Gumroad à créer dans
  `docs/templates/communication/gumroad-a-creer.json`) : `templates/repas/` (RPS) **repas de la semaine et
  liste de courses** (100 recettes de base, repas midi et soir, liste de courses par rayon calculée selon les
  portions, placard déduit, aucun prix intégré, pas de calories) ; `templates/musculation/` (MSC) **carnet de
  musculation et cross-training** (150 exercices, séances et WOD, records détectés, 1RM estimé, minuteur hors
  ligne, aucune donnée de santé) ; `templates/voiture/` (CAR) **carnet de voiture** (entretiens à la date ou au
  km, contrôle technique sourcé et paramétrable, pleins et recharges, consommation, coût au km) ;
  `templates/gestion-locative/` (GST) **gestion locative** (loyers et retards, quittances et relances à
  copier, révision avec l'IRL saisi, régularisation des charges, rendement avant impôt, aucun calcul d'impôt).
- `templates/salles/` (SDR) : **réservation de salles et bureaux**, prêt, « Mise en vente prochaine » (19 €, démo libre,
  fiche Gumroad à créer : `docs/templates/communication/salles/gumroad.json`). Salles (capacité, équipements), bureaux en
  flex et matériel prêté ; une clé partagée par l'équipe, nom saisi à chaque réservation, pas de comptes ; conflits refusés
  à la saisie et rejoués à l'enregistrement en ligne (conflit 409 entre deux appareils) ; « libre maintenant », vues jour et
  semaine, réservations chaque semaine, taux d'occupation, jours fériés calculés. Règles dans `regles.js`, tests
  `outils/templates/salles.test.mjs`.
- Lot du 14/11/2026 (5), prêts, « Mise en vente prochaine » (démo libre, fiches Gumroad à créer dans
  `docs/templates/communication/gumroad-a-creer.json`) : `templates/bascule/` (BSC) **pilotage d'une journée de
  bascule** (déroulé horaire avec responsables et dépendances, recalculé à chaque étape notée : retard cumulé, fin
  estimée, marge ; go/no-go sur critères, points d'arrêt, plan de retour arrière avec heure limite calculée ; journal
  d'incidents, point de situation à copier ; 5 séquences types fictives) ; `templates/gestion-classe/` (CSE)
  **gestion de classe** (élèves en prénom et initiale ou pseudonyme, notes sur barème libre ramenées sur 20,
  coefficients, ABS / NN / dispensé, statistiques de classe, compétences sur quatre échelons du socle commun,
  banque d'appréciations, bulletins imprimables, effacement de fin d'année ; **RGPD à trancher par Quentin avant
  la vente**, données d'élèves mineurs hébergées en ligne).
- Lot du 14/11/2026 (6), prêts, « Mise en vente prochaine » (démo libre, fiches Gumroad à créer dans
  `docs/templates/communication/gumroad-a-creer.json`) : `templates/emploi-du-temps/` (EDT) **emploi du temps
  d'établissement** (organismes de formation, écoles privées : groupes avec effectif, formateurs avec disponibilités et
  quota, salles avec capacité et équipements, modules avec volume prévu ; séances placées à la main sur une grille
  semaine, vues par groupe, formateur et salle ; conflits détectés à la saisie ; heures réalisées, placées et prévues ;
  semaines A/B, fermetures, jours fériés calculés ; duplication de semaine ; impression A4 paysage ; export CSV ; aucun
  nom d'apprenant, aucune optimisation automatique) ; `templates/parcs-multi-sites/` (PRK) **pilotage de parcs
  multi-sites** (exploitants immobilier et équipements : sites, équipements par site avec criticité et état, préventif
  périodique à échéance calculée, correctifs avec délai de résolution, prestataires nommés par l'utilisateur, coûts ;
  indicateurs par site et consolidés : disponibilité, retards, délai moyen, coût par site et par catégorie, préventif à
  temps ; alertes ; carte schématique en SVG des coordonnées saisies, sans fond de carte ni service externe ; import et
  export CSV au format tableur, modèles vides téléchargeables ; démo entièrement fictive). Règles dans `regles.js`,
  tests `outils/templates/<slug>.test.mjs`.
- `templates/suivi-temps/` (TMP) : **suivi du temps et rentabilité par mission** (T73), prêt, « Mise en vente
  prochaine » (19 €, démo libre, fiche Gumroad à créer : `docs/templates/communication/suivi-temps/gumroad.json`).
  Chronomètre synchronisé entre appareils ou saisie en une ligne, temps facturable ou non ; missions au forfait ou en
  régie, budget en jours ou heures, avancement, estimation à terminaison, alertes ; taux horaire effectif (montant
  facturé ÷ temps réel) face au TJM cible, au devis et au coût de revient saisis (mêmes notions que `tjm` et
  `cout-revient`) ; semaine type, rentabilité par période, rapport client imprimable, export CSV. Aucun taux ni tarif
  intégré. Règles dans `regles.js`, tests `outils/templates/suivi-temps.test.mjs`.
- `templates/achats/` (ACH) : **demandes d'achat et fournitures** (T82), prêt, « Mise en vente prochaine » (19 €, démo
  libre, fiche Gumroad à créer : `docs/templates/communication/achats/gumroad.json`). Demandes par service (quantité,
  urgence, motif), validation avec seuil automatique (prix estimé et budget suffisant), commandes groupées par fournisseur
  et bon imprimable, réception partielle et prix réel, budget annuel par service (consommé, engagé, en attente),
  catalogue de 104 fournitures sans prix ni marque, historique et export CSV. Une clé partagée, nom saisi à chaque étape ;
  actions rejouées sur la version du serveur en cas de conflit 409. Aucune règle légale ni fiscale. Règles dans
  `regles.js`, tests `outils/templates/achats.test.mjs`. Version anglaise en attente.
- `templates/subventions/` (SBV) : **subventions** (T91), prêt, « Mise en vente prochaine » (25 €, démo libre, fiche
  Gumroad à créer : `docs/templates/communication/subventions/gumroad.json`). Dossiers par financeur (commune, département,
  région, État, fondations, mécénat) et par projet, pièces à fournir avec statut, échéances saisies (dépôt, réponse,
  versements, bilan) et alertes, demandé / accordé / versé / reste à percevoir, budget prévisionnel avec la part de chaque
  financeur, dépenses justificatives imputables à un dossier, trame du bilan imprimable, tableau de bord annuel, CSV.
  Aucun calendrier de financeur intégré. Rappels des subventions publiques (convention au-delà de 23 000 €, compte rendu
  financier à 6 mois, comptes annuels au-delà de 153 000 €) repris de service-public.gouv.fr (fiches F3180 et R46623,
  consultées le 14/11/2026), désactivables. Règles dans `regles.js`, tests `outils/templates/subventions.test.mjs`.
  Version anglaise en attente.
- `templates/copropriete/` (CPR) : **charges et AG de copropriété** (T96), prêt, « Mise en vente prochaine » (15 €,
  démo libre, fiche Gumroad à créer : `docs/templates/communication/copropriete/gumroad.json`). Lots et tantièmes
  (plusieurs copropriétés par clé), appels de fonds (provisions, fonds de travaux, travaux votés) payés ou à payer,
  4 appels trimestriels générés depuis le budget, décompte annuel par poste, régularisation, part récupérable sur le
  locataire saisie par poste (aide limitée aux catégories citées par la fiche F947), évolution sur plusieurs exercices,
  AG (ordre du jour, majorité saisie, intention de vote, résultat), travaux votés avec échéancier, documents à conserver
  (référence de rangement), alertes, CSV. Aucune règle de majorité intégrée. Repères service-public.gouv.fr (F20586,
  F34026, F947, consultées le 14/11/2026), désactivables. Règles dans `regles.js`, tests
  `outils/templates/copropriete.test.mjs`. Version anglaise en attente.
- `templates/references-plaquette/` (KRF) : **kit références et plaquette**, prêt, « Mise en vente prochaine » (19 €,
  démo libre, fiche Gumroad à créer : `docs/templates/communication/references-plaquette/gumroad.json`). Une fiche par
  réalisation (contexte, mission, résultats chiffrés saisis, témoignage, mots-clés, visuel réduit dans le navigateur),
  modèles de 9 métiers, client anonymisé sans accord noté, alertes de confidentialité, note de complétude, filtres ;
  sélections par prospect avec suggestions par pertinence ; plaquette A4 en trois mises en page (impression ou PDF
  du navigateur) et texte à copier. Règles dans `regles.js`, tests `outils/templates/references-plaquette.test.mjs`.
- `templates/doe/` (RDE) : **registre du DOE** (T77, 29 €), prêt, « Mise en vente prochaine » (démo libre, fiche
  Gumroad à créer : `docs/templates/communication/doe/gumroad.json`). Pièces du dossier des ouvrages exécutés par
  opération, lot et entreprise ; base de 20 lots types avec leurs pièces attendues (plans, notices, PV d'essais,
  fiches techniques, garanties), modifiable ; pièce « Éléments pour le DIUO » par lot si l'opération en comporte un ;
  statuts attendue, reçue, à reprendre (motif), validée ; date limite par opération ou par pièce ; relances datées
  avec courrier à copier ou imprimer (aucun envoi) ; complétude par lot, entreprise et famille ; bordereau de
  transmission et état des pièces manquantes imprimables ; export CSV. Seule référence : article 40 du CCAG Travaux
  2021, en paraphrase datée. Fiche `docs/templates/fiches/doe.md`, tests `outils/templates/doe.test.mjs`.
- `templates/sous-traitants/` (STR) : **conformité des sous-traitants**, prêt, mise en vente prochaine (29 €). Opérations,
  lots, titulaires et sous-traitants par rang (donneur d'ordre), acceptation et agrément des conditions de paiement
  (loi n° 75-1334), pièces de vigilance par entreprise avec date de validité (attestation Urssaf, Kbis, liste des
  salariés étrangers, décennale ; seuil de 5 000 € HT, durées et pièces paramétrables, sources lues le 14/11/2026 et
  citées dans le guide), alertes J-30 / J-15 / expirée, relances depuis un modèle (copie ou messagerie), tableau de
  conformité par opération, registre imprimable A4 paysage, export CSV ; aucun document stocké, outil d'aide sans
  valeur de conseil juridique. Règles dans `regles.js`, tests `outils/templates/sous-traitants.test.mjs`.
- `templates/appels-offres/` (CND) : **suivi des appels d'offres et candidatures**, prêt, mise en vente prochaine
  (15 €, freelances, consultants et PME ; pack visé « Freelance : trouver ses clients »). Veille avec grille go/no-go
  (8 critères pondérés, éliminatoires, seuils réglables) ; dossier par candidature avec pièces types copiées d'un
  modèle (marché public, appel d'offres privé, mission sur plateforme, consultation directe ; points de départ sans
  référence réglementaire, la liste exacte est celle du règlement de chaque consultation), statut, responsable et
  échéance à rebours depuis la date limite ; dépôt visé avec marge ; calendrier des dates limites ; relances après
  dépôt, validité des offres ; résultat (montant, motif, classement) ; bibliothèque de pièces réutilisables
  (emplacement et date de validité, pas de fichier) ; bilan : taux de go et de réussite par type, montants, temps
  passé, motifs de perte ; export CSV. Aucune connexion à une plateforme ni à un profil d'acheteur. Règles dans
  `regles.js`, tests `outils/templates/appels-offres.test.mjs`, page `catalogue/appels-offres/`, démo
  `/templates/appels-offres/?demo`.
- `templates/entretiens-annuels/` (ENP) : **entretiens annuels et professionnels** (T79), prêt, « Mise en vente
  prochaine » (19 €, démo libre, fiche Gumroad à créer : `docs/templates/communication/entretiens-annuels/gumroad.json`).
  Échéances par salarié : annuel (facultatif, 12 mois), entretien de parcours professionnel (première année puis
  48 mois), état des lieux des 8 ans, retour d'absence, mi-carrière, avant 60 ans ; périodicités sourcées
  (service-public.gouv.fr F32040, relevé du 14/11/2026, `donnees.js`) et modifiables, mise à jour annuelle.
  Trames originales (58 questions), questionnaire de préparation copiable, compte rendu imprimable, objectifs SMART
  reconduits d'une année sur l'autre, demandes de formation, contrôle de l'état des lieux (abondement CPF à
  50 salariés et plus). RGPD : données minimales, export et effacement par salarié. Règles dans `regles.js`, tests
  `outils/templates/entretiens-annuels.test.mjs`.
- `templates/contrats/` (CTR) : **contrats fournisseurs et échéances**, prêt, « Mise en vente prochaine » (25 €,
  démo libre, fiche Gumroad à créer : `docs/templates/communication/contrats/gumroad.json`). Contrats par fournisseur et
  catégorie, échéance avec reconduction tacite, préavis (contrat ou défaut paramétrable de la catégorie), date limite
  de résiliation calculée, alertes J-60 et J-30, décision, lettre de résiliation à adapter, coût annuel par catégorie,
  historique, export CSV. Aucune règle légale non sourcée (seul repère : Code des assurances, art. L113-12, lu sur
  Légifrance le 14/11/2026). Règles dans `regles.js`, tests `outils/templates/contrats.test.mjs`. Version anglaise en attente.
- Lot du 14/11/2026 (7), prêts, « Mise en vente prochaine » (démo libre, fiches Gumroad à créer dans
  `docs/templates/communication/gumroad-a-creer.json`) : `templates/garde-manger/` (GRD) **garde-manger et dates de
  péremption** (inventaire par lieu : réfrigérateur, congélateur, placard et lieux personnalisables ; quantité,
  catégorie, date imprimée ; DLC et DDM distinguées : DLC dépassée « ne pas consommer », DDM dépassée « à vérifier » ;
  date d'ouverture et délai de l'emballage ; décongelé à finir sous 3 jours ; au congélateur, date fixée par
  l'utilisateur ; vue « à consommer en priorité » (dépassé, aujourd'hui, 3 jours, semaine) ; consommé ou jeté avec
  motif et valeur, bilan du gaspillage sur six mois ; liste de courses issue des produits épuisés ; définitions et
  deux seules durées reprises de l'Anses, source et date affichées ; aucun scan ni base produit) ;
  `templates/lecture/` (PGS) **suivi de lecture** (bibliothèque papier, numérique et audio avec genres modifiables,
  statuts à lire / en cours / lu / abandonné ; sessions en page atteinte, pages lues ou minutes écoutées, qui font
  suivre le statut ; progression, rythme sur 14 jours et date de fin estimée ; objectif annuel en livres et en pages
  avec l'avance ou le retard au jour près, projection et rythme nécessaire ; statistiques par mois, genre, format et
  auteur, pages par jour, séries de jours de lecture ; note, avis et citations ; liste à lire par priorité ; export
  CSV ; aucune base de livres ni couverture, aucune liseuse ni librairie) ; `templates/animal/` (ANM) **suivi d'un
  animal de compagnie** (un ou plusieurs animaux, chien, chat ou autre, identification en saisie libre ; soins
  récurrents avec dernière date et intervalle saisi d'après le vétérinaire, date fixée par le vétérinaire prioritaire,
  prochaine échéance, retards et à venir ; courbe de poids SVG sans interprétation ; visites et traitements recopiés
  de l'ordonnance ; frais par catégorie, par mois et par an, dépenses communes, coût annuel ; carnet imprimable ;
  aucun calendrier vaccinal ou antiparasitaire intégré, aucune posologie, aucune marque ; avertissement « ne remplace
  pas l'avis du vétérinaire ») ; `templates/tva/` (TVA) **suivi de TVA** (petites sociétés au réel : ventes, achats,
  frais et immobilisations saisis en HT ou TTC, TVA calculée au centime et écarts signalés ; régime réel normal
  mensuel ou trimestriel, ou réel simplifié avec acomptes et CA12 ; par période : TVA collectée et déductible par
  taux, crédit antérieur, nette à payer ou crédit reporté, remboursement demandé ; échéancier paramétrable avec report
  des week-ends et jours fériés, pointage déclarée et payée ; contrôles : TVA ≠ HT × taux, HT + TVA ≠ TTC, taux
  inhabituel, opération hors période ou saisie après la déclaration, échéance non déclarée ou non payée, crédit non
  imputé, déductible > collectée et crédit reporté plusieurs périodes, seuil du trimestriel, fin annoncée du simplifié
  ; taux et échéances par défaut sourcés et datés, modifiables ; export CSV (opérations, périodes, échéancier) et
  import CSV ; outil d'aide, pas un conseil fiscal, aucune connexion externe). Règles dans `regles.js`, tests
  `outils/templates/<slug>.test.mjs`.
- `templates/papiers/` (DCS) : **papiers du foyer** (T83, 15 €), prêt, « Mise en vente prochaine » (démo libre, fiche
  Gumroad à créer : `docs/templates/communication/papiers/gumroad.json`). Inventaire des documents du foyer et de leur
  emplacement (classeur, boîte, tiroir, cloud, notaire : noms libres), recherche « où est… », 77 documents types en 9
  catégories avec la durée de conservation de la fiche F19134 de service-public.gouv.fr (vérifiée le 13/10/2026,
  consultée le 14/11/2026, à revérifier chaque année : `BASE.source` dans `donnees.js`), modifiable par document ;
  « peut être jeté » calculé (date du document, événement daté par l'utilisateur ou 31 décembre de l'année N+k) ;
  échéances de renouvellement saisies (pièces d'identité, contrôle technique, assurances) avec rappel ; fiche « en cas
  d'urgence » pour un proche ; inventaire, liste à trier et fiche imprimables ; export CSV. Aucun contenu ni numéro de
  pièce stocké (numéros longs, IBAN et mots de passe refusés dans les champs libres). Fiche
  `docs/templates/fiches/papiers.md`, tests `outils/templates/papiers.test.mjs`.
- `templates/remboursements-sante/` (RBS) : **remboursements santé**, prêt, mise en vente prochaine (12 €). Membres du
  foyer, soins (type parmi 33, date, praticien facultatif, montant payé ; aucun diagnostic), Sécurité sociale et mutuelle
  suivies séparément (remboursement attendu, tiers payant ou pas de prise en charge, reçu et écart), reste à charge,
  retards après un délai réglable (30 jours par défaut, sans valeur officielle), message de relance à copier, bilan
  annuel par personne et par type de soin, mutuelle comparée aux cotisations saisies, export CSV. Aucun taux de
  remboursement intégré. Données de santé : consentement explicite au premier lancement et effacement, comme la
  nutrition (`/confidentialite/`). Règles dans `regles.js`, tests `outils/templates/remboursements-sante.test.mjs`.
- `templates/emprunt/` (CPT) : **capacité d'emprunt et comparateur de prêts** (T85), prêt, mise en vente prochaine
  (15 €, primo-accédants et investisseurs ; packs visés « Papiers et décisions d’argent » et « Propriétaire »).
  Profil d'un ou deux emprunteurs (revenus, loyers retenus à la part saisie, crédits en cours), mensualité maximale au
  taux d'effort saisi et montant empruntable au taux, à la durée et à l'assurance saisis, reste à vivre ; seuils de
  départ 35 % et 25 ans (décision D-HCSF-2021-7, source et date de vérification affichées, modifiables) ; budget du
  projet (frais de notaire saisis ou estimés en hypothèse affichée, travaux, apport, prix maximal) ; 2 à 5 offres
  comparées (assurance sur capital initial ou restant dû, frais de dossier, garantie, courtage, coût total, TAEG
  approché présenté comme estimation) ; tableau d'amortissement par mois ou par année, graphique capital et intérêts ;
  remboursement anticipé (durée ou mensualité, indemnités au plafond de l'article R313-25 du Code de la consommation,
  saisies ou nulles) ; export CSV, impression. Aucun taux de marché intégré. Règles dans `regles.js`, tests
  `outils/templates/emprunt.test.mjs`, page `catalogue/emprunt/`, démo `/templates/emprunt/?demo`.
- `templates/remerciements/` (CDX) : **cadeaux reçus et remerciements** (T86), prêt, « Mise en vente prochaine »
  (12 €, démo libre, fiche Gumroad à créer : `docs/templates/communication/remerciements/gumroad.json`). Événements
  (mariage, naissance ou baptême, anniversaire, retraite, obsèques au ton sobre, autre), foyers et cadeaux (objet,
  argent, cagnotte, attentions ; montant et adresse facultatifs), statut du remerciement (à écrire, écrit, envoyé),
  44 modèles de messages originaux par événement et par ton, reste à remercier et objectif d'envoi réglable,
  étiquettes d'adresses A4 (4 formats, départ, décalage), import d'une liste collée, export CSV, effacement des
  adresses et d'un événement. Aucune règle légale ni donnée datée. Règles dans `regles.js`, tests
  `outils/templates/remerciements.test.mjs`.
- `templates/revue-hebdo/` (RVH) : **revue hebdomadaire et journal de bord** (T87), prêt, « Mise en vente prochaine »
  (12 €, démo libre, fiche Gumroad à créer : `docs/templates/communication/revue-hebdo/gumroad.json`). Revue guidée en
  7 étapes le jour choisi (rappel affiché dans l'outil, aucune notification), 55 questions de revue en rotation,
  journal d'une ligne par jour avec humeur facultative, 3 priorités notées la semaine suivante, rendez-vous à venir,
  historique cherchable, tendance (série, semaines tenues, humeur et énergie), export texte. Humeur = repère
  personnel, sans portée médicale. Règles dans `regles.js`, tests `outils/templates/revue-hebdo.test.mjs`. Version
  anglaise en attente.
- `templates/investissement-locatif/` (RNT) : **rentabilité d'un investissement locatif** (T95, 15 €), **en vente** depuis le
  14/11/2026 (Gumroad `/l/rentabilite-investissement-locatif`, fiche : `docs/templates/communication/investissement-locatif/gumroad.json`).
  Jusqu'à 5 biens comparés (nu, meublé, colocation, saisonnier) : coût total d'acquisition (frais de notaire saisis ou
  estimés, hypothèse affichée), loyers par lot ou à la nuitée, vacance en mois par an, charges, crédit saisi (formules
  de `templates/emprunt/`), rendement brut et net de charges, cash-flow mensuel **avant impôt** et effort d'épargne,
  prix maximal pour un rendement visé, sensibilité (loyer − 10 %, vacance + 1 mois, taux + 1 point), fiche d'analyse
  imprimable, export CSV. Aucun taux de marché, prix au m² ni loyer de référence intégré ; fiscalité hors calcul,
  signalée. Fiche `docs/templates/fiches/investissement-locatif.md`, tests `outils/templates/investissement-locatif.test.mjs`.
- `templates/candidatures/` (CAN) : **candidatures études, stages, alternance** (T89, 12 €), prêt, « Mise en vente
  prochaine » (démo libre, fiche Gumroad à créer : `docs/templates/communication/candidatures/gumroad.json`). Une fiche
  par candidature (formation, stage, alternance, job étudiant) : 23 pièces types et 6 listes de départ à adapter, statut
  de chaque pièce, statut de la candidature (à préparer, envoyée, entretien, liste d'attente, acceptée, refusée, retirée)
  et réponse ; dates saisies par l'utilisateur (**aucun calendrier officiel intégré**, aucune plateforme nommée ni
  connectée) ; vœux classés par type ; relances proposées avec message à copier ; 5 trames originales de lettre de
  motivation ; 32 questions d'entretien types avec notes ; échéances, export .ics et CSV, impressions. Fiche
  `docs/templates/fiches/candidatures.md`, tests `outils/templates/candidatures.test.mjs`.
- `templates/benevoles/` (BNV) : **bénévoles et planning des créneaux** (T92), prêt, « Mise en vente prochaine » (19 €,
  démo libre, fiche Gumroad à créer : `docs/templates/communication/benevoles/gumroad.json`). Annuaire des bénévoles
  (coordonnées minimales, compétences, postes préférés), événements créés depuis 6 modèles (33 postes types, créneaux
  types avec besoin en personnes), réponses par événement avec plages, affectation manuelle ou suggérée (disponible,
  compétence, équité de charge) et remplissage automatique des trous, conflits (double affectation, indisponible, sans
  pause, journée trop longue, compétence manquante ; repères choisis par l'association, aucune règle légale), plannings
  A4 par poste et par personne, message à copier par bénévole (rien n'est envoyé), bilan des heures, duplication d'un
  événement, export CSV ; RGPD : export, effacement, bénévoles inactifs signalés selon la durée choisie. Une clé
  partagée par les responsables, saisies fusionnées. Pas d'inscription en ligne en V1. Règles dans `regles.js`, tests
  `outils/templates/benevoles.test.mjs`. Version anglaise en attente.
- `templates/memoire/` (MMR) : **planning de mémoire ou de thèse** (T90, 15 €), prêt, mise en vente prochaine (démo libre,
  fiche Gumroad à créer : `docs/templates/communication/memoire/gumroad.json`). Projet (master, PFE, thèse ou autre ; dates
  de début, de rendu et de soutenance ; mots visés saisis ; jours de travail), plan hiérarchique (parties, chapitres,
  sections) avec statut (à écrire, brouillon, relu, final), mots écrits et visés, plans de départ par type ; rétroplanning
  calculé à rebours depuis le rendu ou la soutenance, jalons types indicatifs resserrés quand le temps manque, dates
  fixables ; mots par jour de travail jusqu'à la fin de la rédaction, rythme réel sur 14 jours et date projetée (relevé
  quotidien du total, courbe d'avancement) ; rendez-vous avec le directeur (points, notes, actions à échéance, ordre du
  jour à copier) ; bibliographie simple (export texte auteur-date, sans norme revendiquée) ; journal de séances ;
  synthèse imprimable, exports CSV. Aucune règle d'établissement intégrée. Fiche `docs/templates/fiches/memoire.md`,
  règles dans `regles.js`, tests `outils/templates/memoire.test.mjs`.
- `templates/assemblee-generale/` (AGS) : **assemblée générale et vie statutaire** (T93), prêt, « Mise en vente
  prochaine » (19 €, démo libre, fiche Gumroad à créer : `docs/templates/communication/assemblee-generale/gumroad.json`).
  Membres votants (case « cotisation à jour »), réunions des quatre instances (AG ordinaire et extraordinaire, conseil,
  bureau), rétroplanning daté depuis le délai de convocation saisi, convocation et pouvoir à copier ou imprimer,
  feuille de présence et pouvoirs (plafond saisi), quorum et majorités calculés en entiers selon les règles des
  statuts saisies (aucune règle légale intégrée, valeurs de départ « à vérifier »), votes, procès-verbal imprimable,
  mandats et renouvellements, archive par année, exports CSV. RGPD : données minimales, suppression d'un membre.
  Règles dans `regles.js`, tests `outils/templates/assemblee-generale.test.mjs`.
- Lot du 14/11/2026 (9), prêts, « Mise en vente prochaine » (démo libre, fiches Gumroad à créer dans
  `docs/templates/communication/gumroad-a-creer.json`) : `templates/competences/` (FRM) **matrice compétences et
  formations** (référentiel intégré de 44 compétences transverses en 8 domaines, dont 8 critiques, et 9 modèles de postes
  avec niveau requis, rédigés pour QME ; échelle 0 à 4 réglable ; matrice personnes × compétences en couleur, écarts au
  poste par personne, équipe et entreprise ; compétences critiques fragiles sous un seuil réglable ; plan de formation relié
  aux compétences avec budget prévu, engagé et réalisé ; historique des évaluations ; impression et CSV ; données minimales,
  rappel RGPD) ; `templates/progression/` (PRG) **progression pédagogique** (vacances saisies, fériés calculés, créneaux par
  classe, semaines A et B ; séquences avec objectifs, durée et fenêtre de fin ; séances faites, reportées au prochain
  créneau ou annulées ; prévu face au réel, retard en heures et en séances, fin projetée et alerte « le programme ne tient
  pas » ; frise, cahier de textes imprimable, 73 verbes d'objectifs selon la taxonomie de Bloom ; aucune donnée d'élève ni
  programme officiel) ; `templates/potager/` (PTG) **calendrier du potager** (fenêtres de semis, plantation et récolte
  saisies par le jardinier, par quinzaine, décalage régional réglable ; « cette semaine », frise des 12 mois, parcelles et
  rotation des familles, journal et bilan des récoltes en kg ; base de 60 légumes avec nom latin et famille, **aucune
  période ni association fournie** faute de source réutilisable vérifiée) ; `templates/bebe/` (BBE) **suivi du bébé**
  (tétées avec minuteur hors ligne, biberons, sommeil, couches, vue « Aujourd'hui » à une main, résumés sans norme, mesures
  tracées **sans courbe de référence** (licences OMS et AFPA–Inserm incompatibles ou non établies), rendez-vous et
  récapitulatif imprimable, deux parents sur deux appareils ; **données de santé d'un enfant : consentement explicite avant
  tout enregistrement**, effacement complet, avertissement médical ; **RGPD à trancher par Quentin avant la vente**). BBE
  rejoint le Pack Maison et famille, PRG le Pack Écoles et formateurs. Règles dans `regles.js`, tests
  `outils/templates/<slug>.test.mjs`.
- `templates/course-a-pied/` (CRS) : **plan d'entraînement course à pied** (T97), prêt, « Mise en vente prochaine » (15 €,
  démo libre, fiche Gumroad à créer : `docs/templates/communication/course-a-pied/gumroad.json`). Chrono de référence,
  objectif du 10 km au marathon, allures d'entraînement en fourchettes et prédiction de temps par la formule de Riegel
  (American Scientist, 1981, exposant réglable ; estimations), plans types rédigés pour QME (8, 12 ou 16 semaines, 3 à 5
  séances) placés sur les jours choisis, séances cochées avec distance, durée et ressenti, déplacement et semaine
  allégée proposée, volume hebdomadaire prévu et fait, impression, exports CSV et iCalendar. Aucune donnée de santé ;
  pas un programme médical. Règles dans `regles.js`, tests `outils/templates/course-a-pied.test.mjs`. Version anglaise
  en attente.
- `templates/sans-voiture/` (SVT) : **vivre sans voiture** (T98), en vente depuis le 18/11/2026 (9 €, dérogation de
  Quentin à la règle des 12 €, démo libre, fiche Gumroad /l/simulateur-vivre-sans-voiture). Questionnaire (foyer, vélo, transports, travail, école) qui
  ouvre les champs utiles et calcule un score de faisabilité avec verdict bloquant ; coût annuel complet de la voiture
  (achat, crédit au taux implicite, LOA, LLD ; carburant en € ou km × consommation × prix) ; sortie (vente, rachat de
  LOA au barème saisi puis revente, option finale, restitution, indemnité de LLD) ; coût sans voiture (transports avec
  part employeur, vélo, location, autopartage, taxis, train, livraisons, équipement) ; gain annuel, mensuel et cumulé
  sur 1 à 15 ans coût de sortie compris, 5 scénarios, meilleur moment de sortie, sensibilité ; 14 cas d'urgence avec
  parade et plan B, cas du quotidien, semaine type, phase de test. Aucun tarif intégré (valeurs d'exemple signalées) ;
  numéros d'urgence et siège enfant vérifiés sur service-public.gouv.fr et Légifrance (17/11/2026). SVT fait partie
  du pack Ma voiture (PVT) depuis le 18/11/2026 (pack à 28 €). Règles dans `regles.js`, tests `outils/templates/sans-voiture.test.mjs`.
- `templates/patrimoine/` (PTM) : **inventaire valorisé**, prêt, mise en vente prochaine (19 €). Base de 15
  catégories, sous-catégories et exemples d'objets sans prix, moteur de décote paramétrable par famille
  (âge, état, prix, ancienneté à l'achat), trois valeurs distinctes (achat, actuelle estimée, revente),
  simulateur de revente frais déduits, analyse de possession, historique mensuel et comparaison, exports
  CSV/JSON, rapport imprimable. Règles dans `calculs.js`, tests `outils/templates/patrimoine.test.mjs`.
- `templates/temps-de-vie/` (TDV) : **temps de vie**, prêt, mise en vente prochaine (19 €). Conversion des
  dépenses en temps de travail selon trois conventions (contractuel, réel avec trajet et frais
  professionnels, annuel effectif), aucun barème fiscal, bibliothèque de dépenses extensible, bilan du mode
  de vie, scénarios A/B/C, coût total de possession. Règles dans `calculs.js`, tests
  `outils/templates/temps-de-vie.test.mjs`.
  Ces deux templates ont une **découverte gratuite** sans clé (bouton « Essayer gratuitement » : 10 objets
  ou 5 dépenses, données gardées dans le navigateur, analyses avancées verrouillées, reprise des données
  après achat), en plus de la démo fictive. Limite appliquée côté client seulement.
- `netlify/functions/templates.mjs` : API `/api/templates/*` (connexion, lecture, enregistrement, conflit
  entre appareils en 409). Logique testable dans `netlify/lib/templates-acces.mjs`.

**Vente (Gumroad).** Fiche « Planning de révision » sur la boutique Gumroad QME (14,90 €). Première vague : « Compte rendu et plan d'actions » (15 €, `/l/compte-rendu-actions`), « Coût de revient et prix par client » (25 €, `/l/cout-de-revient`), « Calculateur de TJM freelance » (12 €, `/l/calculateur-tjm`), « Livre recettes-dépenses micro-entreprise » (25 €, `/l/livre-recettes-micro`), « Gestion Dépenses Communes » (15 €, `/l/budget-commun`). Les templates en développement sont bloqués en 404 dans `netlify.toml` jusqu'à leur mise en vente. Gumroad envoie à
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
  Windows `outils/templates/generer-codes.bat` (double-clic, choix du template par son préfixe — HBT, GNT, TCH… —,
  secret gardé à côté du script, historique CSV ; `generer-codes-REV.bat` ne fait que les codes REV).
- Révoquer un code : ajouter ses 8 caractères aléatoires (2e et 3e blocs, sans tiret) à la variable
  `TEMPLATES_CODES_REVOQUES` (liste séparée par des virgules).

**Tester en local** : `npm install`, puis `npm run dev:templates` (serveur sur le port 8888, stockage en
mémoire, un code valide est affiché au démarrage). Tests de l'API : `npm test`.
