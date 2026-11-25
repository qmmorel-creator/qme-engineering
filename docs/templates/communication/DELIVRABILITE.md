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

## Essai Google Workspace (24/11/2026), abandonné

Quentin a pris un abonnement Workspace le 24/11/2026 (MX passé sur `smtp.google.com`, SPF et DKIM Google ajoutés,
transfert vers le Gmail perso), puis l'a abandonné le soir même : retour à la configuration ci-dessus. Retour arrière :
MX remis sur OVH, puis retrait de `include:_spf.google.com` du SPF et du TXT `google._domainkey`, désabonnement
seulement une fois le MX OVH revenu (sinon les mails sont refusés). Mails reçus pendant l'essai : dans Workspace
(à vérifier avant la résiliation) ; Agence des Mots (« stop » du 24/11) déjà traitée.

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

## Voir les e-mails envoyés par le site

Le SMTP d'OVH ne garde aucune copie : les e-mails du site n'apparaissent ni dans « Messages envoyés » de Gmail ni dans
« Éléments envoyés » du webmail OVH (qui ne contient que ce qui est écrit depuis le webmail).

- **Copie cachée (règle du 24/11/2026)** : chaque e-mail des séquences automatiques (essai : merci, prise en main,
  rappel, fin, effacement ; achat : remerciement ; accompagnement J+3 après achat) part avec
  `quentin.morel@qm-engineering.fr` en copie cachée (`netlify/lib/mail.mjs`). La copie arrive dans la boîte OVH, donc
  dans Gmail : recherche `from:quentin.morel@qm-engineering.fr deliveredto:quentin.morel@qm-engineering.fr`.
  Sans copie : codes et liens de connexion (ils ouvrent le compte d'un client), notifications adressées à Quentin,
  annonces envoyées en nombre. Couper : variable Netlify `ESSAI_COPIE_CACHEE=non`, puis redéployer.
- **Journaux Netlify** de la fonction `essais-quotidien` (chaque jour à 9:10, Paris) : nombre d'e-mails envoyés par type
  (`Essais gratuits : …`, `Accompagnements d'achat : …`), sans adresse.
- **Page admin des essais** (`/admin/essais/`, code administrateur) : colonne des e-mails envoyés pour chaque essai.
- **Nexora Optim › QME › E-mails** (référence depuis le 24/11/2026) : frise de chaque essai (partis, à venir, sautés,
  arrêtés, manqués), accompagnements J+3, remerciements d'achat (`achat/*`), bilan de chaque tournée quotidienne avec
  ses erreurs (`tournee/<jour>`, gardé 90 jours) et formulaires reçus (idée, concours : `submission-created.mjs`),
  lus par `GET /api/essai/essais` au jeton de lecture.

## Étape suivante : durcir le DMARC

Rappel programmé le 07/12/2026 à 10:00.

1. Lire les rapports DMARC agrégés reçus depuis le 23/11 (pièces jointes `.zip`, `.gz` ou `.xml` envoyées à
   `quentin.morel@qm-engineering.fr` par google.com, outlook.com…) ; vérifier que chaque source légitime passe.
2. Si tout est propre : dans la zone DNS OVH, remplacer l'enregistrement TXT `_dmarc` par
   `v=DMARC1; p=quarantine; rua=mailto:quentin.morel@qm-engineering.fr; adkim=r; aspf=r`.
3. Plus tard, facultatif : `p=reject` après plusieurs semaines sans échec.

Aucune modification DNS sans le feu vert de Quentin.
