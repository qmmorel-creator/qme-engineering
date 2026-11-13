# T29 · Gestion de flotte de véhicules

Slug `flotte`, préfixe `VHC`, prix 39 €, permalien Gumroad `gestion-flotte`. Taille M, P1.
Origine : documents de travail de Quentin (12/11/2026) et backlog n° 37 « Flotte d'entreprise »
fusionné (sinistres, amendes, location longue durée, coût total par véhicule). Base commune prévue avec
T57 (auto-école) et T10 (entretien perso). Marques de risque : **daté** (contrôle technique),
**RGPD** (conducteurs, amendes). Aucune marque de véhicule ni de loueur, nulle part.

## Pour qui

- **PME de 3 à 50 véhicules** (artisans du bâtiment, réseaux de techniciens, commerciaux itinérants,
  entreprises de services à domicile) où la flotte est gérée « à côté » par l'assistante de direction,
  le responsable des services généraux ou le dirigeant.
- **Collectivités et établissements publics** (communes, communautés de communes, syndicats, centres
  sociaux) : véhicules de service partagés entre agents, réservés à la journée ou à la demi-journée.
- **Associations** avec quelques véhicules de service (portage de repas, transport solidaire).

Aujourd'hui : un tableur par sujet (réservations, entretiens, amendes), un agenda papier ou partagé
pour les clés, les échéances découvertes au dernier moment (contrôle technique dépassé, entretien
oublié, kilométrage de location longue durée dépassé en fin de contrat).

## Écrans (5 onglets + guide et réglages)

- **Bord** (accueil) : tuiles (véhicules actifs, échéances dépassées, à venir, sorties du jour),
  liste unique des **alertes** triées par urgence : entretien dû (km ou date), contrôle technique ou
  contrôle complémentaire pollution, contre-visite, location longue durée en dépassement projeté,
  amende à désigner, sinistre ouvert, relevé kilométrique ancien. Chaque alerte ouvre la fiche concernée.
  Réservations du jour.
- **Véhicules** : cartes (immatriculation, libellé, type, énergie, kilométrage, prochaine échéance) ;
  actions rapides « Relevé km » et « Entretien fait ». **Fiche véhicule** : identité, kilométrage et
  rythme, plan d'entretien avec échéances, contrôles techniques, contrat de location longue durée,
  sinistres, amendes, dépenses, coût total et coût au km.
- **Réservations** : planning de la semaine (une ligne par véhicule, une colonne par jour), navigation
  semaine précédente / suivante, liste des prochaines sorties, conducteurs. Une réservation qui chevauche
  une autre sur le même véhicule (ou pour le même conducteur) est **refusée** avec le créneau en conflit.
  Retour de véhicule : saisie du kilométrage de retour (crée le relevé).
- **Incidents** : sinistres (date, véhicule, conducteur, responsabilité, statut, coût resté à charge)
  et amendes (date de l'avis, véhicule, conducteur désigné, statut, échéance de désignation).
- **Coûts** : par véhicule, coût total depuis l'entrée dans la flotte, détail par poste (loyers ou
  amortissement, énergie, entretien, contrôles, assurance, sinistres, autres), kilomètres parcourus,
  coût au km ; graphique en barres du coût au km ; saisie des dépenses ; export CSV.
- **Guide** (bouton de la barre) : périodicités du contrôle technique avec sources et dates, intervalles
  d'entretien indicatifs, désignation du conducteur, rappel RGPD, limites.
- **Réglages** (modale) : nom de la structure, fenêtres d'alerte (jours, km), périodicités du contrôle
  technique (modifiables), délai de désignation, export CSV, copie JSON, restauration, déconnexion.

## Saisie

- **Véhicule** : immatriculation (texte libre, majuscules), libellé (« Utilitaire atelier »), type
  (voiture particulière M1, camionnette N1, autre), énergie (essence, diesel, hybride, hybride
  rechargeable, électrique, GPL, GNV, hydrogène, autre), date de 1re mise en circulation, date d'entrée
  dans la flotte, kilométrage à l'entrée, mode de détention (achat ou location longue durée), prix
  d'achat et durée d'amortissement prévue (facultatif), date du dernier contrôle technique connu
  (facultatif), notes. Le **plan d'entretien** est proposé depuis la base selon l'énergie, puis modifiable.
- **Contrat de location longue durée** : début, durée en mois, kilométrage contractuel total, loyer
  mensuel, prix du km supplémentaire (lu sur le contrat), kilométrage au début.
- **Relevé kilométrique** : date, km (refusé s'il est inférieur à un relevé antérieur ou supérieur à un
  relevé postérieur).
- **Entretien réalisé** : date, km, opérations du plan cochées, prestataire, coût, note.
- **Contrôle technique** : date, nature (périodique, complémentaire pollution, contre-visite), résultat
  (favorable ; contre-visite à faire avant une date saisie), centre, coût.
- **Réservation** : véhicule, conducteur, début et fin (date et heure), motif ; clôture avec km de retour.
- **Conducteur** : nom, service ou fonction, date de dernière vérification du permis (facultatif).
- **Sinistre** : date, véhicule, conducteur, description, responsabilité, statut, coût resté à charge.
- **Amende** : date de l'infraction, date de l'avis, véhicule, nature (texte court), montant, conducteur
  (proposé d'après la réservation qui couvre la date), statut (à désigner, désignée, payée, contestée).
- **Dépense** : véhicule, date, poste, montant, libellé.

## Mécanique clé (fonctions pures, `regles.js`)

1. **Kilométrage actuel** = plus grand relevé (relevés, entretiens, retours de réservation, entrée).
   **Rythme** = km/jour entre le plus ancien et le plus récent relevé des 365 derniers jours.
2. **Échéance d'entretien** (par opération du plan) : référence = dernier entretien qui contient
   l'opération, sinon date et km d'entrée du véhicule ; échéance km = référence + intervalle km,
   échéance date = référence + intervalle en mois (fin de mois bornée) ; **la première atteinte
   compte**. État : `retard` (km atteint ou date passée), `proche` (dans la fenêtre d'alerte en km ou en
   jours), `ok`. Date estimée d'atteinte du km d'après le rythme.
3. **Contrôle technique** : premier contrôle avant le 4e anniversaire de la 1re mise en circulation
   (échéance = mise en circulation + 48 mois − 1 jour) ; ensuite dernier contrôle périodique favorable
   + 24 mois − 1 jour. Contre-visite : date limite saisie. **Contrôle complémentaire pollution** pour les
   camionnettes N1 non exemptées par l'énergie : dernier contrôle périodique + 12 mois − 1 jour.
   Périodicités en réglages (modifiables), source et date affichées.
4. **Réservations** : intervalle [début, fin[ ; conflit si même véhicule (ou même conducteur) et
   intervalles qui se chevauchent ; une réservation qui finit à 10 h et une qui commence à 10 h ne sont
   pas en conflit. Fin ≤ début refusée.
5. **Location longue durée** : km parcourus depuis le début, km autorisés au prorata du temps,
   projection en fin de contrat = parcourus + rythme × jours restants, dépassement projeté et son coût
   (× prix du km supplémentaire saisi). Loyers échus = mois commencés depuis le début, bornés à la durée.
6. **Coût total** = loyers échus (ou amortissement linéaire du prix d'achat sur la durée prévue, au
   prorata des mois écoulés) + dépenses + entretiens + contrôles + coût resté à charge des sinistres ;
   les amendes sont listées à part (en principe à la charge du conducteur désigné). **Coût au km** =
   coût total / km parcourus depuis l'entrée (rien si moins de 1 km).
7. **Amende** : échéance de désignation = date de l'avis + délai réglé (45 jours par défaut, voir
   Sources) ; alerte si statut « à désigner ».
8. **Alertes** : agrégées et triées (retard d'abord, puis par date), relevé kilométrique de plus de
   30 jours signalé (réglable).
9. **Export CSV** : synthèse par véhicule (échéances, km, coût total, coût au km) et journal des coûts ;
   point-virgule, BOM UTF-8, formules neutralisées.

## Base intégrée (`donnees.js`)

- **Types** : voiture particulière (M1), camionnette (N1), autre (périodicité saisie par l'utilisateur).
- **Énergies** avec indicateur d'exemption du contrôle complémentaire pollution (électricité, hydrogène,
  hybrides hydrogène-électrique, air comprimé, gazogène d'après service-public.gouv.fr F33353).
- **Contrôle technique** : 48 mois / 24 mois / complémentaire 12 mois, source et date (voir Sources).
- **Plan d'entretien indicatif** (10 opérations, intervalles en km et en mois, applicables selon
  l'énergie) : révision constructeur, vidange et filtre à huile, filtre à air, filtre d'habitacle,
  liquide de frein, contrôle des freins, pneumatiques, liquide de refroidissement, distribution
  (courroie, très variable), climatisation, batterie 12 V. Présentés comme **ordres de grandeur
  indicatifs** : « le carnet d'entretien du constructeur fait foi », à adapter à la création du véhicule.
  Ce ne sont pas des données réglementaires ni issues d'une base externe.
- **Postes de dépenses** : énergie (carburant, recharge), assurance, péages et stationnement, lavage,
  pneumatiques, réparations hors entretien, autre.

## Sources (consultées le 13/11/2026)

- **Contrôle technique d'une voiture (catégorie M1)**, service-public.gouv.fr, fiche F2878, vérifiée le
  1er janvier 2026 : 1er contrôle dans les 6 mois avant le 4e anniversaire de la 1re mise en circulation ;
  résultat favorable valable 2 ans.
- **Contrôle technique d'une camionnette (catégorie N1)**, service-public.gouv.fr, fiche F33353, vérifiée
  le 1er janvier 2026 : mêmes délais ; contrôle complémentaire pollution dans les 2 mois précédant la fin
  d'un délai d'un an après chaque contrôle périodique ; énergies exemptées.
- **Article L121-6 du Code de la route** (Légifrance, version en vigueur depuis le 31 décembre 2025) :
  le représentant légal d'une personne morale désigne le conducteur dans un délai de 45 jours à compter
  de l'envoi ou de la remise de l'avis de contravention. Montants des amendes : non repris (non vérifiés).
- **Article 10 du RGPD** : données relatives aux infractions, traitement encadré. Rappel dans l'application.
- Intervalles d'entretien : indicatifs, rédigés pour le produit (aucune base externe, pas de licence).

## Risques

- **daté** : périodicités du contrôle technique et délai de désignation modifiables dans les réglages,
  source et date de vérification affichées ; contre-visite : date saisie (pas de délai calculé).
- **RGPD** : conducteurs (nom, service, date de vérification du permis) et amendes (données
  d'infraction) ; rappel dans la modale conducteur, la modale amende et le Guide : ne saisir que le
  nécessaire, informer les conducteurs, limiter la conservation, ne pas noter de points de permis ni de
  données de santé. Démo : prénoms fictifs et initiale.
- **Entretien** : intervalles indicatifs ; le carnet du constructeur fait foi (avertissement dans la
  modale véhicule, la fiche et le Guide).
- **Pas de conseil juridique ni comptable** : coûts tels que saisis (HT ou TTC, au choix, à garder
  cohérent) ; amortissement linéaire de gestion, pas comptable.

## Choix d'implémentation (V1)

- Socle de `templates/revision/` (structure reprise de `templates/reserves/`), règles pures dans
  `regles.js` (`window.REGLES`), testées par `outils/templates/flotte.test.mjs` avec une date de
  référence fixe.
- Immatriculations de la démo fictives (format SIV avec lettres « QA », « QB »…), libellés génériques
  (« Citadine du siège », « Fourgon atelier »), prénoms fictifs.
- Pas de géolocalisation, pas de pièces jointes (cartes grises, avis) : le service ne stocke que du JSON
  (≈ 900 Ko par compte, plusieurs années pour 30 véhicules).
- Un compte = une clé : pas de comptes conducteurs séparés ; les conducteurs ne réservent pas eux-mêmes.
- Graphique des coûts : barres empilées HTML aux couleurs de la charte (bleu, jaune, rouge, encre).
  Le validateur `dataviz` signale lightness et chroma (encre) hors bande et un contraste faible du
  jaune : séparation daltonisme conforme ; compensé par un contour encre et un écart de 2 px par
  segment, la légende, les montants affichés, une infobulle et un tableau accessible.
- Démo : 6 véhicules (achat et location, thermiques, hybride, électriques, une camionnette N1),
  états couverts : entretien en retard, dépassement de location, contre-visite et pollution à venir,
  amende à désigner, sinistre en cours, relevé ancien, retour à saisir, réservations du jour.
- Montants des amendes non renseignés dans la démo (aucun barème vérifié repris).
