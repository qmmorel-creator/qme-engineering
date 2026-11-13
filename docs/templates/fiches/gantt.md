# T02 · Planning Gantt rapide · choix d'implémentation

Slug `gantt`, préfixe `GNT`, prix 45 €, permalien Gumroad `planning-gantt`, taille L, priorité P1.
La fiche fonctionnelle validée est dans `docs/templates/IDEES.md` (section « T02 · Planning Gantt
rapide ») ; elle n'est pas réécrite ici. Ce document note seulement ce qui a été décidé en la codant.
Tout le code a été écrit à partir de la fiche, sans reprendre le code de l'outil interne.

## Fichiers

- `templates/gantt/regles.js` : règles pures (`window.REGLES`) : calendrier, fériés, ordonnancement et
  CPM, avancement, saisie rapide, échelle de temps. Testées par `outils/templates/gantt.test.mjs`.
- `templates/gantt/donnees.js` : base intégrée (`window.BASE`) : 7 couleurs de plannings, 12 modèles,
  source des fériés.
- `templates/gantt/app.js` : socle QME (connexion `GNT`, démo, synchro, hors ligne, 409, modales,
  toast « Annuler », réglages) et vues.

## Modèle de données (synchronisé)

`{ plannings, taches, reperes, periodes, planningActif, enchainer }`

- **planning** : `nom`, `couleur`, `debut` (date de départ des tâches sans date ni lien), `ouvres`
  (jours ouvrés ou calendaires), `alsace` (fériés d'Alsace-Moselle), `masque`, `sections[]`
  (`nom`, `replie`, `masque`).
- **tâche** : `planningId`, `sectionId`, `nom`, `debut` (facultatif : contrainte « pas avant le »),
  `duree` (en jours du calendrier du planning ; 0 = jalon), `avancement` (0-100), `deps[]`
  (`id`, `type` FD/DD/FF/DF, `decalage`), `plage` (jalon à plage : `debut`, `fin`), `reference`
  (`debut`, `fin` figés), `note`.
- **repère** (`date`, `nom`) et **période** (`debut`, `fin`, `nom`) : `planningId` nul = communs.
- Préférences propres à l'appareil, hors synchro (`qme-gnt-affichage`) : zoom, calques, colonnes.

## Calcul (regles.js)

- **Index de jour** : chaque date devient un entier. En jours calendaires, l'écart à une origine (lundi
  1/1/1990). En jours ouvrés, le nombre de jours du lundi au vendredi moins les fériés en semaine
  (table 1990-2200, recherche dichotomique) ; une date non ouvrée prend l'index du jour ouvré suivant.
  Toute la planification se fait en entiers, les dates ne servent qu'à l'affichage.
- **Tâche** = intervalle `[es, ef[` ; jalon : `es = ef`, affiché au milieu de son jour.
- **Aller** (tri topologique de Kahn) : `es = max(début imposé, contraintes des liens)` ; sans date ni
  lien, `es` = début du planning. FD : `es ≥ ef(p) + d` ; DD : `es ≥ es(p) + d` ; FF : `ef ≥ ef(p) + d` ;
  DF : `ef ≥ es(p) + d`. Successeurs poussés automatiquement ; une date imposée reste une contrainte
  (la tâche revient à sa date si son prédécesseur raccourcit).
- **Retour** : fin du projet = plus grande `ef` ; `lf` de chaque tâche = minimum des contraintes de ses
  successeurs (formules inverses) ; marge totale `ls - es` ; marge libre = plus petit jeu laissé à un
  successeur (bornée par la marge totale) ; critique si marge totale ≤ 0.
- **Boucles** : refusées à la saisie (`creeBoucle`), et ignorées au calcul si une copie importée en
  contient (tâches signalées dans la vue Chemin critique).
- **Avancement attendu** au matin d'aujourd'hui = jours écoulés / durée ; statut `retard` si
  l'avancement réel est en dessous, retard en jours = `ceil((attendu - réel) × durée)`. Jalon non fait
  et dépassé : retard = jours écoulés depuis sa date.
- **Référence** : « Figer la référence » copie dates de début et de fin calculées ; écart = différence
  d'index de fin (jours ouvrés si le planning l'est).
- **Jalon à plage** : état `avance` / `dans` / `depasse` de la date calculée face à la fenêtre ; la
  plage est un repère de suivi, elle ne contraint pas le calcul (une plage dépassée apparaît en rouge).
- **Saisie rapide** : jetons dans n'importe quel ordre : date `jj/mm[/aa]` (sans année : l'occurrence
  la plus proche d'aujourd'hui), durée `5j`, `5 j`, `2 sem` (× 5 en jours ouvrés, × 7 sinon), `40%`,
  `jalon` ou `0j`, `plage 10/12-18/12`, `après 3, 5DD+2`. Ligne `_Lot_1` : section « Lot 1 ». Le reste
  forme le nom. Plusieurs lignes collées d'un coup sont toutes ajoutées.
- **Section de saisie** : celle choisie (bouton + d'une section), sinon la dernière du planning, ou
  « hors section » sur choix explicite. « Enchaîner » : sans date ni lien, la tâche suit la précédente de
  sa section (lien FD).

## Jours fériés

Calculés, jamais stockés : 11 jours du Code du travail (art. L3133-1), Pâques par l'algorithme
grégorien anonyme (Meeus / Jones / Butcher), Ascension = Pâques + 39, Lundi de Pentecôte = Pâques + 50.
Option Alsace-Moselle par planning : Vendredi saint et 26 décembre. Vérifié le 12/11/2026 sur
service-public.gouv.fr (fiche F2405, à jour du 1er janvier 2026 : listes 2026 et 2027), dates 2026 et
2027 reprises dans les tests. Source et date affichées dans Réglages et dans la vue Plannings. Vacances
scolaires : non intégrées (dates officielles annuelles), à saisir en période. Les périodes hachurées
sont visuelles et ne changent pas les durées ; seuls week-ends et fériés le font en jours ouvrés.

## Écrans

1. **Gantt** : saisie rapide (planning, champ, Enchaîner, section courante, aide « Syntaxe ») ; zoom
   continu (curseur logarithmique 0,12 à 60 px/jour, boutons, Ctrl + molette centrée sur le pointeur,
   pincement à deux doigts), « Aujourd'hui », « Ajuster », « Annuler » (40 niveaux, Ctrl + Z) ; un seul
   cadre défilant : tableau collant à gauche (n°, nom, début, durée, fin, %, liens, éditables ;
   « Masquer les colonnes » ; sur téléphone n° + nom seulement, une touche ouvre la fiche), échelle
   collante en haut (deux bandeaux : mois/semaines, jours, années/trimestres selon le zoom, libellés du
   bandeau haut gardés visibles au défilement) ; SVG : week-ends, fériés et périodes hachurés, repères,
   ligne d'aujourd'hui, barres (partie pleine = avancement), référence en gris sous la barre, jalons en
   losange, plages entre crochets, liens à angle droit, chemin critique en rouge, étiquettes avec retard.
   Souris : glisser une barre (début), son bord droit (durée), le rond au bout (lien FD vers une autre
   barre, boucles refusées). Infobulle : dates, plage, attendu, marges, référence.
2. **Plannings** : cartes (dates, avancement pondéré par les durées, retards, critiques, affiché ou
   non), dupliquer ; 12 modèles ; listes des repères et périodes ; source des fériés.
3. **Chemin critique** : choix du planning ; fin, durée, nombre de tâches critiques et leur chaîne, plus
   petite marge ; tableau dates au plus tôt / au plus tard, marges totale et libre ; explication.
4. **Suivi** : par planning visible : avancement réel / attendu, retards, écart de fin face à la
   référence, jalons hors plage ; tableau des statuts ; figer / effacer la référence.
- **Affichage** (panneau « Dossiers ») : plannings, sections et 7 calques à montrer ou masquer.
- **Imprimer / PNG** : A4 ou A3 paysage, plannings choisis, toute la durée tenant dans la largeur,
  sections dépliées ; un seul SVG (colonne des tâches avec dates + Gantt) imprimé via `@page`
  (PDF par « Enregistrer au format PDF ») ou converti en PNG ×2 par un canvas.

## Modèles (12, fictifs, durées indicatives)

Rénovation de cuisine, rénovation de salle de bains, construction de maison (grandes phases),
déménagement, création d'entreprise, lancement d'un site web, organisation d'un événement, mémoire ou
thèse, recrutement, salon professionnel, lancement d'un produit, projet de groupe étudiant. Tous
utilisent sections, liens (dont DD, FF, DF et décalages) et, pour sept d'entre eux, un jalon à plage
(vérifié par test : le jalon tombe dans sa plage au calcul). Aucune durée réglementaire n'est affirmée :
les étapes administratives (instruction du permis, délai de recours, immatriculation, préavis) portent
la mention « à vérifier » ou « variable ».

## Démo (relative à aujourd'hui)

Rénovation de cuisine (démarrée il y a 36 jours, référence figée puis plomberie rallongée de 2 jours :
écart +2 ; plâtrerie en retard ; livraison des meubles dans sa plage), lancement du site web (deux tâches
en retard, mise en ligne hors plage, repère « Comité de pilotage » et période « Congés de l'équipe »
propres), salon professionnel (à venir, section « Après » repliée), déménagement du bureau (masqué).
Communs : repère « Point d'étape », période « Fermeture de fin d'année ».

## Écarts et limites connus

- Le partage en lecture seule (lien) prévu en option ultérieure par la fiche n'est pas fait.
- Pas de ressources ni de calendrier par tâche ; un seul calendrier par planning.
- Liens seulement à l'intérieur d'un planning.
- Pas de réordonnancement par glisser dans le tableau : boutons « Monter / Descendre » dans la fiche.
- Les durées glissées à la souris se calent sur des jours entiers ; le glisser n'existe pas au doigt
  (une touche ouvre la fiche, pour ne pas gêner le défilement).
- Palette des plannings : le validateur dataviz signale le bleu foncé et le jaune hors de la bande de
  clarté ; compensé par un contour encre sur chaque barre, le nom du planning en en-tête de bloc et le
  tableau des tâches (identité jamais portée par la seule couleur). Le rouge est réservé au chemin
  critique et aux retards.

## Risques

Aucune marque de risque (pas d'argent, de santé, de fiscalité ni de données personnelles sensibles).
Fériés : calculés, source datée affichée. **Confidentiel** respecté : aucune tâche, nom, date ni capture
issus d'un artefact professionnel ; modèles et démo fictifs.
