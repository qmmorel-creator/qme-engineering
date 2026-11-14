# T20 · Suivi d'un animal de compagnie

Slug `animal`, préfixe `ANM` (clés locales `qme-anm-*`, règles `window.ANM`), prix prévu 12 € (**à confirmer
par Quentin**), permalien Gumroad prévu `suivi-animal-compagnie` (à confirmer), catégorie Gumroad à vérifier
(pas de catégorie « animaux » repérée ; proposition `self-improvement/productivity`, déjà utilisée par d'autres templates de vie
personnelle), taille S, priorité P3. Catalogue : `data-pour="perso"`, thème « Organisation et études » (puce
existante ; aucun thème « Animaux » : il n'aurait qu'une carte). Origine : liste initiale (12/11/2026).
Marques de risque : **médical** (vétérinaire) et **daté** (recommandations vaccinales). Fiche rédigée le
14/11/2026. Aucune marque de produit vétérinaire ni d'aliment ; aucune automatisation ni lien externe.

## Pour qui

Propriétaires d'un chien, d'un chat ou d'un autre animal (lapin, furet, oiseau…), seuls ou en foyer, qui
oublient la date du dernier antiparasitaire, retrouvent le carnet de santé au moment du rappel, ne pèsent leur
animal que chez le vétérinaire et n'ont qu'une impression de ce qu'il coûte. Distinct du **budget du foyer**
(toutes les dépenses) et de l'**entretien de la maison** (tâches du logement).

## Promesse

Ses soins, à temps : les vaccins, antiparasitaires et toilettages aux dates fixées avec ton vétérinaire, sa
courbe de poids, ses visites, et ce qu'il te coûte par mois et par an.

## Écrans (5 onglets + réglages)

1. **Tableau de bord** : filtre d'animal ; tuiles (en retard, bientôt, coût annuel = 12 derniers mois, coût
   mensuel moyen) ; « À faire » (soins en retard puis bientôt, pesée à faire), chacun avec « C'est fait » ou
   « Peser » ; traitements en cours (notés lors des visites, jusqu'à leur date de fin) ; « Mes animaux » (âge,
   dernier poids, prochain soin, traitement en cours).
2. **Soins** : par animal, chaque soin récurrent avec son état (en retard, bientôt, à jour, à compléter, en
   pause), sa prochaine échéance (« date fixée par le vétérinaire » quand c'est le cas), la dernière fois et
   l'intervalle saisi ; « Ajouter un soin » ; historique des soins faits (par qui, coût, note).
3. **Poids et visites** : un animal à la fois ; tuiles (dernier poids, écart avec la pesée précédente en kg et
   en %, écart sur 90 jours, nombre de pesées et plage) ; **courbe de poids SVG** (ligne 2 px, lavis à 10 %,
   marqueurs cerclés, dernière valeur étiquetée, zone de survol et repère vertical par pesée, infobulle, tableau
   des pesées) ; visites (motif, vétérinaire, notes, traitement recopié de l'ordonnance, date de fin, coût).
4. **Frais** : filtre d'animal (tous, un animal, dépenses communes) et période (12 derniers mois, cette année,
   depuis le début) ; tuiles (total, moyenne par mois, coût annuel, nombre de saisies) ; barres par catégorie,
   colonnes par mois (12 mois), barres par année civile, infobulles et tableau ; journal filtrable par
   catégorie (25 lignes puis tout) ; export CSV.
5. **Animaux** : cartes (espèce, race, sexe, stérilisation, âge, dernier poids, coût sur 12 mois,
   identification, vétérinaire, prochain soin, notes) ; « Pesée », « Carnet », « Modifier » ; animaux qui ne
   font plus partie du foyer à part, gardés pour leur historique, sans alerte.
6. **Réglages** : jours avant une échéance (14), rappel de pesée (60 jours, 0 = aucun) ; export CSV des frais
   et des pesées ; sauvegarde JSON ; compte ; « Sur téléphone » ; santé de l'animal (avertissement) ;
   données personnelles ; à propos.

Saisies (modales) : animal (nom, espèce, espèce libre pour « autre », race, naissance, sexe, stérilisation,
**identification en saisie libre**, vétérinaire habituel, notes, parti ; à la création, cases des soins proposés
pour l'espèce) ; soin (type, nom, **intervalle saisi** en jours, semaines, mois ou ans, dernière fois connue,
prochaine date notée, note, pause) ; soin fait (date, prochaine date fixée par le vétérinaire facultative, par,
coût, note ; aperçu de la prochaine échéance) ; pesée (kg ou g) ; visite (motif, vétérinaire, notes, traitement
en texte libre, fin du traitement, coût) ; frais (animal ou commun, catégorie, montant, libellé) ; carnet
(montants affichés ou non, imprimer, copier le texte).

Premier lancement en 2 étapes : présentation, 4 conseils et l'avertissement ; puis le premier animal (nom,
espèce, naissance, poids du jour facultatif, soins à suivre cochés, **noms seulement**).

## Base intégrée (`templates/animal/donnees.js`)

- **3 espèces** : chien, chat, autre (nom libre).
- **8 types de soins** : vaccin, antiparasitaire externe, vermifuge (antiparasitaire interne), visite de
  contrôle, toilettage, griffes, hygiène dentaire, autre ; chacun rattaché à une catégorie de frais.
- **Modèles de soins par espèce** (7 chien, 5 chat, 3 autre) : **un type et un nom, aucune durée**. Ils créent
  des soins « à compléter » tant que l'utilisateur n'a pas saisi l'intervalle indiqué par son vétérinaire
  (test automatique : aucun chiffre dans les modèles).
- **10 catégories de frais** : vétérinaire, soins préventifs, médicaments et traitements, alimentation,
  toilettage et hygiène, accessoires/litière/jouets, assurance santé animale, garde et pension, éducation et
  activités, autre.
- 4 conseils. Aucun calendrier vaccinal ou antiparasitaire, aucune durée, aucune posologie, aucune courbe de poids
  de référence, aucune marque.

## Calculs (règles pures, `templates/animal/regles.js`, `window.ANM`)

- **Intervalle saisi** : date + n jours, semaines (7 j), mois (fin de mois bornée : 31/01 + 1 mois = 28 ou
  29/02) ou ans (12 mois).
- **Échéance d'un soin** : référence = dernier soin fait, sinon « dernière fois connue ». Prochaine échéance =
  date inscrite par le vétérinaire sur le dernier soin fait (prioritaire, si postérieure), sinon référence +
  intervalle ; sans soin fait, la « prochaine date notée » du soin. États : en retard (date passée), bientôt
  (dans la fenêtre, aujourd'hui compris), à jour, à compléter (rien de calculable), en pause.
- **Âge révolu** (ans, mois, jours) : « 4 ans et 3 mois », « 12 mois », « 13 jours ».
- **Poids** : saisie en kg ou en g (0 < poids ≤ 150 kg) ; dernière pesée, écart et % avec la précédente,
  écart avec la pesée connue 90 jours avant la dernière, minimum et maximum. **Aucune interprétation** (ni
  « idéal », ni alerte de prise ou de perte).
- **Alertes** : soins en retard ou bientôt, pesée à faire (dernière pesée + rappel dans la fenêtre) ; animaux
  partis exclus.
- **Frais** : dépenses saisies + coût des soins faits (catégorie du type) + coût des visites (Vétérinaire) ;
  « tous » comprend les dépenses communes, un animal seul non ; total, par catégorie, moyenne mensuelle sur la
  période effective (à partir de la première ligne, 1 mois au moins), par mois civil (12 mois), par année
  civile, coût annuel = 12 derniers mois.
- **Traitements en cours** : visite avec un traitement et une date de fin ≥ aujourd'hui.
- **Carnet** : fiche, soins et prochaines dates, pesées, soins faits et visites (montants masqués par
  défaut) ; texte à copier et page imprimable, mention « ne remplace ni le carnet de santé ni l'avis du
  vétérinaire ».
- Export CSV (point-virgule, BOM UTF-8, formules neutralisées), normalisation tolérante, suppressions en
  cascade (un animal et ses saisies, un soin et ses soins faits ; les dépenses communes restent).
- 16 tests `node --test` dans `outils/templates/animal.test.mjs`.

## Sources

- **Aucune source vétérinaire intégrée**, volontairement : pas de calendrier vaccinal ni antiparasitaire, pas
  de durée de soin, pas de posologie, pas de courbe de poids de référence. Les intervalles viennent du
  vétérinaire de l'utilisateur (carnet de santé, ordonnance). Rien à mettre à jour chaque année.
- Démo : intervalles d'exemple marqués « Exemple, à confirmer avec ton vétérinaire. », jamais présentés comme
  une recommandation.
- Libellés de l'ajout à l'écran d'accueil : repris du socle (relevés sur des guides récents, à revérifier si
  l'interface d'iOS ou d'Android change).

## Données datées

- Aucune. Les seules valeurs par défaut (fenêtre de 14 jours, rappel de pesée de 60 jours) sont des réglages
  d'affichage, pas des valeurs vétérinaires, et se modifient dans les Réglages.

## Risques

- **Médical** : avertissement visible en pied de chaque vue, au premier lancement, dans les Réglages, la saisie
  d'un soin, d'une visite, la page catalogue (sous les boutons et en FAQ) et la fiche Gumroad : « ne remplace
  pas l'avis de ton vétérinaire, ne pose aucun diagnostic, ne donne aucune posologie ». Le traitement est un
  texte libre recopié de l'ordonnance ; l'outil ne propose ni médicament ni dose et ne vérifie rien.
- **Daté** : neutralisé (aucun calendrier intégré, intervalles saisis).
- **RGPD** : données de l'acheteur sur ses animaux (pas des données de santé d'une personne) ; identification
  et vétérinaire en saisie libre et facultative ; aucune géolocalisation.
- **Marques** : aucune marque de produit vétérinaire ni d'aliment, dans la base, la démo et la communication ;
  le champ libellé d'un frais rappelle d'éviter les marques si le carnet est partagé.
- Concurrence : applications mobiles gratuites (souvent avec publicité, abonnement ou rattachées à une marque),
  carnets papier ; se distinguer par l'achat unique, l'absence de marque, le multi-animal, les frais par an et
  le carnet imprimable.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/voiture/` (connexion avec `produit: 'ANM'`, synchronisation et 409, démo `?demo`
  non mémorisée, modales, toast Annuler, export / import JSON, service worker `animal-20261114`, fenêtre « Comme
  une application » avec la clé `qme-anm-ecran-accueil`, bandeau « Bientôt en vente » vers `/catalogue/animal/`).
- Graphique de poids conforme au skill `dataviz` : une seule série (pas de légende, le titre la nomme), bleu
  `#2E5A88` sur fond blanc (contraste validé par `validate_palette.js` ; seul le plancher de saturation
  « catégoriel » échoue, sans objet pour une série unique), viewBox à la largeur réelle (texte à 12 px sur
  tous les écrans), tableau des pesées en vue accessible. Barres de frais en une seule couleur.
- Démo : un chien « Biscuit », une chatte « Mistigri », une lapine « Noisette » (noms inventés, puces fictives
  « 250 000 000 000 001/002 (fictive) », « Clinique du quartier (fictive) ») ; états couverts : antiparasitaire et
  visite de contrôle en retard, vaccin, antiparasitaire, vermifuge et griffes bientôt, date fixée par le
  vétérinaire, soin à compléter, soin en pause, pesée à faire, traitement en cours, animal sans visite,
  dépenses communes, frais sur deux ans.

## À valider par Quentin

- Prix 12 €, nom « Suivi d'un animal de compagnie », permalien `suivi-animal-compagnie`, catégorie Gumroad.
- Thème du catalogue « Organisation et études » (faute de thème « Animaux »).
- Parti pris « aucun calendrier intégré » (modèles = noms seuls) : conforme à la remarque **daté** d'`IDEES.md`,
  mais la base intégrée est donc mince ; la valeur tient au calcul, au poids, aux frais et au carnet.
- Le traitement en texte libre (risque qu'un acheteur y note une dose : c'est sa saisie, l'outil n'en propose
  aucune).
- Un seul accès partagé par foyer (pas de comptes séparés pour un pet-sitter).
