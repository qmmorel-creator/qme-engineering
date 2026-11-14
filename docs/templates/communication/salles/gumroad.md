# Fiche Gumroad · Réservation de salles et bureaux

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Prix prévu dans `IDEES.md` (19 €) : **nom et prix à confirmer par Quentin**.
**Aucun produit Gumroad n'a été créé** (consigne de la mission du 14/11/2026). La clé de licence est à
activer à la main dans l'éditeur Gumroad (Content → Insert → License key, **sans multi-postes** : la clé est
partagée par l'équipe, mais c'est une seule licence), puis l'identifiant produit reporté dans `PRODUITS`
(`netlify/lib/templates-acces.mjs`, champ `gumroad` de `SDR`).
L'entrée n'a pas été ajoutée à `../gumroad-a-creer.json` (fichier partagé, laissé au coordinateur).

- **Produit interne** : `SDR` (préfixe des codes), application `https://qm-engineering.fr/templates/salles/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-salles-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir le planning des salles »
- **Catégorie** : `business-and-money/management-and-leadership` (Business & Money › Management & Leadership), **à confirmer** dans la liste Gumroad.

## Nom

Réservation de salles et bureaux

## Prix

19 € (achat unique)

## Permalien

`reservation-salles` (à confirmer à la création)

## Résumé (une phrase)

Salles, bureaux en flex et matériel prêté : ce qui est libre maintenant, vues jour et semaine, aucune double réservation même à plusieurs, réservations chaque semaine et taux d'occupation. Une clé pour toute l'équipe.

## Description (HTML)

```html
<h2>La salle est libre ? Tu le sais.</h2><p>Un tableur partagé, un tableau blanc à l'entrée, un agenda que personne ne met à jour : et deux équipes qui arrivent dans la même salle à 10 h. La Réservation de salles et bureaux montre ce qui est libre maintenant, qui a réservé et jusqu'à quand, et refuse toute double réservation, même quand deux personnes réservent au même moment.</p>
<h3>Ce que tu obtiens</h3><ul>
<li><strong>Libre maintenant</strong> : chaque salle, bureau en flex ou équipement prêté, libre jusqu'à quelle heure ou occupé jusqu'à quand, avec la prochaine réservation. Réservation de 30 minutes ou d'une heure en un geste. Actualisé chaque minute : idéal sur une tablette à l'entrée.</li>
<li><strong>Aucune double réservation</strong> : un créneau pris est refusé à la saisie, puis de nouveau à l'enregistrement en ligne. Si deux appareils réservent en même temps, le second est prévenu de qui a pris le créneau.</li>
<li><strong>Vues jour et semaine</strong> : toutes les ressources sur une journée, ou une ressource sur sept jours. Touche un créneau libre pour réserver, une réservation pour la modifier ou la libérer plus tôt.</li>
<li><strong>Réservations chaque semaine</strong> jusqu'à une date, avec la liste des dates en conflit avant de valider.</li>
<li><strong>Tes ressources</strong> : salles avec capacité et équipements (écran, visio, tableau blanc…), bureaux en flex, matériel prêté ; horaires, jours ouverts, pas de 15, 30 ou 60 minutes, jours fériés calculés et fermés.</li>
<li><strong>Taux d'occupation</strong> par ressource, par jour de la semaine et heure par heure, sur 1, 4 ou 12 semaines ; export CSV.</li>
</ul><h3>Comment ça marche</h3><ol>
<li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li>
<li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la ; liste tes salles, bureaux et équipements.</li>
<li>Transmets la clé aux personnes qui réservent : chacune la saisit une fois sur son téléphone ou son ordinateur, puis réserve en indiquant son nom. Pas de compte à créer.</li>
</ol><p>Rien à installer. Achat unique, sans abonnement, quel que soit le nombre de personnes qui réservent.</p>
<p><em>Une clé partagée, sans comptes ni droits différents : toute personne qui a la clé peut réserver, modifier ou supprimer une réservation ; chaque réservation garde le nom saisi. Aucun agenda, aucune messagerie, aucun badge connecté. Réservations dans une même journée, jusqu'à 40 ressources. Démo disponible sur qm-engineering.fr/catalogue/salles.</em></p>
```

## Tags (7)

1. reservation-salles
2. flex-office
3. coworking
4. moyens-generaux
5. pme
6. association
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et liste tes salles, bureaux et équipements. Transmets ensuite la clé aux personnes qui réservent : chacune la saisit une fois sur son appareil. Garde cet e-mail : la même clé fonctionne sur tous les appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail, partagée par l'équipe
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : PME en flex office, coworkings, associations

## Avertissement (repris dans la description)

Une clé partagée, sans comptes ni droits différents (choix de cadrage de la V1) : toute personne qui a la clé
peut réserver, modifier ou supprimer. Les noms saisis sont des données personnelles : l'organisation qui
utilise l'outil en est responsable (minimum utile, effacement des noms des réservations passées dans les
Réglages). Seule donnée réglementaire : la liste des jours fériés (Code du travail, art. L3133-1), calculée
et relevée sur service-public.gouv.fr (fiche F2405, vérifiée le 01/01/2026 par la DILA, consultée le
14/11/2026).

## Point à trancher par Quentin

Licence « une clé pour toute l'équipe » au même prix qu'un template individuel (19 €) : à confirmer, ou
prévoir une variante « équipe » plus chère si la clé partagée est jugée trop généreuse.
