# Routine d'envoi et de surveillance · affiliation vague 2

Mise en place le 16/11/2026 à la demande de Quentin : **envoi autonome, sans validation**, 30 mails par
jour ouvré, et surveillance quotidienne. Deux tâches planifiées se déclenchent dans la session Claude
qui les a créées (elle seule a accès à Gmail et Google Sheets) :

| Tâche | Quand (heure de Paris) | Id |
|---|---|---|
| Affiliation QME · envoi (30/jour) | lundi–vendredi, 9 h 07 à 17 h 07, toutes les heures | `trig_01KqME2ZeqiJUAzJUosvu49x` |
| Affiliation QME · surveillance quotidienne | lundi–vendredi, 18 h 13 | `trig_01XvvqPhSnTNyvgprvGZgKgo` |

**Tableur** (source unique) : « QME · Affiliation · file d'envoi »,
id `1WL_lNTRSAUuCug93kgxNhLe6CSQI5icky75IrYlkpiQ`, onglet `Untitled`.
Colonnes : A ordre, B statut (`à envoyer`, `envoyé`, `rebond`, `désinscrit`, `erreur : …`),
C draftId, D destinataire, E créateur, F segment, G objet, H à vérifier, I date envoi
(`AAAA-MM-JJ HH:MM`, Paris), J messageId, K threadId, L réponse, M rebond.
Pilotage : **O2 PAUSE** (`oui`/`non`, Quentin peut l'écrire à tout moment), **P2 quota par jour** (30 depuis le 16/11 au soir),
Q2 dernier bilan, R2 motif de pause.

**Tableau de bord** : https://claude.ai/artifact/U3uQzabo3hRRKoBegRGEQ2 (lit le tableur en direct,
rien à mettre à jour à la main).

## Envoi (à chaque déclenchement)

1. Lire O2:P2. Si O2 = « oui » : ne rien envoyer.
2. Lire A2:M400. Compter les lignes dont I commence par la date du jour (Paris), **quel que soit le
   statut** (Quentin peut passer une ligne envoyée en « retiré »).
   reste = P2 − ce compte ; si ≤ 0, s'arrêter.
3. n = min(3, reste) ; à 17 h ou plus, n = reste.
4. Pour les n premières lignes « à envoyer » (ordre A croissant) : Gmail `send_message` avec
   **uniquement** `draftId` = C. Succès : B « envoyé », I date-heure, J id du message, K threadId.
   Échec (après un nouvel essai) : B « erreur : motif ».
5. Ne jamais modifier une ligne qui n'est pas « à envoyer », ni les colonnes L et suivantes écrites par
   Quentin. Interdits : tout autre envoi, toute réponse, toute création, modification ou suppression de
   brouillon, toute modification de O2:R2.

## Surveillance (chaque jour ouvré à 18 h 13)

1. **Rebonds** : rechercher dans Gmail `from:(mailer-daemon OR postmaster) newer_than:2d`, retrouver
   l'adresse en échec dans le message, et sur sa ligne écrire M « oui » et B « rebond ».
2. **Réponses** : pour chaque ligne envoyée sans réponse notée, lire le fil K (format minimal).
   Un message d'un autre expéditeur que quentin.morel@qm-engineering.fr → L « oui · AAAA-MM-JJ ·
   extrait de 100 caractères ». Si la réponse demande l'arrêt (« stop », « désinscrire », « ne plus
   recevoir ») → B « désinscrit ».
3. **Bilan** dans Q2 : « AAAA-MM-JJ : X envoyés, Y rebonds (Z %), W réponses, V stop ».
4. **Garde-fou** : si au moins 20 envois et taux de rebond > 3 %, écrire O2 « oui » et R2 le motif.
   Les signalements comme spam ne sont pas visibles depuis Gmail : surveiller le taux de réponse et
   les rebonds pour « bloqué » ou « spam ».
5. **Notification push** à Quentin : le bilan et la liste des nouvelles réponses à traiter.
6. Ne répondre à aucun mail : les réponses sont traitées par Quentin.

## Arrêter ou modifier

- Pause immédiate : écrire `oui` dans O2 du tableur.
- Changer le rythme : modifier P2.
- Retirer un créateur : passer son statut en `retiré` (la routine n'envoie que `à envoyer`).
- Arrêt définitif : demander à Claude de supprimer les deux tâches planifiées.
