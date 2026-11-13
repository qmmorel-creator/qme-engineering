# T30 · Planner horaire

Slug `planner`, préfixe `PHR`, prix 15 €, permalien Gumroad `planner-horaire`, taille M, priorité P1.
Origine : backlog de Quentin n° 02 « Planner horaire time-blocking » (12/11/2026). Fiche rédigée le
12/11/2026 à partir de la ligne T30 de `IDEES.md` (grille 30 min, glisser-déposer, catégories couleur,
bilan prévu / réalisé hebdomadaire ; base : semaines types cadre, freelance, étudiant, catégories
préréglées). Aucune marque de risque (ni daté, ni fiscal, ni RGPD : seules les données de l'acheteur).

## Pour qui

Cadres, freelances et étudiants qui veulent **décider à l'avance où passe leur temps** (méthode du
« time-blocking » : chaque heure de la semaine a une destination) puis vérifier, le vendredi, ce qui a
réellement été fait. Ceux pour qui un agenda partagé est encombré de réunions des autres et une liste de
tâches ne dit pas *quand* travailler.

**Distinct du gestionnaire de tâches (T03, `templates/taches/`)** : ici on planifie **du temps** (des
blocs sur une grille), pas des tâches à cocher. Pas d'échéances, pas de projets, pas de sous-tâches.

## Promesse

Ta semaine en blocs de 30 minutes, et chaque vendredi l'écart entre ce que tu avais prévu et ce que tu
as vraiment fait, catégorie par catégorie.

## Écrans (4 onglets + réglages)

1. **Semaine** (écran principal) : grille du lundi au dimanche (week-end masquable), une ligne par
   demi-heure entre l'heure de début et l'heure de fin choisies (7 h – 21 h par défaut). Les blocs sont
   des aplats à la couleur de leur catégorie ; trait « maintenant » sur le jour en cours ; navigation
   semaine précédente / suivante / cette semaine ; totaux prévus par jour. Actions : nouveau bloc,
   copier la semaine précédente, appliquer une semaine type.
   **Sur téléphone : vue jour** (une colonne, défilement vertical, bandeau des 7 jours au-dessus), jamais
   la grille de 7 colonnes illisible.
2. **Aujourd'hui** : bloc en cours et suivant, liste des blocs du jour avec les 4 marques en un geste
   (Fait, Raccourci, Déplacé, Pas fait), blocs « à marquer » des jours précédents de la semaine.
3. **Bilan** : semaine choisie ; tuiles (prévu, réalisé, taux de réalisation à ce jour, blocs à
   marquer) ; graphique prévu / réalisé par catégorie (barres horizontales, réalisé plein sur prévu
   hachuré) ; tableau par catégorie (prévu, réalisé, écart, déplacés, pas faits) ; tendance des
   6 dernières semaines (heures réalisées et taux).
4. **Modèles** : semaines types de la base et semaines enregistrées par l'utilisateur (aperçu,
   appliquer à la semaine affichée en blocs ponctuels ou en blocs récurrents) ; séries récurrentes en
   cours (modifier, arrêter) ; catégories (nom, couleur parmi les 8 fixes).
5. **Réglages** (icône) : prénom, heures de début et de fin de la grille, afficher le week-end,
   sauvegarde (export / import JSON), compte (déconnexion).

## Saisie et manipulation

- **Glisser-déposer** (souris et tactile, Pointer Events) : glisser un bloc le déplace (pas de 30 min,
  changement de jour sur la grille) ; la poignée du bas le redimensionne ; glisser sur une zone vide
  dessine un nouveau bloc et ouvre le formulaire prérempli. Au doigt, un appui long (≈ 0,35 s) saisit le
  bloc, pour ne pas gêner le défilement.
- **Clavier** : chaque bloc est un bouton ; flèches haut / bas = ± 30 min, gauche / droite = jour
  précédent / suivant, Maj + flèches = durée ± 30 min, Entrée = ouvrir, Suppr = supprimer (avec
  « Annuler »).
- **Formulaire** (alternative complète) : titre, catégorie, jour, début, durée (30 min à 12 h), répétition
  (aucune, chaque jour ouvré, jours de la semaine cochés), note.
- Bloc d'une série : un déplacement ou une marque ne touche **que cette occurrence** ; la modification
  par le formulaire propose « cette occurrence » ou « toute la série à partir de ce jour ».

## Mécanique clé

- **Temps** : minutes depuis minuit, multiples de 30 ; un bloc ne déborde pas sur le lendemain.
- **Séries récurrentes** : règle (jours de la semaine, début, durée, date de départ, date de fin
  facultative, exceptions). Les occurrences sont calculées à l'affichage ; toute action sur une
  occurrence la « détache » en bloc ponctuel (exception sur la série) : l'historique reste exact quand
  la série change.
- **Chevauchements** autorisés mais visibles : les blocs qui se recouvrent se partagent la largeur de la
  colonne (couloirs calculés).
- **Marques** (seulement pour un bloc commencé) : Fait (réalisé = durée), Raccourci (durée réelle saisie,
  par quarts d'heure, inférieure à la durée), Déplacé (le bloc d'origine reste en fantôme hachuré et une
  copie est créée au créneau choisi), Pas fait (réalisé = 0).
- **Bilan** d'une semaine, par catégorie :
  prévu = durée des blocs de la semaine hors blocs déplacés (comptés à leur nouvelle place) ;
  prévu à ce jour = même somme limitée aux blocs commencés ;
  réalisé = durées des blocs faits + durées réelles des blocs raccourcis ;
  taux = réalisé ÷ prévu à ce jour ; à marquer = blocs commencés sans marque.

## Base intégrée

- **8 couleurs fixes** (charte : bleu, rouge, jaune, vert, bleu ciel, prune, noir, orange) ; une
  catégorie par couleur, 8 catégories au plus.
- **3 semaines types** avec leurs catégories préréglées :
  - **Cadre** (7 catégories : Travail de fond, Réunions, Messages et admin, Équipe, Pauses et repas,
    Sport et perso, Préparation) : 2 h de travail de fond chaque matin, messages groupés à 8 h 30 et
    16 h 30, réunion d'équipe le lundi, créneaux réunions mardi et jeudi après-midi, points individuels le
    mercredi, bilan et préparation de la semaine le vendredi, sport deux soirs.
  - **Freelance** (6 catégories : Production client, Prospection, Admin et factures, Formation et veille,
    Pauses et repas, Sport et perso) : production le matin et trois après-midi, prospection le mercredi,
    facturation et veille le vendredi après-midi, sport trois soirs.
  - **Étudiant** (7 catégories : Cours, Révisions, Devoirs et projets, Job étudiant, Sport, Pauses et
    repas, Loisirs) : cours en semaine, révisions en fin d'après-midi, projets le mercredi après-midi, job
    le samedi matin, révisions le dimanche.
  - Option **vierge** : catégories génériques, aucun bloc.
- Conseils de méthode (aide de l'onglet Modèles) : regrouper les tâches semblables, protéger un bloc de
  travail de fond le matin, garder des marges entre les blocs, faire le bilan en fin de semaine.

Contenu original rédigé pour QME : aucune source externe, aucune licence, rien de daté.

## Sources et risques

- Aucune donnée réglementaire, aucun barème : rien ne se périme.
- Données personnelles : uniquement l'emploi du temps de l'acheteur (pas de tiers). Hébergement en ligne
  comme tous les templates.
- Risque produit : marché d'agendas gratuits ; se distinguer par le bilan prévu / réalisé, les semaines
  types prêtes et l'achat unique.

## Choix d'implémentation (12/11/2026)

- Règles pures dans `templates/planner/regles.js` (`window.PHR`), testées par
  `outils/templates/planner.test.mjs`.
- Démo : profil freelance, séries de la semaine type, historique des 5 semaines précédentes simulé avec
  les vraies règles, et à des dates relatives à aujourd'hui : bloc fait, raccourci, déplacé (avec sa
  copie), pas fait, à marquer, deux blocs qui se chevauchent, une semaine enregistrée comme modèle.
- Graphiques : palette fixe de la charte (les 8 couleurs ne passent pas toutes la bande de clarté du
  validateur du skill dataviz) compensée par un contour encre de 2 px sur chaque barre, le nom de la
  catégorie écrit sur chaque ligne et un tableau complet sous le graphique.
