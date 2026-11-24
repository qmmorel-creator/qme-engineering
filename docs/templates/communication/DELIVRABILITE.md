# Délivrabilité des e-mails qm-engineering.fr

Mise en place le 23/11/2026, à la demande de Quentin. Objectif : que tout e-mail signé `@qm-engineering.fr` (prospection,
réponses, mails automatiques du site) soit authentifié par le domaine, pour sortir des indésirables.

## Configuration en place (depuis le 24/11/2026 : réception par Google Workspace)

| Élément | Valeur |
|---|---|
| Réception | MX `1 smtp.google.com` : boîte **Google Workspace** `quentin.morel@qm-engineering.fr` (abonnement pris par Quentin le 24/11/2026) |
| Transfert | Workspace → `qm.morel@gmail.com`, copie conservée dans Workspace (Paramètres › Transfert et POP/IMAP) |
| Rangement dans le Gmail perso | filtre : libellé **`Transfert Workspace`**, archivé (jamais en boîte de réception), jamais en spam. Critère : voir « Filtre du Gmail perso » ci-dessous |
| Envoi des mails écrits par Quentin et des brouillons de l'assistant | depuis le **Gmail perso**, « Envoyer en tant que » `quentin.morel@qm-engineering.fr` par le SMTP d'OVH (`ssl0.ovh.net`, port 465, SSL). Décision du 24/11/2026 (option 1) : on n'écrit pas depuis Workspace, dont les envois sont invisibles pour l'assistant |
| Envoi du site | `netlify/lib/mail.mjs`, SMTP d'OVH avec la boîte OVH (variables Netlify `ESSAI_SMTP_*`, cf. `docs/templates/essai-gratuit.md`) |
| SPF | `v=spf1 include:_spf.google.com include:mx.ovh.com ~all` (OVH pour le site et Gmail perso, Google pour Workspace) |
| DKIM | OVH : CNAME `ovhmo-selector-1` et `ovhmo-selector-2` (`._domainkey`) ; Google : TXT `google._domainkey` (RSA 2048, publié le 24/11/2026) |
| DMARC | `v=DMARC1; p=none; rua=mailto:quentin.morel@qm-engineering.fr; aspf=r` (observation ; rapports reçus dans Workspace puis transférés) |

Vérifié le 23/11/2026 (avant Workspace) : test mail-tester 10/10 depuis Gmail ; lien de connexion du site reçu par Gmail
avec `spf=pass`, `dkim=pass` (`d=qm-engineering.fr`, `s=ovhmo-selector-1`) et `dmarc=pass`.

Vérifié le 24/11/2026 : MX Google visible partout ; réception dans Workspace confirmée par un mail extérieur (18:33) ;
SPF et clé DKIM Google publiés. Reste à vérifier sur le premier vrai mail transféré : libellé et archivage du filtre.

### La boîte OVH reste indispensable

Elle ne reçoit plus rien (MX chez Google), mais **le site et le Gmail perso envoient par son SMTP**. Ne pas résilier
l'offre e-mail OVH ni supprimer la boîte. Sa redirection vers le Gmail perso peut rester : elle ne sert plus.

### Filtre du Gmail perso

Critère (champ « Contient les mots ») :
`{deliveredto:quentin.morel@qm-engineering.fr to:quentin.morel@qm-engineering.fr cc:quentin.morel@qm-engineering.fr}`.
`to:`/`cc:` attrapent les mails adressés à l'adresse pro ; `deliveredto:` les copies où elle n'est qu'en copie cachée
(copies des mails du site). Un mail que le Gmail perso s'envoie à lui-même ne prouve rien (Gmail le fusionne avec
l'envoi) : tester avec un expéditeur extérieur.

### Recherches de l'assistant

- Mails reçus à l'adresse pro : `label:transfert-workspace` dans le Gmail perso (archivés, donc hors boîte de réception).
- Mails envoyés : `in:sent` du Gmail perso (expéditeur `quentin.morel@qm-engineering.fr`).
- Avant le 24/11/2026 au soir, les mails pro arrivaient par la redirection OVH, sans ce libellé (libellé `qme`).
- Ce que Quentin écrirait directement depuis Workspace n'est pas visible : à éviter (option 1).

## Pourquoi l'envoi par OVH depuis le Gmail perso

Un Gmail personnel envoie avec un Return-Path `@gmail.com` et une signature DKIM `gmail.com` : ni le SPF ni le DKIM ne
sont alignés sur `qm-engineering.fr`, donc le DMARC échoue. D'où l'« Envoyer en tant que » par le SMTP d'OVH, aligné
sur le domaine. Workspace, pris le 24/11/2026, sert à la réception ; écrire depuis Workspace serait aussi authentifié
(SPF et DKIM Google en place), mais ces envois échappent à l'assistant, qui ne lit que le Gmail perso.

## Règles

- **Tout nouvel outil qui envoie avec une adresse `@qm-engineering.fr`** (Gumroad, outil d'e-mailing, formulaire…) doit
  passer par la boîte OVH (ou Workspace) en SMTP, ou être ajouté au SPF et signer en DKIM pour le domaine. Sinon, il échouera au DMARC
  dès le passage à `p=quarantine`.
- Changer le mot de passe de la boîte OVH impose de le reporter dans Gmail (« Envoyer en tant que ») et dans Netlify
  (`ESSAI_SMTP_MOT_DE_PASSE`), puis de redéployer.
- Une variable Netlify modifiée ne s'applique qu'au déploiement suivant.

## Voir les e-mails envoyés par le site

Le SMTP d'OVH ne garde aucune copie : les e-mails du site n'apparaissent ni dans « Messages envoyés » de Gmail ni dans
« Éléments envoyés » du webmail OVH (qui ne contient que ce qui est écrit depuis le webmail).

- **Copie cachée (règle du 24/11/2026)** : chaque e-mail des séquences automatiques (essai : merci, prise en main,
  rappel, fin, effacement ; achat : remerciement ; accompagnement J+3 après achat) part avec
  `quentin.morel@qm-engineering.fr` en copie cachée (`netlify/lib/mail.mjs`). La copie arrive
  dans Workspace (depuis le 24/11/2026), puis, transférée, dans le Gmail perso sous le libellé `Transfert Workspace` :
  recherche `label:transfert-workspace from:quentin.morel@qm-engineering.fr`.
  Sans copie : codes et liens de connexion (ils ouvrent le compte d'un client), notifications adressées à Quentin,
  annonces envoyées en nombre. Couper : variable Netlify `ESSAI_COPIE_CACHEE=non`, puis redéployer.
- **Journaux Netlify** de la fonction `essais-quotidien` (chaque jour à 9:10, Paris) : nombre d'e-mails envoyés par type
  (`Essais gratuits : …`, `Accompagnements d'achat : …`), sans adresse.
- **Page admin des essais** (`/admin/essais/`, code administrateur) : colonne des e-mails envoyés pour chaque essai.

## Étape suivante : durcir le DMARC

Rappel programmé le 07/12/2026 à 10:00.

1. Lire les rapports DMARC agrégés reçus depuis le 23/11 (pièces jointes `.zip`, `.gz` ou `.xml` envoyées à
   `quentin.morel@qm-engineering.fr` par google.com, outlook.com…) ; vérifier que chaque source légitime passe.
2. Si tout est propre : dans la zone DNS OVH, remplacer l'enregistrement TXT `_dmarc` par
   `v=DMARC1; p=quarantine; rua=mailto:quentin.morel@qm-engineering.fr; adkim=r; aspf=r`.
3. Plus tard, facultatif : `p=reject` après plusieurs semaines sans échec.

Aucune modification DNS sans le feu vert de Quentin.
