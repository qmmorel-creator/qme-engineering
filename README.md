# Quentin Morel Engineering

Site promotionnel de Quentin Morel Engineering (QME).

## Structure

- Site en pages (depuis le 13/11/2026, plus de page unique à faire défiler) : `index.html` (accueil),
  `sur-mesure/`, `templates/` (catalogue : filtres Professionnel / Vie personnelle, thèmes et recherche, état dans
  l'adresse `?pour=…&theme=…&q=…` ; vitrine défilante des templates en vente ; liste compacte des
  templates en préparation, dont la démo affiche un bandeau « Bientôt en vente » ; bouton « Soumettre une idée » relié au
  formulaire Netlify `idee`), `catalogue/<slug>/` (une page par template en vente), `references/`,
  `methode/`, `contact/` (formulaire Netlify `contact`). Les anciennes ancres (`/#contact`,
  `/templates/#gantt`…) redirigent vers la bonne page.
- Compteur d'intérêt : bouton « Je suis intéressé(e) » des pages « Mise en vente prochaine » →
  `POST /api/interets` (`netlify/functions/interets.mjs`, logique `netlify/lib/interets.mjs`, Netlify
  Blobs à Francfort ; le clic n'enregistre aucune donnée personnelle). Après le clic, e-mail facultatif
  pour être prévenu de la mise en vente (export CSV et effacement sur la page admin ; à effacer après
  l'e-mail de mise en vente, au plus tard 12 mois, cf. politique de confidentialité). Suivi en temps réel et export CSV sur `/admin/interets/`
  (non indexée), avec le code administrateur donné par `outils/templates/code-admin-interets.bat`
  (ou `npm run code-admin` avec `TEMPLATES_SECRET`), ou la variable Netlify `INTERETS_ADMIN`.
- Le même code administrateur ouvre aussi tous les templates à titre personnel : saisi dans une
  application (elle envoie son préfixe), il donne un espace de données propre à Quentin pour ce template
  (`codeAdminProduit`) ; saisi sur `/connexion/`, il est enregistré pour tous les templates (44 à ce jour).
- `en/` : version anglaise, mêmes rubriques (`en/custom/`, `en/templates/`, `en/references/`,
  `en/method/`, `en/contact/`) ; drapeaux français / anglais en tête de page, balises `hreflang` entre
  pages jumelles
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
- `/packs/` : packs de templates (une clé, remise de 10 à 25 % selon le nombre de templates), une page par
  pack (`/packs/<slug>/`), pack sur mesure (`/packs/composer/`) et tableau de bord de l'acheteur
  (`/packs/espace/`, non indexé). Pages générées : `node outils/packs/generer.mjs` (données dans
  `netlify/lib/packs.mjs` et `outils/packs/donnees.mjs`). Codes : `npm run code -- PFG`, `npm run code -- SMP BDG,ABN`.
- Captures et couverture Gumroad : `assets/templates-revision-*.webp`, `assets/templates-revision-couverture.png`.

## Templates payants (`/templates/`)

Applications web vendues à l'unité, ouvertes avec un **code d'accès** remis à l'achat. Les données de
l'acheteur sont enregistrées en ligne (Netlify Blobs, région Francfort `eu-central-1` depuis le 13/11/2026 ; les enregistrements de l'ancienne région par défaut sont recopiés puis effacés à leur première lecture) et suivent le code sur tous ses appareils ; une
copie est gardée dans le navigateur pour le hors-ligne. Pages non indexées (`X-Robots-Tag`).

- `templates/revision/` : **planning de révision** par répétition espacée (J+1, J+3, J+7, J+14, J+30,
  ajustés selon la réponse « difficile / moyen / facile », bornés par la date d'examen, révision finale
  2 jours avant). Base intégrée dans `donnees.js` : 12 formations avec leurs matières, 12 méthodes de
  révision. Installable sur téléphone (manifeste + service worker). Mode démo sans code (données
  d'exemple, locales).
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
  - `templates/budget-commun/` (BCM) : **budget commun**, répartitions au centime, équilibrage en un
    minimum de virements, fusion des saisies de plusieurs appareils.
- Deuxième vague, en vente : `templates/gantt/` (GNT) **planning Gantt rapide** (chemin critique,
    jours ouvrés, jalons à plage) ; `templates/taches/` (TCH) **gestionnaire de tâches** (boîte de
    réception, triage, rituels) ; `templates/budget/` (BDG) **budget du foyer** (enveloppes, Sankey).
  Chaque application refuse une clé d'un autre produit (`corps.produit`). Taux datés : mise à jour
  annuelle obligatoire (`donnees.js`).
- `templates/secret-santa/` (SNT) : **Secret Santa**, prêt, mise à disposition prochaine, **gratuit**
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
  qualification) ; `templates/impayes/` (RCV) **relance des impayés** (retard par ancienneté, pénalités
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
- `templates/tableau-annuel/` (RDV) : **tableau de bord annuel et roue de vie**, prêt, « Mise en vente prochaine »
  (15 €, démo libre, fiche Gumroad à créer dans `docs/templates/communication/gumroad-a-creer.json`). Roue de vie
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
- `templates/pilotage-pme/` (TDB) : **tableau de bord de pilotage PME**, prêt, « Mise en vente prochaine » (39 €, démo
  libre, fiche Gumroad à créer : `docs/templates/communication/pilotage-pme/gumroad.json`). Bibliothèque de 45 indicateurs
  types en 6 domaines (définition, formule, sens de lecture, source), 14 calculés, 5 jeux de départ, aucun ratio
  sectoriel de référence ; saisie mensuelle, objectifs annuels répartis (égale, saisonnière, mois par mois), seuils,
  écarts, tendances, projection, revue mensuelle imprimable avec actions. Règles dans `regles.js`, tests
  `outils/templates/pilotage-pme.test.mjs`.
- `templates/verifications/` (VRF) : **vérifications réglementaires**, prêt, « Mise en vente prochaine » (35 €, démo
  libre, fiche Gumroad à créer : `docs/templates/communication/verifications/gumroad.json`). Registre des contrôles
  périodiques par site : 22 types avec périodicité sourcée (brochure INRS ED 828, édition de septembre 2026, page et
  textes cités, consultée le 14/11/2026, à revérifier à chaque édition) ou saisie par l'utilisateur, échéances,
  organismes, observations suivies jusqu'à leur levée avec preuve (référence et lien, pas de fichiers), délai de
  2 ans des installations électriques sous conditions, calendrier, registre imprimable par site. Règles dans
  `regles.js`, tests `outils/templates/verifications.test.mjs`. Version anglaise en attente.
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

**Vente (Gumroad).** Fiche « Planning de révision » sur la boutique Gumroad QME (14,90 €). Première vague : « Compte rendu et plan d'actions » (15 €, `/l/compte-rendu-actions`), « Coût de revient et prix par client » (25 €, `/l/cout-de-revient`), « Calculateur de TJM freelance » (12 €, `/l/calculateur-tjm`), « Livre recettes-dépenses micro-entreprise » (25 €, `/l/livre-recettes-micro`), « Budget commun » (15 €, `/l/budget-commun`). Les templates en développement sont bloqués en 404 dans `netlify.toml` jusqu'à leur mise en vente. Gumroad envoie à
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
