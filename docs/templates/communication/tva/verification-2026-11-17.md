# Suivi de TVA (T44) · vérification sur les pages officielles · 17/11/2026

Demandée par Quentin le 17/11/2026 (« fais la recherche officielle d'abord, puis tranche »). Pages lues le 17/11/2026,
toutes en HTTP 200. Non publié (`/docs/*` en 404).

## Sources lues

1. impots.gouv.fr, actualité « Le régime simplifié d'imposition à la TVA est supprimé à compter du 1er janvier 2027 »
   (publiée le 22/09/2026, modifiée le 23/09/2026).
2. impots.gouv.fr, page professionnelle « TVA » (modifiée le 21/05/2026). Elle décrit encore le RSI comme en vigueur.
3. Légifrance, article 287 du CGI, version à venir au 1er janvier 2027 (modifié par la loi n° 2025-127 du 14/02/2025,
   art. 38, V).
4. impots.gouv.fr, « Le régime réel normal : dates limites de transmission des CA3 » : critères lisibles, dates non
   lisibles dans le texte extrait.

## Résultats

| Point | Valeur de l'outil | Verdict | Source |
|---|---|---|---|
| Acomptes RSI | 55 % et 40 % | **Confirmé** : « 55 % … pour l'échéance de juillet », « 40 % … pour l'échéance de décembre » (ligne 57 de la CA12) | 2 |
| Mois des acomptes | 7e et 12e mois de l'exercice | **Faux pour un exercice décalé** : « 2 acomptes en juillet et décembre de chaque année ». Corrigé | 2, 1 |
| Dispense | sous 1 000 € | **Confirmé** | 2 |
| CA12 | 2e jour ouvré après le 1er mai, ou 3 mois après la clôture | **Confirmé** ; dernière CA12 le 4 mai 2027 pour l'exercice 2026 | 2, 1 |
| Fin du RSI | 01/01/2027 | **Confirmé** (LF 2025 art. 38) ; RSA agricole non concerné ; exercice décalé : jusqu'à la clôture de l'exercice 2026/2027 | 1, 3 |
| Acomptes 2027 | — | Pas d'acompte en décembre 2027 ; juillet 2027 seulement pour un exercice clos de juillet à novembre 2027, si la TVA précédente dépasse 1 000 € (cohérent avec la règle « juillet compris dans l'exercice ») | 1 |
| Trimestriel jusqu'au 31/12/2026 | TVA < 4 000 € par an | **Confirmé** | 2 |
| Trimestriel dès le 01/01/2027 | — | **Nouvelle règle, ajoutée** : chiffre d'affaires majoré des acquisitions taxables ≤ 1 000 000 € (année civile précédente) et ≤ 1 100 000 € (année en cours) ; mensuel dès le mois du dépassement ; option mensuelle pour 4 trimestres au moins. Le seuil de 4 000 € n'existe plus dans cette version | 3 |
| Jour limite des CA3 | saisi par l'utilisateur (15 par défaut) | Critères confirmés (département, catégorie, SIREN ou initiale) ; jours non lisibles : **reste à saisir** par l'utilisateur | 4 |
| Jour limite des acomptes | 15 | **Non trouvé** : reste réglable, « à vérifier » | — |
| Report week-end et jours fériés | oui | **Non trouvé** sur les pages officielles lues : reste « à vérifier » | — |
| E-reporting | — | À partir du 1er septembre 2027 (sans effet sur l'outil) | 1 |

## Décisions (17/11/2026)

1. Valeurs confirmées : statut « vérifié » dans `templates/tva/donnees.js`, date de vérification au 17/11/2026.
2. Réel simplifié **gardé** pour les exercices 2026 (dernière CA12) avec l'alerte de bascule au réel normal ; pas de
   retrait.
3. Acomptes recalculés en juillet et en décembre de l'exercice (correctif d'un défaut réel pour les exercices décalés).
4. Règle 2027 du trimestriel ajoutée (seuils et date réglables), avec une information pour les entreprises au mensuel
   sous le seuil. L'outil ne compte que les ventes HT : l'alerte demande d'ajouter les acquisitions taxables.
5. Pas de modèle tableur en plus.
6. Mise en vente possible une fois la PR fusionnée (correctif applicatif : fusion soumise à l'accord de Quentin).
