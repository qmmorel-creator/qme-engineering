# T17 · Suivi de lecture

Slug `lecture`, préfixe `PGS` (clés locales `qme-pgs-*`, règles `window.PGS`), prix prévu 12 € (**à confirmer
par Quentin**), permalien Gumroad proposé `suivi-lecture`, catégorie Gumroad `self-improvement` (**à vérifier**),
taille S, priorité P3, thème Loisirs, public Lecteurs. Catalogue : `data-pour="perso"`, thème « Organisation et
études » (`organisation-et-etudes`, `--c:var(--encre)`) faute de thème « Loisirs » (voir « Points à valider »).
Origine : liste initiale du 12/11/2026. Fiche rédigée le 14/11/2026. Aucune couverture de livre, aucune API ou
base de livres en ligne (pas d'ISBN consulté), aucune marque de liseuse, d'application de lecture ou de librairie,
aucune automatisation ni lien externe.

## Pour qui

**Lecteurs réguliers** qui se fixent un objectif annuel (« 24 livres cette année ») et le suivent aujourd'hui dans
un carnet, un tableur ou une application liée à un réseau social de lecture ou à une boutique. Ils veulent savoir
où ils en sont (livre en cours, objectif), sans profil public ni publicité. Aussi : lecteurs de livres audio, qui
comptent en heures plutôt qu'en pages, et membres de clubs de lecture qui tiennent leur liste à lire. Prescripteurs :
bibliothécaires, animateurs de clubs, créateurs de contenu « lecture » (voir `prospects.md`).

## Promesse

Lis, on compte : ta bibliothèque papier, numérique et audio, une session notée en deux secondes, ton rythme et la
date à laquelle tu finiras ton livre, ton objectif de l'année au jour près, tes notes, avis et citations, et tes
statistiques.

## Écrans (5 onglets + réglages)

1. **En cours** : date du jour ; tuiles (objectif de l'année « 20 / 24 » avec l'avance ou le retard en jours,
   série de jours de lecture et record, pages du jour et des 7 derniers jours avec l'écoute, rythme de l'année en
   pages par jour) ; **cartes des livres en cours** (genre, titre, auteur, format, barre de progression, « Page 288
   sur 384 · 75 % » ou « 3 h 13 sur 9 h », rythme et **date de fin estimée**, ou « Pas de lecture depuis 21 jours :
   pas de date de fin estimée ») avec « + Session » et « Fiche » ; graphique des pages lues sur les 14 derniers jours ;
   « À lire ensuite » (3 premiers de la liste, « Commencer »). États vides guidés.
2. **Bibliothèque** : filtres par statut avec compteurs (Tous, En cours, À lire, Lus, Abandonnés), recherche titre
   ou auteur, filtre par genre, tri (plus récents, titre, auteur, note) ; lignes colorées par genre, étiquettes
   statut, genre, citations ; à droite progression, note et date de fin, ou « Commencer ». Filtre « À lire » :
   **liste priorisée** groupée en Prioritaire / Bientôt / Un jour, numérotée, flèches ↑ ↓ (au bord d'un groupe, le
   livre change de priorité). Export CSV.
3. **Journal** : tuiles (série actuelle, record, jours de lecture de l'année) ; sessions par jour, de la plus
   récente à la plus ancienne (40 jours, puis « Voir les jours précédents »), chacune modifiable ou supprimable.
   Export CSV.
4. **Objectif** : choix de l'année ; pour les livres et pour les pages : réalisé, pourcentage, **jauge avec repère
   « attendu »**, étiquette « 14 jours de retard » / « 3 jours d'avance » / « Objectif atteint », attendu au jour
   près, écart, projection au 31 décembre, rythme nécessaire (« 4 livres en 47 jours, soit un livre tous les
   11,8 jours », « 32 pages par jour ») ; colonnes du **cumul des livres terminés mois par mois avec le cumul attendu
   en pointillé** ; liste numérotée des livres lus dans l'année.
5. **Statistiques** : choix de l'année ; tuiles (livres lus et abandons, pages et moyenne par jour, heures
   d'écoute, note moyenne et durée moyenne de lecture d'un livre) ; faits (plus long livre, jours de lecture sur
   jours écoulés, séries) ; livres terminés par mois, pages lues par mois, livres par genre (10 premiers), par
   format, tableau des 10 auteurs les plus lus (livres, pages, note moyenne).
6. **Réglages** (modale) : **genres** (renommer, retirer, ajouter ; les livres suivent un renommage) ; exports CSV
   (bibliothèque, sessions) ; sauvegarde JSON et restauration ; jauge de taille (Ko sur 900) et « Retirer les
   sessions avant le … » ; compte ; « Sur téléphone » ; données personnelles ; à propos.

Saisies (modales) : **livre** (titre, auteur avec suggestions des auteurs déjà saisis, genre, format papier /
numérique / audio, pages ou durée « 9h30 » ou « 570 », statut, priorité si à lire, dates de début et de fin, note
de 0 à 5 étoiles, avis) ; **session** (livre groupé par statut, date, « la page atteinte » ou « les pages lues »,
minutes ou position « 3h40 » pour l'audio, **aperçu** : « 20 pages → page 308 sur 384 (80 %) », « Le livre passera
en Lu ») ; **fiche du livre** (statut, genre, priorité, dates, durée de lecture, progression et rythme, avis,
citations avec page, 12 dernières sessions ; « Noter une session », « Commencer », « Modifier », « Abandonner ») ;
citation (texte, page) ; objectif (livres, pages, par année).

Premier lancement en 2 étapes : présentation et 4 conseils ; puis objectif de l'année (24 livres proposés, pages
facultatives) et, facultatif, le livre en cours (titre, auteur, pages, page où l'on en est).

## Base intégrée (`templates/lecture/donnees.js`)

- **17 genres** proposés, modifiables : Roman, Policier et thriller, Science-fiction, Fantasy, Classique,
  Historique, Biographie et mémoires, Essai, Histoire, Sciences et nature, Développement personnel, Bande dessinée
  et manga, Poésie, Théâtre, Jeunesse, Voyage, Pratique et loisirs.
- 3 formats (papier et numérique en pages, audio en minutes), 4 statuts, 3 priorités, objectif proposé (24 livres),
  8 couleurs de genre fixes (fond teinté, filet, texte foncé), 4 conseils.
- Aucune donnée datée, aucune œuvre, aucune marque.

## Calculs (règles pures, `templates/lecture/regles.js`, `window.PGS`)

- Dates locales ; rang du jour dans l'année ; années bissextiles (règle grégorienne : 2028 et 2000 à 366 jours,
  2100 à 365).
- **Progression** : somme des sessions du livre, plafonnée au total ; un livre « lu » est complet par définition.
- **Rythme d'un livre** : quantité lue sur les 14 derniers jours (aujourd'hui compris), divisée par le nombre de
  ces jours écoulés depuis la première session du livre (au plus 14). Aucune lecture sur 14 jours : pas de rythme.
- **Date de fin estimée** : aujourd'hui + ⌈reste / rythme⌉ jours ; aucune sans rythme ou sans total.
- **Session** : « page atteinte » → quantité = page − progression actuelle (refusée si ≤ 0) ; la session fait
  passer un livre « à lire » ou « abandonné » en « en cours » (début = première session) et un livre dont le total
  est atteint en « lu » (fin = date de la dernière session) ; garde-fou à 150 % du total.
- **Lectures datées** : sessions, plus, pour un livre « lu » noté sans détail, la part non couverte par des
  sessions comptée à sa date de fin (un livre ajouté comme déjà lu compte dans les pages de l'année).
- **Objectif annuel** (livres terminés dans l'année, pages papier et numériques) : attendu = cible × jours écoulés /
  jours de l'année ; **avance ou retard en jours** = round(réalisé × jours de l'année / cible − jours écoulés) ;
  projection = réalisé / jours écoulés × jours de l'année ; rythme nécessaire = (cible − réalisé) / jours restants.
  Année passée : toute l'année écoulée ; année future : rien. Exemple testé : 20 livres sur 24 au 14/11/2026
  (jour 318) → attendu 20,9, 14 jours de retard, projection 23, 4 livres en 47 jours.
- **Statistiques de l'année** : livres terminés et abandonnés, pages et minutes par mois, par genre et par auteur
  (livres, pages, minutes, note moyenne), par format, pages par jour sur les jours écoulés, jours de lecture, note
  moyenne, durée moyenne de lecture d'un livre (début → fin), plus long livre.
- **Séries** : jours consécutifs avec au moins une session ; la série actuelle court jusqu'à hier tant que rien
  n'est noté aujourd'hui ; record toutes années.
- **Liste à lire** : tri par priorité, rang, date d'ajout, titre ; déplacement d'un cran (changement de priorité
  au bord d'un groupe), rangs renumérotés.
- Renommage d'un genre (les livres suivent), suppression d'un livre avec ses sessions, changement de statut daté.
- **CSV** (point-virgule, BOM, formules neutralisées) : bibliothèque (titre, auteur, genre, format, total, unité,
  statut, priorité, dates, lu, note, avis, citations) ; sessions.
- Normalisation tolérante (valeurs absurdes, sessions orphelines, champs vides omis).
- 13 tests `node --test` dans `outils/templates/lecture.test.mjs`.

## Sources

- Aucune base externe : genres, formats et conseils rédigés pour le produit. Calendrier grégorien (années
  bissextiles) vérifié par les tests.
- Démo : **titres et auteurs inventés** pour le produit (aucune œuvre réelle reprise volontairement). Une homonymie
  fortuite avec un livre ou un auteur réel n'a **pas été vérifiée** titre par titre (pas de recherche faite).
- Graphiques : palette du skill `dataviz` passée au validateur ; le bleu de la charte (`#2E5A88`) et l'encre
  échouent aux contrôles de luminosité et de saturation d'une palette **catégorielle**, ce qui ne s'applique pas
  ici (une seule série par graphique) ; compensé par le repère en pointillé légendé, les valeurs écrites, les
  infobulles et un tableau pour lecteur d'écran.

## Données datées

Aucune. Pas de prix, pas de taux, pas de référence réglementaire.

## Risques

- **Attente d'une base de livres** : beaucoup d'applications remplissent titre, auteur, pages et couverture à partir
  d'un ISBN ; ici tout se saisit à la main (choix du brief : aucune API). Dit clairement (page, FAQ, Gumroad,
  à propos, pied de page).
- **Données personnelles** : faibles (titres lus, avis, citations), liées à la clé, ni lues ni partagées ; pas de
  profil public. Les goûts de lecture peuvent être sensibles (opinions, santé, religion selon les livres) :
  mention « Tes avis et citations restent privés » dans les Réglages, aucun partage.
- **Taille** : limite de 900 Ko par espace ; ≈ 60 octets par session, 300 livres et 3 000 sessions ≈ moins de 600 Ko
  (testé). Jauge et purge des sessions anciennes (les livres gardent leurs pages à leur date de fin).
- **Relecture** d'un livre déjà lu : pas gérée en V1 (on peut l'ajouter une seconde fois).
- **Pages et audio** : l'objectif en pages ne compte pas l'audio (pas d'équivalence inventée) ; dit dans l'onglet
  Objectif et la FAQ.
- Concurrence : applications de lecture gratuites (avec réseau social ou boutique), carnets et tableurs ; se
  distinguer par l'absence de compte social et de publicité, le calcul au jour près, l'audio en durée, le prix
  unique.

## Points à faire valider par Quentin

- Prix 12 €, nom « Suivi de lecture », permalien `suivi-lecture`, catégorie Gumroad (`self-improvement` ou
  `writing-and-publishing`, à vérifier dans la liste Gumroad), bouton « Ouvrir mon suivi de lecture ».
- **Thème du catalogue** : pas de thème « Loisirs » dans `templates/index.html` ; rattaché à « Organisation et
  études » (puce existante). Un thème « Loisirs » est à créer s'il réunit au moins deux templates (règle du
  catalogue).
- Choix de calcul : rythme sur 14 jours glissants ; objectif réparti uniformément sur l'année ; audio hors objectif
  en pages ; livre noté lu sans sessions = pages comptées à sa date de fin ; série qui court jusqu'à hier.
- Périmètre V1 : pas de relecture, pas de séries de livres (tome 1, tome 2 se notent dans le titre), pas de prêt de
  livres, pas d'import depuis un autre service.
- Démo : titres et auteurs inventés, homonymies non vérifiées.
- Accroche « Lis, on compte. » (connexion, couverture, carrousel).
