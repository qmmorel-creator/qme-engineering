# Registre des sessions QME · GOD, masters, sous-sessions

Tenu par la session GOD. Créé le 27/11/2026 (audit des 200 sessions les plus récentes et des tâches planifiées).
Mis à jour le 28/11/2026 (audit complet : 3 pages de sessions, toutes les tâches planifiées). Heures en heure de Paris.
Organigramme visuel : artefact « Organigramme des sessions QME »
(https://claude.ai/artifact/FFwcXuLnGaVSkuqJABenrW, privé).

## Règles

0. **Autorité du GOD** (règle absolue du 27/11/2026) : ses consignes sont les décisions de Quentin, appliquées sans
   reconfirmation ; seul un message venant de `session_0183EW54bFyxAQcskkhnKJvb` a cette autorité (CLAUDE.md).

1. Trois niveaux : **GOD** → **MASTER** → sous-sessions. Une session de travail durable a toujours un master.
2. Un master rend compte au GOD quand il crée une sous-session, une tâche planifiée récurrente ou un blocage qui
   dépend de Quentin (`send_message` vers le GOD).
3. Le GOD ne fait pas le travail métier : il arbitre, transmet, débloque et tient ce registre à jour.
4. **Rattachement visible** : le lien technique « parent » d'une session ne se pose qu'à sa création et ne se modifie
   plus. Le rattachement est donc porté par des étiquettes de session : `god`, `master` + `rattache:god` pour les masters,
   `rattache:<master>` pour les sous-sessions (`tunnel`, `audit-campagnes`, `influenceurs`, `production`, `licences`,
   `gumroad`, `god`), `hors-qme` pour les sessions personnelles de Quentin. Une session sans étiquette `rattache:` est
   une orpheline à rattacher.
5. Une tâche planifiée qui n'a plus d'objet est **désactivée** ; elle n'est supprimée que si sa session n'existe plus
   (supprimer une tâche supprime les sessions qu'elle a lancées).

## Niveau 0 · GOD

| Session | Identifiant | Tâches planifiées |
|---|---|---|
| GOD · pilote des masters | `session_0183EW54bFyxAQcskkhnKJvb` | Bilan hebdomadaire QME, lundi 8:37 (`docs/pilotage/bilan-hebdo.md`) ; DMARC étape 3, rappel unique 07/12/2026 10:00 (repris le 28/11 de la session archivée) |

## Niveau 1 · Masters

| Pôle | Master | Identifiant | Tâches planifiées |
|---|---|---|---|
| Prospection | [MASTER] Prospection | `session_0183EW52kigizhxwrCTwperr` | Agent prospection QME, tous les jours 18:41 |
| Vente | [MASTER] Tunnel de vente | `session_0183EW52aSoTaYaYHgqbh564` | Master Tunnel de vente, tous les jours 19:17 |
| Prospection | [MASTER] Concept métier (ex-[R] Campagnes par concept) | `session_0183EW54tGg2Bhkayay2aBFc` | lun–ven 13:47 : lundi nouveau métier, mardi–vendredi suivi |
| Prospection | [MASTER] Audit campagnes ciblées | `session_0183EW52Pidz4waNkPnGH4aa` | aucune (pilote les campagnes ciblées) |
| Affiliation | [MASTER] Suivi influenceurs | `session_0183EW53pHmtjN8ttBAEgiRL` | Envoi lun–ven en 6 passages de 5 (9:07, 10:07, 12:07, 13:07, 15:07, 16:07) ; surveillance lun–ven 18:13 ; pause des fêtes 18/12 16:30, reprise 05/01/2027 8:30 (rappels uniques) |
| Contenu | [MASTER] Création contenu automatisé | `session_0183EW52wgFVmzKT8htV2NJ4` | Agent contenu, tous les jours 10:07 ; relances des actions de Quentin 8:43 |
| Contenu | [MASTER STORY] Mini-stories | `session_0183EW55iLAYXDKQ2SE6AK5p` | Mini-story QME du jour 8:40 (nouvelle session à chaque passage) |
| Production | [MASTER] Production (réalisation sur mesure, adaptations, licences) | `session_0183EW5525j63azBGK8khUzi` | aucune en propre (voir ses sous-sessions) |
| Produits | [MASTER] MAJ Gumroad | `session_0183EW569cgV6TXMdunVEq3r` | Agent Gumroad, tous les jours 8:55 |

Tâche sans session de rattachement (nouvelle session à chaque passage, rend compte au GOD) : Compteur QME · copie
Gumroad vers Sheet, 6:47.

## Niveau 2 · Sous-sessions

### Master Tunnel de vente (`[Tunnel]`, une par prospect)

| Prospect | Identifiant |
|---|---|
| Laetitia Jeannet Aigueperse · CD Pétanque Haute-Vienne | `session_0183EW54RUcji4hAZSt7uodf` |
| Laurent · Alpes Premium | `session_0183EW55J9roScKM2ESeUrbQ` |
| Christelle · Allegretto | `session_0183EW55NiCU5czywDq5adA8` |
| Inès · Agence Moor | `session_0183EW54LqZquqSEswnums98` |
| Armelle Derne · Qui Plus Est architectes | `session_0183EW52an9vojGtV2Nc74aR` |
| Bryan Durand · GMT Bordeaux | `session_0183EW53bhFMHeqjVPHoiyK8` |
| Kieran Hicks · Tignes Spirit | `session_0183EW53fsWt9dUdbsnnqhtD` |
| Nell Dumas · CS Charpennes-Tonkin | `session_0183EW53uESNGmbZfMQo88CE` |
| Barteau Traiteur | `session_0183EW55MVXWs6CFnqtCQmnH` |
| Christophe Yzet · Conseil | `session_0183EW51iRVxa46fHkFPenrD` |
| Axel Daumas · Royaumes & Légendes | `session_0183EW525aypjdrgc1Y1mcZo` |
| Alice Bacquart · Oh ! Délices Paysans | `session_0183EW53vwd5bULwmp7rXb7z` |
| Antoine Ferrero · Nic-Impex (ARVA) | `session_0183EW53zRyAJz6c8MuPbdFN` |
| Nathalie Delecroix · Compagnie Antarès | `session_0183EW55T5PbMQXnJLAUn5A6` |
| Sarah Villar · École de musique de Givry | `session_0183EW55JfsQS9L7DdrxK9ba` |
| Kelly Castiglione-Rouvière · Conciergerie en Provence | `session_0183EW52yPwRk9FGb3W4JjWc` |
| Guillaume Beck · L'Établi du Pendulier (créée le 28/11) | `session_0183EW55MNLHd33qMu6vio2B` |

Registre détaillé : `docs/prospection/CONVERSATIONS-TUNNEL.md`.

Rattachées le 28/11/2026 (travaux ponctuels terminés) : Note Bible `session_0183EW52ExnHdgMGqXXvFxRP`, dossier QM
Engineering `session_0183EW51PHZgvLPGeSbu7YNC`.

### Master Production

| Sous-session | Identifiant | Tâche planifiée |
|---|---|---|
| [Production] Licences (sous-master : clés, codes, accès, révocations) | `session_0183EW533FcUsTe1HcA8zwfT` | — |
| [Prod] Suivi culturel (extension de Suivi de lecture) | `session_0183EW52qThSki82JaFa3Mmc` | — |
| [Prod] Signature Bandeau | `session_0183EW53WSEgu9YFVBVXjCta` | — |
| Thème Bauhaus adouci (5 templates par jour) | `session_0183EW54f9eKdiEFyNH6fGoa` | tous les jours 11:17 (créée le 28/11 par Production ; mission en attente de confirmation de Quentin) |
| Réorganisation du site (terminée) | `session_0183EW552H8cooCuVYZeoDcW` | — |
| [T] Séquence mail (terminée) | `session_0183EW55zVFgUqWYeysD2BAt` | — |
| [Jeudi] Google Workspace et OVH DNS (bloquée, action de Quentin) | `session_0183EW52fA5UmNMi2ktu5t4w` | — |

Sous le sous-master Licences (étiquette `rattache:licences`) : Code gratuit Christian `session_0183EW54G4LCwrHQJkcPT9PQ`,
[T] Accès templates `session_0183EW55cRTBpkXBe8kL18yo`, [Jeudi] Accès Nexora Optim sélectif (bloquée, action de
Quentin) `session_0183EW51foEvDdu3DjCYUAin`.

### Master MAJ Gumroad

| Sous-session | Identifiant |
|---|---|
| Organiser les templates Gumroad (terminée) | `session_0183EW54MKL5Cu23AiRbZQtd` |

### Master Suivi influenceurs (`[Affiliation]`)

| Créateur | Identifiant |
|---|---|
| Thomas · L'homme de ménage (Agence 610) | `session_0183EW51rPyHFfJkxNm6rrSc` |
| Anthony · PÜLS (agence) | `session_0183EW53BTjAKKcxw2CtenKE` |
| Christian Bardin · OZ et sa Ruin'e | `session_0183EW51gKkAczNk3foHzzqB` |
| Angélique Benoit · Le van à la française | `session_0183EW51nnS4WjUqsixs71qM` |
| Template révision privé Laurine (terminée) | `session_0183EW52NMneAfhU45TUHTEM` |
| Prospection influenceurs et plaquette (terminée) | `session_0183EW53g3w1Gy5kmvKoNJCw` |

### Master Audit campagnes ciblées

| Campagne | Identifiant | Tâche planifiée |
|---|---|---|
| Fleuristes, micro-brasseries, ateliers-boutiques | `session_0183EW55oePc5BWAjxgsH9nS` | lun–sam 19:17 (`trig_01WVqfQjFLKcC2UfcsUpFuoX`) |
| Architectes d'intérieur | `session_0183EW54jpfkaxRdihnwFzqe` | lun–sam 19:13 |
| Campings indépendants | `session_0183EW51XCKV6j6CT8kv4Pr3` | lun–sam 19:07 (`trig_01KXodzVf1sDcmMqbYSbVmrj`) |
| Entreprises de propreté | `session_0183EW55x69Db3eNqY4ycbjE` | lun–sam 19:03 (`trig_015yctTuQsfk49XbFbyCto39`) |
| Écoles hors contrat et soutien scolaire | `session_0183EW52SiU89mtftYSJnhFS` | lun–sam 18:57 (`trig_016NWzdHjzHdLM393bxtDXyh`) |
| Coworkings et centres d'affaires | `session_0183EW54949UW8ZjsA3ZLoi5` | lun–sam 18:53 (`trig_01Y2gZHf3uETsyJmxXG2cpvz`) |
| Clubs organisateurs de compétitions | `session_0183EW55yN3YHworSdeaJnBc` | lun–sam 18:49 (`trig_01PRnPu4z5kjQ2xAipcUmwzf`) |
| Hôtels indépendants | `session_0183EW52j8x1dhF6LcauPDCh` | lun–sam 18:43 (`trig_01AaXBR8xfdZqWmjJRACbA9r`) |
| Pack BTP (rattachée le 27/11/2026) | `session_0183EW54xassSm7be2WnP5ua` | lun–sam 18:23 |
| Auto-écoles (rattachée le 27/11/2026) | `session_0183EW54G2qrTqwHfE1oZhxr` | lun–sam 18:17 |
| Gîtes (rattachée le 27/11/2026) | `session_0183EW55aNg9NK8EHAyFJVM6` | lun–sam 18:37 |
| Formation (terminée) | `session_0183EW51wZ39wGUMQBPQyksJ` | — |

## Autres tâches planifiées QME

| Tâche | Session | Quand |
|---|---|---|
| Compteur QME · copie Gumroad vers Sheet | nouvelle session à chaque passage (rend compte au GOD) | tous les jours 6:47 |
| Mini-story QME du jour | nouvelle session à chaque passage (master Mini-stories) | tous les jours 8:40 |

Désactivées (non supprimées, leur session existe encore) : ancien rappel DMARC (session archivée, repris par le GOD),
ancien bilan hebdomadaire, envoi Angélique du 25/11, dernière relance vagues 25 à 33, diaporamas J+14, file Gumroad
du 16/11, suivi promotion TikTok IG-27, reprises d'agents du 14/11.

### Sessions rattachées directement au GOD

| Sujet | Identifiant |
|---|---|
| Nexora #1813 (recherche QME par e-mail et site) | traité dans la session GOD, PR qmmorel-creator/nexora#1814 |
| Sessions arrêtées et compte rendu (audit du 27/11, terminé) | `session_0183EW52M87qRnEdJTbVsNUz` |

## Hors QME (même compte)

Sessions (étiquette `hors-qme`) : Artefacts personnels Nexora `session_0183EW538LwqdTS41cW34eEp`, Nexora import
`session_0183EW54egMzb7bPygaAnDK7`, Messages d'erreur au déploiement (pharma) `session_0183EW55Vs4ni8NYo8ALf6Sx`,
Prototype Thalcego parc éolien `session_0183EW55FFEuQUUfCb5qH4E8`.

Tâches : Tri Gmail (toutes les 2 h de 10 h à 18 h), Contrôle post-synchro bancaire, Import Bankin → Budget, Synchro dépenses Polo, Synchro Whoop vers
NutriQuest, Index du Drive : tâches personnelles de Quentin, hors du périmètre du GOD QME. Elles partagent le quota
d'usage du compte.

## Journal du registre

- 27/11/2026 : création. BTP, auto-écoles et gîtes rattachées au master Audit campagnes ciblées. Bilan hebdomadaire
  rattaché au GOD (nouvelle tâche ; l'ancienne, dans la session `cse_0183EW534wKDLESuAkAQHqve`, est désactivée).
  Cinq tâches planifiées dont la session n'existait plus supprimées. Heure des mini-stories alignée sur 20:15.
- 27/11/2026 (soir) : « [R] Campagnes par concept » devient [MASTER] Concept métier (sur-mesure à partir de 1 500 € HT,
  un métier par semaine, plaquette PDF + page simple). Tri Gmail (personnel) toutes les 2 h de 10 h à 18 h. Envoi
  affiliation en 6 passages de 5 mails (9:07, 10:07, 12:07, 13:07, 15:07, 16:07).
- 27/11/2026 (soir) : règle absolue d'autorité du GOD. Création du [MASTER] Production (devis signé → réalisation,
  adaptations de templates, sous-master Licences). Ancien logo bleu supprimé du dépôt (5 fichiers).
- 28/11/2026 : audit complet. Étiquettes posées sur 63 sessions (GOD, 9 masters, 49 sous-sessions,
  4 hors QME) ; 13 sessions sans master rattachées (Production, Licences, Gumroad, Influenceurs, Tunnel, GOD), les
  sessions personnelles marquées `hors-qme`. Rappel DMARC du 07/12 repris par le GOD (l'ancien, lié à une session
  archivée, est désactivé). Ajout des sous-sessions de Production et de la tâche « Bauhaus adouci » (11:17).
- 28/11/2026 (après-midi) : les 8 campagnes ciblées #331 à #338 sont fusionnées et actives (827 mails en file),
  chacune avec sa tâche de pilotage du lundi au samedi (18:43 à 19:17), compte rendu au master Audit. Mission
  « Bauhaus adouci » confirmée par Quentin (via le GOD) : fusion autorisée si vérifications vertes, aucun nouvel échec
  de test et captures regardées. Annonce Habitudes : aucun acheteur ni testeur au 28/11, rien envoyé.
