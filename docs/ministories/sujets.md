# Mini-stories QME : sujets et scénarios à valider

Circuit : **sujet** (classé par Quentin) → **scénario** écrit par l'agent quotidien (`scenarios/NN-<slug>.md`, à valider)
→ **vidéo** produite seulement après validation du scénario. L'agent garde toujours **7 scénarios d'avance** (statuts
`scénario à valider` + `scénario validé`). Quentin valide ou corrige dans une conversation Claude ; la session qui
reçoit sa réponse met à jour ce fichier sur la branche `claude/mini-stories-qme-caro-b07mx2`.

Statuts : `proposé` → `retenu` (classé) → `scénario à valider` → `scénario validé` → `produit` (ou `écarté`).
Rang : ordre de passage donné par Quentin (vide tant qu'il n'a pas classé ; l'agent suit alors l'ordre des numéros).
Chaque bénéfice cité vient de la fiche `catalogue/<produit>/` ; les montants de l'histoire sont fictifs.

| N° | Rang | Statut | Titre | Produit | Mini pitch |
|---|---|---|---|---|---|
| 0 | - | produit | Le salaire a disparu ! | Mon Budget | Pilote du 27/11/2026. |
| 1 | | proposé | L'abonnement fantôme | Suivi des abonnements | Carreau découvre un prélèvement mensuel pour une appli de méditation ouverte une fois en 2024. Il fouille : il y en a d'autres, qui sortent des placards comme des fantômes. Chute : l'alerte de fin d'essai arrive *avant* le prélèvement. |
| 2 | | proposé | Qui a payé les croissants ? | Gestion Dépenses Communes | Coloc : chacun jure avoir « tout payé ce mois-ci ». Le tribunal des colocs s'improvise dans la cuisine, avec les tickets en pièces à conviction. Le template rend le verdict : qui doit quoi, au centime. |
| 3 | | proposé | Le carton n° 47 | Déménagement | Le soir de l'arrivée, impossible de trouver la bouilloire. Carreau ouvre 46 cartons, la panique monte. Avec les cartons numérotés, une recherche : « bouilloire → carton 47 ». Le dernier, bien sûr. |
| 4 | | proposé | Le yaourt de 2019 | Garde-manger et dates de péremption | Fouille archéologique au fond du frigo : un yaourt sort avec une date de l'ère précédente. DLC et DDM distinguées : ce qui se jette, ce qui se mange encore, ce qui passe en premier ce soir. |
| 5 | | proposé | « Garde tout, on sait jamais » | Papiers du foyer | Une montagne de papiers menace de s'effondrer sur Carreau. Le template donne la durée de conservation de chaque papier : la moitié part au recyclage, et l'avis d'imposition reste à sa place. |
| 6 | | proposé | Le marathon de la veille | Plan d'entraînement course à pied | Carreau s'inscrit au 10 km… dans trois jours, sans s'être entraîné. Retour en arrière : allures calculées depuis son chrono et plan de 8 semaines, séances cochées une à une. Payoff : la ligne d'arrivée, frais. |
| 7 | | proposé | Révisions : la nuit blanche | Planning de révision | Veille d'examen, 14 chapitres, une seule nuit. Carreau sombre sous les fiches. Version 2 : chaque chapitre revient au bon moment (J+1, J+3, J+7) et la veille devient… une soirée normale. |
| 8 | | proposé | La chaudière qui toussait | Entretien de la maison | En plein janvier, la chaudière tousse, crache et s'éteint. Carreau grelotte. Le calendrier d'entretien se calcule seul à partir des équipements cochés : la révision tombait en octobre. |
| 9 | | proposé | Le café à 12 heures de travail | Temps de vie | Carreau commande son café à emporter quotidien. Le template convertit l'habitude en heures de travail sur un an : le gobelet grossit jusqu'à remplir l'écran. Pas de morale, juste le chiffre et le choix. |
| 10 | | proposé | Le carnet de la voiture | Carnet de voiture | Le voyant moteur s'allume sur l'autoroute. « C'était quand, la dernière vidange ? » Personne ne sait. Entretiens à la date ou au kilométrage, contrôle technique, coût au kilomètre : la voiture n'a plus de secrets. |
| 11 | | proposé | Le fonds d'urgence | Objectif d'épargne et fonds d'urgence | La machine à laver rend l'âme dans un nuage de mousse. Carreau vide sa tirelire… qui contient un bouton. Objectifs chiffrés, versements suivis, date d'arrivée : la prochaine panne trouve la tirelire pleine. |
| 12 | | proposé | La boule de neige | Remboursement de dettes | Trois crédits poursuivent Carreau en dévalant une pente. Il retourne la situation : méthode boule de neige, une dette après l'autre, avec la date de fin et les intérêts évités. La boule roule dans l'autre sens. |
| 13 | | proposé | Liste de courses : le retour | Repas de la semaine et liste de courses | Au supermarché, Carreau traverse cinq fois le magasin pour un oubli à chaque rayon. Avec la liste calculée et rangée par rayon, placards déduits : un seul passage, chariot plein, aucun doublon. |
| 14 | | proposé | Le tableur des vacances | Planificateur de voyage | Retour de vacances entre amis : « Je t'ai avancé le parking, tu m'as payé une glace, donc… ». Les calculs s'emmêlent en nœud. Étapes, budget prévu et réel, qui doit quoi au retour : le nœud se défait. |
| 15 | | proposé | Les 3 versions finales | Planning de mémoire ou de thèse | memoire_final_v3_VRAI_FINAL.docx. Carreau a vu ça, il en tremble encore. Plan chapitre par chapitre, rétroplanning depuis la date de rendu, mots par jour restants : une seule version, rendue à l'heure. |
| 16 | | proposé | La moyenne au centième | Notes et moyennes | « Il me faut combien au partiel pour valider ? » Carreau tente le calcul à la main, les coefficients s'envolent. Le template répond : la note exacte à viser, selon les règles du diplôme. |
| 17 | | proposé | Le dégât des eaux | Dossier sinistre habitation | Une fuite du voisin du dessus, Carreau sous un parapluie dans son salon. Puis vient le pire : la déclaration. Déclaration guidée, délais, inventaire chiffré, preuves classées : le dossier part complet. |
| 18 | | proposé | La résolution du 2 janvier | Suivi d'habitudes et routines | 1er janvier : « Cette année, sport tous les jours. » 2 janvier : canapé. Cochage en quelques secondes, séries et taux de réussite : la série tient, jour après jour, et Carreau aussi. |
| 19 | | proposé | Vivre sans voiture ? | Vivre sans voiture | Carreau tient ses clés comme un trésor. Le template pose le coût complet de la voiture face aux solutions de remplacement, et une parade pour chaque urgence. Chute : il hésite… mais il a enfin le vrai chiffre. |
| 20 | | proposé | La semaine qui déborde | Planner horaire | Lundi matin, la semaine de Carreau est un tas de post-it qui déborde de l'écran. Blocs de 30 minutes au glisser-déposer, puis vendredi l'écart entre prévu et réalisé. Chute : il reste un bloc libre. |
