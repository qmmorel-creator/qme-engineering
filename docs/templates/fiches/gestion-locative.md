# T27 · Gestion locative

Slug `gestion-locative`, préfixe `GST` (clés locales `qme-gst-*`, règles `window.GST`), prix prévu 20 €
(**à confirmer par Quentin**), permalien Gumroad prévu `gestion-locative`, catégorie Gumroad
`business-and-money/personal-finance` (celle des autres templates « Argent » ; une catégorie immobilier serait
plus juste si Gumroad en propose une : à vérifier), taille M, priorité P2.
Origine : documents de travail de Quentin (ligne T27 de `IDEES.md` : biens, baux, quittances, révision du
loyer, charges, rendement ; modèles de quittance et de relance, échéancier des révisions ; IRL saisi par
l'utilisateur). Fiche rédigée le 14/11/2026. Marques de risque : **daté** (IRL et règles de révision, dépôt,
restitution : paramètres sourcés, datés, modifiables ; aucun indice intégré), **juridique** (modèles de
quittance, de relance et de courrier de révision « à vérifier », pas des documents certifiés), **fiscal**
(aucun calcul d'impôt, récapitulatif seulement), **RGPD** (locataires), **argent** (avertissement). Distinct
de **T64 Location saisonnière** (`templates/location-saisonniere/`) : ici des baux de longue durée, nus ou
meublés, avec loyer mensuel, révision annuelle et régularisation des charges ; T64 gère des séjours à la nuit,
le ménage et la taxe de séjour.

## Pour qui

Propriétaires bailleurs particuliers (1 à une dizaine de logements, location nue ou meublée de longue durée,
gestion en direct sans agence) qui tiennent leurs loyers sur un tableur ou un carnet, oublient la révision
annuelle, refont les quittances à la main et découvrent en fin d'année qu'ils ne savent plus ce qui a été payé.
Pas un outil d'agence ni de syndic ; pas d'accès locataire.

## Promesse

Tes loyers, à jour chaque mois : les retards calculés, la quittance et la relance prêtes à copier, la
révision et la régularisation des charges faites sans tableur.

## Écrans (5 onglets + réglages)

1. **Tableau de bord** : tuiles (encaissé du mois sur l'attendu, impayés, révisions à faire, rendement brut
   global) ; « À relancer » (bail, retard en jours depuis l'échéance la plus ancienne non soldée, palier de
   relance atteint, dernière relance notée, boutons Encaisser et Relancer) ; loyers du mois par bail
   (payé, partiel, impayé, dans le délai) ; « À venir » (révisions à faire ou indice à saisir, dépôts de
   garantie à rendre avec majoration possible, fins de bail à 120 jours, biens vacants) ; avertissement.
2. **Loyers** : mois par mois, une ligne par bail (échéance, loyer + provisions ou forfait, prorata, barre de
   paiement, statut, impayés antérieurs), boutons Quittance ou Reçu, Relancer, Encaisser ; paiements reçus du
   mois (suppression) ; export CSV des échéances. **Compte d'un bail** : dû, payé, reste, avance, dépôt de
   garantie (délai de restitution, majoration), échéancier des 36 dernières échéances avec quittance par mois,
   paiements, relances notées. **Encaissement** : bail, montant proposé (reste dû), date, mode, note, aperçu
   de l'échéance soldée.
3. **Révisions** : par bail, les trois dernières révisions (date anniversaire, trimestre de référence et
   indices, loyer avant → après, hausse mensuelle, date limite pour la demander, statut : à venir, à faire,
   indice à saisir, appliquée, non demandée à temps, interdite DPE F ou G, pas de clause) ; bandeau des indices
   manquants ; **appliquer** (date de la demande, prise d'effet sans rétroactivité, courrier à copier) ou
   retirer ; baux terminés repliés ; **indices IRL saisis** (8 derniers, puis repliés), saisie et
   modification ; encadré « Ce que l'outil ne fait pas ».
4. **Biens** : carte par bien (adresse, type, surface, DPE, loué ou vacant, crédit ; rendement brut, net de
   charges, reste ou effort mensuel avec crédit ; bail en cours ou à venir avec impayés et alerte de dépôt ;
   baux précédents et dépôt à rendre) ; **locataires** (contact, baux, données effacées) ; encadré RGPD.
   **Fiche bien** : identité, DPE, achat (prix, frais, travaux), charges annuelles prévues (copropriété et part
   non récupérable, taxe foncière, assurance, autres), crédit (mensualité, fin). **Bail** : bien, type nu ou
   meublé, locataires (existants ou nouveau : nom, contact facultatif), date d'effet, date de signature ou de
   renouvellement (règle DPE), fin prévue, loyer HC, charges, jour d'échéance, provisions ou forfait, dépôt
   (alerte au-delà du plafond), trimestre de référence IRL, clause de révision ; départ (remise des clés, état
   des lieux conforme ou non, restitution du dépôt, retenues) ; refus d'un second bail sur la même période.
   **Locataire** : nom, contact, baux et soldes, exporter, effacer, supprimer.
5. **Charges et bilan** : année par année, tuiles (loyers et charges encaissés, dépenses, solde avant impôt) ;
   **régularisation des charges** par bail (provisions appelées, charges récupérables au prorata des jours
   d'occupation, complément ou trop-perçu, faite ou non ; année en cours marquée provisoire) avec décompte
   par nature à copier, montant appliqué au compte du bail et nouvelle provision proposée ;
   **récapitulatif annuel** (loyers et charges encaissés, dépenses par catégorie, par bien) avec avertissement
   fiscal, impression et export CSV ; liste des dépenses (catégorie, part récupérable proposée).
6. **Réglages** : bailleur (nom, adresse) ; tolérance et 3 paliers de relance ; **règles légales datées**
   (plafond du dépôt en nu et en meublé, délais de restitution, majoration, délai pour demander une révision,
   date du gel F et G, date de vérification, repères et sources) ; exports CSV ; sauvegarde JSON ; compte ;
   « Sur téléphone » ; données personnelles ; à propos.

Premier lancement en 2 étapes : nom et adresse du bailleur (pour les documents) et 4 conseils ; puis premier
bien (nom, adresse, DPE).

## Base intégrée (`templates/gestion-locative/donnees.js`)

- **Aucun indice IRL** (il se périme chaque trimestre) : l'utilisateur recopie la valeur publiée par l'Insee ;
  l'outil dit où la trouver (Insee, rubrique « Indice de référence des loyers »), sans lien automatique.
- **Réglages par défaut** relevés le 14/11/2026 : tolérance 5 jours, paliers 5 / 15 / 30 jours, dépôt 1 mois
  (nu) et 2 mois (meublé) de loyer HC, restitution 1 mois (état des lieux conforme) ou 2 mois, majoration 10 %
  du loyer HC par mois de retard commencé, révision à demander dans les 12 mois, gel F et G depuis le
  24/08/2022.
- **10 catégories de dépenses** avec part récupérable proposée (copropriété : à saisir d'après le décompte du
  syndic ; taxe d'ordures ménagères, eau et chauffage collectifs : récupérables ; taxe foncière, assurance,
  travaux, intérêts, assurance d'emprunt, gestion, autre : non).
- **3 modèles de relance** (rappel amical, relance, mise en demeure ; vouvoiement du locataire), modèle de
  quittance et de reçu, courrier de révision, décompte de régularisation : tous marqués « modèle à vérifier ».
- 4 conseils, 6 repères juridiques, 5 sources, texte fiscal.

## Calculs (règles pures, `templates/gestion-locative/regles.js`, `window.GST`)

- **Échéances** mensuelles d'un bail : loyer HC et charges en vigueur à la date d'échéance (modifications
  datées : révisions, nouvelles provisions), prorata des jours calendaires le premier et le dernier mois
  (remise des clés), échéance jamais avant la date d'effet ; régularisations positives ajoutées comme
  échéances, négatives comme crédits.
- **Affectation FIFO** des paiements aux échéances ; statuts : à venir, dans le délai (tolérance), payé, payé
  en retard, partiel, impayé ; retard en jours depuis l'échéance la plus ancienne non soldée ; palier ; avance.
  Les paiements datés après aujourd'hui ne comptent pas encore.
- **Quittance** si l'échéance du mois est soldée, **reçu** si elle est partiellement payée (art. 21), rien si
  rien n'est payé ; part loyer et part charges du payé.
- **Relance** : texte du palier rempli (locataire, adresse, détail des échéances en retard, total, date).
- **Révisions** : une par anniversaire de la date d'effet ; nouveau loyer = loyer en vigueur la veille ×
  IRL(trimestre, année) ÷ IRL(même trimestre, année précédente), arrondi au centime ; date limite = date + 12 mois
  − 1 jour ; appliquée à la date de la demande, jamais avant la date anniversaire, refusée après la limite ;
  statut « interdite » si le bien est classé F ou G et le bail signé ou renouvelé depuis la date du gel.
- **Régularisation** : provisions appelées sur l'année civile contre dépenses récupérables du bien × part des
  jours d'occupation du bail ; provision mensuelle proposée (réel ramené à 12 mois, arrondi à l'euro).
- **Dépôt** : plafond selon le type, limite de restitution, mois de retard commencés et majoration.
- **Rendement** avant impôt : brut (loyers HC sur 12 mois ÷ prix de revient), net de charges non
  récupérables, reste ou effort mensuel avec la mensualité du crédit ; bien vacant sans rendement.
- **Récapitulatif annuel** : loyers et charges encaissés (affectation des paiements datés de l'année),
  dépenses par catégorie et part récupérable, par bien. **Aucun calcul d'impôt.**
- **RGPD** : effacement (nom « Locataire effacé n », contact et notes vidés, montants gardés), suppression
  (retiré des baux), export des données d'un locataire (fiche, baux, échéances, paiements).
- Exports CSV (point-virgule, BOM UTF-8), normalisation tolérante des anciennes données.
- 19 tests `node --test` dans `outils/templates/gestion-locative.test.mjs`.

## Sources (consultées le 14/11/2026)

- service-public.gouv.fr, fiche F1311 « Révision du loyer » (vérifiée par l'éditeur le 08/08/2025) : clause
  de révision nécessaire, une fois par an, formule loyer × IRL du trimestre de référence ÷ IRL du même
  trimestre de l'année précédente, arrondi au centime ; trimestre du bail, à défaut le dernier publié à la
  signature ; révision non automatique, à demander dans l'année, effet à la date de la demande, sans
  rétroactivité, perdue au-delà ; interdite pour un logement F ou G si le bail est signé, renouvelé ou
  reconduit depuis le 24/08/2022 en métropole (01/07/2024 en outre-mer) ; exemple 600 € → 606,91 € repris dans
  les tests. https://www.service-public.gouv.fr/particuliers/vosdroits/F1311
- service-public.gouv.fr, fiche F31269 « Dépôt de garantie » : 1 mois de loyer HC (nu), 2 mois (meublé),
  restitution 1 mois si état des lieux conforme, 2 mois sinon, majoration de 10 % du loyer mensuel HC par mois
  de retard commencé (après mise en demeure du locataire), pas de dépôt en bail mobilité.
  https://www.service-public.gouv.fr/particuliers/vosdroits/F31269
- service-public.gouv.fr, fiche F947 « Charges locatives » : provisions et régularisation annuelle (nu),
  forfait possible en meublé, décompte un mois avant, justificatifs 6 mois, paiement en 12 mois en cas de
  régularisation tardive. https://www.service-public.gouv.fr/particuliers/vosdroits/F947
- Légifrance, loi n° 89-462 du 6 juillet 1989, art. 21 : quittance gratuite au locataire qui la demande,
  détail loyer et charges, aucun frais, envoi électronique avec accord exprès, reçu en cas de paiement
  partiel. https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000028806698/
- **Non vérifié, à vérifier** : les articles cités dans l'application pour le dépôt (22 et 25-6), la révision
  (17-1) et les charges (23 et 25-10), repris de mémoire et non relus sur Légifrance ; la liste des charges
  récupérables (décret n° 87-713, non relu) et la répartition par défaut des catégories ; l'encadrement des
  loyers (non calculé) ; les délais des modèles de relance (8 et 15 jours, choix rédactionnels, pas des
  délais légaux) ; la suite d'une mise en demeure (commandement de payer, clause résolutoire, délais),
  volontairement non détaillée ; les documents qu'un bailleur peut demander à un candidat (non listés).

## Risques

- **Daté** : la loi et les fiches peuvent changer (gel F et G, extension à la classe E prévue par la loi
  Climat à une date ultérieure, **à vérifier**) ; tout est paramétrable avec une date de vérification ; mise à
  jour de `donnees.js` si la loi change. Les indices sont saisis : une erreur de saisie fausse la révision
  (formule et indices affichés à chaque calcul).
- **Juridique** : modèles à vérifier, pas de conseil ; l'outil ne contrôle ni la clause de révision ni
  l'encadrement des loyers, ni les baux particuliers (loi de 1948, conventionné, bail mobilité).
- **Fiscal** : aucun calcul d'impôt, aucun régime (micro-foncier, réel, micro-BIC, LMNP) ; renvoi à
  impots.gouv.fr ou à un professionnel dans l'application, la page catalogue et la fiche Gumroad.
- **Calcul simplifié** : FIFO (un paiement destiné à un mois précis solde d'abord le plus ancien impayé),
  année civile pour la régularisation, prorata calendaire, rendement sans fiscalité ni vacance.
- **RGPD** : données de locataires hébergées en ligne avec la clé de l'acheteur ; minimisation (nom, contact
  facultatif), aucune pièce stockée, export, effacement et suppression, rappel des obligations du bailleur ;
  durées de conservation renvoyées à ses obligations (à vérifier).
- Concurrence : logiciels de gestion locative en ligne gratuits ou par abonnement ; se distinguer par l'achat
  unique, les règles visibles et modifiables, aucune connexion bancaire.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/conges/` (connexion avec `produit: 'GST'`, synchronisation et 409, démo `?demo`
  non mémorisée, modales, toast Annuler, export / import JSON, service worker, fenêtre « Comme une
  application » avec la clé `qme-gst-ecran-accueil`, bandeau « Bientôt en vente » vers
  `/catalogue/gestion-locative/`).
- Rien n'est envoyé : quittances, relances, courrier de révision et décompte de charges sont des textes à
  copier ou à imprimer (zone d'impression dédiée) ; aucun lien mailto ni tel ; le contact du locataire est un
  texte libre.
- Démo : 3 biens fictifs aux adresses imaginaires (« 12 rue Imaginaire, 99000 Exempleville »…), 5 locataires
  fictifs, 4 baux dont un terminé ; tout relatif à la date du jour ; indices IRL **fictifs** marqués « Valeur
  fictive (démo) », un trimestre volontairement manquant ; états couverts : payé, payé en retard, partiel,
  impayé, relance notée, révision à faire, indice à saisir, révisions appliquées, révisions perdues (bail
  terminé), révision interdite (DPE F), dépôt de garantie à rendre en retard, régularisation faite, à faire et
  trop-perçu, crédits, dépenses sur deux années.
- Pas de graphique : tuiles, listes et tableaux (le skill dataviz n'a donc pas été appliqué).
