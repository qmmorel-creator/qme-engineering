# Fiche Gumroad · Secret Santa

- **Nom** : Secret Santa
- **Permalien** : `secret-santa` (https://qmengineering.gumroad.com/l/secret-santa), à confirmer à la création
- **Prix** : gratuit, **prix libre** (0 € possible, montant suggéré laissé vide ou au choix de Quentin)
- **Préfixe des codes** : `SNT`
- **Couverture** : `assets/templates-secret-santa-couverture.png` (1280 × 720), à produire
- **Bouton** : « Ouvrir mon Secret Santa » → https://qm-engineering.fr/connexion/
- **Lien de contenu** (`add_content_link`) : https://qm-engineering.fr/connexion/
- **Clé de licence** : à activer par Quentin dans l'éditeur (Content → Insert → License key). Sans elle,
  l'organisateur ne peut pas ouvrir l'application. Les participants, eux, n'ont pas besoin de clé.
- **Identifiant produit** : à reporter dans `PRODUITS` (`netlify/lib/templates-acces.mjs`, champ `gumroad`)
  une fois la fiche créée.

## Résumé (1 phrase)

Ton Secret Santa en ligne : un lien pour inviter le groupe, chacun note ses idées, le tirage est fait en
secret et chacun découvre à qui il offre. Gratuit.

## Description (HTML)

```html
<h2>Le Secret Santa, sans papiers dans un chapeau.</h2>
<p>Pour la famille, les amis ou le bureau. Tu crées l'échange, tu envoies un lien au groupe, chacun s'inscrit avec ses idées de cadeaux. Le tirage au sort est fait par le serveur : même toi, l'organisateur, tu ne sais pas qui a tiré qui. Tu peux donc participer comme les autres.</p>

<h3>Ce que tu obtiens</h3>
<ul>
<li><b>Un tirage vraiment secret</b> : le serveur tire au sort et garde le résultat ; tu vois seulement qui a déjà découvert le sien.</li>
<li><b>Une inscription sans compte</b> : un seul lien à partager ; chacun entre son prénom, son e-mail, un code personnel et sa liste d'idées.</li>
<li><b>Des exclusions</b> : un couple ou deux personnes d'un même foyer ne se tirent pas.</li>
<li><b>Une page par participant</b> : à qui il offre, les idées de la personne, le budget et la date, sur téléphone comme sur ordinateur.</li>
<li><b>Plusieurs échanges</b> : famille, amis, collègues, chacun avec son lien, son budget et son tirage. Jusqu'à 100 participants par échange.</li>
<li><b>Des données protégées</b> : hébergées en Europe (Francfort), code personnel jamais stocké en clair, effacement automatique 60 jours après la date de l'échange.</li>
</ul>

<h3>Comment ça marche</h3>
<ol>
<li>Tu reçois une <b>clé de licence</b> par e-mail (gratuite, prix libre si tu veux soutenir le projet).</li>
<li>Ouvre <b>qm-engineering.fr/connexion</b> et colle ta clé : tes échanges s'ouvrent dans le navigateur.</li>
<li>Crée un échange (nom, date, budget, message), copie le lien d'invitation et envoie-le au groupe.</li>
<li>Une fois tout le monde inscrit, lance le tirage. Chacun ouvre sa page pour découvrir à qui il offre.</li>
</ol>

<p><b>Essaie d'abord</b> : la démo avec trois échanges fictifs est ouverte à tous sur qm-engineering.fr/templates/secret-santa/?demo</p>
<p>Application en français. Aucun e-mail n'est envoyé aux participants : tu partages le lien par le moyen habituel du groupe (messagerie, SMS, e-mail). Seul l'organisateur a besoin d'une clé.</p>
```

## Tags (5 à 8)

`secret santa`, `noel`, `tirage au sort`, `cadeaux`, `famille`, `collegues`, `gratuit`

## Texte du reçu (≤ 500 caractères)

Merci ! Ta clé de licence est ci-dessus. Ouvre https://qm-engineering.fr/connexion/, colle la clé, et ton Secret Santa s'ouvre. Crée un échange, copie le lien d'invitation et envoie-le au groupe : chacun s'inscrit avec ses idées, sans compte. Lance le tirage quand tout le monde est inscrit : chacun découvre sur sa page à qui il offre, et toi non plus tu ne le sais pas. Une question : quentin.morel@qm-engineering.fr
