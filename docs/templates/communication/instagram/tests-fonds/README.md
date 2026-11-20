# Test des fonds et de la géométrie · Instagram

Ouvert le 20/11/2026 à la demande de Quentin. Non publié (`/docs/*` en 404).

## Problème

Les publications organiques plafonnent entre 25 et 51 vues (carrousels et posts), avec deux exceptions : les vidéos
de démonstration (125 et 106 vues). Toute la grille utilise le même fond papier et la même composition (formes en
coin, compteur « 1 / 5 »). Sur un fil, une publication ressemble donc à la précédente. **Question testée : changer de
fond et de géométrie, sans sortir de la charte, fait-il monter la portée organique ?**

## Constat de départ, corrigé

| Publication | Vues | Couverture | J'aime | Enreg. | Partages | Comm. | Abonnés gagnés | Remarque |
|---|---|---|---|---|---|---|---|---|
| Reel « Un tableur trouvé en ligne dépanne… » (13/11, 0:15, fond encre) | 1 024 | 876 | 7 | 0 | – | 0 | 1 | **sponsorisé** le 19/11 à 20:48 |

Le 20/11, une première analyse avait attribué ce score au fond noir et à l'accroche. C'est **faux** : les statistiques
du Reel incluent celles de la publicité (« Les statistiques incluent les données de votre reel et de toute
publicité »). Ce Reel ne dit rien sur le fond. Il dit seulement que la publicité achète de la portée, mais pas
d'intérêt : 7 j'aime et 0 enregistrement pour 876 personnes touchées.

**Règle du test : une publication sponsorisée est exclue de la comparaison.** Si une publication du test est
sponsorisée, on ne retient que ses chiffres organiques, quand Instagram les sépare. Sinon elle sort du test.

## Variantes

Même texte, même taille, même place du titre. Seuls le fond et la géométrie changent. Toutes les variantes restent
dans la charte (`../README.md`, section Charte) : cinq couleurs, Outfit 800, angles droits, formes Bauhaus, pas de
dégradé, texte blanc sur rouge et bleu, texte encre sur jaune.

| Code | Fond | Géométrie |
|---|---|---|
| A | papier | formes en coin : quart de cercle rouge et carré jaune (**référence**, le style actuel) |
| B | encre | grand cercle jaune qui sort du cadre, petit carré rouge |
| C | bleu | frise de quatre modules en pied : carré rouge, quart de cercle jaune, cercle papier, triangle encre |
| D | jaune | demi-cercle encre sur toute la largeur, carré rouge ; surlignage encre |
| E | rouge | grand triangle encre en diagonale, cercle bleu |
| F | deux plans | bandeau bleu en haut, papier en bas, cercle rouge à cheval sur la limite |

Source : `variantes.html` · rendu : `node docs/templates/communication/instagram/rendre.mjs tests-fonds/variantes.html`,
puis déplacer `png/test-fond-*.png` dans `tests-fonds/png/` · comparaison : `png/planche.png`.

![Planche des six variantes](png/planche.png)

## Protocole

1. **Une seule variable** : le fond et la géométrie de la couverture. On garde le format (carrousel de 5 vues), l'heure
   (19:00, publication principale, `../../HEURES.md`), le type de sujet et la légende type.
2. **Rotation** sur les 12 prochains carrousels : B, C, D, E, F, A, puis F, E, D, C, B, A. Chaque variante passe deux
   fois, une fois dans chaque moitié, pour limiter l'effet du jour et de la croissance du compte.
3. **Relevé à J+7** dans Statistiques : vues, couverture, **part de non-abonnés**, enregistrements, partages, visites du
   profil, abonnés gagnés. Noter aussi le nombre d'abonnés du compte le jour de la publication.
4. **Lecture** : la moyenne des deux passages d'une variante est comparée à celle de A. Avec deux points par variante,
   seul un écart supérieur à × 2, de même sens sur les deux passages, compte comme un signal. En dessous, la conclusion
   est « pas de différence mesurable ».
5. Si une variante l'emporte, on l'adopte en alternance avec A (pas en remplacement : la grille doit rester variée),
   puis on teste les Reels au format 1080 × 1920 avec le même code.

## Suivi

| # | Date | Publication | Variante | Sponsorisée | Abonnés du compte | Vues | Couverture | % non-abonnés | Enreg. | Partages | Visites profil | Abonnés gagnés |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | moyenne avant test | carrousels de la grille au 20/11 | A | non | – | 25 à 51 | – | – | – | – | – | – |
| 1 | | | B | | | | | | | | | |
| 2 | | | C | | | | | | | | | |
| 3 | | | D | | | | | | | | | |
| 4 | | | E | | | | | | | | | |
| 5 | | | F | | | | | | | | | |
| 6 | | | A | | | | | | | | | |
| 7 | | | F | | | | | | | | | |
| 8 | | | E | | | | | | | | | |
| 9 | | | D | | | | | | | | | |
| 10 | | | C | | | | | | | | | |
| 11 | | | B | | | | | | | | | |
| 12 | | | A | | | | | | | | | |

## Journal

- **20/11/2026** : ouverture du test. Six variantes rendues. La correction sur le Reel sponsorisé est consignée.
  L'affectation aux publications programmées reste à valider par Quentin : le planning Instagram (Sheet) n'est pas
  modifié.
