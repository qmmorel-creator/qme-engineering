# Fiche Gumroad · Inventaire valorisé

Texte à reporter dans la fiche Gumroad (**aucun produit créé à ce stade**, comme les autres templates prêts du
13/11/2026 ; même contenu dans `gumroad.json` et dans `../gumroad-a-creer.json`). Prix fixé par le cahier des
charges de Quentin (19 € TTC). La clé de licence est à activer à la main dans l'éditeur Gumroad (Content →
Insert → License key, sans multi-postes) ; reporter ensuite l'identifiant produit dans `PRODUITS`
(`netlify/lib/templates-acces.mjs`, clé `PTM`).

- **Application** : `https://qm-engineering.fr/templates/patrimoine/` (démo `?demo`, découverte gratuite sur l'écran de connexion)
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-patrimoine-couverture.png` (1280 × 720, générée)
- **Bouton** : « Ouvrir mon inventaire »
- **Catégorie** : `business-and-money/personal-finance`

## Nom

Inventaire valorisé

## Prix

19 € (achat unique)

## Permalien

`inventaire-valorise`

## Résumé

Combien valent vraiment tes affaires ? Inventorie tes objets en quelques secondes : valeur actuelle estimée, revente potentielle frais déduits, et ce qui dort sans servir.

## Description (HTML)

```html
<h2>Si tu revendais tout aujourd'hui, combien récupérerais-tu ?</h2><p>Électronique, meubles, vélo, instruments, outillage, collections : on possède beaucoup plus de valeur qu'on ne le croit, et une partie dort au fond des placards. L'Inventaire valorisé transforme ta liste d'objets en bilan chiffré.</p><h3>Ce que tu obtiens</h3><ul><li><strong>Un inventaire en quelques secondes</strong> : 15 catégories, 80 sous-catégories et des centaines d'exemples d'objets ; un toucher, un prix, une date approximative.</li><li><strong>Trois valeurs jamais confondues</strong> : prix d'achat, valeur actuelle estimée (âge, état, famille d'objet, prix) et revente potentielle. Tu saisis la valeur toi-même quand tu la connais.</li><li><strong>Un moteur de décote transparent</strong> : 8 familles d'objets, coefficients visibles et modifiables.</li><li><strong>Un simulateur de revente</strong> : tout, une catégorie, les objets inutilisés, au-dessus d'un prix ou un nombre d'objets ; décote, négociation, commission et expédition déduites.</li><li><strong>L'analyse de possession</strong> : argent immobilisé, objets de valeur peu ou jamais utilisés, plus fortes pertes, part facilement revendable.</li><li><strong>Un historique</strong> : une valorisation par mois, comparaison entre deux dates, projection sur 5 ans. Exports CSV et JSON, rapport imprimable.</li></ul><h3>Comment ça marche</h3><ol><li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li><li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li><li>Coche les familles d'objets que tu possèdes et ajoute tes objets. Tes données sont enregistrées en ligne et te suivent sur ordinateur, tablette et téléphone avec la même clé.</li></ol><p>Aucun nom ni adresse demandé, aucune connexion à un site de vente, rien de partagé automatiquement. Achat unique, sans abonnement.</p><p><em>Estimations indicatives calculées par des règles de décote paramétrables : ce n'est ni une expertise, ni une valeur d'assurance, ni une valeur comptable, ni une garantie de prix de revente. Aucun prix de marché n'est intégré ni récupéré. Démo et découverte gratuite sur qm-engineering.fr/templates.</em></p>
```

## Tags

1. inventaire
2. patrimoine
3. revente
4. objets
5. budget
6. minimalisme
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton inventaire s'ouvre. Coche les familles d'objets que tu possèdes et ajoute tes objets : le bilan se calcule. Si tu as essayé la découverte gratuite sur le même navigateur, tu pourras reprendre tes objets. Sur téléphone, ajoute la page à l'écran d'accueil pour l'ouvrir comme une application. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Particuliers qui veulent connaître la valeur de leurs biens

## À la mise en vente

1. Fiche créée, clé de licence activée par Quentin, identifiant reporté dans `PRODUITS`.
2. `catalogue/patrimoine/index.html` : prix 19 € et bouton Acheter à la place de « Mise en vente prochaine ».
3. `templates/index.html` : carte retirée de « En préparation », ajoutée à la vitrine ; `en/templates/index.html` : « Buy ».
4. Démo : lien `.bientot-demo` retiré du bandeau, nouveau `?v=` dans `index.html` et `sw.js`.
5. Liens « Application complète » de l'application (`PAGE_OFFRE`) : garder la page catalogue (elle portera le bouton Acheter).
