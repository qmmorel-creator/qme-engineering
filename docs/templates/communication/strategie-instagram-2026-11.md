# Stratégie de croissance et de conversion · Instagram et LinkedIn

Rédigée le 20/11/2026 pour Quentin. Non publiée (`/docs/*` en 404). Période couverte par le calendrier : du lundi 23/11
au mardi 22/12/2026. TikTok volontairement exclu (demande de Quentin).

Convention : **[F]** fait vérifié (source citée), **[H]** hypothèse à tester, **[R]** recommandation.

---

## 1. Diagnostic stratégique

### 1.1 Faits vérifiés

| Domaine | Fait | Source |
|---|---|---|
| Audience | 53 abonnés, 17 publications Instagram publiées | audit Metricool fourni, onglet Planning (17 lignes « Publié ») |
| Trafic Instagram → site | **15 visites en 30 jours**, toutes vers `/templates` (9 `utm_source=ig`, 6 référent Instagram) | GoatCounter, 21/10 → 20/11 |
| Site (toutes sources) | 301 vues de l'accueil, 82 `/templates`, 23 `/sur-mesure`, 8 `/essai`, **4 `/contact`** ; ≈ 25 ouvertures de démo, **3 clics « Acheter »**, 1 essai créé | GoatCounter, mêmes dates |
| Gumroad | ≈ 270 vues de fiches produit en 30 jours (232 « direct ») ; **1 vente payante depuis le 01/09** (Gestionnaire de tâches, 20,82 $) et 1 téléchargement gratuit | API Gumroad |
| Catalogue | **69 templates et 8 packs en vente** | `node docs/videos/catalogue.mjs` |
| Production programmée | **136 publications Instagram « Programmé »** jusqu'au 26/03/2027 ; 39 entre le 21/11 et le 20/12 (23 Reels, 16 carrousels), dont 25 « Template QME » et 2 « Sur mesure » | onglet Planning |
| Attribution | Les liens « Acheter » du site vers Gumroad ne portent **aucun paramètre UTM** : aucune vente ne peut être attribuée à Instagram | `catalogue/*/index.html` |
| Accroches des Reels | Sur les 20 Reels motion design programmés jusqu'à fin décembre, **la moitié n'affiche pas d'accroche lisible à 0,5 s** (IG-56 et IG-57 vides, IG-44, IG-46, IG-49, IG-53 incomplets) | rendu des 3 premières secondes, `instagram/tests-accroches/README.md` |
| Seul contenu hors norme | Reel « Un tableur trouvé en ligne dépanne… jusqu'au jour où une formule casse » (13/11, 15 s, fond noir) : **697 vues organiques** au 16/11, 1 024 après une publicité le 19/11 ; 7 j'aime, 0 enregistrement, 1 abonné | remarque IG-42 du planning, statistiques Instagram |
| Incohérence des sources | Metricool attribue 41 vues à « Dix outils du quotidien » ; Instagram en affiche 697 (organiques) puis 1 024 pour le Reel dont la légende commence ainsi. Probablement le même contenu : **Metricool n'est pas fiable seul** pour piloter | audit fourni, capture Instagram du 20/11 |
| Incohérences commerciales | Suivi des abonnements : 9 € sur le site, « passé à 12 € » selon le planning ; IG-52 annonce « L'outil arrive bientôt » alors que le Planner horaire est en vente (15 €) | `catalogue/abonnements/`, planning, Gumroad |
| Plateformes | Les signaux de classement Instagram les plus cités sont la durée de visionnage, les « j'aime » rapportés à la portée et les **envois (partages en message)** rapportés à la portée, ces derniers liés à la portée hors abonnés. Les Reels d'essai (diffusés d'abord à des non-abonnés) ne sont ouverts qu'aux comptes d'au moins 1 000 abonnés. Sources secondaires (Buffer, Later, SocialPilot), pas de document officiel trouvé | recherche web du 20/11 |

### 1.2 Lecture

1. **Le problème n° 1 n'est pas la conversion, c'est le volume de personnes qualifiées.** 15 visites en un mois depuis
   Instagram ne peuvent pas produire de ventes, quel que soit le taux. Mais le taux est aussi trop bas pour être ignoré :
   25 démos ouvertes pour 3 clics d'achat (toutes sources).
2. **L'offre est trop large pour l'audience.** 69 produits pour 53 abonnés : chaque publication parle à une niche
   différente (BTP, étudiants, couples, freelances, sportifs). Aucun abonné ne voit deux fois de suite un contenu qui le
   concerne, et l'algorithme ne peut pas identifier à qui montrer le compte.
3. **La cadence est élevée, la qualité d'accroche faible.** Environ 1,3 publication par jour est programmée, alors que
   la moitié des Reels perd l'œil dans la première seconde. Les publications partent sans avoir été optimisées.
4. **Le seul signal positif** (697 vues organiques) a trois traits : un problème que tout le monde reconnaît, une
   histoire avec une rupture (« dépanne… jusqu'au jour où »), et aucun produit dans la première phrase. [H] C'est la
   piste la plus solide, mais elle repose sur un seul cas.
5. **Le sur-mesure ne passe pas par Instagram.** 4 vues de `/contact` en 30 jours. Les pages `/concepts/*` (maquettes
   préparées pour des prospects) ont fait plus de 100 vues : elles viennent de la prospection directe, pas des réseaux.
6. **Les preuves existent mais sont peu exploitées** : des références réelles sur `/references/` (Thalvego,
   BikePulse Gear, Bricabulle, Nexora, NutriQuest, WOD Motion…), un essai gratuit de 14 jours sans carte (templates vie
   personnelle), des démos libres sans inscription, et des calculs propres au droit français (jours fériés, barème
   kilométrique, seuils de la micro-entreprise).

---

## 2. Positionnement et promesse

### 2.1 Un compte ou deux ?

**[R] Un seul compte Instagram, une seule promesse, deux portes de sortie ; la répartition entre piliers change selon
le réseau.**

- Séparer en deux comptes diviserait par deux une audience de 53 personnes, et doublerait la production.
- Les décideurs qui achètent du sur-mesure sont rares sur Instagram et nombreux sur LinkedIn. Les acheteurs de templates
  à 12–45 € (particuliers, indépendants) sont sur les deux.
- Répartition : **Instagram 80 % templates / 20 % sur-mesure ; LinkedIn 40 % templates / 60 % sur-mesure.**
- Le lien entre les deux : le sur-mesure est présenté comme « la même chose, mais avec vos règles ». Sur Instagram, il
  apparaît dans les coulisses (« comment je construis ») et dans une publication sur cinq, sans vente directe.

### 2.2 Promesse centrale

> **Des outils qui font les calculs justes à votre place.**
> Construits par un ingénieur : prêts à l'emploi, ou sur mesure pour votre métier.

Pourquoi celle-ci :
- elle est **démontrable à l'écran** : un total qui se recalcule, un barème appliqué, une date recalée ;
- elle oppose QME au tableur trouvé en ligne, ce qui reprend le seul contenu qui a fonctionné ;
- elle couvre les deux offres sans les mélanger.

### 2.3 Audiences prioritaires (30 jours)

| Rang | Audience | Douleur démontrable | Produits héros | Réseau |
|---|---|---|---|---|
| 1 | Couples et colocataires | « qui doit combien à qui », cadeaux de Noël | Gestion Dépenses Communes, Secret Santa (gratuit) | Instagram |
| 2 | Indépendants et micro-entrepreneurs | indemnités kilométriques, TJM, jours facturables | Notes de frais et IK, Calculateur de TJM | Instagram + LinkedIn |
| 3 | Particuliers qui veulent reprendre la main sur leurs dépenses | abonnements oubliés, fin d'année | Suivi des abonnements | Instagram |
| 4 | Toute personne débordée | liste de tâches qui déborde | Gestionnaire de tâches (seule vente payante constatée) | Instagram |
| 5 | Chefs de projet, PME, artisans | planning qui se décale, outil métier sur mesure | Planning Gantt, sur-mesure | LinkedIn d'abord |

**Produits héros des 30 jours : 6** (Secret Santa, Gestion Dépenses Communes, Notes de frais et IK, Suivi des abonnements,
Gestionnaire de tâches, Planning Gantt). Ils ont été choisis parce que :
- la douleur est large ;
- un moment visuel se montre en moins de 5 secondes ;
- un contenu existe déjà (démos ou Reels rendus), donc la production coûte peu ;
- la saison s'y prête (Noël, fin d'année fiscale).

Les 63 autres produits restent en vente mais ne sont pas mis en avant sur Instagram ce mois-ci.

---

## 3. Architecture du compte Instagram

| Élément | Actuel | Recommandé |
|---|---|---|
| Nom affiché (cherchable) | QME · Templates et sur mesure | **QME · Outils budget, planning, freelance** (mots que les gens cherchent ; « templates » est peu cherché en français) |
| Bio | Templates prêts à l'emploi : travail, indépendants, maison. Et des outils sur mesure pour votre métier. Démos libres, achat unique ↓ | voir ci-dessous |
| Photo | symbole Bauhaus | [H] à tester au mois 2 : photo de Quentin avec le symbole en pastille (la confiance passe par une personne) ; garder le symbole tant que Quentin ne souhaite pas apparaître |
| Liens | 4 liens (templates, sur-mesure, contact, Gumroad) | **2 liens** : 1. `qm-engineering.fr/ig` (page des héros du mois, avec UTM) ; 2. `qm-engineering.fr/sur-mesure/?utm_source=instagram&utm_medium=bio&utm_campaign=sur-mesure`. Retirer le lien Gumroad direct : il ne mesure rien et saute la démo |
| Publications épinglées | — | 1. Reel « tableur trouvé en ligne » (697 vues) ; 2. carrousel « Comment ça marche : démo, essai 14 jours, achat unique » ; 3. un cas sur mesure réel (atelier vélo, IG-29) |
| Stories à la une | couvertures prêtes, aucune story (Instinct ne peut pas publier de story) | 4 rubriques alimentées par Quentin depuis son téléphone : **Essayer** (démo, essai, clé), **Achat unique** (FAQ), **Cas réels**, **Sur mesure** |

**Bio proposée (139 caractères) :**

```
Ingénieur. Je transforme les tableurs fragiles en outils fiables.
Templates prêts à l'emploi · essai 14 j · achat unique
Sur mesure ↓
```

**Page `/ig` à créer** : une seule page mobile avec les 6 héros du mois (démo, essai ou achat), un bloc « Votre métier a
ses règles ? » vers le sur-mesure, et la conservation des paramètres UTM jusqu'à Gumroad (voir § 5.3). Elle remplace
l'atterrissage actuel sur un catalogue de 69 produits.

---

## 4. Stratégie de croissance organique

### 4.1 Formats

| Format | Rôle | Cadence | Règle |
|---|---|---|---|
| Reel 15–30 s | toucher des non-abonnés | **3 par semaine** (lun., mer., ven.) | première phrase de l'accroche entière **dès la première image** ; problème avant produit ; une seule idée ; résultat chiffré visible avant 10 s |
| Carrousel 5–7 vues | enregistrements, envois, conversion des abonnés | **2 par semaine** (après le 07/12 ; avant, les 12 carrousels du test des fonds) | vue 1 = accroche seule ; dernière vue = élément à garder (liste, règle, calcul) puis action |
| Stories | relation, clic (seul format avec lien cliquable) | **3 par semaine**, publiées par Quentin (5 min chacune) | sondage ou question, puis autocollant lien avec UTM |
| Collaboration (publication co-signée) | portée hors abonnés via un autre compte | 1 par mois à partir du mois 2 | avec un créateur affilié (skill `retour-affiliation`) |

### 4.2 Mécaniques adaptées à une activité technique

1. **Écrire pour l'envoi** (le signal le plus lié à la portée hors abonnés) : chaque Reel vise une personne précise à
   qui on l'enverra. Exemples : « à votre coloc », « à votre associé », « à votre groupe du Secret Santa », « à un
   ami indépendant qui fait beaucoup de kilomètres ».
2. **Une erreur chiffrée et vérifiable**, pas une promesse : « 0,636 € le km toute l'année ? Au-delà de 5 000 km, le
   barème change » (barème fiscal, calcul de la démo IG-155).
3. **Un récit avec une rupture** (« … jusqu'au jour où … »), le seul format qui ait fonctionné. [H] À valider par le
   test d'accroches en pause (`instagram/tests-accroches/`).
4. **Un résultat avant l'outil** : le chiffre final apparaît avant le nom du template.
5. **La saison** : Secret Santa (les tirages se font fin novembre et début décembre), les cadeaux à deux, le bilan
   kilométrique de fin d'année, les jours ouvrés 2027 pour fixer son TJM.

### 4.3 Angles à abandonner sur Instagram

- Les Reels « catalogue » (« Pack X en 4 outils », plusieurs produits par publication). Exemple programmé : IG-133.
- Les annonces sans produit achetable (« L'outil arrive bientôt » : IG-52, faux depuis la mise en vente).
- La méthode générique sans démonstration (changement d'heure, 0,1 + 0,2, vagues de commande…) → LinkedIn ou rien.
- Les niches BTP (visa, OPR, DOE, non-conformités) → LinkedIn, où se trouvent les conducteurs de travaux.
- Les vœux et messages de marque (« Joyeux Noël » : IG-51).
- Les comparatifs centrés sur QME (« Template ou sur mesure ? ») : ils intéressent le vendeur, pas le lecteur.

### 4.4 Toucher des personnes qui ne connaissent pas QME

1. **Commentaires utiles, 15 minutes par jour (Quentin, depuis son téléphone).**
   - Choisir 30 comptes français de 5 000 à 100 000 abonnés dans trois niches : argent du couple et budget ;
     freelance et micro-entreprise ; organisation personnelle.
   - Commenter dans l'heure qui suit leur publication avec un apport concret (un calcul, une règle, un piège), sans
     lien ni mention de QME.
   - Objectif : 5 commentaires de qualité par jour.
2. **Recherche Instagram** : légendes avec les mots que les gens tapent (« budget couple », « indemnités
   kilométriques », « liste de tâches », « Secret Santa en ligne »), écrits en phrases, sans liste de mots-clés.
3. **Collaborations** : proposer aux affiliés existants une publication co-signée à partir de leur démo personnalisée
   (`/demo/<prénom>`). C'est la seule façon d'apparaître devant une audience déjà constituée sans payer.
4. **Envois en message** : terminer les Reels « à envoyer » par une demande explicite et naturelle (« Envoyez-le à
   celui ou celle qui fait les comptes »).
5. **Reels d'essai** : indisponibles sous 1 000 abonnés ; à utiliser dès ce seuil atteint pour tester deux accroches.

---

## 5. Stratégie de conversion

### 5.1 Templates : parcours

```
Reel (problème + résultat chiffré)
  → profil (bio claire, épinglés)
  → /ig (6 héros, UTM conservé)
  → démo libre OU essai 14 jours sans carte (templates vie personnelle)
  → e-mails d'essai (J-3, fin) déjà en place
  → Gumroad (UTM transmis)
```

- **L'appel à l'action par défaut est « Essayez la démo » ou « Essai 14 jours », pas « Achetez »** : c'est une
  invitation, et l'essai reprend les données saisies à l'achat.
- **Rassurer en 3 phrases**, sur une vue de carrousel épinglée et dans la rubrique Achat unique :
  - « Un paiement, pas d'abonnement » ;
  - « Ordinateur, tablette, téléphone, même hors connexion » ;
  - « Démo libre, sans inscription » (vérifier pour chaque template ce que la démo stocke avant d'en dire plus).
  
  Toutes ces affirmations sont vérifiables dans le site et la FAQ.
- **Démonstration convaincante** = une seule action réelle et son effet chiffré, en moins de 10 s. Exemples :
  « 240 € de cadeaux, au prorata : 138,67 € / 101,33 € » ; « une date bouge, les tâches qui en dépendent se recalent ». Le moteur
  `docs/videos/moteur.mjs` le fait déjà ; c'est l'accroche et l'ordre qu'il faut changer.
- **Secret Santa (gratuit) comme aimant** : un téléchargement gratuit sur Gumroad donne une adresse e-mail. [H] À
  vérifier dans les réglages Gumroad : l'acheteur accepte-t-il de recevoir des nouvelles ? Si oui, c'est le premier
  fichier de contacts.

### 5.2 Sur-mesure : parcours

```
LinkedIn (cas réel, coulisses, avant / après d'un processus)
  → /sur-mesure ou /concepts/<métier>
  → contact (formulaire avec champ « source »)
  → échange de 30 minutes (déjà prévu dans l'offre)
```

- **Montrer l'expertise par des cas, pas par des affirmations.** Une seule règle métier, son coût quand elle est mal
  gérée, l'écran qui l'applique. Les cas disponibles :
  - la fiche d'arrivée de l'atelier vélo (IG-29) ;
  - les références de `/references/` ;
  - les concepts par métier (horlogerie, école de musique, hypermarché…), présentés comme concepts, jamais comme
    clients.
- **Attirer des entreprises** : les publications LinkedIn sur le sur-mesure finissent par une question qualifiante
  (« Quel calcul refaites-vous à la main chaque semaine ? ») et non par « contactez-moi ».
- **Qualifier les demandes** : ajouter au formulaire de contact trois champs (métier, outil actuel, nombre
  d'utilisateurs) et un champ caché rempli par l'UTM.

### 5.3 Mesure des conversions

1. **Convention UTM**, la même partout :
   - `utm_source` = `instagram` | `linkedin` ;
   - `utm_medium` = `bio` | `story` | `post` | `commentaire` ;
   - `utm_campaign` = `<produit>-<aaaammjj>`.
   
   GoatCounter les enregistre déjà comme campagnes (constaté : `ig`, `x`).
2. **Redirections courtes** dans `netlify.toml`, sur le modèle de `/x` existant :
   - `/ig` vers la page des héros ;
   - `/s/<produit>` pour les autocollants de story (ex. `/s/budget-commun` → catalogue avec UTM).
3. **Transmission à Gumroad** : `assets/site.js` conserve l'UTM d'arrivée (sessionStorage) et l'ajoute aux liens
   `qmengineering.gumroad.com`. L'API Gumroad renvoie les champs UTM de chaque vente (`list_sales`), donc on peut
   attribuer chaque vente.
4. **Clics déjà suivis** : événements GoatCounter `achat-*`, `demo-*`, `essai-*` (constatés). Ajouter
   `contact-envoye`.
5. **Relevé hebdomadaire** (vendredi, 15 min) dans `docs/templates/communication/pilotage-hebdo.md`, avec trois
   sources :
   - les statistiques natives Instagram (pas Metricool seul) ;
   - GoatCounter ;
   - Gumroad.

---

## 6. Calendrier éditorial · 23/11 → 22/12/2026


> **Mise en œuvre du 20/11/2026 (accord de Quentin).** Planning Instagram trié pour le 23/11 → 22/12 :
>
> - **Reels publiés à 12:30, et non à 19:00** : 19:00 reste aux carrousels du test des fonds, pour ne pas publier
>   deux contenus à la même minute. Les heures citées ci-dessous pour les Reels sont donc 12:30.
> - **Déplacés (statut inchangé, « Programmé »)** :
>   - IG-156 → 23/11 (L1) ;
>   - IG-155 → 27/11 (L5) ;
>   - IG-131 → 30/11 (L7) ;
>   - IG-56 → 02/12 (L10) ;
>   - IG-149, conservé le 04/12 (L11) ;
>   - IG-50 → 09/12 à 12:30 (L16) ;
>   - IG-46 → 14/12 (L20).
> - **Créés en « À produire »** : Instinct ne les publie pas et vous alerte sur WhatsApp le jour même s'ils ne sont
>   pas prêts. Ce sont IG-158 (L13), IG-159 (L14), IG-160 (L17), IG-161 (L18), IG-162 (L22),
>   IG-163 (L23), IG-164 (L25) et IG-165 (L26).
>   IG-157 (L4, Secret Santa) a été annulé le même jour : le Reel Secret Santa IG-36 est déjà publié (20/11). Le
>   créneau du mercredi 25/11 reste vide ; la story du 15/12 (L21) renvoie vers IG-36.
> - **Annulés** (contenus conservés, réutilisables) : IG-144, IG-154, IG-148, IG-142, IG-141, IG-147, IG-41,
>   IG-44, IG-45, IG-132, IG-53, IG-55, IG-57, IG-47, IG-49, IG-19, IG-20, IG-06, IG-11, IG-24.
>   Annulés pour de bon : IG-52 (contenu faux), IG-133 (Reel catalogue), IG-51 (vœux).
> - **Prix du Suivi des abonnements : 9 €** (confirmé par Quentin ; Gumroad, site et visuels concordent ; la
>   remarque « passé à 12 € » du planning a été corrigée).
> - **Non modifiés** : les plannings YouTube et LinkedIn. Les lignes YT et LI jumelles des Reels déplacés ou
>   annulés restent à leur date d'origine.
Règles communes :
- **Horaires** : Reels Instagram à 12:30 (voir la mise en œuvre ci-dessus ; aucune donnée ne permet d'identifier un
  meilleur horaire) ; LinkedIn à 10:00 (sur-mesure) ou 12:15 (template), comme aujourd'hui.
- **Carrousels Instagram** : jusqu'au 07/12, ce sont les 12 du test des fonds (déjà programmés, voir
  `instagram/tests-fonds/`). Ensuite, deux par semaine.
- **Origine** : « Existe » = vidéo ou démo déjà produite, à réhabiller (accroche, première image) ; « Nouveau » = à
  produire.
- **Objectif mesurable** : relevé à J+7 dans les statistiques natives.

### Semaine 1 · 23–29/11 · Secret Santa et partage à deux

**L1 · lun. 23/11 · Instagram · Reel 20 s · couples, colocs · Pilier 1 · Gestion Dépenses Communes (Existe : démo 012/020)**
- **Accroche (0 s)** : « On fait moitié-moitié… jusqu'au jour où l'un gagne deux fois plus que l'autre. »
- **Déroulé** :
  - 0–3 s : la phrase sur fond papier ;
  - 3–10 s : une dépense de 240 € saisie, bascule « parts égales » → « prorata des revenus » ;
  - 10–16 s : 120 / 120 devient 138,67 / 101,33 ;
  - 16–20 s : le solde « qui doit combien à qui ».
- **Message** : le partage juste se décide une fois, puis se calcule tout seul.
- **Action** : « Envoyez-le à la personne avec qui vous partagez les comptes. » Légende : démo libre, essai 14 jours,
  lien en bio.
- **Objectif** : 1 envoi pour 50 comptes touchés ; plus de 40 % de spectateurs encore là à 3 s.

**L2 · mar. 24/11 · Story × 3 (Quentin) · abonnés · Pilier 1**
- Story 1, sondage : « Chez vous : moitié-moitié ou au prorata ? »
- Story 2 : capture du résultat de la démo.
- Story 3 : autocollant lien `/s/budget-commun` (`utm_medium=story`, `utm_campaign=budget-commun-20261124`).
- **Objectif** : 3 clics sur le lien.

**L3 · mar. 24/11 · LinkedIn · texte + 1 image · indépendants, dirigeants · Pilier 2**
- **Accroche** : « Un client m'a dit : "Je vous avais laissé le chargeur." Le vélo est reparti sans. »
- **Déroulé** : le cas de l'atelier vélo (IG-29) raconté en 6 lignes, la règle métier, la fiche d'arrivée qui l'évite,
  ce qui vaut pour tout métier qui reçoit un objet confié.
- **Action** : « Quel litige revient chez vous tous les mois ? » (en commentaire).
- **Objectif** : 5 commentaires ; 1 visite de `/sur-mesure` avec `utm_source=linkedin`.

**L4 · mer. 25/11 · Instagram · Reel 18 s · groupes d'amis, collègues · Pilier 1 · Secret Santa (Existe : démo du template ; le Reel IG-36 publié le 20/11 sert de référence)**
- **Accroche** : « Le tirage du Secret Santa… jusqu'au jour où l'organisateur sait qui offre à qui. »
- **Déroulé** :
  - créer l'échange ;
  - partager le lien au groupe ;
  - le tirage se fait sur le serveur, l'organisateur ne voit rien ;
  - chacun découvre sa page et ses idées de cadeaux.
- **Message** : gratuit, et personne ne triche, pas même l'organisateur.
- **Action** : « Envoyez-le dans le groupe de votre Secret Santa. »
- **Objectif** : 3 envois ; 10 téléchargements gratuits sur Gumroad avec UTM `instagram`.

**L5 · ven. 27/11 · Instagram · Reel 20 s · indépendants qui roulent · Pilier 1 · Notes de frais et IK (Existe : IG-155)**
- **Accroche** : « 0,636 € le kilomètre… jusqu'à 5 000 km. Après, le barème change. »
- **Déroulé** :
  - une voiture de 5 CV, 10 002 km en 2026 (démo) ;
  - comptés au fil de l'eau : 6 361,27 € ;
  - au barème : 4 965,71 € ;
  - écart : 1 395,56 € ;
  - la régularisation calculée par l'outil.
- **Message** : le barème n'est pas linéaire ; votre outil doit le savoir.
- **Action** : « Envoyez-le à un indépendant qui fait beaucoup de route. » Mention « barème fiscal 2025, ne remplace pas
  un expert-comptable ».
- **Objectif** : 2 enregistrements, 2 envois.

**L6 · jeu. 26/11 · LinkedIn · vidéo native (même rendu que L5) · indépendants, gestionnaires de paie**
- **Accroche** : « 1 395,56 € d'indemnités kilométriques comptées en trop, sans aucune erreur de saisie. »
- **Déroulé** : texte court, la règle des tranches, l'effet en fin d'année, un lien vers la démo en premier commentaire.
- **Objectif** : 3 % d'interactions par impression.

### Semaine 2 · 30/11–06/12 · Fin d'année et dépenses oubliées

**L7 · lun. 30/11 · Instagram · Reel 20 s · particuliers · Pilier 1 · Suivi des abonnements (Existe : démo 006 ; prix à vérifier d'abord, voir P1)**
- **Accroche** : « 15 € par mois, ça ne fait peur à personne… jusqu'au jour où on multiplie par 12. »
- **Déroulé** :
  - liste d'abonnements de la démo ;
  - le total mensuel, puis annuel ;
  - une box partagée à 2 : seule la part compte, et le total baisse ;
  - l'alerte « à décider avant le … ».
- **Message** : le vrai coût est annuel, et la date limite de résiliation se calcule.
- **Action** : « Enregistrez-le pour faire le compte ce week-end. »
- **Objectif** : 3 enregistrements.

**L8 · mar. 01/12 · Story × 3 (Quentin)**
- Story 1, question : « Combien d'abonnements payez-vous ? » (curseur).
- Story 2 : réponse moyenne de l'échantillon.
- Story 3 : lien `/s/abonnements`.
- **Objectif** : 15 réponses au curseur.

**L9 · mar. 01/12 · LinkedIn · carrousel PDF 6 pages · dirigeants de TPE · Pilier 2**
- **Accroche page 1** : « Votre tableur fait le travail. Jusqu'au jour où la personne qui l'a construit s'en va. »
- **Déroulé** :
  1. le tableur hérité ;
  2. les trois signes qu'il est devenu un risque (personne n'ose toucher, formules cassées, impossible sur téléphone) ;
  3. ce qu'on garde ;
  4. ce qu'un outil apporte (rôles, historique, calcul figé) ;
  5. 5 à 10 jours pour un outil sur mesure (page Méthode du site) ;
  6. question.
- **Action** : « Quel tableur de votre entreprise vous fait peur ? »
- **Objectif** : 2 visites de `/sur-mesure` ; 1 demande de contact sur le mois.

**L10 · mer. 02/12 · Instagram · Reel 18 s · personnes débordées · Pilier 1 · Gestionnaire de tâches (Existe : démo 002 « saisie une ligne », meilleur Reel Metricool)**
- **Accroche** : « Une liste de tâches dépanne… jusqu'au jour où elle fait 80 lignes. »
- **Déroulé** :
  - une seule ligne tapée : « Appeler la banque demain 14h !haute #Perso 30min » ;
  - date, priorité, projet et durée remplis ;
  - tri urgent / important ;
  - 3 tâches au focus.
- **Message** : on note vite, on choisit peu.
- **Action** : démo libre, lien en bio.
- **Objectif** : plus de 40 % de spectateurs à 3 s ; 1 clic `achat-taches`.

**L11 · ven. 04/12 · Instagram · Reel 20 s · couples · Pilier 1 · Gestion Dépenses Communes, cadeaux de Noël (Existe : IG-149)**
- **Accroche** : « Les cadeaux de Noël à deux… jusqu'au jour où il faut faire les comptes. »
- **Déroulé** : 240 € payés par l'un, quatre façons de partager, le solde qui se met à jour.
- **Action** : « Envoyez-le à votre moitié avant le 24. »
- **Objectif** : 3 envois.

**L12 · jeu. 03/12 · LinkedIn · texte · freelances · Pilier 1**
- **Accroche** : « En 2027 : 254 jours ouvrés. Vous n'en facturerez pas 254. »
- **Déroulé** : 261 jours de semaine − 7 fériés = 254 − 25 jours de congés = 229 − 1 jour par semaine ≈ 183 jours
  facturés ; donc TJM = besoin ÷ 183, pas ÷ 254 (calcul d'IG-46).
- **Action** : démo du Calculateur de TJM en premier commentaire.
- **Objectif** : 10 enregistrements.

### Semaine 3 · 07–13/12 · Planning et coulisses

**L13 · lun. 07/12 · Instagram · Reel 20 s · chefs de projet, particuliers en travaux · Pilier 1 · Planning Gantt (Existe : `scenarios/gantt-retard.mjs`)**
- **Accroche** : « Une date bouge sur le chantier… et il faut tout recaler à la main ? »
- **Déroulé** :
  - une tâche glissée de 3 jours ;
  - les tâches liées recalées en jours ouvrés, fériés compris ;
  - le chemin critique en rouge.
- **Action** : démo libre, lien en bio.
- **Objectif** : 1 clic `achat-gantt`.

**L14 · mar. 08/12 · Instagram · carrousel 6 vues · Pilier 1 (Nouveau)**
- **Vue 1** : « Achat unique, essai 14 jours, hors connexion : comment marche un outil QME. »
- **Déroulé** :
  1. ouvrir la démo sans compte ;
  2. l'essai 14 jours sans carte ;
  3. l'achat et la clé ;
  4. tous les appareils ;
  5. la démo, libre et sans inscription ;
  6. « Quel outil essayer en premier ? » (renvoi aux 6 héros).
- **Message** : aucun risque à essayer. À épingler.
- **Objectif** : 5 enregistrements.

**L15 · mar. 08/12 · LinkedIn · vidéo 30 s · PME · Pilier 2 (Nouveau, moteur `rendu.mjs`)**
- **Accroche** : « 900 images pour 30 secondes : voici comment je construis une démo d'outil métier. »
- **Déroulé** : coulisses, la démo qui joue sur de vraies données fictives, pourquoi on montre l'outil avant de parler
  du prix.
- **Action** : « Je prépare ce type de maquette pour votre métier : 30 minutes pour en parler. »
- **Objectif** : 1 prise de contact.

**L16 · mer. 09/12 · Instagram · Reel 22 s · Pilier 1 (Existe : IG-50, accroche proche du Reel à 697 vues)**
- **Accroche (dès 0 s)** : « Le tableur que personne n'ose toucher. »
- **Déroulé** :
  - une formule cassée ;
  - la colonne ajoutée par quelqu'un parti depuis ;
  - illisible sur téléphone ;
  - les outils QME (budget, planning, comptes rendus, TJM).
- **Action** : « Lien en bio, démos libres. »
- **Objectif** : comparer à la référence de 697 vues, ce qui teste si le thème « tableur » se reproduit.

**L17 · jeu. 10/12 · Instagram · carrousel 5 vues · couples · Pilier 1 (Nouveau)**
- **Vue 1** : « Partager les dépenses à deux : 4 règles, 1 seul calcul. »
- **Déroulé** : parts égales, prorata des revenus, parts, montants exacts ; un exemple chiffré par règle ; « laquelle est
  juste chez vous ? ».
- **Action** : enregistrer et envoyer.
- **Objectif** : 5 enregistrements, 3 envois.

**L18 · ven. 11/12 · Instagram · Reel 20 s · sur-mesure (1 sur 5) · Pilier 2 (Existe : cas réel d'IG-29, sans donnée du client)**
- **Accroche** : « "Je vous avais laissé le chargeur." Une phrase qui coûte cher à un atelier. »
- **Déroulé** :
  - la fiche d'arrivée case par case ;
  - l'accord sans rappel jusqu'à 150 € ;
  - le constat à 0 minute et 0 € noté sur la facture.
- **Action** : « Votre métier a ses règles ? Lien en bio. »
- **Objectif** : 1 visite de `/sur-mesure` avec `utm_source=instagram`.

**L19 · jeu. 10/12 · LinkedIn · texte · Pilier 2**
- **Accroche** : « Avant d'automatiser, comptez. »
- **Déroulé** : la règle de décision (fréquence × minutes × personnes) ; un exemple ; le seuil à partir duquel
  automatiser vaut le coup ; la question.
- **Objectif** : 5 commentaires.

### Semaine 4 · 14–22/12 · Bilan de l'année

**L20 · lun. 14/12 · Instagram · Reel 20 s · freelances · Pilier 1 · Calculateur de TJM (Existe : IG-46)**
- **Accroche (dès 0 s)** : « En 2027, 254 jours ouvrés. Vous n'en facturerez pas 254. »
- **Déroulé** : le calcul en 4 étapes, puis la capture de la démo (TJM minimum et TJM conseillé).
- **Action** : « Enregistrez-le avant de fixer vos tarifs 2027. »
- **Objectif** : 5 enregistrements.

**L21 · mar. 15/12 · Story × 3 (Quentin)**
- Story 1 : « Le dernier Secret Santa, c'est quand chez vous ? »
- Story 2 : rappel « gratuit ».
- Story 3 : lien `/s/secret-santa`.
- **Objectif** : 5 téléchargements.

**L22 · mar. 15/12 · Instagram · carrousel 6 vues · indépendants · Pilier 1 (Nouveau)**
- **Vue 1** : « Fin d'année : 5 chiffres à vérifier avant le 31. »
- **Déroulé** :
  1. kilomètres et barème ;
  2. seuils de la micro-entreprise ;
  3. abonnements à renouveler ;
  4. jours facturables 2027 ;
  5. ce qu'il reste à encaisser.
  
  Un outil QME par point, sans vendre.
- **Action** : enregistrer.
- **Objectif** : 8 enregistrements (contenu « à garder »).

**L23 · mer. 16/12 · Instagram · Reel 18 s · Pilier 1 · Suivi des abonnements**
- **Accroche** : « Un essai gratuit… jusqu'au jour où il devient payant sans prévenir. »
- **Déroulé** : la fin d'essai saisie, l'alerte « à décider avant le … », la résiliation marquée, l'économie annuelle
  comptée.
- **Action** : essai 14 jours.
- **Objectif** : 1 essai créé avec `utm_source=instagram`.

**L24 · jeu. 17/12 · LinkedIn · carrousel PDF · Pilier 2**
- **Accroche** : « 3 outils que j'ai construits cette année, et la règle métier derrière chacun. »
- **Déroulé** : trois références réelles de `/references/`, chacune avec la règle, le geste et le résultat (sans
  chiffre inventé).
- **Action** : « Et la vôtre ? »
- **Objectif** : 1 demande de contact.

**L25 · ven. 18/12 · Instagram · Reel 20 s · Pilier 1 · Notes de frais et IK (variante de L5 selon ses résultats)**
- **Si L5 a dépassé 40 % de spectateurs à 3 s**, garder l'accroche et changer l'exemple : 3 000 km (pas de
  régularisation). **Sinon**, nouvelle accroche : « Vos kilomètres de 2026 sont-ils comptés au bon taux ? »
- **Objectif** : comparer les deux versions.

**L26 · lun. 21/12 · Instagram · Reel 20 s · Pilier 1 · Gestion Dépenses Communes (le Reel de la semaine 1 ou 2 ayant eu le plus d'envois, rediffusé avec une nouvelle accroche)**
- **Objectif** : mesurer le recyclage.

**L27 · mar. 22/12 · LinkedIn · texte · bilan**
- **Accroche** : « 30 jours de tests sur Instagram : ce qui a marché, ce qui n'a rien donné. »
- **Déroulé** : les chiffres réels (pas d'invention), les accroches gagnantes, ce que QME change en janvier.
- **Objectif** : 10 commentaires ; preuve de transparence.

**Total sur 30 jours** :
- Instagram : 13 Reels, 3 nouveaux carrousels + les 12 du test des fonds jusqu'au 07/12, 9 stories ;
- LinkedIn : 9 publications.

Les Reels existants réhabillés coûtent peu ; les nouveaux contenus sont 6.

**Effet sur le planning actuel** (décision de Quentin) : les Reels et vidéos démo programmés sur Instagram du 23/11 au
22/12 qui ne figurent pas ci-dessus seraient annulés ou décalés après le 22/12. Je ne modifie pas le planning sans son
accord (voir P1).

---

## 7. Organisation hebdomadaire de production

| Jour | Qui | Quoi | Durée de Quentin |
|---|---|---|---|
| Lundi | Claude (tâche planifiée) | lot de la semaine suivante : 3 Reels, 1–2 carrousels, 2–3 LinkedIn ; chaque contenu sort de la même fiche (problème, rupture, démo, chiffre, action) | 0 |
| Mardi | Quentin | relecture des **accroches seulement** (3 propositions par contenu, il en choisit une) et validation | 20 min |
| Mar., jeu., sam. | Quentin | 3 stories depuis le téléphone (modèle fourni) | 3 × 5 min |
| Chaque jour | Quentin | 5 commentaires utiles sur les 30 comptes cibles ; réponse à chaque commentaire reçu dans l'heure | 15 min |
| Vendredi | Claude + Quentin | relevé des indicateurs (§ 8) ; décision : décliner, retravailler ou abandonner | 15 min |

**Total : environ 2 h 30 par semaine pour Quentin.** La production elle-même reste automatisée par les skills
existants (`video-demo`, `reel-du-soir`, `publication-classique`), mais **avec une cadence réduite à 5 publications
Instagram par semaine** au lieu d'environ 9.

**Une idée, trois formats :**
1. Reel = la scène et la rupture (0–3 s), l'action réelle (3–15 s), le chiffre (15–20 s).
2. Carrousel = la même idée en règle à garder (vue 1 : accroche ; vues 2–4 : la règle et l'exemple ; vue 5 : la liste ;
   vue 6 : l'action).
3. LinkedIn = le récit à la première personne de l'ingénieur (pourquoi la règle existe, ce que coûte l'erreur) ;
   vidéo native ou carrousel PDF ; lien en premier commentaire.

**Recycler ou abandonner (règle de J+7)** :

| Résultat à J+7 | Décision |
|---|---|
| Plus de 45 % de spectateurs à 3 s et au moins 2 envois | décliner (même idée, autre exemple) dans les 3 semaines |
| Spectateurs à 3 s sous 25 % | refaire les 2 premières secondes, republier après 3 semaines |
| Vues correctes mais aucun clic ni enregistrement | sujet trop large : resserrer le public visé |
| Trois contenus d'affilée sous la médiane sur un même produit | sortir le produit des héros |

---

## 8. Tableau de bord KPI

Référence : audit Metricool (27,8 vues par Reel, 2,4 interactions, 71,9 % de passage rapide, aucun partage),
GoatCounter et Gumroad (§ 1.1). Les objectifs portent sur la **médiane** des Reels, publicité exclue.

### 8.1 Visibilité (Instagram, statistiques natives)

| Indicateur | Référence | 30 j | 60 j | 90 j |
|---|---|---|---|---|
| Abonnés | 53 | 90 | 150 | 250 |
| Vues médianes par Reel | ≈ 28 | 80 | 150 | 250 |
| Part des vues hors abonnés | non mesurée | relever | > 60 % | > 70 % |
| Spectateurs encore là à 3 s | 28,1 % | 40 % | 45 % | 50 % |
| Envois par Reel (moyenne) | 0 | 1 | 3 | 5 |
| Enregistrements par carrousel (moyenne) | ≈ 0 | 3 | 6 | 10 |
| Interactions par publication | 2,4 (Reels), 4 (carrousels) | 5 | 8 | 12 |

### 8.2 Commerce (GoatCounter + Gumroad, sur 30 jours glissants)

| Indicateur | Référence | 30 j | 60 j | 90 j |
|---|---|---|---|---|
| Visites du site depuis Instagram (`utm_source=instagram`) | 15 | 60 | 120 | 200 |
| Ouvertures de démo depuis Instagram | non mesurées | 20 | 40 | 70 |
| Essais créés (toutes sources) | 1 | 5 | 10 | 20 |
| Clics « Acheter » (`achat-*`) | 3 | 10 | 20 | 35 |
| Ventes payantes Gumroad | 1 en 80 jours | 2 | 4 | 6 |
| Téléchargements gratuits Secret Santa | non relevés | 30 (décembre) | — | — |
| Visites de `/sur-mesure` depuis les réseaux | non mesurées | 10 | 20 | 35 |
| Demandes de devis qualifiées | à renseigner par Quentin | 1 | 2 | 4 |

Lecture honnête : avec un taux de conversion de 1 à 3 % des visites, 200 visites par mois donnent 2 à 6 ventes. Les
ventes suivront le trafic qualifié, pas le nombre d'abonnés. Une vente de sur-mesure vaut des centaines de templates :
l'indicateur commercial le plus important est la **demande de devis qualifiée**, d'abord nourrie par LinkedIn.

---

## 9. Plan d'action priorisé

### Priorité 1 · cette semaine

| # | Action | Pourquoi | Résultat attendu | Temps | Vérification |
|---|---|---|---|---|---|
| 1 | Transmettre les UTM du site à Gumroad (`assets/site.js`), créer `/ig` et `/s/<produit>` dans `netlify.toml` | aujourd'hui aucune vente n'est attribuable | chaque vente porte sa source | 2 h (Claude) | une vente test (code gratuit) apparaît avec `utm_source` dans `list_sales` |
| 2 | Changer la bio, le nom affiché, réduire à 2 liens, épingler 3 publications | le profil est la page de conversion | plus de visites de profil transformées en clics | 15 min (Quentin) | clics sur le lien de bio dans les statistiques |
| 3 | Trier le planning Instagram du 23/11 au 22/12 : garder les 12 carrousels du test, remplacer les Reels par ceux du § 6, annuler IG-51, IG-52 (faux), IG-133 | cadence trop haute, contenus contraires à la stratégie | 5 publications par semaine, toutes alignées | 30 min de décision (Quentin), 1 h (Claude) | planning relu, journal tenu |
| 4 | Corriger les incohérences de prix (Suivi des abonnements : 9 € ou 12 € ?) et le « bientôt » du Planner horaire | un prix contradictoire tue la confiance | un seul prix partout | 15 min | site, Gumroad et visuels identiques |
| 5 | Règle « accroche lisible dès la première image » dans les skills `reel-du-soir` et `video-demo` (option `--debut` du moteur, patch prêt dans `tests-accroches/`) | la moitié des Reels perd l'œil avant 1 s | taux à 3 s en hausse | 1 h (Claude) | contrôle des 3 premières secondes à chaque rendu |
| 6 | Démarrer les commentaires quotidiens (liste des 30 comptes) | seul levier gratuit pour toucher des non-abonnés tout de suite | visites de profil depuis l'extérieur | 15 min/jour | visites de profil hebdomadaires |

### Priorité 2 · dans les 30 jours

| # | Action | Pourquoi | Résultat attendu | Temps | Vérification |
|---|---|---|---|---|---|
| 7 | Stories 3 fois par semaine avec autocollant lien | seul lien cliquable d'Instagram | 10 à 20 visites par semaine | 15 min/semaine | `utm_medium=story` dans GoatCounter |
| 8 | Ajouter 3 champs de qualification et la source au formulaire de contact | qualifier les demandes de sur-mesure | demandes exploitables | 1 h (Claude) | chaque demande indique métier, outil, source |
| 9 | Relevé du vendredi dans `pilotage-hebdo.md` | décider sur des chiffres natifs, pas sur Metricool seul | décisions de recyclage à J+7 | 15 min/semaine | 4 relevés en décembre |
| 10 | Reprendre le test d'accroches (A/B/C) sur les Reels de décembre | valider l'hypothèse « récit et rupture » | une règle d'accroche prouvée ou abandonnée | 2 h (Claude) | comparaison des taux à 3 s |
| 11 | Vérifier la collecte d'e-mails via le Secret Santa gratuit (réglages Gumroad, consentement RGPD) | premier fichier de contacts | une liste utilisable en janvier | 30 min | export des acheteurs |

### Priorité 3 · ensuite

| # | Action | Pourquoi | Résultat attendu | Temps | Vérification |
|---|---|---|---|---|---|
| 12 | Une publication co-signée par mois avec un affilié | portée hors abonnés gratuite | + 20 abonnés par collaboration | 2 h par collaboration | abonnés gagnés le jour même |
| 13 | Tester une photo de Quentin en photo de profil | la confiance passe par une personne | meilleur taux de clic sur le profil | 10 min | clics de bio avant / après sur 2 semaines |
| 14 | Reels d'essai dès 1 000 abonnés | tester deux accroches sans risque | accroche gagnante avant publication | — | statistiques des Reels d'essai |
| 15 | Revoir la largeur du catalogue mis en avant chaque trimestre selon les ventes réelles | 69 produits, 1 vente payante | se concentrer sur ce qui se vend | 1 h par trimestre | ventes par produit (Gumroad) |

---

## Sources

- Statistiques internes : GoatCounter (`qme-engineering.goatcounter.com`, API), Gumroad (API), onglet Planning du Sheet
  « Planning Instagram », `docs/videos/catalogue.mjs`, `instagram/tests-accroches/README.md`.
- Pratiques des plateformes (sources secondaires, à vérifier dans les centres d'aide officiels) :
  [Buffer, algorithme Instagram 2026](https://buffer.com/resources//instagram-algorithms/),
  [Later, algorithme Instagram](https://later.com/blog/instagram-algorithm/amp),
  [SocialPilot, algorithme des Reels](https://www.socialpilot.co/blog/instagram-reels-algorithm),
  [Metricool, algorithme LinkedIn 2026](https://metricool.com/linkedin-algorithm/),
  [Inro, référencement Instagram 2026](https://www.inro.social/blog/instagram-seo-guide-2026),
  [Metricool, légendes multiples des carrousels](https://metricool.com/instagram-carousel-multiple-captions/).
