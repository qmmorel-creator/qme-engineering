# Rangement des PDF émis dans Google Drive et note Bible

Décision de Quentin du 24/11/2026. Testée sur Kelly (Conciergerie en Provence) le 24/11/2026.

**Tout fichier PDF émis à un prospect ou à un client** (concept, proposition, devis, plaquette, références, contrat,
facture, compte rendu…) est rangé **le jour même** dans son dossier Google Drive, et son lien est ajouté à la **note
Bible** de son projet Nexora. « Émis » veut dire : envoyé en pièce jointe, ou remis par un lien (page concept, rubrique
« documents » du site), y compris dans un mail de prospection.

## 1. Dossier Drive du prospect

Racine (existante) : `13 - Entreprise QME (micro-entreprise) / 04 - Prospects & clients`
(id `1_Rv6YKFyVsZZRltxB0Ejjmwd9x08_BsR`).

- **Un dossier par prospect**, nommé `<Prénom Nom> – <Entreprise>` (ex. « Kelly Castiglione-Rouvière – Conciergerie en
  Provence »). Sans nom de personne connu : `<Entreprise>` seule, à compléter dès qu'on le connaît.
- **Six sous-dossiers, toujours les mêmes**, créés avec le dossier, même vides :

  | Sous-dossier | Contenu |
  |---|---|
  | `01 - Concept` | PDF des pages `/concepts/<slug>/`, une version par envoi |
  | `02 - Proposition` | propositions commerciales |
  | `03 - Devis` | devis `QME-AAAA-NNN`, chaque version |
  | `04 - Plaquette` | plaquette QME dans la version remise |
  | `05 - Références` | références QME dans la version remise |
  | `06 - Contrat et factures` | contrat signé, devis accepté, factures |

- **Nom des fichiers** : `AAAA-MM-JJ - <Type> - <Entreprise> - <version>.pdf` (date d'émission), comme le reste du Drive.
  Ex. `2026-11-24 - Concept - Conciergerie en Provence - v3 (nettoyage locaux pros).pdf`,
  `2026-11-22 - Plaquette - QME.pdf`.
- **Ranger la version réellement émise**, pas la version du jour : la retrouver dans git
  (`git log -- <chemin du PDF>`, puis `git show <commit>:<chemin> > fichier.pdf`, en prenant le dernier commit **avant**
  l'heure du mail). Une version remplacée avant tout envoi n'est pas archivée. Si la version émise n'est pas
  retrouvable, ranger la plus proche et l'écrire dans la note Bible.
- **Envoi** : connecteur Google Drive, `create_file` avec `parentId` du sous-dossier, `contentMimeType:
  application/pdf`, `disableConversionToGoogleType: true`, contenu passé par référence de fichier
  (`sha256:<empreinte>:<chemin absolu>`). Limite : **environ 3 Mo par fichier** ; au-delà (ex. `QME-references.pdf`,
  4,9 Mo), Quentin le dépose à la main : le dire dans le compte rendu et le noter dans la note Bible.

## 2. Note Bible du prospect (Nexora)

Une seule note par prospect, dans **son projet Nexora** (`docs/prospection/suivi-prospects.md`, § Nexora : un projet
par prospect), créée en même temps que le projet ou au premier PDF émis.

- **Titre** : `Note Bible · <Prénom> (<Entreprise>)`.
- **Type** « Notes » (`b8ivtszx`), statut « Valable » (`81b3336a-6ae3-4f63-8cc1-91b34ef6eafb`), responsable Quentin Morel.
- **Description**, dans cet ordre :
  1. en tête, **l'URL de la page concept** (et de sa démonstration) quand elle existe ;
  2. une phrase d'objet, le prospect (nom, entreprise, adresse), l'activité visée ;
  3. le lien du dossier Drive ;
  4. « DOCUMENTS ÉMIS » : une ligne par PDF, `[Type] date · version · comment il a été remis · lien Drive`, plus une
     ligne « aucun à ce jour » pour chaque type encore vide ;
  5. les réserves (version non retrouvable, fichier à déposer à la main…).
- **Liens attachés** (`add_attachment`, ou `update_task` en relisant la liste avant) : la page concept en premier, puis
  le dossier Drive, puis chaque PDF. Les liens Nexora n'ayant pas de description, **le type est en tête du nom** :
  `[Page concept] …`, `[Dossier prospect] …`, `[Concept] 2026-11-24 - v3 …`, `[Devis] …`.
- **À chaque nouveau PDF** : le ranger, puis ajouter sa ligne et son lien dans la note (relire la note avant, ne rien
  écraser).

## 3. Prospects rangés

| Prospect | Dossier Drive | Note Bible (Nexora) | Reste à faire |
|---|---|---|---|
| Kelly · Conciergerie en Provence | [dossier](https://drive.google.com/drive/folders/1FLqql4ST3oGHmEWB8bB6HzZBcnc_-KRS) | `mcp-27780d61-3d83-4e87-b163-76efaded9251` (projet Kelly-ménage) | `05 - Références` : dépôt manuel par Quentin |

Passe de rattrapage sur les autres prospects (Antarès, Givry, ARVA, Charpennes-Tonkin, Oh ! Délices Paysans, Royaumes
& Légendes, Tignes Spirit, GMT Bordeaux…) : à faire, en ajoutant une ligne à ce tableau par prospect.
Le dossier « Centre social et culturel Charpennes Tonkin (Villeurbanne) » existe déjà dans la racine (Google Docs du
03/11, sans sous-dossiers) : le renommer et le compléter selon ce modèle lors de la passe.
