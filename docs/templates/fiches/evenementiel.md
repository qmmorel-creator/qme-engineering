# T51 · Pilote événementiel

Slug `evenementiel`, préfixe `EVT`, prix 49 €, permalien Gumroad `pilote-evenementiel`. Taille L, P1.
Origine : backlog de Quentin n° 27 « Pilote événementiel complet » (ligne T51 de `IDEES.md` : rétroplanning,
budget prévu / engagé / payé, prestataires et contrats, invités, checklist jour J ; **RGPD** invités).
Format retenu : application web (socle commun) ; le modèle tableur complémentaire prévu au backlog
n'est pas fait (export CSV des invités à la place, voir « Choix d'implémentation »).

**Distinct de T15** (Organisateur de mariage, `templates/mariage/`) : T15 sert des particuliers qui
organisent **un seul** mariage. T51 sert des **professionnels** qui pilotent **plusieurs événements en
parallèle** pour des clients ou pour leur entreprise : responsables par tâche, contrats et échéanciers
d'acomptes par prestataire, catégories d'invités professionnelles, badges, conducteur minute par minute,
tableau de bord multi-événements. **T54** (séminaire / offsite : transports, chambres) reste une
déclinaison à part.

## Pour qui

- **Agences événementielles** de petite taille (chefs de projet qui mènent 3 à 10 événements à la fois)
  qui jonglent entre un tableur de rétroplanning par client, un tableur de budget, des devis dans les
  e-mails et une liste d'invités exportée d'un formulaire.
- **Chargés de communication et d'événementiel en entreprise** (séminaire annuel, présence sur un salon,
  soirée de lancement, convention clients).
- **Indépendants** (régisseurs, organisateurs free-lance) qui veulent un outil présentable au client.

Une clé = un espace : toute l'équipe qui partage la clé voit les mêmes données sur tous ses appareils
(pas de droits par utilisateur en V1 ; le responsable d'une tâche est un nom saisi, pas un compte).

## Écrans (5 onglets + réglages)

1. **Tableau de bord** (multi-événements) : une carte par événement à venir (compte à rebours J-n, lieu,
   client, avancement du rétroplanning, tâches en retard, budget engagé par rapport au prévu, invités
   confirmés) ; alertes transverses : tâches en retard tous événements confondus, échéances de paiement en
   retard ou dans les 14 jours, dépassements de budget ; charge par responsable (tâches ouvertes et en
   retard) ; événements passés repliés. Bouton « Nouvel événement ».
2. **Rétroplanning** (événement choisi) : tâches rangées par période avant l'événement (6 mois et plus,
   3 à 6 mois, 1 à 3 mois, dernier mois, dernière semaine, jour J, après) ; échéance **calculée depuis la
   date de l'événement** (« J-45 ») ou date fixe ; responsable ; statut (faite, en retard de n jours,
   cette semaine, à venir) ; filtres : à faire / tout, responsable ; cocher une tâche ; ajout, modification,
   suppression avec « Annuler » ; « Appliquer un rétroplanning type » à tout moment.
3. **Budget** : tuiles prévu, engagé, payé, reste à payer ; tableau par poste (prévu, engagé, payé, reste,
   écart) avec dépassements ; graphique en barres par poste ; **contrats** par prestataire (objet, poste,
   montant, statut, documents référencés en texte, échéancier d'acomptes) ; **échéancier** de l'événement
   (paiements à venir, en retard, payés) ; **carnet des prestataires** commun à tous les événements
   (nom, métier, contact, téléphone, e-mail, notes).
4. **Invités** : liste filtrable (catégorie, réponse, recherche) ; compteurs par réponse et par
   catégorie ; régimes et besoins d'accessibilité **comptés** pour le traiteur et le lieu ; pointage à
   l'accueil le jour J (présent) ; saisie rapide de plusieurs invités d'un coup (un par ligne
   « Prénom Nom ; Société ») ; **badges imprimables** (8 par page A4, bande de la couleur de la catégorie) ;
   export CSV de la liste d'accueil ; rappel RGPD permanent.
5. **Jour J** : **conducteur** minute par minute (heure de début, durée, fin calculée, séquence, lieu ou
   espace, responsable, notes) avec chevauchements signalés et **décalage en cascade** (« décaler cette
   séquence et les suivantes de N minutes ») ; séquence en cours et suivante le jour même ; **checklist**
   du jour J (heure facultative, responsable, case à cocher) ; impression du conducteur.

Réglages : nom de la structure, export / import JSON, effacement des données sensibles d'un événement,
sources, déconnexion.

Premier lancement : nom de la structure (facultatif), puis premier événement (nom, type, date, heure,
lieu, client) avec choix des éléments de base à ajouter (rétroplanning type, postes de budget, conducteur
type, checklist du jour J) ou « partir de zéro ».

## Saisie

- Montants en euros à la française (`1 250`, `1 250,50 €`, `12.5`) convertis en **centimes entiers**.
  Le template ne distingue pas HT et TTC : l'utilisateur choisit sa convention (réglage affiché « Montants
  saisis en HT / TTC », simple libellé) et la garde partout.
- Tâche : titre, phase (lieu, prestataires, communication, invités, logistique, contenu, jour J, bilan),
  échéance « J-n » (jours avant l'événement ; négatif = après) ou date fixe, responsable, note.
- Contrat : prestataire, poste, objet, montant, statut (consulté, devis reçu, signé, annulé), documents
  (texte libre : « Devis D-2026-14 du 03/10, contrat signé dans le dossier client »), échéances
  (libellé, montant, date, payée le). Aide : découper le montant en acompte + solde selon un pourcentage
  **saisi par l'utilisateur** (aucun pourcentage proposé par défaut).
- Invité : prénom, nom, société, fonction, e-mail, catégorie, réponse, régime, besoin d'accessibilité
  (texte libre), présent.
- Séquence du conducteur : heure `HH:MM`, durée en minutes, intitulé, lieu, responsable, notes.

## Mécanique clé

- **Échéance d'une tâche** = date fixe si elle existe, sinon date de l'événement − `avant` jours.
  Changer la date de l'événement décale tout le rétroplanning d'un coup.
- **Statut** à une date de référence : `faite` (date de réalisation enregistrée), `retard` (échéance
  passée), `semaine` (échéance dans les 7 jours), `avenir`. Retard en jours = aujourd'hui − échéance.
- **Période** = nombre de jours entre l'échéance et l'événement : ≥ 180, ≥ 90, ≥ 30, ≥ 8, ≥ 1, 0, < 0.
- **Appliquer un rétroplanning type** à un événement proche : les tâches dont l'échéance serait déjà
  passée sont, au choix, gardées (en retard), ramenées à aujourd'hui (date fixe) ou ignorées (défaut :
  ramenées à aujourd'hui). Les tâches déjà présentes du même titre ne sont pas dupliquées.
- **Budget par poste** : prévu (saisi) ; engagé = somme des montants des contrats **signés** du poste ;
  payé = somme des échéances payées des contrats du poste (même annulés : un acompte versé reste versé) ;
  reste à payer = max(engagé, payé) − payé ; écart = engagé − prévu, dépassement si > 0 et prévu > 0.
  Contrats sans poste regroupés dans « Non affecté ». Budget cible facultatif de l'événement comparé au
  total prévu.
- **Contrat** : échéances planifiées vs montant (« reste à planifier » signalé si un contrat signé n'a pas
  un échéancier égal à son montant). Découpage en centimes, le reste de l'arrondi sur la dernière échéance.
- **Échéancier** : échéances non payées triées par date ; `retard` si la date est passée, `proche` à
  14 jours ou moins.
- **Invités** : comptes par réponse et par catégorie ; couverts à prévoir = oui + en attente ; régimes
  comptés sur ces couverts ; besoins d'accessibilité listés ; taux de présence = présents / oui.
- **Conducteur** : fin = début + durée ; tri par heure ; **chevauchement** si une séquence commence avant
  la fin de la précédente dans le même lieu (ou sans lieu) ; décalage en cascade de N minutes de la
  séquence choisie et de toutes celles qui commencent à la même heure ou après ; refus de dépasser minuit.
- **Tableau de bord** : avancement = tâches faites / tâches ; alertes triées par gravité puis date.

## Base intégrée (rédigée pour le produit, aucune source externe)

- **Rétroplannings types** (échéances relatives, délais d'organisation **indicatifs**, jamais présentés
  comme des obligations) :
  - **Séminaire d'entreprise** (24 tâches, de J-120 à J+7) ;
  - **Salon professionnel, côté exposant** (26 tâches, de J-180 à J+14) ;
  - **Soirée de lancement** (24 tâches, de J-90 à J+7).
- **Conducteurs types** (séquences et durées d'exemple, horaires à adapter) pour les trois types.
- **Checklist du jour J** commune (20 points : badges, signalétique, liste d'accueil, kit de secours,
  contacts des prestataires, test technique, etc.).
- **Postes de budget types** (20, **sans aucun montant**) : lieu, restauration, boissons, hébergement,
  transports, technique son et lumière, captation, scénographie, mobilier, stand, signalétique et
  impressions, cadeaux, animation et intervenants, personnel d'accueil, sécurité, assurance,
  communication, photo et vidéo, frais d'exposant, imprévus.
- **Catégories d'invités** : client, prospect, partenaire, presse, intervenant, collaborateur, VIP
  (couleurs fixes de la charte).
- **Régimes** : sans restriction, végétarien, végétalien, sans porc, sans alcool, autre.
- **Statuts de contrat** : consulté, devis reçu, signé, annulé.

## Calculs à vérifier à la main (tests)

Échéance J-45 d'un événement au 15/03/2027 = 29/01/2027 ; décalage d'événement ; statut et retard ;
période ; application d'un modèle avec tâches passées (3 options) ; budget par poste (contrat signé,
devis non signé ignoré, acompte payé d'un contrat annulé compté) ; découpage 30 % de 10 000,01 € ;
échéancier (retard, proche) ; invités et régimes ; conducteur (fin, chevauchement, décalage en cascade,
refus après minuit) ; lecture des montants ; badges (pages de 8) ; CSV (échappement, BOM).

## Sources

- **CNIL**, « Donnée sensible » (définition) : https://www.cnil.fr/fr/definition/donnee-sensible
  (consultée le 13/11/2026) : catégories (santé, convictions religieuses…), interdiction de principe et
  exceptions dont le consentement explicite. Utilisée pour le rappel RGPD (régimes, allergies, besoins
  d'accessibilité). Aucune autre donnée réglementaire ou chiffrée dans le template.
- Rétroplannings, conducteurs, checklist, postes : rédigés pour le template (aucune base externe, aucune
  licence à vérifier).

## Risques

- **RGPD** : données personnelles d'invités (tiers) ; régimes (un régime peut révéler une conviction
  religieuse), allergies et besoins d'accessibilité (santé, handicap) = **données sensibles**. Rappel dans
  l'application (onglet Invités, fiche invité, réglages) : ne collecter que le nécessaire, avec l'accord
  explicite de l'invité, ne partager la clé qu'avec l'équipe d'organisation, effacer après l'événement
  (bouton « Effacer régimes et accessibilité de cet événement »). Outil d'aide, pas un conseil juridique.
- **Argent** : outil de suivi ; les montants sont ceux saisis, les contrats et factures font foi.
- **Daté** : rien (aucun barème, aucun taux).
- Délais des rétroplanning types présentés comme indicatifs.

## Choix d'implémentation

- Règles pures dans `templates/evenementiel/regles.js` (`window.EVT`), toutes paramétrées par une date de
  référence ; tests `outils/templates/evenementiel.test.mjs` à dates fixes.
- Prestataires dans un carnet commun, contrats rattachés à un événement : un même traiteur peut servir
  plusieurs événements.
- Événement courant mémorisé sur l'appareil (préférence d'affichage, pas une donnée synchronisée).
- Badges et conducteur imprimés avec une feuille de style d'impression (`@media print`), sans
  bibliothèque. Format des badges : 8 par page A4 (2 × 4), choix de mise en page du template.
- Export CSV des invités (séparateur point-virgule, BOM UTF-8) à la place du modèle tableur.
- Le tutoiement s'applique dans l'application ; aucun nom de marque, exemples fictifs.
