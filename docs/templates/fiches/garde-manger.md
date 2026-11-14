# T09 · Garde-manger et dates de péremption

Slug `garde-manger`, préfixe `GRD` (clés locales `qme-grd-*`, règles `window.GRD`), prix prévu 12 € (**à confirmer
par Quentin**, minimum fixé le 13/11/2026), permalien Gumroad prévu `garde-manger-dates-peremption`, catégorie
Gumroad `food-and-cooking` (à vérifier), taille S, priorité P3. Catalogue : `data-pour="perso"`, thème
« Organisation et études » (`organisation-et-etudes`, `--c:var(--encre)`), comme repas, entretien et voiture.
Origine : liste initiale du 12/11/2026 ; remarque d'`IDEES.md` : « Durées : source à vérifier ». Fiche rédigée le
14/11/2026. Aucune marque, aucun scan de code-barres, aucune base produit ni API, aucune automatisation.

## Pour qui

**Familles** et foyers qui font des courses pour plusieurs personnes, congèlent, et retrouvent trop tard les
produits au fond du réfrigérateur. Aujourd'hui : rien, ou une liste papier sur le frigo. Distinct du template
**repas** (T06, planning des repas et liste de courses calculée par recette) : ici l'inventaire réel de la maison,
ses dates, ce qui est consommé ou jeté. Distinct de **stocks** (T62, inventaire professionnel au coût moyen).

## Promesse

Rien ne se perd au fond du frigo : tout ce que tu as, rangé par lieu avec sa date, la DLC et la DDM distinguées, et
chaque jour la liste de ce qu'il faut manger d'abord.

## Écrans (5 onglets + réglages)

1. **À consommer** : rappel de sécurité (toujours visible) ; tuiles « Ne pas consommer », « Aujourd'hui », « Sous
   3 jours » (+ nombre cette semaine), « DDM dépassée » ; groupes « Ne pas consommer » (bouton « Jeté »),
   « Aujourd'hui », « Sous 3 jours », « Cette semaine » (bouton « Fini »), « Date de qualité dépassée » ; nombre de
   produits sans échéance ; pastille rouge sur l'onglet (à jeter + aujourd'hui).
2. **Stock** : filtres par lieu avec compteurs, recherche (sans accents), produits par lieu triés par échéance,
   résumé « x à jeter · y sous 3 jours » ; chaque ligne : pastille de catégorie, quantité, catégorie, ouverture,
   message d'alerte, date retenue et son origine (DLC, DDM, après ouverture, depuis l'achat, décongelé, au
   congélateur ; « indicatif » si la durée vient de la catégorie), boutons « Fini » et « Sortie… ».
3. **Courses** : ajout d'un article (catégorie facultative), cases à cocher, « Retirer les cochés », « Copier la
   liste » (texte groupé par catégorie), suggestions « Épuisés récemment » (finis ces 30 jours, ni en stock ni sur
   la liste).
4. **Gaspillage** : période 30 jours, 3 mois, 12 mois, tout ; tuiles jetés, consommés, part jetée, valeur jetée
   (avec le nombre de produits jetés sans valeur) ; barres mensuelles empilées sur 6 mois (consommés, jetés, nombre
   écrit) avec tableau accessible ; barres par motif et par catégorie ; dernières sorties (× pour corriger).
5. **Rangement** : lieux (nom, type : réfrigérateur, congélateur, placard, autre ; suppression seulement vide) ;
   catégories (date habituelle, rangement habituel, durées « sans date, après achat », « après ouverture », « au
   congélateur », couleur) ; sources avec dates de publication et de consultation et extraits cités.
6. **Réglages** (modale) : nom du foyer ; exports CSV (stock, historique des sorties) ; sauvegarde JSON et
   restauration ; jauge de taille et « Retirer l'historique avant le … » ; compte ; « Sur téléphone » ; à propos.

Saisies (modales) : produit (nom, lieu, catégorie qui propose type de date et lieu, quantité et unité, type de date
en trois choix « À consommer jusqu'au · DLC », « De préférence avant · DDM », « Pas de date », date imprimée, date
d'achat ; ouverture : date et « à consommer sous x jours » ; congélateur : date de congélation et « à consommer
avant » ; décongélation ; valeur ; note) avec **aperçu de l'échéance et de l'alerte** ; actions rapides « Ouvert
aujourd'hui », « Mettre au congélateur », « Sortir pour décongeler » ; sortie (consommé ou jeté, quantité partielle,
motif, ajout aux courses si épuisé, valeur au prorata) ; lieu ; catégorie.

Premier lancement en 2 étapes : présentation, 4 conseils et rappel de sécurité ; puis nom du foyer (facultatif) et
choix des lieux (réfrigérateur, congélateur, placard cochés ; garde-manger, cave, second congélateur, corbeille à
fruits proposés).

## Base intégrée (`donnees.js`)

- 7 lieux proposés, 16 catégories (type de date habituel : DLC pour le frais, DDM pour l'épicerie, aucune pour
  fruits, restes et traiteur à la coupe), 8 couleurs fixes, 15 unités, 6 motifs de rejet.
- **Durées** : seules deux valeurs chiffrées, reprises de l'Anses : **3 jours** pour un produit traiteur ou un plat
  non préemballé sans date (compté depuis l'achat) et **3 jours** après décongélation. Toutes les autres (après
  ouverture, au congélateur, restes faits maison) sont **vides** et saisies par l'utilisateur, marquées « ta
  valeur » et « indicatif ». Raison : aucun tableau officiel de durées par aliment n'a été trouvé et vérifié dans
  cette session ; la remarque d'`IDEES.md` interdit d'en présenter un sans source.

## Calculs (`regles.js`, fonctions pures testées)

- **Échéance** d'un produit = la plus proche parmi : date de l'emballage (DLC ou DDM) ; ouverture + délai saisi (ou
  durée de la catégorie, indicative) ; achat + durée « sans date » de la catégorie si le produit n'a pas de date ;
  au congélateur : DDM de l'emballage et date fixée (ou congélation + durée de la catégorie) — **la DLC n'est plus
  suivie au congélateur** ; décongelé : décongélation + 3 jours (remplace tout le reste). À égalité, l'échéance de
  sécurité l'emporte.
- **Nature** : DLC, après ouverture, depuis l'achat, décongelé = **sécurité** ; DDM et date fixée au congélateur =
  **qualité**.
- **Niveaux** : dépassé et sécurité → « Ne pas consommer » ; dépassé et qualité → « Date de qualité dépassée » ;
  0 jour → aujourd'hui ; 1 à 3 → sous 3 jours ; 4 à 7 → cette semaine ; au-delà → plus tard ; sans échéance.
- **Sortie** : quantité bornée au stock, valeur répartie au prorata, produit retiré à zéro, motif « autre » par
  défaut pour un jeté, aucun motif pour un consommé.
- **Bilan** : nombre de sorties (une par sortie, quelle que soit la quantité), part jetée = jetés / (jetés +
  consommés), valeur jetée des seuls produits valorisés, par motif, par catégorie, série de 6 mois.
- **Courses** : pas de doublon (sans accents ni casse) parmi les articles non cochés ; suggestions = finis ces 30
  jours, ni en stock ni sur la liste.

## Sources

- Anses, « Date limite de consommation (DLC) et date de durabilité minimale (DDM) », article du 04/01/2021,
  https://www.anses.fr/fr/article/date-limite-consommation-dlc-date-durabilite-minimale-ddm, consulté le 14/11/2026 :
  définitions DLC / DDM, DLC qui ne vaut plus après ouverture, délai du fabricant, plats non préemballés sous 3
  jours, décongelés pas plus de trois jours sans recongeler, congeler dès l'achat, signes d'altération.
- Anses, « En cuisine, le meilleur ingrédient, c'est l'hygiène ! », article du 11/05/2026, consulté le 14/11/2026 :
  réfrigérateur entre 0 et +4 °C, deux heures au plus avant réfrigération (affiché dans les sources, non utilisé
  dans les calculs).
- Pages economie.gouv.fr (DGCCRF) sur DLC et DDM : **non consultées** (refus 403 depuis cette session) ; non citées.

## Risques

- **Sanitaire** : l'outil pourrait être pris pour un avis. Parades : rappel visible (« la date et l'aspect du produit
  priment ; DLC dépassée = ne pas consommer ») sur l'accueil, « À consommer » et « Rangement » ; avertissement en pied
  de chaque vue ; mention des personnes fragiles ; FAQ « Est-ce un avis sanitaire ? » sur la page catalogue.
- **Saisie** : sans date saisie, aucune alerte (compteur « sans échéance » affiché, aperçu dans la saisie).
- **Données personnelles** : aucune (contenu du frigo, nom du foyer facultatif).
- **Taille** : historique des sorties qui grossit ; jauge et purge avant une date.

## À valider par Quentin

Prix 12 €, nom, permalien, catégorie Gumroad ; ne fournir que deux durées sourcées ; DLC ignorée au congélateur ;
valeur « Restes : 2 jours » du foyer fictif de la démo ; gaspillage compté en nombre de sorties ; hashtags hors kit ;
prospects à vérifier.
