# T54 · Séminaire / offsite

Slug `seminaire`, préfixe `SMN` (clés locales `qme-smn-*`, règles `window.SMN`), prix 35 € (fixé par
l'orchestrateur, **à confirmer par Quentin**), permalien Gumroad proposé `seminaire-offsite`, catégorie Gumroad
`business-and-money` (**à vérifier**), taille M, priorité P3. Catalogue : `data-pour="pro"`, thème « Associations, formation et
événements » (`associations-formation-et-evenements`, `--c:var(--rouge)`, avec le pilote événementiel).
Origine : backlog de Quentin n° 31 (« variante de ID 27 ») ; ligne T54 de `IDEES.md` : « Participants, transports,
chambres, régimes, programme, budget | à définir (reprend T51) | Déclinaison de T51. **RGPD** : régimes alimentaires et
allergies sont des données sensibles. » Fiche rédigée le 14/11/2026 ; feu vert de Quentin pour ce lot (pas de
validation préalable), les choix à valider sont regroupés en fin de fiche. Aucune marque, aucun logiciel nommé,
aucune automatisation, aucun lien externe hors la définition CNIL.

## Distinct de T51

T51 (Pilote événementiel, `templates/evenementiel/`) sert des agences qui mènent **plusieurs événements de tout
type** pour des clients : rétroplanning, contrats et échéanciers d'acomptes, invités et badges, conducteur du jour J.
T54 sert **la personne qui organise le séminaire de son entreprise** (assistante ou assistant de direction, RH, office
manager) : ce qui manque à T51, c'est la **logistique des participants** (qui voyage par quel train ou quelle navette,
qui dort dans quelle chambre, qui manque encore), le **programme en salles parallèles** et le **coût par
participant**. Même socle et même moteur (séminaires multiples, budget prévu / engagé / payé, programme repris du
conducteur avec chevauchements par salle et décalage en cascade, rappel RGPD) ; ni rétroplanning, ni badges, ni
contrats détaillés.

## Pour qui

- **Assistants et assistantes de direction** qui organisent le séminaire annuel du comité de direction ou d'une
  équipe (20 à 150 personnes, 1 à 3 jours, souvent hors site avec nuitée).
- **RH** (séminaire d'intégration, convention interne, journée d'équipe) et **office managers** de PME et de
  start-up (offsite annuel).
- Petites **agences** qui gèrent la logistique d'un séminaire client (moins de besoins que T51).

Une clé = un espace : l'équipe d'organisation qui partage la clé voit les mêmes données sur tous ses appareils.
Aucun accès des participants (pas de formulaire d'inscription public en V1 : choix à valider).

## Écrans (5 onglets + réglages)

1. **Tableau de bord** (séminaire choisi) : compte à rebours, tuiles (participants confirmés sur invités, à loger,
   sans transport, coût engagé par participant), **alertes** triées par gravité (réponses en attente après la date
   limite, participants sans aller ou sans retour, participants à loger, chambres ou trajets surchargés, arrivée
   après le début du programme, départ avant la fin, chevauchements de salle, dépassements de budget et budget cible,
   paiements en retard ou sous 14 jours, données sensibles encore présentes après le séminaire), réponses (jauge),
   **pour le traiteur** (comptage agrégé), prochains paiements, autres séminaires.
2. **Participants** : rappel RGPD permanent ; tuiles (invités, oui, en attente, non) ; liste filtrable (réponse,
   service, recherche) avec réponse en un geste et, pour chacun, aller, retour et chambre ; saisie rapide (un par
   ligne « Prénom Nom ; Service ; e-mail ») ; export CSV (données sensibles exclues par défaut) ; fiche participant.
3. **Logistique** (deux volets) :
   - **Transports** : trajets aller et retour (mode, départ, arrivée, date, heures, places, référence) ; pour chaque
     trajet, passagers (qui voyage avec qui) et occupation ; participants sans aller ou sans retour ; « par ses
     propres moyens » ; contrôle des horaires par rapport au programme ;
   - **Hébergement** : chambres (hébergement, numéro ou nom, type, capacité), occupants, places libres,
     capacité totale face aux personnes à loger ; **répartition automatique** des confirmés sans chambre (par
     service, puis par nom) ; liste à transmettre à l'hôtel (impression).
4. **Programme** : sessions par jour (heure, durée, fin calculée, type, salle, animateur), sessions parallèles en
   salles différentes, **chevauchement** signalé dans une même salle, **décalage en cascade**, session en cours le
   jour même ; programme type d'un ou deux jours ; impression du programme ; **fiche traiteur** (repas du programme
   avec couverts et régimes comptés, sans aucun nom).
5. **Budget** : tuiles prévu, engagé, payé, reste à payer ; **coût par participant** (prévu et engagé, divisé par les
   confirmés) ; postes (prévu saisi) et dépenses (fournisseur, objet, montant, statut, payé, échéance) ; barres par
   poste ; prochains paiements.

Réglages : nom de l'entreprise ou du service, convention HT / TTC (libellé), **données sensibles** (rappel, effacement
des régimes, allergies et besoins d'accessibilité du séminaire choisi), copie JSON et restauration, base intégrée,
compte, « Sur téléphone ».

Premier lancement : nom de l'entreprise (facultatif) et convention, puis premier séminaire (nom, date, nombre de
jours, lieu, ville de départ, date limite de réponse, budget cible) avec les éléments de base à ajouter (programme
type, postes de budget types).

## RGPD (exigence de Quentin)

Régimes alimentaires et allergies sont des **données sensibles** (un régime peut révéler une conviction religieuse,
une allergie relève de la santé ; CNIL, « Donnée sensible »). Choix retenus :

- **Saisie facultative** : par défaut « Non renseigné » ; aucune case n'est obligatoire.
- **Aucune donnée de santé détaillée** : aucun champ libre médical. Le régime est une **liste fermée** de préférences
  (sans restriction, végétarien, végétalien, sans porc, sans alcool). Pour les allergies et intolérances, une seule
  **case sans détail** « Allergie ou intolérance à signaler au traiteur » : le détail est échangé directement entre le
  participant et le traiteur, jamais saisi dans l'outil. Même principe pour l'accessibilité : case « Besoin
  d'accessibilité (chambre, accès) » sans précision. « Sans gluten » n'est pas proposé (intolérance = santé : passe
  par la case allergie).
- **Mention explicite** à côté de la saisie (fiche participant), en tête de l'onglet Participants et dans les
  réglages : ne collecter qu'avec l'accord explicite du participant et si c'est utile, partager la clé avec l'équipe
  d'organisation seulement, effacer après le séminaire. Outil d'aide, pas un conseil juridique.
- **Comptage agrégé pour le traiteur** : tableau de bord et fiche traiteur ne donnent que des nombres (couverts,
  régimes, nombre d'allergies à signaler), **jamais de noms**. La fiche traiteur rappelle que les personnes concernées
  contactent elles-mêmes le traiteur.
- **Effacement** : bouton « Effacer régimes, allergies et accessibilité de ce séminaire » (Réglages) ; alerte au
  tableau de bord tant que des données sensibles restent sur un séminaire terminé.
- **Export** : CSV des participants sans données sensibles par défaut (case à cocher pour les inclure, avec rappel) ;
  copie JSON complète dans les réglages (droit d'accès et de portabilité).
- Démo entièrement fictive (noms inventés, entreprise « Maison Tilleul (exemple) »).

## Saisie

- Séminaire : nom, date du premier jour, nombre de jours (1 à 7), lieu, ville de départ (facultative), date limite
  de réponse (facultative), budget cible (facultatif), notes.
- Participant : prénom, nom, service, e-mail professionnel (facultatif), rôle (participant, intervenant,
  organisation), réponse (en attente, oui, non), hébergement nécessaire (oui par défaut si le séminaire a des nuits),
  aller et retour (trajet, « par ses propres moyens » ou non affecté), chambre ; régime (liste fermée, facultatif) ;
  case allergie ; case accessibilité ; note (non sensible, rappel affiché).
- Trajet : sens (aller, retour), mode (train, avion, car ou navette, voiture ou covoiturage, autre), départ, arrivée,
  date, heure de départ, heure d'arrivée, places (facultatif), référence en texte (n° de réservation, dossier).
- Chambre : hébergement (nom de l'hôtel ou du lieu), numéro ou nom, type (individuelle, double, twin, triple,
  quadruple), capacité (1 à 6, préremplie selon le type), note.
- Session : jour, heure, durée en minutes, intitulé, type (plénière, atelier, repas, pause, activité, transfert,
  temps libre), salle, animateur, note.
- Poste : nom, prévu. Dépense : fournisseur, objet, poste, montant, statut (devis, engagée, annulée), déjà payé,
  prochaine échéance (date).
- Montants à la française (`1 250`, `1 250,50 €`) en **centimes entiers** ; convention HT / TTC en simple libellé.

## Mécanique clé

- **Séminaire** : fin = début + nombre de jours − 1 ; nuits = nombre de jours − 1 ; compte à rebours (J-n, Jour 1…,
  Terminé).
- **Réponses** : oui, non, en attente ; taux de réponse = (oui + non) / invités ; relance si la date limite est passée
  et des réponses manquent.
- **Concernés** (transport, hébergement, repas) = participants **oui + en attente** (on prévoit pour eux) ; un « non »
  est retiré de tout (trajet, chambre) à la saisie de la réponse.
- **Traiteur** : couverts à prévoir = oui + en attente (dont en attente indiqué) ; régimes comptés sur ces couverts,
  « Non renseigné » compté comme « sans restriction » ; nombre d'allergies et de besoins d'accessibilité à signaler ;
  par repas du programme, les mêmes nombres (tous les participants présents sur toute la durée en V1).
- **Transports** : occupation d'un trajet = participants concernés qui l'ont pour aller ou retour ; surcharge si
  places > 0 et occupation > places ; « sans aller » / « sans retour » = concernés sans trajet ni « propres moyens ».
  **Horaires** : un aller qui arrive après le début de la première session du jour d'arrivée (ou le jour du séminaire
  passé) est signalé ; un retour qui part avant la fin de la dernière session du dernier jour aussi.
- **Hébergement** : à loger = concernés avec hébergement nécessaire et sans chambre (si le séminaire a au moins une
  nuit) ; occupation, places libres, surcharge par chambre ; capacité totale face aux personnes à loger.
  **Répartition automatique** : les confirmés (oui) à loger, triés par service puis nom, remplissent les places
  libres : d'abord une chambre déjà occupée par un collègue du même service, puis une chambre vide, puis toute
  place restante ; les « en attente » ne sont pas placés ; renvoie ceux qui restent sans place.
- **Programme** : fin = début + durée ; tri (jour, heure) ; chevauchement si une session commence avant la fin d'une
  autre du même jour **dans la même salle** (sessions sans salle comparées entre elles) ; décalage en cascade de la
  session choisie et des suivantes du jour (refus de dépasser minuit) ; session en cours et suivante.
- **Budget** : engagé = montant des dépenses « engagée » ; payé = somme des montants déjà payés (même d'une dépense
  annulée : un acompte versé reste versé) ; reste à payer = max(engagé, payé) − payé ; écart = engagé − prévu,
  dépassement si prévu > 0 et écart > 0 ; dépenses sans poste en « Non affecté ». **Coût par participant** = total
  prévu et total engagé divisés par le nombre de confirmés (oui), arrondi au centime ; rien si aucun confirmé.
- **Paiements** : dépense engagée avec reste à payer et échéance : retard si passée, proche à 14 jours ou moins.

## Base intégrée (rédigée pour le produit, aucune source externe)

- Modes de transport (6), types de chambre (5, capacité par défaut), types de session (7, couleurs fixes).
- Régimes : liste fermée de 5 préférences + « Non renseigné ».
- Rôles : participant, intervenant, organisation.
- **Programmes types** (horaires d'exemple, à adapter) : journée d'équipe (1 jour) et séminaire de deux jours avec
  nuitée (accueil, plénières, ateliers en parallèle, repas, activité de cohésion, dîner, restitution, clôture).
- **Postes de budget types** (12, **sans montant**) : lieu et salles, hébergement, restauration, boissons,
  transports, activités et cohésion, intervenants et animation, technique (son, vidéo), kits et cadeaux participants,
  assurance, communication, imprévus.

## Calculs à vérifier à la main (tests)

Fin et nuits d'un séminaire ; compte à rebours ; statistiques et traiteur (non renseigné compté sans restriction,
« non » exclus, aucun nom dans la fiche) ; transports (occupation, surcharge, sans aller / retour, propres moyens,
non exclus) ; horaires d'arrivée et de départ face au programme ; hébergement (à loger, sans nuit, surcharge, places)
et répartition (même service d'abord, puis chambres vides, en attente exclus, restants) ; programme (fin, chevauchement par
salle, salles parallèles sans alerte, décalage et refus après minuit) ; budget et coût par participant ; paiements ;
alertes (relance après date limite, sensible après séminaire) ; effacement des données sensibles ; CSV (BOM,
échappement, sensibles exclus par défaut) ; saisie rapide ; montants.

## Sources

- **CNIL**, « Donnée sensible » (définition) : https://www.cnil.fr/fr/definition/donnee-sensible, reprise du pilote
  événementiel (consultée le 13/11/2026 pour T51 ; **non relue pour T54**). Aucune autre donnée réglementaire ou
  chiffrée.
- Programmes types, postes, listes : rédigés pour le template (aucune base externe, aucune licence).

## Risques

- **RGPD** : voir ci-dessus (données de tiers, données sensibles réduites au minimum, agrégées, effaçables).
- **Argent** : outil de suivi ; les montants sont ceux saisis, les devis et factures font foi.
- **Daté** : rien (aucun barème, aucun tarif, aucun horaire de transporteur).
- Programmes types présentés comme des exemples.

## Choix d'implémentation

- Copie du socle du pilote événementiel (connexion, démo, synchronisation, modales, toast, popup « Comme une
  application », charte Pastel) ; règles pures dans `templates/seminaire/regles.js` (`window.SMN`), paramétrées par la
  date du jour ; tests `outils/templates/seminaire.test.mjs` à dates fixes.
- Plusieurs séminaires par clé (sélecteur en tête de chaque vue), séminaire courant mémorisé sur l'appareil.
- Affectations portées par le participant (`allerId`, `retourId`, `chambreId`) : un participant ne peut pas être dans
  deux chambres ; un « non » libère sa place.
- Impression (programme, chambres) par feuille de style `@media print`, sans bibliothèque. Export CSV
  (point-virgule, BOM UTF-8).
- Tutoiement dans l'application ; aucun nom de marque (ni transporteur, ni hôtel réel) ; exemples fictifs.

## À faire valider par Quentin

- Prix 35 €, nom « Séminaire / offsite » (titre de l'application : « Séminaire et offsite »), permalien
  `seminaire-offsite`, catégorie Gumroad `business-and-money` (à vérifier).
- Thème du catalogue « Associations, formation et événements » (avec T51) ; rattachement aux packs (Associations,
  ou un futur pack événements / office manager) laissé à l'orchestrateur.
- Choix RGPD : liste fermée de 5 régimes (« sans porc » gardé comme dans T51, alors qu'il peut révéler une
  conviction : à confirmer), case allergie et case accessibilité **sans détail**, « sans gluten » non proposé.
- Tous les participants présents sur toute la durée (pas de présence par jour en V1) ; « en attente » compté dans les
  couverts et les transports, mais pas placé automatiquement en chambre.
- Pas de formulaire d'inscription pour les participants (l'équipe saisit les réponses) ; pas de mixité contrôlée dans
  les chambres (aucune donnée de genre collectée : la répartition automatique se fait par service, l'organisateur
  ajuste).
- Ni rétroplanning ni badges (renvoi vers T51 pour ceux qui en ont besoin).
