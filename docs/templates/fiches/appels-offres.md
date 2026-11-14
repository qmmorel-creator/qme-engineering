# T76 · Suivi des candidatures aux appels d'offres et plateformes

Slug `appels-offres`, préfixe `CND` (clés locales `qme-cnd-*`, règles `window.CND_REGLES`), prix 15 € (tableau de
bord), permalien Gumroad proposé `suivi-appels-offres`, catégorie Gumroad `business-and-money/marketing-and-sales` (**à vérifier**, comme
les autres templates commerciaux), taille S, priorité P2. Catalogue : `data-pour="pro"`, thème « Clients et
prospection » (`clients-et-prospection`, `--c:var(--encre)`), avec le CRM, le pipeline de prospection, la relance des
impayés et le préparateur d'appel découverte. Pack visé : « Freelance : trouver ses clients » (PFC). Origine :
proposition validée par Quentin le 14/11/2026 ; cadrage délégué par Quentin, fiche rédigée le 14/11/2026.
Nom affiché : « Suivi des appels d'offres et candidatures » (nom court du titre de l'idée, déjà utilisé par les pages
des packs).

## Pour qui

Freelances, consultants et PME (une à quelques personnes) qui répondent :
- à des **marchés publics** (collectivités, établissements publics) ;
- à des **appels d'offres privés** (entreprises, associations, groupes) ;
- à des **missions publiées sur des plateformes** de freelances (aucun nom de plateforme dans le produit) ;
- à des **consultations directes** (demande de proposition ou de devis reçue d'un client).

Aujourd'hui : des consultations repérées dans des alertes e-mail, un tableur de suivi incomplet, des pièces
rassemblées la veille de la date limite, une attestation périmée découverte au dépôt, aucune relance après dépôt,
et aucune idée du taux de réussite ni du temps passé à répondre.

Distinct du **pipeline de prospection** (T35, démarche sortante vers des prospects, cadences de messages) et du
**CRM freelance** (T28, clients et affaires) : ici l'unité est **la consultation**, avec une date limite, des pièces
et un résultat. Distinct de **T74 Propositions commerciales** (rédaction de la proposition), de **T89 Candidatures études** (vœux d'étudiants) et de **T91 Subventions** (dossiers de
financement).

## Promesse

« Répondre aux bonnes consultations, à temps. » Décider vite où candidater, monter chaque dossier pièce par pièce, ne
manquer aucune date limite, savoir ce que les réponses rapportent.

## Écrans (5 onglets + réglages)

1. **Échéances** (accueil) : titre de synthèse (dates limites dans les 15 jours), carte « prochaine date limite » ;
   liste **À faire** jusqu'à l'horizon (7 jours, réglable), retards en tête : pièces à préparer (regroupées par
   dossier), dépôts visés, dernier jour des questions, décisions go/no-go à prendre (7 jours avant la date limite,
   réglable), relances après dépôt, fin de validité des offres, pièces de la bibliothèque expirées ou valables moins
   de 30 jours ; actions directes (pièce prête, déposée, relance faite, résultat, grille, mettre à jour).
   **Calendrier** mensuel (lundi → dimanche) : dates limites, dépôts visés, questions, relances, validité ; liste du
   mois (à venir) ou du jour choisi ; points de couleur seuls sur téléphone.
2. **Veille** : consultations repérées triées par date limite, type, recommandation, J-n, jauge du score avec les
   deux seuils ; boutons grille, go, no-go ; liste des **écartées** avec leur motif ; rappel des taux de go et de
   réussite sur 12 mois.
3. **Dossiers** : filtres (en cours, en préparation, déposées, résultats, toutes), recherche ; cartes avec statut,
   type, pièces en retard, pièce à renouveler, avancement x/y, temps passé. **Fenêtre du dossier** : en-tête
   (acheteur, référence, date et heure limites, questions, montant estimé, emplacement du dossier, notes), état
   (score, dépôt visé, prochaine relance ou résultat), temps passé (−½ h, +½ h, +1 h), actions selon le statut
   (go/no-go, déposée, abandon, relance, date de relance, résultat, rouvrir), **pièces** (statut, responsable,
   échéance J-n calculée ou fixée à la main, pièce de la bibliothèque liée, alerte de validité), ajout d'une pièce,
   historique (repérée, décision, dépôt, relances, résultat). Export CSV de toutes les consultations.
4. **Pièces** (bibliothèque) : pièces réutilisables groupées par type (références, CV, attestations, assurance,
   extrait d'immatriculation, certification, éléments financiers, présentation, note méthodologique, autre) avec
   emplacement (texte libre), date d'émission, date de validité saisie, état (valide, expire bientôt, expirée,
   validité à saisir), nombre de dossiers en cours qui l'utilisent. **Modèles de dossiers** modifiables (une ligne
   « jours ; libellé » par pièce), retour au modèle d'origine.
5. **Bilan** (90 jours, 12 mois, tout) : taux de réussite, montant gagné et moyen, taux de go, temps passé et euros
   gagnés par heure de réponse ; de la veille au gain (repérées → go → déposées → gagnées) ; tableau par type ;
   dépôts et gains par mois sur 12 mois (barres, infobulle, tableau accessible) ; motifs de perte.
6. **Réglages** : prénom (responsable par défaut), marge de dépôt, horizon, délai de décision, intervalle de
   relance, seuil d'alerte des pièces, seuils et poids de la grille ; copie JSON et restauration, export CSV, compte,
   « Sur téléphone » (fenêtre « Comme une application »).

Premier lancement : prénom et marge de dépôt (le jour même, la veille, deux jours avant), puis première consultation.

Socle commun : clé de licence ou code, démo `?demo` (non mémorisée par lien), code ADM avec `produit: 'CND'`
dans les deux appels à `/connexion`, synchronisation (`/api/templates/*`, 409), hors ligne, toast « Annuler »,
manifeste et service worker, bandeau `.bientot-demo` vers `/catalogue/appels-offres/`.

## Base intégrée (`templates/appels-offres/donnees.js`)

- 8 statuts : repérée, en préparation, déposée, gagnée, perdue, sans suite, no-go, abandonnée.
- 5 types : marché public, appel d'offres privé, mission sur plateforme, consultation directe, autre appel à
  candidatures ; délai de relance par défaut (30, 21, 5, 10, 21 jours : valeurs de départ, pas des règles).
- Grille go/no-go : 8 critères (cœur de métier ×3 éliminatoire, capacité à réaliser ×3 éliminatoire, temps pour
  répondre ×2 éliminatoire, références ×2, rentabilité ×2, chances de gagner ×2, connaissance du client ×1, intérêt
  stratégique ×1), notes 0 à 3 ; seuils go 65 %, à discuter 45 %.
- 4 modèles de dossiers (marché public 11 pièces, privé 10, plateforme 5, consultation directe 5) avec délai avant la
  date limite et type de pièce de bibliothèque correspondant.
- 10 types de pièces réutilisables, 8 motifs de perte, 7 sources de veille.

**Aucune référence réglementaire** (ni article, ni formulaire officiel numéroté, ni durée de validité légale) : le
modèle « Marché public » liste des pièces **souvent demandées**, présentées comme point de départ ; la liste exacte
est celle du règlement de la consultation, dit dans l'application (accueil, modèles, réglages), sur la page du site et
dans la fiche Gumroad. Les dates de validité des attestations sont **saisies par l'utilisateur** d'après chaque pièce.
Un test vérifie qu'aucune année ni référence de texte n'entre dans la base.

## Règles (fonctions pures, `regles.js`, testées dans `outils/templates/appels-offres.test.mjs`)

- `scoreGrille` : points pondérés sur les critères notés, % arrondi ; éliminatoire à 0 → no-go conseillé même si la
  grille est incomplète ; recommandation seulement quand la grille est complète ; poids 0 = critère ignoré.
- `echeancePiece` : date limite − délai, avancée au vendredi si elle tombe un samedi ou un dimanche ; date fixée à la
  main prioritaire. `depotVise` : date limite − marge (sans décalage de week-end : on peut déposer un samedi).
- `etatPiece` : prête, sans objet, en retard (jours), bientôt (≤ 2 jours), en cours, à faire ; alerte si la pièce
  liée de la bibliothèque est expirée ou expire avant la date limite. `etatBiblio` : valide, bientôt (seuil), expirée,
  sans date.
- Transitions sans effet de bord : `decider` (go crée les pièces du modèle si le dossier n'en a pas), `deposer`
  (relance = dépôt + délai du type), `noterRelance` (prochaine = relance + intervalle), `cloturer` (gagnée avec
  montant, perdue avec motif et classement, sans suite, abandon), `ajouterTemps` (quart d'heure, jamais négatif).
- `aFaire` (horizon, marge, délai de décision, seuil) et `regrouperPieces` ; `grilleMois`, `evenements`.
- `statistiques` : taux de go = go ÷ décisions ; **taux de réussite = gagnées ÷ (gagnées + perdues)** (sans suite et
  en attente exclus) ; montant gagné (montant attribué, sinon montant de l'offre) ; temps total, moyen par go, heures
  par gain, euros par heure ; par type, par motif, par mois (12 mois glissants).
- `csv` : point-virgule, BOM UTF-8 à l'export, champs protégés.

## Données et confidentialité

- Démo **entièrement fictive** : consultant « Alex », associée « Sam », acheteurs inventés (Agglomération de Brevenne,
  Ville de Valmorin, Syndicat des eaux du Lornec, Communauté de communes du Haut-Lizan, Groupe Hôtelier Exemple…),
  montants et références inventés. 23 consultations sur un an : veille (go conseillé, à discuter, grille vide), no-go,
  3 dossiers en préparation (pièces en retard, attestation expirée, assurance qui expire avant la date limite),
  3 déposés (relance en retard, relance du jour, à venir), résultats gagnés, perdus, sans suite, abandon.
- **RGPD** : seuls des prénoms de responsables et des noms d'organisations ; aucun contact personnel demandé.
- Aucune automatisation : pas de connexion aux plateformes, profils d'acheteurs, messageries, agendas ; pas de
  stockage de fichiers.

## Risques et limites (V1)

- Pas de gestion des lots d'une consultation (un lot = une consultation, à dupliquer à la main).
- Pas de groupement ni de sous-traitance (une seule structure qui répond) ; pas de comptes par personne.
- Pas de rappel par e-mail ni de notification : l'application affiche les échéances à l'ouverture.
- Heure limite affichée, mais les retards se comptent au jour.

## Livrables

Application `templates/appels-offres/`, tests, page `catalogue/appels-offres/`, captures
`assets/templates-appels-offres-*.webp`, couverture `assets/templates-appels-offres-couverture.png`, communication
`docs/templates/communication/appels-offres/` (linkedin.md, instagram.md et carrousel, prospects.md, gumroad.md et
gumroad.json, section-site.html, couverture.txt, kanban.txt).
