# T08 · Suivi d'habitudes et routines

Slug `habitudes`, préfixe `HBT` (clés locales `qme-hbt-*`), prix prévu 12 €, permalien Gumroad prévu
`suivi-habitudes`, taille S, priorité P2. Origine : liste initiale (12/11/2026) et backlog de Quentin
n° 46 « Carnet de routines », fusionnés ; demande de Quentin du 13/11/2026 (thèmes colorés, habitudes à
cocher ou chiffrées, thème « une seule par jour », jours non applicables, grille mensuelle). Marque
**médical** si des habitudes de santé (traitements) sont saisies : rappel dans l'application, la page
catalogue et la fiche Gumroad. Aucune habitude, aucun écran ni aucune donnée d'un outil personnel repris :
la mécanique seule a servi d'inspiration, le contenu est original.

## Pour qui

Particuliers qui veulent **tenir quelques habitudes** (boire assez d'eau, bouger, dormir, lire, ranger)
sans y passer de temps, sur leur téléphone d'abord. Personnes qui reprennent une routine (matin, soir),
télétravailleurs qui veulent suivre leur lieu de travail, personnes qui veulent un pense-bête pour un
traitement (sans alerte ni conseil médical).

Distinct du gestionnaire de tâches (T03) et du planner horaire (T30) : ici rien n'a d'heure ni
d'échéance, on coche ou on compte ce qui revient chaque jour, et on regarde la régularité.

## Promesse

Un geste par jour, une série qui tient : tes habitudes du jour cochées en quelques secondes, et la
grille du mois pour voir tes séries et ton taux de réussite.

## Écrans (4 onglets + réglages)

1. **Aujourd'hui** (écran principal, pensé pour le téléphone) : « x sur y » et jauge ; habitudes
   prévues ce jour, rangées par thème coloré ; une **case** se coche d'une touche (fait → pas fait →
   non applicable → rien) ; une **habitude chiffrée** a des boutons − et + (au pas réglé) et une saisie
   directe ; un **thème « une seule par jour »** affiche des puces exclusives (bureau / télétravail /
   déplacement / non applicable). Bouton ··· : fait, pas fait, valeur, non applicable, effacer.
   Navigation vers les jours passés (jamais le futur). Habitudes non prévues ce jour dans un repli
   (cochées « en plus », sans effet sur les taux). Rappel médical si une habitude de santé existe.
2. **Mois** : grille date × habitude (une ligne par habitude, regroupées par thème ; une colonne par
   jour, week-end et aujourd'hui teintés), défilement horizontal interne centré sur aujourd'hui, nom
   collant à gauche. Cellule : ✓ en couleur du thème (réussi), chiffre (habitude chiffrée, plein si
   l'objectif est atteint, teinté sinon), ✕ (manqué), – (non applicable), hachures (pas prévu), ● (choix
   du jour), pointillés (aujourd'hui à saisir). Toucher une case la remplit. Taux du mois par ligne,
   légende, impression, export CSV.
3. **Bilan** (30 derniers jours) : tuiles (taux de réussite, meilleure série en cours, journées
   parfaites, habitudes suivies) ; taux de réussite par semaine sur 8 semaines (barres, infobulle) ;
   tableau par habitude (série en cours, record, barre et taux, jours réussis / comptés, non
   applicables) ; répartition des thèmes « une seule par jour » ; « Copier le bilan » (texte).
4. **Habitudes** : cartes par thème (nom, couleur, fonctionnement, habitudes) ; créer, modifier,
   archiver (l'historique reste), reprendre, supprimer ; créer un thème (8 couleurs fixes) ; ajouter
   depuis la base de 50 habitudes, avec raccourcis par routine et sources des réglages types.
5. **Réglages** (bouton) : prénom, copie JSON (télécharger, restaurer), journal CSV, compte, « Sur
   téléphone > Voir comment faire », mentions (aucun cochage automatique, sources, rappel médical).

Premier lancement : prénom, routines types à cocher (préremplissent l'étape 2), puis les 50 habitudes
par thème à cocher.

## Base intégrée (`templates/habitudes/donnees.js`)

- **8 thèmes** à couleur fixe : Sommeil, Sport et mouvement, Travail et apprentissage, Alimentation et
  hydratation, Esprit et relations, Lieu de travail (« une seule par jour »), Maison et argent, Soins et
  traitements. Palette validée par le script du skill dataviz (bande de luminosité, chroma, séparation
  daltonisme ≥ 10, contraste ; le moutarde, sous 3:1, est toujours accompagné d'un texte ou d'un symbole).
- **50 habitudes types** avec réglages types : eau (au moins 8 verres, pas 1), heures de sommeil (7 à
  9 h, pas 0,5), pas (au moins 8 000, pas 1 000), marche (30 min), cafés (au plus 3 tasses), alcool
  (aucun), séance de sport (lundi, mercredi, vendredi), lecture (10 pages), méditation (10 min)…, et
  jours prévus types (semaine, week-end, certains jours).
- **6 routines types** : rituel du matin, routine du soir, bouger plus, semaine en télétravail, bien
  manger, esprit serein.
- **Unités** proposées : fois, min, h, verres, pages, pas, km, portions, tasses, plages, €.

Sources des réglages types (affichées dans la fenêtre « Base de 50 habitudes », relevées en novembre
2026, **à vérifier**) : Programme national nutrition santé (site mangerbouger.fr) pour l'eau, les
fruits et légumes et 30 minutes d'activité par jour ; Organisation mondiale de la santé (150 à 300 min
d'activité par semaine) ; Santé publique France (repères alcool) ; fourchette de sommeil couramment
citée (7 à 9 h) ; 8 000 pas sans valeur officielle (dit comme tel). Aucune n'est figée : tout se modifie.

## Règles de calcul (`templates/habitudes/regles.js`, testées)

- Journal : `journal[date][habitude] = true | false | nombre | 'na'` ; thème « une seule par jour » :
  `journal[date]['@thème'] = habitude choisie | 'na'` (un choix remplace l'autre).
- **Réussi** : case cochée ; chiffre ≥ minimum (si fixé) et ≤ maximum (si fixé).
- **Statut d'un jour** : pas prévu (jour non coché pour l'habitude, avant sa création ou après son
  archivage), non applicable, réussi, partiel (chiffre sous l'objectif), manqué (« pas fait », ou rien de
  saisi un jour passé), en attente (aujourd'hui, rien de saisi), futur.
- **Série en cours** : jours réussis consécutifs en remontant depuis aujourd'hui ; les jours non prévus
  et non applicables sont sautés (ni comptés, ni cassants) ; aujourd'hui vide ne casse pas la série.
  **Record** : plus longue série depuis la création.
- **Taux de réussite** : réussis ÷ (réussis + partiels + manqués) ; non applicables et non prévus exclus.
- **Journée parfaite** : toutes les habitudes prévues (hors non applicables) réussies.
- Thème « une seule par jour » : pas de série ni de taux, une répartition (jours par choix).
- Export CSV : `date;theme;habitude;valeur;unite;statut`, séparateur point-virgule, BOM UTF-8.

## Démo

Personne fictive (Léa), 9 semaines d'historique simulées avec les vraies règles et relatives à
aujourd'hui : séries longues (méditation) et cassées (lecture hier), semaine de congés en non
applicable (sport, pas, tâche importante, lieu de travail), valeurs partielles, deux journées
parfaites, lieu de travail réparti, une habitude archivée, une habitude ajoutée plus tard, un traitement
(rappel médical visible), journée du jour à moitié saisie.

## Risques et limites

- **Médical** : habitudes de santé repérées (base, ou nom contenant médicament, traitement, comprimé…) :
  rappel « outil d'aide au suivi, ne remplace pas l'avis d'un médecin ou d'un pharmacien » dans
  Aujourd'hui, Habitudes, la saisie et la création. Aucune alerte, aucun rappel horaire, aucune dose.
- **Données de santé** hébergées en ligne (Netlify Blobs, Francfort) avec la clé de l'acheteur : régime
  RGPD à confirmer avant la mise en vente (comme T04).
- Aucun cochage automatique (montre, application de sport) ni notification : choix assumé (règle
  « aucune automatisation »), dit dans la FAQ et les réglages.
- Repères chiffrés : sources citées et « à vérifier », mise à jour annuelle de la date de relevé.
