# Audit des templates étudiants avant le partenariat Odélia · 22/11/2026

Prompt : `docs/templates/audit-etudiants-prompt.md`. Branche `claude/quirky-allen-ctlri2`, PR vers `main`, **non fusionnée**
(fusion = déploiement facturé, sur feu vert de Quentin). Captures choisies : `docs/templates/audit-etudiants-2026-11-22/`
(dossier non publié par Netlify).

## En bref

- **12 templates, 7 pages, 2 packs, la redirection `/odelia`** audités sur iPhone 13, Pixel 7 et 1440 px.
- **4 défauts bloquants ou majeurs côté fonctionnement**, tous corrigés et testés :
  1. Épargne : **page figée** (boucle sans fin) quand la date visée est le mois en cours avec un retrait prévu ce mois.
  2. Dépenses communes : **la démo plantait** au passage en « compte commun » (plus aucun onglet ne répondait).
  3. `?demo&reinit` **ne réinitialisait pas** la démo dans 4 templates (mémoire, budget, abonnements, dépenses communes).
  4. Révision : l'import « Coller un programme » **tronquait les titres** (« Chimie » → « Mie », « Leçon » → « naugurale »).
- **Sécurité** : une copie de sauvegarde piégée (« Restaurer une copie ») exécutait du code dans Planner et Habitudes ;
  corrigé (identifiants nettoyés), testé. Les 10 autres templates résistaient déjà.
- **Vente** :
  - la page d'arrivée du Reel (`/packs/etudiant/`) ne parlait jamais de l'essai gratuit ;
  - sur téléphone, le prix et les boutons des pages catalogue n'apparaissaient qu'après 1,6 à 2,6 écrans de défilement ;
  - les démos Épargne et Repas affichaient « Bientôt en vente » alors qu'ils sont en vente.

  Tout est corrigé.
- **E-mails** : la séquence complète fonctionne pour les 12 templates et s'arrête au paiement. Un défaut corrigé :
  l'e-mail d'achat direct d'un pack disait « Pour lesouvrir ».
- **Prix** : site, packs, e-mails et Gumroad concordent pour les 12 templates et les 2 packs.
- **Après corrections** :
  - templates (iPhone 13 et Pixel 7) : 0 erreur console, 0 débordement, 0 violation axe (grave ou critique), aucune cible
    tactile sous 44 px, sauf les cases de la grille du mois d'Habitudes (30 px, grille dense, nom accessible complet) ;
  - Lighthouse mobile en production : performance 99-100, accessibilité 100, LCP 1,2 à 1,8 s, CLS 0 ;
  - pages modifiées, Lighthouse en local : accessibilité 100.
- `npm test` : **1 585 tests, 0 échec** (1 ignoré, déjà ignoré avant). Essai e2e : **12/12**.

## Méthode et outils

- Serveur local `QME_LICENCES_TEST=1 PORT=8899 node outils/templates/serveur-local.mjs`, puis
  `node outils/essai/e2e.cjs <slug>` pour les 12 slugs (parcours ordinateur + téléphone), avant et après corrections.
- **Séquence d'e-mails** : le serveur local n'exécute pas la tâche quotidienne, donc `/__dev/decalage` ne déclenche que le
  bandeau et la lecture seule, pas les rappels. La séquence a été simulée en appelant `traiterEssai`, `tournerEssais`
  (chaque jour de J0 à J+46) et `traiterAchat` (ping Gumroad simulé), pour les 12 templates :
  - scénario A : essai sans achat ;
  - scénario B : achat à J+5 ;
  - scénario C : Pack Étudiant acheté après un essai, achat direct de pack, achat direct de template.

  Contrôles : nom, prix, liens (internes existants, lien Gumroad exact, code d'essai), absence de `undefined`, `NaN` et
  `null`, un e-mail par jour.
- **Audit mobile** (script Playwright) : chaque onglet de chaque démo et chaque page, sur 3 appareils, mesure du
  débordement horizontal, des cibles < 44 px, des erreurs console, des textes < 12 px et des violations axe-core,
  captures avant et après.
- **Audit fonctionnel** : 4 agents, 3 templates chacun.
  - Calculs vérifiés à la main sur les cas limites (vide, 0, négatif, décimales, 29 février, changement d'heure, gros
    volumes, très gros montants).
  - Gestes réels de création, modification et suppression, puis import, export, impression, `&reinit`.
  - Injection de `<img onerror>`, guillemets, apostrophes, `&` et emoji dans tous les champs, puis plus de 70 à 190
    clics par template.
  - Clavier virtuel simulé par une hauteur de fenêtre de 330 à 480 px.
  - Service worker et manifeste.
- **Gumroad** : `list_products` et `get_product`, en lecture seule. **Lighthouse** mobile sur la production (pages
  publiques) et en local.

## Pages et parcours

### `/odelia` (netlify.toml)
- Testé en production : `/odelia` et `/odelia/` → 302 vers `/packs/etudiant/?utm_source=instagram&utm_medium=influence&utm_campaign=odelia`.
- **Défaut (mineur)** : `/Odelia` (majuscule) répond 404, car les chemins Netlify sont sensibles à la casse.
  **Corrigé** : redirection ajoutée (44b7a49). Test : `audit-etudiants.test.mjs`, qui vérifie aussi qu'aucune règle
  antérieure n'intercepte le lien.

### `/packs/etudiant/` (page d'arrivée du Reel) et `/packs/argent-du-quotidien/`
- **Défaut (majeur pour la conversion)** : aucune mention de l'essai gratuit de 14 jours. Seules les options « Détail »
  et « Démo » étaient proposées par outil.
  **Corrigé dans le générateur** `outils/packs/generer.mjs` (13f8c59) :
  - sous les boutons d'achat : « Pas encore sûr(e) ? Chaque outil du pack s'essaie 14 jours gratuitement, sans carte
    bancaire. Si vous prenez ensuite le pack, vos données d'essai sont reprises. » (reprise par une clé de pack déjà
    testée dans `essai.test.mjs`) ;
  - un lien « Essai gratuit » sur chaque carte d'outil ouvert à l'essai, avec un compteur GoatCounter
    `essai-pack-<pack>-<slug>` ;
  - liens des cartes portés à 44 px.

  Toutes les pages de pack en vente en profitent. Captures : `pack-etudiant-avant` / `-apres`.
- **Défaut (mineur, tout le site)** : sur téléphone, les boutons flottants LinkedIn et Instagram couvraient le texte et
  les étiquettes « Disponible ». **Corrigé** (`site.css`) : sous 600 px, ils passent dans le flux au-dessus du pied de
  page (`reseaux-telephone-apres`). Rien ne change sur ordinateur.
- Prix : Étudiant 92,90 € → 69 € (−25 %), option évolutive +18 € (Gumroad : 69 € et 87 €). Argent du quotidien 54 € →
  43 € (−20 %), +11 € (Gumroad : 43 € et 54 €). Concordent.
- Parcours d'achat : boutons Gumroad `?wanted=true&variant=Pack` et `Pack évolutif` corrects. Un code du Pack Étudiant
  saisi sur `/connexion/` ouvre `/packs/espace/` avec les 7 outils ; chacun s'ouvre connecté, sans démo ni écran de
  connexion.
- Production : performance 99, accessibilité 100, LCP 1,7 s.

### Pages catalogue des 12 templates
- Prix affiché, JSON-LD, lien Gumroad et permalien conformes à Gumroad pour les 12.
- **Défaut (majeur pour un public sur téléphone)** : le prix et les boutons « Essai gratuit 14 jours / Acheter /
  Essayer la démo » étaient entre 1 046 et 1 573 px de haut sur iPhone 13 (écran de 664 px).
  **Corrigé** (`site.css`, 24b12b2) : sous 640 px, ils passent avant « Ce que vous obtenez » et arrivent entre 593 et
  736 px. L'ordre du code reste inchangé. Test dans `audit-etudiants.test.mjs`. Captures : `catalogue-notes-avant` /
  `-apres`.
- Production : performance 99, accessibilité 100.

### `/demo/odelia/`
- Les 4 outils s'ouvrent au profil `droit-l1` avec le prénom, en mode discret (sans bandeau « Mode démo », comme prévu
  pour le tournage). `&reinit` fonctionne, aucune erreur console.
- **Défaut (mineur)** : liens « Repartir des données de départ » trop petits au doigt (Lighthouse 95).
  **Corrigé** : 44 px, Lighthouse 100 (52c76da).
- La page chargeait l'ancienne version de `packs.css` : mise à jour.

### `/essai/` et `/connexion/`
- `/essai/` :
  - champs corrects (clavier e-mail, autocomplétion), case « nouveautés » facultative et décochée ;
  - messages d'erreur clairs (e-mail invalide, consentement absent, template inconnu) ;
  - adresse déjà utilisée : code renvoyé par e-mail.
- `/connexion/` : une clé de template ouvre l'application, une clé incomplète affiche « Clé incomplète : 4 blocs de 8
  caractères… », un code de pack ouvre l'espace pack.
- Production : `/essai/` performance 100, accessibilité 100.

## Essai gratuit et séquence d'e-mails

- **e2e 12/12** : bandeau « encore 14 jours », 15 jours plus tard lecture seule (onglets libres, modifications bloquées,
  aucun `PUT` envoyé, serveur 403), « J'ai acheté » avec la clé de test (données reprises, bandeau retiré, code d'essai
  refusé ensuite). Volet téléphone : aucun débordement.
- **Séquence pour les 12 templates**, essai commencé le 28/12/2026 : J0 « Merci d'essayer », J2 « par où commencer »
  (fiche propre au template), J11 « Plus que 3 jours », J15 « essai terminé », J37 « seront effacées le 10 février »,
  données et essai effacés après J44. Un seul e-mail par jour.
- **Achat à J+5** : e-mail « Merci : « … » est à vous », puis **plus aucun e-mail d'essai**, pour les 12.
- **Pack Étudiant acheté après l'essai de Notes** : e-mail rattaché à l'essai, avec la date limite de reprise.
- Contenu vérifié : prix identiques à Gumroad, liens Gumroad exacts, liens du site existants, lien d'arrêt présent, rien
  d'indéfini.
- Le dernier e-mail promet « télécharger une copie depuis les réglages » : vrai, les 12 ont l'action `exporter`, permise
  en lecture seule.
- **Défaut (majeur, visible par chaque acheteur direct d'un pack)** : « Pour lesouvrir : allez sur… ».
  **Corrigé** (`netlify/lib/achats.mjs`, c66089a). Test dans `achat.test.mjs` : aucun mot collé, pour tous les produits
  en vente.

## Templates

Pour les 12, les corrections des agents sont dans les commits intermédiaires 881707a, 927e38c, 8129a94, f6da92b,
6a05c4c et cfa414d. Le commit 42cf193 passe les versions de cache des 12 en `20261122a` et complète les coquilles hors
ligne (`essai.js`, polices et icône 180 px manquaient dans 12 `sw.js`). Il ajoute aussi un test qui vérifie que tout
fichier chargé par `index.html` est dans la coquille, à la même version.

Corrections communes : cibles tactiles portées à 44 px (bloc en fin de chaque `app.css`, plus les cas particuliers).
Les zones de tableau qui défilent sur le côté sont rendues accessibles au clavier (`tabindex`, rôle et nom), et l'ordre
des titres et les contrastes sont corrigés.

### Planning de révision (`revision`)
- **Testé** : 29 février, changement d'heure, 300 chapitres, rattrapage, export `.ics`, import de programme, session
  guidée, partage en image, états vides, profils `pass`, `concours` et `droit-l1`.
- **Majeur** : l'import « Coller un programme » tronquait les mots commençant comme un préfixe (« CHIMIE » → « Mie »,
  « Partie civile » → « e »). Corrigé dans `regles.js`. Test : « import : un mot qui commence comme un préfixe… garde
  toutes ses lettres ». Captures : `revision-import-avant` / `-apres`.
- **Majeur** : la démo du catalogue (`?demo`) s'ouvrait sur « Tout est fait pour aujourd'hui », sans rien à réviser.
  Elle montre maintenant 3 révisions du jour (`revision-demo-avant` / `-apres`).
- **Mineur, accessibilité** : 5 contrastes insuffisants (de 1,72 à 4,27), calendrier sans structure de grille valide,
  10 types de boutons sous 44 px.

### Notes et moyennes (`notes`)
- **Testé** : moyennes et arrondis au centième, poids nuls, saisies « 14,5/20 », « 85 % », « 7/10 », simulateur,
  évolution, relevé imprimable, CSV (formules neutralisées), import et export, états vides. **Calculs justes.**
- **Mineur** : le simulateur affichait « Aucune épreuve prévue » quand des épreuves existaient mais qu'aucune n'était
  cochée. Il dit maintenant de cocher une épreuve (`notes-simulateur-avant` / `-apres`).
- **Mineur, accessibilité** : bouton d'UE de 21 px de haut, 5 tableaux défilants, ordre des titres.

### Planner horaire (`planner`)
- **Testé** : marques Fait, Raccourci, Déplacé et Pas fait ; séries ; modèles ; copie de semaine ; déplacement au
  clavier et à la souris ; 29/03, 25/10 et passage d'année.
- **Majeur (sécurité)** : une copie JSON piégée restaurée exécutait du code. Un bloc avec une heure illisible affichait
  « NaN h ». Nouvelle fonction `PHR.nettoyerEtat`, 2 tests. Captures : `planner-copie-piegee-avant` / `-apres`.
- **Mineur** : nom accessible des blocs, textes « ses 1 bloc » → « son bloc », cibles à 44 px.

### Suivi d'habitudes (`habitudes`)
- **Majeur (sécurité)** : même faille de restauration que Planner. Corrigé et testé.
- **Majeur** : la série tombait à 0 en cours de journée. Exemple : « au moins 8 verres », 3 verres saisis à midi faisaient
  passer la série de 3 à 0. Corrigé dans `serie()` ; un maximum dépassé casse toujours la série. Testé.
- **Mineur** :
  - formules non neutralisées dans l'export CSV (testé) ;
  - un nom de thème long sans espace élargissait la page à 417 px (`habitudes-mot-long-avant` / `-apres`) ;
  - boutons d'habitude de 36 à 39 px.
- Grille du mois : cases de 30 × 30 px gardées (grille dense), chacune avec un nom accessible complet.

### Suivi de lecture (`lecture`)
- **Mineur** : « Fini le NaN undefined » pour un livre lu sans date de fin, venant d'une copie importée
  (`lecture-nan-avant` / `-apres`).
- **Mineur** : message trompeur pour un nombre de pages négatif, texte « ses 1 session ».
- **Mineur, accessibilité** : en-têtes vides dans les tableaux réservés aux lecteurs d'écran, cibles à 44 px.

### Candidatures (`candidatures`)
- **Mineur** : l'export agenda `.ics` pliait les lignes à 74 caractères au lieu de 75 octets et pouvait couper un emoji.
  Corrigé et testé.
- **Accessibilité** : `aria-pressed` interdit sur les onglets Lettre et Entretien (axe critique) ; boutons du classement
  des vœux à 44 px.

### Planning de mémoire (`memoire`)
- **Bloquant pour les démos filmées** : `?demo&reinit` ne réinitialisait pas (0 section au lieu de 16). Corrigé
  (6a05c4c) ; captures `memoire-reinit-avant` / `-apres`.
- **Mineur** : contraste des rendez-vous à venir (4,27) ; boutons « + Section » sans le texte visible dans leur nom
  accessible ; 6 types de cibles sous 44 px.

### Mon Budget (`budget`)
- **Majeur** : `&reinit` ignoré (218 opérations sur 220 après suppression). Corrigé.
- **Mineur** :
  - un montant de 17 chiffres était accepté ; les montants sont maintenant plafonnés à un milliard d'euros (testé) ;
  - « 0 », « -3 » et un champ vide affichaient tous « Montant illisible » : messages distincts.
- **Accessibilité** : 19 boutons d'enveloppe dont le nom ne contenait pas le texte visible ; ordre des titres ; résumés
  de 32 px.

### Suivi des abonnements (`abonnements`)
- **Majeur** : `&reinit` ignoré. Corrigé.
- **Mineur** :
  - la colonne « par mois » par catégorie ne tombait pas juste sur le total (2,49 € pour 2,50 €). Corrigé au plus fort
    reste, testé ;
  - un abonnement sans prix s'affichait « 0 € » dans le calendrier : il affiche « ? »
    (`abonnements-calendrier-avant` / `-apres`) ;
  - plafond des montants (testé).
- **Accessibilité** : rôles de grille du calendrier incomplets, bouton de 24 px.

### Gestion Dépenses Communes (`budget-commun`)
- **Majeur** : la démo plantait au passage en « compte commun » (`TypeError … 'mode'`, vue figée). Corrigé (réglages de
  démo complets et normalisés). Capture : `budget-commun-bascule-avant`, l'écran avant l'erreur.
- **Majeur** : `&reinit` ignoré. Corrigé.
- **Mineur** :
  - une part illisible (« abc », « -2 ») était comptée 0 sans prévenir ; il y a maintenant un message d'erreur (testé) ;
  - messages de montant précisés ;
  - contraste de 3,97 dans les Réglages ;
  - « Modifier la clé » portée à 44 px.
- **Calculs justes** : répartitions au centime (100,01 € → 57,78 + 42,23), équilibrage en un minimum de virements,
  soldes de somme nulle, fusion de deux appareils.
- Voyage et le guide « budget de couple » chargent ce même fichier de règles : leur numéro de version a été mis à jour,
  et l'interface publique est inchangée (tests des guides et de Voyage verts).

### Objectif d'épargne (`epargne`)
- **Majeur (conversion)** : la démo affichait « Bientôt en vente · Être prévenu de la sortie ». Retiré (881707a,
  `epargne-bientot-en-vente-avant`).
- **Bloquant** : la page se figeait (boucle sans fin) quand la date visée est le mois en cours et qu'un retrait est prévu
  ce même mois. Corrigé, recherche bornée, testé.
- **Majeur** : avec une date visée passée, la page affichait « il faut 0,00 € par mois » et un bouton inopérant. Elle
  affiche maintenant « La date visée est passée : choisis-en une nouvelle », et le formulaire refuse une date passée.
  Testé (`epargne-date-passee-apres`).
- **Mineur** : au-delà de 21 M€, les montants étaient faussés (entiers 32 bits). Saisie limitée à 10 M€, testé.

### Repas de la semaine (`repas`)
- **Majeur (conversion)** : même « Bientôt en vente » dans la démo. Retiré.
- **Mineur** :
  - contraste des jours passés (3,83) ;
  - « Tout décocher » mesurait 36 px, n'apparaissait qu'après un nouvel affichage de l'écran et restait visible quand
    rien n'était coché (8129a94).
- **Calculs justes** : quantités selon les portions (50 g pour 2 personnes → 130 g pour 5, arrondi de courses),
  regroupement g/kg et ml/cl/l.

## Suite donnée le 22/11/2026 (« mets tout en cohérence partout et publie »)

- **37 démos** de templates en vente (les 29 listées plus bas, et 8 mis en vente le 22/11) n'affichent plus « Bientôt en vente ».
  Versions de cache changées. Un test couvre désormais tous les templates en vente.
- **Pack Étudiant** : le chapeau cite les 7 outils (`outils/packs/donnees.mjs`). La fiche Gumroad est générée avec l'essai gratuit
  (`outils/packs/fiches-gumroad.mjs`) et la description du produit Gumroad a été mise à jour avec ce texte.
- **Couvertures Gumroad** des packs Étudiant et Argent du quotidien : `node outils/packs/couvertures-gumroad.cjs`, publiées dans
  `assets/packs-<slug>-couverture.png`, puis ajoutées sur Gumroad.
- README et `docs/templates/essai-gratuit.md` à jour. Points 1, 2 et 17 ci-dessous : **traités**.

## À décider par Quentin

1. **Traité** · **Gumroad** : les produits « Pack Étudiant » et « Pack Argent du quotidien » n'ont **aucune image de couverture**
   (`covers: []`). Les étudiants qui cliqueront « Acheter le pack » arriveront sur une page Gumroad sans visuel.
   Je n'ai rien modifié sur Gumroad.
2. **Traité** · **Texte du Pack Étudiant** : le chapeau de la page et de Gumroad (« Le planning de révision…, l'emploi du temps…, les
   routines et le suivi de lecture ») ne cite que 4 des 7 outils (ni notes, ni candidatures, ni mémoire). Il faudrait le
   modifier dans `outils/packs/donnees.mjs` et sur Gumroad.
3. **Vignette du Planner** sur la page du pack : elle montre une semaine de freelance (« Production client »,
   « Prospection »), pas une semaine d'étudiant.
4. **Thème sombre** : aucun template ni aucune page n'en a.
   - Avec la préférence système sombre, le rendu reste clair et lisible.
   - Le mode sombre forcé d'Android Chrome n'a pas pu être reproduit ici : à regarder sur un vrai téléphone.
   - Créer un vrai thème sombre pour les 12 templates est un chantier à décider.
5. **Liens réseaux sur téléphone** : je les ai fait passer dans le flux (au-dessus du pied de page) sur tout le site,
   sous 600 px. Si vous préférez les boutons flottants, il suffit de retirer une règle dans `assets/site.css`.
6. **Démo Révision** : elle montre maintenant 3 révisions du jour au lieu de « Tout est fait ». Un Reel déjà publié
   montrait-il l'ancien écran ?
7. **Démo Notes** : le « Semestre 4 » de L2 est en cours en novembre ; le S3 serait plus réaliste.
8. **Démo Repas** : le 22/11 est un dimanche, donc la démo montre une semaine presque passée. Il faut toucher « › » pour
   prévoir la suivante.
9. **Dépenses communes** : sur iPhone, le clavier des montants n'a pas de touche « − ». Un solde à découvert ne peut
   donc pas être tapé en mode compte commun : clavier texte sur ce champ, ou case « à découvert » ?
10. **Abonnements** : un abonnement hebdomadaire est ramené au mois sur 52 semaines par an (52,18 en réalité).
11. **Habitudes** :
    - un chiffre encore sous le minimum aujourd'hui compte comme « partiel » dans le taux du jour (seule la série a été
      corrigée) ;
    - passer une habitude de chiffrée à « à cocher » garde les anciens chiffres.
12. **Lecture** : réduire ou supprimer une session d'un livre déjà « Lu » le laisse « Lu ».
13. **Planner** : « ajouté chaque dim à 13 h » → « chaque dimanche » ?
14. **Notes** : un objectif illisible (« abc ») dans le simulateur retombe sur l'objectif par défaut sans message.
15. **Manifestes** : l'icône 512 px est déclarée « any maskable », ce que Chrome déconseille. Une icône adaptative
    séparée serait préférable.
16. **Démos partenaire (`droit-l1`)** : chaque outil s'ouvre d'abord sur la fenêtre « Comment ça marche ». C'est utile
    pour un visiteur, mais c'est un geste de plus à l'écran pendant le tournage.
17. **Traité** · **Hors périmètre** : 29 autres templates en vente affichent encore « Bientôt en vente » dans le bandeau de leur démo :
    appel-decouverte, appels-offres, calendrier-editorial, competition, conges, dettes, doe, emprunt, entretiens-annuels,
    flotte, maintenance, musculation, notes-de-frais, onboarding, papiers, parc-informatique, patrimoine, pilotage-pme,
    propositions, prospection, references-plaquette, salles, sous-traitants, stocks, suivi-chantier, suivi-temps,
    temps-de-vie, verifications, voyage. Même correction que pour Épargne et Repas, à faire dans une PR séparée.
18. **Reste mineur sur tout le site** : logo (34 px), fil d'Ariane (22 px) et liens en ligne du pied de page (18 px) sont
    sous 44 px. Ce sont des liens dans du texte, admis par le critère AA, et Lighthouse donne 100.

## À vérifier par Quentin avant la publication (non testable ici)

1. **Vrai paiement Gumroad** d'un template et du Pack Étudiant, puis saisie de la clé reçue sur `/connexion/` et dans
   « J'ai acheté » d'un essai. Ici, seules les clés de test du serveur local et un code de pack généré ont servi.
2. **Ping Gumroad** (`Settings → Advanced → Ping endpoint = https://qm-engineering.fr/api/achat`) : sans lui, ni e-mail
   d'achat ni arrêt de la séquence au paiement.
3. **Envoi SMTP réel** : variables `ESSAI_SMTP_UTILISATEUR`, `ESSAI_SMTP_MOT_DE_PASSE` et `ESSAI_EXPEDITEUR` sur Netlify,
   puis un essai réel avec une de vos adresses (e-mail reçu, bonne adresse d'expédition, rendu HTML, signature). Sans
   SMTP, un étudiant qui relance l'essai avec la même adresse ne peut pas récupérer son code.
4. **Tâche quotidienne** `essais-quotidien` (8:10 UTC) active sur Netlify : les rappels J+2, J-3, la fin et l'effacement
   n'ont été vérifiés qu'en simulation.
5. **Vrai iPhone et vrai Android** : clavier virtuel réel (non émulable, seulement simulé par une fenêtre réduite),
   installation sur l'écran d'accueil, mode sombre forcé d'Android, et un test hors ligne après une première visite.
6. **Synchronisation entre deux vrais appareils** avec la même clé (couverte en local par les tests et l'e2e, pas sur
   Netlify Blobs).
7. Après la fusion : `/odelia` et `/Odelia` en 302, `/packs/etudiant/` avec la ligne d'essai, et une page catalogue sur
   téléphone avec le prix visible dans le premier écran.
