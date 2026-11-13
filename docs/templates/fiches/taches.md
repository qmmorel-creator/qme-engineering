# T03 · Gestionnaire de tâches : choix d'implémentation

La fiche validée est dans `docs/templates/IDEES.md` (« T03 · Gestionnaire de tâches », apports du
backlog n° 01). Elle n'est pas réécrite ici : ce fichier note seulement ce qui a été retenu en codant.

- Slug `taches`, préfixe `TCH`, clés de stockage `qme-tch-code|cache|demo`, prix 19 €, permalien Gumroad
  `gestionnaire-taches`.
- Code source interne cité dans la fiche : non disponible ; tout a été écrit depuis la fiche.

## Fichiers

- `templates/taches/` : `index.html`, `app.css`, `donnees.js` (base intégrée), `regles.js` (règles
  pures, `window.TCH`), `app.js` (état, synchro, vues), `sw.js`, `manifest.webmanifest`, icônes.
- `outils/templates/taches.test.mjs` : tests des règles (`node --test`).

## Écrans (5 onglets)

1. **Aujourd'hui** : focus du jour (tâches dont `focus` = aujourd'hui), progression, temps prévu face au
   temps disponible (réglage, 6 h par défaut), « Aussi prévu » (échéances du jour et retards hors focus),
   carte de rituel : rituel du matin tant qu'il n'est pas fait, puis clôture du soir, puis « journée
   close ».
2. **Boîte** : saisie rapide en ligne avec aperçu de ce qui est reconnu, liste à trier, triage élément par
   élément (4 cases Eisenhower, projet, échéance, heure, durée, criticité, focus ; « Fait (moins de
   2 min) », « Plus tard », « Archiver »).
3. **Tâches** : Liste (tranches : en retard, aujourd'hui, demain, cette semaine, la semaine prochaine,
   plus tard, sans date), Kanban par statut (glisser-déposer + boutons ◀ ▶ pour le tactile et le
   clavier), Matrice d'Eisenhower, Archive (restaurer, supprimer définitivement). Recherche sans accents
   et filtres (projet, criticité, triage, type, terminées).
4. **Semaine** : 7 colonnes (empilées sur téléphone), charge par jour face au temps disponible, jours
   fériés signalés, retards affichés aujourd'hui, navigation semaine par semaine.
5. **Projets** : cartes par dossier (en cours, en retard, faites, avancement, 4 prochaines tâches),
   projets archivés, création depuis un modèle.

Saisie rapide accessible partout (bouton « + » et touche N).

## Mécanique

- **Boîte de réception** : toute saisie rapide y va (`inbox: true`), sauf case « Ranger directement ».
  Le projet tapé (#Nom) est créé s'il n'existe pas.
- **Triage** : urgent / important stockés sur la tâche ; « urgent » présélectionné si l'échéance est dans
  2 jours ou moins, « important » si la criticité est haute ou critique. La criticité reste à part.
- **Priorité** (tri, suggestions) : score = criticité + quadrant + proximité de l'échéance (retards en
  tête). Suggestions du matin : tâches actives triées, non bloquées, en retard / dues aujourd'hui /
  quadrant « Faire » / criticité haute ou critique.
- **Statuts** : jeux Simple, Kanban, GTD (dernier statut = terminé). Personnalisables dans les réglages
  (un par ligne) ; les identifiants sont gardés quand le nom ou la place ne change pas.
- **Dépendances** : « à faire après… » ; une tâche est « bloquée » tant qu'une tâche prérequise est
  active ; les boucles sont refusées (`creeBoucle`).
- **Récurrence** : une tâche faite reste dans l'historique, une nouvelle occurrence est créée (sous-tâches
  décochées). Types : tous les n jours (option « à partir du jour où c'est fait »), chaque jour ouvré,
  toutes les n semaines sur des jours choisis, tous les n mois (même date ramenée au dernier jour du mois
  si besoin, dernier jour, k-ième ou dernier jour ouvré, k-ième ou dernier lundi…), tous les n ans
  (29 février → 28). Ajustement facultatif au jour ouvré précédent ou suivant ; la date nominale est
  retrouvée pour ne jamais sauter ni doubler un mois. Une série en retard ne recrée pas les occurrences
  manquées. Date de fin facultative.
- **Jours ouvrés** : lundi à vendredi hors fêtes légales (option), Alsace-Moselle en option. Pâques
  calculé (algorithme de Meeus/Jones/Butcher), Ascension = Pâques + 39, Pentecôte = Pâques + 50.
- **Archive** : « supprimer » archive (restaurable) ; la clôture du soir propose d'archiver les tâches
  terminées. Suppression définitive seulement depuis l'archive.
- **Rituels** : le journal (`journal[date] = { matin, soir: {faites, focus, minutes}, note }`) garde les
  rituels faits ; série de journées closes affichée.

## Base intégrée (`donnees.js`)

- 3 jeux de statuts et de types ; 4 criticités ; 8 couleurs.
- 5 modèles de projets : démarches administratives de l'année (10 tâches, **sans dates** : l'utilisateur
  vérifie chaque échéance sur le site officiel), rentrée scolaire (9, dates relatives au jour de la
  rentrée), freelance (8, routines : prospection le lundi, factures le dernier jour ouvré, relances le
  vendredi…), maison au fil des saisons (8, annuelles), semestre étudiant (7).
- Aucune donnée réglementaire chiffrée hormis la liste des fêtes légales.

## Sources

- Fêtes légales : Code du travail, art. L3133-1 ; liste et cas Alsace-Moselle sur service-public.gouv.fr,
  fiche F2405 « Jours fériés et ponts dans le secteur privé » (page « vérifiée le 1er janvier 2026 »,
  consultée le 12/11/2026). Source et date affichées dans les réglages de l'application. Jours fériés des
  DROM non gérés (signalé dans l'application).
- Pas de base externe sous licence.

## Risques et limites

- Aucune marque de risque (argent, santé, fiscal, RGPD particulier) : données personnelles ordinaires,
  stockées comme les autres templates.
- Saisie rapide : ambiguïtés assumées et documentées dans l'aide (« 2h » seul = durée, « à 2h » = heure,
  au-delà de 5 h mettre « ~ »). Un mot de date dans un titre (« lundi ») est lu comme une date ; l'aperçu
  le montre avant validation.
- Pas de pièces jointes (stockage de fichiers non disponible), pas d'équipe, pas de connecteurs, pas de
  rappels par notification.
- Conflit 409 : la version du serveur remplace la version locale (comportement du socle), l'utilisateur
  refait sa dernière action.
