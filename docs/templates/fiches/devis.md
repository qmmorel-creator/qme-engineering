# T36 · Générateur de devis

Slug `devis`, préfixe `DVS`, prix 29 €, permalien Gumroad `generateur-devis`, taille M, priorité P1.
Origine : backlog de Quentin n° 11 (12/11/2026). Artefact d'inspiration « Devis artisan » : **mécanique
seulement** (lignes, totaux, impression), aucun contenu, nom ou montant repris. Fiche rédigée le
12/11/2026.

## Pour qui

Artisans (bâtiment, dépannage, entretien) et freelances (web, graphisme, rédaction, conseil, formation,
photo) qui font leurs devis dans un traitement de texte ou un tableur : totaux recalculés à la main,
erreurs d'arrondi de TVA, numérotation perdue, mentions oubliées, aucun suivi de ce qui a été accepté.
Ceux pour qui un logiciel de gestion complet est trop cher ou trop lourd pour faire des devis.

## Promesse

Un devis propre, juste au centime et complet en mentions, en quelques minutes, à imprimer ou enregistrer
en PDF, et la liste de tous tes devis avec leur statut.

## Périmètre

**Devis seulement.** Pas de factures : la facturation électronique entre entreprises devient
obligatoire (déploiement en cours, calendrier sur impots.gouv.fr) ; le template ne prétend pas être un
logiciel de facturation. Il le dit dans l'aide, la FAQ du site et la fiche Gumroad.

## Écrans (5 onglets)

1. **Devis** : tuiles (en attente de réponse : nombre et montant HT ; acceptés sur 12 mois : montant
   HT ; taux d'acceptation des devis tranchés ; validité dépassée), filtre par statut, recherche
   (numéro, client, objet), liste triée par date. Chaque devis : numéro, client, objet, date, total
   HT et TTC, statut. Actions : ouvrir, dupliquer, changer le statut, supprimer (toast « Annuler »).
2. **Éditeur** (ouvert depuis la liste) : en-tête (client, objet, date, validité, lieu, début et durée
   prévus), lignes, remise globale, acompte, conditions, notes ; totaux en direct ; ajout depuis le
   catalogue ; aperçu A4 et impression.
3. **Catalogue** : prestations et fournitures (désignation, unité, prix unitaire HT, taux de TVA par
   défaut, catégorie) ; import d'une liste type par métier (sans prix).
4. **Clients** : nom, adresse, e-mail, téléphone, particulier ou professionnel (SIREN facultatif),
   nombre de devis et montant accepté.
5. **Entreprise** : identité et mentions (nom, mention EI ou forme juridique et capital, adresse,
   SIREN, RCS ou RNE, n° de TVA intracommunautaire, franchise en base de TVA), assurance
   professionnelle, préfixe de numérotation, validité et acompte par défaut, conditions de paiement,
   taux de TVA utilisables (modifiables), et la page « Mentions et sources » (liste vérifiée, datée).

Réglages (roue) : sauvegarde (export / import JSON), compte, déconnexion.

## Saisie d'une ligne

Type (prestation, titre de section, texte libre), désignation, quantité (jusqu'à 3 décimales), unité,
prix unitaire HT (au centime), remise de ligne en %, taux de TVA de la ligne. Réordonner (haut / bas),
dupliquer, supprimer.

## Mécanique clé (règles pures, centimes entiers)

- Montant brut de ligne = arrondi(quantité × PU) ; remise de ligne = arrondi(brut × remise %) ;
  net HT de ligne = brut − remise.
- Bases HT regroupées par taux de TVA. **Remise globale** en % (appliquée à chaque base) ou en euros
  (répartie au prorata des bases, plus forts restes : la somme répartie est exactement la remise).
- **TVA calculée par taux** sur chaque base (arrondi au centime le plus proche, demi vers le haut),
  TTC = HT + TVA. Franchise en base : TVA à 0 et mention « TVA non applicable - article 293 B du CGI ».
- **Acompte** en % du TTC ou en euros (plafonné au TTC) ; reste à payer = TTC − acompte.
- **Numérotation** : `<préfixe>-<année>-<n° sur 3 chiffres>`, compteur par année = plus grand numéro
  existant + 1 (jamais réutilisé après suppression du dernier dans la session : on prend le maximum
  du compteur mémorisé et des devis existants).
- **Statut** : brouillon → envoyé (date d'envoi) → accepté / refusé (date) ; « validité dépassée »
  calculé pour un devis envoyé dont la date + validité est passée. Seul un brouillon est modifiable
  sans avertissement ; modifier un devis envoyé le signale.
- **Duplication** : nouveau numéro, date du jour, statut brouillon, mêmes lignes.
- **Mentions manquantes** : contrôle avant impression (nom, adresse, SIREN, client, objet, au moins une
  ligne, assurance si cochée obligatoire) ; liste affichée dans l'éditeur.

## Base intégrée

- **12 catalogues types par métier, sans prix** (8 à 12 lignes chacun, unité adaptée) : plomberie
  chauffage, électricité, peinture et revêtements, menuiserie, maçonnerie, carrelage, jardin et
  paysage, développement web, graphisme, rédaction et traduction, conseil et
  formation, photographie et vidéo (le métier « bâtiment » est signalé pour le rappel décennale).
- **Unités** : u, h, j, forfait, m², m, m³, kg, lot, mois, page, mot.
- **Taux de TVA** (modifiables, source et date affichées) : 20 %, 10 %, 5,5 %, 2,1 %, 0 %.
- **Mentions** : liste des mentions d'un devis de travaux et de dépannage, mentions d'identification
  d'une entreprise individuelle et d'une société, assurance professionnelle, acceptation du client,
  acompte et arrhes, taux réduits pour les travaux dans les logements.
- Conditions de paiement types (à reprendre ou modifier).

## Sources (consultées le 12/11/2026)

- entreprendre.service-public.gouv.fr, F31144 « Devis obligatoire : activités concernées » (vérifiée le
  09/09/2022) : mentions du devis de travaux et dépannage (date, nom et adresse de l'entreprise, nom du
  client, lieu d'exécution, nature exacte des travaux, décompte détaillé en quantité et prix, taux
  horaire TTC de main-d'œuvre, modalités de décompte du temps, frais de déplacement, somme globale HT et
  TTC avec taux de TVA, durée de validité, gratuit ou payant, coût s'il est payant).
- entreprendre.service-public.gouv.fr, F37370 « Documents commerciaux d'une entreprise individuelle »
  et F37371 « … d'une société » (vérifiées le 08/12/2025) : mention EI, SIREN, RCS ou RNE, forme
  juridique et capital, assurance professionnelle obligatoire (coordonnées de l'assureur, couverture
  géographique) sur devis et factures pour les entreprises du secteur des métiers et de l'artisanat.
- legifrance.gouv.fr : code de l'artisanat art. L132-1 (en vigueur depuis le 01/07/2023), code des
  assurances art. L243-2 (version en vigueur depuis le 08/08/2015 : attestations d'assurance décennale
  jointes aux devis et factures).
- service-public.gouv.fr, F2533 (vérifiée le 16/10/2026) : « bon pour travaux » ou « bon pour accord »
  au-dessus de la signature ; devis en général gratuit, payant si annoncé ; acompte et arrhes (« si rien
  n'est indiqué sur le devis, la somme versée est considérée comme des arrhes »).
- entreprendre.service-public.gouv.fr, F21746 « Franchise en base de TVA » (vérifiée le 01/01/2026) :
  mention « TVA non applicable - article 293 B du CGI ».
- impots.gouv.fr « Plusieurs taux de TVA » (20 %, 10 %, 5,5 %) et « Quels sont les différents taux de
  TVA applicables dans les DOM ? » (modifiée le 13/10/2026 : 8,5 % et 2,1 % ; non applicable en Guyane
  et à Mayotte) ; economie.gouv.fr « Entreprises : ce que vous devez savoir sur la TVA » (quatre taux
  en métropole dont 2,1 %) ; entreprendre.service-public.gouv.fr F23568 (vérifiée le 21/02/2026) :
  10 % et 5,5 % pour les travaux dans les logements achevés depuis plus de 2 ans, attestation du client.

Assurance par métier : **aucune liste « métier → assurance obligatoire » n'est intégrée** (aucune source
officielle consolidée trouvée) ; l'utilisateur coche si son métier l'impose. Seul rappel : pour les
travaux soumis à la garantie décennale, joindre l'attestation (art. L243-2).

## Risques et avertissements

- **Fiscal / daté** : taux de TVA et mentions à revérifier une fois par an ; taux modifiables ; l'aide
  rappelle que le choix du taux réduit dépend de conditions (logement de plus de 2 ans, attestation).
- **Comptable** : pas un logiciel de facturation ni de comptabilité ; ne produit aucune facture.
- **RGPD** : données de clients (tiers) hébergées en ligne : rappel dans l'aide (minimisation, droits).
- Exemples et démo 100 % fictifs (entreprise et clients inventés, domaines `example.com`).

## Choix d'implémentation

- Socle `templates/revision/` ; règles pures dans `templates/devis/regles.js` (`globalThis.DVS_REGLES`),
  testées par `outils/templates/devis.test.mjs`.
- Montants en centimes entiers, quantités en millièmes, remises en centièmes de pourcent, taux de TVA
  en centièmes de pourcent (2000 = 20 %) : aucun calcul en virgule flottante sur l'argent.
- Le client est recopié dans le devis à sa création (un devis envoyé ne change pas si la fiche client
  change) ; bouton « Reprendre la fiche client » dans l'éditeur.
- Impression : feuille A4 (`@page { size: A4; margin: 14mm }`), tout le reste masqué ; PDF par
  « Enregistrer au format PDF » du navigateur.
