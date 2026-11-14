# Fiche Gumroad · Entretiens annuels et professionnels

Texte à reporter dans la fiche Gumroad (outils `mcp__Gumroad__*`), au format de `../gumroad-a-creer.json`
dans `gumroad.json`. Prix prévu dans `IDEES.md` (19 €) : **nom et prix à confirmer par Quentin** (minimum
12 € respecté). **Aucun produit Gumroad n'a été créé** (consigne de la mission du 14/11/2026). La clé de
licence est à activer à la main dans l'éditeur Gumroad (Content → Insert → License key, sans multi-postes),
puis l'identifiant produit reporté dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad` de
`ENP`). L'entrée n'a pas été ajoutée à `../gumroad-a-creer.json` (fichier partagé, laissé au coordinateur).

- **Produit interne** : `ENP` (préfixe des codes), application `https://qm-engineering.fr/templates/entretiens-annuels/`
- **Lien de contenu** : `https://qm-engineering.fr/connexion/`
- **Couverture** : `assets/templates-entretiens-annuels-couverture.png` (1280 × 720, générée par
  `outils/templates/couvertures-gumroad.cjs` avec les 3 lignes de `couverture.txt`), une fois en ligne
- **Bouton** : « Ouvrir mon suivi des entretiens »
- **Catégorie** : `business-and-money` (Business & Money), sous-catégorie **à confirmer** dans la liste
  Gumroad (gestion et management de préférence).
- **Pack** : « Petite entreprise » (PPE), où T79 est prévu. L'ajout de `ENP` aux `produits` du pack
  (`netlify/lib/packs.mjs`) et la régénération des pages (`outils/packs/generer.mjs`) sont laissés au
  coordinateur.

## Nom

Entretiens annuels et professionnels

## Prix

19 € (achat unique)

## Permalien

`entretiens-annuels-professionnels` (à confirmer à la création)

## Résumé (une phrase)

Les échéances de chaque salarié calculées (annuel, entretien de parcours professionnel, état des lieux des 8 ans), des trames prêtes, un compte rendu imprimable, et les objectifs comme les formations suivis d'une année sur l'autre.

## Description (HTML)

```html
<h2>Aucun entretien oublié.</h2><p>Sans logiciel RH, les entretiens vivent dans un dossier Word et un tableur : on les tient quand on y pense, et le jour de l'état des lieux des 8 ans, il faut tout retrouver. Les Entretiens annuels et professionnels calculent les échéances de chacun de tes salariés, te donnent la trame et gardent l'historique, d'une année sur l'autre.</p><h3>Ce que tu obtiens</h3><ul><li><strong>Les échéances de chaque salarié, calculées</strong> : entretien annuel, entretien de parcours professionnel (la première année après l'embauche, puis tous les 4 ans), état des lieux des 8 ans, et les cas particuliers : retour de congé parental ou de maternité, visite de mi-carrière, approche des 60 ans.</li><li><strong>Des trames prêtes</strong> : 58 questions par thème pour l'entretien annuel, l'entretien de parcours et l'état des lieux, que tu complètes avec tes propres questions.</li><li><strong>Un questionnaire de préparation</strong> à copier et envoyer au salarié, puis un compte rendu saisi pendant l'entretien, imprimé ou enregistré en PDF avec les cases de signature.</li><li><strong>Des objectifs SMART suivis d'une année sur l'autre</strong> : avancement, bilan à l'entretien suivant, reconduction, et un contrôle qui signale l'objectif flou.</li><li><strong>Les demandes de formation</strong>, de la demande à la réalisation, avec leur nature (obligatoire ou non).</li><li><strong>Le contrôle de l'état des lieux</strong> : entretiens tenus sur 8 ans, formation non obligatoire suivie, risque d'abondement CPF pour les entreprises de 50 salariés et plus.</li><li><strong>Des données minimales</strong> : prénom et initiale, poste, dates ; chaque fiche s'exporte et s'efface.</li></ul><h3>Comment ça marche</h3><ol><li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li><li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la.</li><li>Ajoute tes salariés avec la date de leur dernier entretien : les échéances se calculent aussitôt. Tes données sont enregistrées en ligne (hébergement en Europe) et te suivent sur ordinateur, tablette et téléphone avec la même clé.</li></ol><p>Rien à installer, aucun compte à créer. Achat unique, sans abonnement.</p><p><em>Outil d'aide à l'organisation, pas un conseil juridique ni un logiciel de paie. Périodicités relevées le 14/11/2026 sur service-public.gouv.fr (fiche F32040), affichées avec leur source et modifiables : ta convention collective, tes accords et les textes font foi. Démo disponible sur qm-engineering.fr/catalogue/entretiens-annuels.</em></p>
```

## Tags

entretien-professionnel, entretien-annuel, ressources-humaines, tpe, pme, management, francais

## Texte du reçu

Ta clé de licence (ci-dessus) est ton code d'accès. Ouvre qm-engineering.fr/connexion, colle-la, et ton suivi des entretiens s'ouvre. Ajoute tes salariés avec la date de leur dernier entretien : les échéances se calculent aussitôt. Garde cet e-mail : la même clé fonctionne sur tous tes appareils.

## Détails

- **Format** : Application web (ordinateur, tablette, téléphone)
- **Accès** : Clé de licence envoyée par e-mail
- **Langue** : Français
- **Paiement** : Achat unique, sans abonnement
- **Pour** : Dirigeants de TPE et PME, managers

## Points à vérifier avant publication

- Date de vérification de la fiche service-public F32040 (citée dans la description) : la relire le jour de
  la publication ; mettre à jour `templates/entretiens-annuels/donnees.js` (`BASE.reperes`) si elle a changé.
- Clé de licence active (`"is_licensed":true` sur la page de la fiche), puis passage en vente du site
  (`reference.md` § « À chaque publication Gumroad ») avec `section-site.html`.
