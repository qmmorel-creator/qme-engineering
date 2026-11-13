# Fiche Gumroad · Temps de vie

Texte à reporter dans la fiche Gumroad (**aucun produit créé à ce stade**, comme les autres templates prêts du
13/11/2026 ; même contenu dans `gumroad.json` et dans `../gumroad-a-creer.json`). Prix fixé par le cahier des
charges de Quentin (19 € TTC). La clé de licence est à activer à la main dans l'éditeur Gumroad (Content →
Insert → License key, sans multi-postes) ; reporter ensuite l'identifiant produit dans `PRODUITS`
(`netlify/lib/templates-acces.mjs`, clé `TDV`).

- **Application** : `https://qm-engineering.fr/templates/temps-de-vie/` (démo `?demo`, découverte gratuite sur l'écran de connexion)
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-temps-de-vie-couverture.png` (1280 × 720, générée)
- **Bouton** : « Ouvrir mon calculateur »
- **Catégorie** : `business-and-money/personal-finance`

## Nom

Temps de vie

## Prix

19 € (achat unique)

## Permalien

`temps-de-vie`

## Résumé

Combien d'heures de travail pour payer ce que tu consommes ? Chaque dépense, habitude ou ton mode de vie entier converti en heures et en jours de travail.

## Description (HTML)

```html
<h2>Combien d'heures de ta vie pour payer ce que tu consommes ?</h2><p>Un téléphone, un restaurant, un abonnement, ton loyer : derrière chaque dépense, il y a du temps de travail. Temps de vie fait la conversion avec ton revenu et ton temps de travail réels.</p><h3>Ce que tu obtiens</h3><ul><li><strong>Ton revenu horaire</strong> selon trois conventions affichées clairement : temps contractuel, temps réellement consacré au travail (trajet et frais professionnels), temps annuel effectif. Le calcul fonctionne même avec un profil incomplet, hypothèses signalées.</li><li><strong>Un calculateur instantané</strong> : n'importe quelle dépense en heures, jours et semaines de travail ; pour une dépense récurrente, le coût sur 1, 5 et 10 ans.</li><li><strong>Ton mode de vie en temps</strong> : une bibliothèque de dépenses (logement, mobilité, alimentation, équipement, loisirs, services, famille) que tu complètes, la part de chaque poste et le top 10 des dépenses les plus coûteuses en temps.</li><li><strong>Des scénarios A, B, C</strong> : économies mensuelles et annuelles, heures et jours de travail récupérés, cumul sur plusieurs années.</li><li><strong>Le coût réel d'un achat</strong> : prix, frais, entretien, usage et revente sur la durée de possession, pour comparer deux options.</li><li><strong>Un résultat partageable</strong> choisi par toi, sans ton revenu sauf si tu le coches. Exports CSV et JSON, rapport imprimable.</li></ul><h3>Comment ça marche</h3><ol><li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li><li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li><li>Indique ton revenu net et ton temps de travail, puis tes dépenses. Tes données sont enregistrées en ligne et te suivent sur tous tes appareils avec la même clé.</li></ol><p>Aucune connexion bancaire, aucun agenda, aucun connecteur externe. Achat unique, sans abonnement.</p><p><em>Les durées sont une équivalence (montant ÷ revenu net horaire estimé), pas un temps réellement travaillé. Aucun barème fiscal intégré : tous les montants sont les tiens. Outil d'aide à la réflexion, pas un conseil financier, fiscal ou professionnel. Démo et découverte gratuite sur qm-engineering.fr/templates.</em></p>
```

## Tags

1. budget
2. depenses
3. temps
4. finances-personnelles
5. minimalisme
6. economies
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton calculateur s'ouvre. Indique ton revenu net et ton temps de travail : chaque dépense se convertit en heures. Si tu as essayé la découverte gratuite sur le même navigateur, tu pourras reprendre ton profil et tes dépenses. Sur téléphone, ajoute la page à l'écran d'accueil pour l'ouvrir comme une application. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Particuliers qui veulent voir le coût réel de leur mode de vie

## À la mise en vente

1. Fiche créée, clé de licence activée par Quentin, identifiant reporté dans `PRODUITS`.
2. `catalogue/temps-de-vie/index.html` : prix 19 € et bouton Acheter à la place de « Mise en vente prochaine ».
3. `templates/index.html` : carte retirée de « En préparation », ajoutée à la vitrine ; `en/templates/index.html` : « Buy ».
4. Démo : lien `.bientot-demo` retiré du bandeau, nouveau `?v=` dans `index.html` et `sw.js`.
5. Liens « Application complète » de l'application (`PAGE_OFFRE`) : garder la page catalogue (elle portera le bouton Acheter).
