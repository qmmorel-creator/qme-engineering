# Fiches Gumroad des packs

Généré par `node outils/packs/fiches-gumroad.mjs` (même source que le site). Ordre : les packs dont il manque le moins de templates en vente d’abord.

Réglages à faire à la main dans l’éditeur Gumroad, pour chaque pack : deux versions (« Pack » et « Pack évolutif », prix ci-dessous), bloc **License key** dans le contenu (le serveur lit la version achetée et la date d’achat), puis identifiant du produit reporté dans `PACKS` (`gumroad`, `permalien`) de `netlify/lib/packs.mjs` et `node outils/packs/generer.mjs`. Un pack n’est publié que lorsque tous ses templates sont en vente.

| Pack | Permalien | Pack | Pack évolutif | Templates en vente | Manquent |
|---|---|---|---|---|---|
| Pack Freelance : chiffrer, facturer, encaisser | pack-freelance-gestion | 118 € | 148 € | 6/7 | Suivi du temps et rentabilité par mission |
| Pack Voyage | pack-voyage | 25 € | 34 € | 1/2 | Planificateur de voyage |
| Pack Commerçant et artisan | pack-commercant-artisan | 95 € | 119 € | 3/5 | Stocks et inventaire, Suivi de TVA |
| Pack Ma voiture | pack-voiture | 22 € | 31 € | 0/2 | Simulateur leasing ou achat, Carnet de voiture |
| Pack Productivité perso | pack-productivite | 54 € | 68 € | 3/5 | Planner horaire, Revue hebdomadaire et journal de bord |
| Pack Chef de projet BTP | pack-chef-de-projet-btp | 192 € | 240 € | 5/8 | Suivi de chantier par lot, Registre du DOE, Conformité des sous-traitants |
| Pack Forme | pack-forme | 58 € | 73 € | 2/5 | Repas de la semaine et liste de courses, Carnet de musculation et cross-training, Plan d'entraînement course à pied |
| Pack Mariage et installation à deux | pack-mariage-installation | 72 € | 90 € | 3/6 | Déménagement, Planificateur de voyage, Cadeaux reçus et remerciements |
| Pack Enseignant et formateur | pack-enseignant | 83 € | 104 € | 0/4 | Progression pédagogique, Banque de questions et quiz, Gestion de classe, Emploi du temps d'établissement |
| Pack Exploitation et maintenance | pack-exploitation | 118 € | 148 € | 0/4 | Maintenance préventive, Vérifications réglementaires, Pilotage de parcs multi-sites, Contrats fournisseurs et échéances |
| Pack Associations et clubs | pack-associations | 164 € | 205 € | 2/7 | Pilote événementiel, Gestion de compétition sportive, Subventions, Bénévoles et planning des créneaux, Assemblée générale et vie statutaire |
| Pack Étudiant | pack-etudiant | 69 € | 87 € | 2/7 | Planner horaire, Suivi de lecture, Notes et moyennes, Candidatures études, stages, alternance, Planning de mémoire ou de thèse |
| Pack Famille | pack-famille | 57 € | 72 € | 1/6 | Entretien de la maison, Repas de la semaine et liste de courses, Garde-manger et dates de péremption, Suivi du bébé, Suivi d'un animal de compagnie |
| Pack Petite entreprise | pack-petite-entreprise | 164 € | 205 € | 4/9 | Suivi des congés et absences, Notes de frais et indemnités kilométriques, Onboarding et offboarding salarié, Tableau de bord de pilotage PME, Entretiens annuels et professionnels |
| Pack Propriétaire | pack-proprietaire | 131 € | 164 € | 4/9 | Location saisonnière, Entretien de la maison, Gestion locative, Capacité d'emprunt et comparateur de prêts, Charges et AG de copropriété |
| Pack Freelance : trouver ses clients | pack-freelance-clients | 97 € | 122 € | 1/7 | Préparateur d'appel découverte, Pipeline de prospection B2B, Propositions commerciales, Kit références et plaquette, Calendrier éditorial, Suivi des appels d'offres et candidatures |
| Pack Reprendre la main sur son argent | pack-argent | 98 € | 123 € | 2/9 | Remboursement de dettes, Temps de vie, Inventaire valorisé, Objectif d'épargne et fonds d'urgence, Papiers du foyer, Remboursements santé, Capacité d'emprunt et comparateur de prêts |
| Pack Moyens généraux | pack-moyens-generaux | 194 € | 243 € | 0/9 | Gestion de parc informatique, Gestion de flotte de véhicules, Onboarding et offboarding salarié, Maintenance préventive, Vérifications réglementaires, Réservation de salles et bureaux, Pilotage d'une journée de bascule, Contrats fournisseurs et échéances, Demandes d'achat et fournitures |
