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

  Un septième sous-dossier, `07 - Autres documents`, est créé seulement s'il sert : PDF émis qui n'entre dans aucun
  type (ex. le comparatif des outils de révision joint au mail d'Optimind).

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
- **Documents communs** (plaquette, références) : un seul exemplaire est envoyé, puis copié côté Drive dans chaque
  dossier avec `copy_file` (pas de limite de taille). Source actuelle de la plaquette du 22/11 :
  `1z9EeCV5DsFnGeRfcirMSn-Lgxp4epQ7x` (dossier de Kelly). Source des références du 22/11 (4,9 Mo, déposées à la main par Quentin) :
  `1HOXuu_KxZdKvqnNBbM7IddzbRe6IgfTZ` (dossier de Kelly).
- **Pièce jointe d'un mail** : ranger le fichier réellement joint (`download_gmail_attachment`), pas une version du
  dépôt.
- **Avant de créer** : chercher dans la racine (`'1_Rv6YKFyVsZZRltxB0Ejjmwd9x08_BsR' in ancestors`) et dans Nexora
  (`list_tasks`, « Note Bible ») ce qui existe déjà : une autre session peut être en train de ranger le même prospect.

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

Passe de rattrapage faite le 24/11/2026 (inventaire Gmail de tous les envois, versions retrouvées dans git). Dossiers
dans la racine `04 - Prospects & clients` ; note Bible dans le projet Nexora du prospect.

| Prospect | Dossier Drive | PDF rangés | Note Bible (Nexora) |
|---|---|---|---|
| Kelly · Conciergerie en Provence | [dossier](https://drive.google.com/drive/folders/1FLqql4ST3oGHmEWB8bB6HzZBcnc_-KRS) | concept v2 et v3, plaquette | `mcp-27780d61-3d83-4e87-b163-76efaded9251` |
| Sarah Villar · École de Musique de Givry | [dossier](https://drive.google.com/drive/folders/1loENyP9hZ4Mrw7Mt68fLK0F-JLazbHQu) | concept, proposition et devis QME-2026-011 v1 et v2, plaquette | `mcp-b4e93502-bfb0-4eb4-bb9b-88f50ef69de4` |
| Nathalie Delecroix · Compagnie Antarès | [dossier](https://drive.google.com/drive/folders/1zax0wQa9zHUgAcR3eHtjt4ceUzxM-dY-) | concept, proposition, devis QME-2026-012, plaquette | `mcp-95d40af7-bb2f-44ce-a290-6711c02feebb` |
| Antoine Ferrero · ARVA (Nic-Impex) | [dossier](https://drive.google.com/drive/folders/1XqrOViJRKbfj2bjUj6GI5D72DhrTl3nC) | concept v2, plaquette | `mcp-655b8819-1187-4f89-b60d-504dda9dae12` |
| Alice Bacquart · Oh ! Délices Paysans | [dossier](https://drive.google.com/drive/folders/1b15gQ8jytE0d1iuTzwrw07lwdhj22ijs) | concept, plaquette | `mcp-04089a96-3ab9-4118-9156-5812efb0bb3e` |
| Royaumes & Légendes | [dossier](https://drive.google.com/drive/folders/1CovCJ2GhQ0Q-BJSaECqc2HXjkVvuH3q3) | concept (24/11), plaquette | `mcp-36cd50c3-b140-482c-84f0-64ce7fbca304` |
| Kieran Hicks · Tignes Spirit | [dossier](https://drive.google.com/drive/folders/1Gzm4k9jDO-qHmToTDq3fdXD0ejjT_l5D) | concept, plaquette | `mcp-b379e717-7781-4641-b29d-8d8a4822f0be` |
| Bryan Durand · GMT Bordeaux | [dossier](https://drive.google.com/drive/folders/1_8UvRs-CyZAO2wZfd3sjXER79aDUfiaP) | concept générique horlogerie, plaquette | `mcp-58c37d1e-3ab9-4820-9bfe-073b31b3aa38` |
| Nell Dumas · CS Charpennes-Tonkin | [dossier](https://drive.google.com/drive/folders/1JMvdJxoidvCSVraYtFNUkD6hN6D_SMVw) | concept, plaquette (+ documents internes du 03/11 à la racine, non émis) | `mcp-2dade9be-19f9-4075-ab57-463d395f7010` |
| Barteau Traiteur | [dossier](https://drive.google.com/drive/folders/1py_vIyZwoV99qPlLXLLUmJ3GSIex5YO-) | plaquette | `mcp-e48d7088-5de0-4592-9e38-a2007075f2b1` |
| Laurine Mebs · Optimind Formation | [dossier](https://drive.google.com/drive/folders/1sYswA4EX55gxDdTxAYr1IH9VS9vSIP7d) | comparatif des outils de révision (pièce jointe, `07 - Autres documents`) | `mcp-2b94d2fb-2a1f-4a5a-905e-122c2544e1e3` |
| Christophe Yzet · Yuzu Agency (Odélia) | aucun (aucun PDF émis : liens seulement) | — | `mcp-f2398b09-55e2-4916-828f-256a8e8054bc` · `mcp-08bddce3-8d86-4a2b-9c46-2acfd2d18d38` |

**Points ouverts**

- Références du 22/11 déposées par Quentin le 24/11 dans le dossier de Kelly (`1HOXuu_KxZdKvqnNBbM7IddzbRe6IgfTZ`), copiées dans les 9 autres `05 - Références` et liées dans chaque note Bible.
- **Versions** : l'historique du dépôt commence le 22/11/2026. Pour tout envoi antérieur, la version rangée est celle du
  22/11 (la plus proche retrouvable), ce que chaque note Bible indique. Versions exactes : Kelly (v2, v3), ARVA (v2),
  Royaumes & Légendes (#270), Givry v2, et le comparatif d'Optimind (pièce jointe Gmail).
- **Hors périmètre** : les pages concept des vagues « registres de contrôle » (sans PDF) et les concepts sectoriels
  `hypermarche` et `magasin-sport` (rattachés à aucun prospect actif).
- **Antarès** : le mail du 22/11 annonce un « devis mis à jour » qui n'a été envoyé nulle part (à trancher par Quentin).
