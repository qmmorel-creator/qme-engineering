# Fiche Gumroad · Simulateur leasing ou achat

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Prix prévu : 12 € (prix minimum de Quentin) : **nom et prix à confirmer par Quentin**.
**Aucun produit Gumroad n'a été créé.** La clé de licence est à activer à la main dans l'éditeur Gumroad
(Content → Insert → License key, sans multi-postes), puis l'identifiant produit reporté dans `PRODUITS`.

- **Produit interne** : `VTR` (préfixe des codes), application `https://qm-engineering.fr/templates/leasing/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-leasing-couverture.png` (1280 × 720, à générer par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir mon simulateur »
- **Catégorie** : `business-and-money/personal-finance` (Business & Money › Personal Finance)

## Nom

Simulateur leasing ou achat

## Prix

12 € (achat unique)

## Permalien

`simulateur-leasing-achat` (à confirmer à la création)

## Résumé (une phrase)

Comptant, crédit, LOA ou LLD : le coût total net de chaque offre de voiture côte à côte, revente estimée, kilomètres en plus et frais compris, avec le coût par mois et par kilomètre.

## Description (HTML)

```html
<h2>Ta voiture, au vrai prix.</h2>
<p>Un loyer de LOA, une offre de crédit, une proposition de LLD, un prix au comptant… Chaque vendeur met en avant un chiffre différent, et aucun ne dit combien la voiture coûtera vraiment sur la période. Le Simulateur leasing ou achat ramène toutes tes offres au même étalon : le coût total net, revente et kilomètres compris.</p>
<h3>Ce que tu obtiens</h3>
<ul>
<li><strong>Quatre façons de payer côte à côte</strong> : comptant, crédit amortissable (mensualité et coût des intérêts calculés par la formule d'annuité), LOA avec premier loyer, loyers et option d'achat levée ou non, LLD avec forfait kilométrique et prix du kilomètre en plus.</li>
<li><strong>Le coût total net</strong> sur la durée de détention : versements, assurance, entretien (inclus ou non), frais de dossier, option d'achat, capital restant dû, moins la valeur de revente estimée. Puis le coût mensuel équivalent et le coût au kilomètre.</li>
<li><strong>Tes kilomètres réels face au forfait</strong> : dépassement et coût estimés, et le kilométrage annuel à partir duquel une offre devient moins chère qu'une autre.</li>
<li><strong>Des hypothèses que tu choisis</strong> : décote annuelle, effet du kilométrage sur la revente, coût d'opportunité de l'apport (taux de placement saisi).</li>
<li><strong>Le coût cumulé dans le temps</strong> en graphique, et le détail du calcul de chaque offre, poste par poste.</li>
<li><strong>Ce qu'il faut demander au vendeur</strong> : 18 questions par type d'offre, à cocher et à copier.</li>
</ul><h3>Comment ça marche</h3>
<ol>
<li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li>
<li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li>
<li>Indique le véhicule, la durée et tes kilomètres par an, puis reporte les montants de chaque offre reçue : le classement se calcule. Tes comparaisons sont enregistrées en ligne et te suivent sur ordinateur, tablette et téléphone avec la même clé.</li>
</ol><p>Rien à installer, aucun compte à créer. Achat unique, sans abonnement.</p>
<p><em>Simulation à partir de ta saisie, pas un conseil financier : les offres écrites et les contrats font foi. Aucune donnée de marché intégrée, aucune connexion à une banque, un vendeur ou un loueur. Pour les indépendants, la fiscalité (déductibilité, TVA, amortissement) n'est pas calculée. Démo disponible sur qm-engineering.fr/templates.</em></p>
```

## Tags (7)

1. leasing
2. loa
3. lld
4. credit-auto
5. voiture
6. budget
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton simulateur s'ouvre. Indique le véhicule et tes kilomètres, puis reporte les montants de tes offres : le coût total net de chacune se calcule. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Particuliers et indépendants qui choisissent une voiture

## Avertissement (repris dans la description)

Simulation à partir de la saisie, pas un conseil financier ; les offres écrites et les contrats font foi.
Aucune donnée de marché intégrée (prix, taux, cotes), aucune connexion à une banque, un vendeur ou un loueur.
Fiscalité des indépendants (déductibilité, TVA, amortissement, avantage en nature) signalée, non calculée.
Rien de daté à mettre à jour.
