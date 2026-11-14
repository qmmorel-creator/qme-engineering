# T84 · Remboursements santé (soins, Sécurité sociale, mutuelle)

Slug `remboursements-sante`, préfixe `RBS` (clés locales `qme-rbs-*`), prix 12 €, usage `perso`, permalien
Gumroad proposé `remboursements-sante`, catégorie Gumroad `business-and-money/personal-finance`, taille S,
priorité P2. Origine : proposition validée par Quentin le 14/11/2026 (pack « Reprendre la main sur son argent »,
`PAR`). Cadrage délégué par Quentin (14/11/2026) : fiche rédigée et décisions prises le 14/11/2026.
Marques de risque : **médical** (données de santé, avertissement), **argent** (avertissement), **RGPD** (données de
santé des membres du foyer). Aucune donnée datée intégrée : aucun taux, aucun barème, aucun délai officiel.

## Pour qui

Particuliers et familles qui avancent des frais de santé (optique, dentaire, kiné, consultations, pharmacie,
analyses) et oublient de vérifier que la Sécurité sociale puis la mutuelle ont bien remboursé. Distinct du
**Budget du foyer** (T05, toutes les dépenses) et du **Suivi des abonnements** (T14, où la cotisation de la
complémentaire est une ligne parmi d'autres) : ici, soin par soin, ce qui a été payé, ce qui doit revenir et ce
qui reste à charge.

## Promesse

Chaque soin payé, ce que la Sécurité sociale et ta mutuelle t'ont rendu, ce qu'elles te doivent encore, et le
message de relance prêt à copier quand un remboursement tarde.

## Décisions de cadrage (14/11/2026)

1. **Données de santé, minimisation** : on ne note **aucun diagnostic, aucun motif, aucun médicament, aucun
   numéro de sécurité sociale ni d'adhérent**. Un soin = membre du foyer, **type de soin** (liste fermée de la
   base, plus « Autre soin »), date, praticien ou établissement **facultatif** (libellé libre, 60 caractères, aide
   « ex. : cabinet de kiné ; pas de diagnostic »), référence facultative de la facture ou du décompte (40 caractères),
   montants. Aucun champ de note libre, pour ne pas inviter à noter un diagnostic. Le type de soin révèle une
   information de santé : les données restent des données de santé au sens de l'article 9 du RGPD.
2. **Hébergement et consentement : décision de T04 appliquée telle quelle** (Nutrition, `templates/nutrition/`,
   décision de Quentin du 13/11/2026) : **consentement explicite** au premier lancement (case dédiée, rien n'est
   enregistré en ligne avant), données hébergées et traitées dans l'Union européenne (stockage Netlify Blobs
   `eu-central-1`, fonction en région `fra`), rattachées à l'identifiant technique de la clé, copie locale pour le
   hors ligne, « Effacer toutes mes données » dans les Réglages (version en ligne et appareil) qui vaut retrait du
   consentement, politique de confidentialité `/confidentialite/` complétée d'un paragraphe propre au template.
   Seconde case : l'utilisateur est majeur et saisit les soins des membres de son foyer **avec leur accord, ou comme
   parent ou représentant légal** (données de tiers). Point resté ouvert pour T04 et repris ici : certification HDS
   non vérifiée.
3. **Avertissement** (écran de consentement, pied de chaque vue, Réglages, page du site, fiche Gumroad) : outil
   d'aide au suivi de tes remboursements, il ne remplace ni un avis professionnel (médical, administratif ou
   financier) ni les relevés officiels : les décomptes de l'Assurance Maladie et de ta complémentaire font foi.
4. **Aucun taux de remboursement intégré** : le montant attendu de chaque organisme est **saisi** (repris du
   décompte, du devis ou estimé par l'utilisateur), ou laissé vide (« montant à préciser »). Pas de base de
   remboursement, de ticket modérateur, de participation forfaitaire ni de franchise chiffrés : un écart entre
   attendu et reçu est signalé, avec l'explication générique qu'une participation ou une franchise peut avoir été
   déduite, à vérifier sur le relevé.
5. **Délais de retard paramétrables**, sans valeur officielle : 30 jours par défaut pour la Sécurité sociale comme
   pour la mutuelle (valeur de départ choisie pour l'outil), 15 jours avant une nouvelle relance ; réglables de 1 à
   180 jours. Point de départ : la date de transmission saisie (feuille de soins papier envoyée, facture envoyée à la
   mutuelle), sinon la date du soin.
6. **Tiers payant** : par organisme, trois cas : remboursement attendu (je suis remboursé), tiers payant (payé
   directement au praticien, rien à attendre), aucune prise en charge. Le reste à charge en tient compte.
7. **Aucune connexion** à un compte Ameli ni à une mutuelle, aucun envoi : la relance est un texte à copier.

## Écrans (4 onglets + réglages)

1. **Aperçu** : tuiles de l'année en cours (payé, remboursé, en attente, reste à charge) ; « À relancer » (retards,
   jours écoulés, montant attendu, boutons « Relancer » et « Reçu ») ; « En attente » (pas encore en retard, date à
   partir de laquelle relancer) ; derniers soins ; avertissement.
2. **Soins** : liste par mois, filtres (tous, en attente, en retard, soldés), filtre par membre, recherche ; chaque
   ligne : date, type, membre, praticien, montant payé, état Sécurité sociale et mutuelle (pastilles), reste à charge.
   Formulaire unique : membre, type, date, praticien, montant payé, puis un bloc par organisme (cas, montant
   attendu, transmis le, reçu le et montant reçu).
3. **Relances** : remboursements en retard et déjà relancés ; pour chacun, modèle de relance rempli (Sécurité
   sociale ou mutuelle), à copier, et « Noter la relance » (date) ; historique des relances.
4. **Bilan** : année au choix ; totaux par personne (payé, Sécurité sociale, mutuelle, reste à charge, part prise en
   charge) et par famille de soins (barres empilées Sécurité sociale / mutuelle / reste à charge, légende, valeurs,
   tableau) ; comparaison de la mutuelle : cotisations annuelles **saisies** face aux remboursements reçus de la
   mutuelle ; export CSV.
5. **Réglages** : prénom, membres du foyer (ajout, renommage, suppression si aucun soin), nom de la complémentaire
   (utilisé dans les relances), délais, export CSV, sauvegarde JSON, « Effacer toutes mes données », compte,
   « Sur téléphone », avertissement et texte sur les données.

Premier lancement : consentement (2 cases), puis prénom et membres du foyer.

## Calculs (règles pures, `templates/remboursements-sante/regles.js`, `window.RBS`)

- Montants en centimes entiers, saisie tolérante (« 12,99 », « 12.99 € », « 1 234,5 »).
- **Couvert par un organisme** : reçu → montant reçu ; tiers payant → montant attendu ; aucune prise en charge → 0 ;
  en attente → 0 (et montant attendu pour le reste à charge prévu).
- **Avancé** = montant payé − parts en tiers payant. **Remboursé** = reçus. **Reste à charge** = montant payé −
  couvert Sécurité sociale − couvert mutuelle ; **reste à charge prévu** = idem avec les montants attendus encore en
  attente. Incohérence signalée si les attendus dépassent le montant payé.
- **Retard** : en attente depuis plus de N jours (N par organisme) depuis la transmission, sinon le soin ; après
  une relance, retard de nouveau N' jours après la dernière relance.
- **Écart** reçu ≠ attendu signalé (moins ou plus).
- **Totaux** par année (date du soin), par membre et par famille ; part prise en charge = remboursé et tiers ÷ payé.
- Modèle de relance (texte, Sécurité sociale ou mutuelle), export CSV (point-virgule, BOM UTF-8), normalisation
  tolérante.

## Base intégrée (`templates/remboursements-sante/donnees.js`)

- **10 familles, 33 types de soins** (consultations, dentaire, optique, audition, pharmacie, auxiliaires médicaux,
  analyses et imagerie, hôpital, médecines douces et bien-être, autres), noms génériques, aucun tarif ni taux.
- Couleurs des membres dans l'ordre fixe de la charte, conseils de méthode (garder les décomptes, comparer, noter la
  transmission), deux modèles de relance.
- Aucune donnée datée : rien à mettre à jour chaque année.

## Sources et risques

- Aucune source réglementaire intégrée (choix délibéré : pas de taux, pas de délai officiel). Les seuls textes cités
  sont le RGPD (article 9) et la politique de confidentialité de QME.
- **Médical / RGPD** : consentement explicite, minimisation, effacement ; HDS non vérifiée (comme T04).
- **Confidentialité** : démo fictive (foyer de quatre prénoms inventés, praticiens génériques).
- Risque d'usage : un utilisateur peut écrire un diagnostic dans « praticien » ou « référence » ; aide affichée sous
  ces champs, longueur limitée.
