# Fiche Gumroad · Stocks et inventaire

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Prix prévu dans `IDEES.md` (25 €) : **nom et prix à confirmer par Quentin**.
**Aucun produit Gumroad n'a été créé.** La clé de licence est à activer à la main dans l'éditeur Gumroad
(Content → Insert → License key, sans multi-postes), puis l'identifiant produit reporté dans `PRODUITS`.

- **Produit interne** : `STK` (préfixe des codes), application `https://qm-engineering.fr/templates/stocks/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-stocks-couverture.png` (1280 × 720, à générer par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir mon stock »
- **Catégorie** : `business-and-money/management-and-leadership` (Business & Money › Management & Leadership),
  **à confirmer** : aucune catégorie « gestion de stock » n'a été vérifiée dans la liste Gumroad ; la
  catégorie « Accounting » est écartée exprès (ce n'est pas un logiciel comptable).

## Nom

Stocks et inventaire

## Prix

25 € (achat unique)

## Permalien

`stocks-inventaire` (à confirmer à la création)

## Résumé (une phrase)

Ton stock calculé à partir des entrées et sorties datées, les alertes de seuil et la liste à commander, la valeur au coût moyen pondéré et des inventaires dont les écarts se corrigent d'un clic.

## Description (HTML)

```html
<h2>Le bon stock, au bon moment.</h2>
<p>Une rupture découverte devant le client, des cartons qui dorment au fond de la réserve, un inventaire de fin d'année qui ne tombe jamais juste… Sans suivi, le stock coûte cher sans qu'on le voie. Stocks et inventaire calcule ton stock à partir de chaque mouvement, te dit quoi commander et ce que vaut ce que tu as en rayon.</p>
<h3>Ce que tu obtiens</h3><ul>
<li><strong>Un stock toujours juste</strong> : il se calcule à partir des mouvements datés (entrée, sortie ou vente, perte, retour client ou fournisseur, ajustement). Une saisie oubliée et datée après coup se range à sa date. Quantités décimales pour le poids, le volume ou la longueur.</li>
<li><strong>Des fiches articles simples</strong> : référence, nom, catégorie, unité, emplacement, fournisseur (texte libre), prix d'achat et de vente HT, seuil d'alerte, quantité de réapprovisionnement.</li>
<li><strong>Les alertes et la liste à commander</strong> : ruptures et articles sous le seuil, quantité proposée, commandes regroupées par fournisseur avec un texte prêt à copier, et un bouton « Réception » pour enregistrer la livraison.</li>
<li><strong>La valeur du stock</strong> au coût moyen pondéré (CMUP, recalculé à chaque entrée) ou au dernier prix d'achat : la méthode est toujours affichée, l'export donne les deux. Marge théorique, taux de marque et coefficient sur tes prix de vente HT.</li>
<li><strong>Rotation et articles dormants</strong> : ventes de la période, jours de stock restants, articles sans vente depuis 90 jours (réglable) et l'argent qu'ils immobilisent.</li>
<li><strong>L'inventaire tournant ou complet</strong> : tu saisis ce que tu comptes, l'écart avec le stock théorique s'affiche en quantité et en euros, et la validation crée les ajustements. Export CSV du stock et des mouvements.</li>
</ul><h3>Comment ça marche</h3><ol>
<li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li>
<li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li>
<li>Crée tes articles avec leur stock de départ, puis note chaque entrée et chaque vente : le stock, les alertes et la valeur se calculent. Tes données sont enregistrées en ligne et te suivent sur ordinateur, tablette et téléphone avec la même clé.</li>
</ol><p>Rien à installer, aucun compte à créer. Achat unique, sans abonnement.</p>
<p><em>Aucune connexion à une caisse, une boutique en ligne ou un logiciel comptable : chaque mouvement se saisit dans l'outil. Outil de gestion de stock, pas un logiciel comptable : la valorisation comptable du stock à la clôture relève de ton expert-comptable. Démo disponible sur qm-engineering.fr/catalogue/stocks.</em></p>

```

## Tags (7)

1. stock
2. inventaire
3. gestion-de-stock
4. commerce
5. artisan
6. e-commerce
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton stock s'ouvre. Crée tes articles avec leur stock de départ, puis note tes entrées et tes ventes : alertes, liste à commander et valeur se calculent. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Petits commerces, artisans, ateliers, e-commerçants

## Avertissement (repris dans la description)

Aucune connexion à une caisse, une boutique en ligne ou un logiciel comptable. Outil de gestion de stock,
pas un logiciel comptable : valeurs calculées à partir de la saisie, en prix hors taxes ; la valorisation
comptable du stock à la clôture relève de l'expert-comptable. Pas de base datée : aucun taux ni prix
intégré à mettre à jour.
