# Production QME · réalisations sur mesure et licences

Pôle créé le 27/11/2026 à la demande de Quentin (session GOD). Dossier `docs/` : non publié par Netlify (404).

| Rôle | Session | Identifiant |
|---|---|---|
| Master du pôle | [MASTER] Production | `session_0183EW5525j63azBGK8khUzi` |
| Sous-master | [Production] Licences | `session_0183EW533FcUsTe1HcA8zwfT` |
| Une par réalisation | `[Prod] <Prénom Nom> · <Entreprise>` | registre ci-dessous |

Le master rend compte au GOD (`session_0183EW54bFyxAQcskkhnKJvb`) ; Licences et chaque `[Prod]` rendent compte au master.

## 1. Périmètre

- **Réalisations** : outils sur mesure et adaptations de templates, pour les clients sur mesure **et** pour les
  acheteurs Gumroad qui demandent une modification payante.
- **Licences** : clés Gumroad, codes d'accès, révocations, accès des clients, versions déployées chez chaque client.
- **Hors périmètre** : prospection, concepts avant signature, devis et négociation (Master Tunnel de vente) ; fiches
  produits, prix et mises en vente Gumroad (agent Gumroad) ; affiliation (Master Suivi influenceurs).

## 2. Passage de relais depuis le Tunnel de vente

**Déclencheur unique : devis accepté.** Le Tunnel (`session_0183EW52aSoTaYaYHgqbh564`, ou la conversation `[Tunnel]` du
prospect) a déjà fait, le jour même (`PROMPT-MASTER-TUNNEL-VENTE.md` § 2) : devis `accepte`, contrat `actif`, facture
d'acompte `a-emettre`, client `signe`, prospect `gagne`, État global « Signé », PDF signé dans `06 - Contrat et factures`.

Il envoie au master Production (`send_message`) le dossier de passation :

1. client : id de la fiche client, fiche prospect, projet Nexora, Note Bible, dossier Drive, conversation `[Tunnel]` ;
2. engagement : numéro et version du devis signé, montants (fixe, options retenues, mensuel), échéancier, date de
   mise en service promise ;
3. contenu : page concept, démo, proposition, comptes rendus de réunion, points de vigilance (données sensibles,
   outils existants à brancher, hébergement) ;
4. interlocuteurs côté client et canal préféré.

Le master vérifie que ces éléments sont dans Nexora (`get_qme` client et devis). Un dossier incomplet est renvoyé au
Tunnel avec la liste des manques ; **aucune réalisation ne démarre sur un devis non accepté**.

La conversation `[Tunnel]` reste ouverte jusqu'à la mise en service (facturation, échanges commerciaux) ; la
conversation `[Prod]` porte le travail technique. Elles s'informent mutuellement par `send_message`.

### Acheteur Gumroad qui demande une modification

La demande arrive par mail ou par Gumroad. Elle suit le même chemin : chiffrage et devis par le Tunnel de vente,
puis passation ici une fois le devis accepté. Petite modification (moins d'une demi-journée) : devis simplifié, même
règle.

## 3. Étapes d'une réalisation

| # | Étape | Qui | Écritures |
|---|---|---|---|
| 1 | Ouverture | master | `create_session` titre `[Prod] <Prénom Nom> · <Entreprise>`, tags `production` et `prod:<slug>`, dépôt qme-engineering ; ligne au registre (§ 6) ; id noté dans les `notes` de la fiche client ; signalé au GOD |
| 2 | Cadrage | `[Prod]` | cahier des charges court tiré du devis signé et des comptes rendus : modules, données, accès, critères de recette ; tâche Réunions si un point de lancement est nécessaire |
| 3 | Planning | `[Prod]` | jalons (lot, recette, mise en service) en tâches du projet Nexora ; date de mise en service dans la fiche client (`prochaineAction`, `dateAction`) |
| 4 | Développement | `[Prod]` | branche `claude/prod-<slug>`, PR vers `main` non fusionnée ; démo sur l'aperçu Netlify de la PR, données fictives |
| 5 | Recette | `[Prod]` + Quentin | aperçu soumis à Quentin, puis au client (brouillon de mail, jamais envoyé sans Quentin) ; retours datés dans `echanges` ; corrections sur la même branche |
| 6 | Mise en service | master | fusion **uniquement sur feu vert de Quentin** ; fiche client `prodUrl` et `miseEnService` ; accès remis par Licences (§ 5) ; PDF de procès-verbal ou de livraison dans `06` (ou `07 - Autres documents`), Note Bible |
| 7 | Facturation | Tunnel | facture de solde ou d'étape `a-emettre` selon l'échéancier du devis ; contrat mensuel s'il y en a un |
| 8 | Clôture | `[Prod]` | bilan dans l'État global et au master ; registre en « livré » ; la session reste ouverte pour la maintenance si un contrat mensuel existe |

Règles communes : signature « Bandeau » et Floriane Jolliot en Cc visible sur tout mail personnalisé (CLAUDE.md) ;
Nexora mis à jour **le jour même** de chaque action ; tout PDF émis rangé dans Drive (`RANGEMENT-DRIVE.md`) et ajouté à la
Note Bible ; rien de secret dans le dépôt (identifiants clients, clés d'API restent hors git).

## 4. Pilotage par le master

- Tient le registre (§ 6) et le planning de toutes les réalisations.
- Transmet aux `[Prod]` les messages du client reçus par le Tunnel ou par Gmail.
- Regroupe les validations attendues de Quentin et les envoie au GOD (aperçus, brouillons, fusions).
- Ne fait pas le travail d'une réalisation à la place de sa conversation `[Prod]`, sauf si elle est indisponible et
  qu'une échéance tombe le jour même (signalé au GOD).

## 5. Licences (sous-master `[Production] Licences`)

Partage avec l'agent Gumroad (`session_0183EW569cgV6TXMdunVEq3r`) :

| Licences | Agent Gumroad |
|---|---|
| option « clé de licence » vérifiée sur chaque fiche ; identifiant `gumroad` de `PRODUITS` et `FUSIONNES` (`netlify/lib/templates-acces.mjs`) cohérent | fiches produits, prix, descriptions, packs, publication et dépublication |
| codes d'accès hors Gumroad : `TEMPLATES_SECRET=… npm run code -- <PRODUIT> 1`, ligne le jour même dans `docs/templates/codes-gratuits.md` | — |
| révocation : Id ajouté à `TEMPLATES_CODES_REVOQUES` (Netlify), statut `révoqué` | — |
| suivi des acheteurs : produit, version, accès perdu, remboursement | lecture des ventes pour ses écarts |
| accès des clients sur mesure et versions déployées chez chacun | — |

Licences ne modifie aucune fiche Gumroad : un écart lui est signalé, il le transmet à l'agent Gumroad. Aucun code
offert, aucune révocation, aucune modification de variable Netlify sans l'accord de Quentin.

## 6. Registre des réalisations

| Client | Devis signé | Conversation `[Prod]` | Branche / PR | Mise en service prévue | État |
|---|---|---|---|---|---|
| — | — | — | — | — | aucune au 27/11/2026 |

État au 27/11/2026 (Nexora) : aucun devis `accepte`, aucun client `signe`, aucun contrat. Dossiers les plus proches :
ARVA (QME-2026-013, 19 500 € HT, brouillon, appel le 01/12), École de musique de Givry (QME-2026-011 v2, 790 € HT,
envoyé), Compagnie Antarès (QME-2026-012, contre-proposition ~1 200 € HT en attente).
