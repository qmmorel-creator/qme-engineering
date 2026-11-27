# Révisions QME X Laurine (version privée bêta)

Version privée du « Planning de révision » pour Laurine Mebs (Optimind Formation), puis des bêta-testeurs dans des
écoles (fonctionnalités validées après la visio du 26/11/2026).

- **URL non listée** : `https://qm-engineering.fr/prive/revisions-laurine/` (démo PASS médecine : bouton
  « Essayer avec un exemple PASS médecine », ou `?demo`). `noindex,nofollow` (meta + en-tête `/prive/*` dans
  `netlify.toml`), absente du sitemap, du catalogue, de `/connexion/`, de Gumroad et de l'essai gratuit.
- **Code** : `prive/revisions-laurine/` (copie de `templates/revision/`, qui reste le template vendu, inchangé),
  règles pures dans `laurine-regles.js`, tests `outils/templates/revisions-laurine.test.mjs`.
- **Produit `RVX`** (`PRODUITS_PRIVES` de `netlify/lib/templates-acces.mjs`) : même mécanisme de code signé que les
  autres templates, données serveur `RVX/…` et stockage local `qme-rvx-*`, séparés du template de base.

## Clés de bêta-test (une par élève, par école)

```
TEMPLATES_SECRET=<secret Netlify> npm run code -- RVX 30
```

Inscrire chaque lot dans `docs/templates/codes-gratuits.md` (produit `RVX`, destinataire = école / élève).
Révocation : identifiant (8 caractères après `RVX-`) dans `TEMPLATES_CODES_REVOQUES`.
Le code administrateur `ADM-…` de Quentin ouvre aussi la version privée.
