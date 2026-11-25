# Routine d'envoi et de surveillance · affiliation, version Nexora (à partir de la migration)

Décision de Quentin du 24/11/2026 : la file d'envoi de l'affiliation quitte le Google Sheet « QME · Affiliation ·
file d'envoi » (`1WL_lNTRSAUuCug93kgxNhLe6CSQI5icky75IrYlkpiQ`, gelé en archive) pour **Nexora Optim › QME ›
Affiliation**, lue et écrite par le MCP Nexora (`get_qme`, `list_qme`, `mutate_qme`). Ce fichier remplace
`affiliation-routine.md` (branche `claude/charming-volta-11unpk`) **le jour de la migration**, pas avant : tant que les
créateurs ne sont pas dans Nexora, les routines restent sur le Sheet.

Prérequis : le connecteur MCP Nexora est disponible dans la session où se déclenchent les deux tâches
(session `session_0183EW53pHmtjN8ttBAEgiRL`), en plus de Gmail.

| Tâche | Quand (heure de Paris) | Id |
|---|---|---|
| Affiliation QME · envoi (30/jour) | lundi–vendredi, 9 h 07 à 17 h 07, toutes les heures | `trig_01KqME2ZeqiJUAzJUosvu49x` |
| Affiliation QME · surveillance quotidienne | lundi–vendredi, 18 h 13 | `trig_01XvvqPhSnTNyvgprvGZgKgo` |

Correspondance avec l'ancien tableur : A ordre → `ordre` ; B statut → `etape` (`a-envoyer`, `envoye`, `rebond`,
`oppose`, `retire`…) ; C draftId → `draftId` ; D destinataire → `email` ; E créateur → `nom` ; F → `segment` ;
G → `objet` ; H → `aVerifier` ; I date envoi → `dateEnvoi` (jour seul) ; J → `messageId` ; K → `threadId` ;
L réponse → `reponse` ; M rebond → `rebond`. Pilotage : O2 PAUSE → `pilotage.pause`, P2 quota → `pilotage.quotaJour`,
Q2 bilan → `pilotage.dernierBilan`, R2 motif → `pilotage.motifPause` (`get_qme` / `mutate_qme` `entity: "pilotage"`).
Quentin pilote depuis Optim (`/qme/affiliation` : bouton pause, quota) ou en le demandant à Claude.

## Envoi (à chaque déclenchement)

1. `get_qme` `entity: "pilotage"`. Si `pause` vaut true : ne rien envoyer.
2. `list_qme` `domain: "createurs"`, `limit: 200`, en suivant `nextOffset` jusqu'au bout. Compter les créateurs
   dont `dateEnvoi` est la date du jour à Paris, **quelle que soit l'étape**. reste = `quotaJour` − ce compte ;
   si ≤ 0, s'arrêter.
3. n = min(3, reste) ; à 17 h ou plus, n = reste.
4. Pour les n premiers créateurs à l'étape `a-envoyer` (ordre croissant) dont `aVerifier` ne commence pas par
   « erreur » : Gmail `send_message` avec **uniquement** `draftId`. Succès : `mutate_qme` `entity: "createur"`,
   `action: "update"`, `changes: { etape: "envoye", dateEnvoi: <jour>, messageId, threadId }`. Échec après un
   nouvel essai : `changes: { aVerifier: "erreur : <motif>" }` (le créateur n'est plus pris par la routine).
5. Ne jamais modifier un créateur qui n'est pas à l'étape `a-envoyer`, ni ses champs `reponse`, `notes`,
   `prochaineAction`. Interdits : tout autre envoi, toute réponse, toute création, modification ou suppression de
   brouillon, toute modification du pilotage.

## Surveillance (chaque jour ouvré à 18 h 13)

1. **Rebonds** : Gmail `from:(mailer-daemon OR postmaster) newer_than:2d`, retrouver l'adresse en échec, et sur sa
   fiche : `etape: "rebond"`, `rebond: "oui · AAAA-MM-JJ"`.
2. **Réponses** : pour chaque créateur à l'étape `envoye` sans `reponse`, lire le fil `threadId` (format minimal).
   Un message d'un autre expéditeur que quentin.morel@qm-engineering.fr → `reponse: "AAAA-MM-JJ · extrait de 100
   caractères"` (l'étape reste `envoye` : le classement est fait par les skills `retour-affiliation` et
   `nettoyage-refus-prospection`). Si la réponse demande l'arrêt (« stop », « désinscrire », « ne plus recevoir ») :
   `etape: "oppose"`, et inscription le jour même sur la liste d'opposition du site (`REGLES-PROSPECTION.md`).
3. **Bilan** : `mutate_qme` `entity: "pilotage"`, `changes: { dernierBilan: "AAAA-MM-JJ : X envoyés, Y rebonds (Z %),
   W réponses, V stop" }`.
4. **Garde-fou** : si au moins 20 envois et un taux de rebond > 3 % : `changes: { pause: true, motifPause: "<motif>" }`.
5. **Notification push** à Quentin : le bilan et les nouvelles réponses à traiter (créateurs `envoye` avec une
   `reponse`).
6. Ne répondre à aucun mail.

## Textes des tâches planifiées (à poser avec `update_trigger` le jour de la migration)

**Affiliation QME · envoi (30/jour)** :

> [Routine d'envoi affiliation · demandée par Quentin, sans validation] Applique la section « Envoi » de
> `docs/templates/communication/affiliation-routine-nexora.md` (dépôt qme-engineering, main). File d'envoi dans
> Nexora Optim › QME (MCP Nexora : get_qme entity pilotage, list_qme domain createurs, mutate_qme entity createur).
> Si le connecteur Nexora est indisponible : ne rien envoyer et le dire en une ligne. Jamais d'autre envoi, de
> réponse, de modification de brouillon, ni de changement du pilotage. Réponse finale en une ligne.

**Affiliation QME · surveillance quotidienne** :

> [Surveillance affiliation · demandée par Quentin] Applique la section « Surveillance » de
> `docs/templates/communication/affiliation-routine-nexora.md` (dépôt qme-engineering, main) : rebonds → étape
> rebond ; réponses → champ reponse ; « stop » → étape oppose et liste d'opposition du site ; bilan et garde-fou
> dans le pilotage (mutate_qme entity pilotage) ; notification push avec le bilan et les nouvelles réponses à
> traiter. Ne répondre à aucun mail. Si le connecteur Nexora est indisponible : ne rien écrire et le signaler.
