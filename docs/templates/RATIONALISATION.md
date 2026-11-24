# Rationalisation du catalogue (proposition du 22/11/2026, à valider par Quentin)

Demande de Quentin (22/11/2026) : chaque template appartient à au moins un pack, aucun doublon, des templates
génériques à plusieurs usages plutôt que des variantes, un site cohérent, et une réflexion sur un site en deux
parties, « pour les pros » et « pour la vie perso ».

État au 22/11 : 97 templates (77 en vente, 20 prêts), 21 packs actifs (11 en vente). **Ventes depuis le 1er
novembre : 2** (Gestionnaire de tâches, et Compte rendu offert). Fusionner ou retirer ne lèse donc personne ; les
produits Gumroad fusionnés sont renommés plutôt que supprimés (licences éventuelles toujours valables).

## 1. Fusions de templates (doublons de fonction)

| Fusion | Templates d'origine | Nouveau template générique | Pourquoi |
|---|---|---|---|
| F1 | Organisateur de mariage (MRG, perso, 29 €, en vente) · Pilote événementiel (EVT, pro, 49 €, prêt) · Séminaire / offsite (SMN, pro, 35 €, prêt) | **Organisateur d'événement** : modèles Mariage, Séminaire ou offsite, Événement d'entreprise ou d'association, Fête de famille. Plusieurs événements de front, rétroplanning, budget, prestataires, invités et réponses, plan de table, transports et chambres, conducteur du jour J | Même moteur (fiche T51) ; même phrase de présentation pour MRG et EVT |
| F2 | CRM freelance (CRM, 25 €) · Pipeline de prospection B2B (PRS, 25 €) | **CRM et prospection** : prospects par étape, clients suivis, prochaine action datée, relances selon une cadence | Relances datées dans les deux, vendus dans le même pack |
| F3 | Candidatures études, stages, alternance (CAN, 12 €) · Suivi des appels d'offres et candidatures (CND, 15 €) | **Suivi de candidatures** : modèles Études et stages, Emploi, Appels d'offres et plateformes | Même structure : dossier, pièces, date limite, réponse |
| F4 | Maintenance préventive (GMA, 39 €) · Pilotage de parcs multi-sites (PRK, 49 €) | **Maintenance préventive**, avec une option multi-sites (sites, coût par site) | Préventif, pannes et coûts dans les deux |

À étudier, sans fusion proposée : Calculateur de TJM (12 €) et Coût de revient (25 €) se recouvrent en partie (le TJM
est une porte d'entrée bon marché) ; Entretien de la maison / Maintenance, Abonnements / Contrats fournisseurs,
Carnet de voiture / Flotte ont le même moteur mais des publics opposés (vie perso / pro) : séparés par le découpage
du site plutôt que fusionnés.

Mise en œuvre d'une fusion : nouvelle version de l'application la plus complète, reprise des fonctions de l'autre,
données existantes lues sans perte, ancienne adresse redirigée (301), fiche Gumroad conservée et renommée (l'autre
dépubliée), packs et publications mis à jour. Effort : F1 lourd (trois applications de 1 300 à 1 600 lignes) ; F2,
F3, F4 moyens.

## 2. Packs : un template payant au moins dans un pack, aucun pack contenu dans un autre

Après fusions (Secret Santa, gratuit, hors packs). **Gras** = changement.

### Vie perso

| Pack | Contenu proposé | Changement |
|---|---|---|
| Budget perso et famille | Mon Budget, Gestion Dépenses Communes, Abonnements, Épargne, Dettes | inchangé (en vente) |
| **Papiers et décisions d'argent** (ex-Reprendre la main sur son argent) | Temps de vie, Inventaire valorisé, Papiers du foyer, Remboursements santé, Capacité d'emprunt | ne recopie plus 4 templates du pack Budget |
| **Vie à deux** (ex-Mariage et installation à deux) | **Organisateur d'événement**, Gestion Dépenses Communes, Mon Budget, Déménagement, Voyage, Cadeaux et remerciements | mariage remplacé par le générique |
| Maison et famille | Mon Budget, Entretien, Repas, Garde-manger, Bébé, Animal, **Calendrier du potager** | potager ajouté |
| Propriétaire | inchangé (9 templates) | — |
| Productivité perso | Tâches, Planner, Habitudes, Tableau annuel, Revue hebdo | inchangé |
| Étudiant | Révision, Planner, Habitudes, Lecture, Notes, **Suivi de candidatures**, Mémoire | candidatures génériques |
| Forme | inchangé | — |
| Ma voiture | inchangé | — |
| **Voyage, Bien démarrer l'année, Cuisine** | entièrement contenus dans Vie à deux, Productivité perso, Maison et famille | **à retirer** (ou garder comme mini-packs d'appel : décision) |

### Pros

| Pack | Contenu proposé | Changement |
|---|---|---|
| Freelance : chiffrer, facturer, encaisser | inchangé | — |
| Freelance : trouver ses clients | Appel découverte, **CRM et prospection**, Propositions, Kit références, Calendrier éditorial, **Suivi de candidatures** | fusions F2, F3 |
| Chef de projet BTP | inchangé | — |
| Petite entreprise | 9 actuels + **Matrice compétences et formations** | compétences ajoutées |
| Moyens généraux | 9 actuels + **Organisateur d'événement** (séminaires) | événement ajouté |
| Associations et clubs | Inscriptions, **Organisateur d'événement**, Trésorerie, Compétition, Subventions, Bénévoles, AG | générique |
| **Écoles et formateurs** (ex-Enseignant et formateur) | Progression, Quiz, Classe, Emploi du temps, **Gestion d'auto-école** | auto-école intégrée |
| Exploitation et maintenance | **Maintenance (multi-sites), Vérifications, Non-conformités, Stocks** | ne recopie plus Moyens généraux |
| Commerçant et artisan | inchangé | — |

Résultat : plus aucun template payant hors pack (auto-école, compétences, potager, séminaire y entrent), plus aucun
pack inclus dans un autre, recouvrements limités à des templates transversaux (Mon Budget, Trésorerie, Habitudes).

## 3. Site en deux parties : « Pour votre activité » et « Pour la vie perso »

Constat : un seul catalogue de 97 outils mêle chantier, RH, budget et bébé ; les thèmes actuels (Argent, Organisation
et études, Indépendants…) ne disent pas à qui s'adresse l'outil. Les données le savent déjà (`pour: 'pro' | 'perso'`).

Proposition :
- **Accueil** : deux portes égales, « Pour votre activité » et « Pour la vie perso », et le sur mesure en dessous (il
  reste l'offre principale pour les pros).
- **Deux catalogues** : `/pro/` et `/perso/` (thèmes propres à chacun, packs de la partie, exemples et preuves
  adaptés), `/templates/` gardé comme index complet ; menu « Pros · Vie perso · Packs · Sur mesure ».
- **Packs** classés par partie (`pour` sur chaque pack, comme les templates).
- **Templates génériques** (Organisateur d'événement, Tâches, Planner, Suivi de candidatures) présents dans les deux
  parties, avec une phrase par public (`phrase.pro`, `phrase.perso`).
- **Constantes** : vouvoiement sur tout le site, essai gratuit 14 jours partout (étendu aux pros le 21/11), achat
  unique ; prix de 9 à 29 € côté perso, de 12 à 49 € côté pro.
- Référencement : chaque partie a sa page et ses requêtes ; `/templates/` et les pages catalogue gardent leurs
  adresses (aucune perte).

## 4. Étapes proposées

1. **Packs et site, sans développement** (1 session) : recomposition des packs, retrait des packs inclus, phrases
   distinctes, champ `pour` des packs, catalogues `/pro/` et `/perso/`, menu et accueil.
2. **Fusions F2, F3, F4** (1 session chacune) puis **F1** (2 à 3 sessions), chacune publiée seule.
3. **Fiches Gumroad** des packs complets (au plus 10 créations par jour), après recomposition.
4. Publications : planning revu pour les produits fusionnés (aucune publication d'un produit retiré).
   **Fait le 24/11/2026** : LI-89, LI-94, LI-127, LI-136, IG-18, IG-23, IG-59, IG-82, IG-91 et YT-34 annulés ;
   LI-92 et IG-21 (mariage) réécrits pour l'Organisateur d'événement à 39 €. Fiches Gumroad PRS, CND, PRK dépubliées,
   EVT et CAN renommées.
