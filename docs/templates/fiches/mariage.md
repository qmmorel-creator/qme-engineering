# T15 · Organisateur de mariage

Slug `mariage`, préfixe `MRG`, prix 29 €, permalien Gumroad `organisateur-mariage`, taille M, priorité P1.
Origine : liste initiale (12/11/2026) et backlog de Quentin n° 28 « Organisateur de mariage » (fusionné :
T15 devient le produit grand public ; l'événementiel professionnel part dans T51 « Pilote événementiel »).

## Pour qui

Futurs mariés (grand public) qui organisent eux-mêmes leur mariage, avec ou sans l'aide de proches, sur
6 à 18 mois. Ils jonglent aujourd'hui entre un carnet, un tableur de budget, une liste d'invités dans les
notes du téléphone et un plan de table dessiné sur papier. Le template réunit tout dans une seule
application ouverte par une clé : les deux futurs mariés (et un témoin, s'ils le souhaitent) partagent la
même clé et voient les mêmes données sur tous leurs appareils.

**Distinct de T51** (agences, organisateurs professionnels, plusieurs événements) et de **T54**
(séminaires : transports, chambres). T15 gère **un seul mariage**.

## Écrans (5 onglets)

1. **Aperçu** (tableau de bord) : compte à rebours jusqu'au jour J ; phrase d'en-tête (tâches en retard,
   ou « tout est à jour ») ; tâches de la semaine et en retard (cochables) ; quatre tuiles budget (prévu,
   engagé, payé, reste à payer) ; prochaines échéances de paiement (acomptes, soldes, en retard en
   rouge) ; réponses des invités (oui, en attente, non ; adultes et enfants ; régimes à transmettre au
   traiteur) ; alertes du plan de table.
2. **Rétroplanning** : tâches rangées par période avant le mariage (12 à 9 mois, 9 à 6 mois, 6 à 3 mois,
   3 à 1 mois, dernier mois, dernière semaine, jour J et après) ; chaque tâche a une échéance **calculée
   depuis la date du mariage** (ou une date fixe choisie) ; statut fait, en retard, cette semaine, à venir ;
   filtre « à faire / tout » ; ajout, modification, suppression avec « Annuler ». Section **Jour J** :
   checklist du jour (heure facultative, qui s'en charge, case à cocher).
3. **Budget** : budget global souhaité ; par poste : prévu, engagé (devis des prestataires réservés),
   payé, reste à payer, dépassement signalé ; graphique en barres par poste (payé, engagé non payé,
   repère du prévu) avec tableau accessible ; **prestataires** par poste (statut à contacter, devis reçu,
   réservé, écarté ; montant du devis ; contact ; note) et leurs **paiements** (acompte, solde… : montant,
   échéance, payé le).
4. **Invités** : groupes (famille de chacun, amis, collègues…) ; invité adulte ou enfant ; réponse (en
   attente, oui, non) ; régime alimentaire ; allergies (champ libre, signalé comme sensible) ; table ;
   compteurs par réponse et par groupe ; filtres (groupe, réponse) et recherche ; saisie rapide de
   plusieurs noms d'un coup (un par ligne).
5. **Plan de table** : tables (nom, nombre de places) ; invités ayant répondu oui ou en attente à placer ;
   **glisser-déposer** un invité sur une table (ordinateur) ou **choisir** sa table dans une liste (tous
   écrans) ; jauge de remplissage par table ; alertes : table au-delà de sa capacité, invités confirmés
   sans table, invités ayant décliné encore placés.

Premier lancement : prénoms des mariés, date du mariage (et lieu, facultatif), budget global (facultatif),
choix « partir du rétroplanning type » (cochés par défaut : tâches, postes de budget, checklist du jour J,
groupes d'invités types) ou « partir de zéro ».

**RSVP par les invités : pas en V1.** Les invités ne reçoivent pas de lien : les mariés saisissent les
réponses reçues (carton, message, téléphone). Un usage partagé avec les invités (lien de réponse, droits
en lecture seule) reste à concevoir (IDEES.md, remarque générale sur l'usage à plusieurs).

## Saisie

- Montants en euros à la française (`1 250`, `1 250,50 €`, `12.5`) convertis en **centimes entiers** ;
  calculs en centimes.
- Tâche : titre, catégorie (lieu et date, prestataires, invités, tenues, cérémonie, réception, démarches,
  jour J, après), échéance « N jours avant le mariage » (proposée en mois et semaines) ou date fixe, note.
- Invité : nom (prénom ou surnom suffisent), groupe, adulte ou enfant, réponse, régime, allergies, table.

## Mécanique clé

- **Échéance** d'une tâche = date fixe si elle en a une, sinon date du mariage − `avant` jours. Changer la
  date du mariage décale tout le rétroplanning d'un coup (les dates fixes ne bougent pas).
- **Statut** à une date de référence : `fait` (date de réalisation enregistrée), `retard` (échéance
  passée), `semaine` (échéance dans les 7 jours), `avenir`.
- **Période** : tranche de jours avant le mariage (≥ 270, ≥ 180, ≥ 90, ≥ 30, ≥ 7, ≥ 1, 0 et après).
- **Budget par poste** : prévu (saisi) ; engagé = somme des devis des prestataires **réservés** du poste ;
  payé = somme des paiements marqués payés (tous statuts) ; reste à payer = max(engagé, payé) − payé ;
  écart = engagé − prévu (dépassement si > 0 et prévu > 0). Totaux tous postes ; « non affecté » =
  budget global − total prévu.
- **Échéances** : paiements non payés triés par date, en retard si la date est passée.
- **Invités** : comptes par réponse × adultes / enfants ; couverts à prévoir = oui + en attente ; régimes
  comptés sur ces couverts ; allergies listées pour le traiteur.
- **Plan de table** : occupation = invités placés hors « non » ; surcapacité si occupation > places ;
  alertes listées sur l'aperçu et l'onglet.

## Base intégrée (rédigée pour le produit)

- **Rétroplanning type de 40 tâches** sur 12 mois, échéances relatives (en jours avant le mariage), par
  catégorie. Les délais sont des **suggestions d'organisation**, jamais présentés comme des obligations.
- **Démarches du mariage civil** : seules trois règles sont citées, vérifiées sur service-public.gouv.fr
  (fiche F930 « Mariage en France », vérifiée le 28/10/2026 par l'administration, consultée le
  13/11/2026) : dossier déposé à la mairie de la commune choisie (se renseigner sur le rendez-vous) ;
  extrait d'acte de naissance avec filiation de moins de 3 mois au jour du dépôt (6 mois s'il est établi
  à l'étranger) ; mariage possible à partir du 10e jour suivant la publication des bans, et dans l'année
  qui suit. Aucun délai de dépôt du dossier n'est donné : « demande à ta mairie ». Source et date affichées
  dans l'application.
- **16 postes de budget types** sans aucun montant (aucun prix moyen non sourcé).
- **Statuts de prestataires** : à contacter, devis reçu, réservé, écarté.
- **Groupes d'invités types** : famille de chacun des mariés, amis communs, amis de chacun, collègues.
- **Régimes** : sans restriction, végétarien, végétalien, sans porc, sans alcool, menu enfant, autre.
- **Checklist du jour J** : 18 points (alliances, tenues, kit de secours, paiements du jour, plan de table
  affiché, contacts des prestataires confiés à un témoin…).

## Sources

- service-public.gouv.fr, fiche F930 (voir ci-dessus). Rien d'autre de réglementaire.
- Rétroplanning, postes, checklist : rédigés pour le template (aucune base externe, aucune licence).

## Risques

- **RGPD** : la liste d'invités contient des données personnelles de tiers ; les allergies et certains
  régimes sont des **données de santé** (catégorie particulière). Rappel dans l'application (onglet
  Invités, fiche invité, réglages) : ne noter que le nécessaire, avec l'accord de l'invité, partager la
  clé seulement avec les organisateurs, effacer après le mariage (bouton « Effacer allergies et régimes »
  dans les réglages).
- **Argent** : outil de suivi ; les montants sont ceux saisis, les contrats des prestataires font foi.
- **Daté** : la seule règle datée est celle des démarches (F930) : à revérifier une fois par an.
- Délais du rétroplanning présentés comme indicatifs (chaque mariage, lieu et saison diffère).

## Choix d'implémentation

- Règles pures dans `templates/mariage/regles.js` (`window.MRG`), toutes paramétrées par une date de
  référence ; tests `outils/templates/mariage.test.mjs` à dates fixes.
- Plan de table : glisser-déposer HTML5 (souris) et liste déroulante par invité (téléphone et clavier).
- Graphique budget : barres horizontales par poste, payé en encre, engagé non payé en bleu, trait jaune
  cerclé d'encre pour le prévu ; la palette de la charte échoue la bande de luminosité du validateur
  dataviz : compensée par contours encre, légende, valeurs écrites et tableau accessible.
