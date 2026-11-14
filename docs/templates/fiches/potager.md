# T18 · Calendrier du potager

Slug `potager`, préfixe `PTG` (clés locales `qme-ptg-*`, règles `window.PTG`), prix prévu 13 € (**à confirmer par
Quentin** ; minimum 12 € fixé le 13/11/2026), permalien Gumroad proposé `calendrier-potager`, catégorie Gumroad
`self-improvement` ou `other` (à vérifier : Gumroad n'a pas de catégorie Jardin connue), taille M, priorité P3.
Catalogue : `data-pour="perso"`, thème « Organisation et études » (`organisation-et-etudes`, `--c:var(--encre)`),
comme repas, entretien, voiture et garde-manger (aucun thème Jardin existant ; il n'en réunirait qu'un).
Origine : liste initiale du 12/11/2026. Remarques d'`IDEES.md` : « semis selon les cultures choisies ; base : 60
légumes : semis, récolte, associations ; Source des données de culture à vérifier ». Fiche rédigée le 14/11/2026.

## Décision sur la base : aucune période ni association fournie

Règle de Quentin pour ce lot : les périodes de semis, de plantation, de récolte et les associations ne sont
intégrées que si leur source est vérifiée et citée (organisme, page, date de consultation, licence permettant la
réutilisation commerciale). Recherche faite le 14/11/2026 :

- **data.gouv.fr** : aucun jeu de données « calendrier de semis » ou « calendrier du potager » trouvé (recherche web,
  pas d'accès direct à l'API du portail depuis cette session).
- **DRAAF Auvergne-Rhône-Alpes**, « Calendrier des semis, plantations et récoltes » (PDF de 4 pages,
  `draaf.auvergne-rhone-alpes.agriculture.gouv.fr/IMG/pdf/FICHE_TECH_CALENDRIER_SEMIS_PLANTATIONS_RECOLTES-2_cle091634.pdf`,
  consulté le 14/11/2026) : seule source publique française trouvée. **Écartée** :
  - licence contradictoire : le pied de page du site indique « Sauf mention contraire, tous les contenus de ce site
    sont sous licence etalab-2.0 », mais la page « Mentions légales » du même site (mise à jour le 13/01/2026) dit
    « Tous les contenus présents sur le site sont couverts par le droit d'auteur. Toute reprise est dès lors
    conditionnée à l'accord de l'auteur », sauf documents officiels (discours, communiqués, arrêtés…) ;
  - auteur probablement tiers : métadonnées du PDF « MARAICHAGE SOLIDAIRE », créé sous PowerPoint en 2017, sans
    mention d'auteur ni de licence dans le document ;
  - contenu partiel : une trentaine de légumes, périodes dessinées en cases colorées (pas de données lisibles),
    pour une seule région.
- **Jeux de données internationaux** (calendriers de cultures FAO, JRC, DIAS sous CC BY 4.0) : grandes cultures
  (céréales), pas de légumes du potager amateur.
- Calendriers de sites commerciaux, de semenciers, de jardineries, de collectivités : aucune licence de
  réutilisation affichée ; de toute façon exclus (aucune marque tierce).

**Conséquence** : l'application ne contient **aucune période ni aucune association toute faite**. Les fenêtres
(semis sous abri, semis en pleine terre, plantation, récolte) et les associations (« bons voisins », « à éloigner »)
sont saisies par l'utilisateur, d'après ses sachets de graines, ses livres ou son expérience. L'interface le dit
(premier lancement, onglet Cultures, Réglages > À propos, page catalogue, FAQ).

La base intégrée se limite à ce qui relève de la connaissance botanique générale : **60 légumes, aromatiques et
petits fruits du potager** avec leur **nom latin** et leur **famille botanique** (noms de familles de la
classification actuelle APG IV, avec l'ancien nom courant quand il est connu : crucifères, ombellifères…), et la
liste de ces **16 familles**. Ces faits ne sont repris d'aucune source précise (pas de base de données copiée).
Ils servent à la rotation (même famille au même endroit) et à préremplir la saisie d'une culture.

## Pour qui

**Jardiniers amateurs** (potager familial, jardin partagé ou ouvrier, carrés sur une terrasse) qui notent leurs
semis sur un carnet ou une feuille, oublient quand semer quoi, et ne se souviennent plus de ce qu'il y avait sur
chaque planche l'an dernier. Aujourd'hui : carnet papier, tableur, calendrier imprimé générique qui ne correspond
ni à leur région ni à leurs variétés.

## Promesse

Ton potager, ton calendrier : tes cultures avec tes dates, ce qu'il y a à semer, planter et récolter cette semaine,
la rotation des familles sur tes planches et le bilan de tes récoltes.

## Écrans (5 onglets + réglages)

1. **Cette semaine** : surtitre jardin et date ; tuiles « À semer », « À planter », « À récolter » (cette semaine) et
   « Fenêtres passées » (21 derniers jours sans semis ni plantation notés) ; groupes « Cette semaine » (fenêtre qui
   commence, en cours, dernière semaine), « Plus tard ce mois-ci », « Fenêtres passées sans rien noter » et aperçu
   « Le mois prochain » ; chaque ligne : culture, opération (pastille de couleur), dates réelles avec le décalage,
   état « fait le … » si le journal contient l'opération dans la fenêtre, bouton « Noter » (ouvre le journal
   prérempli) ; nombre de cultures sans fenêtre saisie ; pastille sur l'onglet (cette semaine, non fait).
2. **Calendrier** : frise des 12 mois découpés en quinzaines (24 cases) pour chaque culture, une ligne par
   opération saisie, couleurs fixes (semis abri, semis pleine terre, plantation, récolte) avec motif pour la
   lecture sans couleur ; repère du jour ; filtre par opération et par famille ; impression (A4 paysage).
3. **Parcelles** : choix de l'année (de la plus ancienne saisie à l'an prochain) ; cartes de parcelles (planche,
   carré, serre, bac ou pot, autre ; surface facultative) avec les cultures de l'année ; **alertes de rotation**
   (même famille sur la même parcelle dans les N dernières années, N réglé par l'utilisateur, 1 par défaut) et
   **d'association** (deux cultures marquées « à éloigner » par l'utilisateur sur la même parcelle) ; mention des
   « bons voisins » ; historique des familles par année sous chaque parcelle ; ajout d'une culture sur une parcelle.
4. **Journal** : saisie (date, opération : semis, levée, repiquage, plantation, récolte, note ; culture ; parcelle ;
   lieu du semis ; quantité et unité pour une récolte ; note) ; liste par mois, filtre par opération ; **bilan des
   récoltes** de l'année choisie : tuiles (récoltes notées, poids total en kg, cultures récoltées, comparaison avec
   l'année précédente), barres par culture (kg), barres mensuelles avec tableau accessible, quantités en pièces et
   bottes à part.
5. **Cultures** : mes cultures (nom, variété, famille, fenêtres en clair, voisins), ajout depuis la base de 60
   légumes ou libre, modification et suppression (bloquée si la culture a un historique, sauf confirmation) ;
   familles botaniques avec leurs légumes ; rappel « aucune période fournie, pourquoi ».
6. **Réglages** (modale) : nom du jardin ; décalage en semaines (−8 à +8, saisi par l'utilisateur : « mes dates
   sont-elles en avance ou en retard sur celles de mes sachets ») ; délai de rotation (1 à 5 ans) ; exports CSV
   (cultures et fenêtres, journal, plan des parcelles) ; sauvegarde JSON et restauration ; jauge de taille et
   « Retirer le journal avant le … » ; compte ; « Sur téléphone » ; à propos.

Saisies (modales) : culture (nom avec liste de la base qui propose la famille, variété, famille, 4 fenêtres « de
la quinzaine … à la quinzaine … » à cocher, passage d'année permis pour les semis d'automne, bons voisins et à
éloigner parmi les autres cultures, note) avec **aperçu des dates réelles** cette année après décalage ; parcelle ;
placement (culture sur une parcelle une année) avec **aperçu des alertes** avant d'enregistrer ; entrée de journal.

Premier lancement en 2 étapes : présentation, 4 conseils, avertissement sur l'absence de périodes fournies ; puis
nom du jardin, nombre de planches à créer (0 à 12, renommables) et choix des cultures dans la base (cases par
famille, aucune fenêtre préremplie).

## Calculs (`regles.js`, fonctions pures testées)

- **Quinzaines** : 24 par an, q = 2 × mois + (0 pour le 1–15, 1 pour le 16–fin du mois). Fenêtre `{ de, a }`
  inclusive, **passage d'année** si `a < de` (ex. semis en novembre, récolte en mars).
- **Occurrences** d'une fenêtre pour une année : intervalles de dates réels (début de la quinzaine `de`, fin de la
  quinzaine `a`), pour les fenêtres commencées l'année précédente et l'année en cours, **décalées** de
  `décalage × 7` jours.
- **Frise** : une case est allumée si son jour médian (8 ou 23 du mois) tombe dans une occurrence décalée.
- **À faire** sur une période (semaine du lundi au dimanche, mois) : occurrences qui recoupent la période ; état
  `commence` (début dans la période), `finit` (fin dans la période), `en cours`. **Fait** : une entrée du journal de
  même culture et d'opération correspondante (semis abri, semis pleine terre, plantation ou repiquage) datée dans
  l'occurrence. Récolte : jamais « faite », on affiche la dernière récolte et le total. **Passée** : occurrence finie
  depuis 21 jours au plus, sans entrée.
- **Rotation** : pour un placement (parcelle, année), familles des placements de la même parcelle dans les
  `rotation` années précédentes ; alerte par famille commune, avec l'année et la culture en cause.
- **Associations** : paire de cultures sur la même parcelle la même année dont l'une a l'autre dans « à éloigner »
  (relation lue dans les deux sens) ; « bons voisins » de même.
- **Bilan** : récoltes de l'année, poids en kg (g convertis), pièces, bottes et litres à part ; par culture, par
  mois, comparaison du poids avec l'année précédente.
- **CSV** : séparateur point-virgule, guillemets doublés, protection contre les formules (=, +, -, @ en tête).

## Données de démonstration

Jardin fictif « Jardin des Tilleuls (fictif) », 6 parcelles (4 planches, 1 carré, 1 serre), 16 cultures dont les
fenêtres sont **saisies pour l'exemple, relatives à la date du jour** (pour montrer chaque état quel que soit le mois
d'ouverture de la démo) : fenêtre qui commence cette semaine, en cours, qui finit, faite, passée sans rien noter,
le mois prochain, passage d'année, culture sans fenêtre. Placements sur 3 années avec une alerte de rotation et une
alerte d'association, une parcelle vide cette année ; journal sur 14 mois avec récoltes chiffrées. Un bandeau
dans l'onglet Cultures rappelle que ces dates sont fictives et ne sont pas des conseils de culture.

## Risques

- **Utilisateur qui attend un calendrier tout fait** : c'est le principal risque commercial. Parades : promesse
  honnête (« ton calendrier, avec tes dates ») sur la page catalogue, la fiche Gumroad et la FAQ (« Pourquoi les
  dates ne sont-elles pas fournies ? ») ; saisie rapide d'une fenêtre (2 listes), copie depuis le sachet.
- **Démo prise pour des conseils** : mention « dates fictives » dans la démo (Cultures, Cette semaine).
- **Données personnelles** : aucune (noms de parcelles et de cultures, nom du jardin facultatif).
- **Taille** : journal qui grossit ; jauge et purge avant une date.
- **Erreur botanique** dans la base (famille d'un légume) : à relire par Quentin ; familles modifiables par
  l'utilisateur sur chaque culture.

## À valider par Quentin

Prix 13 €, nom, permalien, catégorie Gumroad ; **choix de ne fournir aucune période ni association** (et donc une
base réduite aux noms, noms latins et familles) ; promesse adaptée ; rotation par défaut à 1 an (demande du lot :
« même famille au même endroit l'an dernier ») ; dates fictives relatives au jour dans la démo ; thème
« Organisation et études » ; hashtags et prospects (organismes à vérifier).
