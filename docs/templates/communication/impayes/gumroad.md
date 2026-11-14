# Fiche Gumroad · Relance des impayés

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Prix prévu dans `IDEES.md` (19 €) : **nom et prix à confirmer par Quentin**.
**Aucun produit Gumroad n'a été créé.** La clé de licence est à activer à la main dans l'éditeur Gumroad
(Content → Insert → License key, sans multi-postes), puis l'identifiant produit reporté dans `PRODUITS`.

- **Produit interne** : `RCV` (préfixe des codes), application `https://qm-engineering.fr/templates/impayes/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-impayes-couverture.png` (1280 × 720, à générer par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir mes relances »
- **Catégorie** : `business-and-money/accounting` (Business & Money › Accounting)

## Nom

Relance des impayés

## Prix

19 € (achat unique)

## Permalien

`relance-impayes` (à confirmer à la création)

## Résumé (une phrase)

Tes factures en retard au même endroit : le retard en jours, les pénalités et l'indemnité calculées, et le message de relance de chaque palier prêt à copier.

## Description (HTML)

```html
<h2>Chaque facture payée à temps.</h2>
<p>Une facture en retard de trois semaines, une autre payée à moitié, un client qui ne répond plus… Sans suivi, on relance trop tard, avec les mauvais mots, et on oublie ce que la loi permet de réclamer. La Relance des impayés réunit tes factures en attente, calcule le retard et les pénalités, et te prépare le bon message au bon moment.</p>
<h3>Ce que tu obtiens</h3>
<ul>
<li><strong>L'échéancier clair</strong> : encours, échu par ancienneté (0-30, 31-60, 61-90, plus de 90 jours), retard en jours et statut calculé de chaque facture (à échoir, échue, en relance, payée, litige, abandonnée).</li>
<li><strong>Les pénalités calculées</strong> : intérêts simples au prorata des jours sur le restant dû, paiements partiels datés compris, détail période par période ; indemnité forfaitaire de 40 € entre professionnels.</li>
<li><strong>Des taux datés et modifiables</strong> : taux BCE du semestre + 10 points (article L441-10 du Code de commerce), taux de tes conditions générales, ou intérêt légal à partir de la mise en demeure pour un client particulier.</li>
<li><strong>4 paliers de relance</strong> (rappel courtois, relance ferme, mise en demeure, dernier avis), délais et modèles modifiables, avec 18 champs remplis automatiquement : montant, numéro, retard, pénalités, date limite…</li>
<li><strong>Copier, pas envoyer</strong> : chaque message se copie d'un bouton ; tu l'envoies depuis ta messagerie, puis tu le notes au journal des relances de la facture.</li>
<li><strong>Données des clients minimales</strong> : nom, type, un contact facultatif ; effacement des données personnelles en un geste ; export CSV pour ton comptable.</li>
</ul><h3>Comment ça marche</h3>
<ol>
<li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li>
<li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li>
<li>Saisis tes factures en attente (client, numéro, montant TTC, échéance) et les paiements reçus : le retard, les pénalités et la prochaine relance se calculent. Tes données sont enregistrées en ligne et te suivent sur ordinateur, tablette et téléphone avec la même clé.</li>
</ol><p>Rien à installer, aucun compte à créer. Achat unique, sans abonnement.</p>
<p><em>Aucun e-mail envoyé, aucune connexion à une messagerie, une banque ou un logiciel de facturation. Outil d'aide au suivi des paiements, pas un conseil juridique : les montants sont des estimations, tes conditions générales et les textes en vigueur font foi. Taux relevés le 13/11/2026, à mettre à jour chaque semestre dans les réglages. Démo disponible sur qm-engineering.fr/templates.</em></p>
```

## Tags (7)

1. impayes
2. relance
3. factures
4. penalites-de-retard
5. freelance
6. tpe
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton suivi s'ouvre. Saisis tes factures en attente et les paiements reçus : le retard, les pénalités et les relances se calculent. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : TPE, artisans et freelances

## Avertissement (repris dans la description)

Aucun envoi, aucune connexion à une messagerie, une banque ou un logiciel de facturation. Outil d'aide au
suivi des paiements, pas un conseil juridique ; estimations ; conditions générales et textes font foi.
Taux relevés le 13/11/2026 (Légifrance, Banque de France ; intérêt légal d'après une source secondaire,
à vérifier), à mettre à jour chaque 1er janvier et 1er juillet.
