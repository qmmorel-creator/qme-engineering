# Règle absolue de toute prospection QME : la mention d'opposition

Décision de Quentin du 22/11/2026. **Aucune exception** : prospection d'entreprise, affiliation (influenceurs,
créateurs), partenariat, relance, nouvelle vague, réponse type aux refus, annonce aux acheteurs et testeurs. Un e-mail
qui ne respecte pas les trois points ci-dessous **ne part pas** (ni brouillon prêt à envoyer, ni envoi).

## 1. Avant d'écrire : vérifier l'opposition

L'adresse (et son domaine) ne doit pas être sur la liste d'opposition :

- une adresse : `GET https://qm-engineering.fr/api/compte/opposition?email=<adresse>` (en-tête `X-Admin` : code
  administrateur) → `opposition: null` obligatoire ;
- une liste : `POST /api/compte/opposition/verifier` `{ "emails": [...] }` ;
- sans le code administrateur (sessions de prospection) : mêmes appels avec l'en-tête `X-Opposition-Token` (jeton
  de lecture seule, variable Netlify `OPPOSITION_TOKEN`) ; il ne permet ni d'ajouter à la liste ni de lire le registre ;
- à l'œil : `/admin/registre/` (filtre « désinscrit », lignes `*@domaine`) et `docs/prospection/desinscrits.md`.

Adresse ou domaine opposé : **ne jamais écrire**, ni relance, ni affiliation, ni réponse.

## 2. Dans l'e-mail : la mention, toujours, en dernier paragraphe

Lien personnel : `https://qm-engineering.fr/ne-plus-recevoir/?email=<adresse du destinataire, encodée>` (page publique :
l'adresse est préremplie, la personne confirme d'un clic ; elle rejoint la liste d'opposition). Encoder l'adresse
(`@` → `%40`, `+` → `%2B`).

Texte (français) :

```
—
Vous ne souhaitez plus recevoir d'informations de QME ? Ne plus recevoir les informations : https://qm-engineering.fr/ne-plus-recevoir/?email=<adresse> (ou répondez simplement « stop »).
```

HTML (français) :

```html
<p style="margin:24px 0 0;font:12px/1.5 Arial,Helvetica,sans-serif;color:#6b6660">Vous ne souhaitez plus recevoir d’informations de QME&nbsp;? <a href="https://qm-engineering.fr/ne-plus-recevoir/?email=<adresse>" style="color:#6b6660">Ne plus recevoir les informations</a> (ou répondez simplement «&nbsp;stop&nbsp;»).</p>
```

Anglais (`lang=en`) :

```
—
Don't want to hear from QME again? Stop receiving information: https://qm-engineering.fr/ne-plus-recevoir/?lang=en&email=<address> (or just reply "stop").
```

Les annonces envoyées par le site (`netlify/lib/nouveautes.mjs`) portent déjà un lien signé équivalent
(`/api/compte/stop`) : rien à ajouter.

## 3. Après une réponse « stop », hostile, ou un retrait demandé

Le jour même :

1. aucune réponse (sauf refus poli qui ne demande pas le retrait : réponse type du skill
   `nettoyage-refus-prospection`, qui porte elle aussi la mention) ;
2. inscrire l'adresse, et le domaine pour une réponse hostile d'organisation, sur la liste d'opposition :
   `POST /api/compte/opposition` (en-tête `X-Admin`) `{ "emails": [...], "domaines": [...], "source": "réponse « stop » du AAAA-MM-JJ" }` ;
3. ajouter la ligne à `docs/prospection/desinscrits.md` (journal lisible) et le libellé Gmail `qme/Prospects/Énervé`.

La liste d'opposition (`netlify/lib/preferences.mjs`) est gardée 3 ans ; un nouveau consentement explicite (case
« nouveautés » cochée lors d'un essai) lève l'opposition d'une adresse, jamais celle d'un domaine.
