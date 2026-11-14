# T56 · Emploi du temps d'établissement

Slug `emploi-du-temps`, préfixe `EDT` (clés locales `qme-edt-*`, règles `window.EDT`), prix prévu 45 € (**à
confirmer par Quentin**), permalien Gumroad prévu `emploi-du-temps-etablissement`, catégorie Gumroad `education`
(à vérifier), taille L, priorité P2. Catalogue : `data-pour="pro"`, thème « Associations, formation et
événements » (`associations-formation-et-evenements`, `--c:var(--rouge)`). Origine : backlog de Quentin n° 33.
Proche de : grille de planning et planner horaire (outils internes, `templates/planner/`) : mécanique de grille
seulement, rien repris. Fiche rédigée le 14/11/2026. Aucune marque (logiciel de scolarité, agenda), aucune
automatisation ni lien externe, aucune optimisation automatique en V1.

## Pour qui

Petits **organismes de formation** (formation professionnelle, apprentissage, langues, cours du soir) et
**écoles privées** de petite taille, qui construisent l'emploi du temps de quelques groupes, formateurs et salles
dans un tableur. Pas l'Éducation nationale publique (outils institutionnels imposés). Aujourd'hui : un onglet par
groupe, un autre par salle, les heures des formateurs comptées à part ; les croisements (formateur dans deux
groupes, salle trop petite, volume d'un module dépassé) se découvrent tard. Distinct du **planner horaire**
(T30, agenda personnel en blocs de 30 min) : ici plusieurs ressources partagées et la détection des conflits
entre elles.

## Promesse

Ton planning, sans conflit : groupes, formateurs, salles et modules placés à la main sur une grille semaine,
chaque conflit signalé au moment où tu poses la séance, des vues par groupe, formateur et salle, et les heures
réalisées comparées aux volumes prévus.

## Écrans (5 onglets + réglages)

1. **Planning** : vue par **groupe**, **formateur** ou **salle** (segments + liste) ; semaine précédente /
   suivante, choix d'une date, « Cette semaine » ; résumé (dates, n° ISO, semaine A/B, séances, heures, conflits) ;
   **grille** jours × créneaux (ordinateur) : case libre cliquable (« + »), jours fériés et fermetures hachurés et
   nommés, séances colorées par module avec horaire, module et les deux autres ressources, pastille de conflit
   (rouge, jaune, « ? » pour incomplet), piles encadrées de rouge quand deux séances se recouvrent ; séances hors
   créneaux dans une ligne « Autres horaires » ; **téléphone** : un jour à la fois (puces des jours avec nombre de
   séances et point rouge de conflit), créneau par créneau, « Libre · ajouter une séance ». Sous la grille : les
   conflits de la semaine pour la ressource. Actions : dupliquer la semaine, imprimer, nouvelle séance.
2. **Conflits** : tuiles (bloquants, à vérifier, incomplets, semaine en cours ou prochaine) ; période « À partir
   de cette semaine » / « Toute l'année » ; filtres par type avec compteurs ; liste groupée par semaine
   (texte, type, gravité, « Voir » qui ouvre la bonne vue du planning) ; 200 premiers affichés.
3. **Heures** : tuiles (réalisé, placé, prévu, modules dépassés) ; filtre par groupe ; **par module** (groupés
   par groupe) et **par formateur** : barre réalisé / placé à venir / repère du volume prévu ou du quota,
   valeurs écrites, étiquette « x h à placer », « +x h » ou « Complet » ; tableau accessible ; export CSV.
4. **Ressources** : groupes (nom, effectif), formateurs (nom, quota annuel, disponibilités hebdomadaires,
   absences datées sans motif), salles (capacité, équipements), modules (groupe, formateur habituel, volume
   prévu, équipement demandé, couleur) ; bouton « Planning » sur chaque ressource ; **encadré RGPD**.
5. **Calendrier** : début et fin d'année, jours de cours (lundi → samedi), semaines A/B, Alsace-Moselle ;
   créneaux (ajout, modification, suppression) ; fermetures (vacances, ponts) ; jours fériés de l'année
   calculés ; puces des semaines (n°, type A/B, fermée) qui ouvrent le planning.
6. **Réglages** (modale) : nom de l'établissement ; exports CSV (semaine affichée, année, bilan des heures),
   impression ; sauvegarde JSON et restauration ; jauge de taille (Ko sur 900) et « Retirer les séances avant
   le … » ; compte ; « Sur téléphone » ; données personnelles ; à propos.

Saisies (modales) : séance (module groupé par groupe, jour, du créneau / au créneau, heures libres, formateur,
salle avec capacité, note, annulée) avec **aperçu des conflits en direct** avant d'enregistrer ; duplication
(portée : la ressource affichée ou tout l'établissement ; vers la semaine suivante ou toutes jusqu'à une date ;
seulement les semaines du même type ; remplacer l'existant ; aperçu du nombre de séances ajoutées, sautées,
remplacées) ; groupe ; formateur (grille de disponibilités jours × créneaux, absences) ; salle ; module ;
créneau ; fermeture.

Premier lancement en 2 étapes : présentation et 4 conseils ; puis nom de l'établissement (facultatif), début et
fin d'année (proposés : premier lundi de septembre → 3 juillet), grille de créneaux type, samedi, semaines A/B.

## Base intégrée (`templates/emploi-du-temps/donnees.js`)

- 4 **grilles de créneaux** types (4 × 1 h 30 ; 5 × 1 h 30 dont un en fin de journée ; heures pleines 8 h →
  18 h ; demi-journées) ; 6 **équipements** courants (vidéoprojecteur, postes informatiques, tableau blanc,
  écran interactif, matériel de visioconférence, accès fauteuil roulant), liste extensible ; 8 **couleurs** de
  modules fixes (fond teinté, filet et texte foncé) ; 4 conseils.
- Aucune donnée datée : les jours fériés sont calculés.

## Calculs (règles pures, `templates/emploi-du-temps/regles.js`, `window.EDT`)

- Dates locales, semaine ISO 8601, lundi de la semaine ; durées en minutes.
- **Jours fériés** : Pâques (algorithme grégorien de Meeus/Jones/Butcher), 11 fêtes légales de l'article
  L3133-1 du Code du travail, plus Vendredi saint et 26 décembre en Alsace-Moselle si coché.
- **Jour fermé** : jour sans cours, férié ou fermeture saisie. **Semaine fermée** : tous ses jours de cours
  fermés. **Semaines A/B** : alternance à partir de la première semaine de l'année, les semaines fermées ne
  comptent pas (l'alternance reprend après les vacances là où elle s'était arrêtée).
- **Conflits** (séances annulées ignorées) : formateur, salle, groupe en double (chevauchement d'horaires le
  même jour ; une séance qui commence quand l'autre finit n'est pas en conflit) ; jour fermé ; capacité de la
  salle < effectif du groupe ; équipement demandé par le module absent de la salle ; formateur indisponible
  (créneau hebdomadaire décoché qui recouvre la séance) ou absent (absence datée) ; **volume** : chaque séance
  qui fait passer le cumul chronologique du module au-delà de son volume prévu ; **quota** : idem pour le
  formateur ; incomplet (sans formateur ou sans salle). Gravités : rouge (doubles, jour fermé), jaune, info.
- **Heures** : prévu (volume du module, quota du formateur), placé (toutes les séances non annulées), réalisé
  (séances terminées : date passée, ou aujourd'hui et fin ≤ heure actuelle), reste à placer, dépassement ; par
  module, formateur et groupe.
- **Duplication** : semaines cibles après la source jusqu'à une date, semaines fermées exclues, option « même
  type A/B » ; recopie des séances non annulées de la portée (tout, ou un groupe, un formateur, une salle) au
  même jour de la semaine ; jours fermés de la cible sautés et comptés ; option « remplacer » qui retire d'abord
  les séances de la portée dans la cible.
- Suppression : un groupe emporte ses modules et leurs séances ; un module ses séances ; un formateur ou une salle
  laissent les séances « à désigner ». Purge des séances avant une date.
- **CSV** (point-virgule, BOM, formules neutralisées) : séances (date, jour, n° et type de semaine, horaires,
  durée, groupe, effectif, module, formateur, salle, statut, conflits, note) ; bilan des heures.
- Normalisation tolérante (valeurs absurdes, anciens états, champs vides omis pour alléger).
- 13 tests `node --test` dans `outils/templates/emploi-du-temps.test.mjs`.

## Sources

- Jours fériés : article L3133-1 du Code du travail (liste des 11 fêtes légales) et régime local
  d'Alsace-Moselle (Vendredi saint, 26 décembre), repris de `templates/conges/regles.js` (déjà en ligne) ;
  **Légifrance non relu pour cette fiche**. Algorithme de Pâques : formule grégorienne classique, vérifiée par
  les tests (2026 : 5 avril ; 2027 : 28 mars).
- Grilles de créneaux, équipements et démo : rédigés pour le produit, génériques.

## Données datées

Aucune (fériés calculés). Les vacances et fermetures sont saisies par l'utilisateur.

## Risques

- **RGPD** : noms des formateurs (tiers) et de leurs indisponibilités. Minimisation : nom ou prénom et initiale,
  **aucun nom d'apprenant** (effectif chiffré seulement), absences **sans motif** (pas de donnée de santé),
  note de séance « aucune donnée personnelle ». Avertissements dans Ressources (encadré), Réglages, page
  catalogue, fiche Gumroad. Les données sont hébergées en ligne par QME (stockage commun des templates).
- **Taille** : limite de 900 Ko par espace de données ; ≈ 117 octets par séance (démo : 1 695 séances ≈ 198 Ko),
  soit de l'ordre de 7 500 séances (≈ 200 par semaine sur 36 semaines). Jauge et purge dans les Réglages,
  message clair si le serveur refuse (413). À dire dans la FAQ (fait).
- **Attente d'optimisation** : certains acheteurs espéreront un placement automatique ; dit clairement (page,
  fiche Gumroad, premier lancement, avertissement de pied de page).
- **Usage à plusieurs** : un accès partagé (dernier enregistrement gagnant, conflit 409 signalé), pas de compte
  formateur ni de lecture seule : FAQ (fait), le reste relève du sur mesure.
- **Sous-groupes** : un demi-groupe est un groupe à part ; les conflits entre une classe entière et ses
  demi-groupes ne sont pas détectés en V1 (pas de hiérarchie de groupes).
- Concurrence : logiciels de planification et de scolarité (abonnements), tableurs ; se distinguer par la
  détection immédiate, la simplicité, le prix unique et la minimisation des données.

## RGPD (rappel affiché dans l'application)

« Note seulement le nom (ou le prénom et l'initiale) des formateurs et le nom des groupes. Aucun nom
d'apprenant : l'effectif suffit pour vérifier les salles. Les absences des formateurs se notent sans motif.
Efface ce qui ne sert plus en fin d'année. » (Ressources) ; dans les Réglages, en plus : données en ligne liées à
la clé, ni lues ni partagées par QME, informer les formateurs.

## Points à faire valider par Quentin

- Prix 45 €, nom « Emploi du temps d'établissement », permalien `emploi-du-temps-etablissement`, catégorie
  Gumroad (`education` ou `business-and-money`).
- Périmètre V1 : placement manuel seulement ; pas de hiérarchie classe / demi-groupes ; séance = un module (donc
  un seul groupe) ; pas de séance commune à plusieurs groupes (à placer une fois par groupe, avec la même salle :
  conflit de salle signalé) ; accès unique sans comptes formateurs.
- Choix de calcul : alternance A/B qui saute les semaines entièrement fermées ; « réalisé » = séance terminée
  (pas d'émargement) ; volume et quota signalés séance par séance au-delà du plafond.
- Limite de taille (≈ 200 séances par semaine sur l'année) et la purge des semaines passées.
- Hashtags proposés hors jeux habituels pour LinkedIn (`#OrganismeDeFormation`, `#FormationProfessionnelle`,
  `#EmploiDuTemps`).
- Le nom de l'organisme fictif de la démo, « Centre de formation des Tilleuls (fictif) » : générique, mais un
  organisme réel pourrait porter un nom proche (**non vérifié**) ; à remplacer si besoin.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/bascule/` (connexion avec `produit: 'EDT'` dans les deux appels à `/connexion`,
  synchronisation et 409, 413 signalé, démo `?demo` non mémorisée, modales, toast Annuler, export / import JSON,
  service worker `emploi-du-temps-20261114`, fenêtre « Comme une application » avec la clé
  `qme-edt-ecran-accueil`, bandeau « Bientôt en vente · Être prévenu de la sortie » vers
  `/catalogue/emploi-du-temps/`). Vue et ressource affichées retenues localement (`qme-edt-pref`).
- Démo relative à aujourd'hui : « Centre de formation des Tilleuls (fictif) », 5 groupes, 6 formateurs (prénom
  et initiale inventés), 5 salles, 16 modules, une année en semaines A et B (≈ 1 700 séances), 3 fermetures. La
  semaine affichée à l'ouverture (la semaine en cours, ou la suivante le week-end) contient un groupe en double,
  un formateur en double, une salle en double, deux salles trop petites, un équipement manquant, une
  indisponibilité, une séance incomplète et une séance annulée ; une absence datée la semaine suivante ; Paie,
  Tableur avancé et Thomas R. dépassent leur volume ou leur quota au fil de l'année (avril à juillet) ; « Préparation à l'examen »
  n'a aucune séance ; Marc V. n'a ni séance ni quota.
- Graphique des heures (skill dataviz) : réalisé en bleu de la charte, placé à venir en bleu clair cerné de
  bleu, repère de cible en trait encre ; valeurs écrites, légende, tableau accessible. Le validateur de palette
  signale un plancher de chroma bas pour ces bleus adoucis : compensé par le contour, les valeurs et le tableau.
- Impression A4 paysage (`@page{size:A4 landscape}`) : semaine de la ressource affichée, injectée dans
  `#impression`.
- Vérifié le 14/11/2026 : 13 tests de règles, `npm test` complet, Playwright 1280 px, iPhone 13 et Pixel 7
  (parcours code faux / valide, premier lancement, saisie, aperçu des conflits, duplication, impression générée,
  export CSV, synchronisation vers un second contexte, rechargement, popup « Comme une application »). Impression
  papier réelle **non vérifiée** (contenu généré seulement), Safari réel non testé (moteur Chromium émulant
  l'iPhone).
