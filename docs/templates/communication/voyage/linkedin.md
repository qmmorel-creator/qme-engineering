# Publication LinkedIn · Planificateur de voyage

À publier une fois la fiche Gumroad en vente et le site à jour. Relue et ajustée par Quentin avant
publication. Titre interne proposé pour le planning : **« Template · Planificateur de voyage »**. Non
planifiée (consigne de la mission : aucun outil Google Sheets ni LinkedIn utilisé) : ligne à créer dans le
planning selon `reference.md` § « Planning LinkedIn ».

- Démo : https://qm-engineering.fr/templates/voyage/?demo
- Présentation : https://qm-engineering.fr/catalogue/voyage/
- Achat : en premier commentaire, à compléter quand la fiche Gumroad sera en ligne (aucune URL Gumroad
  n'existe encore ; permalien prévu `planificateur-voyage`).

**Image à joindre** : `assets/templates-voyage-couverture.png` (1280 × 720), ou en carrousel : couverture,
« qui doit quoi » (`templates-voyage-comptes.webp`), capture téléphone (`templates-voyage-tel.webp`).
Texte alternatif : « Template Planificateur de voyage de QME : étapes et nuits, programme du jour, budget
dépensé sur prévu et remboursements entre voyageurs, sur ordinateur et téléphone, données fictives. »

---

## Accroche, variante A (le retour)

> Fin des vacances entre amis. Quatre personnes, trente tickets de caisse,
> et une question : qui doit combien à qui ?

## Accroche, variante B (les dix e-mails)

> Les réservations dans dix e-mails, le programme dans une note,
> le budget dans un tableur. Et la troisième nuit, on dort où ?

---

## Texte (à placer après l'accroche choisie)

On prépare souvent un voyage avec ce qu'on a sous la main : les confirmations dans la boîte mail, une
note pour le programme, un tableur pour le budget. Ça tient jusqu'au premier changement, puis on découvre
sur place qu'une nuit n'a pas d'hébergement, et au retour on refait les comptes ticket par ticket.

J'ai construit un outil qui réunit tout au même endroit :

▪ l'itinéraire par étapes et le toit de chaque nuit, réservé ou à réserver, avec l'acompte et le reste à
payer sur place ; une nuit sans hébergement est signalée ;
▪ le programme jour par jour (transports, activités à leur heure) et la liste de ce qui reste à réserver,
du plus urgent au plus lointain ;
▪ le budget prévu puis réel, par poste et par personne, et les dépenses partagées : chacun note ce qu'il
paie, le partage tombe juste au centime et l'outil propose le plus petit nombre de remboursements.

Deux choix assumés. Aucune réservation ni lien vers une plateforme : on réserve où l'on veut, on reporte.
Et aucune règle de formalité écrite en dur : papiers, visa et santé renvoient aux sources officielles,
parce qu'elles changent d'un pays et d'une année à l'autre.

Il s'ouvre dans le navigateur avec une clé, sur ordinateur pour préparer et sur téléphone pendant le
voyage, même sans réseau une fois chargé. Toute la troupe peut utiliser la même clé. Achat unique, sans
abonnement.

Une démo avec le voyage fictif de quatre amis est ouverte à tous, sans inscription :
https://qm-engineering.fr/templates/voyage/?demo

Lien d'achat en premier commentaire.

#Voyage #Organisation #Budget #Vacances #Famille

---

## Premier commentaire

Le planificateur de voyage, achat unique : [lien Gumroad à compléter à la mise en vente]
Présentation complète : https://qm-engineering.fr/catalogue/voyage/

## Version courte (commentaire ou story, 3 lignes)

> Étapes, nuits, activités jour par jour, budget prévu et réel.
> Au retour, qui doit quoi à qui, au centime, en un minimum de virements.
> Démo libre : qm-engineering.fr/templates/voyage/?demo

## Faits vérifiés pour ce texte (14/11/2026)

- Nuits sans hébergement et nuits réservées deux fois signalées : `couverture()` de `templates/voyage/regles.js`,
  testée dans `outils/templates/voyage.test.mjs`.
- Partage au centime et nombre minimal de remboursements : moteur du template Budget commun
  (`templates/budget-commun/regles.js`), mêmes résultats vérifiés par test.
- Consultable sans réseau : service worker (`templates/voyage/sw.js`), saisies gardées et renvoyées au
  retour du réseau.
- Aucun chiffre de gain de temps ni d'économie n'est avancé.
