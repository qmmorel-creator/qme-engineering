# Opportunité anglophone · qualification (15/11/2026)

Exécution de `PROMPT-OPPORTUNITE-ANGLOPHONE.md`. Document interne (non publié).

## 1. Verdict

**No-go sur une traduction du catalogue. Go sur deux tests séparés, peu coûteux, qui ne traduisent rien
tant qu'aucune demande n'est mesurée.**

- **Aucune demande n'est encore mesurée** : 0 vente et 30 vues sur Gumroad (mesuré).
  - Ces chiffres traduisent surtout une **absence de diffusion**, pas une absence de demande : le
    catalogue n'est en ligne que depuis le 12/11/2026.
  - Ils ne permettent donc pas de conclure, ni en français ni en anglais.
- **Hypothèse A, des applications pour des inconnus anglophones** : à tester par des fiches EN en
  précommande, avec une démo vidéo, avant toute traduction.
- **Hypothèse B, du sur mesure pour le public Coda / Superhuman Docs** : c'est le volet qui exploite
  réellement l'expertise passée. Le passage de Coda à Superhuman Docs (07/2026) peut créer des besoins de
  migration (hypothèse). Action la moins chère : candidater à l'annuaire de partenaires Superhuman.
- **`qm-engineering.cloud`** : le faire rediriger vers `/en/`.

## 2. Faits mesurés et hypothèses

**Mesuré (dépôt, Gumroad, Superhuman Docs, 15/11/2026)**

- Gumroad :
  - 28 produits publiés, tous en EUR, de 12 à 45 € ;
  - 0 vente du 16/11/2024 au 15/11/2026 ;
  - 30 vues en 12 mois, toutes sans référent (« direct ») ;
  - aucune donnée par pays, faute de vente.
- Le site anglais existe :
  - 6 pages : accueil, custom, templates, references, method, contact ;
  - `hreflang` en place ;
  - plaquette, références et vidéos en anglais ;
  - la page `en/templates/` annonce « in French only » et renvoie vers des fiches Gumroad en français.
- Les 96 applications sont toutes en français :
  - aucun code partagé ;
  - textes écrits en dur : de 250 à 520 chaînes de texte relevées par application (revision 368, habitudes
    257, crm 429, budget 408, gantt 524) ; ce comptage approximatif inclut des chaînes qui ne sont pas de
    l'interface ;
  - une partie du contenu intégré est française par nature : programmes scolaires, jours fériés, mentions
    légales.
- `qm-engineering.cloud` redirige en 301 vers `qm-engineering.fr` (`netlify.toml`).
- Superhuman Docs contient un template anglais « Template Gantt + Dependencies » de l'époque Coda. C'est
  le seul antécédent de produit anglophone trouvé. Les autres docs du compte sont des docs clients :
  confidentiels, non exploités ici.

**Vérifié sur sources externes** (détail et liens en § 11)

- Coda est devenu Superhuman Docs (08/07/2026). « Hire an Expert » redirige vers l'annuaire
  superhuman.com/find-a-partner, qui ne mentionne ni Docs ni Coda. Forum : 307 utilisateurs actifs et
  705 messages sur 30 jours ; la catégorie Gigs compte 4 sujets en 2026.
- La galerie Superhuman Docs ne vend aucun template payant (seuls les Packs ont un prix).
- Gumroad est *merchant of record* depuis le 01/01/2025 : il gère les taxes là où il en a l'obligation.
  Frais : 10 % + 0,50 $ par vente, 30 % pour une vente issue de Discover.
- X, étude Buffer (02/10/2025) : un compte sans Premium touche moins de 100 impressions par post, contre
  environ 600 avec Premium ; l'engagement médian des comptes non Premium est à 0 % depuis mars 2025.
- Google traite les nouvelles extensions (.cloud) comme .com. Le `hreflang` entre domaines différents est
  autorisé. Google n'exprime aucune préférence entre domaine séparé et sous-répertoire.

**Hypothèses (non vérifiées)**

- Le public anglophone est plus enclin à adopter ce type d'outils : c'est l'avis de Quentin, je n'ai
  trouvé aucune donnée qui le confirme ou l'infirme.
- Une application autonome se différencie d'un template Notion : avantage possible (pas de compte Notion,
  installation sur téléphone) ou frein (marque inconnue, données hébergées par un indépendant). Ce n'est
  pas testé.
- L'état actuel du compte X `@qmplayswithcoda` (abonnés, engagement) n'a pas pu être mesuré : x.com bloque
  la lecture automatique.

## 3. Tri des 28 templates en vente

Groupes :

- **U** (universel) : traduction seule.
- **A** (adaptable) : logique ou base intégrée à revoir.
- **F** (franco-français) : non transposable.

| Template | Groupe | Justification | Priorité EN |
|---|---|---|---|
| Planning Gantt rapide | A | Jours fériés FR à remplacer par un choix de pays | 1 (antécédent Coda EN) |
| CRM freelance | U | Pipeline et relances : aucune règle locale | 1 |
| Suivi d'habitudes et routines | U | Aucune règle locale | 1 |
| Gestionnaire de tâches | U | Aucune règle locale | 2 |
| Compte rendu et plan d'actions | U | Aucune règle locale | 2 |
| Tableau annuel et roue de vie | U | Aucune règle locale | 2 |
| Suivi des abonnements | U | Devise à paramétrer | 2 |
| Planning d'équipe et staffing | U | Jours fériés et congés à généraliser | 2 |
| Registre des non-conformités | U | Vocabulaire qualité international | 3 |
| Budget commun | A | Devise | 3 |
| Budget du foyer | A | Devise, catégories | 3 |
| Organisateur de mariage | A | Usages et postes de dépense différents | 3 |
| Nutrition et dépense énergétique | A | Unités impériales, base d'aliments | 3 |
| Planning de révision | A | Base de 12 programmes FR à reconstruire | 3 |
| Coût de revient et prix par client | A | Charges sociales FR | 3 |
| Trésorerie prévisionnelle 12 mois | A | TVA, échéances fiscales | 3 |
| Générateur de devis | A | Mentions légales par pays | 3 |
| Pilote de travaux maison | A | Corps de métier, assurances | 3 |
| Inscriptions associatives | A | Statut associatif FR | 3 |
| Circuit de visa des documents | A | Pratique BTP FR | 3 |
| Calculateur de TJM freelance | A/F | Cotisations FR au cœur du calcul | — |
| Levée de réserves | F | Réception des travaux en droit FR | — |
| Rentabilité investissement locatif | F | Fiscalité FR | — |
| État des lieux | F | Loi de 1989 | — |
| Relance des impayés | F | Procédure FR | — |
| Document unique (DUERP) | F | Obligation légale FR | — |
| Dossier sinistre habitation | F | Assurance FR | — |
| Livre recettes-dépenses micro | F | Régime micro FR | — |

Bilan : 8 universels, 12 adaptables, 8 non transposables.

## 4. Concurrence et prix anglophones

Prix relevés en 11/2026 sur Gumroad, Etsy et Payhip. Les prix changent souvent : soldes, prix libres.

| Catégorie | Fourchette typique | Format dominant | QME (actuel) |
|---|---|---|---|
| Habit tracker | 3–25 $ | Notion, app iOS (Streaks ~5 $) | 12 € |
| Gantt / planificateur de projet | 6–25 $ (packs jusqu'à 50 $) | Sheets, Excel | 45 € |
| CRM freelance | 5–45 $ (OS complets 79–150 $) | Notion | 25 € |
| Planning de révision | 10–30 $ | Notion | 14,90 € |
| Budget perso | 3–15 $ | Sheets | 15 € |
| Planificateur de repas | 5–20 $ | Notion | — |
| Carnet muscu | 7–25 $ (app Strong 99,99 $ à vie) | Sheets, app | — |
| Factures / devis | 5–35 $ | Notion | 29 € |
| Mariage | 9–25 $ | Sheets | 29 € |

**Ce qui en ressort**

- L'offre anglophone est saturée de templates Notion et Sheets bon marché. La recherche n'a trouvé
  presque aucune application autonome vendue à l'unité. Cela peut être un espace libre ou l'absence de
  demande : on ne peut pas trancher sans test.
- Le Gantt QME, à 45 €, est au-dessus de la fourchette anglophone (6–25 $). Le mariage et les devis sont
  en haut de fourchette.
- Avec 30 % de commission sur Discover, une vente à 15 $ rapporte environ 10 $ net.

## 5. Canaux

| Canal | Effort récurrent (estimé) | Délai plausible | Réutilisable depuis le FR | Risque |
|---|---|---|---|---|
| X (compte existant) | 3–5 h/sem. | Plusieurs mois | Vidéos EN, visuels | Portée < 100 impressions/post sans Premium (Buffer) ; audience 2022-23 orientée Coda |
| Forum Superhuman (connect.superhuman.com) | 1–2 h/sem. | Semaines | Expertise Coda | Petit (≈ 300 actifs/mois) ; public qui veut des docs, pas des applications |
| Reddit (r/SideProject ; r/Notion interdit l'autopromotion) | 1–2 h/sem. | Ponctuel | `reddit.md` | Modération, ton anti-promo |
| Product Hunt | 1 lancement (≈ 1–2 j) | Pic unique | Vidéo EN, plaquette | Mise en avant éditoriale, non garantie |
| Gumroad Discover | Nul | Inconnu | Fiches | 30 % de commission ; trafic actuel nul |
| LinkedIn anglophone | 1–2 h/sem. | Mois | Calendrier FR | Cannibalise le temps du canal FR |

Les durées et les délais sont des estimations de travail, pas des mesures.

## 6. Personas (hypothèses à valider)

1. **Freelance anglophone non technique** : ne veut pas monter un système dans Notion et cherche un outil
   prêt à l'emploi, par exemple un CRM ou un Gantt. Sensible au prix (marché à 5–45 $).
2. **Petite équipe ou PME anglophone ayant besoin d'un outil sur mesure** : la cible que visait
   l'activité d'expert Coda. Elle passe aujourd'hui par l'annuaire Superhuman, où Quentin ne figure pas.
3. **Ancien utilisateur Coda ou Superhuman Docs** qui connaît Quentin : plutôt acheteur de docs et de
   conseil que d'applications autonomes.

## 7. Effort chiffré (estimations, fourchette basse / haute)

| Poste | Basse | Haute | Remarque |
|---|---|---|---|
| Mécanisme de langue sur une application (modèle : `revision`) | 1 j | 2 j | Peu mutualisable : aucun code partagé entre les applications |
| Par template **U** : extraction et traduction des textes, relecture, captures et démo EN, fiche Gumroad USD, page `en/catalogue/`, tests | 1 j | 1,5 j | La traduction par IA réduit la saisie, pas la relecture ni les tests |
| Par template **A** : idem, plus refonte de la base ou des règles (jours fériés par pays, devise, unités) | 1 j | 3 j | La révision demande de reconstruire ses programmes |
| Test A en précommande : 3 fiches Gumroad EN (USD), vidéo de démo EN, page EN, sans traduire l'application | 1,5 j | 3 j | Ne traduire qu'après des précommandes |
| Traduction réelle d'un template U pour un test (copie EN de l'application, sans socle commun) | 1 j | 1,5 j | 400 à 520 chaînes, plus captures et démo : 0,5 j est irréaliste |
| Test B : candidature à l'annuaire Superhuman, offre EN sur `en/custom/`, Gantt EN de l'époque Coda en vitrine | 0,5 j | 1 j | |
| 8 U + 12 A (seulement si les tests valident) | 20 j | 48 j | Hors communication |
| Récurrent : chaque correctif fait en double, support en anglais | +20 à 40 % du temps de maintenance | — | Hypothèse |
| Sur mesure EN : appel découverte EN, modèle de devis EN, facturation hors UE | 1 j | 2 j | TVA (autoliquidation intra-UE, export hors UE) : **à faire confirmer par un expert-comptable** |
| Redirection `.cloud` → `/en/` | < 1 h | — | Une règle `netlify.toml` |

## 8. Domaine `qm-engineering.cloud`

Recommandation : garder l'anglais en sous-répertoire `/en/` sur `qm-engineering.fr` (option a), et
**faire rediriger `qm-engineering.cloud` vers `https://qm-engineering.fr/en/`** au lieu de l'accueil
français. Le `.cloud` sert ainsi d'adresse courte à afficher dans la bio X et les publications
anglophones.

Pourquoi pas un site anglais complet sur `.cloud` (option b) :

- aucun avantage de référencement selon Google ;
- l'autorité est divisée entre deux domaines ;
- les nouvelles extensions inspirent moins confiance : 49 % contre 90 % pour .com/.org (Nielsen/ICANN,
  2015, données anciennes et non spécifiques au .cloud) ;
- deux sites Netlify, deux déploiements, double maintenance.

Condition pour revoir ce choix : un volume de ventes anglophones justifiant une marque distincte.

## 9. Tests minimaux avant tout investissement

Deux hypothèses distinctes, chacune avec ses seuils, fixés à l'avance. Durée : 6 semaines, du 17/11/2026
au 28/12/2026. Les fêtes tombent dans la fenêtre : en tenir compte en lisant les résultats, ou décaler le
test d'un mois.

### Test A : des applications pour des inconnus anglophones (sans traduction préalable)

1. Faire rediriger `.cloud` vers `/en/`.
2. Créer 3 fiches Gumroad EN en USD : Gantt, CRM freelance, Suivi d'habitudes.
   - Contenu : vidéo de démo EN et texte EN.
   - Vente en **précommande**, avec livraison de la version anglaise sous 3 semaines.
   - Prix dans les fourchettes du § 4 : Gantt 24 $, CRM 24 $, habitudes 9 $. Le prix n'est pas une
     variable du test.
3. Apporter un **trafic minimum** : seules les publications sur X ne suffisent pas (< 100 impressions par
   post sans Premium, soit 15 à 30 visiteurs en 6 semaines).
   - Un lancement Product Hunt.
   - Un post r/SideProject.
   - 100 à 200 € de publicité, ou X Premium pendant le test.
   - Le budget est à arbitrer par Quentin.
4. Seuils :

| Décision | Condition |
|---|---|
| Test non concluant | Moins de 500 visites cumulées sur les fiches EN : le jugement ne vaut rien, prolonger ou ajouter du trafic |
| Traduire les 3 applications | Au moins 500 visites **et** au moins 3 précommandes (≈ 0,6 % de conversion) |
| Arrêter l'hypothèse A | Au moins 500 visites **et** 0 précommande : rembourser si besoin, retirer les fiches |

### Test B : du sur mesure pour le public Coda / Superhuman Docs

1. Candidater à l'annuaire de partenaires Superhuman (superhuman.com/find-a-partner).
2. Mettre en avant sur `en/custom/` une offre « sur mesure Superhuman Docs ou application », avec le
   template Gantt EN de l'époque Coda en vitrine.
3. Participer au forum connect.superhuman.com : réponses utiles 1 à 2 h par semaine, sans promotion.
4. Informer le réseau X existant par 1 publication par semaine.
5. Seuils :

| Décision | Condition |
|---|---|
| Continuer et structurer l'offre EN | Au moins 1 demande qualifiée (besoin et budget précisés) ou inscription acceptée à l'annuaire |
| Arrêter l'hypothèse B | Aucune demande et candidature refusée ou restée sans réponse |

Le résultat du test B ne dit rien sur la traduction des templates, et inversement.

### Ce qui ne change pas

Le catalogue FR reste prioritaire en temps de travail : les deux tests sont plafonnés à environ 4 jours
au total.

## Contre-expertise intégrée (agent devils-advocate, 15/11/2026)

Les 6 objections ont été retenues :

1. **Test voué à l'échec faute de trafic** : seuil de 500 visites et canaux payants ou de lancement
   ajoutés.
2. **Prérequis FR mal posé** : il mesurait l'effort de promotion et non la demande, et la fenêtre couvrait
   les fêtes. Les marchés FR et EN sont désormais découplés.
   - Seule réserve maintenue : le risque de dispersion (§ 10), d'où le plafond de 4 jours.
3. **Annuaire Superhuman oublié** : ajouté au test B.
4. **Décalage produit / audience ignoré** : séparé en deux hypothèses avec des seuils distincts.
5. **Prix du Gantt hors fourchette** : 29 $ ramené à 24 $.
6. **Effort sous-estimé et socle prématuré** : 1 à 1,5 j par template, pas de socle avant validation.

## 10. Risques

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Dispersion : le chantier EN retarde l'acquisition FR, encore à 0 | Élevée | Élevé | Tests plafonnés à environ 4 j au total (§ 9) |
| Double maintenance de 96 applications | Élevée si extension | Élevé | Limiter l'anglais aux templates U ayant vendu |
| Support client en anglais | Moyenne | Moyen | FAQ EN ; délai de réponse annoncé |
| Dépendance à X (portée, règles changeantes) | Élevée | Moyen | Pas de canal unique ; fiches Gumroad et site comme socle |
| Fiscalité du sur mesure hors UE | Faible | Moyen | Avis d'un expert-comptable avant la première facture |
| Image : site EN qui vend des applications FR | Déjà présent | Faible | Déjà signalé « in French only » ; garder la mention |
| Ancien handle X perdu en cas de changement | Moyenne | Faible | Voir encadré ci-dessous |

## Annexe · Changer le @ d'un compte X

- **Oui, possible** : Paramètres et confidentialité > Compte > Informations du compte > Nom d'utilisateur.
  Le compte, ses abonnés et ses publications sont conservés.
- Format : 4 à 15 caractères, lettres, chiffres et underscore.
- L'ancien handle est **libéré immédiatement** et peut être pris par quelqu'un d'autre. X conseille de
  prévenir ses abonnés avant.
- Avec la coche bleue Premium, la coche est retirée le temps d'une revue (environ 4 jours au plus selon la
  FAQ Premium).
- Aucune règle officielle trouvée sur une redirection des anciens liens ou des anciennes mentions :
  considérer qu'ils ne suivent pas.
- Sources indirectes (help.x.com bloque la lecture automatique) : à vérifier dans l'application.
- Pour QME : `@qmplayswithcoda` rattache le compte à un produit qui a changé de nom. Le passer à un nom
  QME garde l'historique et les abonnés ; garder l'ancien nom sur un second compte vide évite qu'il soit
  repris par un tiers.

## 11. Ce que Quentin doit fournir ou relever

1. Statistiques X sur 90 jours : abonnés, impressions, profil des abonnés.
2. Accès au forum connect.superhuman.com : le compte existe-t-il encore, avec quelle réputation ?
3. Temps disponible par semaine pour l'anglais.
4. Acceptez-vous d'assurer le support client en anglais ?
5. Acceptez-vous de payer X Premium pendant le test ?
6. Demandes entrantes reçues en anglais depuis 2023, s'il y en a.

## Sources (consultées en 11/2026)

- Données internes : Gumroad API (ventes et analytique, 15/11/2026), dépôt `qme-engineering`,
  Superhuman Docs (recherche, 15/11/2026).
- Superhuman Docs : https://blog.superhuman.com/superhuman-launches-superhuman-docs/ (08/07/2026) ;
  https://coda.io/gallery ; https://superhuman.com/find-a-partner ; https://connect.superhuman.com/about ;
  https://connect.superhuman.com/c/marketplace/requests-gigs/40
- Gumroad : https://gumroad.com/taxes ; https://gumroad.com/pricing ;
  https://gumroad.com/help/article/79-gumroad-discover
- X : https://help.x.com/en/managing-your-account/change-x-handle ;
  https://help.x.com/en/managing-your-account/help-with-common-username-issues ;
  https://help.twitter.com/en/forms/x-premium ; https://buffer.com/resources/x-premium-review/ (02/10/2025)
- Domaines : https://developers.google.com/search/blog/2015/07/googles-handling-of-new-top-level ;
  https://developers.google.com/search/docs/specialty/international/localized-versions ;
  https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites ;
  https://www.icann.org/en/announcements/details/icann-commissioned-study-finds-increased-awareness-and-trust-in-domain-name-system-23-6-2016-en
- Prix : annonces Gumroad, Etsy et Payhip relevées par la recherche, dont
  https://planifynotion.gumroad.com/l/notion-habit-tracker-template,
  https://notionfordesigners.gumroad.com/l/designers-crm,
  https://sealinemedia.gumroad.com/l/studentacadashboardos,
  https://hitanotion.gumroad.com/l/all-in-one-meal-planner-notion-template,
  https://www.etsy.com/listing/4592590117, https://www.sensai.fit/blog/strong-app-review-2026

**Non vérifié** :

- l'état du compte X ;
- les règles de r/productivity ;
- les seuils de Gumroad Discover ;
- la collecte de la TVA britannique par Gumroad ;
- l'existence d'applications autonomes concurrentes (recherche non exhaustive) ;
- toutes les durées du § 7.
