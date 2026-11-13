# T32 · Levée de réserves

Slug `reserves`, préfixe `RSV`, prix 39 €, permalien Gumroad `levee-reserves`. Taille M, P1.
Origine : backlog de Quentin n° 06 « Levée réserves » (ligne T32 de `IDEES.md`).
**confidentiel** : mécanique seulement, aucune donnée d'un artefact professionnel ; exemples fictifs
(logements, bureaux) ; aucun exemple du secteur de l'énergie.

## Pour qui

- **Conducteurs de travaux** d'entreprises générales ou de lots séparés, qui doivent faire lever les
  réserves de leurs sous-traitants dans les semaines qui suivent les opérations préalables à la
  réception (OPR) et la réception.
- **Maîtres d'œuvre** (architectes, mandataires de groupement, économistes chargés du suivi) qui
  tiennent la liste des réserves de toutes les entreprises, relancent, contrôlent et rédigent les
  procès-verbaux de levée.
- **Syndics et gestionnaires** (copropriété neuve, bureaux livrés) qui suivent les réserves signalées
  pour le compte du maître d'ouvrage.

Aujourd'hui : un tableur partagé ou un document de traitement de texte par entreprise, recopié à chaque
visite, sans calcul des retards ni tableau de bord par entreprise.

## Écrans (5 onglets + réglages)

- **Réserves** (accueil) : tuiles (ouvertes, en retard, levées à contrôler, contrôlées), filtres
  (opération, lot, entreprise, statut, « en retard seulement », recherche plein texte, localisation),
  liste triée retards d'abord. Chaque réserve : numéro, localisation (bâtiment · niveau · local), lot,
  entreprise, description, dates, statut ; actions en un geste : « Levée par l'entreprise »,
  « Contrôle : accepter / refuser » (avec « Annuler » dans le toast). Bouton « Nouvelle réserve ».
- **Tableau de bord** : par opération (ou toutes) ; graphique en barres empilées par entreprise
  (ouvertes, refusées, à contrôler, contrôlées), tableau par lot et tableau par entreprise (total,
  restantes, en retard, taux de levée, plus ancien retard), liste des retards les plus anciens.
- **Procès-verbaux** : choix de l'opération, de l'entreprise et du document : « Liste des réserves à
  lever » (à transmettre à l'entreprise) ou « Procès-verbal de levée des réserves » (réserves contrôlées
  et réserves restantes, cadres de signature). Aperçu à l'écran, impression A4 (ou PDF par
  l'imprimante du navigateur).
- **Opérations** : opérations (nom, adresse, maître d'ouvrage, date des OPR ou de la réception,
  bâtiments), entreprises (raison sociale, lots, contact : fonction et e-mail professionnel), lots de
  l'opération (choisis dans la base des lots types ou libres).
- **Guide** : cycle d'une réserve, bien rédiger une réserve, natures de réserves, lots types, rappel
  sourcé de l'article 1792-6 du Code civil (voir Sources), limites de l'outil.
- **Réglages** (modale) : nom de ta structure (en-tête des PV), délai de levée proposé par défaut,
  alerte avant échéance, export CSV, copie JSON, restauration, déconnexion, place utilisée.

## Saisie

- **Réserve** (modale, pensée pour la visite sur téléphone) : opération, lot (l'entreprise titulaire du
  lot est proposée), entreprise, bâtiment, niveau, local (suggestions issues des réserves déjà saisies),
  nature, description, date de constat (aujourd'hui par défaut), échéance (constat + délai par défaut,
  modifiable), référence photo (texte : « IMG_0412, dossier OPR »). Case « Garder la localisation » pour
  enchaîner plusieurs réserves dans le même local.
- **Numérotation** automatique par opération : `R-001`, `R-002`…
- **Levée** : date de levée déclarée par l'entreprise, commentaire facultatif.
- **Contrôle** : date, verdict (accepté → « contrôlée » ; refusé → « refusée », motif obligatoire,
  nouvelle échéance proposée = date du contrôle + délai par défaut).

## Mécanique clé (fonctions pures, `regles.js`)

1. **Statuts** : `ouverte` → `levee` (levée par l'entreprise) → `controlee` (levée contrôlée et
   acceptée, la réserve est soldée) ou `refusee` (contrôle négatif : l'entreprise doit reprendre) →
   `levee` → … Chaque passage est tracé dans l'historique (date, statut, note).
2. **Transitions autorisées** : ouverte → levée ; refusée → levée ; levée → contrôlée ou refusée ;
   tout statut → ouverte (réouverture, motif). Toute autre transition est refusée par `transition()`.
3. **Retard** : réserve à la charge de l'entreprise (`ouverte` ou `refusee`) dont l'échéance est passée.
   Jours de retard = aujourd'hui − échéance. **Proche** : échéance dans les N jours (réglable, 7).
4. **À contrôler** : statut `levee` ; ancienneté = jours depuis la levée.
5. **Indicateurs** par lot et par entreprise : total, restantes (ouvertes + refusées), à contrôler,
   contrôlées, en retard, **taux de levée** = contrôlées / total, plus ancien retard.
6. **Tri** : retards (du plus ancien), puis à contrôler, puis échéances proches, puis le reste ;
   contrôlées en dernier.
7. **Export CSV** : une ligne par réserve (opération, numéro, bâtiment, niveau, local, lot, entreprise,
   nature, description, constat, échéance, statut, retard en jours, levée le, contrôlée le, motif du
   dernier refus, référence photo) ; séparateur point-virgule, BOM UTF-8, guillemets échappés, formules
   neutralisées (`=`, `+`, `-`, `@` en tête préfixés d'une apostrophe).

## Base intégrée (`donnees.js`)

- **20 lots types du bâtiment** avec code court : VRD et aménagements extérieurs, démolition, gros
  œuvre, charpente, couverture et étanchéité, façades et ravalement, menuiseries extérieures,
  serrurerie et métallerie, cloisons, doublages et faux plafonds, menuiseries intérieures, carrelage et
  faïence, sols souples, peinture et revêtements muraux, plomberie et sanitaires, chauffage,
  ventilation et climatisation, électricité courants forts, courants faibles, ascenseurs, espaces verts,
  nettoyage de fin de chantier. Intitulés usuels, rien de réglementaire.
- **10 natures de réserve** avec exemples : finition et aspect, dégradation ou choc, élément manquant
  ou non posé, fonctionnement et réglage, non-conformité au marché ou aux plans, étanchéité et
  infiltration, nettoyage, sécurité et accessibilité, équipement non mis en service, documentaire
  (notices, DOE, PV d'essais manquants).
- **Bien rédiger une réserve** : 7 règles (une réserve = un défaut, localisation précise, constat
  factuel, résultat attendu, entreprise désignée, échéance, référence photo).
- **Niveaux proposés** : sous-sol, RDC, R+1 à R+6, combles, toiture, extérieurs.
- **Délais de départ** (réglables, jamais présentés comme réglementaires ni contractuels) : levée
  30 jours après le constat, alerte 7 jours avant l'échéance.

## Photos

Le service de synchronisation des templates n'enregistre que des données JSON (900 Ko par compte
environ). En V1, **aucune photo n'est stockée** : un champ texte « Référence photo » indique où elle est
rangée (numéro de cliché, dossier partagé). C'est dit dans la modale, le Guide et la FAQ. La place
utilisée est affichée dans les réglages (une réserve pèse environ 0,5 Ko : plus de 1 000 réserves
tiennent dans un compte).

## Sources

- **Article 1792-6 du Code civil** (Légifrance, version en vigueur depuis le 1er janvier 1979, consulté
  le 12/11/2026) : la réception est l'acte par lequel le maître de l'ouvrage déclare accepter l'ouvrage
  avec ou sans réserves ; garantie de parfait achèvement d'un an à compter de la réception pour les
  désordres signalés (réserves du procès-verbal ou notification écrite) ; délais des travaux de
  reprise fixés d'un commun accord. Présenté en paraphrase dans le Guide, avec le lien, sans conseil
  juridique. Aucun autre délai légal n'est présenté.
- Délais de levée : saisie de l'utilisateur (le contrat ou le CCAP du marché fait foi).
- Lots types, natures, règles de rédaction : savoir-faire général de chantier, rédigé pour le produit.
  Aucune base externe reprise : pas de question de licence.

## Risques

- **confidentiel** : démo fictive (résidence de logements, plateau de bureaux) ; entreprises
  inventées ; personnes désignées par leur fonction.
- **Juridique** : pas un conseil juridique ; le PV produit par l'outil est un modèle à adapter à son
  marché ; la réception et ses effets relèvent du contrat et du Code civil (avertissement dans le
  Guide, sur le PV imprimé et sur la fiche Gumroad).
- **RGPD** léger : contacts des entreprises (fonction et e-mail professionnel) ; rappel dans la
  modale entreprise de privilégier les adresses génériques.

## Choix d'implémentation (V1)

- Socle de `templates/revision/` ; règles pures dans `regles.js` (`window.REGLES`), testées par
  `outils/templates/reserves.test.mjs`.
- Plusieurs opérations dans un même compte, filtre d'opération mémorisé sur l'appareil.
- Pas de photos (voir ci-dessus), pas de multi-utilisateur (un compte = une clé), pas de signature
  électronique : le PV s'imprime et se signe.
- Graphique : couleurs de la charte (jaune, rouge, bleu, gris) ; le validateur `dataviz` signale des
  écarts de clarté inhérents à la charte : compensés par un contour encre de chaque segment, une légende,
  les nombres affichés et un tableau accessible.
