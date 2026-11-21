# Fiche Gumroad · Gestion Dépenses Communes

Texte à reprendre dans `create_draft_product` / `update_product` une fois **nom et prix confirmés par
Quentin**. Ne rien publier sans son accord. Penser au bloc « License key » dans l'onglet Content
(à activer à la main par Quentin) et au lien de contenu vers https://qm-engineering.fr/connexion/.

## Nom

Gestion Dépenses Communes · couple, colocation, famille

## Prix

15 €

## Permalien proposé

`budget-commun` (à reporter ensuite à la place de `budget-commun` dans les livrables du site)

## Résumé (une ligne)

Qui doit combien à qui, sans calculette : dépenses partagées, répartition au prorata des revenus et équilibrage en un minimum de virements.

## Description

Partager les dépenses à deux, à trois ou en famille, c'est simple à parts égales. Dès qu'on veut tenir
compte des revenus de chacun, d'un enfant ou d'une plus grande chambre, le tableur devient source de
discussions. Le budget commun fait les calculs pour vous.

**Ce que vous obtenez**

- **Soldes toujours à jour** : qui doit combien à qui, après chaque dépense.
- **Quatre façons de répartir** : à parts égales, au prorata des revenus, en parts (2 pour un adulte,
  1 pour un enfant…) ou en montants exacts. Calculs au centime près, la somme tombe toujours juste.
- **Équilibrage** : le nombre minimal de virements pour remettre les comptes à zéro ; un geste pour
  l'enregistrer.
- **Dépenses récurrentes** : loyer, énergie, abonnements ajoutés d'eux-mêmes chaque mois, avec la
  bonne répartition.
- **Bilan du mois** : total, par catégorie, par personne, et l'évolution sur 6 mois.
- **Prêt à l'emploi** : trois modèles de foyer (couple, colocation à trois, famille), douze catégories
  de dépenses, les règles de répartition expliquées.

**Pour tout le foyer**

Une seule clé : chaque membre (de 2 à 6 personnes) ouvre l'application sur son propre téléphone et voit
les mêmes comptes. Si deux personnes enregistrent au même moment, les deux saisies sont réunies : aucune
dépense n'est perdue. La clé donne un accès complet : ne la partagez qu'avec les membres du foyer.

**Comment ça marche**

1. Achetez : la clé de licence arrive aussitôt par e-mail.
2. Ouvrez https://qm-engineering.fr/connexion/ et collez la clé.
3. Choisissez votre modèle de foyer, ajoutez vos premières dépenses.

Fonctionne dans le navigateur (ordinateur, tablette, téléphone), installable sur l'écran d'accueil,
utilisable hors connexion. Les données sont enregistrées en ligne avec votre clé ; une copie peut être
téléchargée à tout moment.

**À savoir** : aucune connexion bancaire. Les soldes sont calculés à partir de ce que vous saisissez ;
vérifiez-les avant un virement. Ce n'est pas un conseil financier. Interface en français.

Achat unique, sans abonnement. Essayez la démo avant d'acheter :
https://qm-engineering.fr/templates/budget-commun/?demo

## Tags (5)

budget, couple, colocation, dépenses partagées, finances personnelles

## Texte du reçu

Merci pour votre achat ! Votre clé de licence figure ci-dessus. Pour ouvrir votre budget commun : allez
sur https://qm-engineering.fr/connexion/, collez la clé, puis choisissez votre modèle de foyer. Pour
partager avec votre partenaire ou vos colocataires, transmettez-leur cette même clé : chacun l'ouvre
sur son téléphone et voit les mêmes comptes. Gardez cet e-mail : la clé vous servira sur chaque nouvel
appareil. Une question : quentin.morel@qm-engineering.fr

## Bouton

Ouvrir mon budget commun

---

## Mise à jour « compte commun » (préparée le 20/11/2026, à appliquer à la fusion)

Partir de la fiche en ligne (relue le 20/11/2026 : tutoiement, essai gratuit), produit `FK_HeZlqRLdZO8o7Y1Bccw==`.
À appliquer par `update_product` **une fois le mode compte commun en production** (sinon la fiche annonce une
fonction absente de l'application). Champs changés : `description`, `summary`, `tags`, `additional_details`.

### Résumé

Qui doit combien à qui, ou combien chacun verse sur le compte commun : répartition au centime, au prorata des revenus ou en parts.

### Tags

budget, francais, couple, famille, colocation, compte joint, partage

### Détails (ajout d'une ligne après « Foyer »)

Fonctionnement : Avances et remboursements, ou compte commun

### Description (HTML)

```html
<h2>Partager les dépenses sans se disputer sur les calculs.</h2>
<p>À deux, en colocation ou en famille, deux façons de faire, au choix :</p>
<ul>
<li><strong>Chacun paie de son côté</strong> : l'application répartit chaque dépense au centime près et indique qui doit combien à qui.</li>
<li><strong>Vous avez un compte joint</strong> : l'application calcule chaque mois combien chacun y verse.</li>
</ul>
<p><strong>Essai gratuit de 14 jours, sans carte bancaire</strong> : essaie-le avec tes propres données sur <a href="https://qm-engineering.fr/essai/?t=budget-commun">qm-engineering.fr/essai</a>. Si tu l'achètes ensuite, saisis ta clé dans le template (bouton « J'ai acheté ») : tout ce que tu as saisi pendant l'essai est repris.</p>
<h3>Mode « avances et remboursements »</h3>
<ul>
<li><strong>Soldes toujours à jour</strong> après chaque dépense.</li>
<li><strong>Quatre façons de répartir</strong> : parts égales, prorata des revenus, parts (2 pour un adulte, 1 pour un enfant…) ou montants exacts ; la somme tombe toujours juste.</li>
<li><strong>Équilibrage</strong> : le nombre minimal de virements pour remettre les comptes à zéro.</li>
</ul>
<h3>Mode « compte commun »</h3>
<ul>
<li><strong>Le versement de chacun, chaque mois</strong> : charges récurrentes + budget de dépenses courantes + sorties à prévoir (débit différé…), moins le solde du compte.</li>
<li><strong>Ta clé de répartition</strong> : parts égales, prorata des revenus ou parts (60/40…), au centime près.</li>
<li><strong>Charges personnelles</strong> : le forfait ou l'assurance d'une seule personne s'ajoute à son seul versement.</li>
<li><strong>Suivi du compte</strong> : versements notés d'un geste, solde estimé du compte.</li>
</ul>
<h3>Dans les deux modes</h3>
<ul>
<li><strong>Dépenses récurrentes</strong> : loyer, énergie, abonnements ajoutés chaque mois.</li>
<li><strong>Bilan du mois</strong> par catégorie et par personne, évolution sur 6 mois.</li>
<li><strong>Pour tout le foyer</strong> : de 2 à 6 personnes, chacune sur son téléphone avec la même clé ; deux saisies simultanées sont réunies, aucune dépense perdue.</li>
<li>Tu changes de mode quand tu veux dans les réglages, sans rien perdre.</li>
</ul>
<h3>Comment ça marche</h3>
<ol>
<li>Après l'achat, tu reçois ta <strong>clé de licence</strong> par e-mail.</li>
<li>Ouvre <strong>qm-engineering.fr/connexion</strong> et saisis-la ; partage la clé avec les membres du foyer (elle donne un accès complet).</li>
<li>Choisis ton modèle de foyer et ton fonctionnement, puis ajoute tes premières dépenses.</li>
</ol>
<p>Rien à installer, aucune connexion bancaire. Achat unique, sans abonnement.</p>
<p><em>Les montants sont calculés à partir de vos saisies : vérifie-les avant un virement. Ce n'est pas un conseil financier. Démos sur qm-engineering.fr/catalogue/budget-commun.</em></p>
```

Packs contenant Gestion Dépenses Communes (Argent du quotidien, Voyage, Mariage et installation à deux) : reprendre leur
`description_html` régénérée dans `docs/templates/communication/packs/gumroad-packs.json` au même moment.
