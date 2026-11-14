# T73 · Suivi du temps passé et rentabilité par mission

Slug `suivi-temps`, préfixe `TMP` (clés locales `qme-tmp-*`, règles `window.TMP`), prix 19 €, permalien
Gumroad prévu `suivi-temps-rentabilite`, catégorie Gumroad prévue `business-and-money` (à confirmer), taille M,
priorité P2, usage `pro`. Numéro T73 (ancien T71, renuméroté le 14/11/2026 : T71 et T72 sont pris sur
`main`). Origine : proposition validée par Quentin le 14/11/2026 (pack « Freelance : chiffrer,
facturer, encaisser »). Fiche rédigée le 14/11/2026 par délégation de Quentin (décisions de cadrage
déléguées, pas de validation à attendre). Catalogue : `data-pour="pro"`, thème `independants`
(`--c:var(--jaune)`). Marque de risque : **argent** (avertissement : outil de gestion, pas un logiciel de
facturation ni un conseil). **Confidentiel vérifié** : aucune donnée réelle ; démo d'un freelance fictif
(« Studio Exemple ») et de clients fictifs.

## Pour qui

Freelances et consultants (conseil, développement, design, rédaction, formation) qui vendent au forfait ou
en régie et ne savent pas, une fois la mission finie, combien ils ont vraiment gagné de l'heure. Ils ont un
TJM affiché, un devis signé, et l'impression diffuse que « cette mission a débordé ». Aussi : petites
agences et indépendants du bâtiment qui chiffrent au temps.

## Promesse

Combien tu gagnes vraiment de l'heure, mission par mission : le temps saisi en une ligne ou au
chronomètre, comparé à ton TJM, à ton devis et à ton coût de revient.

## Place dans la gamme (cohérence des notions)

- **Calculateur de TJM** (T40, `templates/tjm/`) : donne le **TJM cible** (minimum ou conseillé, hors
  taxes). Ici, il est **saisi** et sert de référence. Même convention : hors taxes, jours facturables.
- **Coût de revient et prix par client** (T37, `templates/cout-revient/`) : donne le **coût de revient
  horaire** (prix plancher). Ici, il est saisi (facultatif) et sert de seuil « sous le plancher ». Même
  définition du **taux horaire réel** : montant facturé (frais refacturés exclus) ÷ heures réellement passées.
- Ici seulement : le temps saisi au quotidien, par mission et par tâche, le budget du devis, l'avancement,
  le temps non facturable et la semaine type. Aucun recalcul de TJM ni de charges sociales.

## Décisions de cadrage

- **Missions au forfait ou en régie.** Forfait : montant HT du devis, budget en jours ou en heures ; valeur
  = montant. Régie : taux HT par jour ou par heure, budget (bon de commande) en jours ou heures ; valeur =
  heures facturables × taux horaire de la mission. Une conversion jours ↔ heures unique : **heures par jour**
  (réglage, 7 h par défaut).
- **Taux horaire effectif** d'une mission = valeur (montant facturé ou facturable) ÷ temps réel total passé
  sur la mission (facturable ou non : une reprise offerte fait baisser le taux). **TJM équivalent** = taux
  horaire effectif × heures par jour. **Taux du devis** (forfait) = montant ÷ budget en heures.
- **Comparaisons** : au TJM cible (converti en taux horaire cible), au taux du devis, au coût de revient
  horaire (plancher). Statuts : au-dessus de la cible, sous la cible, sous le plancher.
- **Budget et avancement** : consommation = temps passé ÷ budget (forfait : tout le temps ; régie : temps
  facturable). Avancement saisi en % ; **estimation à terminaison** = temps passé ÷ avancement ; dépassement
  prévu = estimation − budget ; taux effectif projeté en fin de mission. Alertes : vigilance au seuil réglé
  (80 % par défaut), dépassé au-delà de 100 %, dérive quand la consommation devance l'avancement de plus de
  15 points, dépassement prévu par l'estimation.
- **Temps non facturable** : prospection, devis, administratif, facturation, comptabilité, formation, veille,
  communication, déplacements… saisi hors mission (catégorie seule) ou sur une mission (case « facturable »
  décochée). Taux de facturabilité = temps facturable ÷ temps total, comparé à un objectif réglable (70 %).
- **Taux horaire réel de l'activité** (période) : valeur produite ÷ toutes les heures de la période (non
  facturables comprises). Valeur produite : régie, heures facturables × taux ; forfait, part du montant au
  prorata du temps passé dans la période, rapportée au plus grand du budget et du temps total (le montant
  n'est jamais compté deux fois).
- **Chronomètre** : un seul à la fois, enregistré dans les données synchronisées (on le démarre sur
  l'ordinateur, on l'arrête sur le téléphone) ; arrondi réglable (aucun, 5, 10, 15 ou 30 min, au plus proche,
  au moins un pas) ; alerte au-delà de 10 h (« chronomètre oublié ? »).
- **Semaine type** : heures prévues par jour de la semaine ; la journée et la semaine se comparent au prévu.
- **Rapport client imprimable** : par client ou par mission, sur une période : détail daté des tâches,
  totaux par tâche, heures et jours, budget consommé ; montants et temps non facturable affichés au choix.
- **Exports** : CSV (point-virgule, BOM) des saisies de la période et du rapport ; copie JSON complète.

## Base intégrée (`donnees.js`)

- 17 catégories de tâches : 7 facturables par défaut (réalisation, analyse et conception, rédaction et
  livrables, réunions client, animation de formation, support et corrections, déplacement facturé) et 10
  non facturables (prospection, devis et avant-vente, administratif, facturation et relances, comptabilité,
  formation personnelle, veille, communication et réseau, déplacement non facturé, reprise ou geste
  commercial).
- 7 modèles de missions avec leurs tâches types (conseil et audit, site ou application, formation, design
  graphique, rédaction, accompagnement en régie, mission libre).
- 4 semaines types (5 jours de 7 h, 4 jours de 8 h, temps partiel, libre) et les seuils d'alerte par défaut.
- Rédaction QME, aucune source externe, **aucune donnée qui se périme** (aucun taux légal, aucun tarif de
  marché). Libellés d'ajout à l'écran d'accueil : socle commun.

## Écrans

1. **Aujourd'hui** : chronomètre (mission et tâche, ou catégorie interne), saisie rapide d'une ligne,
   entrées du jour, total face à la semaine type, alertes des missions.
2. **Semaine** : feuille de temps 7 jours (une ligne par mission ou catégorie), prévu / réalisé par jour,
   part facturable, répartition par catégorie.
3. **Missions** : liste (en cours, terminées) avec jauge budget et avancement, statut ; fiche mission
   (tuiles temps, budget, estimation, valeur, taux effectif face au devis et à la cible ; temps par tâche ;
   dernières entrées) ; création à partir d'un modèle.
4. **Rentabilité** : période (mois, mois précédent, 3 mois, année, tout) ; temps total, part facturable,
   valeur produite, taux horaire réel ; taux effectif par mission face à la cible et au plancher ; temps non
   facturable par catégorie ; 8 dernières semaines face à la semaine type.
5. **Rapport** : rapport client imprimable, exports CSV.

Réglages : activité, TJM cible, heures par jour, coût de revient horaire, seuil de vigilance, objectif de
facturabilité, arrondi du chronomètre, semaine type ; CSV ; sauvegarde JSON ; sur téléphone ; compte.

## Risques et limites

- Pas un logiciel de facturation ni de comptabilité : aucune facture émise, aucun lien bancaire, aucune
  intégration d'agenda (règle « aucune automatisation ni lien externe »).
- Les montants sont hors taxes et saisis par l'utilisateur ; aucun conseil tarifaire.
- RGPD : noms de clients saisis par l'utilisateur, hébergés avec ses données (même régime que les autres
  templates).
