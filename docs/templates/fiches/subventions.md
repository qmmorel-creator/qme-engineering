# T91 · Subventions (dossiers, échéances, justificatifs)

Slug `subventions`, préfixe `SBV` (clés locales `qme-sbv-*`, règles `window.SBV`), prix 25 €, permalien Gumroad prévu
`subventions-association`, catégorie Gumroad prévue `business-and-money/management-and-leadership` (à confirmer),
taille M, priorité P2, usage `pro`. Origine : proposition validée par Quentin le 14/11/2026 (pack « Associations et
clubs », PAS). Fiche rédigée le 14/11/2026 par délégation de Quentin (décisions de cadrage déléguées, pas de
validation à attendre). Catalogue : `data-pour="pro"`, thème `associations-formation-et-evenements`
(`--c:var(--rouge)`), comme les inscriptions associatives (T51) et le pilote événementiel. Marques de risque :
**daté** (règles des subventions publiques, sourcées et datées, désactivables) et **argent** léger (montants saisis,
pas une comptabilité). **Confidentiel vérifié** : démo d'une association fictive (« Les Ateliers du Quartier
(association fictive) »), financeurs génériques (« Commune · service vie associative », « Fondation Exemple pour
l'enfance », « Imprimerie du coin (mécène fictif) »), montants fictifs.

## Pour qui

Bureaux bénévoles d'associations et de clubs (président, trésorier, secrétaire), directions de centres sociaux et
d'associations employeuses, petites structures culturelles (compagnies, festivals, lieux de quartier). Aujourd'hui :
un classeur, un tableur, des dates notées dans un agenda personnel, des justificatifs cherchés au moment du bilan.

## Promesse

Chaque dossier déposé à temps, chaque euro justifié : un dossier par financeur, les pièces cochées, une alerte avant
chaque échéance, le reste à percevoir et un bilan préparé pendant le projet.

## Décisions de cadrage

- **Une clé partagée** par le bureau, sans comptes ni noms (comme T51) : aucune donnée personnelle demandée ; le
  contact chez un financeur est une fonction ou un service.
- **Financeurs** typés (commune, intercommunalité, département, région, État, autre organisme public, fonds européens,
  fondation, mécénat, autre privé) ; le type public ou privé choisit les pièces proposées et active les rappels
  réglementaires.
- **Projets** : nom, année, description, charges prévues par poste (9 postes courants, sans numéro de compte),
  autres ressources (fonds propres, participations, recettes). Un projet peut être archivé.
- **Dossiers** : un par financeur et par projet (ou sans projet pour une aide au fonctionnement), année de l'action,
  intitulé, dispositif (texte libre), nature (projet, fonctionnement, investissement), demandé, accordé (accord partiel
  possible), statut `en préparation → déposé → accordé ou refusé`, `abandonné` ; **clos** calculé (accordé, tout versé,
  bilan rendu ou aucun bilan demandé). Dates toutes saisies : limite de dépôt, dépôt, réponse attendue, réponse, bilan
  à rendre, bilan rendu ; convention signée ; « aucun bilan demandé ». Duplication pour l'année suivante (pièces
  stables reprises comme prêtes).
- **Pièces** : liste proposée à la création selon le type de financeur (17 pièces types, « souvent demandées, à
  ajuster »), états à préparer → prête → envoyée → sans objet, pièces libres ; pièces du bilan (6 types).
- **Versements** : plusieurs par dossier (avance, solde), date attendue, date et montant reçus ; reste à percevoir =
  accordé − reçu ; à l'accord, un versement attendu du montant accordé est proposé.
- **Échéances et alertes** : dépôt (avec nombre de pièces à préparer), réponse (date saisie, sinon relance proposée
  30 jours après le dépôt, réglable), versements, bilan, convention attendue. Niveaux en retard / proche (21 jours,
  réglable ; 45 jours pour un bilan) / à venir. « Relancé » repousse la réponse attendue de 15 jours et le note.
- **Budget du projet** : charges, part de chaque financeur (accordé en plein, demandé hachuré), autres ressources,
  non financé ; prévu et réalisé par poste, écarts de plus de 20 % signalés.
- **Dépenses justificatives** : date, poste, libellé, fournisseur, montant, référence du justificatif, justificatif
  rangé ou non, imputation facultative à un dossier. Bilan d'un dossier : montant justifié = dépenses imputées avec
  justificatif ; sans imputation, estimation = réalisé du projet × part du financeur dans le budget prévu.
- **Bilan d'utilisation** : trame en 5 rubriques (réalisé, public touché, résultats, écarts, suites), chiffres
  automatiques, impression A4 avec signatures. Ne remplace pas le formulaire du financeur.
- **Tableau de bord annuel** : demandé, accordé, versé, reste à percevoir, taux de réponses positives, montants par
  type de financeur (barres + tableau accessible), compteurs par statut, impression du bilan annuel.
- **Exports** : dossiers et dépenses en CSV (« ; », virgule décimale), copie JSON, impressions (dossier, bilan,
  budget, année).

## Règles sourcées (aucune obligation non sourcée)

Reprises de service-public.gouv.fr, consultées le 14/11/2026, dans `donnees.js` (`regles`, `sources`), appliquées
aux seuls financeurs publics, désactivables (Réglages) et présentées comme indicatives :

- fiche **F3180** « Subventions versées aux associations » (vérifiée le 1er janvier 2026) : convention obligatoire
  au-delà de **23 000 €** ; comptes annuels, commissaire aux comptes et publication au JOAFE au-delà de **153 000 €**
  de subventions en numéraire ;
- fiche **R46623** « Association : compte-rendu financier de subvention » (vérifiée le 30 décembre 2025) : compte rendu
  financier (Cerfa n° 15059*02) dans les **6 mois** suivant la fin de l'exercice pour lequel la subvention a été
  attribuée, avant toute nouvelle demande.

Effets dans l'outil : date du bilan calculée (fin de l'exercice de l'année du dossier + 6 mois, exercice décalable)
quand aucune date n'est saisie ; échéance « convention attendue » au-delà de 23 000 € accordés sans convention cochée ;
total des subventions publiques reçues sur l'exercice face au seuil de 153 000 € (alerte au-delà de 80 %).
**Aucun calendrier de financeur, aucun appel à projets, aucun montant de dispositif** : tout est saisi.

## Base intégrée (`donnees.js`)

10 types de financeurs, 3 natures d'aide, 9 postes de charges, 5 types de ressources, 17 pièces types (public, privé
ou tous) et deux listes de départ, 6 pièces du bilan, trame du bilan (5 rubriques), 3 règles et 2 sources datées,
réglages par défaut, 10 couleurs fixes (palette de T82 étendue), 4 conseils de démarrage.

## Écrans

Connexion (clé ou code, démo) · premier lancement (association, mois de début d'exercice, premier projet) · Tableau
de bord · Dossiers (recherche, filtres statut, année, projet) · fiche Dossier (échéances, montants, dates, versements,
pièces, rappels, bilan) · Échéances · Projets et fiche Projet (financement, dossiers, prévu/réalisé, dépenses) ·
Financeurs · Réglages (exercice, alertes, rappels, exports, sauvegarde, compte, « Sur téléphone », sources).

## Tests

`outils/templates/subventions.test.mjs` (14 tests) : base et sources, montants, normalisation, pièces de départ,
versements et clôture, date du bilan (exercice civil et décalé), convention, échéances et tri, synthèse annuelle,
seuil des comptes annuels, budget du projet, bilan d'un dossier, recherche et tri, CSV. Parcours Playwright (1280 px,
iPhone 13, Pixel 7) : code faux et clé d'un autre template refusés, premier lancement, dossier avec nouveau financeur,
dépôt, accord, synchronisation vers un second contexte, rechargement, démo, fenêtre « Comme une application ».

## Risques et limites

- Les fiches service-public.gouv.fr peuvent évoluer : revérifier les seuils à la mise à jour annuelle de la base.
- La règle des 6 mois vise les subventions affectées à une action : l'outil ne la calcule pas pour une aide au
  fonctionnement ; la date fixée par la convention prime (saisie).
- Pas une comptabilité, pas de dépôt en ligne, pas de veille des appels à projets.
- Version anglaise en attente.
