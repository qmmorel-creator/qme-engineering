# Fiche Gumroad · Suivi de chantier par lot

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), source : `gumroad.json` (même format que
`../gumroad-a-creer.json`). Prix prévu dans `IDEES.md` (40 €) : **nom et prix à confirmer par Quentin**.
**Aucun produit Gumroad n'a été créé.** La clé de licence est à activer à la main dans l'éditeur Gumroad
(Content → Insert → License key, sans multi-postes), puis l'identifiant produit reporté dans `PRODUITS`
(`netlify/lib/templates-acces.mjs`, entrée `CHT`).

- **Produit interne** : `CHT` (préfixe des codes), application `https://qm-engineering.fr/templates/suivi-chantier/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-suivi-chantier-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs`), à ajouter une fois en ligne
- **Bouton** : « Ouvrir mon suivi de chantier »
- **Catégorie** : `business-and-money/management-and-leadership` (Business & Money › Management & Leadership), **à confirmer** dans la
  liste Gumroad.

## Nom

Suivi de chantier par lot

## Prix

40 € (achat unique)

## Permalien

`suivi-chantier-lot` (à confirmer à la création)

## Résumé (une phrase)

Chaque lot de ton chantier tenu, du marché au solde : avenants, situations de travaux calculées, échéancier et courbe d'avancement, jalons recalés par les intempéries, non-conformités, risques, ordres de service et revue de projet.

## Description (HTML)

```html
<h2>Chaque lot tenu, du marché au solde.</h2>
<p>Un tableur par lot pour les situations, un autre pour les avenants, des courriers dans la messagerie, un journal de chantier sur papier, et une revue de projet à reconstruire avant chaque réunion… Le Suivi de chantier par lot rassemble le pilotage contractuel et financier d'une opération, lot par lot, et prépare la revue de projet à ta place.</p>
<h3>Ce que tu obtiens</h3>
<ul>
<li><strong>Le marché de chaque lot</strong> : entreprise, montant initial, avenants signés, en projet ou refusés, marché actualisé et écart en pourcentage. Sous-traitants déclarés, montant, acceptation et paiement direct.</li>
<li><strong>Des situations de travaux calculées</strong> : tu saisis le cumul des travaux exécutés, l'outil donne les travaux du mois, la révision (coefficient K de ta formule), la retenue de garantie, les pénalités déduites, le net HT et la date de paiement attendue. Dépassement du marché et retards de paiement signalés.</li>
<li><strong>L'échéancier et la courbe d'avancement</strong> : prévu réparti au prorata des jours entre le début et la fin de chaque lot, retouchable mois par mois ; réalisé issu des situations ; écart au prévisionnel.</li>
<li><strong>Des jalons recalés</strong> : délais des avenants signés et intempéries retenues dans le journal de chantier, état de chaque jalon (atteint, en retard, proche) et pénalités encourues estimées d'après ton CCAP.</li>
<li><strong>Les registres</strong> : non-conformités simplifiées (gravité, action, échéance), risques en matrice 4 × 4 avec réponse, action et porteur, courriers et ordres de service avec la réponse attendue, intervenants.</li>
<li><strong>La revue de projet</strong> : délais, finances, qualité, risques, courriers en attente et points à arbitrer, à imprimer ou à copier dans ton compte rendu. Exports CSV de la synthèse financière et des situations.</li>
</ul><h3>Comment ça marche</h3>
<ol>
<li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li>
<li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li>
<li>Crée ton opération à partir du découpage type en lots, saisis le marché de chaque lot, puis tes situations, avenants et jalons. Tes opérations sont enregistrées en ligne et te suivent sur ordinateur, tablette et téléphone avec la même clé.</li>
</ol><p>Rien à installer, aucun compte à créer. Achat unique, sans abonnement. Plusieurs opérations avec la même clé.</p>
<p><em>Outil de suivi, pas un conseil juridique. Aucun indice de révision ni taux réglementaire intégré : retenue de garantie, délai de paiement, coefficient K et pénalités se saisissent d'après ton marché ; les pénalités affichées sont une estimation. Montants hors taxes. Aucun envoi d'e-mail ni lien avec un autre logiciel. Démo disponible sur qm-engineering.fr/catalogue/suivi-chantier.</em></p>
```

## Tags

`btp`, `chantier`, `maitrise-d-oeuvre`, `conduite-de-travaux`, `gestion-de-projet`, `situations-de-travaux`, `francais`

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton suivi de chantier s'ouvre. Crée ton opération à partir du découpage type en lots, saisis le marché de chaque lot, puis tes situations, avenants et jalons. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Maîtres d'œuvre, bureaux d'études, conducteurs de travaux, PME du BTP

## À vérifier avant publication

- Nom, prix (40 €) et permalien avec Quentin.
- Clé de licence activée dans l'éditeur, `product_id` identique à `gumroad` dans `PRODUITS`.
- Passage du site de « Mise en vente prochaine » à « en vente » dans la même session (liste de
  `reference.md` § « À chaque publication Gumroad »).
