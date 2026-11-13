# T45 · Gestion de parc informatique

Slug `parc-informatique`, préfixe `PRC`, prix 35 €, permalien Gumroad `parc-informatique`. Taille M, P1.
Origine : backlog de Quentin n° 21 (« Gestion de parc de postes de travail », demandé explicitement).
Couplage possible avec T46 (arrivées et départs de salariés). Marques de risque : **RGPD** (affectations
nominatives de salariés), **confidentiel à vérifier** (artefact d'origine) : rien n'en est repris, exemples
entièrement fictifs. **Aucune marque** de matériel ni de logiciel, nulle part : uniquement des catégories
génériques (« Ordinateur portable », « Suite bureautique »).

## Pour qui

- **PME de 5 à 150 postes** sans service informatique structuré : le parc est tenu par l'office manager,
  l'assistante de direction, le responsable administratif ou un « référent informatique » à temps partiel.
- **DSI ou responsable informatique de PME** qui veut un inventaire simple, partagé entre ordinateur et
  téléphone, sans déployer un outil de gestion de parc complet (agents, découverte réseau).
- **Associations, cabinets (expertise comptable, avocats, architectes), écoles privées** avec quelques
  dizaines de postes, d'écrans et de téléphones.

Aujourd'hui : un tableur d'inventaire jamais à jour, les numéros de série sur des factures éparpillées, les
garanties découvertes expirées au moment de la panne, les licences achetées « au cas où » ou au contraire
dépassées, et le matériel d'un salarié parti qu'on ne retrouve plus.

## Écrans (5 onglets + guide et réglages)

- **Alertes** (accueil) : tuiles (matériels en service, affectés, en stock, alertes), liste unique des
  alertes triées par gravité : départ passé avec matériel non restitué, départ proche, licence
  sur-attribuée, licence expirée, licence à renouveler, licence attribuée à une personne partie, garantie qui
  se termine, matériel ancien (âge ≥ durée de renouvellement de sa catégorie), réparation longue. Chaque alerte
  ouvre la fiche concernée. Graphique : parc par catégorie et statut (barres empilées, légende, tableau
  accessible).
- **Matériel** : inventaire en cartes, filtres (catégorie, statut, garantie, recherche sur désignation,
  numéro de série, numéro d'inventaire, fournisseur, détenteur). Actions rapides « Affecter » et
  « Restituer ». **Fiche matériel** (modale) : identité, achat, garantie calculée, statut, état, historique
  des affectations. Export CSV de la sélection.
- **Personnes** : collaborateurs (nom, service, arrivée, départ prévu), matériel détenu, licences
  attribuées ; action « Départ » (date) et « Tout restituer » ; historique « qui a eu quoi, quand ».
- **Licences** : par logiciel (nom générique), type, postes achetés / attribués / disponibles, échéance de
  renouvellement, coût ; attribution à une personne ou à un matériel selon le mode ; action « Renouvelée ».
- **Fiches** : documents imprimables par personne : **fiche de remise de matériel** (matériel détenu et
  licences, état à la remise, engagement, signatures) et **fiche de restitution** (liste du matériel à
  récupérer avec cases à cocher et état constaté, licences à libérer, signatures).
- **Guide** (bouton de la barre) : règles de calcul, base intégrée, rappel RGPD avec source, limites.
- **Réglages** (modale) : nom de la structure, fenêtres d'alerte (garantie, licences, départ),
  garantie par défaut et durée de renouvellement **par catégorie (modifiables)**, exports CSV (inventaire,
  affectations, licences), copie JSON, restauration, déconnexion.

## Saisie

- **Matériel** : catégorie (base), désignation libre (« Portable 14 pouces compta »), numéro d'inventaire
  (proposé : `INV-001`, `INV-002`…, modifiable, unique), numéro de série (unique s'il est saisi),
  fournisseur (texte libre générique : « Revendeur informatique », « Grossiste en ligne »), date d'achat, prix
  (HT ou TTC au choix, à garder cohérent), garantie en mois (proposée selon la catégorie, modifiable
  matériel par matériel, extension comprise), statut (actif, en réparation, perdu ou volé, sorti du parc avec
  date et motif), état (neuf, bon, usé, hors service), localisation, note.
- **Affectation** : matériel, personne, date de remise, état à la remise, note. **Restitution** : date,
  état constaté au retour, note.
- **Personne** : nom (ou prénom et initiale), service, date d'arrivée, date de départ prévue (facultative),
  note courte. Rien d'autre (pas d'adresse, pas de téléphone personnel).
- **Licence** : nom générique, catégorie de logiciel (base), type (base), mode (par utilisateur ou par
  poste, déduit du type), postes achetés, date d'échéance (vide pour une licence perpétuelle), coût par
  période, fournisseur générique, référence du contrat ; attributions (personnes ou matériels).

## Mécanique clé (fonctions pures, `regles.js`)

1. **Fin de garantie** = date d'achat + N mois − 1 jour (dernier jour couvert, fin de mois bornée :
   31 janvier + 1 mois = 28 ou 29 février). Garantie « expirée » si la fin est avant aujourd'hui,
   « se termine » si elle tombe dans la fenêtre d'alerte (60 jours par défaut).
2. **Âge** en mois révolus depuis l'achat ; **ancien** si âge ≥ durée de renouvellement de la catégorie
   (réglable).
3. **Affectations** : intervalle [remise, restitution] ; une seule affectation ouverte par matériel ;
   refus si les périodes d'un même matériel se chevauchent, si la restitution précède la remise, si le
   matériel est sorti du parc ou perdu. Le détenteur actuel est celui de l'affectation ouverte.
4. **Statut affiché** : sorti du parc, perdu ou volé, en réparation, affecté (actif avec affectation
   ouverte), en stock (actif sans affectation).
5. **Licences** : attribuées = nombre d'attributions ; disponibles = achetées − attribuées ;
   **sur-attribuée** si attribuées > achetées. Échéance : expirée si passée, « à renouveler » dans la fenêtre
   (60 jours). « Renouvelée » repousse l'échéance de la période du type (12 mois ou 1 mois). Une attribution
   à une personne partie (départ passé) ou à un matériel sorti du parc est signalée « à libérer ».
6. **Départ** : liste de restitution = affectations ouvertes de la personne + licences attribuées à la
   personne + licences attribuées aux matériels qu'elle détient. Alerte rouge si le départ est passé et la
   liste non vide, jaune s'il est dans la fenêtre (15 jours).
7. **Alertes** agrégées et triées (gravité, puis date).
8. **Exports CSV** : inventaire (avec fin de garantie, âge, détenteur), historique des affectations,
   licences ; point-virgule, BOM UTF-8, formules neutralisées.

## Base intégrée (`donnees.js`)

- **14 catégories de matériel** avec garantie proposée (mois) et durée de renouvellement indicative
  (années) : ordinateur portable, ordinateur fixe, écran, station d'accueil, smartphone, tablette,
  imprimante ou multifonction, serveur, stockage réseau, équipement réseau, onduleur, périphérique,
  équipement de salle de réunion, autre. **Valeurs de départ indicatives**, rédigées pour le produit (pas
  de source externe) et présentées comme telles : la facture ou le contrat fait foi, tout est modifiable
  dans les réglages.
- **8 types de licence** : abonnement annuel par utilisateur, abonnement mensuel par utilisateur,
  abonnement annuel par poste, licence perpétuelle par poste, licence perpétuelle par utilisateur,
  contrat en volume (renouvellement annuel), licence serveur, logiciel libre ou gratuit (suivi seulement).
- **11 catégories de logiciel** génériques : suite bureautique, messagerie et collaboration, sécurité des
  postes, système d'exploitation, sauvegarde, gestion des mots de passe, accès à distance, comptabilité et
  paie, conception assistée (CAO, DAO), graphisme et PAO, autre.
- **Statuts et états** du matériel, motifs de sortie (recyclé, revendu, donné, détruit, rendu au loueur).

## Sources (consultées le 13/11/2026)

- **CNIL, « Les règles pour la gestion du personnel »** (cnil.fr, publiée le 17/08/2023) : données
  pertinentes et non excessives (y compris les zones de commentaire), information des salariés, accès
  réservé aux personnes habilitées, conservation limitée, inscription au registre des traitements. Repris
  sous forme de rappel, sans durée chiffrée.
- Aucune donnée réglementaire ni barème : garanties et durées de renouvellement sont des paramètres de
  gestion, modifiables, sans valeur légale (pas de durée d'amortissement comptable ou fiscale).

## Risques

- **RGPD** : affectations nominatives de salariés. Rappel dans la modale personne, la fiche de remise et le
  Guide : ne saisir que le nécessaire, informer les salariés, limiter l'accès, supprimer ou anonymiser après
  le départ (bouton « Anonymiser » sur une personne partie sans matériel). Démo : prénoms et initiales fictifs.
- **Confidentiel** : aucune donnée, aucun nom ni aucune marque repris de l'artefact d'origine.
- **Pas de conseil juridique ni comptable** : fiches de remise et de restitution = modèles à adapter à la
  charte informatique ou au règlement intérieur ; prix tels que saisis, pas d'amortissement.

## Choix d'implémentation (V1)

- Socle de `templates/revision/` (structure reprise de `templates/reserves/`), règles pures dans
  `regles.js` (`window.REGLES`), testées par `outils/templates/parc-informatique.test.mjs` avec une date de
  référence fixe (jamais la date du jour).
- Un compte = une clé : pas de comptes séparés pour les salariés ; pas d'agent d'inventaire automatique, pas
  de découverte réseau, pas de pièces jointes (factures) : le service ne stocke que du JSON (≈ 900 Ko, soit
  plusieurs milliers de matériels).
- Service worker : à l'activation, il ne supprime que les caches dont le nom commence par
  `parc-informatique-` (le domaine est partagé avec les autres templates).
