# T55 · Gestion de classe

Slug `gestion-classe`, préfixe `CSE` (clés locales `qme-cse-*`, règles `window.CSE`), prix prévu 25 € (**à
confirmer par Quentin**), permalien Gumroad prévu `gestion-classe`, catégorie Gumroad `education` (**à
vérifier**), taille M, priorité P2. Catalogue : `data-pour="pro"`, thème « Associations, formation et
événements » (`associations-formation-et-evenements`, `--c:var(--rouge)`). Origine : backlog de Quentin
n° 32. Marques de risque : **RGPD** (données d'élèves, mineurs), **daté** (référentiel du socle commun et
échelle de maîtrise : sourcés, datés, modifiables). Fiche rédigée le 14/11/2026. Aucune marque, aucun
logiciel de vie scolaire nommé, aucune donnée réelle d'élève ou d'établissement ; aucune automatisation ni
lien externe.

## Point bloquant avant la vente : RGPD (à trancher par Quentin)

La remarque « stockage local uniquement » du backlog est caduque : les données sont hébergées en ligne par
QME (stockage commun des templates), liées à la clé de l'acheteur. Des données d'élèves, en majorité
mineurs, sont des données personnelles de tiers. **Quentin doit trancher avant la mise en vente**, au vu de
ce qui suit. Rien de juridique n'est affirmé ici sans source officielle vérifiée.

Conduite appliquée dans le produit (minimisation par conception) :
- identité de l'élève limitée à **un seul champ** « prénom et initiale du nom, ou pseudonyme » (40
  caractères) ; **aucun champ** date de naissance, adresse, photo, coordonnées, santé, handicap, famille ;
- remarque facultative par élève (200 caractères) et appréciations : **avertissement visible** de n'y
  écrire aucune donnée sensible (fenêtre Élèves, fenêtre Appréciation, pied de chaque vue) ;
- **avertissement au premier lancement** (case à cocher obligatoire), **dans les Réglages**, dans l'onglet
  Classes et en bandeau du tableau de bord tant qu'il n'est pas lu : outil personnel de préparation,
  données hébergées en ligne, vérifier avec l'établissement et, si besoin, le délégué à la protection des
  données de l'académie avant de saisir des données réelles, ne remplace pas le logiciel de vie scolaire
  officiel ;
- **effacement de fin d'année** (onglet Classes, confirmation en tapant EFFACER) : élèves, notes,
  positionnements et appréciations de l'année supprimés ; structure gardée ; suppression d'une année
  entière possible ; **export pour reprise** (CSV de toutes les notes, copie JSON complète) ;
- démo avec des **prénoms fictifs** suivis d'une initiale, gardée dans le navigateur.

**À vérifier** (non vérifié sur une source officielle dans cette session : education.gouv.fr et Éduscol ont
refusé l'accès automatisé, réponse 403 ; cnil.fr n'a pas été consulté) : le régime applicable à un enseignant qui utilise un outil
personnel hébergé par un tiers pour des données d'élèves (responsabilité de traitement, rôle de
l'établissement et du délégué à la protection des données de l'académie, éventuelles règles ministérielles
sur les outils numériques non institutionnels), la nécessité d'un contrat de sous-traitance ou de mentions
d'information propres à QME, la durée de conservation à recommander, l'hébergement (localisation des
données du stockage Netlify Blobs) et la mise à jour de la page `/confidentialite/` du site. Options pour
Quentin : (a) vendre tel quel avec ces avertissements après avis d'un juriste ; (b) imposer le pseudonyme
(aucun prénom) ; (c) chiffrer les noms côté client ; (d) renoncer à l'hébergement en ligne pour ce
template (stockage local seulement, en rupture avec le socle commun) ; (e) ne pas vendre.

## Pour qui

Enseignants de collège et de lycée qui suivent plusieurs classes et groupes (demi-groupes, spécialités,
accompagnement) : saisie des notes sur des barèmes variés, coefficients, compétences à positionner,
appréciations à rédiger avant chaque conseil de classe. Outil **personnel de préparation**, à côté du
logiciel officiel de l'établissement (jamais nommé), sans lien avec lui.

## Promesse

Tes classes, de la note au bulletin : notes saisies en quelques secondes, moyennes et statistiques
calculées, compétences sur quatre échelons, appréciations composées en quelques clics, bulletins prêts.

## Écrans (5 onglets + réglages)

1. **Tableau de bord** : année (sélecteur, « Nouvelle année… ») ; avertissement données d'élèves tant
   qu'il n'est pas lu ; tuiles (classes et groupes, élèves, évaluations de la période, notes à saisir) ;
   « À faire » (notes manquantes d'évaluations passées : en retard après 14 jours ; évaluations des 14
   prochains jours ; appréciations à rédiger dans la fenêtre avant la fin de période), chacun avec son
   bouton (Saisir, Voir, Rédiger) ; « Mes classes » (effectif, évaluations, moyenne, médiane, extrêmes,
   appréciations rédigées).
2. **Notes** : classe, période ou « Toute l'année » ; tuiles (moyenne de classe, médiane, plus basse et plus
   haute, évaluations) ; carnet de notes (élèves × évaluations, notes sur le barème, ABS / NN / DISP,
   bonus retenu souligné ou non retenu barré, colonne moyenne, ligne moyenne de la classe, première
   colonne figée, défilement horizontal) ; répartition des moyennes (6 tranches, une série, valeurs
   affichées, infobulle, tableau accessible) ; liste des évaluations (moyenne, extrêmes, spéciales, notes
   manquantes, « Saisir ») ; export CSV de la classe.
3. **Compétences** : classe, période ; légende des 4 échelons ; grille élèves × compétences évaluées
   (bilan, nombre de positionnements en infobulle), ligne « Satisfaisante ou mieux » ; référentiel affiché
   et modifiable ; source.
4. **Bulletins** : classe, période ; progression des appréciations ; une carte par élève (moyenne,
   appréciation ou « À rédiger », longueur au-delà du conseillé) ; « Rédiger » ; « Bulletin » ; « Banque de
   phrases » ; « Imprimer la classe ».
5. **Classes** : année (périodes avec dates, période en cours), « Modifier l'année », « Nouvelle année » ;
   cartes des classes et groupes (effectif, évaluations, moyenne annuelle, élèves, « Élèves », « Notes »,
   « Modifier ») ; fin d'année (export CSV, copie, effacement, suppression de l'année) ; rappel données.
6. **Réglages** : décimales (1 ou 2), longueur conseillée d'une appréciation (300), fenêtre des
   appréciations à rédiger (21 jours) ; données d'élèves ; export CSV ; sauvegarde et reprise (taille
   utilisée) ; compte ; « Sur téléphone » ; à propos et sources.

Saisies (modales) : année (nom, début, découpage trimestres ou semestres, périodes nom + date de fin,
reprise des classes d'une autre année sans élèves) ; classe (nom, matière avec liste proposée, classe
entière ou groupe, liste d'élèves collée) ; élèves (renommer, remarque, « parti(e) de la classe »,
supprimer, ajouter une liste) ; évaluation (classe, titre, date, coefficient, notée ou compétences
seulement, barème, bonus, compétences cochées) ; **saisie** (notes : un champ par élève, Entrée ou flèche
bas → suivant, flèche haut → précédent, a / n / d, boutons ABS / NN / Disp., conversion sur 20, contrôle du
barème, statistiques en direct ; compétences : 4 boutons par élève et par compétence) ; appréciation
(moyenne de l'élève et de la classe, bilan des compétences, texte avec compteur, phrases filtrées par niveau
avec niveau proposé d'après la moyenne, « Enregistrer et élève suivant ») ; bulletin (aperçu, imprimer,
copier) ; référentiel ; banque de phrases ; élève (moyennes par période et annuelle).

Premier lancement en 2 étapes : présentation, 4 conseils et avertissement données d'élèves (case
obligatoire) ; puis découpage de l'année, première classe, matière et liste d'élèves facultative.

## Base intégrée (`templates/gestion-classe/donnees.js`)

- **Découpages** : trimestres (fins proposées 30/11, 15/03, 30/06) et semestres (31/01, 30/06), **à
  ajuster** : aucun calendrier officiel intégré (zones, établissements différents).
- **Notes spéciales** : ABS (absent), NN (non noté), DISP (dispensé), saisies par a / n / d.
- **Échelle de maîtrise à 4 échelons** : maîtrise insuffisante, maîtrise fragile, maîtrise satisfaisante,
  très bonne maîtrise (article D122-3, voir Sources).
- **Référentiel « Socle commun »** (8 entrées) : les 4 composantes du domaine 1 et les domaines 2 à 5
  (article D122-1, intitulés recopiés) ; **référentiel générique** de 5 compétences d'exemple, présenté
  comme à adapter.
- **Banque d'appréciations** : 32 phrases rédigées pour l'outil, 4 axes (résultats, travail, attitude en
  classe, conseil) × 4 niveaux, `{prenom}` remplacé à l'insertion ; modifiable.
- 16 matières proposées (liste libre), 4 conseils.

## Calculs (règles pures, `templates/gestion-classe/regles.js`, `window.CSE`)

- **Année scolaire** de la date : commence le 1er septembre (août compte pour l'année suivante).
  **Périodes** : chacune du lendemain de la fin précédente à sa date de fin ; une évaluation appartient à
  la période de sa date (avant la première : la première ; après la dernière : la dernière).
- **Saisie** : nombre à la française (2 décimales au plus), refus au-dessus du barème, codes spéciaux.
- **Note sur 20** = note / barème × 20. **Moyenne d'un élève** = Σ(note sur 20 × coefficient) / Σ coef.,
  notes spéciales et coefficients nuls exclus. **Bonus** : examinés dans l'ordre des dates, chacun retenu
  seulement s'il fait monter la moyenne ; sans note ordinaire, aucun bonus ne compte.
- **Statistiques** : moyenne, médiane (moyenne des deux valeurs centrales si effectif pair), min, max ;
  **répartition** en 6 tranches (< 8, 8–10, 10–12, 12–14, 14–16, ≥ 16, bornes basses incluses).
- **Moyenne de la classe** = moyenne des moyennes des élèves notés. **Moyenne annuelle** = moyenne des
  moyennes de périodes connues (chaque période pèse autant) : choix documenté, **à valider par Quentin**.
- **Compétences** : bilan = moyenne des positionnements (1 à 4) de la période, arrondie, ,5 vers le haut ;
  « satisfaisante ou mieux » = bilan ≥ 3.
- **Appréciations** : niveau de phrases proposé d'après la moyenne (< 8 : 1 ; < 12 : 2 ; < 15 : 3 ; sinon 4),
  simple aide ; composition, prénom = premier mot du nom affiché.
- **À faire**, **bulletin** (données et texte à copier), **CSV** (classe × période ; toutes les notes,
  point-virgule, BOM UTF-8, formules neutralisées), **fin d'année** (effacement, suppression d'une classe,
  d'une année, d'un élève avec ses notes), reprise des classes, lecture d'une liste collée, normalisation
  tolérante, taille de l'état.
- 19 tests `node --test` dans `outils/templates/gestion-classe.test.mjs`.

## Sources

- **Code de l'éducation, article D122-1** (cinq domaines du socle commun), version issue du décret
  n° 2015-372 du 31 mars 2015, « en vigueur depuis le 01 septembre 2016 », page Légifrance
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030428781 **lue le 14/11/2026** (« En vigueur au
  14/11/2026 ») : « Les langages pour penser et communiquer », « Les méthodes et outils pour apprendre »,
  « La formation de la personne et du citoyen », « Les systèmes naturels et les systèmes techniques »,
  « Les représentations du monde et l'activité humaine ».
- **Code de l'éducation, article D122-3** (évaluation), modifié par le décret n° 2015-1929 du 31 décembre
  2015, page Légifrance https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030428770 **lue le
  14/11/2026** (« En vigueur au 14/11/2026 ») : quatre composantes du domaine 1 (langue française ; langues
  étrangères et, le cas échéant, langues régionales ; langages mathématiques, scientifiques et
  informatiques ; langages des arts et du corps) ; échelle à quatre échelons « Maîtrise insuffisante »,
  « Maîtrise fragile », « Maîtrise satisfaisante », « Très bonne maîtrise ». Lecture faite avec l'outil de
  lecture web (résumé de la page) : **relire le texte exact** avant la mise en vente.
- Noté au passage : l'**annexe** du décret de 2015 (détail des objectifs de chaque domaine) est indiquée
  « en vigueur du 01 septembre 2016 au 02 septembre 2019 » ; elle n'est pas reprise.
- Non vérifié, donc non intégré : pages Éduscol et education.gouv.fr (accès refusé, 403), livret scolaire
  et ses modalités, calendrier scolaire, règles RGPD (voir plus haut). Banque de phrases, référentiel
  générique et dates de périodes : rédigés pour le produit (aucune base externe, pas de licence).

## Données datées

- Domaines du socle et échelle de maîtrise : source et date de consultation affichées (Compétences,
  Référentiel, Réglages) ; à revérifier chaque année sur Légifrance et à mettre à jour dans `donnees.js`.
  Le référentiel de l'acheteur reste modifiable.
- Dates de périodes : jamais imposées, saisies ou ajustées par l'enseignant.

## Risques

- **RGPD** : voir le point bloquant ci-dessus.
- **Responsabilité** : outil d'aide ; moyennes calculées selon des règles affichées ; ne remplace pas le
  logiciel officiel ; le bulletin imprimé porte « document de préparation ».
- **Concurrence** : logiciels de vie scolaire des établissements (jamais nommés), tableurs ; se distinguer
  par la saisie rapide, la banque d'appréciations, les compétences sourcées, l'achat unique et le
  téléphone, sans jamais se présenter comme un remplaçant.
- **Volume** : environ 900 000 octets par compte ; une année de 6 classes × 30 élèves × 40 évaluations
  tient largement (estimation, à surveiller) ; message en cas de dépassement (413) et taille affichée dans
  les Réglages.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/voiture/` (connexion avec `produit: 'CSE'` dans les deux appels, synchronisation
  et 409, démo `?demo` non mémorisée, modales, toast « Annuler », export / import JSON, service worker
  `gestion-classe-20261114`, fenêtre « Comme une application » avec la clé `qme-cse-ecran-accueil`, entrée
  « Sur téléphone » des réglages, bandeau « Bientôt en vente » vers `/catalogue/gestion-classe/`).
- Démo : enseignant fictif de mathématiques, « 4e B » (24 élèves), « 3e A » (22), « 2nde · groupe 2 »
  (groupe, 12) ; prénoms fictifs et initiale ; dates relatives (fin du 1er trimestre dans 16 jours) ;
  états couverts : notes manquantes récentes et anciennes, évaluations à venir, ABS, NN, DISP, bonus
  retenu et non retenu, barèmes sur 10, 20 et 40, coefficients 0,5 à 2, évaluation de compétences sans
  note, appréciations en partie rédigées, groupe sans compétence (état vide).
- Graphiques (skill dataviz) : une seule série (répartition, bleu de la charte), valeurs affichées,
  infobulle, tableau. Échelons de maîtrise : **une seule teinte du clair au foncé** (ordre, pas catégorie)
  avec le numéro toujours affiché, contrastes vérifiés (≥ 4,5:1) ; le validateur de palette catégorielle
  n'est pas applicable à une échelle ordonnée.
- Bulletins imprimés : pages injectées dans `#impression`, une page par élève (saut de page), `window.print()`.

## Points à valider par Quentin

1. **RGPD : décision avant toute mise en vente** (options ci-dessus) et mise à jour de `/confidentialite/`.
2. Prix (25 €), nom, permalien, catégorie Gumroad.
3. Moyenne annuelle = moyenne des périodes (autre choix possible : toutes les notes de l'année pondérées).
4. Règle du bonus (retenu seulement s'il fait monter la moyenne).
5. Bilan de compétence = moyenne arrondie (autre choix possible : dernier positionnement).
6. Ordre des classes : ordre de création (pas de tri alphabétique).
