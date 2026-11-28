# Ouvertures et objets · vague 3 d'affiliation QME (validée par Quentin le 27/11/2026)

Pour chaque créateur des fichiers JSON qui te sont confiés, ajoute trois champs (sans toucher aux autres) :

1. `ouverture` : la PREMIÈRE PHRASE du mail, juste après « Bonjour, ». Règles :
   - vouvoiement (« Votre vidéo du 18/11… », « Dans votre série… »), une seule phrase, 120 à 230 caractères ;
   - factuelle et précise : elle reprend le fait daté du champ `accroche` (titre ou sujet de la vidéo, date au format JJ/MM),
     puis fait le lien, sans forcer, avec l'usage de l'outil du champ `demo` (organisation, budget, étapes, échéances…) ;
   - aucune flatterie (« super », « bravo », « j'adore », « votre talent », « inspirant »), aucun point d'exclamation,
     aucun emoji, pas de « je suis tombé sur », pas de taux ni d'argent ;
   - ne rien inventer au-delà de `accroche`, `pourquoi` et `nom` ; si l'accroche est faible, rester sobre et général sur
     le contenu de la chaîne ;
   - typographie française : guillemets « … » avec espaces insécables possibles, apostrophe droite ' acceptée ;
   - pour une agence (`niche: "agence"`), parler de l'agence à la 3e personne (« <Agence> se présente comme… »).
   - modèles validés : « Votre vidéo du 27/11 sur les évacuations, une semaine après les fondations faites à la main,
     montre une maison qui avance poste par poste, avec autant de dépenses et d'étapes à suivre. » ;
     « Votre vidéo du 23/11, « Qu'est-ce qu'on mange pendant 15 jours », part d'un retour de courses pour bâtir deux
     semaines de menus : c'est précisément la tâche que l'un de mes outils allège. »
2. `nomObjet` : le nom court du créateur tel qu'il se présente, pour l'objet « <nomObjet> × QME : un outil pour … »
   (ex. « Pierre et Apolline », « xtg Family », « Mme Céline », « The Fambase »). 28 caractères au plus. Pas de @.
3. `benefice` (facultatif) : la fin de l'objet après « un outil pour », adaptée à la niche, en minuscules,
   ex. « préparer votre tour du monde », « vos road trips en van », « piloter votre rénovation », « préparer votre
   marathon ». L'objet complet « <nomObjet> × QME : un outil pour <benefice> » doit faire 70 caractères au plus
   (sinon laisse `benefice` vide, un bénéfice par défaut sera pris). Pas de majuscule ni de point final. Pour une agence,
   ne mets pas de `benefice`.

Ne modifie pas les entrées qui ont déjà `ouverture` et `nomObjet`. N'envoie rien, n'écris ni dans Gmail ni dans Nexora.

Contrôle final (à faire) : `cd /home/user/qme-engineering && for i in $(seq 0 N); do node <dossier>/brouillon.mjs <fichier> $i > /dev/null || echo ERREUR $i; done`
(remplace N par le dernier index) : le générateur doit passer pour chaque entrée sans erreur.
Écris le JSON avec Node (JSON.stringify(a, null, 1)), jamais à la main, pour garder un fichier valide.
