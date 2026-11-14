# T19 · Suivi du bébé

Préfixe **BBE**, slug **`bebe`**, application `templates/bebe/`, prix prévu **13 €** (catégorie Famille,
taille M, priorité P3). Statut à la fin de ce lot : **prêt** (démo libre, « Mise en vente prochaine »), sous
réserve de la décision de Quentin sur le point RGPD (voir « À valider »).

Marques de la ligne IDEES : **médical** (avertissement) et **RGPD** (données de santé d'un enfant hébergées en
ligne). Les deux sont traitées comme pour T04 Nutrition : avertissement partout, consentement explicite avant tout
enregistrement, hébergement dans l'UE, effacement complet.

## Pour qui

- Jeunes parents, surtout du premier enfant, dans les premiers mois : tétées, côtés, biberons, siestes et couches
  notés la nuit, d'une main.
- Couples qui veulent noter à deux (deux téléphones, même clé), garde partagée, grands-parents.
- Parents de jumeaux ou d'un bébé et d'un aîné (plusieurs enfants).
- Hors cible : professionnels (crèches, assistantes maternelles) ; un usage par un tiers suppose de donner la clé,
  donc l'accès à tout le suivi.

## Promesse

« Ses journées, notées d'une main. » Noter en un geste, savoir d'un coup d'œil depuis quand il a mangé et de quel
côté, retrouver à deux le même suivi, et arriver au rendez-vous avec un récapitulatif clair. Sans aucune norme.

## Écrans (5 onglets + réglages)

1. **Aujourd'hui** (vue téléphone, à une main) : enfant choisi et son âge ; bloc « en cours » (tétée avec côté et
   minuteur, « Changer de côté », « Terminer » ; sommeil « Dort depuis… », « Réveil ») ; 8 gestes rapides : tétée
   gauche, tétée droite, biberon (modale quantité, « comme la dernière fois »), sommeil ou réveil, couche pipi,
   selle, les deux, autre (mesure, note, repas, saisie après coup) ; tuiles « Depuis » (dernier repas il y a…,
   dernier côté, éveillé ou endormi depuis, dernière couche) ; totaux du jour (repas, sommeil, couches) ; fil du
   jour ; prochain rendez-vous.
2. **Journal** : un jour à la fois (précédent, suivant, date), résumé du jour, toutes les saisies modifiables ;
   jour sans saisie affiché « non noté ».
3. **Résumés** : 7 ou 14 jours ; moyennes par jour noté (repas, ml de biberon, sommeil, couches) ; « rythme »
   (une ligne de 24 h par jour : sommeil en aplat, repas en repères) ; barres par jour (sommeil, repas, biberons,
   couches) ; tableau jour par jour.
4. **Mesures** : dernier poids, taille et périmètre crânien avec l'écart depuis la mesure précédente ; mention
   « Pas de courbe de référence » avec la raison ; trois courbes des **mesures saisies** selon l'âge (une seule
   série, aucune référence, aucun percentile) ; tableau de toutes les mesures.
5. **Carnet** : rendez-vous à venir (avec les questions à poser) et passés (avec ce qui a été dit) ; notes ;
   enfants suivis (ajout, modification, archivage, suppression) ; récapitulatif ; export CSV.
- **Réglages** : période des résumés ; « À deux » ; export CSV et récapitulatif ; « Tes données » (texte du
  consentement, date et version de l'accord, copie JSON, restauration, **Effacer toutes mes données**) ; compte ;
  « Sur téléphone » (fenêtre « Comme une application ») ; santé (avertissement) ; sources.
- **Premier lancement** : écran de consentement (étape 1), puis prénom ou surnom et date de naissance (étape 2).

## Base intégrée (`templates/bebe/donnees.js`)

Volontairement minimale : libellés, contenus de biberon proposés (lait maternel, préparation infantile, eau,
autre), interlocuteurs proposés pour un rendez-vous, durées en un geste pour une tétée notée après coup (5 à
30 min, présentées comme des raccourcis de saisie), conseils d'usage, texte des sources. **Aucune** norme de
quantité de lait, de nombre de repas, de durée de sommeil ou de nombre de couches ; **aucune** courbe de
croissance ; **aucun** calendrier vaccinal ; **aucune** posologie ; **aucune** marque.

La valeur du produit tient à la saisie rapide, au minuteur hors ligne, au partage à deux avec fusion des saisies,
aux résumés et au récapitulatif, pas à une base de référence (voir « Courbes »).

## Calculs (règles pures, `templates/bebe/regles.js`, `window.BBE`)

- Horodatages locaux `AAAA-MM-JJTHH:MM` ; minutes entre deux horodatages en heure murale.
- Durée d'une tétée ou d'un sommeil : fin − début ; en cours : maintenant − début (minuteur sans réseau).
- Résumé d'un jour : repas (tétées et minutes, biberons et ml, repas solides), sommeil (minutes comprises dans le
  jour, un sommeil à cheval sur minuit est réparti entre les deux jours), couches (pipi, selles).
- Résumé de période : totaux, et **moyennes sur les jours notés** (au moins une saisie), jour en cours exclu ; un
  jour où personne n'a rien noté n'est pas compté comme zéro.
- État du moment : dernier repas, dernier côté de tétée, sommeil ou tétée en cours, éveil depuis la fin du
  dernier sommeil, dernière couche.
- Mesures : liste par grandeur, écart et nombre de jours depuis la précédente.
- Âge : jours (< 14 j), semaines (< 2 mois), mois et semaines (< 2 ans), ans et mois.
- Rendez-vous à venir et passés ; récapitulatif (texte et impression) ; CSV (point-virgule, BOM, formules
  neutralisées).
- **Fusion de deux appareils** (les deux parents, même clé) : union par identifiant, la modification la plus
  récente (`maj`) gagne, les suppressions (`supprimes`) l'emportent sur toute version antérieure, oubliées après
  90 jours ; espace effacé ailleurs (plus de consentement) : rien n'est fusionné ni ressuscité. Utilisée sur un
  conflit 409 et au retour de saisies faites hors ligne.
- Lecture des saisies : poids en kg ou en g, cm, ml, durées (« 15 », « 1 h 10 ») ; les bornes servent à éviter
  les fautes de frappe, ce ne sont pas des normes.

## Courbes de croissance : sources et licences vérifiées (14/11/2026)

| Source | Licence constatée | Usage commercial | Décision |
|---|---|---|---|
| Normes de croissance de l'enfant de l'OMS (`who.int/tools/child-growth-standards`) | Page « Copyright » de l'OMS (`who.int/about/policies/publishing/copyright`) : la plupart des contenus sous **CC BY-NC-SA 3.0 IGO** ; « Permission is required for commercial uses and licensing of WHO materials » ; la page des normes ne mentionne pas de licence propre | **Non sans autorisation écrite** | **Non intégrées** |
| Courbes AFPA–Inserm/CRESS–CompuGroup Medical 2018 (carnet de santé depuis le 01/04/2018) | Communiqués AFPA et Inserm du 05/03/2018 : partenariat public-privé avec CompuGroup Medical ; **aucune licence de réutilisation trouvée** ; contact indiqué par l'Inserm : `courbesdecroissance.cress@inserm.fr` | **Non établi** | **Non intégrées** |

Conséquence : l'onglet Mesures trace seulement les mesures saisies, sans référence, sans percentile ni z-score, et
renvoie au carnet de santé. Aucune valeur de référence n'a été fabriquée. Pour en intégrer un jour : demande
d'autorisation commerciale à l'OMS (formulaire « Permissions and licensing ») ou accord écrit des auteurs des
courbes 2018, puis source et date affichées, et **revue du risque médical** (une courbe de référence invite à
l'interprétation).

## RGPD

- Données de santé d'un enfant (art. 9) : consentement explicite (art. 9-2-a) donné par le parent ou le titulaire
  de l'autorité parentale, à la première ouverture, deux cases à cocher ; **rien n'est enregistré ni envoyé
  avant** (vérifié par test statique et par Playwright : aucune requête `PUT /api/templates/donnees`, aucun cache
  local avant l'accord ; refus → déconnexion sans trace).
- Version du consentement enregistrée (`2026-11-14`) avec sa date ; retrait = « Effacer toutes mes données »
  (version en ligne remplacée par un espace vide, cache local supprimé). Un appareil qui découvre l'effacement
  revient à l'écran de consentement.
- Minimisation : prénom ou surnom et date de naissance seulement ; pas de sexe, pas de nom, pas de photo, pas de
  lieu.
- Hébergement Netlify Blobs à Francfort (comme les autres templates) ; la clé partagée avec l'autre parent donne
  accès à tout le suivi (dit dans le consentement et les réglages).
- Démo : consentement simulé, données fictives, rien n'est envoyé.
- **Non tranché** : certification HDS (hébergeur de données de santé) non vérifiée, comme pour T04 ; paragraphe
  dédié à ajouter dans `/confidentialite/` (texte proposé dans `communication/bebe/integration.md`) ; l'article 8
  (consentement des enfants aux services en ligne) ne s'applique pas ici, l'utilisateur étant le parent.

## Données datées

Aucune : ni barème, ni calendrier, ni norme. Seul le texte des sources des courbes est daté (vérification du
14/11/2026).

## Risques

- **Médical** : un parent pourrait lire un total ou une courbe comme un signal. Parades : aucune couleur d'alerte
  sur les durées (« dernier repas il y a 3 h » reste neutre), aucune comparaison, aucune référence, avertissement
  sur chaque vue, dans le consentement, les réglages, la page catalogue et la fiche Gumroad, numéros d'urgence
  (15, 112).
- **RGPD** : voir ci-dessus ; à trancher par Quentin avant la vente.
- **Deux parents en même temps** : conflits d'écriture → fusion par élément (testée en Playwright : deux saisies
  simultanées sur deux contextes, 5 saisies retrouvées des deux côtés).
- **Hors ligne la nuit** : minuteur calculé depuis l'heure de début ; saisies gardées et fusionnées au retour.
- **Taille des données** : environ 25 saisies par jour ; un an ≈ 9 000 saisies, à surveiller par rapport à la
  limite d'environ 900 000 octets par compte (non mesuré sur un an réel ; prévoir un archivage si nécessaire).

## Choix d'implémentation (14/11/2026)

- Architecture du socle (copie du suivi d'un animal), mécanisme de consentement repris de la nutrition.
- Quand une tétée démarre pendant un sommeil en cours, le sommeil se termine à cette heure (et inversement pour
  le sommeil) ; le toast l'indique et « Annuler » rétablit tout.
- Durée d'une tétée notée après coup : enregistrée comme une heure de fin.
- Rendez-vous « à venir » jusqu'à la fin de leur journée ou jusqu'à ce qu'ils soient cochés « passé ».
- Démo : deux enfants fictifs (Lou, 10 semaines ; Sacha, 2 ans et 3 mois), 14 jours de saisies générées en
  remontant depuis maintenant (sommeil en cours, une journée non notée, couche sèche, biberons de lait maternel et
  de préparation infantile, tétées des deux côtés), mesures inventées, rendez-vous passé et à venir.

## À valider par Quentin

1. **RGPD** : vente d'un outil hébergeant des données de santé d'enfants (consentement, HDS, paragraphe de
   confidentialité).
2. Absence de courbes de référence (ou démarche d'autorisation auprès de l'OMS ou des auteurs AFPA–Inserm).
3. Nom « Suivi du bébé », prix 13 €, permalien `suivi-bebe`, catégorie Gumroad `fitness-and-health` (à vérifier).
4. Mention des numéros d'urgence (15, 112) dans l'avertissement.
5. Hashtags hors kit (`#JeunesParents`, `#Parentalité`).
