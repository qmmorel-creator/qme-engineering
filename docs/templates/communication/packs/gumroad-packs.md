# Fiches Gumroad des packs

Généré par `node outils/packs/fiches-gumroad.mjs` (même source que le site). Ordre : les packs dont il manque le moins de templates en vente d’abord.

Réglages à faire à la main dans l’éditeur Gumroad, pour chaque pack : deux versions (« Pack » et « Pack évolutif », prix ci-dessous), bloc **License key** dans le contenu (le serveur lit la version achetée et la date d’achat), puis identifiant du produit reporté dans `PACKS` (`gumroad`, `permalien`) de `netlify/lib/packs.mjs` et `node outils/packs/generer.mjs`. Un pack n’est publié que lorsque tous ses templates sont en vente.

| Pack | Permalien | Pack | Pack évolutif | Templates en vente | Manquent |
|---|---|---|---|---|---|
| Pack Voyage | pack-voyage | 25 € | 34 € | 1/2 | Planificateur de voyage |
| Pack Associations et clubs | pack-associations | 124 € | 155 € | 2/4 | Pilote événementiel, Gestion de compétition sportive |
| Pack Commerçant et artisan | pack-commercant-artisan | 95 € | 119 € | 3/5 | Stocks et inventaire, Suivi de TVA |
| Pack Enseignant et formateur | pack-enseignant | 63 € | 79 € | 0/2 | Gestion de classe, Emploi du temps d'établissement |
| Pack Forme | pack-forme | 50 € | 63 € | 2/4 | Repas de la semaine et liste de courses, Carnet de musculation et cross-training |
| Pack Freelance : chiffrer, facturer, encaisser | pack-freelance-gestion | 118 € | 148 € | 5/7 | Relance des impayés, Suivi du temps et rentabilité par mission |
| Pack Ma voiture | pack-voiture | 22 € | 31 € | 0/2 | Simulateur leasing ou achat, Carnet de voiture |
| Pack Étudiant | pack-etudiant | 49 € | 62 € | 2/5 | Planner horaire, Suivi de lecture, Notes et moyennes |
| Pack Mariage et installation à deux | pack-mariage-installation | 72 € | 90 € | 3/6 | Déménagement, Planificateur de voyage, Cadeaux reçus et remerciements |
| Pack Productivité perso | pack-productivite | 54 € | 68 € | 2/5 | Planner horaire, Tableau de bord annuel et roue de vie, Revue hebdomadaire et journal de bord |
| Pack Chef de projet BTP | pack-chef-de-projet-btp | 192 € | 240 € | 4/8 | Levée de réserves, Suivi de chantier par lot, Registre du DOE, Conformité des sous-traitants |
| Pack Exploitation et maintenance | pack-exploitation | 118 € | 148 € | 0/4 | Maintenance préventive, Vérifications réglementaires, Pilotage de parcs multi-sites, Contrats fournisseurs et échéances |
| Pack Famille | pack-famille | 48 € | 60 € | 1/5 | Entretien de la maison, Repas de la semaine et liste de courses, Garde-manger et dates de péremption, Suivi d'un animal de compagnie |
| Pack Propriétaire | pack-proprietaire | 94 € | 118 € | 2/6 | Location saisonnière, Entretien de la maison, Gestion locative, Capacité d'emprunt et comparateur de prêts |
| Pack Freelance : trouver ses clients | pack-freelance-clients | 97 € | 122 € | 0/7 | Préparateur d'appel découverte, Pipeline de prospection B2B, CRM freelance, Propositions commerciales, Kit références et plaquette, Calendrier éditorial, Suivi des appels d'offres et candidatures |
| Pack Petite entreprise | pack-petite-entreprise | 164 € | 205 € | 2/9 | Suivi des congés et absences, Notes de frais et indemnités kilométriques, Onboarding et offboarding salarié, Tableau de bord de pilotage PME, Planning d'équipe et staffing, Entretiens annuels et professionnels, Document unique d'évaluation des risques |
| Pack Reprendre la main sur son argent | pack-argent | 98 € | 123 € | 2/9 | Remboursement de dettes, Temps de vie, Inventaire valorisé, Objectif d'épargne et fonds d'urgence, Papiers du foyer, Remboursements santé, Capacité d'emprunt et comparateur de prêts |
| Pack Moyens généraux | pack-moyens-generaux | 194 € | 243 € | 0/9 | Gestion de parc informatique, Gestion de flotte de véhicules, Onboarding et offboarding salarié, Maintenance préventive, Vérifications réglementaires, Réservation de salles et bureaux, Pilotage d'une journée de bascule, Contrats fournisseurs et échéances, Demandes d'achat et fournitures |
