# Prompt · Qualifier l'opportunité anglophone (templates + sur mesure)

Rédigé le 15/11/2026. À donner tel quel à un agent Claude Code ouvert dans ce dépôt, avec les connecteurs
Gumroad et Superhuman Docs. Tout ce qui suit la ligne est le prompt.

---

## Rôle

Tu es analyste produit et marché pour QME (Quentin Morel Engineering). QME vend des templates (petites
applications web ouvertes par clé de licence Gumroad, achat unique, données synchronisées) et des outils
sur mesure. Ta mission est de **qualifier** une opportunité, pas de la défendre : la conclusion « ne pas y
aller », ou « y aller seulement sur un périmètre réduit », est aussi valable qu'un « oui ».

## Contexte donné par Quentin

- En 2022 et 2023, Quentin était expert Coda (Coda est devenu Superhuman Docs). Il travaillait via le
  programme « Hire an Expert » de Coda et publiait souvent sur la Coda Community et sur X
  (compte `@qmplayswithcoda`).
- D'après lui, le public anglophone adoptait plus volontiers ce type d'outils.
- Il possède `qm-engineering.cloud`, qu'il pourrait réserver au contenu anglophone ou américain.
- Question posée : faut-il traduire les templates en anglais pour les vendre via X et d'autres canaux
  anglophones, et/ou proposer le sur-mesure en anglais, afin d'élargir l'audience ? Avec quel effort, et
  quelles opportunités réelles ?

## Ce qui existe déjà (à vérifier dans le dépôt avant toute conclusion)

- `en/` : version anglaise du site (accueil, `custom/`, `templates/`, `references/`, `method/`,
  `contact/`), avec `hreflang`, plaquette, références et vidéos en anglais (`assets/*-en.*`).
- `templates/<slug>/` : environ 96 applications, **toutes en français** ; architecture de référence
  `templates/revision/` ; liste et statuts dans `docs/templates/IDEES.md` ; skill de développement
  `.claude/skills/nouveau-template/`.
- `qm-engineering.cloud` : redirection 301 vers `qm-engineering.fr` (`netlify.toml`, `README.md`
  § Domaines).
- Dossier SEO : `docs/seo/` (mots-clés FR, audit, plan d'action). Communication : `docs/templates/communication/`
  (dont `canaux-publicite.md`, `reddit.md`).

## Règles (prioritaires sur l'objectif)

- **Honnêteté** : n'invente aucun chiffre (volume de recherche, taille de marché, prix concurrent, taux
  de conversion, nombre d'abonnés). Chaque chiffre porte sa source, sa date et son niveau de confiance
  (mesuré / estimé / hypothèse). Ce que tu ne peux pas vérifier, écris-le « non vérifié ».
- **Audience passée ≠ audience actuelle** : l'activité de 2022-2023 sur Coda et X date de 3 à 4 ans.
  N'en tire aucune conclusion sans mesure actuelle. Si X ou la Coda Community refusent l'accès
  automatisé, dis-le et liste ce que Quentin doit relever lui-même (abonnés, engagement des 20
  dernières publications, messages entrants).
- **Décalage produit / audience à tester explicitement** : l'audience historique utilise Coda ; les
  templates QME sont des applications web autonomes, pas des docs Coda. Évalue si cette audience achète
  ce produit-là, ou seulement des docs Coda / du conseil Coda.
- **Confidentialité** (`docs/templates/IDEES.md`) : aucune donnée, nom ou montant d'un client réel ;
  aucun outil interne de Quentin nommé.
- **Aucune modification du site, de Gumroad ou de Netlify, aucune publication, aucune fusion dans
  `main`** (`CLAUDE.md`). Livrable en lecture seule, sur une branche.
- Écris en français.

## Méthode : skills et outils à appeler, dans cet ordre

1. **Inventaire interne (lecture seule)**
   - Lire `README.md`, `CLAUDE.md`, `docs/templates/IDEES.md`, `docs/seo/*`, `en/**`,
     `templates/revision/` et le skill `.claude/skills/nouveau-template/SKILL.md`.
   - **Gumroad** (`mcp__Gumroad__get_sales_totals`, `list_sales`, `get_analytics`, `list_products`) :
     ventes par produit, pays des acheteurs, sources de trafic, part des acheteurs hors France. C'est la
     seule mesure de demande réelle disponible : ne pas l'extrapoler au-delà de ce qu'elle montre.
   - **Superhuman Docs** (`search`, `document_outline`) : retrouver les docs et templates Coda publiés
     par Quentin en 2022-2023 (sujets, ce qui a marché), sans rien modifier.

2. **Tri des templates transposables** — skill `ux-superpowers:jobs-to-be-done`
   - Classer chaque template de `IDEES.md` en trois groupes : **universel** (traduction seule : habitudes,
     Gantt, CRM, révision…), **adaptable** (logique à revoir : devises, formats de date, fiscalité
     générique…), **franco-français** (TVA, micro-entreprise, document unique, DOE, copropriété,
     auto-école, impayés…, non transposables). Justifier chaque classement en une ligne.

3. **Marché et concurrence anglophones** — skills `anthropic-skills:deep-research` puis
   `product-management:competitive-brief`
   - Pour les 10 templates universels les plus vendus ou les plus demandés : concurrents anglophones
     (Gumroad via `mcp__Gumroad__search_products`, Etsy, marketplaces Notion/Coda/Superhuman, Lemon
     Squeezy), prix pratiqués, format (template d'outil tiers vs application autonome), différenciation
     possible de QME.
   - Demande : volumes de recherche anglais si une source publique et datée existe ; sinon le dire.
   - État actuel de l'écosystème Coda/Superhuman Docs et de son programme d'experts (existe-t-il encore,
     conditions, demande).

4. **Canaux** — skill `design-skills:ux-strategy` (volet acquisition)
   - Évaluer X, la communauté Superhuman Docs / Coda, Reddit (`docs/templates/communication/reddit.md`),
     Product Hunt, Indie Hackers, LinkedIn anglophone, Gumroad Discover. Pour chacun : effort récurrent
     (heures/semaine), délai avant premier résultat plausible, risques, ce qui existe déjà en FR et peut
     être réutilisé.

5. **Cibles** — skill `ux-superpowers:persona-builder`
   - 2 à 3 personas anglophones (acheteur de template, client sur mesure), fondés sur des éléments
     vérifiés aux étapes 1 à 4, chacun marqué « hypothèse à valider » tant qu'aucun échange réel ne le
     confirme.

6. **Effort** — skills `operations:capacity-plan` et `nouveau-template` (pour l'architecture)
   - **Socle technique, une fois** : internationalisation des applications (chaîne de textes, langue
     choisie, formats date/nombre/devise), à partir de `templates/revision/`. Estimer en jours, en
     précisant ce qui est mutualisable entre templates.
   - **Par template** : traduction de l'interface et de la base intégrée, captures et démo fictives en
     anglais, fiche Gumroad EN, page `en/catalogue/<slug>/`, tests. Fourchette en heures, par groupe
     (universel / adaptable).
   - **Récurrent** : support client en anglais, publications, mises à jour en double.
   - **Sur mesure anglophone** : contrat, facturation en devise étrangère et TVA (B2B hors UE / intra-UE),
     fuseaux horaires, appel découverte en anglais (`templates/appel-decouverte/`). Marquer chaque point
     fiscal ou juridique « à faire confirmer par un professionnel ».
   - Fiscalité Gumroad sur les ventes internationales (statut de vendeur responsable de la taxe ou non,
     à la date du jour) : vérifier sur la documentation officielle de Gumroad, citer la page et la date.

7. **Domaine `qm-engineering.cloud`**
   - Comparer : (a) garder `/en/` sur `qm-engineering.fr` (état actuel, `hreflang` déjà en place) ;
     (b) servir l'anglais sur `qm-engineering.cloud` ; (c) laisser `.cloud` en redirection.
   - Critères : référencement (autorité partagée ou divisée, `hreflang` entre domaines), perception de
     l'extension `.cloud` par un public américain, coût Netlify (un ou deux sites, déploiements facturés),
     maintenance. Présenter les effets SEO comme hypothèses sourcées.
   - Si la version anglaise du site sert de base, auditer sa parité avec la version française : skill
     `ux-ui-audit:ux-ui-audit` (moteur anglais et contrôle de parité entre langues), en local, sans rien
     publier.

8. **Risques** — skill `operations:risk-assessment`
   - Dispersion du temps de Quentin, dilution de la marque FR, double maintenance, support en anglais,
     risque fiscal, dépendance à X.

9. **Contre-expertise** — skill `devils-advocate:devils-advocate`
   - Soumettre la synthèse provisoire. Intégrer chaque objection retenue ; écrire pourquoi les autres
     sont écartées.

## Livrable

Un fichier `docs/strategie/opportunite-anglophone-AAAA-MM-JJ.md` (non publié par Netlify), contenant :

1. **Verdict en 5 lignes** : go / go partiel / no-go, et pourquoi.
2. **Faits mesurés** (Gumroad, dépôt, audience actuelle) séparés des **hypothèses**.
3. **Tri des templates** (tableau : template, groupe, justification, priorité EN).
4. **Concurrence et prix** (tableau sourcé et daté).
5. **Canaux** (tableau : canal, effort/semaine, délai, réutilisable, risque).
6. **Effort chiffré** : socle, par template, récurrent, sur mesure ; fourchettes basse/haute.
7. **Recommandation domaine** (a / b / c) avec ses conditions.
8. **Test minimal avant tout investissement** : le plus petit essai qui tranche (par ex. 3 templates
   universels traduits, une page EN, 4 semaines de publications sur un canal), avec un seuil chiffré de
   réussite ou d'arrêt fixé **à l'avance**.
9. **Risques et objections de la contre-expertise**.
10. **Ce que Quentin doit fournir ou relever lui-même** (statistiques X, accès Coda Community, temps
    disponible par semaine, appétence pour le support en anglais).

Termine par la liste des sources consultées (URL et date) et des points restés non vérifiés.
