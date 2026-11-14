# T27 · Gestion locative

Slug `gestion-locative`, préfixe `GRT` (clés locales `qme-grt-*`, règles `window.GRT`), prix prévu 20 €,
permalien Gumroad prévu `gestion-locative`, catégorie Gumroad proposée `business-and-money/personal-finance`
(une catégorie immobilier, si Gumroad en propose une, est à vérifier), taille M, priorité P2. Catalogue :
Vie personnelle, thème Argent (`data-pour="perso"`, `data-theme="argent"`, `--c:var(--jaune)`).
Origine : documents de travail de Quentin du 12/11/2026 (ligne T27 de `IDEES.md`). Fiche rédigée le
14/11/2026 par délégation de Quentin (cadrage confié à l'agent, sans validation intermédiaire). Marques de
risque : **daté** (IRL saisi par l'utilisateur, jamais intégré ; règles légales sourcées et datées, ou
paramétrables), **juridique** (modèles de quittance, de relance et de demande de révision : outil d'aide, pas
un conseil juridique), **fiscal** (aucun régime d'imposition calculé), **RGPD** (locataires), argent
(avertissement). Aucune donnée de l'outil interne de Quentin reprise : mécanique seulement. Distinct de T64
(location saisonnière : séjours courts, canaux, ménage, taxe de séjour) : ici des baux d'habitation, des
loyers mensuels, des quittances et la révision annuelle.

## Pour qui

Propriétaires bailleurs particuliers qui gèrent eux-mêmes de 1 à 10 logements loués à l'année (vide,
meublé ou bail mobilité), sans agence : ils suivent les loyers dans un tableur ou un carnet, oublient la
révision annuelle (perdue au bout d'un an), refont chaque mois la même quittance, ne savent pas combien leur
rapporte vraiment chaque bien, et redoutent la régularisation des charges et la restitution du dépôt de
garantie.

## Promesse

Tes loyers, sans tableur : chaque échéance encaissée ou relancée, la quittance prête en un geste, la
révision annuelle calculée avec l'IRL que tu saisis, les charges régularisées et le rendement réel de chaque
bien.

## Écrans (5 onglets + réglages)

1. **Aujourd'hui** : tuiles (encaissé ce mois sur attendu, impayés en cours, révisions à faire, rendement net
   de l'année) ; alertes datées : loyers en retard (avec palier de relance), révisions à demander (date
   passée, limite d'un an), dépôts de garantie à restituer (date limite), régularisations de charges de
   l'année précédente, fins de bail prévues (dans 90 jours), indice IRL manquant ; échéances du mois.
2. **Loyers** : mois courant (navigation) : une ligne par bail actif (locataire, bien, loyer + charges, payé,
   reste, état : payé, partiel, en retard, à venir) ; « Encaisser » (total ou partiel), « Quittance » (si
   payé) ou « Reçu » (si partiel), « Relancer » (si en retard) ; grille de l'année (bail × mois, couleur par
   état, tableau lisible) ; liste des impayés toutes périodes confondues.
3. **Baux** : biens (nom, adresse, type, surface, prix d'achat, frais, travaux) et leurs baux (en cours,
   à venir, terminés) ; détail d'un bail : locataire(s), type de bail, dates, loyer et charges en vigueur,
   mode des charges (provisions ou forfait), jour d'échéance, dépôt de garantie (contrôle du maximum),
   historique des loyers, révision (clause, trimestre de référence, DPE F ou G), sortie (remise des clés,
   état des lieux conforme ou non, restitution du dépôt et retenues), effacement des données du locataire.
4. **Révisions** : une carte par bail révisable : date de révision de l'année, IRL ancien et nouveau (tirés
   de la table d'indices saisie), nouveau loyer arrondi au centime, limite de demande (un an), état
   (à venir, à demander, demandée, appliquée, perdue, bloquée) ; « Préparer la lettre » (texte à copier) ;
   « Appliquer » à partir de la date de la demande (non rétroactif) ; table des indices IRL (trimestre,
   valeur, zone) saisie par l'utilisateur, avec le lien vers l'Insee.
5. **Bilan** : année civile (navigation) ; par bien : loyers appelés et encaissés, charges récupérables et
   non récupérables, rendement brut (loyers hors charges ÷ coût total), rendement net de charges (avant
   impôts, avant crédit), vacance (jours sans bail), impayés ; dépenses (date, bien, catégorie, montant,
   récupérable ou non) ; **régularisation des charges** par bail : provisions appelées sur l'année, charges
   récupérables réelles au prorata de la durée du bail, solde (complément à demander ou trop-perçu à
   rendre), décompte à copier ; export CSV (échéances et dépenses).
6. **Réglages** : bailleur (nom et adresse, pour les quittances), zone de l'IRL (métropole, Corse, DOM),
   délais des relances (J+5, J+15, J+30 par défaut, modifiables), prorata du premier et du dernier mois,
   repères légaux et sources datées, effacement des locataires partis, CSV, sauvegarde JSON, compte, « Sur
   téléphone », données personnelles, à propos.

Premier lancement en 2 étapes : bailleur (nom, adresse) et premier bien (nom, adresse, type) avec conseils,
puis premier bail (locataire, type, début, loyer, charges, dépôt, jour d'échéance) et zone IRL ; tout est
facultatif sauf le nom du bien.

## Base intégrée (`templates/gestion-locative/donnees.js`)

- **Aucun indice IRL** : la table est vide au départ, l'utilisateur saisit les valeurs publiées par l'Insee
  (la démo utilise des indices fictifs signalés comme tels).
- Types de bail : vide, meublé, bail mobilité, avec le dépôt maximum (1 mois / 2 mois hors charges /
  interdit), la révision (autorisée si le bail le prévoit / interdite en bail mobilité) et le mode de charges
  proposé.
- 14 catégories de dépenses avec un réglage « récupérable » proposé (modifiable par dépense) : taxe
  foncière, taxe d'enlèvement des ordures ménagères, assurance propriétaire non occupant, charges de
  copropriété récupérables / non récupérables, eau, chauffage collectif, entretien des parties communes,
  travaux et réparations, entretien courant, frais de gestion, intérêts d'emprunt, frais bancaires, autre.
- Modèles de textes (à copier, rien n'est envoyé) : quittance, reçu de paiement partiel, rappel amiable,
  relance, mise en demeure (sans pénalité de retard), demande de révision du loyer, décompte de
  régularisation des charges, restitution du dépôt de garantie.
- Repères légaux sourcés (service-public.gouv.fr, date de vérification affichée), conseils de démarrage.

## Règles (fonctions pures `regles.js`, testées)

- Échéances mensuelles du début à la fin du bail, au jour d'échéance (borné à la fin du mois), prorata du
  premier et du dernier mois au nombre de jours (option des Réglages).
- Loyer et charges en vigueur à une date : historique des loyers (révisions, changements de provisions).
- État d'une échéance : payée, partielle, en retard (date dépassée, reste dû), à venir ; palier de relance
  selon le retard en jours (seuils réglables).
- Quittance si l'échéance est payée en entier, reçu sinon (le détail loyer / charges reste celui de
  l'échéance).
- Révision : date anniversaire du début du bail (ou date choisie) ; IRL nouveau = valeur du trimestre de
  référence la plus récente saisie avant la date de révision ; IRL ancien = même trimestre de l'année
  précédente ; nouveau loyer = loyer × nouveau ÷ ancien, arrondi au centime ; limite de demande = date de
  révision + 1 an − 1 jour ; application à partir de la date de la demande (jamais avant la date de
  révision) ; bloquée si pas de clause, bail mobilité ou DPE F ou G (case à cocher).
- Dépôt de garantie : contrôle du maximum selon le type ; date limite de restitution = remise des clés + 1
  mois (état des lieux conforme) ou + 2 mois ; rappel de la pénalité de 10 % du loyer mensuel hors charges
  par mois de retard commencé.
- Régularisation des charges (provisions seulement) : provisions appelées sur l'année − charges
  récupérables du bien × jours du bail dans l'année ÷ jours de l'année ; forfait : aucune régularisation.
- Rendement : brut = loyers hors charges appelés sur l'année ÷ (prix + frais + travaux) ; net = (loyers
  hors charges − dépenses non récupérables) ÷ même coût ; vacance = jours sans bail actif.

## Sources (vérifiées le 14/11/2026)

- Révision du loyer : service-public.gouv.fr F1311 (vérifiée le 08/08/2025) ; loi n° 89-462, art. 17-1,
  7-1, 25-9, 25-3, 25-16.
- IRL : service-public.gouv.fr F13723 (vérifiée le 15/10/2026) ; valeurs sur insee.fr, saisies par
  l'utilisateur.
- Quittance : service-public.gouv.fr F35247 (vérifiée le 25/08/2025) ; loi n° 89-462, art. 4 et 21.
- Dépôt de garantie : service-public.gouv.fr F31269 (vérifiée le 09/06/2026) ; loi n° 89-462, art. 22, 25-6,
  25-17.
- Charges récupérables et régularisation : service-public.gouv.fr F947 (vérifiée le 15/04/2025) ; décret
  n° 87-713 ; loi n° 89-462, art. 23 et 25-10.
- Frais de retard interdits : service-public.gouv.fr F2889 (vérifiée le 15/07/2026) ; loi n° 89-462, art. 4.
- Légifrance non consulté directement (pages des articles inaccessibles le 14/11/2026) : les articles sont
  cités d'après les fiches service-public.gouv.fr.

## Hors périmètre (V1)

Encadrement des loyers et zones tendues, fiscalité (micro-foncier, réel, LMNP), colocation à baux
multiples sur un même bien en même temps, préavis et congés, envoi d'e-mails ou de courriers, connexion
bancaire, génération de bail, état des lieux détaillé, stockage de pièces jointes.

## Risques

- Modèles de lettres : outil d'aide, pas un conseil juridique ; à adapter à la situation ; l'ADIL renseigne
  gratuitement (cité par service-public.gouv.fr).
- IRL : jamais intégré ; une valeur manquante bloque le calcul avec un message clair.
- Données des locataires (noms, éventuellement adresse) : minimum utile, effacement après le départ.
- Rendement affiché avant impôts et avant crédit : avertissement.
