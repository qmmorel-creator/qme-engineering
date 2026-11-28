# Modèles de mail « mise à jour de vos applications » (brouillon à valider par Quentin)

Procédure : `licences.md` § 8. Envoi groupé hebdomadaire, un mail par destinataire. Vouvoiement. Variables :
`{{prenom_virgule}}`, `{{liste}}` (une ligne par template : nom, résumé, lien), `{{email}}`. Signature « Bandeau » en
HTML (`SIGNATURE_HTML`), signature texte en version texte. Pas de Floriane ; copie cachée : voir § 8.

## Acheteurs (et codes offerts)

**Objet** (un template) : `Votre application {{nom}} a été mise à jour`
**Objet** (plusieurs) : `{{n}} de vos applications QME ont été mises à jour`

```
Bonjour{{prenom_virgule}}

Cette semaine, j'ai amélioré des applications que vous utilisez :

{{liste}}
   (ex. : - Suivi d'habitudes et routines : nouvelle présentation, plus lisible, sur ordinateur comme sur téléphone.
            https://qm-engineering.fr/templates/habitudes/)

Rien à faire de votre côté : vos données et vos accès sont inchangés. Ouvrez simplement l'application.

Une gêne, un réglage qui vous manque ? Répondez à cet e-mail : c'est moi qui le lis.

Quentin Morel
QM Engineering · qm-engineering.fr

—
Vous recevez cet e-mail parce que vous utilisez ces applications QME.
Ne plus recevoir les informations : https://qm-engineering.fr/ne-plus-recevoir/?email={{email}}
```

## Testeurs inscrits aux nouveautés

**Objet** : `Du nouveau dans {{nom}}, que vous avez essayé`

```
Bonjour{{prenom_virgule}}

Vous avez essayé {{nom}} et demandé à recevoir les nouveautés. Il vient d'être amélioré :

{{liste}}

Votre essai est encore ouvert ? Tout ce que vous y avez saisi est repris si vous l'achetez.
Rouvrir mon essai : https://qm-engineering.fr/essai/?t={{slug}}
L'acheter ({{prix}} €, achat unique) : {{lien_gumroad}}

Quentin Morel
QM Engineering · qm-engineering.fr

—
Vous recevez cet e-mail parce que vous avez demandé à recevoir les nouveautés QME lors d'un essai gratuit.
Ne plus recevoir les informations : https://qm-engineering.fr/ne-plus-recevoir/?email={{email}}
```

## Résumé type de la vague « Bauhaus adouci »

`nouvelle présentation, plus lisible et plus douce, sur ordinateur comme sur téléphone ; mêmes fonctions, mêmes données.`
