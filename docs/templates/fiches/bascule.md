# T33 · Pilotage d'une journée de bascule

Slug `bascule`, préfixe `BSC` (clés locales `qme-bsc-*`, règles `window.BSC`), prix prévu 29 € (**à confirmer
par Quentin**), permalien Gumroad prévu `pilotage-bascule`, catégorie Gumroad `business-and-money` (à vérifier),
taille M, priorité P2. Catalogue : `data-pour="pro"`, thème « Projets et chantiers » (`projets-et-chantiers`,
`--c:var(--bleu)`). Origine : backlog de Quentin n° 07 (12/11/2026). Marque de risque : **confidentiel**
(inspiré d'un artefact professionnel « tableau de bascule » : mécanique seulement, aucun contenu repris ;
exemples fictifs informatique, bureaux, commerce, production, logistique). Fiche rédigée le 14/11/2026.
Aucune marque (logiciel, hébergeur, enseigne), aucune automatisation ni lien externe.

## Pour qui

Responsables production, IT et logistique, chefs de projet et responsables de site qui préparent puis pilotent
**une journée (ou une nuit) de bascule** : migration informatique, déménagement de bureaux, ouverture d'un
site, mise en service d'un équipement, changement d'entrepôt. Aujourd'hui : un tableur imprimé ou partagé,
des heures recalculées à la main quand une étape dérape, des décisions go/no-go prises à l'impression du
moment, un plan de retour arrière qui n'a pas d'heure limite, des incidents notés dans une messagerie.
Distinct du **planning Gantt** (projet de plusieurs semaines, jours ouvrés) : ici l'unité est la minute,
sur une fenêtre de quelques heures, et le réel compte autant que le prévu.

## Promesse

Ta bascule, minute par minute : le déroulé horaire avec ses responsables, des go/no-go sur critères, un plan
de retour arrière avec son heure limite, le retard recalculé à chaque étape notée et un journal d'incidents
horodaté, lisibles sur téléphone.

## Écrans (5 onglets + réglages)

1. **En direct** (lisible sur téléphone) : statut de la bascule ; tuiles heure (ou fin réelle), retard cumulé
   (fin estimée et prévue), marge avant la fin de fenêtre, limite de décision de retour arrière (temps
   restant) ou avancement ; barre d'avancement ; **frise** prévu / réel ou estimé par phase avec repères
   « maintenant », « limite retour », « fin de fenêtre » (infobulle, tableau accessible) ; étape(s) en cours
   avec « Terminé » et « Bloqué » (ou prochaine étape avec « Démarrer ») ; 4 étapes à suivre avec heure
   estimée ; prochaine décision go/no-go (critères cochés, « Décider ») ; alertes ; incidents ouverts avec
   « Résolu » ; « Lancer le retour arrière ». En préparation : compte à rebours et points à préparer. Terminée :
   bilan (étapes plus longues que prévu, incidents, « Dupliquer »).
2. **Déroulé** : résumé (début, fin prévue, fin estimée, écart, fenêtre) ; étapes par phase (préparation,
   arrêt, bascule, vérifications, reprise) avec heure prévue et heure réelle ou estimée, durée, responsable,
   dépendances, « pas avant », critères, note, statut, écart à la fin, bouton d'action ; section **Retour
   arrière** (durée du plan, limite de décision, lancement) ; imprimer, CSV, ajouter une étape.
3. **Journal** : incidents ouverts, tous les incidents, **chronologie** (départs, fins, décisions GO/NO-GO,
   incidents, résolutions, retour arrière) ; point de situation ; nouvel incident.
4. **Équipe** : annuaire par rôle (nom ou « à nommer », organisation, « où le trouver le jour J »), étapes de
   chacun avec heure ; étapes sans responsable ; imprimer « qui fait quoi » ; rappel RGPD.
5. **Bascules** : cartes (statut, fenêtre, avancement, fin, écart) ; ouvrir, modifier, dupliquer, archiver ;
   archivées à part ; 5 séquences types avec « Partir de ce modèle ».
6. **Réglages** : seuils d'alerte (retard toléré, décision proche, avant la limite de retour) ; export CSV
   et impression du déroulé ; sauvegarde JSON ; compte ; « Sur téléphone » ; données personnelles ; à propos.

Saisies (modales) : bascule (séquence de départ, nom, début, fin de fenêtre, limite de retour arrière
facultative, lieu, objectif) ; étape (titre, phase, durée « 45 / 1h30 / 2h », type étape / go/no-go / point
d'arrêt, critères, responsable, « commence après » l'étape précédente / le début / des étapes précises,
pas avant, note, statut et heures réelles, monter / descendre) ; décision go/no-go (critères à cocher,
recommandation, GO / NO-GO, lancer le retour arrière, décideur, heure, commentaire) ; étape bloquée (cause,
incident bloquant automatique) ; incident (heure, étape, gravité mineur / majeur / bloquant, description,
action, suivi par, résolu à) ; membre ; point de situation (texte à copier) ; duplication (nom, début,
reprise des durées réelles) ; lancement du retour arrière.

Premier lancement en 2 étapes : présentation et 4 conseils ; puis la séquence de départ, le nom, le jour,
l'heure de début et la fin de fenêtre (proposées selon le modèle).

## Base intégrée (`templates/bascule/donnees.js`)

- **6 phases** dont « Retour arrière (plan de repli) » ; **9 rôles types** (pilote, décideur go/no-go,
  responsable technique, référent métier, responsable production, logistique, sécurité et accès, support,
  communication interne) ; **3 gravités** d'incident.
- **5 séquences types**, rédigées pour le produit, génériques et fictives, chacune avec phases, durées,
  rôles, dépendances parallèles, go/no-go à critères, points d'arrêt et plan de retour arrière :
  migration informatique de nuit (18 étapes, 2 go/no-go, repli en 6 étapes, fenêtre 12 h) ; déménagement de
  bureaux (14, 2, 3, 12 h) ; ouverture d'un site (9, 1, 3, 3 h) ; mise en service d'un équipement de
  production (13, 2, 3, 14 h) ; changement d'entrepôt (11, 2, 3, 16 h). Plus un déroulé vierge.
- 4 conseils. Aucune donnée datée, aucun nom de logiciel, d'hébergeur ou d'enseigne.

## Calculs (règles pures, `templates/bascule/regles.js`, `window.BSC`)

- Heures locales « AAAA-MM-JJTHH:MM », calcul en minutes (bascules de nuit, passage de minuit). Saisie
  d'une heure « HH:MM » rattachée au jour le plus proche ; durées « 45 », « 1h30 », « 1:05 », « 2 h ».
- **Dépendances** : par défaut l'étape précédente du même groupe (principal ou repli) ; « le début » ; ou
  une liste d'étapes (parallèle). Boucle refusée à la saisie, cassée au calcul ; une étape supprimée
  transmet ses prédécesseurs. « Pas avant » = heure plancher.
- **Prévu** : chaque étape démarre à la fin de ses prédécesseurs (ou au plancher), dure sa durée.
- **Estimé** : faite = heures réelles (début déduit de la fin s'il manque) ; en cours = début réel, fin =
  max(début + durée, maintenant) ; sautée = durée nulle ; à faire ou bloquée = rien avant maintenant dès
  que la bascule est lancée (début atteint ou une étape commencée). **Retard cumulé** = fin estimée − fin
  prévue ; écart par étape à la fin ; **marge** = fin de fenêtre − fin estimée.
- **Plan de retour arrière** : durée = chemin le plus long de ses étapes ; **limite de décision** = fin de
  fenêtre − durée du plan (ou saisie) ; horaires du repli calculés depuis la limite, puis depuis l'heure
  de lancement ; une fois lancé, le repli devient le déroulé courant (statut « retour arrière en cours »,
  puis « effectué »).
- **Statuts** : en préparation, en cours, terminée, retour arrière en cours, retour arrière effectué.
- **Alertes** (rouge, jaune, à préparer) : étape bloquée, incident bloquant ouvert, fin estimée après la fin
  de fenêtre, limite de retour proche ou dépassée, étape qui dépasse sa durée + tolérance, incident majeur
  ouvert, go/no-go proche avec critères non cochés, retard au-delà de la tolérance ; en préparation : étapes
  sans responsable, go/no-go sans critère, pas de plan de repli, pas de fin de fenêtre, déroulé plus long que
  la fenêtre.
- **Point de situation** (texte), **chronologie**, **bilan** (durées réelles − prévues), **duplication**
  (statuts remis à zéro, horaires décalés, durées réelles reprises au choix), **CSV** (point-virgule, BOM,
  formules neutralisées), normalisation tolérante, suppression d'une bascule ou d'un membre.
- 15 tests `node --test` dans `outils/templates/bascule.test.mjs`.

## Sources

Aucune base externe : séquences, durées, critères et rôles rédigés pour le produit à partir de pratiques
courantes de conduite du changement (exemples génériques). Aucune règle officielle, aucune donnée datée.
L'artefact d'origine (tableau de bascule) n'a servi que d'idée de mécanique ; rien n'en est repris.

## Données datées

Aucune.

## Risques

- **Responsabilité** : outil d'aide au pilotage ; les décisions restent celles des personnes désignées et
  les procédures et règles de sécurité de l'acheteur priment (avertissement en pied de chaque vue, réglages,
  page catalogue, fiche Gumroad).
- **RGPD** : noms des membres de l'équipe (tiers) ; aucune coordonnée demandée, rappel dans l'onglet Équipe
  et les Réglages (n'enregistrer que le nécessaire, informer, effacer après la bascule).
- **Confidentiel** : démo et captures entièrement fictives (prénoms et initiales inventés, aucune entreprise).
- **Usage à plusieurs** : un seul accès partagé sur plusieurs appareils (dernier enregistrement gagnant,
  conflit 409 signalé) ; pas de rôles ni de lecture seule : à dire dans la FAQ (fait) ; une vraie version
  multi-utilisateurs relèverait du sur mesure.
- Concurrence : tableurs, logiciels de gestion de projet génériques ; se distinguer par le recalcul en
  direct, la limite de retour arrière calculée, les go/no-go à critères et la vue téléphone.

## Points à valider par Quentin

- Prix 29 € et nom « Pilotage d'une journée de bascule » ; permalien `pilotage-bascule` ; catégorie Gumroad.
- Les 5 séquences types (contenu générique, durées indicatives) et le libellé « point d'arrêt ».
- Le choix d'un accès unique partagé (pas de rôles) pour une équipe.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/voiture/` (connexion avec `produit: 'BSC'`, synchronisation et 409, démo `?demo`
  non mémorisée, modales, toast Annuler, export / import JSON, service worker `bascule-20261114`, fenêtre
  « Comme une application » avec la clé `qme-bsc-ecran-accueil`, bandeau « Bientôt en vente » vers
  `/catalogue/bascule/`). Bascule affichée retenue localement (`qme-bsc-courante`).
- Démo relative à l'heure d'ouverture, simulée avec les vraies règles (`planifier`) : migration **en cours**
  depuis 3 h 25 (30 min de retard, import en cours, incident majeur ouvert, go/no-go final à venir) ;
  déménagement **en préparation** le samedi suivant (membre à nommer, étape sans responsable) ;
  **répétition** il y a 7 jours terminée par un NO-GO et un **retour arrière** exécuté ; ouverture d'un
  point de vente **terminée** il y a 20 jours.
- Vue En direct et déroulé recalculés chaque minute (jamais pendant une saisie).
- Frise (skill dataviz) : une seule série colorée (bleu de la charte), le prévu en contour ; repères nommés ;
  infobulle au survol et au clavier ; tableau accessible ; `viewBox` adapté au téléphone.
- Impression : déroulé (cases à cocher, critères, équipe) et « qui fait quoi », injectés dans `#impression`.
