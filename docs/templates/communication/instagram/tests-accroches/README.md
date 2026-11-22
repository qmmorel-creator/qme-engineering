# Test des accroches des Reels · EN PAUSE

Ouvert le 20/11/2026 à la demande de Quentin, mis en pause le même jour (priorité à la stratégie
`docs/templates/communication/strategie-instagram-2026-11.md`). Rien n'a été envoyé dans Drive ni modifié dans le planning.

## Constat qui l'a motivé

Les 3 premières secondes des 20 Reels en motion design programmés jusqu'à fin décembre ont été rendues par le moteur
officiel (`rendrePage`, brouillon muet) : à 0,5 s, la moitié n'affiche pas encore leur accroche lisible (IG-56 et IG-57
sont vides, IG-44, IG-46, IG-49, IG-53 sont incomplets), alors que le skill `reel-du-soir` exige une accroche lisible dès
la première seconde. Les accroches sont surtout des questions ou des descriptions ; une seule (IG-50, « Le tableur que
personne n'ose toucher ») reprend la forme du Reel du 13/11 (697 vues organiques).

## Protocole prévu

Trois groupes de 5 Reels (19:00), alternés par date :

| Groupe | Traitement | Reels |
|---|---|---|
| A | inchangé | IG-41 (24/11), IG-131, IG-132, IG-53, IG-57 |
| B | mêmes mots, première phrase complète dès la première image (`--debut`) | IG-44 (0,9 s), IG-50 (1,8 s), IG-55 (0,8 s), IG-47 (0,8 s), IG-46 (0,9 s) |
| C | accroche réécrite « … jusqu'au jour où … », même règle de départ | IG-45, IG-52, IG-56, IG-49, IG-58 (0,8 à 1 s) |

Accroches C : « Dix jours avant les partiels, on relit tout dans l'ordre… jusqu'au jour où le dernier chapitre n'a jamais
été ouvert. » · « Votre agenda est plein de réunions… jusqu'au jour où il ne reste aucun créneau pour travailler. » ·
« Une liste de tâches dépanne… jusqu'au jour où elle fait 80 lignes. » · « Les cadeaux à deux, on verra bien… jusqu'au
jour où il faut faire les comptes. » · « Votre plus gros client fait le plus de chiffre… jusqu'au jour où vous comptez ce
qu'il vous coûte. »

## Reprise

`git apply docs/templates/communication/instagram/tests-accroches/en-pause.patch` (option `debut` de
`docs/videos/rendu.mjs` et accroches C), puis rendre chaque Reel sous son nom Drive
(`node docs/videos/rendu.mjs <page> <durée d'origine − départ> --debut <ms> --sortie png/<nom Drive>.mp4`), vérifier
`ffprobe`, déposer, renommer l'ancien `-ANCIEN`, mettre à jour les colonnes P, J (groupe C) et M du planning.
Réserve : la musique est choisie par nom et durée ; une durée raccourcie peut changer de morceau.
