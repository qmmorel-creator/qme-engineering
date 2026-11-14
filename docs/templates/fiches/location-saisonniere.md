# T64 · Location saisonnière

Slug `location-saisonniere`, préfixe `SJR` (clés locales `qme-sjr-*`, règles `window.SJR`), prix prévu 25 €,
permalien Gumroad prévu `location-saisonniere`, catégorie Gumroad proposée `business-and-money/personal-finance`
(une catégorie immobilier, si Gumroad en propose une, est à vérifier), taille S, priorité P2. Catalogue :
Vie personnelle, thème Argent (`data-pour="perso"`, `data-theme="argent"`, `--c:var(--jaune)`).
Origine : backlog de Quentin n° 42 (ligne T64 de `IDEES.md` : calendrier, réservations, ménage, taxe de
séjour, revenus par plateforme). Fiche rédigée le 14/11/2026. Marques de risque : **daté** (taxe de séjour :
tarif saisi par l'utilisateur, paramétrable, aucun barème intégré), **fiscal** (recettes données, aucun
régime calculé), **RGPD** (voyageurs). Aucune donnée de l'artefact client « Location saisonnière » n'a été
reprise. Distinct de T27 (gestion locative : baux, loyers, quittances) : ici des séjours courts, des canaux
de réservation et le ménage. Application web, pas de modèle tableur.

## Pour qui

Propriétaires de meublés de tourisme et de chambres d'hôtes qui gèrent eux-mêmes 1 à 5 logements (jusqu'à 10
acceptés) : réservations reçues en direct et par un ou deux intermédiaires, ménage à caler entre deux
séjours, taxe de séjour à collecter ou non selon le canal, et aucune vue claire du net après commissions.

## Promesse

Tes logements, toujours prêts : le calendrier sans double réservation, le ménage entre deux séjours, la taxe
de séjour au tarif de ta commune et ce qui te reste vraiment, canal par canal et mois par mois.

## Écrans (5 onglets + réglages)

1. **Aujourd'hui** : tuiles (logements occupés ce soir, arrivées et départs du jour, ménages à faire dont en
   retard, net et occupation du mois) ; alerte de chevauchement ; séjours du jour ; arrivées des 7 jours ;
   options en attente (avec « en conflit ») ; ménages à faire ; paiements à suivre (soldes non reçus,
   acomptes attendus) ; avertissement.
2. **Calendrier** : un mois, une ligne par logement, une colonne par jour (week-ends et aujourd'hui
   repérés) ; séjours en barres de l'après-midi d'arrivée au matin du départ ; options en bande pointillée
   sous les séjours ; chevauchement entouré de rouge ; séjours terminés atténués ; case vide → nouvelle
   réservation à cette date ; taux d'occupation par logement ; liste des séjours du mois ; mois vide signalé.
   Sur téléphone : défilement horizontal dans le cadre, centré sur aujourd'hui.
3. **Réservations** : filtres À venir, En cours, À encaisser, Options, Terminés, Annulées, Toutes ;
   recherche ; chaque ligne : voyageur, logement, dates, nuits, personnes, canal, état du séjour, état du
   paiement, net et reste. **Détail** : brut, commission, net, taxe de séjour (imposables × nuits × tarif),
   acompte et solde, paiements datés (ajout, suppression, « solde reçu aujourd'hui »), ménage après le
   départ, effacement du voyageur.
4. **Ménage** : en retard, aujourd'hui, dans les 14 jours, faits récemment ; prochaine arrivée, rotation le
   jour même ; « Marquer fait » / « Remettre à faire » ; check-list type.
5. **Revenus** : année civile (navigation) ; tuiles net, occupation, prix moyen par nuit, taxe de séjour
   (à reverser par l'utilisateur / par les canaux) ; net par mois (barres, une seule série, infobulle,
   valeurs en texte) ; tableaux par canal, par logement et mois par mois ; export CSV ; encadré impôts.
6. **Réglages** : nom de l'activité ; logements (nom, capacité, ménage facturé, tarif de taxe propre) ;
   canaux (nom libre, commission %, « collecte la taxe ») ; tarif de taxe par défaut, date de vérification,
   exonération des mineurs, repères et sources ; acompte (%) et délai du solde ; effacement groupé des
   voyageurs anciens ; CSV ; sauvegarde JSON ; compte ; « Sur téléphone » ; données personnelles ; à propos.

Premier lancement en 2 étapes : nom de l'activité et logements (1 à 10 : nom, capacité, ménage facturé) et
4 conseils, puis canaux (« Direct » existe déjà ; noms et commissions libres, collecte de la taxe), tarif de
taxe par défaut (facultatif) et acompte.

## Base intégrée (`templates/location-saisonniere/donnees.js`)

- Réglages par défaut : **aucun tarif de taxe** (`taxeDefaut: null`), exonération des mineurs cochée,
  acompte 30 %, solde le jour de l'arrivée.
- Un seul canal : « Direct » (0 %). **Aucune marque de plateforme** dans le code ni la démo.
- Check-list de ménage (8 points), 4 conseils, 6 repères, 2 sources.

## Calculs (règles pures, `templates/location-saisonniere/regles.js`, `window.SJR`)

- Montants en centimes, commissions en pour cent ; nuits = départ − arrivée (départ exclu).
- **Chevauchement** : même logement, statuts non annulés, au moins une nuit commune ; un départ et une
  arrivée le même jour ne se chevauchent pas. Enregistrement **refusé** entre deux réservations confirmées ;
  une option peut chevaucher et est **signalée** (vue du jour, calendrier, liste).
- **Brut** = hébergement + ménage facturé ; **commission** = montant saisi, sinon % du canal × brut ;
  **net** = brut − commission.
- **Taxe de séjour** = personnes imposables × nuits × tarif (celui du logement, sinon celui des Réglages) ;
  imposables = adultes (+ enfants si l'exonération des mineurs est décochée) ; « tarif non renseigné » si
  aucun tarif ; rien pour une annulation.
- **À recevoir** = net + taxe (si l'utilisateur la collecte) ; **acompte attendu** = % × à recevoir ;
  **solde attendu** à l'arrivée − N jours. États : soldé, solde non reçu, acompte attendu, acompte reçu.
- **Séjour au jour J** : à venir, arrivée, en cours, départ, terminé, annulé.
- **Ménage** : un par séjour confirmé, le jour du départ, à faire avant la prochaine arrivée confirmée du
  logement ; fait, en retard, aujourd'hui, à venir ; rotation le jour même.
- **Ventilation par mois** au prorata des nuits (au centime, sans perte) ; **statistiques** sur une période
  de mois entiers : nuits vendues, occupation = nuits / (logements × jours), prix moyen = hébergement / nuits,
  brut, commissions, net, taxe (par l'utilisateur / par les canaux), séjours arrivés ; par canal, par
  logement, par mois ; mois vides. Seules les réservations confirmées comptent.
- **RGPD** : effacement d'un voyageur (nom « Voyageur effacé », notes vidées, montants et dates gardés) ;
  effacement groupé des séjours terminés avant une date ; logement supprimable seulement sans réservation.
- Export CSV (point-virgule, BOM UTF-8), normalisation tolérante (canal Direct toujours présent, 10
  logements au plus).
- 15 tests `node --test` dans `outils/templates/location-saisonniere.test.mjs`.

## Sources (consultées le 14/11/2026)

- Entreprendre.service-public.gouv.fr, « Taxe de séjour » (page vérifiée le 01/01/2026 par la DILA) : tarifs
  adoptés par le conseil municipal ou l'organe délibérant de l'EPCI, dans la limite d'une grille ; décision
  avant le 1er juillet pour le 1er janvier suivant ; au réel, tarif × nuits × personnes imposables ;
  hébergement non classé : 1 % à 5 % du prix de la nuit par personne, plafonné.
  https://entreprendre.service-public.gouv.fr/vosdroits/F31635
- impots.gouv.fr, « Taxe de séjour » (modifiée le 15/10/2026) : délibérations et tarifs transmis par les
  collectivités. https://www.impots.gouv.fr/taxe-de-sejour
- **Exemption des mineurs** : trouvée seulement dans une source secondaire (encyclopédie en ligne renvoyant
  à service-public.fr) ; l'article du CGCT n'a pas pu être consulté (Légifrance inaccessible depuis la
  session). Présentée comme « à vérifier auprès de ta commune » et désactivable.
- Collecte par un intermédiaire : non vérifiée ; laissée au choix de l'utilisateur, canal par canal (« à
  vérifier dans ton contrat »).

## Risques

- **Daté** : tarifs de taxe de séjour changeant chaque 1er janvier, propres à chaque commune ; rien n'est
  codé en dur ; date de vérification affichée.
- **Fiscal** : aucun régime (micro-BIC, réel, loueur en meublé) ni abattement calculé ; avertissement dans
  l'application, la page catalogue et la fiche Gumroad.
- **RGPD** : noms de voyageurs hébergés en ligne ; minimisation (nom, nombre de personnes), effacement
  individuel et groupé ; aucune pièce d'identité ni coordonnée demandée. Durées de conservation : à vérifier.
- **Concurrence** : logiciels de gestion connectés aux plateformes, par abonnement ; se distinguer par
  l'achat unique, la simplicité (1 à 5 logements) et l'absence de connexion (rien à configurer).
- **Taxe pour les logements non classés** : calcul en pourcentage non fait par l'outil (montant par
  personne et par nuit à saisir) ; dit clairement dans les repères et la FAQ.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/impayes/` (connexion avec `produit: PRODUIT`, démo `?demo` non mémorisée,
  synchronisation et 409, modales, toast « Annuler », export et import JSON, service worker, fenêtre
  « Comme une application » avec `qme-sjr-ecran-accueil`, bandeau « Bientôt en vente »).
- Démo : « Les Tilleuls (exemple fictif) », 3 logements (Studio du Port, Gîte des Tilleuls, Chambre d'hôtes
  Bleue, ce dernier au tarif de taxe par défaut), canaux « Direct », « Plateforme A » (15 %, collecte la
  taxe), « Plateforme B » (3 %) ; tarifs de taxe inventés (1,00 €, 0,88 €, 0,80 €) ; environ six mois
  d'historique soldé ; autour d'aujourd'hui : séjour en cours, arrivée et départ du jour, rotation le jour
  même, ménage en retard, solde non reçu (paiement partiel), acompte attendu, option en conflit, annulation ;
  les mois suivants restent vides.
- Graphique (skill dataviz) : une seule série (bleu), mois en cours en encre (indiqué dans le titre),
  valeurs en texte d'encre, infobulle au survol, au toucher et au clavier, tableaux complets en dessous.
