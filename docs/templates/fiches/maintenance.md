# T61 · Maintenance préventive (GMAO légère)

Slug `maintenance`, préfixe `GMA` (clés locales `qme-gma-*`, règles `window.GMA`), prix prévu 39 €, permalien
Gumroad prévu `maintenance-preventive`, catégorie Gumroad prévue `business-and-money/management-and-leadership`
(à confirmer), taille M, priorité P2. Origine : backlog de Quentin n° 39 (ligne T61 de `IDEES.md` :
équipements, plans de maintenance, échéances, bons d'intervention, historique ; plans de maintenance types).
Fiche rédigée le 14/11/2026, cadrage délégué par Quentin (aucune validation intermédiaire). Catalogue :
`data-pour="pro"`, thème `equipements-et-vehicules` (`--c:var(--bleu)`). Packs prévus : « Moyens généraux » et
« Exploitation et maintenance ».

Marques : **confidentiel** (mécanique seulement : aucun artefact professionnel de maintenance repris, ni nom,
ni équipement, ni plan, ni chiffre ; démo entièrement fictive, « Atelier Exemple »). **daté** pour deux
obligations seulement, reprises de la base sourcée et vérifiée de l'Entretien de la maison (T11, vérifiée le
13/11/2026) : entretien annuel des chaudières de 4 à 400 kW et entretien des systèmes thermodynamiques de 4 à
70 kW (au plus 2 ans). Toutes les autres vérifications réglementaires (appareils de levage, équipements sous
pression, installations électriques, moyens de secours incendie, portes automatiques…) sont proposées **sans
périodicité** : l'utilisateur la saisit après vérification du texte applicable, avec sa référence. Les
périodicités d'entretien des plans types sont des **repères indicatifs** (pratiques courantes, non sourcées),
affichés comme tels : la notice du fabricant prime. Revue annuelle de la base (date affichée dans Réglages).

## Pour qui

Ateliers, petites industries, services techniques et gestionnaires de bâtiments de PME (1 à 3 techniciens,
quelques dizaines d'équipements) qui suivent la maintenance sur un tableur, un planning mural ou de mémoire :
interventions oubliées, vidanges faites « quand on y pense », historique introuvable le jour d'une panne ou
d'un audit, coût de maintenance d'une machine inconnu au moment de décider de la remplacer. Trop petits pour
une GMAO du marché (abonnement par utilisateur, paramétrage lourd).

Distinct de l'**Entretien de la maison** (T11, particuliers, tâches à la date seulement), de la **Gestion de
flotte** (T29, véhicules, réservations, amendes) et des futures **Vérifications réglementaires** (T63,
registre des contrôles et preuves). Moteur d'échéances commun : date, compteur, premier atteint (repris de
`templates/flotte/regles.js`, `echeanceEntretien`, et de `templates/entretien/regles.js`, `ajoutMois`).

## Promesse

Chaque machine entretenue à temps : les échéances à la date, au compteur ou au premier atteint, des bons
d'intervention imprimables, l'historique et le coût de maintenance de chaque équipement.

## Écrans (5 onglets + réglages)

1. **Tableau de bord** : tuiles (en retard, à faire sous N jours, taux de réalisation du préventif sur la
   période, coût de maintenance sur 12 mois avec la part du correctif) ; échéances en retard et proches avec
   « Ouvrir un bon » et « Fait » ; bons en cours ; alertes de pièces (sous le seuil) ; coût par équipement
   (barres préventif / correctif, tableau accessible) ; indicateurs (taux de réalisation, ponctualité, retard
   moyen, pannes et heures d'arrêt).
2. **Échéancier** : toutes les opérations des plans, groupées par état (en retard, à faire bientôt, à venir
   sous 90 jours, plus tard, à paramétrer, bon ouvert), filtres par famille et emplacement, recherche ;
   chaque ligne : équipement, opération, échéance(s) date et compteur, date estimée pour le compteur
   (rythme d'utilisation), nature (entretien, contrôle, réglementaire).
3. **Équipements** : liste (repère, nom, famille, emplacement, criticité, compteur, prochaine échéance, coût
   12 mois), filtres (tous, en retard, critiques, archivés). **Fiche** : identité, compteur actuel et rythme,
   relevés de compteur (ajout, cohérence vérifiée), plan de maintenance (opérations avec leurs échéances),
   historique des interventions, coûts (préventif, correctif, pièces, main-d'œuvre, sous-traitance), temps
   d'arrêt. Création depuis une **famille** : son plan type est proposé (cases à cocher), modifiable.
4. **Interventions** (bons d'intervention) : filtres À faire, En cours, Faites, Correctifs, Annulées ;
   numérotation automatique (`BI-2026-0001`) ; bon préventif ouvert depuis une échéance (consignes et pièces
   du plan reprises) ou bon correctif (panne : symptôme, arrêt) ; clôture : date, compteur relevé, durée,
   intervenant, main-d'œuvre (taux horaire des réglages), sous-traitance, pièces consommées (sorties du
   stock), points de contrôle cochés, constat. **Bon imprimable** (A4) : en-tête, équipement, opération,
   consignes à cocher, pièces prévues, zones de saisie (date, compteur, durée, signature).
5. **Pièces** : pièces de rechange simples (référence, nom, unité, emplacement, fournisseur en texte libre,
   prix unitaire HT, seuil) ; stock = réceptions et ajustements − consommations des bons clôturés ; alerte
   sous le seuil ; équipements concernés ; réception et ajustement datés.
6. **Réglages** : entreprise ou site, taux horaire interne, alerte en jours et en % de l'intervalle
   compteur, tolérance de ponctualité, période des indicateurs, préfixe des bons ; export CSV (échéancier,
   interventions, coûts par équipement) ; sauvegarde JSON ; compte ; « Sur téléphone » ; à propos (sources,
   date de la base).

Premier lancement en 2 étapes : nom de l'atelier ou du site, taux horaire interne (facultatif) et 4
conseils ; puis choix des familles d'équipements présentes (pour proposer leurs plans types à la création).

## Base intégrée (`templates/maintenance/donnees.js`)

- 16 **familles d'équipements** avec leur unité de compteur usuelle et leur **plan type** (60 opérations
  environ) : nature (entretien, contrôle, réglementaire), périodicité indicative à la date et/ou au compteur,
  durée estimée, intervenant habituel (interne ou prestataire), 2 à 4 **points de contrôle** par opération.
- 2 **obligations sourcées** (daté) : chaudières 4–400 kW (Code de l'environnement, art. R224-41-4 à
  R224-41-9 ; arrêté du 15 septembre 2009) et systèmes thermodynamiques 4–70 kW (art. R224-44 à R224-44-5 ;
  arrêté du 24 juillet 2020), reprises de T11.
- **Vérifications réglementaires sans périodicité** (appareils de levage, réservoirs sous pression,
  installations électriques, extincteurs et alarme incendie, portes et portails automatiques, éclairage de
  sécurité) : la périodicité et la référence du texte sont saisies par l'utilisateur ; l'opération reste
  « à paramétrer » tant qu'elles manquent.
- Unités de compteur (heures, cycles, km, unités produites), criticités (A, B, C), motifs de panne, conseils.

## Calculs (règles pures, `templates/maintenance/regles.js`, `window.GMA`)

- **Compteur actuel** = plus grande valeur connue (compteur à la mise en service, relevés, compteurs notés à
  la clôture des bons) ; un relevé incohérent (inférieur à un relevé antérieur ou supérieur à un relevé
  postérieur) est refusé ; remise à zéro possible (compteur remplacé) par un relevé marqué « nouveau
  compteur » qui décale la base.
- **Rythme** d'utilisation (unités par jour) sur 90 jours, à défaut sur tout l'historique.
- **Échéance d'une opération** : référence = dernière réalisation (bon préventif clôturé de cette opération),
  sinon date et compteur de départ de l'opération. Échéance date = référence + périodicité (jours, semaines,
  mois, ans ; fin de mois bornée) ; échéance compteur = compteur de référence + intervalle. Mode « premier
  atteint » quand les deux existent. Date estimée du compteur = aujourd'hui + reste ÷ rythme. Recalage au
  choix : depuis la réalisation (glissant, par défaut) ou depuis l'échéance prévue (calendaire fixe, utile
  pour le réglementaire).
- **État** : en retard (date dépassée ou compteur atteint), bientôt (≤ N jours, ≤ N % de l'intervalle
  compteur restant, ou date estimée ≤ N jours), à venir, plus tard, à paramétrer (aucune périodicité),
  bon ouvert (un bon non clôturé existe), suspendue (opération ou équipement archivé).
- **Coût d'une intervention** = main-d'œuvre interne (durée × taux horaire, modifiable) + sous-traitance +
  pièces (quantité × prix unitaire au moment de la clôture). Coût par équipement sur 12 mois glissants et
  depuis le début, préventif / correctif.
- **Indicateurs** sur la période (90 jours par défaut) : taux de réalisation du préventif = bons préventifs
  faits ÷ (faits + bons préventifs dus non faits + échéances dépassées sans bon) ; ponctualité = part des
  faits au plus tard à l'échéance + tolérance ; retard moyen ; nombre de pannes et heures d'arrêt ; part du
  préventif dans le coût.
- **Pièces** : stock = réceptions + ajustements − consommations ; sous le seuil, rupture.
- Exports CSV point-virgule (BOM UTF-8, formules neutralisées).

## Démo (`donneesDemo()`, relative à aujourd'hui)

« Atelier Exemple » (atelier de mécanique fictif) : 11 équipements (compresseur à vis, centre d'usinage,
tour, chariot élévateur électrique, pont roulant, groupe électrogène, chaudière gaz des bureaux,
climatisation de la salle serveur, porte sectionnelle de quai, pompe de relevage, extincteurs) ; 12 mois
d'historique simulé avec les vraies règles. États forcés : retard à la date, retard au compteur, bientôt au
compteur (date estimée), bon ouvert planifié, bon en cours, fait aujourd'hui, réglementaire à paramétrer,
équipement archivé, panne avec arrêt, pièce sous le seuil, pièce en rupture.

## Risques

- Périodicités indicatives non sourcées : affichées « repère indicatif, la notice du fabricant prime »
  (même traitement que T29).
- Réglementaire : jamais présenté comme exhaustif ; « Vérifications réglementaires » renvoie à l'utilisateur
  (texte, organisme agréé) ; les deux obligations sourcées sont datées et à revoir chaque année.
- Pas de multi-utilisateur avec droits : une clé, mêmes données sur plusieurs appareils (le dire).
- Aucune photo ni pièce jointe (stockage JSON seulement) : référence du rapport ou du certificat en texte.
- Aucune connexion à un capteur, une supervision ou un ERP : compteurs relevés à la main.
