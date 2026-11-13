# Fiche Gumroad · Entretien de la maison

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`) **à la mise en vente** ; aucune fiche n'est
créée à ce stade. Nom et prix d'après le tableau de bord d'`IDEES.md` (T11, 12 €). La clé de licence est à
activer à la main dans l'éditeur Gumroad (Content → Insert → License key, sans multi-postes). Même contenu,
au format des fiches de la vague 2 : `gumroad.json`.

- **Produit interne** : `ENT` (préfixe des codes), application `https://qm-engineering.fr/templates/entretien/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-entretien-couverture.png` (1280 × 720), générée par
  `outils/templates/couvertures-gumroad.cjs` avec les lignes de `couverture.txt`, une fois en ligne
- **Bouton** : « Ouvrir mon calendrier »
- **Catégorie** : `self-improvement/productivity` (Self Improvement › Productivity)

## Nom

Entretien de la maison

## Prix

12 € (achat unique)

## Permalien

`entretien-maison`

## Résumé (une phrase)

Coche les équipements de ton logement : le calendrier d'entretien se calcule seul, avec les obligations sourcées, l'historique et les coûts.

## Description (HTML)

```html
<h2>Rien d'oublié, chaque saison.</h2><p>La date du dernier ramonage retrouvée sur une attestation au fond d'un tiroir, des filtres jamais changés, des gouttières qu'on nettoie quand elles débordent : l'Entretien de la maison coche les équipements de ton logement et calcule seul ce qui est en retard, ce qui tombe ce mois-ci et ce qui arrive.</p><h3>Ce que tu obtiens</h3><ul><li><strong>89 tâches types pour 37 équipements</strong> : chaudière, ramonage, poêle, pompe à chaleur, climatisation, VMC, détecteur de fumée, chauffe-eau, adoucisseur, fosse, électroménager, toiture et gouttières, jardin, piscine… Chaque fréquence est modifiable, et tu peux ajouter tes propres tâches.</li><li><strong>Échéances calculées</strong> à partir de la dernière fois et de la saison conseillée : en retard, ce mois-ci, à venir. Date inconnue ? Le calendrier propose une première date, obligations d'abord.</li><li><strong>Obligations sourcées</strong> : les fréquences d'origine réglementaire (chaudière, ramonage, pompe à chaleur…) affichent leur source et la date de relecture, avec la mention « à vérifier selon ton département et ton bail ».</li><li><strong>Historique</strong> : date, coût, intervenant et note de chaque intervention, dépenses des 12 derniers mois, export CSV.</li><li><strong>Liste de l'année à imprimer</strong>, mois par mois, avec des cases à cocher.</li><li><strong>Locataire ?</strong> Chaque tâche indique qui s'en charge le plus souvent, à titre indicatif.</li></ul><h3>Comment ça marche</h3><ol><li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li><li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li><li>Indique ton type de logement, coche tes équipements, et le calendrier est prêt. Tes données sont enregistrées en ligne et te suivent sur ordinateur, tablette et téléphone avec la même clé.</li></ol><p>Rien à installer, aucun compte à créer. Achat unique, sans abonnement.</p><p><em>Outil d'aide à l'organisation : il ne remplace pas l'avis d'un professionnel ni une attestation d'entretien. Les fréquences réglementaires peuvent varier selon ton département, ton bail ou ton équipement : vérifie-les. Aucune notification ni lien avec un agenda. Démo disponible sur qm-engineering.fr/templates.</em></p>
```

## Tags (7)

1. entretien
2. maison
3. calendrier
4. chaudiere
5. ramonage
6. locataire
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton calendrier d'entretien s'ouvre. Coche tes équipements : les échéances se calculent. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Propriétaires et locataires

## Avant de publier

- Relire les trois règles marquées « à vérifier » dans `templates/entretien/donnees.js` (vidange de
  l'assainissement non collectif, SPANC, débroussaillement) et la date `verifieLe`.
- La phrase d'avertissement en fin de description reste obligatoire (outil d'aide, fréquences à vérifier).
