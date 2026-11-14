# T46 · Onboarding et offboarding salarié

Slug `onboarding`, préfixe `ARD` (clés locales `qme-ard-*`), prix prévu 19 €, permalien Gumroad prévu
`onboarding-offboarding`, catégorie Gumroad `business-and-money/management-and-leadership`, taille S, priorité P2.
Origine : backlog de Quentin n° 22 (ligne T46 de `IDEES.md` : checklists par rôle, responsables, échéances de
J-15 à J+90, restitution du matériel ; base : checklists d'arrivée et de départ par rôle ; **RGPD** (salariés) ;
couplé à T45, dont il ne dépend pas). Fiche rédigée le 13/11/2026. Marques de risque : **données de tiers**
(salariés : données minimales, mention RGPD, effacement proposé) ; repères juridiques **datés** (sourcés,
« à vérifier », mise à jour annuelle). Thème du catalogue : « Organisation et réunions » (`pro`).

## Pour qui

RH de PME (souvent une seule personne, parfois l'office manager ou la direction) et managers qui accueillent
ou voient partir un salarié quelques fois par an : assez pour oublier une étape (badge, accès, DPAE, visite
d'information et de prévention, matériel à récupérer), trop peu pour justifier un logiciel RH. Distinct de
T45 (gestion de parc de postes de travail) : ici, le parcours d'une personne ; le matériel n'est suivi que
pour ce qu'elle reçoit et doit rendre.

## Promesse

Chaque arrivée et chaque départ suit sa checklist : qui fait quoi, et pour quand, de J-15 à J+90. Le matériel
remis est noté, et ce qui n'est pas rendu se voit.

## Écrans (5 onglets + réglages)

1. **Tableau de bord** : tuiles cliquables (parcours en cours avec arrivées et départs, tâches en retard,
   tâches de la semaine, objets non rendus) ; bandeau RGPD « parcours terminé depuis plus de N jours :
   effacer » ; tâches en retard (les plus anciennes d'abord, case « fait ») ; matériel à surveiller (non
   rendu, à restituer sous 7 jours, à remettre après l'arrivée) ; cartes des parcours en cours avec
   position (J−4, J+12), progression et étiquettes ; avertissement.
2. **Personnes** : cartes filtrées (en cours, arrivées, départs, terminés, tous), recherche. **Fiche** :
   en-tête (poste, contrat, service, manager, date J, profils), progression, checklist groupée par phase
   (arrivée : avant, jour J, première semaine, premier mois, jusqu'à trois mois ; départ : préparer, dernière
   semaine, dernier jour, après), chaque tâche avec responsable, J, date, statut, bouton « S. O. » et
   « Repère » s'il y a un repère réglementaire ; matériel (remis, rendu, état) ; actions : modifier,
   imprimer, préparer le départ (depuis une arrivée), effacer.
3. **Cette semaine** : du lundi au dimanche, tâches en retard et à échéance dans la semaine, groupées par
   responsable (RH, manager, informatique, services généraux, salarié), filtre par responsable.
4. **Matériel** : toutes personnes confondues, groupes non rendu, à restituer, à remettre (après l'arrivée
   puis à venir), remis et restitué (repliés) ; export CSV.
5. **Modèles** : profils (commun, poste de bureau, poste terrain, manager, alternant ou stagiaire, et ceux
   créés), checklist d'arrivée ou de départ ; ajouter, modifier, retirer une tâche ; créer (vide ou copie),
   renommer, supprimer un profil ; rétablir les modèles d'origine ; repères réglementaires avec sources.
6. **Réglages** : entreprise ou service, délai avant de proposer l'effacement (30 jours par défaut, 0 à
   365), exports CSV (tâches, matériel), sauvegarde JSON, compte, « Sur téléphone », données personnelles,
   à propos.

Premier lancement en 2 étapes : nom de l'entreprise (facultatif) et 4 conseils, puis choix des profils à
garder (« Commun à tous » imposé).

## Saisie

- **Personne** : arrivée ou départ, prénom et initiale (un nom complet est raccourci : « Jeanne Martin » →
  « Jeanne M. »), poste, type de contrat (CDI, CDD, apprentissage, contrat de professionnalisation, stage,
  autre), service, manager (fonction, jamais un nom), date d'arrivée ou dernier jour, profils, note (sans
  donnée sensible). La checklist est copiée depuis les modèles à la création ; un profil ajouté plus tard
  apporte ses tâches.
- **Tâche** (d'une personne ou d'un modèle) : titre, responsable, échéance relative saisie « J-7 », « J »,
  « J+30 », statut (à faire, fait avec date, sans objet), note.
- **Matériel** : nom (suggestions), remis le, état, rendu le et état au retour (départ), note.
- **Préparer le départ** depuis une arrivée : mêmes informations et profils, matériel remis repris « à
  restituer ».

## Calculs (règles pures, `templates/onboarding/regles.js`, `window.ARD`)

- **Échéance** = date J + j (jours calendaires). Bornes de la base : J-15 à J+90 (arrivée), J-30 à J+30
  (départ).
- **Statut** : fait, sans objet, sinon « en retard » (échéance passée), « cette semaine » (d'aujourd'hui à
  dimanche), « à venir ».
- **Progression** = faites ÷ (total − sans objet) ; 100 % si tout est sans objet.
- **Phases** par intervalle de j, selon le sens.
- **Génération** : profil commun + profils choisis, doublons de titre fusionnés, tri par j puis responsable.
- **Matériel** : arrivée → remis, à remettre (en retard après J) ; départ → restitué, à restituer, non rendu
  après J. Alertes : non rendu, à remettre en retard, à restituer dans les 7 jours.
- **Parcours terminé** : toutes les tâches faites ou sans objet et, pour un départ, tout le matériel rendu.
  **À effacer** : terminé et dernière échéance passée depuis au moins le délai réglé.
- **Par responsable** : retards et tâches de la semaine des parcours non terminés, groupés dans l'ordre des
  fonctions. **Indicateurs** du tableau de bord.
- **Nom minimal**, lecture tolérante de « J-15 », export CSV (point-virgule, BOM UTF-8) des tâches et du
  matériel, normalisation tolérante des anciennes données.

## Base intégrée (`templates/onboarding/donnees.js`)

- **5 profils, 89 tâches** rédigées pour QME (54 d'arrivée, 35 de départ) : commun à tous (24 + 17), poste de
  bureau (8 + 5), poste terrain (9 + 5), manager (6 + 4), alternant ou stagiaire (7 + 4). Chaque tâche :
  responsable par fonction et échéance relative. Aucune personne nommée, aucun lien externe (test
  automatique).
- 5 responsables, 6 types de contrat, 5 états de matériel, 12 matériels courants suggérés, 4 conseils.
- **Repères réglementaires** (rattachés aux tâches concernées et listés dans Modèles) :
  - DPAE : avant la prise de poste, au plus tôt dans les 8 jours qui précèdent l'embauche.
    Source : service-public.gouv.fr, fiche F23107 (vérifiée par le site le 01/06/2026), relevée le 13/11/2026.
  - Visite d'information et de prévention : dans les 3 mois suivant la prise effective du poste ; avant
    l'affectation pour un travailleur de nuit ou de moins de 18 ans ; examen d'aptitude pour le suivi
    renforcé. Source : service-public.gouv.fr F34061 et Code du travail numérique, relevés le 13/11/2026 ;
    article R4624-10 cité par des sources secondaires, **à vérifier** sur Légifrance.
  - Documents de fin de contrat : certificat de travail, solde de tout compte, attestation France Travail,
    état récapitulatif de l'épargne salariale (PEE, PEI, Perco) ; tenus à disposition dès la fin du contrat.
    Source : service-public.gouv.fr F21789 (vérifiée par le site le 24/02/2026), relevée le 13/11/2026.
  - Registre unique du personnel : inscription à l'embauche ; conservation 5 ans après la sortie selon la
    CNIL. Référentiel CNIL « Gestion des ressources humaines » (2026) ; article L1221-13 **à vérifier**.
  - Données des salariés : repère général du même référentiel, **à vérifier**.
  Tous affichés « à vérifier », avec la date de relevé (mise à jour annuelle du fichier).

## Sources et risques

- Rien ne se périme dans les calculs (dates relatives) ; seuls les repères juridiques sont datés.
- **RGPD** : données minimales par conception (prénom + initiale, fonction du manager, pas de champ santé,
  salaire, adresse ou motif) ; mention dans la saisie, les réglages et la page catalogue ; effacement proposé
  après la fin du parcours ; l'acheteur reste responsable de traitement. Les archives RH obligatoires
  (registre, paie) ne sont pas tenues ici.
- Aucune automatisation : pas d'intégration à un logiciel RH, pas d'e-mail, pas de lien externe. Partage par
  impression (récapitulatif par personne, PDF par le navigateur) et CSV.
- Risque produit : suites SIRH avec module d'onboarding (abonnement) et modèles gratuits en tableur ; se
  distinguer par les checklists prêtes avec responsables et échéances, le départ et le matériel, l'achat
  unique et la sobriété des données.

## Choix d'implémentation (13/11/2026)

- Socle copié de `templates/abonnements/` (connexion avec `{ code, produit: 'ARD' }`, démo, synchronisation,
  409, hors ligne, modales, toast « Annuler », fenêtre « Comme une application » reprise du bloc de
  `templates/gantt/app.js`, bandeau « Bientôt en vente »).
- Les tâches d'un parcours sont copiées des modèles à la création : modifier un modèle ne change pas les
  parcours en cours (tests).
- Démo : PME fictive « Atelier Lumen (fictif) », 8 parcours à des dates relatives à aujourd'hui : arrivée dans
  4 jours avec retards et une tâche ajoutée à la main, arrivée à J+12 (terrain, matériel remis, outillage à
  remettre), alternante à J+40 (une tâche sans objet), arrivée dans 24 jours (0 %), arrivée terminée à J+96,
  départ dans 3 jours (matériel à restituer, clés déjà rendues), départ il y a 10 jours (2 objets non rendus,
  véhicule rendu usé), stagiaire parti il y a 72 jours (terminé, proposé à l'effacement).
- Pas de graphique (barres de progression seulement) : le skill dataviz n'a pas été nécessaire.
