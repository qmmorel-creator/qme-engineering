# T05 · Budget du foyer

Slug `budget`, préfixe `BDG`, prix 15 €, permalien Gumroad `budget-foyer`, taille M, priorité P1.
Origine : liste initiale (12/11/2026) et backlog de Quentin n° 43 « Budget personnel mensuel »
(fusionné : T05 gagne les enveloppes et le diagramme de Sankey des flux).

## Pour qui

Particuliers et foyers (personne seule, couple, famille, étudiant) qui veulent savoir où part leur argent
chaque mois et tenir un budget par enveloppes, sans application bancaire à abonnement, sans connexion à
leur banque et sans publicité. Un seul foyer, un seul budget : **revenus → enveloppes → dépenses**.

**Distinct de T65 « Budget commun »** (`templates/budget-commun/`) : T65 répartit des dépenses entre
plusieurs personnes (qui doit combien à qui). T05 ne s'occupe pas de qui paie : il suit le budget d'un
foyer entier, prévu contre réel.

## Écrans (5 onglets)

1. **Mois** (tableau de bord) : navigation entre les mois ; phrase d'en-tête « Il reste X € dans tes
   enveloppes » ; quatre tuiles (revenus réel / prévu, dépenses réel / enveloppes, épargne réel / prévu,
   solde du mois) ; **diagramme de Sankey** des flux du mois (sources de revenus → besoins, envies,
   épargne, non dépensé → catégories) ; **repère 50/30/20** (part réelle de chaque groupe dans les
   revenus du mois face au repère) ; enveloppes à surveiller (dépassées, presque vides).
2. **Enveloppes** : revenus prévu / réel par source ; « reste à affecter » (revenus prévus − total des
   enveloppes) ; par groupe (besoins, envies, épargne), chaque catégorie : enveloppe du mois, report du
   mois précédent, dépensé, reste, barre de progression, statut (ok, presque vide ≥ 90 %, dépassée, hors
   budget) ; détail réel par sous-catégorie ; total du groupe face à la cible 50/30/20 des revenus prévus.
3. **Opérations** : opérations du mois (dépenses et revenus) groupées par jour, filtre par catégorie,
   recherche ; ajout, modification, suppression avec « Annuler » ; bouton « Ajouter les opérations fixes
   du mois » (loyer, abonnements, salaire…), sans doublon.
4. **Bilan** : 12 derniers mois, dépenses réelles empilées par groupe face au total des enveloppes et
   aux revenus ; tableau par catégorie (moyenne mensuelle, total, écart cumulé au budget) ; tableau
   accessible du graphique.
5. **Catégories** : catégories et sous-catégories (nom, groupe, report des restes), sources de revenus
   (montant prévu), opérations fixes (jour du mois) ; ajout depuis le catalogue intégré.

Premier lancement : choix d'un modèle de foyer (préremplit catégories et sources), puis saisie des
revenus mensuels prévus. Les enveloppes se remplissent ensuite dans l'onglet Enveloppes.

## Saisie

- Montant en euros à la française (`12,50`, `1 234,5 €`, `12.5`) converti en **centimes entiers** ;
  tous les calculs se font en centimes (aucune erreur d'arrondi).
- Dépense : date, montant, catégorie, sous-catégorie (facultative), libellé (facultatif).
- Revenu : date, montant, source, libellé.
- Enveloppe : montant pour **ce mois seulement** ou **tous les mois** (montant par défaut), report du
  reste activable par catégorie.

## Mécanique clé

- **Enveloppe** d'une catégorie pour un mois = montant propre au mois s'il existe, sinon montant par
  défaut.
- **Report** (si activé pour la catégorie) : disponible(m) = enveloppe(m) + report(m), avec
  report(m) = disponible(m − 1) − dépensé(m − 1), calculé depuis le mois de départ du budget. Un reste
  positif s'accumule (vacances, cadeaux), un dépassement est retiré du mois suivant. Sans report, chaque
  mois repart de l'enveloppe.
- **Statut** : dépassée si dépensé > disponible ; presque vide si dépensé ≥ 90 % du disponible ; hors
  budget si dépense sans enveloppe ; ok sinon.
- **Sankey** : revenus réels par source → groupes (besoins, envies, épargne, non dépensé) → catégories.
  L'argent étant interchangeable, chaque source alimente chaque groupe au prorata (méthode du plus fort
  reste, sommes exactes en centimes). Si les sorties dépassent les revenus, un nœud rouge « Pris sur
  l'épargne ou le découvert » équilibre le diagramme. Au-delà de 6 catégories par groupe, les plus
  petites sont regroupées en « Autres ».
- **50/30/20** : part de chaque groupe dans les revenus (réels sur le tableau de bord, prévus sur
  Enveloppes) face au repère 50 % besoins, 30 % envies, 20 % épargne. Présenté comme un **repère**, pas
  une règle : le groupe de chaque catégorie est modifiable.
- **Opérations fixes** : chaque fixe génère au plus une opération par mois (identifiant `fixe:mois`),
  au jour indiqué (ramené au dernier jour des mois courts).

## Base intégrée

- **Catalogue de 22 catégories et 75 sous-catégories** d'un foyer français, rangées en
  besoins (logement, énergie et eau, alimentation, transports, santé, télécoms, enfants, assurances et
  banque, impôts et taxes, animaux), envies (restaurants et sorties, loisirs et sport, abonnements,
  shopping, beauté et bien-être, vacances, cadeaux et fêtes, dons) et épargne (épargne de précaution,
  projets, retraite, remboursement anticipé).
- **Sources de revenus types** : salaire, prime, allocations, pension, revenus locatifs, activité
  indépendante, autre.
- **4 modèles de foyer** : personne seule, couple sans enfant, famille avec enfants, étudiant. Ils
  choisissent les catégories et sources ; **aucun montant n'est proposé** (aucun chiffre inventé).
- **Repère 50/30/20** expliqué, avec son origine.

## Sources

- Règle 50/30/20 : popularisée par Elizabeth Warren et Amelia Warren Tyagi, *All Your Worth* (2005).
  Aucune source officielle : c'est un usage courant de conseil budgétaire, affiché comme repère. Aucune
  autre donnée externe, aucun taux, barème ni prix : **rien de daté**, rien à mettre à jour.
- Catalogue de catégories : rédigé pour le template (aucune base externe, aucune licence à vérifier).

## Risques

- **Argent** : avertissement dans l'application (tableau de bord, réglages, écran de connexion) et sur
  la fiche Gumroad : outil de suivi, ne remplace pas un conseil financier ou bancaire.
- Pas de connexion bancaire : saisie manuelle (c'est aussi l'argument : aucune donnée bancaire
  partagée). Données du foyer hébergées en ligne avec la clé ; partager la clé donne accès au budget.
- Marché concurrentiel (applications gratuites et à abonnement) : vendre l'achat unique, le Sankey, les
  enveloppes à report et le fonctionnement sur tous les appareils.
- Montants de l'artefact d'origine (« Suivi budget 3 800 € ») non repris : démo entièrement fictive.

## Choix d'implémentation

- Règles métier pures dans `templates/budget/regles.js` (`window.BDG`), testées par
  `outils/templates/budget.test.mjs`.
- Sankey en SVG maison : `viewBox` à la largeur réelle de l'écran ; nœuds sources et groupes en blocs
  larges avec le texte à l'intérieur, catégories étiquetées à gauche de leur nœud avec un halo papier ;
  chaque nœud occupe au moins une hauteur de deux lignes de texte (pas de chevauchement sur téléphone).
- Couleurs fixes des groupes : besoins bleu, épargne vert, envies jaune (contours encre, étiquettes
  directes et tableau accessible pour compenser le jaune peu contrasté).
