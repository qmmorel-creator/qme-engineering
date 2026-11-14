# Fiche Gumroad · Planning d'équipe et staffing

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json` (entrée ajoutée à `gumroad-a-creer.json`). Nom et prix fixés par le cadrage délégué
(35 €, tableau de bord de `IDEES.md`) : **à confirmer par Quentin avant la création**.
**Aucun produit Gumroad n'a été créé.** La clé de licence est à activer à la main dans l'éditeur Gumroad
(Content → Insert → License key, sans multi-postes), puis l'identifiant produit reporté dans `PRODUITS`.

- **Produit interne** : `EQP` (préfixe des codes), application `https://qm-engineering.fr/templates/planning-equipe/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-planning-equipe-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), à ajouter une fois en ligne
- **Bouton** : « Ouvrir mon planning d'équipe »
- **Catégorie** : `business-and-money/management-and-leadership` (Business & Money › Management & Leadership, comme les congés et l'onboarding)
- **Clé partagée** : une seule clé par entreprise, utilisée par plusieurs managers ; la clé Gumroad est
  vérifiée à chaque connexion sans incrémenter le compteur d'utilisations : ne pas activer de limite
  d'activations.

## Nom

Planning d'équipe et staffing

## Prix

35 € (achat unique)

## Permalien

`planning-equipe-staffing` (à confirmer à la création)

## Résumé (une phrase)

Qui fait quoi dans ton équipe chaque semaine, la charge réelle de chacun avec ses absences et son temps partiel, et les conflits signalés avant qu'ils coincent.

## Description (HTML)

```html
<h2>Qui fait quoi, et qui peut encore prendre.</h2>
<p>Un tableur de planning en couleurs, des temps partiels et des congés à garder en tête, et la découverte le jour J qu'une personne est affectée pendant ses vacances ou que quelqu'un tourne à 120 %… Le Planning d'équipe et staffing calcule la charge de chacun semaine par semaine et signale les conflits avant qu'ils coincent.</p>
<h3>Ce que tu obtiens</h3>
<ul>
<li><strong>Des affectations simples</strong> : une personne, un projet ou un poste à couvrir, des dates et un nombre d'heures par semaine, réparties sur ses jours travaillés.</li>
<li><strong>Le vrai taux de charge</strong> : capacité hebdomadaire de chaque personne (35 heures à temps complet par défaut, article L3121-27 du Code du travail, modifiable pour un temps partiel), moins ses jours non travaillés, congés, formations et jours fériés chômés.</li>
<li><strong>Les conflits signalés</strong> : surcharge, affectation pendant une absence, personne sans aucune des compétences demandées, poste à couvrir dont le besoin n'est pas tenu, et alertes de durée paramétrables (48 heures sur une semaine, 44 heures en moyenne sur 12 semaines par défaut).</li>
<li><strong>Des vues semaine et mois</strong>, par personne ou par projet, imprimables, et un aperçu de la charge des semaines concernées avant chaque affectation.</li>
<li><strong>Qui est disponible la semaine prochaine</strong> : heures libres de chacun, filtrées par compétence ou par rôle, avec un bouton pour affecter.</li>
<li><strong>Une clé pour tes managers</strong> : le même planning sur tous leurs appareils ; les saisies faites en même temps sont réunies et signées du prénom de leur auteur.</li>
<li><strong>Six modèles d'équipe</strong> pour démarrer (agence, bâtiment, commerce et restauration, atelier, services sur site, bureau d'études) : rôles, compétences et postes à couvrir proposés, tout se modifie.</li>
<li><strong>Des données minimales</strong> : aucune donnée de santé ; export, effacement ou suppression d'une personne ; exports CSV des affectations et de la charge sur 12 semaines.</li>
</ul><h3>Comment ça marche</h3>
<ol>
<li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li>
<li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li>
<li>Choisis ton secteur, ajoute ton équipe, tes projets et tes postes, puis affecte des heures par semaine. Le planning est enregistré en ligne et suit chaque manager qui a la clé, sur ordinateur, tablette et téléphone.</li>
</ol><p>Rien à installer, aucun compte à créer. Achat unique, sans abonnement.</p>
<p><em>Aucun e-mail envoyé, aucune connexion à un agenda ou à un logiciel de paie. Outil d'aide à la planification : la charge est celle que tu planifies, pas le temps de travail effectif ; ce n'est ni un logiciel de paie ni un conseil juridique. La convention collective, les accords d'entreprise et le Code du travail font foi. Repères de durée relevés le 14/11/2026, modifiables dans les réglages. Démo disponible sur qm-engineering.fr/templates.</em></p>
```

## Tags (7)

1. planning-equipe
2. staffing
3. charge-de-travail
4. management
5. pme
6. rh
7. francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton planning s'ouvre. Choisis ton secteur, ajoute ton équipe et tes projets, puis affecte des heures par semaine : la charge, les conflits et les disponibilités se calculent. Partage cette clé avec les managers qui tiennent le planning avec toi.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail, partageable entre managers
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : TPE et PME de 3 à 50 personnes qui planifient sur un tableur

## Avertissement (repris dans la description)

Aucun envoi, aucune connexion à un agenda ou à un logiciel de paie. Outil d'aide à la planification : la
charge planifiée n'est pas le temps de travail effectif. Repères relevés le 14/11/2026 sur
code.travail.gouv.fr (art. L3121-27 durée légale de 35 heures, L3121-20 maximum de 48 heures sur une
semaine, L3121-22 moyenne de 44 heures sur 12 semaines, L3133-1 fêtes légales), tous modifiables ; les
dérogations et accords ne sont pas gérés.
