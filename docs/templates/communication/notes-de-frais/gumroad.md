# Fiche Gumroad · Notes de frais et indemnités kilométriques

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Nom et prix d'après `IDEES.md` (T26, 15 €), **à confirmer par Quentin**.
**Aucun produit Gumroad n'a été créé.** La clé de licence est à activer à la main dans l'éditeur Gumroad
(Content → Insert → License key, sans multi-postes), puis l'identifiant produit reporté dans `PRODUITS`.

- **Produit interne** : `NDF` (préfixe des codes), application `https://qm-engineering.fr/templates/notes-de-frais/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-notes-de-frais-couverture.png` (1280 × 720, à générer par le
  coordinateur avec `outils/templates/couvertures-gumroad.cjs` et les 3 lignes de `couverture.txt`)
- **Bouton** : « Ouvrir mes notes de frais »
- **Catégorie** : `business-and-money/accounting` (Business & Money › Accounting)

## Nom

Notes de frais et indemnités kilométriques

## Prix

15 € (achat unique)

## Permalien

`notes-de-frais` (prévu ; l'URL réelle sera connue une fois la fiche créée)

## Résumé (une phrase)

Tes frais avancés et tes kilomètres au même endroit : justificatifs suivis, statut de remboursement, indemnités kilométriques au barème fiscal et note du mois prête à imprimer en PDF.

## Description (HTML)

```html
<h2>Chaque euro avancé, retrouvé.</h2>
<p>Un déjeuner chez un client, une nuit d'hôtel, un péage, un parking, cent kilomètres avec votre voiture… Chaque mois, il faut retrouver les tickets, recompter les kilomètres, appliquer le bon barème, remplir la note, puis attendre le remboursement. Les Notes de frais réunissent tout : la dépense, son justificatif et où il est rangé, le trajet au barème kilométrique, et la note du mois prête à imprimer.</p>
<h3>Ce que tu obtiens</h3>
<ul>
<li><strong>Chaque frais en quelques secondes</strong> : date, catégorie (18 catégories courantes : repas, hôtel, train, avion, taxi, péage, stationnement, carburant, fournitures…), montant TTC, TVA recopiée du justificatif (jamais calculée), mission ou client.</li>
<li><strong>Les justificatifs suivis</strong> : fourni ou à fournir, et où il est rangé (enveloppe, dossier, numéro de scan). Aucun fichier n'est stocké : les manquants sont signalés.</li>
<li><strong>Brouillon, soumis, remboursé</strong> : une note par mois, datée à chaque étape, et une alerte quand un remboursement se fait attendre.</li>
<li><strong>Les indemnités kilométriques au barème fiscal</strong> : voiture, moto ou cyclomoteur, puissance fiscale, électrique ; calcul sur le total de l'année par véhicule, montant au fil de l'eau, montant exact et régularisation expliquée. Barème des revenus 2025 intégré avec sa source et sa date, modifiable chaque année.</li>
<li><strong>La note du mois</strong> imprimable ou enregistrable en PDF, avec cadres de signature ; export CSV pour ton tableur ou ton comptable ; texte à copier.</li>
<li><strong>Tableau de bord</strong> : à rembourser, à soumettre, remboursé dans l'année, frais par mois et par catégorie.</li>
</ul><h3>Comment ça marche</h3>
<ol>
<li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li>
<li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li>
<li>Indique ton nom et ton véhicule, puis saisis tes frais et tes trajets au fil du mois. Tes données sont enregistrées en ligne et te suivent sur ordinateur, tablette et téléphone avec la même clé.</li>
</ol><p>Rien à installer, aucun compte à créer. Achat unique, sans abonnement.</p>
<p><em>Outil d'aide à la préparation de tes notes de frais : il ne remplace pas ton service comptable ni un professionnel. Le barème kilométrique intégré vient de la publication officielle (sources datées) ; ton employeur ou ton comptable peut appliquer d'autres règles, ce sont les leurs qui font foi. Aucun envoi automatique, aucun stockage de fichier. Démo disponible sur qm-engineering.fr/templates.</em></p>
```

## Tags (7)

1. notes-de-frais
2. frais-professionnels
3. indemnites-kilometriques
4. bareme-kilometrique
5. independant
6. comptabilite
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et tes notes de frais s'ouvrent. Indique ton véhicule, puis saisis tes frais et tes trajets : la note du mois se remplit toute seule. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Salariés qui avancent des frais, indépendants

## Avertissement (repris dans la description)

Outil d'aide : il ne remplace pas le service comptable ni un professionnel. Barème kilométrique intégré :
publication officielle du 9 avril 2026 (revenus 2025), relevée le 13/11/2026, modifiable ; celui des trajets
2026 sera publié au printemps 2027 (« à vérifier » dans l'application). Aucun stockage de justificatif.
