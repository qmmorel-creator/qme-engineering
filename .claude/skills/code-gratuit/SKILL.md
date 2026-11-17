---
name: code-gratuit
description: Attribuer à la demande un code d'accès gratuit à un template ou à un pack QME (hors Gumroad), l'inscrire avec son identifiant de révocation dans le registre docs/templates/codes-gratuits.md, puis commiter sur la branche de travail. Sert aussi à révoquer un code. À utiliser quand Quentin demande « donne-moi un code pour X », « un code budget pour Sabrina », « code gratuit », « offre le template X à Y », « révoque le code de Y ».
---

# Code gratuit

Registre unique : `docs/templates/codes-gratuits.md` (non servi par Netlify). Le site ne stocke aucun code : un
code absent du registre est introuvable et impossible à révoquer proprement.

## 1. Comprendre la demande

- **Produit** : préfixe de 3 lettres dans `PRODUITS` de `netlify/lib/templates-acces.mjs` (ex. `BDG` Budget du foyer,
  `NTR` Nutrition, `BCM` Budget commun, `HBT` Habitudes). Pack : clés de `PACKS` (`netlify/lib/packs.mjs`), `PFG+`
  pour l'option « Pack évolutif », `SMP BDG,ABN,DTT` pour un pack sur mesure.
  En cas de doute entre deux produits proches (Budget du foyer / Budget commun), demander.
- **Destinataire** : obligatoire (colonne du registre). Le demander s'il manque.
- **Nombre** : 1 code par produit et par personne, sauf demande contraire.

## 2. Obtenir le secret

`TEMPLATES_SECRET` n'est pas dans l'environnement des sessions. Le lire sur Netlify, en lecture seule :
outil `mcp__Netlify__netlify-project-services-updater`, opération `manage-env-vars`, `getAllEnvVars: true`,
site `qme-engineering` (siteId `c340dcb1-360f-493e-b204-13aa30fbdea8`). Prendre la valeur du contexte `production`.

- Ne jamais écrire le secret dans un fichier, un commit, un message ou la réponse à Quentin.
- Ne jamais modifier une variable Netlify pour générer un code.

## 3. Générer

```
TEMPLATES_SECRET=<secret> node outils/templates/generer-code.mjs <PRODUIT|PACK> 1
```

Autorisé sans invite par `.claude/settings.json`. Une commande par produit.

## 4. Inscrire au registre (tout de suite, avant de répondre)

Ajouter une ligne par code à la fin du tableau :

```
| JJ/MM/AAAA | <PRODUIT> | `<CODE>` | `<ID>` | <Destinataire> | actif |
```

**Identifiant de révocation** : retirer les tirets du code, garder les 16 derniers caractères, puis les 8 premiers
de ces 16. Ex. `BDG-KC8Z-MTR1-RET7-N5JM` → `KC8ZMTR1`. Valable pour les templates et les packs.

## 5. Commiter

Commit sur la branche de travail de la session (jamais `main`), push, **pas de PR ni de fusion** sans feu vert
explicite de Quentin. Le registre est dans `docs/` : aucun déploiement n'est nécessaire pour qu'un code marche.

## 6. Répondre

Tableau court : produit, code, destinataire. Rappeler l'identifiant de révocation. Pas de secret.

## Révoquer un code

1. Retrouver la ligne du destinataire dans le registre, lire son Id.
2. **Demander confirmation à Quentin** : la révocation touche la production (variable Netlify) et coupe l'accès
   immédiatement.
3. Ajouter l'Id à la variable Netlify `TEMPLATES_CODES_REVOQUES` (liste existante + nouvel Id, séparés par une
   virgule ; lire la valeur actuelle avant d'écrire, ne rien effacer).
4. Passer le statut de la ligne à `révoqué (JJ/MM/AAAA)`, commiter.

Ne jamais ajouter à `TEMPLATES_CODES_REVOQUES` l'Id d'un code actif : c'est ce qui le révoque.
