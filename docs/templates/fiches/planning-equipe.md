# T47 · Planning d'équipe et staffing

Slug `planning-equipe`, préfixe `EQP` (clés locales `qme-eqp-*`, règles `window.EQP`), prix 35 €, permalien
Gumroad prévu `planning-equipe-staffing`, catégorie Gumroad `business-and-money/management-and-leadership`,
taille L, priorité P2. Origine : backlog de Quentin n° 23 (ligne T47 de `IDEES.md` : affectation par
personne et projet, taux de charge, conflits, vues semaine et mois). Cadrage délégué par Quentin le
14/11/2026 (fiche rédigée et validée par l'agent, sans attente). Marques de risque : **RGPD** (données de
salariés, aucune donnée de santé), **daté** (repères de durée du travail : paramètres sourcés, datés,
modifiables), **confidentiel à vérifier** : aucune équipe, personne, projet ni écran de l'outil interne
de Quentin repris ; démo entièrement fictive (agence « Agence Exemple », clients nommés d'après des
étoiles). Rejoindra le « Pack Petite entreprise » (avec T48 congés, notes de frais, onboarding,
trésorerie).

## Pour qui

Le dirigeant ou le manager d'une TPE ou PME de 3 à 50 personnes (agence, bureau d'études, bâtiment,
commerce, atelier, services sur site) qui fait son planning sur un tableur : il voit qui travaille sur
quoi, mais pas la charge réelle, et découvre la surcharge ou la personne affectée pendant ses congés
quand il est trop tard. Usage partagé : **une clé pour tous les managers** (pas de comptes séparés en
V1). Distinct du **Gantt** (tâches et dépendances d'un projet), du **planner horaire** (agenda personnel)
et du **suivi des congés** (soldes et demandes) : ici, la répartition des personnes entre projets et
postes, semaine par semaine.

## Promesse

Qui fait quoi, et qui peut encore prendre : les affectations par personne et par projet, la charge de
chaque semaine avec les absences et les temps partiels, et les conflits signalés avant qu'ils coincent.

## Modèle

- **Personne** : prénom, nom, rôle, compétences, heures par semaine (capacité ; 35 h par défaut,
  art. L3121-27), jours travaillés (temps partiel : ex. pas le mercredi), arrivée, départ.
- **Projet ou poste à couvrir** : nom, client, dates (facultatives : un poste dure), besoin en heures par
  semaine (facultatif), compétences demandées, statut (actif, en pause, terminé : les deux derniers ne
  comptent plus dans la charge), couleur (palette fixe validée), note.
- **Affectation** : personne, projet, du, au, heures par semaine, note, saisie par (prénom du manager sur
  l'appareil), date de saisie.
- **Absence** : personne, type (congés, formation, autre absence ; aucun motif médical), du, au,
  demi-journées.
- **Compétences** : liste libre.

## Règles (fonctions pures, `regles.js`, tests `outils/templates/planning-equipe.test.mjs`)

- Heures d'une affectation réparties à parts égales sur les jours travaillés de la personne ; rien un
  jour non travaillé ou un férié chômé (11 fêtes légales calculées, Pâques comprise, Alsace-Moselle en
  option).
- Capacité d'une semaine = heures/jour × jours travaillés présents, moins les absences (½ journée
  possible). Taux de charge = charge / capacité ; états : surcharge (> seuil, 100 % par défaut), plein,
  disponible (< seuil, 80 % par défaut), absent, hors effectif.
- Une affectation qui tombe pendant une absence **reste comptée** : alerte « affecté pendant une
  absence » (et surcharge si la capacité tombe à 0).
- Couverture d'un projet ou poste : besoin hebdomadaire au prorata des jours d'ouverture (réglage) de la
  semaine, fériés déduits ; couvert = heures planifiées hors absences ; trou si manque > 0,5 h.
- Compétence : alerte quand une personne affectée n'a **aucune** des compétences demandées (une équipe se
  complète).
- Durée : alertes paramétrables sur la charge planifiée, 48 h sur une semaine (art. L3121-20) et 44 h en
  moyenne sur 12 semaines (art. L3121-22), 0 pour désactiver. Repos, heures supplémentaires, travail de
  nuit, jeunes travailleurs, forfaits jours : non vérifiés (dit dans les repères).
- Alertes sur 4 semaines, semaines consécutives regroupées.
- Disponibles : heures libres par personne pour une semaine, filtres compétence, rôle, heures minimum.
- **Fusion de deux managers** (409 du serveur) : par élément, ce qui a été ajouté, modifié ou supprimé
  sur cet appareil l'emporte, le reste vient du serveur ; dernier état reçu gardé dans le cache.

## Écrans (5 onglets + réglages)

1. **Tableau de bord** : tuiles (charge de l'équipe, en surcharge, besoins non couverts, disponibles la
   semaine prochaine), alertes à régler sur 4 semaines, disponibles la semaine prochaine, barres de charge
   par personne (repère à 100 %, couleur + étiquette d'état, infobulle).
2. **Planning** : semaine (personnes × jours, heures par projet, absences, fériés, « + x h » libres pour
   affecter, total et état ; ou projets × jours avec couverture) et mois (personnes × semaines : taux ;
   ou projets × semaines : couvert / besoin) ; navigation, impression.
3. **Disponibles** : « Qui est disponible ? » pour une semaine (la suivante par défaut), cartes triées par
   heures libres, compétences surlignées, bouton « Affecter ».
4. **Projets** : filtres (en cours, à venir, postes, en pause, terminés, tous), couverture cette semaine
   et la suivante, personnes affectées, alertes.
5. **Équipe** : personnes (capacité, jours, compétences, taux de la semaine), absences en cours et à
   venir, compétences, encadré RGPD.

Saisie d'une affectation avec aperçu : taux de la personne sur les 12 premières semaines, absences sur la
période, compétence manquante, dépassement des dates du projet ; raccourcis 25 / 50 / 75 / 100 % de la
capacité. Premier lancement en 2 étapes : secteur (6 modèles d'équipe : rôles, compétences, postes
proposés) puis compétences et postes cochés. Réglages : seuils, capacité par défaut, jours d'ouverture,
alertes de durée datées et sourcées, fériés, exports CSV (affectations, charge 12 semaines), sauvegarde
JSON, prénom du manager sur l'appareil, « Sur téléphone ».

## Base intégrée (`donnees.js`)

6 modèles d'équipe (agence, bâtiment, commerce et restauration, atelier, services sur site, bureau
d'études) avec rôles, compétences et postes à couvrir ; 3 types d'absence sans donnée de santé ; palette
de 7 couleurs validée (`dataviz`, contrastes compensés par le nom écrit) ; repères de durée et sources
relevés le 14/11/2026 sur code.travail.gouv.fr (L3121-27, L3121-20, L3121-22, L3133-1). Contenu original.

## RGPD

Données minimales, aucune donnée de santé ; par personne : export (droit d'accès), effacement (nom
remplacé, notes vidées, heures gardées), suppression avec ses affectations et absences ; encadré
d'information dans l'onglet Équipe et les réglages.

## Hors V1

Comptes séparés et droits par manager, lien automatique avec le suivi des congés (aucun connecteur, règle
de Quentin), import de tableur, optimisation automatique, pointage du temps réel.
