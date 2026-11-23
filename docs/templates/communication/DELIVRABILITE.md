# Délivrabilité des e-mails qm-engineering.fr

Mise en place le 23/11/2026, à la demande de Quentin. Objectif : que tout e-mail signé `@qm-engineering.fr` (prospection,
réponses, mails automatiques du site) soit authentifié par le domaine, pour sortir des indésirables.

## Configuration en place

| Élément | Valeur |
|---|---|
| Réception | MX OVH (`mx0` à `mx3.mail.ovh.net`), boîte `quentin.morel@qm-engineering.fr` redirigée vers le Gmail de Quentin |
| Envoi depuis Gmail | « Envoyer en tant que » `quentin.morel@qm-engineering.fr` par le SMTP d'OVH : `ssl0.ovh.net`, port 465, SSL, identifiant = l'adresse complète |
| Envoi du site | `netlify/lib/mail.mjs`, mêmes serveur et boîte (variables Netlify `ESSAI_SMTP_*`, cf. `docs/templates/essai-gratuit.md`) |
| SPF | `v=spf1 include:mx.ovh.com ~all` |
| DKIM | activé chez OVH : CNAME `ovhmo-selector-1` et `ovhmo-selector-2` (`._domainkey`) |
| DMARC | `v=DMARC1; p=none; rua=mailto:quentin.morel@qm-engineering.fr; aspf=r` (observation) |

Vérifié le 23/11/2026 : test mail-tester 10/10 depuis Gmail ; lien de connexion du site reçu par Gmail avec
`spf=pass`, `dkim=pass` (`d=qm-engineering.fr`, `s=ovhmo-selector-1`) et `dmarc=pass`.

## Pourquoi pas l'envoi direct par Gmail

Un Gmail personnel envoie avec un Return-Path `@gmail.com` et une signature DKIM `gmail.com` : ni le SPF ni le DKIM ne
sont alignés sur `qm-engineering.fr`, donc le DMARC échoue. Ajouter Google au SPF n'y change rien. Seuls un envoi par
OVH ou un Google Workspace sur le domaine règlent le problème ; Workspace a été écarté (coût, migration du Drive, de
l'agenda, des connecteurs et des routines, tous sur le compte Gmail).

## Règles

- **Tout nouvel outil qui envoie avec une adresse `@qm-engineering.fr`** (Gumroad, outil d'e-mailing, formulaire…) doit
  passer par la boîte OVH en SMTP, ou être ajouté au SPF et signer en DKIM pour le domaine. Sinon, il échouera au DMARC
  dès le passage à `p=quarantine`.
- Changer le mot de passe de la boîte OVH impose de le reporter dans Gmail (« Envoyer en tant que ») et dans Netlify
  (`ESSAI_SMTP_MOT_DE_PASSE`), puis de redéployer.
- Une variable Netlify modifiée ne s'applique qu'au déploiement suivant.

## Étape suivante : durcir le DMARC

Rappel programmé le 07/12/2026 à 10:00.

1. Lire les rapports DMARC agrégés reçus depuis le 23/11 (pièces jointes `.zip`, `.gz` ou `.xml` envoyées à
   `quentin.morel@qm-engineering.fr` par google.com, outlook.com…) ; vérifier que chaque source légitime passe.
2. Si tout est propre : dans la zone DNS OVH, remplacer l'enregistrement TXT `_dmarc` par
   `v=DMARC1; p=quarantine; rua=mailto:quentin.morel@qm-engineering.fr; adkim=r; aspf=r`.
3. Plus tard, facultatif : `p=reject` après plusieurs semaines sans échec.

Aucune modification DNS sans le feu vert de Quentin.
