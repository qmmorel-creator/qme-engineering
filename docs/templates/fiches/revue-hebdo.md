# T87 · Revue hebdomadaire et journal de bord

Slug `revue-hebdo`, préfixe `RVH`, prix 12 €, permalien Gumroad prévu `revue-hebdomadaire`. Usage `perso`,
catalogue thème « Organisation et études » (avec le planner horaire). Proposition validée par Quentin le
14/11/2026 ; cadrage délégué (fiche rédigée et appliquée sans validation intermédiaire). Pack visé :
« Productivité perso » (PPR), avec T03 tâches, T30 planner, T08 habitudes. Marques de risque : **santé**
(humeur notée : repère personnel, aucun conseil médical), **confidentiel** (journal personnel ; démo fictive).

## Pour qui

- **Cadres et chefs de projet** : semaines saturées de réunions, priorités qui se perdent, points à préparer.
- **Indépendants** : personne pour leur demander des comptes, plusieurs clients en parallèle.
- **Managers** : garder trace de la semaine, préparer les points d'équipe.

Promesse : « Ta semaine, revue en 20 minutes. » Un rituel du vendredi (jour réglable), court et régulier.

## Place dans le pack Productivité perso

T03 trie ce qui arrive, T30 le place dans la semaine, T08 ancre les routines, T87 donne le recul de la semaine
(le tableau de bord annuel, RDV, donne celui du trimestre). Aucune connexion automatique entre les outils (chacun garde sa
clé et ses données) : l'étape « Vider la tête » renvoie vers le gestionnaire de tâches, les 3 priorités se
placent dans le planner. Décision de cadrage : pas d'import de tâches ni d'agenda en V1.

## Écrans (4 onglets + revue, réglages)

- **Semaine** : bandeau de rappel (jour de revue, revue en attente, rattrapage), tuiles (série, semaines
  tenues, humeur moyenne sur 4 semaines, priorités tenues la semaine précédente), 3 priorités de la semaine
  (état en un geste : à faire → faite → en partie → pas faite), « À venir » sur 30 jours (et passé non coché),
  carte de la revue faite ou de la prochaine, journal des 7 jours modifiable sur place.
- **Journal** : un mois à la fois, jours groupés par semaine avec l'état de la revue, ligne et humeur
  modifiables sur place, méthode en deux phrases.
- **Historique** : revues de la plus récente à la plus ancienne (mot de la semaine, humeur, énergie, part des
  priorités tenues, extrait), recherche dans les revues et le journal (sans accents ni casse, mot surligné),
  lecture d'une revue (copier le texte, fichier .txt, modifier, supprimer), export de tout en texte.
- **Tendance** : tuiles (série, meilleure série, semaines tenues en %, humeur moyenne, nombre de revues),
  bande des 12 dernières semaines, courbe humeur et énergie (une seule échelle 1 à 5, 12 semaines, 8 sur
  téléphone), barres des priorités tenues, tableau des données, rappel sur l'humeur.
- **Revue guidée** (7 étapes + fin) : vider la tête (une idée par ligne) ; la semaine passée (priorités notées,
  journal relu et complétable) ; réussites et difficultés ; apprentissages ; 3 priorités pour la semaine
  suivante (reprise d'une priorité non terminée en un geste) ; rendez-vous et échéances ; énergie et humeur de
  1 à 5 avec libellés, mot de la semaine ; fin (résumé). À chaque étape, la question de la semaine (réponse
  facultative, « Autre question »). « Continuer plus tard » garde le brouillon ; une revue enregistrée se
  modifie.
- **Réglages** : prénom, jour de revue, questions (base cochée ou masquée, questions personnelles par étape),
  export texte, copie JSON et restauration, compte, « Sur téléphone ».

## Base intégrée (`donnees.js`, contenu original, rien ne se périme)

- 7 étapes avec titre et aide ; **55 questions de revue** rédigées pour QME (7 à 9 par étape) ;
- échelles d'humeur (Difficile, Bof, Correct, Bien, Très bien) et d'énergie (À plat … Pleine forme) ;
- repères de méthode (revue, journal, humeur : « repère personnel, pas une mesure de santé »).

Aucune base externe, aucune donnée datée, aucune règle légale.

## Mécanique (fonctions pures, `regles.js`, `window.RVH`, tests `outils/templates/revue-hebdo.test.mjs`)

1. **Semaines ISO** (lundi → dimanche, clé `AAAA-Www`, semaine 53 et changement d'année gérés).
2. **Rappel** : à partir du jour de revue, la semaine en cours est due (« jour » le jour même) ; avant ce jour,
   la semaine précédente non revue est « à rattraper » jusqu'à la veille du jour de revue, sauf si l'outil
   n'existait pas encore cette semaine-là ; sinon, date de la prochaine revue. Revue en avance possible.
3. **Priorités** : choisies à la revue de la semaine S pour S+1 (3 au plus) ; état faite / en partie / pas faite ;
   taux = (faites + ½ en partie) / priorités notées.
4. **Journal** : une ligne de 280 caractères au plus par jour, humeur 1 à 5 facultative ; ligne vide sans humeur
   effacée. **Humeur de la semaine** = moyenne des humeurs du journal, à défaut celle notée à la revue.
5. **Série** : semaines revues d'affilée, en partant de la semaine en cours si sa revue est faite, sinon de la
   précédente (la semaine en cours ne casse pas la série avant d'être passée). **Semaines tenues** : sur les 12
   dernières semaines écoulées, depuis la création de l'outil au plus.
6. **Repère bienveillant** : si les 3 dernières semaines notées ont une humeur de 2 ou moins, un bandeau doux
   invite à prendre soin de soi et à en parler à un proche ou à un professionnel de santé. Aucun diagnostic,
   aucun numéro d'urgence cité (donnée datée non sourcée).
7. **Questions** : rotation par numéro de semaine, étapes décalées entre elles, « Autre question » = suivante ;
   questions masquées retirées, questions personnelles ajoutées.
8. **Recherche** : revues (tous les champs, réponses aux questions) et journal, insensible aux accents.
9. **Export texte** : une revue (priorités et leur état, journal de la semaine, réussites…, rendez-vous ajoutés,
   notes) ou tout l'historique (.txt), journal des semaines sans revue en fin.

## Graphique (skill `dataviz`)

Une seule échelle (1 à 5) pour l'humeur et l'énergie : pas de double axe. Palette validée par
`validate_palette.js` le 14/11/2026 (`#2B5DA3`, `#D5732F` sur blanc : luminosité, chroma, séparation daltonisme
et vision normale, contraste : tout passe) ; énergie en pointillés en plus, légende et étiquettes de fin
écartées, infobulles au survol et au clavier, tableau des données. Bande des semaines : case cochée, hachurée
ou en pointillés, avec légende (jamais la couleur seule).

## Démo

« Alex », cadre fictif. Onze semaines relatives à aujourd'hui : revues le vendredi sauf une semaine sautée (série
cassée puis reprise), journal tenu environ 4 jours sur 5 avec humeur, priorités dans tous les états, rendez-vous
à venir et une échéance passée non cochée ; la revue de la semaine en cours reste à faire (rappel visible dès le
vendredi). Fournisseur, client (« Atelier Exemple ») et prénoms fictifs.

## Risques et avertissements

- **Santé** : humeur et énergie présentées partout comme repères personnels (application, page du site, fiche
  Gumroad, communication) ; aucun conseil médical, aucune promesse de bien-être ni de productivité chiffrée.
- **Confidentialité** : journal personnel synchronisé par clé (même stockage que les autres templates) ; rien
  n'est envoyé ailleurs ; export et suppression à la main par l'utilisateur.
- Pas de notification ni d'e-mail (rappel affiché à l'ouverture seulement) ; suggestion d'un événement récurrent
  dans l'agenda personnel.
