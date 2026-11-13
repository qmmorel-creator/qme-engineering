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
