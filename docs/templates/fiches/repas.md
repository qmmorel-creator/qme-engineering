# T06 · Repas de la semaine et liste de courses

Slug `repas`, préfixe `RPS` (clés locales `qme-rps-*`, règles `window.RPS`), prix prévu 13 € (**à confirmer par
Quentin**), permalien Gumroad prévu `repas-liste-de-courses`, catégorie Gumroad prévue `food-and-cooking` (à
vérifier dans la liste Gumroad à la création), taille M, priorité P2.
Origine : liste initiale du 12/11/2026 (ligne T06 de `IDEES.md` : « Repas de la semaine et liste de courses
générée | 100 recettes avec ingrédients et quantités | Moteur de liste de courses partageable avec T04. Recettes :
source et droits à vérifier »). Fiche rédigée le 14/11/2026. Marques de risque : **allergènes** (étiquette
indicative seulement), **aucune donnée de santé**, aucune donnée datée (aucun prix intégré).

## Pour qui

Familles et particuliers qui font les courses une fois par semaine et se demandent chaque soir « on mange
quoi ? ». Ils planifient sur un papier, un tableur ou une note de téléphone, recopient la liste à la main,
oublient la moitié des ingrédients ou achètent deux fois ce qui est déjà au placard.

**Distinct de T04** (`templates/nutrition/`, Nutrition et dépense énergétique, en vente) : T04 compose des
journées types en grammes d'aliments de la base Ciqual pour suivre des calories, avec une liste de courses en
grammes. T06 n'est **pas** un outil de nutrition : aucun calcul de calories ni macronutriments, aucune donnée de
santé, aucun poids. Il organise les **repas du foyer** (midi et soir, nombre de convives par repas, restes,
cantine) à partir de **recettes**, et produit une **liste de courses de magasin** (rayons, unités d'achat,
placard, stock, articles libres, prix saisis).

## Promesse

Ce soir, on mange quoi ? C'est déjà prévu : les repas de la semaine en quelques touches, et la liste de courses
qui se calcule seule, rangée par rayon, sans ce que tu as déjà.

## Écrans (4 onglets + réglages)

1. **Semaine** : navigation de semaine en semaine ; tuiles (repas prévus sur le nombre de créneaux, repas de
   restes, articles à acheter et déjà à la maison, budget estimé avec les prix saisis) ; grille 7 jours × midi
   et soir (un seul repas si « le soir seulement »), aujourd'hui encadré. Chaque repas : **recette** (avec
   personnes et temps ; « +n pour les restes »), **restes de…** (un repas antérieur de la semaine),
   **dehors** (cantine, restaurant, invités ailleurs : rien à préparer) ou **note** (sans ingrédient).
   Fenêtre d'un repas : 3 suggestions de saison, recherche dans toutes les recettes, nombre de personnes.
   **Proposer des repas** : remplit les repas vides (midis, soirs) selon la saison, sans resservir une
   recette servie depuis moins de N jours, en privilégiant les plus anciennes ; au moins n repas végétariens et
   n avec du poisson, soirs de semaine en 30 minutes au plus, allergènes à éviter (indicatif). **Semaines
   types** : enregistrer la semaine, l'appliquer (cases vides seulement ou en remplaçant). Vider la semaine,
   imprimer.
2. **Courses** : ajout d'un article libre en une ligne (« 2 l lait », rayon automatique ou choisi, « chaque
   semaine ») ; bandeau d'avancement (articles cochés, budget estimé) ; rayons dans l'ordre du magasin, chaque
   article avec case à cocher en magasin, quantité d'achat, recettes concernées, stock partiel, prix estimé ;
   section **Déjà à la maison** (placard ou en stock) avec « À racheter » ou « Remettre ». Fenêtre d'un article :
   quantité de la semaine et repas concernés, déjà à la maison (non, une partie avec quantité et unité, tout),
   toujours au placard, rayon, prix (prix pour une quantité, facultatif), retrait d'un article libre. Copier la
   liste (texte rayon par rayon, sans les articles cochés), imprimer, export CSV (Réglages).
3. **Recettes** : filtres (végétarien, poisson, rapide, à l'avance, enfants, économique, de saison),
   catégorie, recherche par nom ou ingrédient ; cartes avec temps, saisons, étiquettes, dernière fois au menu.
   Fiche : ingrédients recalculés pour 1 à 40 personnes, étapes, allergènes indicatifs avec avertissement,
   « Prévoir un repas », modifier (une recette de base modifiée la remplace, « Rétablir l'originale »),
   dupliquer, masquer (base) ou supprimer (perso). Édition : ingrédients en lignes libres (« 400 g spaghetti »,
   « 2 gousses ail »), étapes, saisons, étiquettes, note ; ingrédients hors base signalés (rayon « Autres »,
   modifiable depuis la liste).
4. **Historique** : tuiles des 4 dernières semaines (repas cuisinés, recettes différentes, repas de restes,
   repas végétariens) ; les plus servies (12 semaines) ; « à refaire » (servies il y a plus de 6 semaines) ;
   semaines passées (ouvre la semaine).
5. **Réglages** : foyer, personnes par défaut, repas à prévoir (midi, soir), jours sans répétition, ordre des
   rayons, placard (un article par ligne), articles de chaque semaine, prix notés, recettes masquées à
   rétablir, export CSV de la liste, sauvegarde JSON, compte, « Sur téléphone », données personnelles, à propos.

Premier lancement en 2 étapes : foyer, personnes à table, midi et soir ou soir seulement, durée sans
répétition, 4 conseils ; puis le placard (26 articles courants cochés, à décocher).

## Base intégrée (`templates/repas/donnees.js`)

- **100 recettes familiales de base rédigées par QME** (14/11/2026) : 20 pâtes, riz et céréales, 23 viandes,
  13 volailles, 10 poissons, 12 œufs, tartes et quiches, 9 légumes et plats végétariens, 6 soupes, 7 salades
  composées. Chacune : nom générique de plat du quotidien, personnes (4 ou 6), préparation et cuisson,
  saisons, étiquettes (à l'avance, enfants, économique), ingrédients avec quantité et unité, 2 à 4 étapes
  courtes écrites pour l'outil. **Aucune copie d'un site, d'un livre ou d'une marque** ; les noms de plats
  classiques (bolognaise, blanquette, hachis parmentier) sont des dénominations génériques. Mention dans
  l'application (avertissement de chaque vue, fiche de recette, À propos), la page catalogue et la fiche Gumroad.
- **Dictionnaire de 145 ingrédients génériques** : rayon (13 rayons), allergènes indicatifs (14 allergènes à
  déclaration obligatoire, règlement UE n° 1169/2011, annexe II), nature (viande, poisson) pour déduire les
  étiquettes « végétarien » et « poisson ». Une seule dimension d'unité par ingrédient dans la base (test).
- 26 articles de placard proposés, 13 rayons, 9 catégories, 4 conseils. **Aucun prix** (ils se périment).

## Calculs (règles pures, `templates/repas/regles.js`, `window.RPS`)

- Semaine identifiée par son lundi ; saison météorologique (mars-mai, juin-août, septembre-novembre,
  décembre-février).
- **Unités** : masse (g, kg), volume (ml, cl, l), cuillères (1 c. à s. = 3 c. à c.), unités comptées
  (pièce, gousse, botte, tranche, pincée, brin, feuille, cube, sachet, boîte, paquet). Lecture d'une ligne
  libre (« 1/2 botte persil », « 2 cuillères à soupe d'huile », « ½ citron ») et réécriture.
- **Portions** : convives du repas + convives des repas « restes de… » qui le désignent.
- **Moteur de liste de courses** (fonctions `fusionner`, `appliquerStock`, `regrouper`, indépendantes des
  recettes : réutilisables par T04 ou un autre template) : besoins mis à l'échelle → fusion par nom (sans
  accents ni casse) et addition par dimension (dimensions différentes côte à côte : « 300 g + 2 ») → stock
  (tout, une partie dans la même dimension, placard sauf « à racheter ») → rayons dans l'ordre choisi.
  Arrondi d'achat toujours vers le haut (5 g, 10 g, 50 g selon la quantité ; unités entières ; demi-cuillère).
- **Budget** : uniquement avec les prix saisis (« 2,40 € pour 1 kg »), convertis dans la dimension du besoin ;
  articles sans prix comptés à part.
- **Historique** : dates de chaque recette, dernière fois avant une date, fréquences.
- **Suggestions** : filtres (saison, végétarien, poisson, temps maximum, étiquettes, allergènes exclus,
  exclusions, jours sans répétition) ; score = ancienneté (plafonnée à 120 jours, jamais servie = 150) + part
  de hasard (générateur reproductible) ; **remplissage** des cases vides avec contraintes relâchées dans
  l'ordre (temps, saison, répétitions, régime) plutôt que de laisser vide, sans doublon dans la semaine.
- Semaines types (copie et application, restes orphelins changés en note), vidage d'une case, texte à copier,
  CSV (point-virgule, BOM UTF-8), normalisation tolérante (60 semaines gardées au plus).
- 18 tests `node --test` dans `outils/templates/repas.test.mjs` (base, unités, lecture, portions, liste,
  stock, budget, recettes, historique, tirage, semaines types, normalisation).

## Sources

- Recettes : rédigées par QME pour ce template (aucune source externe à créditer). **À relire par Quentin** :
  quantités et temps sont des ordres de grandeur de cuisine familiale, non testés en cuisine un par un.
- Allergènes : liste des 14 allergènes du règlement (UE) n° 1169/2011, annexe II (connaissance générale, non
  revérifiée sur EUR-Lex le 14/11/2026, **à vérifier**). L'attribution aux ingrédients génériques est une
  approximation (un bouillon, une moutarde, un pain de mie varient selon la marque) : étiquette indicative,
  jamais une garantie, avertissement dans l'application, la page et la fiche Gumroad.

## Risques

- **Allergies** : une personne allergique ne doit pas se fier au filtre ; il est présenté comme indicatif
  partout et la fiche de chaque recette rappelle de lire les étiquettes.
- **Nutrition** : aucune promesse de santé, d'équilibre ou de poids ; « Ce n'est pas un outil de nutrition »
  dans l'application et la FAQ. Les étiquettes « végétarien » et « poisson » sont des faits sur les
  ingrédients, pas des conseils.
- **Prix** : aucun prix intégré ; le budget n'est qu'une estimation des prix saisis.
- **Marques** : aucune enseigne, aucun drive, aucun lien de commande ; ingrédients génériques uniquement.
- Concurrence : applications de menus par abonnement et listes de courses gratuites ; se distinguer par
  l'achat unique, la base de 100 recettes modifiables, les restes et le placard déduits, tous appareils.

## Données personnelles (RGPD)

Le planning ne contient que ce que l'utilisateur saisit (repas, recettes, articles, prix), hébergé en ligne
avec sa clé ; aucune donnée de santé ni de tiers n'est demandée (pas de prénoms des convives, seulement un
nombre de personnes). Export JSON et restauration dans les Réglages.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/conges/` (connexion avec `produit: 'RPS'`, synchronisation et 409, démo `?demo`
  non mémorisée, modales, toast Annuler, export / import JSON, service worker, fenêtre « Comme une
  application » avec la clé `qme-rps-ecran-accueil`, bandeau « Bientôt en vente » vers `/catalogue/repas/`).
- État : `semaines` (par lundi : cases, stock, coches, articles libres), `recettes` (perso et versions
  modifiées des recettes de base, même identifiant), `masquees`, `semainesTypes`, `placard`, `habituels`,
  `prix`, `rayonsPerso`. Les recettes de base restent dans `donnees.js` (non copiées dans les données).
- Démo : famille fictive de 4 personnes ; dix semaines d'historique tirées avec les vraies règles (graine
  fixe) ; semaine en cours avec cantine les midis d'école, restes, sortie, note, recette modifiée
  (carbonara aux champignons), recette perso avec un ingrédient hors base rangé par l'utilisateur ; une
  recette de base masquée ; stock partiel, lait en stock, huile « à racheter », 3 articles cochés, articles
  libres et de chaque semaine, 19 prix fictifs ; semaine suivante entamée ; tout relatif à la date du jour.
- Pas de graphique (listes et tuiles) : le skill dataviz n'a pas été nécessaire.
