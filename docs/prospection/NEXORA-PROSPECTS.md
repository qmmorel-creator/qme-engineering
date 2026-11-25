# Prospects dans Nexora Optim : création, Note Bible, mise à jour à chaque action

Référence obligatoire pour toute session (humaine ou agent) qui traite un prospect sur mesure, un client ou un créateur
de l'affiliation en discussion. Décisions de Quentin du 24/11/2026. `docs/prospection/suivi-prospects.md` est une
archive : la procédure à jour est ici.

## 1. Où vit l'information d'un prospect

| Endroit | Outil (MCP Nexora) | Contenu |
|---|---|---|
| Fiche QME du prospect (`/qme`) | `get_qme`, `list_qme`, `mutate_qme` `entity: "prospect"` (ou `"createur"`) | étape, niveau, balle, prochaine action, relance, dernier message, échanges datés, `conceptUrl`, `gmailFil` |
| Fiche QME du client | `mutate_qme` `entity: "client"` | `conceptUrl`, `conceptPdf`, `conceptTitre`, `conceptDate`, `propositionPdf`, `prodUrl`, échanges |
| Devis, contrats, factures | `mutate_qme` `entity: "devis"` / `"contrat"` / `"facture"` | numéro `QME-AAAA-NNN`, version, statut, montants, lien `pdf` |
| Projet Nexora du prospect | `list_projects`, `list_tasks` | dossier « QM Engineering », un projet par prospect |
| Tâche « État global du prospect » | `update_task` | statut parmi les six statuts prospects + description datée |
| Tâche « Note Bible · <prospect> » | `update_task` | lien de la page de concept en tête, liste de tous les documents émis |
| Tâches d'action et réunions | `create_task`, `complete_task`, `save_meeting_report` | une tâche par action que Quentin doit faire lui-même ; **aucune tâche pour une relance ni pour ce que Claude fait automatiquement** (décision du 25/11/2026) : la relance se suit par la date `relance` de la fiche QME |
| Dossier Google Drive du prospect | Google Drive | copie de chaque PDF émis |

**Jamais de prospect sans adresse e-mail** (décision de Quentin du 24/11/2026) : une entreprise sans adresse e-mail publique (formulaire, téléphone seul) n'est pas créée dans Nexora Optim › QME ; l'étape `pas-de-mail` n'est plus utilisée, et les 410 fiches qui la portaient ont été supprimées le 24/11/2026.

La liste d'opposition du site reste la référence des désinscriptions (`docs/templates/communication/REGLES-PROSPECTION.md`).

## 2. Règle absolue : mettre à jour Nexora après chaque action

**À chaque traitement d'un prospect** (mail reçu ou envoyé, réponse, relance, appel, visio, concept, proposition, devis,
contrat, facture, refus, « stop », changement de prochaine action), la session qui agit met à jour **le jour même,
avant de rendre la main**, tous les endroits concernés du § 1. Une action non reportée dans Nexora est considérée comme
non faite.

Avant d'agir : lire la fiche QME (`get_qme` avec l'id), la tâche « État global » et la Note Bible du projet ; chercher
`to:<adresse>` dans tous les fils Gmail avant de conclure qu'un prospect attend une réponse.

Après l'action, passer cette liste dans l'ordre :

1. **Fiche QME** (`mutate_qme`, `update`, avec `expectedRevision` lue juste avant) : ajouter un élément à `echanges`
   (date, `sens` `recu` / `envoye` / `note`, contenu court, `montant` s'il y a un prix ; relire la liste avant, elle
   est remplacée en entier), puis `etape`, `balle`, `prochaineAction`, `relance`, `dernierMessage`, `niveau` selon le
   cas. Jamais le texte intégral d'un mail : une citation courte suffit.
2. **Fiche client, devis, contrat, facture** s'ils existent ou naissent de l'action : créer ou mettre à jour l'entité,
   avec le lien du PDF (`conceptPdf`, `propositionPdf`, `pdf` du devis).
3. **Tâche « État global du prospect »** : statut (§ 4) et description réécrite : qui, quoi, état daté, balle,
   prochaine action.
4. **Note Bible** : une ligne par document émis (§ 3), et le lien de la page de concept en tête dès qu'il existe.
5. **Drive** : copie du PDF émis dans le dossier du prospect (§ 3.3).
6. **Tâches du projet** : aucune tâche de relance (décision du 25/11/2026 : la relance se suit par la date `relance` de la
   fiche QME) ; un rendez-vous = une
   tâche de type Réunions avec ses heures, puis son compte rendu (`save_meeting_report`) ; une action terminée =
   `complete_task`.
7. **Relire** ce qui a été écrit (`get_qme`, `get_task`) avant d'annoncer que c'est fait.

Refus ou « stop » : fiche en `perdu` (ou `oppose` pour un « stop » ou une réponse hostile, avec inscription sur la
liste d'opposition le jour même), `motifSortie`, tâche « État global » en **Refus**. Contrat signé : fiche client
`signe`, contrat créé, tâche « État global » en **Signé**.

## 3. Note Bible du prospect

### 3.1 Création

Chaque projet prospect a **une** tâche « Note Bible · <Prospect> », créée en même temps que le projet (§ 4) :

- type **Notes** (`b8ivtszx`), statut **Valable** (`81b3336a-6ae3-4f63-8cc1-91b34ef6eafb`), responsable Quentin Morel,
  début et fin à la date de création ;
- pièces jointes : le dossier Drive du prospect et chaque PDF émis (liens Drive).

Description, dans cet ordre :

```
PAGE DE CONCEPT : https://qm-engineering.fr/concepts/<slug>/   (ou « aucune à ce jour »)
Démonstration : https://qm-engineering.fr/concepts/<slug>/demo/   (s'il y en a une)

Note Bible du prospect : tous les documents PDF émis, rangés dans Google Drive. Une ligne par document
(type · date · version · lien). Mise à jour à chaque nouveau PDF émis.

Prospect : <contact> · <entreprise>, <ville> · <adresses>
Besoin : <une ligne>

Dossier Drive du prospect : <lien du dossier>
(13 - Entreprise QME / 04 - Prospects & clients / <Contact> – <Entreprise>)

DOCUMENTS ÉMIS
- [Concept] JJ/MM/AAAA · vN · <titre> · <envoi : date et canal> · <lien Drive>
- [Proposition] … ou « aucune à ce jour »
- [Devis] QME-AAAA-NNN vN · JJ/MM/AAAA · montants · <lien Drive> … ou « aucun à ce jour »
- [Contrat / facture] … ou « aucun à ce jour »

Réserve : ce qui n'a pas pu être vérifié ou archivé.
```

### 3.2 Mise à jour

À **chaque document émis** (concept, nouvelle version, proposition, devis, contre-proposition, contrat, facture,
plaquette ou références envoyées) : ajouter sa ligne, sans effacer les versions précédentes. Une version remplacée
reste listée avec la mention « remplacée par vN ». Un document prêt mais non envoyé est noté « NON envoyé ».
Dès qu'une page de concept existe, son lien passe **en tête** de la note et dans `conceptUrl` des fiches QME
prospect et client.

### 3.3 Rangement Drive

- Dossier du prospect : `13 - Entreprise QME / 04 - Prospects & clients` (id `1_Rv6YKFyVsZZRltxB0Ejjmwd9x08_BsR`),
  nommé « <Contact> – <Entreprise> » ; le créer s'il n'existe pas.
- Six sous-dossiers fixes, créés avec le dossier même vides : `01 - Concept`, `02 - Proposition`, `03 - Devis`,
  `04 - Plaquette`, `05 - Références`, `06 - Contrat et factures` (plus `07 - Autres documents` si besoin).
- Nom du fichier : `AAAA-MM-JJ - <Type> - <Entreprise> - <version>.pdf` (règle de `CLAUDE.md`). Envoi en PDF brut
  (`disableConversionToGoogleType: true`) ; vérifier que la taille dans Drive est celle de l'original.
- Le connecteur Drive refuse les fichiers de plus d'environ 3 Mo : dépôt à la main par Quentin, signalé en « Réserve »
  dans la Note Bible plutôt qu'omis. Plaquette et références : copie côté Drive (`copy_file`) depuis la source notée
  dans `RANGEMENT-DRIVE.md`.
- Procédure complète (version réellement émise, pièces jointes, sessions concurrentes) : `RANGEMENT-DRIVE.md`.

## 4. Création d'un projet prospect

Dès qu'un prospect répond avec intérêt (ou qu'un créateur de l'affiliation passe en discussion) :

1. Créer le projet dans le dossier **« QM Engineering »** (`86e6e5b2-0d94-4a3a-bcd3-a0dde86143cd`) avec
   `mutate_resource` `projects`, nommé « Nom-activité » (ex. « Kelly-ménage », « GMT Bordeaux-horlogerie »).
2. Ajouter l'id du projet au champ `projectIds` de **chacun des six statuts** ci-dessous (`mutate_resource`
   `statuses` ; relire la liste pour la compléter, jamais la remplacer).
3. Créer la tâche **« État global du prospect »** (type Tâches, responsable Quentin Morel, dates du jour), au statut
   qui correspond à l'étape.
4. Créer la **Note Bible** (§ 3.1) et, si un document a déjà été émis, le dossier Drive (§ 3.3).
5. Relier la fiche QME : vérifier que le prospect existe dans `/qme` (sinon `mutate_qme` `create`) et y reporter
   l'échange qui a déclenché la création.

Les tâches propres à un prospect vont dans son projet, pas dans « QME - Stratégie ».

**Statuts réservés aux projets prospects** :

| Statut | Quand | Id Nexora |
|---|---|---|
| Prospect | Contact établi, intérêt exprimé, pas d'échange de fond (ou sans nouvelle) | `1cc52e21-1f09-4686-a04e-55a6cd70f8df` |
| Discussion | Appel, visio ou échange sur le besoin en cours ; pas encore d'offre écrite envoyée | `6340313d-a2ad-4757-9670-f0ea5cda97c5` |
| Offre envoyée | Proposition ou devis écrit envoyé, sans réaction du prospect | `01e2bc71-d360-4567-a499-abe3f1a672c4` |
| Négociation | Le prospect discute l'offre (prix, périmètre, modalités) ou une contre-proposition est en cours | `e01ad162-4b06-4885-b8c2-3daab2bee177` |
| Refus | Refus explicite | `c6c10d10-ae33-4fa2-a996-67271e34a976` |
| Signé | Contrat signé, devis accepté ou vente conclue | `7848d844-c300-4f3d-9f44-4ef27ef0af25` |
