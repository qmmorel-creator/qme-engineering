# Relances de prospection sur mesure

Outil : `relance.mjs`, qui génère les brouillons Gmail des relances, dans le fil d'origine. Il a été reconstruit le
27/11/2026 à partir des scripts utilisés du 02 au 24/11/2026 : les copies de session ont été perdues au redémarrage
du conteneur.

## Règles (rien ne part sans elles)

1. **Opposition** (`docs/templates/communication/REGLES-PROSPECTION.md`) :
   - exclure les adresses et domaines de `docs/prospection/desinscrits.md` ;
   - exclure les fiches Nexora à l'étape `oppose` ou `perdu` ;
   - exclure toute fiche dont les échanges contiennent « stop », « désinscri », « Énervé », « ne plus contacter » ou « ne plus relancer » ;
   - vérifier la liste d'opposition du site : `GET /api/compte/opposition`, avec le code administrateur ou l'en-tête `X-Opposition-Token`.
2. **Mention d'opposition** en dernier paragraphe, avec le lien personnel. L'outil l'ajoute, en français ou en anglais.
3. **Signature graphique « Bandeau »** dans la version HTML : six images en `cid:att0` à `att5`, à joindre telles
   quelles (`attachments`). L'outil reprend `netlify/lib/signature.mjs`.
4. **Suivi** : la cible et l'état se lisent dans **Nexora Optim › QME**. Chaque envoi est reporté le jour même
   (`docs/prospection/NEXORA-PROSPECTS.md` § 2).
5. **Aucun envoi sans le feu vert de Quentin**. Les brouillons d'abord, avec un exemple par vague.
6. **Pas de copie à Floriane Jolliot** : les relances de campagne sont des mails de masse (règle du 27/11/2026 dans
   `CLAUDE.md`). La copie à Floriane est réservée aux mails personnalisés.
7. **Aucune tâche Nexora pour une relance** (règle du 25/11/2026) : la relance se suit par la date `relance` de la fiche QME.

## Modes

| Mode | Usage | Contenu |
|---|---|---|
| `B` | première relance (environ J+14) | rappel du premier mail, « Pour être plus concret : » et un paragraphe de deux phrases propre au prospect, offre de maquette, appel de 30 minutes, lien `utm_campaign=relance-v<vague>`, phrase pour arrêter les relances |
| `A` | dernière relance (J+7 après la première) | clôture polie, lien `utm_campaign=derniere-relance-v<vague>`, « bonne fin d'année » |

Le paragraphe du mode B se rédige au conditionnel, avec un élément nouveau par rapport au premier mail. Il ne contient
ni superlatif, ni chiffre inventé, ni « Nexora », ni nom de client confidentiel.

## Utilisation

```sh
node docs/prospection/relances/relance.mjs entrees.json > brouillons.json
```

`entrees.json` :

```json
[{ "email": "contact@exemple.fr", "objet": "Objet du premier mail", "vague": 25, "premierMail": "2026-11-06",
   "mode": "A", "lang": "fr", "threadId": "…", "replyToMessageId": "… (dernier message de Quentin dans le fil)" }]
```

Pour chaque brouillon :
- appeler `create_draft` avec `to`, `cc`, `subject`, `body`, `htmlBody`, `attachments` et `replyToMessageId` ;
- vérifier avec `get_draft` : l'expéditeur est `quentin.morel@qm-engineering.fr` et le fil est le bon.

Pour l'envoi validé :
- appeler `send_message({ draftId })`, au plus 4 à la fois ;
- avant de réessayer un envoi en échec, appeler `get_draft` : un brouillon disparu est déjà parti.

Le test `outils/templates/relances.test.mjs` vérifie la mention, la signature et les deux modes.
