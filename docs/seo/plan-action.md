# Plan d'action SEO priorisé · 14/11/2026

Impact et effort sont des estimations qualitatives (non chiffrées) : impact = effet attendu sur la visibilité ou les
ventes, effort = temps de travail et nombre de déploiements. Aucune promesse de position ni de trafic.

## Fait dans la PR de cette session (non fusionnée)

- Données structurées JSON-LD générées depuis le contenu visible, testées (`npm test`) et validées (schema.org).
- Title et meta description des 28 pages en vente alignés sur leur requête principale ; premier paragraphe retouché
  sur 13 d'entre elles, sans changer le sens.
- H2 « Ce que vous obtenez » (96 pages), contraste corrigé, title de `/en/contact/` différencié.
- Livrables : `audit-2026-11-14.md`, `mots-cles.md`, `guides.md`, `hors-site.md`, ce plan.

## Priorités

| # | Action | Impact | Effort | Qui |
|---|---|---|---|---|
| 1 | **Search Console et Bing Webmaster Tools** : validation du domaine, sitemap, indexation des pages prioritaires (procédure ci-dessous) | Fort (sans cela, rien n'est mesuré) | Faible | Quentin |
| 2 | Fusionner la PR SEO après relecture (1 déploiement) | Fort | Faible | Quentin |
| 3 | Rich Results Test sur 3 URL en ligne après déploiement (accueil, une page en vente, une page « bientôt ») | Moyen (contrôle) | Faible | Quentin ou session suivante |
| 4 | Écrire les 2 à 3 premiers guides : **lot 1 rédigé le 15/11/2026, PR #PR_GUIDES (non fusionnée)** : facture impayée, levée des réserves, budget à deux 50/50 ou prorata (avec calculateur), rubrique `/guides/`. Reste : document unique et les suivants (`guides.md`) | Fort à moyen terme sur les requêtes larges | Moyen | Relecture de Quentin, puis fusion |
| 5 | Fiches Gumroad : noms, résumés, tags, catégories (`hors-site.md`) | Moyen (pages Gumroad indexées, Discover) | Faible | Quentin (fiches publiques) |
| 6 | Balises Open Graph (titre, description, image 1200 × 630) sur toutes les pages publiques, générées comme le JSON-LD | Moyen (clics depuis LinkedIn et Instagram) | Moyen | Lot suivant |
| 7 | Bloc « Voir aussi » sur les pages catalogue (2 à 3 templates du même thème) et liens des guides vers les produits | Moyen (maillage) | Moyen | Lot suivant |
| 8 | Descriptions des 68 pages « bientôt » et des 18 packs ≤ 160 caractères, à chaque mise en vente au plus tard | Moyen | Moyen (étalé) | Avec le skill nouveau-template |
| 9 | Page 404 en français dans la charte, avec liens vers Templates et Sur mesure | Faible | Faible | Lot suivant |
| 10 | `/connexion/` : ajouter `noindex` et la retirer du `Disallow` de robots.txt (sinon Google ne voit pas le `noindex`) | Faible | Faible | Accord de Quentin |
| 11 | Sauts de titres sur `/sur-mesure/`, `/references/` et pages anglaises | Faible | Faible | Lot suivant |
| 12 | Fiche Google Business Profile, France Num, comparateurs (`hors-site.md`, à vérifier) | Moyen (marque, offre sur mesure) | Moyen | Quentin |
| 13 | Politique de remboursement écrite → `hasMerchantReturnPolicy` dans le JSON-LD | Faible | Faible | Décision de Quentin |

Pour limiter les déploiements facturés : regrouper 6, 7, 9 et 11 dans une seule PR ; les guides par lots de 2 ou 3.

Ajouter au skill `nouveau-template` (proposition, à valider) : à chaque mise en vente, title et description selon
`mots-cles.md`, puis `node outils/seo/donnees-structurees.mjs` (le test `seo.test.mjs` échoue sinon).

## Ce qui revient à Quentin : Search Console et Bing

Aucun accès à ton compte Google depuis cette session. Étapes, une fois la PR fusionnée et déployée :

### Google Search Console

1. Ouvrir https://search.google.com/search-console avec le compte Google de QME.
2. « Ajouter une propriété » → type **Domaine** → saisir `qm-engineering.fr` (couvre http, https, www et sous-domaines).
3. Google affiche un enregistrement **TXT** (`google-site-verification=…`). L'ajouter dans la zone DNS du domaine,
   chez le registraire ou dans Netlify DNS si le domaine y est géré (Netlify → Domains → `qm-engineering.fr` →
   DNS settings → Add new record → type TXT, nom `@`, valeur copiée).
4. Revenir dans la Search Console → « Valider ». La propagation DNS peut prendre de quelques minutes à quelques heures.
5. Menu **Sitemaps** → saisir `https://qm-engineering.fr/sitemap.xml` → « Envoyer ». Statut attendu : « Opération
   effectuée », 129 URL découvertes.
6. **Inspection d'URL** (barre du haut) → coller chaque URL prioritaire → « Demander l'indexation » (quota quotidien
   limité : une dizaine par jour suffit). Ordre conseillé :
   1. `https://qm-engineering.fr/`
   2. `https://qm-engineering.fr/templates/`
   3. `https://qm-engineering.fr/sur-mesure/`
   4. `https://qm-engineering.fr/catalogue/document-unique/`
   5. `https://qm-engineering.fr/catalogue/reserves/`
   6. `https://qm-engineering.fr/catalogue/impayes/`
   7. `https://qm-engineering.fr/catalogue/tresorerie/`
   8. `https://qm-engineering.fr/catalogue/non-conformites/`
   9. `https://qm-engineering.fr/catalogue/travaux/`
   10. `https://qm-engineering.fr/packs/`
   Puis les autres pages en vente les jours suivants.
7. Dans l'inspection d'une page en vente, ouvrir « Améliorations » : Produits / Fil d'Ariane doivent apparaître
   sans erreur quelques jours après l'exploration.

### Bing Webmaster Tools

1. Ouvrir https://www.bing.com/webmasters et se connecter.
2. Le plus simple : **« Importer depuis Google Search Console »** (reprend la propriété et le sitemap). Sinon : ajouter
   `https://qm-engineering.fr/`, vérifier par enregistrement DNS (CNAME ou TXT fourni par Bing), puis Sitemaps →
   `https://qm-engineering.fr/sitemap.xml`.
3. « Inspection d'URL » → « Demander l'indexation » pour les mêmes pages prioritaires. Bing alimente aussi
   d'autres moteurs (dont DuckDuckGo et Ecosia) : à vérifier selon leurs conditions actuelles.

## Indicateurs à suivre dans la Search Console

| Indicateur | Où | Fréquence | Lecture |
|---|---|---|---|
| Pages indexées / non indexées et motifs | Indexation → Pages | Hebdomadaire le premier mois, puis mensuelle | Viser l'indexation des 129 pages ; les motifs « Détectée, actuellement non indexée » signalent un manque de liens ou de contenu |
| Impressions | Performances → Résultats de recherche | Mensuelle | Premier signal : apparaît avant les clics. Donne enfin des **volumes réels** par requête (à reporter dans `mots-cles.md`) |
| Clics | Idem | Mensuelle | Par page : quelles pages catalogue attirent du trafic |
| CTR | Idem | Mensuelle, par page | CTR faible à position correcte → retravailler title et description |
| Position moyenne | Idem, par requête | Mensuelle | Suivre les requêtes principales de `mots-cles.md` ; une position 8 à 20 est la cible la plus rentable à améliorer |
| Résultats enrichis | Améliorations → Produits, Fils d'Ariane | Après chaque déploiement | Zéro erreur attendu |
| Signaux Web essentiels | Expérience | Mensuelle | Données terrain si le trafic suffit |

Croiser avec GoatCounter (visites, clics « achat-… » et « demo-… » déjà suivis) et les ventes Gumroad : une page qui
gagne des clics Google sans clic « achat » ni « démo » a un problème de contenu, pas de référencement.
