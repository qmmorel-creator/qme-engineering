# T59 · Progression pédagogique

Slug `progression`, préfixe `PRG` (clés locales `qme-prg-*`, règles `window.PRG`), prix prévu 15 € (**à confirmer
par Quentin**), permalien Gumroad prévu `progression-pedagogique`, catégorie Gumroad `education` (**à vérifier**),
taille S, priorité P3. Catalogue : `data-pour="pro"`, thème « Associations, formation et événements »
(`associations-formation-et-evenements`, `--c:var(--rouge)`, avec la gestion de classe et l'emploi du temps).
Origine : backlog de Quentin n° 36. Marques : **confidentiel** (artefact professionnel d'origine : mécanique
seulement, aucun contenu repris). Fiche rédigée le 14/11/2026. Aucune marque, aucun logiciel nommé, aucune donnée
réelle ; aucune automatisation ni lien externe.

Préfixe : `SQC` avait été déclaré côté serveur au lot 9 ; changé en `PRG` à la demande de l'orchestrateur
(réservé dans les packs) : `PRODUITS` serveur à mettre à jour par l'orchestrateur.

## Public

Enseignants (collège, lycée, supérieur) et formateurs (formation continue, apprentissage) qui tiennent une
progression annuelle ou un plan de formation par classe ou par groupe, et veulent savoir à tout moment s'ils sont
dans les temps, sans recompter les heures à la main.

## Promesse

« Ton programme, séance après séance. » Les séquences sont posées sur le vrai calendrier ; après chaque cours, un
geste suffit, et l'outil dit où l'on en est face au prévu, quand on finira, et si le programme tient avant la fin
des cours.

## Confidentialité et périmètre

- Mécanique reprise : « jalons à plage » du planning Gantt (`templates/gantt/`, `etatPlage`) pour les fenêtres de
  fin des séquences. Aucun contenu repris d'un document réel.
- **Aucune donnée d'élève** : le template planifie le contenu des cours. Aucun nom, note ni absence.
- **Aucun programme officiel** recopié : séquences saisies par l'utilisateur ou proposées par des modèles de
  structure génériques (titres « Séquence 1 », « Thème A · découverte »…).
- **Aucun calendrier de vacances scolaires** intégré (donnée datée, par zone) : saisi par l'utilisateur. Les jours
  fériés sont calculés.
- Démo entièrement fictive : une classe de collège en mathématiques, une classe de lycée en histoire-géographie,
  un groupe de formation continue au tableur ; titres de séquences génériques (noms de notions courants, aucun
  intitulé de programme recopié), vacances inventées relatives à aujourd'hui.

## Écrans (5 onglets + réglages)

1. **Tableau de bord** : tuiles (classes et heures par semaine, heures faites, plus fort retard, créneaux à
   renseigner) ; « À regarder » (vacances non saisies, créneaux passés sans séance, programme qui ne tient pas,
   fenêtre dépassée, classe sans séquence) ; cartes des classes (barre d'avancement réel avec repère de l'attendu,
   retard en heures et en séances, séquence en cours, fin projetée, marge ou heures qui manquent) ; prochains
   cours (séquence prévue, séance préparée).
2. **Séances** : par classe ; créneaux passés à renseigner (Faite / Annulée) ; prochains créneaux (Préparer) ;
   cahier de textes (séances consignées, statut, motif, contenu, travail donné) ; impression du cahier sur une
   période ; export CSV.
3. **Séquences** : tuiles (prévu face aux heures de l'année, avancement, retard, marge) ; encart si le programme
   ne tient pas ; cartes ordonnées (état, heures faites et prévues, dates prévues et réelles ou projetées, fenêtre,
   objectifs avec niveau de Bloom, compétences visées, note, monter / descendre, terminer / reprendre) ; partir d'un
   modèle ; dupliquer ; export CSV ; banque de verbes.
4. **Frise** : une ligne par séquence sur l'année : prévu (clair), réalisé (plein), projeté (hachuré), fenêtre
   (crochet, rouge si dépassée), vacances en bandes, aujourd'hui, fin des cours de la classe ; tableau accessible.
5. **Calendrier** : année (dates, semaines avec cours) ; vacances et jours sans cours ; jours fériés calculés à
   cocher ; classes et groupes (créneaux, heures par semaine, dans l'année, restantes) ; heures par période entre
   deux vacances ; nouvelle année avec reprise de la structure ; suppression d'une année.
- **Réglages** : Alsace-Moselle, règle de l'alternance A/B, réserve des modèles, export CSV, copie JSON et
  restauration, compte, « Sur téléphone », à propos (sources).
- Premier lancement en 2 étapes : présentation ; dates de l'année, date de début du suivi (année déjà commencée :
  les cours passés ne sont pas comptés), première classe et ses créneaux.

## Base intégrée (`donnees.js`)

- Statuts de séance (faite, prévue, reportée, annulée) et motifs (sortie, absence, examen, réunion, événement,
  autre).
- Déroulé type d'une séquence (7 étapes : situation de départ, découverte, structuration, entraînement,
  remédiation, évaluation, correction) proposé pour décrire une séance.
- 5 modèles de structure : une séquence par période entre deux vacances (durée exacte des heures de la période),
  huit séquences et un bilan, progression spiralaire (3 thèmes × 3 passages), apports puis projet, formation en
  modules ; durées en parts des heures disponibles, réserve réglable (10 % par défaut).
- Banque de 73 verbes d'objectifs, 12 ou 13 par niveau du domaine cognitif de la taxonomie de Bloom révisée (se
  souvenir, comprendre, appliquer, analyser, évaluer, créer) ; liste de verbes difficiles à observer (savoir,
  connaître, maîtriser…) ; amorces ignorées (« l'élève sera capable de »…).
- Couleurs fixes des classes.

## Calculs (`regles.js`, fonctions pures testées)

- **Fériés** : Pâques (algorithme de Meeus / Jones / Butcher), 11 fêtes légales (article L3133-1 du Code du
  travail, liste reprise des templates congés et emploi du temps), + Vendredi saint et 26 décembre en Alsace-Moselle
  (option). Chaque férié peut être décoché (cours maintenu).
- **Créneaux** : jours de cours de chaque classe entre son premier et son dernier cours, hors fériés, vacances et
  jours sans cours ; semaines A/B : la semaine de référence est A ; par défaut seules les semaines avec au moins
  un jour ouvert du lundi au vendredi comptent (l'alternance reprend après les vacances), sinon parité calendaire.
- **Prévu** : séquences à la suite sur tous les créneaux de l'année (un créneau peut être partagé entre deux
  séquences) → dates de début et de fin prévues.
- **Attendu** à une date : heures des créneaux passés (jour inclus), plafonnées au total prévu.
- **Réel** : séquence terminée = sa durée prévue ; sinon heures des séances faites, plafonnées à sa durée.
  **Retard** = attendu − réel, en heures et en séances (durée moyenne d'un créneau). Annulées et reportées ne
  comptent pas.
- **Projection** : heures restantes (prévu − fait, 0 si terminée) reposées sur les créneaux à venir (créneaux du
  jour déjà consignés retirés) → fin projetée de chaque séquence ; **marge** = heures à venir − heures restantes ;
  négative → alerte « ne tient pas » avec les heures et séances manquantes.
- **Fenêtre** (jalon à plage) : fin réelle ou projetée comparée à [début, fin] : avant, dans, dépassée.
- **Créneaux à renseigner** : créneaux passés sans séance consignée ce jour-là (une séance « prévue » ne compte pas).
- **Report** : la séance passe « reportée », son contenu est recopié en séance prévue au prochain créneau libre.
- **Bloom** : niveau d'un objectif d'après son premier verbe.
- Duplication (classe ou année entière, fenêtres décalées de l'écart entre les années, sans séances), CSV (`;`,
  UTF-8 avec BOM, nombres à virgule), cahier de textes, normalisation tolérante.

## Sources

- Taxonomie : B. S. Bloom (1956), révision L. W. Anderson et D. R. Krathwohl (2001) ; seuls les noms des six
  niveaux (traduits) sont repris, connaissance générale ; listes de verbes rédigées pour QME, sans reprise d'une
  liste publiée. **Non vérifié** sur une source primaire dans cette session.
- Jours fériés : article L3133-1 du Code du travail (liste déjà utilisée par d'autres templates) ; **non relu sur
  Légifrance dans cette session**.
- Aucune autre base externe.

## Risques

- Calendrier : un oubli de vacances surestime les heures (alerte au tableau de bord tant qu'aucune vacance n'est
  saisie).
- Alternance A/B : règles variables selon les établissements (réglage, aide affichée).
- Lundi de Pentecôte : compté par défaut sans cours ; décochable (statut à vérifier selon les établissements).
- Un seul utilisateur par clé (pas de progression partagée entre collègues).
- Taille : environ 400 séances par an et par classe restent loin de la limite de 900 Ko (démo : ≈ 60 Ko).
- Le cahier imprimé n'est pas le cahier de textes officiel (mention imprimée).

## État au 14/11/2026

Prêt (worktree de lot 9), « Mise en vente prochaine ». Tests `outils/templates/progression.test.mjs` (20 tests) ;
Playwright ordinateur 1280 px, iPhone 13 et Pixel 7 (code faux, code valide, premier lancement, vacances, modèle,
séquence, séance, rattrapage, synchronisation, rechargement, duplication, cahier, réglages, écran d'accueil, démo).
