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
  (`codeAdminProduit`) ; saisi sur `/connexion/`, il est enregistré pour tous les templates de `PRODUITS`.
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
- `templates/planning-equipe/` (EQP) : **planning d'équipe et staffing**, prêt, « Mise en vente prochaine » (35 €,
  démo libre, fiche Gumroad à créer dans `docs/templates/communication/gumroad-a-creer.json`). Affectations par
  personne et par projet ou poste en heures par semaine, taux de charge avec temps partiel, absences et fériés
  déduits, alertes (surcharge, affectation pendant une absence, compétence manquante, poste non couvert, durées
  L3121-20 et L3121-22 paramétrables), vues semaine et mois, « qui est disponible la semaine prochaine ». Une clé
  partagée par les managers : saisies simultanées fusionnées (`fusionner`). Règles dans `regles.js`, tests
  `outils/templates/planning-equipe.test.mjs`.
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
- `templates/propositions/` (PCM) : **propositions commerciales** (T74), prêt, « Mise en vente prochaine » (19 €, démo
  libre, fiche Gumroad à créer : `docs/templates/communication/propositions/gumroad.json`). Contexte, objectifs,
  livrables, blocs de bibliothèque (présentation, méthode, références), options comparées (bon, mieux, premium), planning
  en semaines, conditions, aperçu A4 imprimable ; suivi (validité, relances avec message à copier, réponse et motif,
  taux de transformation en nombre et en valeur), duplication. Prix hors taxes, aucune règle légale : mentions et TVA
  renvoyées au devis (T36). Règles dans `regles.js`, tests `outils/templates/propositions.test.mjs`.
- `templates/document-unique/` (DRP) : **document unique d'évaluation des risques** (T80), prêt, « Mise en vente
  prochaine » (29 €, démo libre, fiche Gumroad à créer : `docs/templates/communication/document-unique/gumroad.json`).
  Unités de travail, 20 familles de risques inspirées de l'INRS ED 840 (reformulées), démarrage par secteur, cotation
  gravité × probabilité sur grille paramétrable, risque initial et résiduel, matrice, plan d'actions (programme
  annuel dès 50 salariés), événements, versions archivées et figées, document imprimable. Obligations selon
  l'effectif sourcées et datées (service-public.gouv.fr et INRS, consultés le 14/11/2026 : à revérifier chaque
  année). Règles dans `regles.js`, tests `outils/templates/document-unique.test.mjs`.
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
