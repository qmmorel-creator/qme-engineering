# T52 · Gestion de compétition sportive (`templates/competition/`, préfixe CMP, 49 €)

Cadrage délégué par Quentin (14/11/2026) : fiche rédigée et appliquée sans validation intermédiaire.

## Promesse et public

- **Promesse** : « Du premier inscrit au podium, sans tableur. » Inscriptions, catégories, vagues
  (heats) horaires, saisie des scores au bord du plateau, classement calculé en direct et affiché sur un
  écran ou sur le téléphone des spectateurs.
- **Pour qui** : salles de cross-training, clubs et associations sportives qui organisent une compétition
  amicale ou locale (20 à 200 participants), individuelle ou par équipes, en plusieurs épreuves notées au
  temps, aux répétitions, à la charge ou aux points. Usage à plusieurs (même clé : organisateur, table de
  marque, juges sur téléphone).
- Pack « Associations et clubs » (PAS). Catalogue `pro`, thème « Associations, formation et événements ».

## Écrans

1. **Tableau de bord** : inscrits par catégorie et par statut, avancement des scores, prochaines vagues
   (horaire calculé), podiums provisoires, alertes (repos insuffisant entre deux vagues, inscrits sans
   catégorie, épreuves sans vagues, scores manquants).
2. **Inscrits** : athlètes ou équipes (nom, catégorie, club, membres pour une équipe, dossard automatique,
   statut inscrit / confirmé / forfait, paiement, pièces vérifiées, contact facultatif, accord d'affichage
   public) ; filtres, recherche, import d'une liste collée (une ligne par inscrit), export CSV avec ou sans
   coordonnées ; gestion des catégories (individuelle ou équipe, taille d'équipe).
3. **Épreuves et vagues** : épreuves dans l'ordre du programme (type de score, temps limite, nombre total
   de répétitions, départage, coefficient, catégories concernées, jour et heure de début) ; génération des
   vagues par catégorie (nombre de couloirs, vagues équilibrées, ordre : classement provisoire inversé, dossard
   ou tirage), horaires calculés (durée de vague = temps limite + battement), modification d'un couloir,
   feuilles de juge imprimables (une vague par page).
4. **Scores** : par épreuve et par catégorie, dans l'ordre des vagues ; saisie rapide (temps « 12:34 »,
   répétitions au temps limite, charge, points, départage), statuts absent / disqualifié, case « validé »
   (feuille signée) ; rang de l'épreuve recalculé à chaque saisie.
5. **Classement** : par catégorie, total, rang, détail par épreuve (rang, points, score), provisoire tant
   que des scores manquent ; règles de classement ; **mode écran** plein écran ; **partage public**.

## Règles de classement (paramétrables, `regles.js`)

- Épreuve au temps : les finishers d'abord, du plus rapide au plus lent ; puis les non-finishers au temps
  limite, du plus grand nombre de répétitions au plus petit (affichage « CAP+7 » quand le total est connu).
  Répétitions, charge, points : le plus grand d'abord. Départage facultatif par temps (le plus court gagne).
- Égalité parfaite : même rang (1, 2, 2, 4).
- Méthode « somme des rangs » (le total le plus bas gagne) ou « barème de points » (100 au premier, moins
  un écart par place, plancher ; le total le plus haut gagne). Coefficient par épreuve (finale ×2…).
- Sans score (absent, disqualifié, pas encore saisi) : rang = nombre de classés + 1, ou 0 point.
- Départage du classement général : plus de meilleures places (1res, puis 2es…), meilleur rang sur la
  dernière épreuve disputée, ou ex aequo.
- Forfait : hors classement et hors vagues.

## Affichage public (décision de cadrage)

- **Mode écran** dans l'application : plein écran, rotation des catégories et des pages, horloge, vague en
  piste et suivante ; relit les données toutes les 15 s (scores saisis sur un autre appareil).
- **Lien public en lecture seule**, à activer par l'organisateur : l'application publie un instantané du
  classement et du programme (`PUT /api/competition/public`, jeton du template) ; les spectateurs ouvrent
  `/templates/competition/?ecran=<id>` (classement par catégorie, programme des vagues, bouton plein écran),
  relu toutes les 30 s, mis en cache 15 s par le CDN. Identifiant dérivé par HMAC du code acheteur et d'un sel
  (non devinable, changeable), republication automatique après chaque modification, retrait à tout moment.
- API propre `/api/competition/*` (`netlify/functions/competition.mjs`, moteur `templates/competition/moteur.js`,
  dépendances `netlify/lib/competition.mjs`), Netlify Blobs à Francfort (magasin `competition-public`),
  instantané reconstruit champ par champ côté serveur (aucun champ inconnu, textes tronqués, 300 Ko max).

## RGPD (participants)

- Minimisation : ni date de naissance, ni donnée de santé (pas de certificat stocké : une case « pièces
  vérifiées »), contact facultatif.
- Le lien public ne contient jamais e-mail, téléphone, notes, paiement ni membres d'équipe ; nom affiché
  complet ou « Prénom N. » (réglage) ; un inscrit sans accord d'affichage apparaît « Dossard n ».
- Effacement automatique de l'instantané public 30 jours après la date de fin (90 jours après publication
  sans date), à la lecture et par une tâche quotidienne (`competition-purge.mjs`).
- Mention d'information à copier dans le formulaire d'inscription du club ; bouton « Effacer les
  coordonnées » après la compétition.

## Base intégrée (`donnees.js`, rédigée pour QME)

- 6 formats de départ (individuel cross-training, équipes de 2, équipes de 4 mixtes, force, épreuves
  chronométrées d'endurance, vide) avec leurs catégories types.
- 12 épreuves génériques (aucun nom d'épreuve de référence ou de marque) : couplets au temps, AMRAP,
  charge maximale en fenêtre, rameur, vélo en calories, parcours par équipe, finale.
- 4 types de score, statuts, conseils de démarrage et repères d'organisation (couloirs, battement, juges).

## Données qui se périment

Aucune : pas de règlement fédéral, pas de barème officiel. Toutes les règles sont des paramètres.

## Risques

Pas un logiciel fédéral homologué (avertissement). Aucune marque, aucun nom d'épreuve protégé, aucune salle
réelle (démo : « Défi d'hiver Exemple », clubs « Exemple »). Aucun envoi d'e-mail ni connecteur.
