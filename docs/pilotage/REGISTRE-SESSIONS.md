# Registre des sessions QME · GOD, masters, sous-sessions

Tenu par la session GOD. Créé le 27/11/2026 (audit des 200 sessions les plus récentes et des tâches planifiées).
Heures en heure de Paris. Organigramme visuel : artefact « Organigramme des sessions QME »
(https://claude.ai/artifact/FFwcXuLnGaVSkuqJABenrW, privé).

## Règles

1. Trois niveaux : **GOD** → **MASTER** → sous-sessions. Une session de travail durable a toujours un master.
2. Un master rend compte au GOD quand il crée une sous-session, une tâche planifiée récurrente ou un blocage qui
   dépend de Quentin (`send_message` vers le GOD).
3. Le GOD ne fait pas le travail métier : il arbitre, transmet, débloque et tient ce registre à jour.
4. Une tâche planifiée qui n'a plus d'objet est **désactivée** ; elle n'est supprimée que si sa session n'existe plus
   (supprimer une tâche supprime les sessions qu'elle a lancées).

## Niveau 0 · GOD

| Session | Identifiant | Tâches planifiées |
|---|---|---|
| GOD · pilote des masters | `session_0183EW54bFyxAQcskkhnKJvb` | Bilan hebdomadaire QME, lundi 8:37 (`docs/pilotage/bilan-hebdo.md`) |

## Niveau 1 · Masters

| Pôle | Master | Identifiant | Tâches planifiées |
|---|---|---|---|
| Prospection | [MASTER] Prospection | `session_0183EW52kigizhxwrCTwperr` | Agent prospection QME, tous les jours 18:41 |
| Vente | [MASTER] Tunnel de vente | `session_0183EW52aSoTaYaYHgqbh564` | Master Tunnel de vente, tous les jours 19:17 |
| Prospection | [MASTER] Concept métier (ex-[R] Campagnes par concept) | `session_0183EW54tGg2Bhkayay2aBFc` | lun–ven 13:47 : lundi nouveau métier, mardi–vendredi suivi |
| Prospection | [MASTER] Audit campagnes ciblées | `session_0183EW52Pidz4waNkPnGH4aa` | aucune (pilote les campagnes ciblées) |
| Affiliation | [MASTER] Suivi influenceurs | `session_0183EW53pHmtjN8ttBAEgiRL` | Envoi lun–ven 9:07→17:07 (horaire) ; surveillance lun–ven 18:13 |
| Contenu | [MASTER] Création contenu automatisé | `session_0183EW52wgFVmzKT8htV2NJ4` | Agent contenu, tous les jours 10:07 ; relances des actions de Quentin 8:43 |
| Contenu | [MASTER STORY] Mini-stories | `session_0183EW55iLAYXDKQ2SE6AK5p` | Mini-story QME du jour 8:40 (nouvelle session à chaque passage) |
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

Registre détaillé : `docs/prospection/CONVERSATIONS-TUNNEL.md`.

### Master Suivi influenceurs (`[Affiliation]`)

| Créateur | Identifiant |
|---|---|
| Thomas · L'homme de ménage (Agence 610) | `session_0183EW51rPyHFfJkxNm6rrSc` |
| Anthony · PÜLS (agence) | `session_0183EW53BTjAKKcxw2CtenKE` |
| Christian Bardin · OZ et sa Ruin'e | `session_0183EW51gKkAczNk3foHzzqB` |
| Angélique Benoit · Le van à la française | `session_0183EW51nnS4WjUqsixs71qM` |

### Master Audit campagnes ciblées

| Campagne | Identifiant | Tâche planifiée |
|---|---|---|
| Fleuristes, micro-brasseries, ateliers-boutiques | `session_0183EW55oePc5BWAjxgsH9nS` | — |
| Architectes d'intérieur | `session_0183EW54jpfkaxRdihnwFzqe` | — |
| Campings indépendants | `session_0183EW51XCKV6j6CT8kv4Pr3` | — |
| Entreprises de propreté | `session_0183EW55x69Db3eNqY4ycbjE` | — |
| Écoles hors contrat et soutien scolaire | `session_0183EW52SiU89mtftYSJnhFS` | — |
| Coworkings et centres d'affaires | `session_0183EW54949UW8ZjsA3ZLoi5` | — |
| Clubs organisateurs de compétitions | `session_0183EW55yN3YHworSdeaJnBc` | — |
| Hôtels indépendants | `session_0183EW52j8x1dhF6LcauPDCh` | — |
| Pack BTP (rattachée le 27/11/2026) | `session_0183EW54xassSm7be2WnP5ua` | lun–sam 18:23 |
| Auto-écoles (rattachée le 27/11/2026) | `session_0183EW54G2qrTqwHfE1oZhxr` | lun–sam 18:17 |
| Gîtes (rattachée le 27/11/2026) | `session_0183EW55aNg9NK8EHAyFJVM6` | lun–sam 18:37 |
| Formation (terminée) | `session_0183EW51wZ39wGUMQBPQyksJ` | — |

## Autres tâches planifiées QME

| Tâche | Session | Quand |
|---|---|---|
| Délivrabilité DMARC · étape 3 (rappel unique) | `session_0183EW52huXu1qXosVjgaYTz` | 07/12/2026 10:00 |
| Vérifier la mini-story test (rappel unique) | master Mini-stories | 27/11/2026 20:35 |

### Session hors master, rattachée au GOD

| Sujet | Identifiant |
|---|---|
| Nexora #1813 (recherche QME par e-mail et site) | traité dans la session GOD, PR qmmorel-creator/nexora#1814 |

## Hors QME (même compte)

Tri Gmail horaire, Contrôle post-synchro bancaire, Import Bankin → Budget, Synchro dépenses Polo, Synchro Whoop vers
NutriQuest, Index du Drive : tâches personnelles de Quentin, hors du périmètre du GOD QME. Elles partagent le quota
d'usage du compte.

## Journal du registre

- 27/11/2026 : création. BTP, auto-écoles et gîtes rattachées au master Audit campagnes ciblées. Bilan hebdomadaire
  rattaché au GOD (nouvelle tâche ; l'ancienne, dans la session `cse_0183EW534wKDLESuAkAQHqve`, est désactivée).
  Cinq tâches planifiées dont la session n'existait plus supprimées. Heure des mini-stories alignée sur 20:15.
- 27/11/2026 (soir) : « [R] Campagnes par concept » devient [MASTER] Concept métier (sur-mesure à partir de 1 500 € HT,
  un métier par semaine, plaquette PDF + page simple). Tri Gmail (personnel) toutes les 2 h de 10 h à 18 h. Envoi
  affiliation en 6 passages de 5 mails (9:07, 10:07, 12:07, 13:07, 15:07, 16:07).
