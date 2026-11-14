# T92 · Bénévoles et planning des créneaux

Slug `benevoles`, préfixe `BNV` (clés locales `qme-bnv-*`, règles `window.BNV`), prix 19 €, permalien Gumroad prévu
`benevoles-planning-creneaux`, catégorie Gumroad prévue `business-and-money/management-and-leadership` (à confirmer),
taille M, priorité P2, usage `pro`. Origine : proposition validée par Quentin le 14/11/2026 (pack « Associations et
clubs », PAS). Fiche rédigée le 14/11/2026 par délégation de Quentin (décisions de cadrage déléguées, pas de
validation à attendre). Catalogue : `data-pour="pro"`, thème `associations-formation-et-evenements`
(`--c:var(--rouge)`), avec les inscriptions associatives et la gestion de compétition. Marque de risque : **RGPD**
(coordonnées de bénévoles, tiers). **Confidentiel vérifié** : démo d'un comité des fêtes fictif (« Comité des fêtes
Exemple »), prénoms et noms courants, numéros en `06 00 00 …`, e-mails en `@exemple.fr`.

## Pour qui

Président, secrétaire ou « responsable bénévoles » d'une association, d'un club sportif, d'un comité des fêtes,
d'un festival ou d'une compétition : 15 à 150 bénévoles, un à dix événements par an. Aujourd'hui : un tableur
partagé ou un tableau blanc, des disponibilités notées au fil des messages, des doublons et des absents découverts
le jour J, aucun compte des heures données.

## Promesse

Chaque créneau tenu, sans trou ni doublon : qui tient quel poste à quelle heure, ce qui reste à pourvoir, et les
conflits, avant le jour J.

## Décisions de cadrage

- **Usage à plusieurs (V1)** : une clé partagée par les responsables (même modèle que T50 et T82) ; pas de comptes,
  pas de rôles. Prénom saisi sur l'appareil, gardé sur chaque affectation. Saisies simultanées fusionnées élément par
  élément (`fusionner`, comme le planning d'équipe) ; deux responsables qui affectent la même personne au même
  moment produisent deux affectations, montrées en conflit (double affectation) ; la même affectation saisie deux
  fois n'est gardée qu'une fois.
- **Pas d'inscription en ligne des bénévoles en V1** : le responsable saisit les réponses. Évolution possible : lien
  public de disponibilité (sur le modèle du Secret Santa ou de l'écran public de la compétition).
- **Modèle de données** : compétences ; postes (communs à tous les événements : nom, famille, couleur, compétence
  demandée, consigne) ; bénévoles (prénom, nom, téléphone, e-mail, compétences, postes préférés et à éviter, note) ;
  événements (dates, lieu, contact en cas d'empêchement, consignes) ; réponses par bénévole et par événement
  (disponible, en partie avec une plage par jour, indisponible ; absence de réponse = « sans réponse » ; maximum
  d'heures facultatif) ; créneaux (événement, poste, date, début, fin, besoin en personnes ; fin ≤ début = passe
  minuit) ; affectations (créneau, bénévole, qui, quand).
- **Conflits** (par bénévole et par événement) : double affectation (chevauchement), indisponible (répondu
  « indisponible » ou hors de ses plages), sans pause (créneaux séparés de moins de N minutes enchaînés au-delà de
  N heures, 30 min et 4 h par défaut), journée trop longue (8 h par défaut), au-delà de son maximum, compétence
  manquante. **Repères de l'association, pas des règles légales** (les bénévoles ne relèvent pas du Code du
  travail) : modifiables, désactivables, dits comme tels partout.
- **Trous** : places à pourvoir par créneau (besoin − affectés), surplus signalé sans être une erreur.
- **Suggestion** : pour un créneau, chaque bénévole classé en suggéré (disponible, sans conflit nouveau),
  « possible avec réserve » (sans réponse, pas de pause, journée longue, maximum dépassé, sans la compétence,
  préfère éviter) ou indisponible (non, hors plages, déjà sur un créneau à la même heure). Ordre : aime le poste,
  a la compétence, moins d'heures sur l'événement, moins d'heures sur 12 mois (équité). **Remplissage automatique**
  (« Remplir les trous ») : glouton, le créneau qui a le moins de candidats d'abord, premier candidat du classement ;
  ne retient que des suggérés (et les « sans réponse » si le réglage l'autorise) ; proposition montrée avant
  application, annulable.
- **Message à copier** par bénévole : modèle modifiable avec marqueurs ({prenom} {evenement} {lieu} {dates}
  {creneaux} {total} {consignes} {contact} {signature}), consigne de chaque poste reprise. Rien n'est envoyé (règle
  « aucune automatisation »).
- **Impression A4** par poste (jour, poste, créneau, noms et téléphones, lignes « à pourvoir ») et par personne
  (fiches à découper).
- **Duplication** d'un événement à une autre date (même jour de la semaine un an plus tard proposé) : créneaux
  décalés, sans affectations ni réponses.
- **Lien avec T51 (événementiel) et T52 (compétition)** : aucun lien technique (règle « aucune automatisation ») ;
  modèle « Compétition sportive » et postes « Sport » (table de marque, juges, saisie des résultats) pour les
  organisateurs de T52 ; export CSV du planning.

## Base intégrée (`donnees.js`)

- 33 postes types en 6 familles (accueil, restauration, logistique, sécurité, animation, sport) avec consigne type
  et compétence conseillée seulement quand elle est utile (caisse, grillades, cuisine, navette, poste de secours,
  sono, arbitrage…).
- 12 compétences types (dont « Premiers secours (PSC1 ou plus) », « Permis B »).
- 6 modèles d'événement avec leurs créneaux types (jour relatif, horaires, besoin) : fête de village ou kermesse,
  festival sur deux jours, compétition sportive, course à pied ou randonnée, brocante ou vide-greniers, repas, loto
  ou soirée associative.
- Message type au tutoiement, réglages par défaut, palette de 7 couleurs (celle du planning d'équipe, validée).
- Rédaction QME, aucune source externe, **aucune donnée qui se périme**. Seule référence : RGPD (articles 5.1.c,
  5.1.e, 13, 15, 17) lus sur cnil.fr le 14/11/2026 (`BASE.rgpd`), affichés dans les Réglages.

## Écrans

- **Événement** (tableau de bord de l'événement choisi) : places pourvues, à pourvoir, conflits, bénévoles et
  heures ; liste des trous (affecter) ; conflits ; réponses (disponible, en partie, indisponible, sans réponse) avec
  « Noter la réponse » ; remplissage par poste ; « Remplir les trous ».
- **Planning** : par poste (jour par jour, cartes de créneau avec noms, places vides en pointillés, conflits en
  rouge), par personne, messages à copier ; filtre par jour ; impression par poste et par personne ; nouveau
  créneau ou série (de 10 h à 18 h par tranches).
- **Fenêtre d'un créneau** : affectés (retirer), suggérés, possibles avec réserve, indisponibles, modification.
- **Bénévoles** : annuaire, recherche, filtres (compétence, réponse), heures de l'année, réponse pour l'événement ;
  fiche (coordonnées, compétences, préférences, créneaux à venir, export, effacement, suppression) ; bénévoles
  inactifs signalés.
- **Événements** : à venir et passés (taux de remplissage), création depuis un modèle, modification (décalage des
  créneaux proposé), duplication, suppression ; postes par famille ; compétences.
- **Bilan** : par année ou par événement : heures données, bénévoles mobilisés, places pourvues, part des heures
  faite par le quart le plus investi (repère d'équité), heures par bénévole et par poste, tableau, CSV.
- **Réglages** : association, prénom sur l'appareil, repères (heures d'affilée, pause, heures par jour), suggestion
  des « sans réponse », contact et signature, modèle de message, durée de conservation choisie, exports CSV
  (planning, heures, annuaire), copie JSON, compte, écran d'accueil, RGPD.
- **Premier lancement** en 2 étapes : association, prénom, modèle et date du premier événement ; postes (ceux du
  modèle cochés) et compétences.

## RGPD et risques

- Données minimales (art. 5.1.c), aucune donnée de santé ni motif d'absence (rappelé sur les champs de note).
- Export des données d'un bénévole (art. 15), effacement (art. 17 : nom, coordonnées, préférences et réponses
  effacés, heures passées gardées pour le bilan), suppression complète.
- Durée de conservation : **aucune durée légale intégrée** ; l'association choisit (24 mois par défaut) et les
  bénévoles sans créneau depuis cette durée sont signalés, effaçables en un geste (art. 5.1.e).
- Information des bénévoles (art. 13) : rappel dans l'application, à la charge de l'association. Bénévole mineur :
  accord parental géré hors de l'outil.
- Pas de comptes : la clé partagée est la seule protection ; le dire (application, page, Gumroad).
- Sécurité de l'événement (secours, autorisations, assurances) hors périmètre, dit dans l'avertissement.

## Statut

**prêt** le 14/11/2026, « Mise en vente prochaine » (démo `/templates/benevoles/?demo`, page `catalogue/benevoles/`,
carte `carte prochaine` du catalogue). Tests : `outils/templates/benevoles.test.mjs` (15 tests : heures et passage
de minuit, disponibilités, couverture, conflits, suggestions, remplissage, message, statistiques, modèles et
duplication, fusion, RGPD, CSV, plannings imprimables, normalisation). Parcours Playwright (1280 px, iPhone 13,
Pixel 7) : code faux et incomplet refusés, premier lancement depuis un modèle, saisie, second appareil, conflit 409
(saisies réunies), rechargement, lien `?demo` qui garde le code, fenêtre « Comme une application », impression.
Restent : nom et prix à confirmer (clé partagée par tout le bureau au prix d'un template individuel, même question
que T50 et T82), fiche Gumroad et clé de licence, entrée dans `gumroad-a-creer.json`, ajout de BNV au pack PAS
(`netlify/lib/packs.mjs`, pages régénérées), version anglaise, plannings LinkedIn et Instagram, mise en vente.
