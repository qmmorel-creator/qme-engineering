# Classement noté des 28 produits en vente · 15/11/2026

Demandé dans `plan-6-mois.md` (§ 9, point 4). Sert à choisir les produits à pousser en priorité. Non publié
(`/docs/*` renvoie 404).

**Ce que c'est** : un jugement argumenté, pas une mesure. Chaque note s'appuie sur les fichiers du dépôt
(`docs/templates/IDEES.md`, pages `catalogue/<slug>/`, `outils/packs/donnees.mjs`, `netlify/lib/packs.mjs`,
`docs/templates/communication/`), sans fonction ajoutée. Avec 0 vente et des pages catalogue presque pas
vues, aucune note ne vient de données de vente (voir § 5).

## Méthode

| Critère | Poids | 5 = | 1 = |
|---|---|---|---|
| Problème résolu (Pb) | 25 % | douleur concrète, fréquente, qui revient chaque mois | besoin vague ou rare |
| Démonstration en 20 s, texte à l'écran (Démo) | 20 % | un chiffre ou une image qui se comprend sans le son | écran de registre, lisible seulement par un initié |
| Valeur perçue / prix (V/P) | 15 % | prix faible face à ce qu'on obtient ou à ce qu'on économise | prix élevé pour un besoin qu'on comble autrement |
| Taille du public francophone (Pub) | 15 % | presque tout le monde (foyers, étudiants) | une profession de niche |
| Concurrence gratuite (Conc.) | 10 % | peu d'outils gratuits équivalents | modèles et applis gratuits très abondants |
| Ventes complémentaires (VC) | 15 % | dans un pack composé de produits en vente, plusieurs voisins en vente | seul, pack surtout « bientôt » |

- **Total pondéré** = 0,25 Pb + 0,20 Démo + 0,15 V/P + 0,15 Pub + 0,10 Conc. + 0,15 VC (sur 5).
- **Instagram/TikTok (IG/TT)** et **LinkedIn (LI)** sont notés à part, hors pondération : ils servent à
  choisir le canal et à départager les ex aequo.
- **Communication existante** : Reels (`instagram/png/IG-xx-*.mp4`, sources dans `instagram/production/`)
  et carrousels (`instagram/png/` ou `<slug>/instagram/`), avec leur date au calendrier
  (`calendrier-2026-11-15.md`).
- **Packs** : comptés depuis `PACKS` (« x/y » = templates en vente sur le total du pack). Aucun pack n'a
  encore d'identifiant Gumroad dans `packs.mjs` : la complémentarité est potentielle, aucun pack ne
  s'achète aujourd'hui.

## 1. Tableau des 28 produits, trié par total

| Rang | Produit | Prix | Public | Pb | Démo | V/P | Pub | Conc. | VC | **Total** | IG/TT | LI | Reel / carrousel déjà produits |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | T05 Budget du foyer | 15 € | Particuliers, foyers | 5 | 5 | 4 | 5 | 1 | 5 | **4,45** | 5 | 2 | Reels IG-42 (avant/après), IG-47 (décembre, 18/12) ; carrousel IG-11 (20/12) |
| 2 | T65 Budget commun | 15 € | Couples, colocations | 5 | 5 | 4 | 4 | 2 | 5 | **4,40** | 5 | 1 | Reels IG-49 (22/12), IG-60 (31/12) ; carrousel IG-08 (26/11) |
| 3 | T14 Suivi des abonnements | 9 € | Particuliers, foyers | 4 | 5 | 5 | 5 | 2 | 4 | **4,30** | 5 | 2 | Carrousel IG-62 (19/12), **aucun Reel** |
| 4 | T43 Relance des impayés | 19 € | TPE, freelances | 5 | 4 | 4 | 4 | 2 | 4 | **4,05** | 2 | 5 | Carrousel IG-69 (04/01), aucun Reel |
| 5 | T02 Planning Gantt rapide | 45 € | Artisans, PME, BTP, chefs de projet | 4 | 5 | 4 | 3 | 2 | 4 | **3,85** | 2 | 5 | Reels IG-37 (16/11), IG-61 (01/01) ; carrousels IG-09 (28/11), IG-48 (08/12) |
| 6 | T31 Compte rendu → plan d'actions | 15 € | Managers, chefs de projet | 4 | 4 | 4 | 4 | 2 | 4 | **3,80** | 2 | 5 | Reel IG-55 (15/12) ; carrousel IG-04 |
| 7 | T42 Trésorerie prévisionnelle 12 mois | 29 € | TPE, indépendants | 4 | 4 | 4 | 3 | 2 | 5 | **3,80** | 1 | 5 | Carrousel IG-20 (14/12), aucun Reel |
| 8 | T40 Calculateur TJM freelance | 12 € | Freelances débutants | 4 | 5 | 4 | 3 | 1 | 4 | **3,75** | 3 | 5 | Reel IG-46 (29/12) ; carrousel IG-06 (22/11) |
| 9 | T37 Coût de revient et prix par client | 25 € | Prestataires de services | 4 | 4 | 4 | 3 | 3 | 4 | **3,75** | 2 | 5 | Reel IG-58 (24/12) ; carrousel IG-05 (20/11) |
| 10 | T36 Générateur de devis | 29 € | Artisans, freelances | 4 | 3 | 4 | 4 | 1 | 5 | **3,65** | 2 | 4 | Reel IG-53 (11/12) ; carrousel IG-19 (13/12) |
| 11 | T08 Suivi d'habitudes | 12 € | Particuliers | 3 | 4 | 3 | 5 | 1 | 5 | **3,60** | 4 | 1 | Carrousel IG-63 (27/12), aucun Reel |
| 12 | T03 Gestionnaire de tâches | 19 € | Indépendants, cadres, étudiants | 4 | 4 | 3 | 4 | 1 | 4 | **3,55** | 3 | 3 | Reel IG-56 (16/12) ; carrousel IG-10 (30/11) |
| 13 | T01 Planning de révision | 14,90 € | Lycéens, étudiants, concours | 4 | 4 | 4 | 5 | 1 | 2 | **3,55** | 4 | 1 | Reels IG-38 (17/11), IG-41 (24/11), IG-45 (03/12) ; aucun carrousel |
| 14 | T04 Nutrition et dépense énergétique | 19 € | Gestion du poids, sportifs amateurs | 4 | 4 | 4 | 5 | 1 | 2 | **3,55** | 4 | 1 | Reel IG-40 (19/11) ; aucun carrousel |
| 15 | T41 Livre recettes-dépenses micro | 25 € | Micro-entrepreneurs | 4 | 3 | 3 | 4 | 1 | 5 | **3,50** | 3 | 4 | Reel IG-57 (17/12) ; carrousel IG-07 (23/11) |
| 16 | T32 Levée de réserves (OPR) | 39 € | Conducteurs de travaux, MOE, syndics | 4 | 3 | 4 | 2 | 4 | 4 | **3,50** | 1 | 5 | Reel IG-44 (02/12) ; carrousel IG-17 (07/12) |
| 17 | T71 Dossier sinistre habitation | 29 € | Particuliers sinistrés | 3 | 3 | 4 | 4 | 4 | 3 | **3,40** | 3 | 1 | Carrousel IG-66 (03/01), aucun Reel |
| 18 | T67 Pilote de travaux maison | 25 € | Particuliers en rénovation | 4 | 3 | 4 | 3 | 3 | 3 | **3,40** | 3 | 1 | Carrousel IG-26 (28/12), aucun Reel |
| 19 | T94 État des lieux entrée/sortie | 19 € | Bailleurs, locataires | 4 | 3 | 4 | 4 | 1 | 3 | **3,35** | 3 | 2 | Carrousel produit (`etat-des-lieux/instagram/`), **non programmé** |
| 20 | T95 Rentabilité investissement locatif | 15 € | Investisseurs particuliers | 3 | 5 | 4 | 3 | 1 | 3 | **3,35** | 4 | 2 | Carrousel produit (`investissement-locatif/instagram/`), **non programmé** |
| 21 | T15 Organisateur de mariage | 29 € | Futurs mariés | 4 | 3 | 4 | 3 | 2 | 3 | **3,30** | 4 | 1 | Carrousel IG-21 (23/12), aucun Reel |
| 22 | T22 Tableau annuel et roue de vie | 15 € | Particuliers, coachs | 3 | 3 | 3 | 4 | 1 | 5 | **3,25** | 4 | 2 | Carrousel produit (`tableau-annuel/instagram/`), **non programmé** |
| 23 | T24 Circuit de visa des documents | 39 € | MOE, bureaux d'études, OPC | 4 | 2 | 4 | 1 | 5 | 4 | **3,25** | 1 | 4 | Carrousel IG-12 (04/12), aucun Reel |
| 24 | T80 Document unique (DUERP) | 29 € | Employeurs de TPE/PME | 4 | 2 | 4 | 4 | 2 | 3 | **3,25** | 1 | 4 | Carrousel produit (`document-unique/instagram/`), **non programmé** |
| 25 | T47 Planning d'équipe et staffing | 35 € | Managers, agences | 4 | 3 | 3 | 3 | 2 | 3 | **3,15** | 1 | 4 | Carrousel produit (`planning-equipe/instagram/`), **non programmé** |
| 26 | T53 Inscriptions associatives | 29 € | Associations, clubs | 4 | 3 | 4 | 3 | 2 | 2 | **3,15** | 1 | 3 | Carrousel IG-24 (21/12), aucun Reel |
| 27 | T25 Registre des non-conformités | 20 € | Qualité BTP et industrie | 3 | 3 | 4 | 2 | 3 | 4 | **3,15** | 1 | 4 | Carrousel IG-13 (05/12), aucun Reel |
| 28 | T28 CRM freelance | 25 € | Freelances, consultants | 3 | 3 | 3 | 3 | 1 | 3 | **2,80** | 1 | 4 | Carrousel IG-14 (06/12), aucun Reel |

Les ex aequo sont départagés par l'adéquation à la stratégie (grand public sur TikTok/Instagram, pros sur
LinkedIn).

### Justification des notes, produit par produit

Ordre du tableau. Une phrase par critère : Pb · Démo · V/P · Pub · Conc. · VC.

1. **T05 Budget du foyer** — Pb 5 : « savoir où part leur argent », enveloppes et écart au prévu chaque mois.
   Démo 5 : le diagramme des flux « du salaire jusqu'aux courses » est une image immédiate (déjà monté en
   avant/après dans IG-42). V/P 4 : 22 catégories, 75 sous-catégories et 4 modèles de foyer pour 15 €. Pub 5 :
   tous les foyers. Conc. 1 : les modèles de budget gratuits sont les plus abondants qui soient. VC 5 : dans
   4 packs, dont Argent du quotidien (4/4 en vente).
2. **T65 Budget commun** — Pb 5 : « qui doit combien à qui », question de chaque mois en couple ou en
   colocation. Démo 5 : l'exemple « 1 000 € avec des revenus de 2 600 € et 1 900 € : 577,78 € et 422,22 € »
   (`templates/budget-commun/donnees.js`) est un résultat chiffré en une ligne. V/P 4 : quatre répartitions et
   virements minimaux, une clé pour tout le foyer. Pub 4 : couples et colocataires, large mais pas tous les
   foyers. Conc. 2 : des applis gratuites de partage de dépenses existent, rarement avec le prorata des revenus
   (jugement non vérifié). VC 5 : packs Argent du quotidien (4/4), Mariage et installation, Voyage.
3. **T14 Suivi des abonnements** — Pb 4 : abonnements oubliés et fins d'essai gratuit ; réel mais moins
   quotidien que le budget. Démo 5 : « le vrai total » par mois et par an, un chiffre unique qui surprend.
   V/P 5 : 9 €, et l'argument « il se rembourse dès le premier abonnement résilié » (`plan-6-mois.md`) ;
   l'économie annuelle est calculée. Pub 5 : tous les foyers. Conc. 2 : applis gratuites et relevés bancaires
   existent (jugement). VC 4 : packs Argent du quotidien (4/4) et Reprendre la main sur son argent (2/9).
4. **T43 Relance des impayés** — Pb 5 : attendre un paiement est la douleur la plus directe d'une TPE.
   Démo 4 : retard en jours, pénalités et message de relance rempli, montrables en trois écrans. V/P 4 : 19 €,
   pénalités et indemnité de 40 € calculées, 4 paliers de messages. Pub 4 : TPE et freelances, très nombreux.
   Conc. 2 : modèles de lettres de relance gratuits abondants, calculateurs de pénalités aussi. VC 4 : pack
   Freelance : chiffrer, facturer, encaisser (6/7 en vente).
5. **T02 Planning Gantt rapide** — Pb 4 : « une date bouge, et vingt cellules à reprendre à la main »
   (`videos-30-jours.md`). Démo 5 : « Pose des meubles 12/12 3j après 7 » crée la barre et le lien, chemin
   critique en rouge ; deux Reels existent. V/P 4 : 45 €, le plus cher, mais face à un logiciel de
   planification pour un pro. Pub 3 : artisans, PME, chefs de projet. Conc. 2 : modèles Gantt gratuits
   abondants, chemin critique plus rare. VC 4 : pack Chef de projet BTP (5/8).
6. **T31 Compte rendu → plan d'actions** — Pb 4 : les actions perdues entre deux réunions. Démo 4 :
   « Marie : envoyer le devis avant vendredi » devient une action datée qui revient à la réunion suivante.
   V/P 4 : 15 €, 8 modèles de réunion. Pub 4 : tout manager qui anime des réunions récurrentes. Conc. 2 :
   modèles de compte rendu gratuits abondants ; la reprise automatique est moins courante. VC 4 : packs BTP
   (5/8) et Petite entreprise (4/9).
7. **T42 Trésorerie prévisionnelle** — Pb 4 : « le creux de trésorerie se voit avant d'arriver ». Démo 4 :
   point bas des 12 mois et mois sous le seuil, une courbe lisible. V/P 4 : 3 scénarios, 37 catégories, 4
   profils. Pub 3 : dirigeants de TPE, indépendants. Conc. 2 : plans de trésorerie gratuits en tableur
   répandus. VC 5 : dans 4 packs (Freelance gestion, Petite entreprise, Associations, Commerçant).
8. **T40 Calculateur TJM** — Pb 4 : fixer son tarif, au démarrage puis à chaque révision. Démo 5 : « 254 jours
   ouvrés en 2027, vous n'en facturerez pas 254 » (Reel IG-46), TJM minimum et conseillé en un écran.
   V/P 4 : 12 €, statuts et seuils intégrés. Pub 3 : freelances débutants. Conc. 1 : calculateurs de TJM
   gratuits en ligne très nombreux. VC 4 : porte d'entrée du pack Freelance (6/7).
9. **T37 Coût de revient** — Pb 4 : savoir si un client est rentable. Démo 4 : « votre meilleur client vous
   rapporte peut-être le moins » (Reel IG-58), clients sous le plancher signalés. V/P 4 : 25 €, 32 postes de
   charges. Pub 3 : prestataires et petites agences. Conc. 3 : outil gratuit équivalent moins courant que pour
   le TJM (jugement). VC 4 : pack Freelance (6/7).
10. **T36 Générateur de devis** — Pb 4 : devis faits au traitement de texte. Démo 3 : un devis A4 propre
    se montre, mais « juste au centime » ne se voit pas en 20 s. V/P 4 : 29 €, 12 listes par métier, mentions
    vérifiées. Pub 4 : artisans et freelances. Conc. 1 : générateurs de devis gratuits très nombreux. VC 5 :
    packs Freelance (6/7) et Commerçant et artisan (3/5).
11. **T08 Suivi d'habitudes** — Pb 3 : envie plus que douleur. Démo 4 : cocher en une touche et grille du mois.
    V/P 3 : 12 €, face à beaucoup d'applis gratuites. Pub 5 : très large, pic au 1er janvier
    (`plan-6-mois.md`). Conc. 1 : très abondante. VC 5 : dans 4 packs, dont Bien démarrer l'année (3/3).
12. **T03 Gestionnaire de tâches** — Pb 4 : appli de tâches trop chargée ou à abonnement. Démo 4 : la saisie
    « Appeler la banque demain 14h !haute #Perso 30min » se décompose à l'écran. V/P 3 : 19 €, face à des
    applis gratuites très complètes. Pub 4 : indépendants, cadres, étudiants. Conc. 1. VC 4 : Productivité
    perso (3/5), Bien démarrer l'année (3/3).
13. **T01 Planning de révision** — Pb 4 : partiels et examens, saisonnier mais récurrent. Démo 4 : « J+1, J+3,
    J+7, J+14, J+30 » (Reel IG-41). V/P 4 : 12 formations préremplies et 12 méthodes. Pub 5 : lycéens,
    étudiants, candidats. Conc. 1 : applis de répétition espacée gratuites répandues. VC 2 : pack Étudiant
    (2/7 en vente).
14. **T04 Nutrition** — Pb 4 : gérer son poids, très courant. Démo 4 : facteur calorique « mangé ÷ dépensé »
    (Reel IG-40). V/P 4 : 3 300 aliments Ciqual, sans abonnement ni publicité. Pub 5. Conc. 1 : applis gratuites
    (avec publicité) très abondantes. VC 2 : pack Forme (2/5). Données de santé : prudence de communication.
15. **T41 Livre recettes-dépenses micro** — Pb 4 : obligation et déclarations à chaque échéance. Démo 3 : le
    CA à déclarer et l'alerte à 80 % du seuil, peu visuels. V/P 3 : 25 € pour ce que beaucoup tiennent en
    tableur gratuit. Pub 4 : micro-entrepreneurs, très nombreux. Conc. 1. VC 5 : Freelance (6/7) et
    Commerçant (3/5).
16. **T32 Levée de réserves** — Pb 4 : chaque réception génère des réserves à suivre. Démo 3 : PV par
    entreprise et retards, parlants pour le BTP seulement. V/P 4 : 39 €, saisie terrain et PV prêts. Pub 2 :
    niche. Conc. 4 : peu d'outils gratuits dédiés (jugement). VC 4 : pack BTP (5/8). Démo affichant « Bientôt
    en vente » à corriger (`audit-viralite-2026-11-14.md`).
17. **T71 Dossier sinistre** — Pb 3 : douleur aiguë mais rare pour un même foyer. Démo 3 : délai calculé en
    jours ouvrés, inventaire chiffré. V/P 4 : 29 € face à l'enjeu d'une indemnisation. Pub 4 : tous les foyers,
    mais l'intention n'existe qu'après le sinistre. Conc. 4 : peu d'outils gratuits intégrés (jugement). VC 3 :
    pack Propriétaire (4/9).
18. **T67 Pilote de travaux** — Pb 4 : plusieurs artisans, devis à comparer. Démo 3 : devis côte à côte, le
    moins cher calculé. V/P 4. Pub 3 : particuliers en rénovation. Conc. 3. VC 3 : pack Propriétaire (4/9).
19. **T94 État des lieux** — Pb 4 : litige sur le dépôt de garantie à chaque déménagement. Démo 3 : « la
    sortie comparée à l'entrée », plusieurs écrans. V/P 4 : 19 €. Pub 4 : bailleurs et locataires. Conc. 1 :
    modèles gratuits d'état des lieux très répandus. VC 3 : pack Propriétaire (4/9).
20. **T95 Investissement locatif** — Pb 3 : étude avant achat, ponctuelle. Démo 5 : rendement brut, net,
    cash-flow et « prix à ne pas dépasser », chiffres immédiats. V/P 4 : 15 €, 5 biens côte à côte. Pub 3.
    Conc. 1 : simulateurs gratuits très nombreux. VC 3 : pack Propriétaire (4/9).
21. **T15 Organisateur de mariage** — Pb 4 : gros projet, mais une fois. Démo 3 : « si la date change, tout
    se recale », plan de table. V/P 4 : 29 € face au budget d'un mariage. Pub 3 : saisonnier
    (janvier-février). Conc. 2 : checklists gratuites abondantes. VC 3 : pack Mariage et installation (3/6).
22. **T22 Tableau annuel et roue de vie** — Pb 3 : envie de bilan, pas une douleur. Démo 3 : la roue notée
    est visuelle, le reste (OKR, revue) est long à montrer. V/P 3 : 15 €. Pub 4 : pic du 1er janvier. Conc. 1 :
    roues de vie imprimables gratuites abondantes. VC 5 : dans 3 packs, dont Argent du quotidien et Bien
    démarrer l'année, tous deux 100 % en vente.
23. **T24 Circuit de visa** — Pb 4 : quotidien d'une MOE. Démo 2 : registre d'indices et d'avis VSO/VAO/REF,
    opaque hors du métier. V/P 4 : 39 €. Pub 1 : niche. Conc. 5 : rien de gratuit d'équivalent repéré
    (jugement). VC 4 : pack BTP (5/8).
24. **T80 DUERP** — Pb 4 : obligation dès le premier salarié. Démo 2 : cotation et plan d'actions, peu
    spectaculaires. V/P 4 : 29 € face au temps d'un DUERP. Pub 4 : employeurs de TPE. Conc. 2 : des outils
    publics gratuits existent (jugement, à vérifier). VC 3 : pack Petite entreprise (4/9).
25. **T47 Planning d'équipe** — Pb 4 : « qui est disponible la semaine prochaine ». Démo 3 : conflits et
    surcharges signalés. V/P 3 : 35 €. Pub 3 : managers de 3 à 50 personnes. Conc. 2. VC 3 : pack Petite
    entreprise (4/9).
26. **T53 Inscriptions associatives** — Pb 4 : rentrée, listes d'attente, quotient familial. Démo 3 : la place
    libérée prise par la liste d'attente. V/P 4. Pub 3 : associations nombreuses, acheteur = bénévole. Conc. 2.
    VC 2 : pack Associations (2/7). Démo affichant « Bientôt en vente » à corriger.
27. **T25 Non-conformités** — Pb 3 : utile, moins pressant. Démo 3 : 5 pourquoi et Pareto. V/P 4 : 20 €.
    Pub 2. Conc. 3 : registres en tableur gratuits. VC 4 : pack BTP (5/8).
28. **T28 CRM freelance** — Pb 3 : relances oubliées. Démo 3 : « à relancer aujourd'hui ». V/P 3 : 25 € face à
    des CRM gratuits. Pub 3. Conc. 1. VC 3 : pack Trouver ses clients (1/7), mais voisins en vente (devis,
    impayés, TJM).

## 2. Les 5 produits à pousser en priorité

1. **T05 Budget du foyer** — meilleur total ; cœur du moteur « argent du quotidien » ; deux Reels prêts,
   dont IG-47 calé sur décembre ; ouvre le pack Argent du quotidien. Risque : concurrence gratuite maximale,
   donc vendre le diagramme des flux et les enveloppes reportées, pas « un budget ».
2. **T65 Budget commun** — résultat chiffré en une phrase (« 577,78 € et 422,22 € »), sujet de conversation
   en couple, deux Reels prêts pour Noël (IG-49, IG-60) ; le calculateur gratuit « 50/50 ou au prorata »
   décidé dans `plan-6-mois.md` y mène directement.
3. **T14 Suivi des abonnements** — produit d'appel à 9 €, chiffre-choc du « vrai total par an ». **Manque un
   Reel** ; son post LinkedIn (LI-107, 17/12) et son carrousel (IG-62, 19/12) arrivent tard pour un produit
   d'appel : avancer et produire un Reel en premier.
4. **T43 Relance des impayés** — la douleur pro la plus directe, calcul visible (pénalités, 40 €), pour
   LinkedIn depuis la page QME ; voisin naturel du TJM, du devis et de la trésorerie dans le pack Freelance.
   Aucun Reel ; communication seulement le 03-04/01.
5. **T02 Planning Gantt rapide** — démonstration la plus forte côté pro (une ligne tapée, une barre, le chemin
   critique en rouge), deux Reels et deux carrousels prêts, prix le plus haut (une vente vaut trois produits
   à 15 €), métier de Quentin comme preuve ; cible BTP et artisans sur LinkedIn.

Juste derrière : T31 Compte rendu et T42 Trésorerie (LinkedIn), T40 TJM (porte d'entrée freelance à 12 €).

## 3. Les 5 plus faciles à démontrer en 20 s (texte à l'écran)

| Produit | Ce qui se montre en un plan | Déjà produit |
|---|---|---|
| T14 Suivi des abonnements | le total réel par an, puis l'économie de « à résilier » | carrousel seulement |
| T65 Budget commun | « qui doit combien à qui », au prorata des revenus | Reels IG-49, IG-60 |
| T05 Budget du foyer | le diagramme des flux du salaire aux catégories | Reels IG-42, IG-47 |
| T40 Calculateur TJM | jours ouvrés de l'année → TJM minimum et conseillé | Reel IG-46 |
| T02 Planning Gantt | une ligne tapée crée la barre, le lien et le chemin critique | Reels IG-37, IG-61 |

Sixième, à égalité de note : T95 Investissement locatif (rendement, cash-flow, prix maximal), dont le
carrousel existe mais n'est pas programmé.

## 4. Ressources gratuites à associer

Chaque ressource reprend un contenu ou un calcul **déjà présent** dans le produit ou dans les documents
du dépôt ; aucune ne suppose de fonction nouvelle du template payant.

| Produit | Ressource gratuite | Source dans le dépôt |
|---|---|---|
| T65 Budget commun | Calculateur « 50/50 ou au prorata » en page libre du site | décision n° 9 de `plan-6-mois.md` ; répartitions déjà codées dans le template |
| T32 Levée de réserves | Check-list gratuite de réception de chantier, avec le guide « Lever les réserves après la réception » | `plan-6-mois.md` § 9 ; `docs/seo/guides.md` § 3 |
| T43 Relance des impayés | Guide « Facture impayée entre professionnels : délais, pénalités, indemnité de 40 €, mise en demeure » | `docs/seo/guides.md` § 2 |
| T40 TJM, T37 Coût de revient, T02 Gantt | Calendrier 2027 des jours ouvrés et fériés (option Alsace-Moselle), qui sert aussi le guide TJM | jours fériés calculés dans les trois templates ; `guides.md` § 8 ; Reel IG-46 |
| T14 Suivi des abonnements | Liste à cocher des 17 catégories d'abonnements « oubliés » (sans marque ni prix), qui renvoie au total réel | base intégrée de plus de 90 abonnements en 17 catégories |
| T71 Dossier sinistre | Guide « Dégât des eaux : déclarer dans les délais », avec le tableau des délais légaux (5 jours ouvrés, 2 pour un vol, 30 jours après l'arrêté de catastrophe naturelle) | FAQ de `catalogue/sinistre/` ; `guides.md` § 6 |
| T94 État des lieux | Guide « Mentions, vétusté et restitution du dépôt de garantie » | `guides.md` § 4 |
| T80 DUERP | Guide « Qui doit le faire, quand le mettre à jour, combien de temps le garder » | `guides.md` § 1 |
| T41 Micro-entreprise | Guide « Livre des recettes : mentions, registre des achats, conservation » | `guides.md` § 5 |
| T42 Trésorerie | Guide « Faire son plan de trésorerie sur 12 mois » | `guides.md` § 7 |
| T01 Révision | Fiche imprimable des intervalles J+1, J+3, J+7, J+14, J+30 avec la révision finale 2 jours avant l'examen | méthode affichée sur `catalogue/revision/` ; Reel IG-41 |
| T95 Investissement locatif | Fiche « rendement brut, rendement net, cash-flow » (définitions et hypothèses affichées) | page `catalogue/investissement-locatif/` |

Priorité : le calculateur 50/50 (relié à un des 5 prioritaires, déjà décidé), puis la fiche des délais
du sinistre et le guide des impayés (requêtes Google à forte intention, Google étant la 2e source du site).

## 5. Limites de l'exercice

- **Tout est jugé, rien n'est mesuré** : 0 vente, 38 vues Gumroad en 6 semaines, pages catalogue hors des
  15 pages les plus vues sur GoatCounter. Aucune note ne vient d'un taux de conversion, d'une vue de Reel ou
  d'un clic.
- **Taille du public** : qualitative (foyers > étudiants > micro-entrepreneurs > managers > professions du
  BTP), sans chiffre.
- **Concurrence gratuite** : jugée d'après la nature du produit et les mentions du dépôt (« un tableau vide
  se trouve gratuitement », `IDEES.md`), sans recherche systématique des alternatives ; les notes marquées
  « jugement » sont les plus incertaines (DUERP, sinistre, visa, réserves, coût de revient).
- **Démonstration** : notée d'après les fonctions décrites sur les pages catalogue et les Reels déjà
  produits ; les démos `?demo` n'ont pas été ouvertes dans un navigateur ni chronométrées.
- **Ventes complémentaires** : potentielles, car aucun pack n'a de fiche Gumroad dans `packs.mjs` ; le
  nombre de packs et de voisins en vente ne dit rien de l'achat groupé réel.
- **Pondération** : fixée par la demande ; IG/TT, LinkedIn et la communication existante sont hors total et
  servent seulement à départager. Un poids différent changerait l'ordre du milieu du tableau (écarts de
  0,05 entre plusieurs rangs), pas celui du haut (T05, T65, T14 devant à au moins 0,25 du 4e).
- **Saisonnalité** non pondérée : révision (partiels), roue de vie et habitudes (1er janvier), mariage
  (janvier-février), micro-entreprise (avril-mai) gagnent à être poussés à leur date.
- À refaire après 6 semaines de publications, avec les vues, enregistrements, clics UTM et ventes par code.
