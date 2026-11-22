# Fiches Gumroad des packs

Généré par `node outils/packs/fiches-gumroad.mjs` (même source que le site). Ordre : les packs dont il manque le moins de templates en vente d’abord.

Réglages à faire à la main dans l’éditeur Gumroad, pour chaque pack : deux versions (« Pack » et « Pack évolutif », prix ci-dessous), bloc **License key** dans le contenu (le serveur lit la version achetée et la date d’achat), puis identifiant du produit reporté dans `PACKS` (`gumroad`, `permalien`) de `netlify/lib/packs.mjs` et `node outils/packs/generer.mjs`. Un pack n’est publié que lorsque tous ses templates sont en vente.

| Pack | Permalien | Pack | Pack évolutif | Templates en vente | Manquent |
|---|---|---|---|---|---|
| Pack Bien démarrer l’année | pack-bien-demarrer | 39 € | 49 € | 3/3 | — |
| Pack Budget perso et famille | pack-budget-perso-famille | 47 € | 59 € | 5/5 | — |
| Pack Chef de projet BTP | pack-chef-de-projet-btp | 192 € | 240 € | 8/8 | — |
| Pack Commerçant et artisan | pack-commercant-artisan | 95 € | 119 € | 5/5 | — |
| Pack Étudiant | pack-etudiant | 69 € | 87 € | 7/7 | — |
| Pack Exploitation et maintenance | pack-exploitation | 118 € | 148 € | 4/4 | — |
| Pack Forme | pack-forme | 58 € | 73 € | 5/5 | — |
| Pack Freelance : chiffrer, facturer, encaisser | pack-freelance-gestion | 118 € | 148 € | 7/7 | — |
| Pack Freelance : trouver ses clients | pack-freelance-clients | 97 € | 122 € | 7/7 | — |
| Pack Ma voiture | pack-voiture | 28 € | 37 € | 3/3 | — |
| Pack Mariage et installation à deux | pack-mariage-installation | 72 € | 90 € | 6/6 | — |
| Pack Moyens généraux | pack-moyens-generaux | 194 € | 243 € | 9/9 | — |
| Pack Petite entreprise | pack-petite-entreprise | 164 € | 205 € | 9/9 | — |
| Pack Productivité perso | pack-productivite | 54 € | 68 € | 5/5 | — |
| Pack Voyage | pack-voyage | 25 € | 34 € | 2/2 | — |
| Pack Cuisine | pack-cuisine | 22 € | 31 € | 1/2 | Garde-manger et dates de péremption |
| Pack Reprendre la main sur son argent | pack-argent | 96 € | 120 € | 8/9 | Remboursements santé |
| Pack Associations et clubs | pack-associations | 164 € | 205 € | 3/7 | Pilote événementiel, Subventions, Bénévoles et planning des créneaux, Assemblée générale et vie statutaire |
| Pack Enseignant et formateur | pack-enseignant | 83 € | 104 € | 0/4 | Progression pédagogique, Banque de questions et quiz, Gestion de classe, Emploi du temps d'établissement |
| Pack Maison et famille | pack-famille | 57 € | 72 € | 2/6 | Entretien de la maison, Garde-manger et dates de péremption, Suivi du bébé, Suivi d'un animal de compagnie |
| Pack Propriétaire | pack-proprietaire | 131 € | 164 € | 5/9 | Location saisonnière, Entretien de la maison, Gestion locative, Charges et AG de copropriété |
