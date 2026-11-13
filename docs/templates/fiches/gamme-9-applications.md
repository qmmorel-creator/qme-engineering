# Gamme de 9 applications (T69 à T77) · analyse de faisabilité et découpage

Demande de Quentin du 13/11/2026 (« prompt maître »). Développement dans l'ordre imposé, une application
à la fois, chacune validée (calculs, cas limites, mobile, hors ligne, exports, licence) avant la suivante.

## 1. Audit du socle existant (ce qui est repris sans modification)

| Besoin du prompt | Existant dans le dépôt | Décision |
|---|---|---|
| Licence Gumroad, achat unique | `netlify/lib/templates-acces.mjs` : clé vérifiée par `/v2/licenses/verify`, convertie en code interne HMAC ; remboursement → accès refusé | Repris tel quel : une ligne par produit dans `PRODUITS` (serveur) et dans `connexion/index.html` (client). Aucune modification du moteur. |
| Découverte gratuite | Mode démo (`?demo`, bouton « Essayer ») : toutes les fonctions, données d'exemple, stockage local seulement, réinitialisable | Repris. La différence avec la version complète est la **persistance en ligne et la synchronisation multi-appareils** ; aucune fonction n'est bridée dans l'essai (export compris). Expliqué sur l'écran de connexion et la page catalogue. |
| Stockage, synchronisation, hors ligne | `/api/templates/donnees` (Netlify Blobs, Francfort), cache `localStorage`, conflit 409, service worker « réseau d'abord » | Repris. Limite : **900 Ko de JSON par acheteur et par produit** (contrainte pour les photos, voir T71). |
| Composants | Socle copié de `templates/abonnements/` (le plus récent) : connexion, démo, modales `<dialog>`, toast « Annuler », réglages, export/import JSON, fenêtre « Comme une application », charte Pastel | Copié par application (convention du dépôt : chaque template est autonome, aucune dépendance croisée). |
| Tests | `node --test outils/templates/*.test.mjs` (règles pures chargées par `vm`) | Un fichier de tests par application ; Playwright pour les parcours (ordinateur 1280 px, iPhone 13, Pixel 7). |

Aucune API payante, aucun service externe, aucun envoi de message, aucun agenda : conforme au socle et à
la règle de Quentin du 13/11/2026.

## 2. Préfixes et chemins

| N° | Nom | Préfixe | Slug | Prix cible | Groupe du catalogue |
|---|---|---|---|---|---|
| T69 | MétréPro | `MTR` | `templates/metre/` | 29 € | Travail · BTP |
| T70 | WattBudget | `WTT` | `templates/watt-budget/` | 14 € | Maison · Argent |
| T71 | ContrôleRéception | `RCP` | `templates/controle-reception/` | 24 € | Travail · Qualité |
| T72 | PlanB | `PNB` | `templates/plan-b/` | 14 € | Maison · Foyer |
| T73 | MémoFamille | `MMF` | `templates/memo-famille/` | 19 € | Maison · Foyer |
| T74 | FêteBudget | `FTB` | `templates/fete-budget/` | 12 € | Maison · Événements |
| T75 | Ludothèque | `JDS` | `templates/ludotheque/` | 14 € | Maison · Loisirs |
| T76 | TournoiFacile | `TRN` | `templates/tournoi/` | 19 € | Travail · Événementiel |
| T77 | CaveManager | `CVM` | `templates/cave/` | 19 € | Maison · Loisirs |

Préfixes sans I, L, O, U, avec au moins une lettre hors A–F (distincts d'une clé Gumroad hexadécimale).
**Noms commerciaux à vérifier par Quentin** (base INPI / marques existantes) avant la fiche Gumroad :
« MétréPro », « PlanB » et « CaveManager » sont des noms courts susceptibles d'être déjà déposés.

## 3. Faisabilité par application

Légende des risques : **daté** (donnée qui se périme), **RGPD**, **responsabilité**.

### T69 · MétréPro (faisable, taille L)
Projets → zones → lignes de métré. Chaque ligne : ouvrage de la bibliothèque, forme de calcul (rectangle,
mur avec déduction des ouvertures, volume, linéaire, unités, triangle, disque, quantité directe justifiée),
dimensions, nombre, variante(s). Moteur : quantité théorique → perte (%) → quantité avec pertes →
composants (ratios par unité d'ouvrage) → arrondi au conditionnement → quantité à commander ; quantité
retenue modifiable avec écart affiché. Chaque résultat garde sa formule développée (« 4,20 × 2,50 − 1 ×
(0,90 × 2,15) = 8,57 m² »). Bibliothèque : ouvrages génériques par famille, ratios **indicatifs QME**
(non normatifs, à adapter aux fiches fabricants). Pas de lecture de plan ni de BIM. Risque :
**responsabilité** (aide au métré, ne remplace pas un métreur ni les DTU).

### T70 · WattBudget (faisable, taille M)
Appareils avec mode d'usage (durée par jour × jours par semaine, cycles, permanent, consommation mesurée),
veille, saisonnalité, quantité. kWh/an → coût jour/mois/an au tarif saisi ; option heures creuses ;
abonnement à part. Remplacement (temps de retour), principaux postes (Pareto), scénarios de réduction.
**Aucun tarif fourni** : l'utilisateur saisit son prix du kWh (avec la date de son contrat) ; la démo
utilise un tarif marqué fictif. Puissances du catalogue = ordres de grandeur génériques à remplacer par
la plaque signalétique ou une mesure. Risque : **daté** neutralisé par la saisie.

### T71 · ContrôleRéception (faisable, taille L)
Réceptions (fournisseur, commande, BL), lignes commandé/reçu avec tolérance, points de contrôle par
famille (visuel, documentaire, mesure avec plage), constats (quantitatif, qualitatif, documentaire ;
gravité), réserves et levées, statut calculé (en attente, conforme, conforme avec réserves, non
conforme) et décision finale motivée, PV imprimable, historique et taux de conformité par fournisseur.
**Photos** : compressées dans le navigateur (JPEG ≈ 640 px) et comptées dans les 900 Ko ; au-delà,
ajout refusé avec un message (limite connue, documentée). Modèles génériques, **sans valeur de
certification**.

### T72 · PlanB (faisable, taille M)
Foyer (membres, besoins spécifiques, animaux), 6 situations avec checklists et plans d'action
(avant / pendant / après), inventaire des réserves avec péremptions, besoins calculés pour un objectif de
jours, autonomie théorique (eau, nourriture, éclairage), contacts, niveau de préparation, manques, plan
imprimable. Quantités par défaut **prudentes et modifiables**, référentiel daté « QME 13/11/2026, non
officiel », renvoi systématique aux consignes des autorités. Risque : **responsabilité**.

### T73 · MémoFamille (faisable, taille M)
Fiches classées (membres, contacts, contrats, logement, équipements, prestataires, véhicules, documents,
consignes, enfants, animaux) à partir de modèles de champs, recherche, dossier imprimable avec choix des
fiches, export/import JSON. **Sécurité** : aucun champ mot de passe ; détecteur de saisies sensibles
(numéro de carte vérifié par Luhn, IBAN, numéro de sécurité sociale, mots « mot de passe », « code PIN »)
qui bloque l'enregistrement ; avertissements ; données hébergées en ligne chez QME (pas de chiffrement de
bout en bout, dit clairement), jamais présenté comme un coffre-fort. Risque : **RGPD** (données de tiers
du foyer, rappel affiché).

### T74 · FêteBudget (faisable, taille M)
Événement, invités (adultes, enfants, statuts), budget global ou par personne, dépenses prévues et
réelles par catégorie, besoins en repas et boissons calculés depuis des **ratios indicatifs ajustables**
(par type de formule et durée), scénarios comparés, répartition entre participants (équilibrage en un
minimum de virements), budget restant, liste de préparation datée depuis le jour J.

### T75 · Ludothèque (faisable, taille M)
Jeux (joueurs, durée, complexité, âge, catégories, mécaniques, extensions, emplacement, prêt), parties,
statistiques (parties par jeu, jamais ou rarement joués), suggestions classées et expliquées selon le
nombre de joueurs, le temps et les préférences, liste « à découvrir ». Catalogue de démonstration de jeux
**fictifs** ; vocabulaire de mécaniques générique ; aucune API externe.

### T76 · TournoiFacile (faisable, taille L, le plus algorithmique)
Élimination directe (têtes de série, exempts), double élimination (tableau des perdants, grande finale
avec revanche facultative), poules (répartition en serpentin, tailles inégales) puis phase finale,
championnat (méthode du cercle, exempt si impair, aller-retour). Planification sur terrains avec durée
et repos minimal, scores, classements, départage configurable (points, différence, marqués, confrontation
directe, victoires, tirage déterministe), forfaits, correction d'un résultat avec remise à zéro de la
suite du tableau. Invariants testés : aucune équipe deux fois dans le même créneau, aucun match contre
soi-même, aucun doublon de rencontre en championnat simple.

### T77 · CaveManager (faisable, taille M)
Bouteilles (catégorie, région, appellation, cépage, millésime, producteur, format, emplacement, prix,
valeur déclarée), mouvements d'entrée et de sortie (le stock est la somme des mouvements), historique des
dégustations, fenêtre de consommation saisie ou proposée par des **règles indicatives paramétrables**,
alertes, statistiques, suggestions à ouvrir. Aucune donnée externe. Risque : boisson alcoolisée, mention
de modération sur la fiche commerciale.

## 4. Découpage commun à chaque application

1. Fiche courte dans ce document + ligne dans `IDEES.md` (statut `en cours`).
2. `donnees.js` (base intégrée documentée), `regles.js` (règles pures), `app.js` (vues), `app.css` (socle
   + composants propres), manifeste, service worker, icônes.
3. `outils/templates/<slug>.test.mjs` : calculs, nuls et négatifs, extrêmes, champs obligatoires,
   données manquantes, cas métier limites, normalisation (restauration d'une sauvegarde abîmée),
   CSV et JSON aller-retour, changement de réglages.
4. Playwright : connexion refusée, démo, parcours de saisie, export, import, impression, téléphone,
   hors ligne (cache), code valide sur le serveur local et synchronisation.
5. Intégration au site : `PRODUITS` (serveur et connexion), `netlify.toml` (`noindex`, `sw.js`), page
   `catalogue/<slug>/` en « Mise en vente prochaine », carte du kanban, carte anglaise, README, IDEES.
6. Hors périmètre de cette passe (restent à faire, signalés dans le bilan) : fiche Gumroad (nom et prix à
   confirmer, clé de licence à activer par Quentin), publications LinkedIn et Instagram, prospects.

## 5. État au 13/11/2026 : les 9 applications sont prêtes (« Mise en vente prochaine »)

Démo libre, page catalogue, carte du kanban et carte anglaise en place ; **pas encore de fiche Gumroad**
(nom et prix à confirmer, clé de licence à activer par Quentin). Branche `claude/gumroad-9-apps-524ekf`.

### Socle technique commun (`templates/commun/`)

- `outils.js` (`window.QME_OUTILS`) : lecture tolérante des nombres et montants français, centimes,
  arrondis, dates locales, normalisation bornée, CSV (`;`, virgule décimale, BOM), taille d'un état.
- `socle.js` (`QME_SOCLE.creer(config)`) : connexion par clé Gumroad ou code interne (même API
  `/api/templates/*`, même produit envoyé, clé d'un autre produit refusée), découverte (démo locale,
  « Recommencer l'exemple », « Partir d'une page vide »), synchronisation temporisée, cache local et
  hors ligne, conflit 409, refus au-delà de 880 Ko, modales, toast « Annuler », réglages (exports,
  sauvegarde et restauration JSON, déconnexion), fenêtre « Comme une application ».
- `socle.css` : charte Pastel et composants communs. Chaque application garde son `app.css` propre.
- Découverte ⇄ version complète : la découverte donne **toutes** les fonctions (exports compris) sur un
  exemple fictif gardé dans le navigateur ; la licence ajoute ses propres données, enregistrées en
  ligne et synchronisées entre appareils. Aucune fonction n'est bridée.
- Service worker par application, réseau d'abord, socle commun mis en cache, API jamais en cache.

### T69 · MétréPro (`MTR`, `templates/metre/`)
- **Fonctions** : projets, zones, lignes de métré, déductions, pertes, quantité retenue, variantes,
  hypothèses, bibliothèque d'ouvrages modifiable, quantités par famille, composants à commander,
  comparaison des variantes, bordereau imprimable, CSV (métré détaillé, commande, bordereau), JSON.
- **Calculs** : forme (rectangle, mur, triangle, disque, volume, cylindre, longueur, périmètre, unités,
  quantité directe justifiée) × nombre − déductions (surface ou longueur) = théorique ; × (1 + perte) =
  avec pertes ; retenue = forcée ou avec pertes ; composants = Σ retenue × ratio, arrondis au
  conditionnement supérieur sur le total du projet. Unité de la forme et de l'ouvrage vérifiée.
- **Référentiel** : 10 formes, 13 familles, 47 ouvrages avec composants, ratios indicatifs QME.
- **Limites** : pas de lecture de plan ni de BIM ; ratios d'ossature calculés pour 2,50 m de hauteur.

### T70 · WattBudget (`WTT`, `templates/watt-budget/`)
- **Fonctions** : appareils (catalogue ou personnalisés), tarif base ou HP/HC, abonnement, aperçu
  jour / mois / an, principaux postes (Pareto), catégories, fiabilité (estimée, étiquette, mesurée),
  part de la facture expliquée, comparaison, remplacement, scénarios (rapides ou libres), CSV, JSON.
- **Calculs** : durée : W × h/j × j/sem × 365/7 × mois/12 ; cycles : kWh × cycles/sem × 365/7 × mois/12 ;
  étiquette : kWh/an ; mesure : kWh ÷ jours × 365 × mois/12 ; + veille W × h × 365 ; × quantité.
  Coût = kWh × prix du kWh (HC pour les appareils programmés). Retour = prix d'achat ÷ économie annuelle.
- **Référentiel** : 7 catégories, 47 appareils (ordres de grandeur sans source officielle), 5 actions.
- **Limites** : aucun tarif fourni ; tarif de la démo marqué fictif ; pas de lien avec un compteur.

### T71 · ContrôleRéception (`RCP`, `templates/controle-reception/`)
- **Fonctions** : réceptions numérotées, lignes (liste collée possible), tolérances, points de contrôle
  par famille, mesures avec plage, constats et photos, réserves et levées, statut calculé, décision
  motivée, clôture, PV imprimable, synthèse par fournisseur, référentiel modifiable, CSV ×3, JSON.
- **Règles** : en attente (ligne non comptée ou point sans réponse) > non conforme (point critique non
  conforme, constat critique non levé) > avec réserves (écart hors tolérance, refus, point non
  critique, constat ou réserve non levé) > conforme. Décision différente : motif obligatoire.
- **Référentiel** : 11 familles, 3 points communs, gravités et types de constat ; sans valeur
  réglementaire ni de certification (dit dans l'application et le PV).
- **Limites** : photos réduites (≈ 640 px) et comptées dans les 880 Ko ; au-delà, ajout refusé.

### T72 · PlanB (`PNB`, `templates/plan-b/`)
- **Fonctions** : foyer (profils, besoins spécifiques, animaux), objectif en jours, réserves par lots
  (péremption, emplacement), autonomie, niveau de préparation, manques, 6 situations (avant à cocher,
  pendant, après, actions personnelles, point de rassemblement), contacts et numéros d'urgence, plan
  familial imprimable, CSV (réserves, courses), JSON.
- **Calculs** : besoin selon la règle de l'article (par personne et par jour, par personne, par foyer,
  par bébé, par animal, par personne concernée) ; autonomie = stock non périmé ÷ besoin quotidien ;
  niveau = 50 % réserves (couverture plafonnée) + 40 % actions « avant » + 10 % contact.
- **Référentiel** : 27 articles, 6 situations, 5 besoins spécifiques, daté du 13/11/2026, prudent,
  non officiel, modifiable ; renvoi systématique aux consignes des autorités et au 112.

### T73 · MémoFamille (`MMF`, `templates/memo-famille/`)
- **Fonctions** : 11 catégories de fiches à champs prédéfinis, recherche sans accents, fiches privées,
  revue annuelle, dossier imprimable composé fiche par fiche, CSV et JSON de la sélection, JSON complet.
- **Sécurité** : aucun champ de secret ; saisie refusée si elle contient un numéro de carte (préfixe de
  réseau + Luhn), un IBAN (modulo 97), un numéro de sécurité sociale (clé), ou un mot annonçant un code
  (mot de passe, PIN, cryptogramme, digicode, code d'alarme…) ; toute sauvegarde importée ou reçue est
  nettoyée avant d'être gardée. Hébergement en ligne sans chiffrement de bout en bout, dit clairement.
- **Limites** : la détection vise les formats connus ; un secret écrit autrement n'est pas reconnu.

### T74 · FêteBudget (`FTB`, `templates/fete-budget/`)
- **Fonctions** : événement, invités (liste collée, réponses), budget global ou par personne, dépenses
  prévues / réelles, scénarios comparés, quantités estimées et coûts, ajout aux dépenses, participants et
  virements, préparation datée, synthèse imprimable, CSV ×3, JSON.
- **Calculs** : besoin = ratio de la formule × (adultes + enfants × coefficient) [× durée] arrondi au
  conditionnement ; retenu = réel sinon prévu ; reste = budget − retenu ; quotes-parts au centime (reste
  d'arrondi réparti), virements minimaux (plus gros débiteur vers plus gros créancier).
- **Référentiel** : 7 types, 6 formules, 17 articles indicatifs, 8 catégories, 12 tâches.

### T75 · Ludothèque (`JDS`, `templates/ludotheque/`)
- **Fonctions** : collection, extensions, emplacement, prêts, journal des parties, statistiques, à
  ressortir, « Que jouer ? », liste à découvrir, catalogue d'exemple, CSV ×2, JSON.
- **Calculs** : filtres stricts (possédé, non prêté, joueurs, temps + 15 %, âge, complexité) ; score =
  50 + 15/catégorie + 10/mécanique + 4 × note + 20 si non joué depuis 90 j − 20 si joué sous 7 j + 10 si
  la durée occupe la moitié du temps ; à ressortir : possédé depuis 6 mois sans partie sur 12 mois.
- **Référentiel** : 12 catégories, 26 mécaniques génériques, 22 jeux inventés.

### T76 · TournoiFacile (`TRN`, `templates/tournoi/`)
- **Fonctions** : préparation (participants, têtes de série, tirage), 4 formats, rencontres, saisie et
  correction des scores, forfaits, départages, tableau en arbre, poules, classements, podium, planning
  sur plusieurs terrains, prochaines rencontres, impression, CSV ×2, JSON.
- **Moteur** : seuls les résultats sont stockés, les participants se déduisent des sources ; exempts =
  côté vide propagé ; têtes de série 1, P, P/2+1… ; poules en serpentin ; tableau final sans rencontre de
  la même poule au premier tour ; double élimination avec descentes alternées ; championnat par la
  méthode du cercle ; départage ordonné (confrontation directe en mini-championnat) ; planning glouton
  respectant terrains, durée, repos et dépendances.
- **Tests** : simulation complète de chaque format de 2 à 20 participants (invariants vérifiés).

### T77 · CaveManager (`CVM`, `templates/cave/`)
- **Fonctions** : inventaire par catégorie et emplacement, fiches, mouvements datés, fenêtres de
  consommation, alertes, suggestions, statistiques, règles de garde modifiables, CSV ×2, JSON.
- **Calculs** : stock = entrées − sorties (aucune date où il deviendrait négatif) ; fenêtre saisie, sinon
  millésime + règle de la catégorie ; valeur = déclarée, sinon prix moyen pondéré des achats, sinon prix
  de la fiche ; suggestions classées par urgence, apogée, stock et note.
- **Référentiel** : 7 catégories, règles de garde indicatives, 5 formats, conseils de conservation.

### Tests exécutés (13/11/2026)
- `npm test` : **540 tests, 0 échec** (dont 117 nouveaux : commun 7, metre 12, watt-budget 11,
  controle-reception 11, plan-b 10, memo-famille 10, fete-budget 10, ludotheque 9, tournoi 15, cave 11).
- Playwright (serveur local, scripts gardés hors dépôt) : **386 contrôles de bout en bout, 0 échec**,
  aucune erreur JavaScript : code faux et clé d'un autre produit refusés, premier lancement, saisies et
  erreurs de saisie, enregistrement, rechargement, second appareil, coupure réseau puis renvoi, conflit
  409, exports CSV et JSON, import valide et invalide, découverte, états vides, iPhone 13 et Pixel 7
  (largeur ≤ 390 px, fenêtre « Comme une application »), ordinateur 1280 px ; captures regardées.
- Pages du site : **54 contrôles, 0 échec** (catalogue ×9, kanban, page anglaise, connexion).

### Limitations connues
- Hors ligne testé sur la logique de cache (API coupée) ; le service worker ne s'enregistre qu'en
  HTTPS et n'a donc pas été testé en local : à vérifier après déploiement (mode avion sur téléphone).
- Stockage : 880 Ko par acheteur et par application (photos de ContrôleRéception surtout).
- Une seule personne à la fois par compte : deux appareils qui modifient en même temps déclenchent le
  conflit 409 (la dernière version du serveur est affichée, la dernière action est à refaire).
- Noms commerciaux non vérifiés à l'INPI ; communication (LinkedIn, Instagram, prospects) non préparée.

### Déploiement
1. Relire et fusionner la PR (feu vert de Quentin, déploiement Netlify facturé).
2. Rien à configurer côté Netlify : `TEMPLATES_SECRET` et le stockage existent déjà ; les en-têtes
   `noindex` et `sw.js` des 9 applications et de `templates/commun/` sont dans `netlify.toml`.
3. Après déploiement : pages en 200, `X-Robots-Tag: noindex` sur `/templates/<slug>/`, API en 401 pour
   un code inventé, démo sur téléphone, mode avion après une première ouverture.
4. Mise en vente, application par application : fiche Gumroad (`docs/templates/communication/
   gumroad-a-creer.json`), activation de la clé de licence par Quentin, identifiant reporté dans
   `PRODUITS` (`gumroad`), page catalogue passée au prix et au bouton Acheter.
