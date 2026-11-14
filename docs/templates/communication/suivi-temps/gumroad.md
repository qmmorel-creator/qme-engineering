# Fiche Gumroad · Suivi du temps et rentabilité par mission

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Prix prévu dans `IDEES.md` (19 €) : **nom et prix à confirmer par Quentin** (minimum
12 € respecté). **Aucun produit Gumroad n'a été créé** (consigne de la mission du 14/11/2026). La clé de
licence est à activer à la main dans l'éditeur Gumroad (Content → Insert → License key, sans multi-postes),
puis l'identifiant produit reporté dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad` de
`TMP`). L'entrée n'a pas été ajoutée à `../gumroad-a-creer.json` (fichier partagé, laissé au coordinateur).

- **Produit interne** : `TMP` (préfixe des codes), application `https://qm-engineering.fr/templates/suivi-temps/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-suivi-temps-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir mon suivi du temps »
- **Catégorie** : `business-and-money` (Business & Money), sous-catégorie **à confirmer** dans la liste
  Gumroad ; la comptabilité est écartée exprès (ni logiciel comptable, ni logiciel de facturation).
- **Pack** : « Freelance : chiffrer, facturer, encaisser » (PFG), où il était prévu (T73, ancien numéro T71). L'ajout de `TMP` aux
  `produits` du pack (`netlify/lib/packs.mjs`) et la régénération des pages (`outils/packs/generer.mjs`)
  sont laissés au coordinateur.

## Nom

Suivi du temps et rentabilité par mission

## Prix

19 € (achat unique)

## Permalien

`suivi-temps-rentabilite` (à confirmer à la création)

## Résumé (une phrase)

Le temps passé sur chaque mission, au chronomètre ou en une ligne, comparé à ton TJM, à ton devis et à ton coût de revient : budget, dépassement, taux horaire effectif et rapport client.

## Description (HTML)

```html
<h2>Ce que tu gagnes vraiment de l'heure.</h2><p>Ton TJM est affiché, ton devis est signé. Mais une fois la mission finie, combien as-tu vraiment gagné de l'heure ? Entre les allers-retours, les corrections offertes, les devis, les relances et l'administratif, l'écart se découvre trop tard. Le Suivi du temps et rentabilité par mission compte ton temps au fil de l'eau et le compare à ton tarif, mission par mission.</p>
<h3>Ce que tu obtiens</h3><ul>
<li><strong>Le temps saisi sans effort</strong> : un chronomètre qui te suit d'un appareil à l'autre (lancé sur l'ordinateur, arrêté sur le téléphone), ou une ligne « 1h30 ». Chaque temps rattaché à une mission et à une tâche, facturable ou non.</li>
<li><strong>Des missions au forfait ou en régie</strong>, avec leur budget en jours ou en heures : consommation, avancement, estimation à terminaison, alerte de vigilance et de dépassement. 7 modèles de missions et 17 catégories de tâches prêts à l'emploi.</li>
<li><strong>Ton taux horaire effectif</strong> : montant facturé ÷ temps réellement passé, et son équivalent journalier, comparés à ton TJM cible, au taux prévu au devis et à ton coût de revient.</li>
<li><strong>Le temps non facturable rendu visible</strong> : prospection, devis, administratif, facturation, comptabilité, veille… et ta semaine réelle face à ta semaine type.</li>
<li><strong>La rentabilité de la période</strong> : temps total, part facturable, valeur produite et taux horaire réel du mois, de trois mois ou de l'année.</li>
<li><strong>Un rapport client imprimable</strong> par client ou par mission, et l'export CSV de toutes tes saisies.</li>
</ul><h3>Comment ça marche</h3><ol>
<li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li>
<li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li>
<li>Indique ton TJM cible et ta semaine type, crée ta première mission, lance le chronomètre. Tes données sont enregistrées en ligne et te suivent sur ordinateur, tablette et téléphone avec la même clé.</li>
</ol><p>Rien à installer, aucun compte à créer. Achat unique, sans abonnement.</p><p><em>Outil de suivi du temps et de gestion, pas un logiciel de facturation ni un conseil : aucune facture émise, aucun lien avec un agenda, une banque ou un logiciel. Montants hors taxes, saisis par toi ; ton TJM cible et ton coût de revient sont tes propres repères (aucun tarif de marché intégré). Démo disponible sur qm-engineering.fr/catalogue/suivi-temps.</em></p>
```

## Tags (7)

1. suivi-du-temps
2. freelance
3. consultant
4. rentabilite
5. tjm
6. chronometre
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton suivi du temps s'ouvre. Indique ton TJM cible et ta semaine type, crée ta première mission et lance le chronomètre. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Freelances et consultants

## Avertissement (repris dans la description)

Outil de suivi du temps et de gestion, pas un logiciel de facturation ni un conseil. Aucun lien avec un
agenda, une banque ou un logiciel. Montants hors taxes saisis par l'utilisateur ; TJM cible et coût de
revient saisis (repères personnels, notions communes avec le Calculateur de TJM et le Coût de revient QME).
Aucun taux, barème ni tarif de marché intégré : rien à mettre à jour chaque année.
