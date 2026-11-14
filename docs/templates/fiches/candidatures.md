# T89 · Candidatures études, stages, alternance

Slug `candidatures`, préfixe `CAN`, prix 12 €, permalien Gumroad proposé `candidatures-etudes-stages-alternance`.
Taille S, P2. Usage `perso`, thème du catalogue « Organisation et études ». Pack visé : « Étudiant » (PET).
Origine : proposition validée par Quentin le 14/11/2026, ligne T89 de `IDEES.md`. Cadrage délégué par Quentin
(14/11/2026) : décisions ci-dessous prises par l'assistant, à relire.
**daté** : aucun calendrier officiel intégré ; toutes les dates (limite, entretien, réponse) sont saisies par
l'utilisateur. **Aucune marque de plateforme** de candidature dans le nom, l'interface, la page et la communication
(vérifié par un test). Démo entièrement fictive (étudiant « Noa », établissements et entreprises inventés).

## Pour qui

- **Lycéens** qui préparent leur orientation après le bac (souvent accompagnés d'un parent, qui achète).
- **Étudiants** qui visent un master, une école sur dossier ou concours, une admission parallèle.
- **Candidats à un stage, une alternance ou un job étudiant**, avec beaucoup d'envois et peu de réponses.

Aujourd'hui : un tableur, des notes dans le téléphone, la boîte mail ; la pièce oubliée, la relance jamais faite,
la date de réponse perdue.

## Écrans (5 onglets + réglages)

- **Tableau de bord** : tuiles (en cours, à envoyer avec dates passées, entretiens à venir, réponses), « À envoyer »
  (date limite sous l'alerte réglable ou passée, jauge des pièces, liste de ce qui manque), relances dues avec bouton,
  14 prochains jours (entretiens et réponses), compteurs par statut cliquables.
- **Candidatures** (« Dossiers » sur téléphone) : recherche (sans accents ni pluriel), filtres par type et par statut,
  cartes triées (actives par prochaine date, puis réponses définitives). **Fiche** d'une candidature : type, rang,
  intitulé, établissement ou entreprise, ville, contact (fonction), lien ; statut en 7 boutons ; alertes ; pièces
  (statut au toucher : à faire → en cours → prête → envoyée ; pièces « après acceptation » à part) ; dates ;
  relances (notées, message à copier) ; lettre et entretien (avancement, accès direct) ; notes et motif. Modifier,
  dupliquer (mêmes pièces et lettre, sans dates), supprimer, imprimer le dossier. Export CSV, récapitulatif imprimable.
- **Vœux** : classement par ordre de préférence, **propre à chaque type** (formations entre elles, stages entre
  eux…), monter, descendre, retirer, classer les non classées ; refusées et retirées sortent du classement (rangs
  resserrés). Mention : ce classement personnel ne remplace pas celui d'un service de candidature. Impression.
- **Échéances** : « À traiter » (dates passées, relances dues), puis mois par mois ; filtres (dates limites,
  entretiens, réponses, relances) ; export **.ics** (iCalendar, événements « journée » ou à l'heure saisie) ;
  impression.
- **Lettres et entretiens** (« Préparer ») : choix de la candidature ; **lettre** : 5 trames originales (formation,
  stage, alternance, job, spontanée), champs avec exemple, aperçu en direct qui surligne ce qui reste à écrire,
  retouche libre du texte, copier, imprimer, passer la pièce « Lettre de motivation » à prête ; **entretien** : date,
  format (sur place, visio, téléphone), lieu ; questions choisies dans une banque de 32 (7 thèmes, filtrées par type)
  ou personnelles, piste de réponse, notes, « prête » ; notes générales ; fiche imprimable.
- **Réglages** : prénom, signature, campagne, alerte avant date limite (3 à 30 jours, 7 par défaut), relance après
  envoi sans nouvelles (5 à 30 jours, 10 par défaut) ; exports CSV, .ics, JSON ; restauration ; compte ; « Sur
  téléphone » ; à propos (aucun calendrier officiel, aucune plateforme).
- **Premier lancement** en 2 étapes : prénom, signature, campagne ; première candidature (type, liste de pièces de
  départ, intitulé, établissement, date limite) ou « Passer ».

## Base intégrée (`donnees.js`, sans date)

- 4 types, 7 statuts (à préparer, envoyée, entretien, liste d'attente, acceptée, refusée, retirée), 4 statuts de pièce.
- 23 pièces types avec une aide courte (dont 4 « après acceptation » : attestation de responsabilité civile,
  convention de stage, contrat d'alternance, confirmation d'inscription) et 6 listes de départ (formation après le
  bac, master, école sur dossier ou concours, stage, alternance, job étudiant) plus une liste vide. Présentées comme
  « pièces souvent demandées, à adapter » : aucune n'est donnée comme obligatoire.
- 32 questions d'entretien en 7 thèmes, chacune avec une piste de réponse, filtrées par type ; 5 trames de lettre ;
  3 messages (relance formation, relance entreprise, remerciement après entretien). Textes originaux QME.
- Aucune règle légale. La convention de stage est citée comme pièce « fournie par ton établissement », sans
  référence juridique.

## Règles (`regles.js`, fonctions pures testées)

- Avancement des pièces (les pièces « après acceptation » ne comptent qu'une fois acceptée).
- Changement de statut : envoi → date d'envoi du jour si vide, pièces prêtes passées « envoyées » ; réponse
  (acceptée, refusée, attente) → date de réponse reçue du jour si vide ; retour « à préparer » → réponse effacée.
- Relance : pour une candidature qui attend une réponse (envoyée ou entretien sans réponse, ou liste d'attente) :
  réponse annoncée dépassée → relance due ; entretien passé sans message depuis → remerciement ; hors formation et
  sans date de réponse à venir, délai depuis le dernier contact (envoi, relance, entretien, mise en attente). Pour une
  formation, uniquement après la date de réponse annoncée (les établissements publient leur calendrier).
- Échéances : date limite (si à préparer), entretien, réponse attendue, relance ; niveaux dépassé, urgent (≤ 3 j),
  proche (≤ alerte), loin ; tri par date et nature ; « à envoyer ».
- Classement par type (déplacer, retirer, resserrer) ; bilan ; recherche ; tri.
- Lettre : remplacement des champs, champs manquants listés, signature ; messages de relance.
- Exports : CSV (point-virgule, BOM) et iCalendar (lignes pliées à 75 octets, caractères échappés).
- Champs libres : mots de passe, identifiants de connexion et numéros longs refusés.

## Sources et données datées

Aucune donnée datée en base (test : aucune année ni date du calendrier dans `BASE`). Libellés de l'ajout à l'écran
d'accueil repris du socle commun.

## Risques et points à trancher par Quentin

- **Public en partie mineur** (lycéens) : l'achat se fait en pratique par un parent ; les données sont celles du
  candidat, hébergées en ligne (Netlify Blobs, Francfort) comme pour les autres templates. Aucune note scolaire,
  pièce ni numéro n'est demandé. Pas de prospection directe de mineurs (`prospects.md`). À valider comme pour
  CSE (gestion de classe), moins sensible : l'utilisateur saisit ses propres données.
- **Marques** : aucune plateforme nommée ; le classement des vœux est présenté comme personnel.
- **Lettres** : trames originales ; l'interface rappelle d'adapter le texte.
- Nom proche de T76 « Suivi des appels d'offres et candidatures » (CND, pro) : catalogues et thèmes différents.

## Livrables

Application `templates/candidatures/`, tests `outils/templates/candidatures.test.mjs`, page `catalogue/candidatures/`,
captures `assets/templates-candidatures-*.webp`, couverture `assets/templates-candidatures-couverture.png`,
communication `docs/templates/communication/candidatures/` (linkedin.md, instagram.md et carrousel PNG,
prospects.md, gumroad.md et gumroad.json, section-site.html, couverture.txt, carte-en-prochaine.html pour `en/`, non
appliquée : version anglaise en attente).
