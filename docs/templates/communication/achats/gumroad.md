# Fiche Gumroad · Demandes d'achat et fournitures

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json` dans
`gumroad.json`. Prix prévu dans `IDEES.md` (19 €) : **nom et prix à confirmer par Quentin**. **Aucun produit Gumroad
n'a été créé** (consigne de la mission du 14/11/2026). La clé de licence est à activer à la main dans l'éditeur
Gumroad (Content → Insert → License key, **sans multi-postes** : la clé est partagée par l'équipe, mais c'est une
seule licence), puis l'identifiant produit reporté dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ
`gumroad` de `ACH`). L'entrée n'a pas été ajoutée à `../gumroad-a-creer.json` (fichier partagé, laissé au
coordinateur).

- **Produit interne** : `ACH` (préfixe des codes), application `https://qm-engineering.fr/templates/achats/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-achats-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir les demandes d'achat »
- **Catégorie** : `business-and-money/management-and-leadership` (Business & Money › Management & Leadership), **à confirmer** dans la liste Gumroad.

## Nom

Demandes d'achat et fournitures

## Prix

19 € (achat unique)

## Permalien

`demandes-achat-fournitures` (à confirmer à la création)

## Résumé (une phrase)

Demandes par service, validation avec seuil automatique, commandes groupées par fournisseur, réception partielle et budget annuel par service, avec un catalogue de 104 fournitures. Une clé pour toute l'équipe.

## Description (HTML)

```html
<h2>Qui a demandé quoi, et où en est le budget.</h2><p>Des demandes de fournitures par e-mail, sur un post-it ou dans un tableur partagé, des validations orales, des commandes passées quand on y pense, et personne ne sait ce qu'il reste au budget du service. Demandes d'achat et fournitures met tout le circuit au même endroit, du besoin à la réception.</p><h3>Ce que tu obtiens</h3><ul><li><strong>Des demandes claires</strong> : qui, quoi, combien, pour quel service, avec quelle urgence et pourquoi. Plusieurs articles en une fois, choisis dans un catalogue de 104 fournitures courantes, sans prix ni marque imposés.</li><li><strong>Une validation rapide</strong> : sous le seuil que tu fixes, une demande chiffrée qui tient dans le budget du service est validée tout de suite. Au-dessus, la personne qui valide voit l'effet sur le budget, valide ou refuse avec un motif.</li><li><strong>Des commandes groupées par fournisseur</strong> : un bon de commande imprimable, articles identiques additionnés, minimum de commande signalé.</li><li><strong>La réception, même partielle</strong> : au prix réel ; le reliquat reste attendu, les retards de livraison sont signalés.</li><li><strong>Le budget annuel de chaque service</strong> : consommé, engagé, en attente, disponible ; exercice civil ou décalé.</li><li><strong>L'historique</strong> : délais de validation et de livraison, taux de refus, dépenses par mois, par catégorie et par service ; export CSV.</li></ul><h3>Comment ça marche</h3><ol><li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li><li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la ; indique tes services, leur budget et ton seuil de validation.</li><li>Transmets la clé aux personnes qui demandent et à celles qui valident : chacune la saisit une fois sur son appareil et indique son nom. Pas de compte à créer.</li></ol><p>Rien à installer. Achat unique, sans abonnement, quel que soit le nombre de personnes.</p><p><em>Une clé partagée, sans comptes ni droits différents : toute personne qui a la clé peut demander, valider, commander et réceptionner ; chaque étape garde le nom saisi. Aucun fournisseur, aucune messagerie ni aucun paiement connecté : le bon s'imprime ou se recopie. Montants estimés par l'équipe, sans calcul de TVA : ce n'est pas une comptabilité. Démo disponible sur qm-engineering.fr/catalogue/achats.</em></p>
```

## Tags (7)

1. achats
2. fournitures
3. moyens-generaux
4. office-manager
5. pme
6. association
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et indique tes services et ton seuil de validation. Transmets ensuite la clé aux personnes qui demandent et à celles qui valident : chacune la saisit une fois sur son appareil. Garde cet e-mail : la même clé fonctionne sur tous les appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail, partagée par l'équipe
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Office managers, services généraux, associations

## Avertissement (repris dans la description)

Une clé partagée, sans comptes ni droits différents (choix de cadrage de la V1) : toute personne qui a la clé peut
demander, valider, commander et réceptionner. Les noms saisis sont des données personnelles : l'organisation qui
utilise l'outil en est responsable (prénom suffisant, effacement des noms des demandes anciennes dans les Réglages).
Aucune donnée réglementaire, fiscale ni datée dans l'outil ; aucun prix intégré.

## Point à trancher par Quentin

Licence « une clé pour toute l'équipe » au même prix qu'un template individuel (19 €), comme pour la réservation de
salles (T50) : à confirmer, ou prévoir une variante « équipe ».
