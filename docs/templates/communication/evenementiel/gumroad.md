# Fiche Gumroad · Organisateur d'événement

> Fusion F1 du 22/11/2026 (`docs/templates/RATIONALISATION.md`) : la fiche Gumroad de l'**Organisateur de mariage**
> (identifiant `TmtmeDwq1OsE2Y9gL6rDag==`, permalien `organisateur-mariage`) devient celle de l'Organisateur d'événement.
> Le site pointe déjà dessus (`PRODUITS.EVT`, `outils/packs/donnees.mjs`). **À faire par Quentin ou avec son accord, sur
> Gumroad** (rien n'a été modifié côté Gumroad) : renommer, passer le prix de 29 € à 39 €, remplacer résumé, description,
> détails, tags, reçu et couverture par ceux ci-dessous, vérifier que le bloc License key est toujours en place. Le permalien
> peut rester `organisateur-mariage` (les liens du site y pointent) ; s'il change, mettre à jour `permalien` d'EVT dans
> `outils/packs/donnees.mjs`, puis relancer les générateurs (packs, essai, données structurées).

- **Nom** : Organisateur d'événement : mariage, séminaire, fête
- **Permalien** : `organisateur-mariage` (https://qmengineering.gumroad.com/l/organisateur-mariage), inchangé
- **Prix** : 39 € (au lieu de 29 €, décision de Quentin du 22/11/2026)
- **Préfixe des codes** : `EVT`
- **Couverture** : `assets/templates-evenementiel-couverture.png` (1280 × 720), refaite le 22/11/2026
- **Bouton** : « Ouvrir mon organisateur » → https://qm-engineering.fr/connexion/
- **Tags** (8 au plus) : `organisation-mariage`, `seminaire`, `evenementiel`, `retroplanning`, `plan-de-table`, `budget-mariage`, `organisateur`, `francais`
- **Clé de licence** : déjà active sur la fiche du mariage ; vérifier `"is_licensed":true` après modification.

## Résumé (1 phrase)

Organise un mariage, un séminaire, un salon ou une fête : rétroplanning calé sur la date, budget et prestataires, invités,
plan de table, transports et chambres, jour J, pour un ou plusieurs événements à la fois.

## Description (HTML)

```html
<p><strong>Essai gratuit de 14 jours, sans carte bancaire</strong> : essaie-le avec tes propres données sur <a href="https://qm-engineering.fr/essai/?t=evenementiel">qm-engineering.fr/essai</a>. Si tu l'achètes ensuite, saisis ta clé dans le template (bouton « J'ai acheté ») : tout ce que tu as saisi pendant l'essai est repris.</p>
<h3>Ce que tu obtiens</h3>
<ul>
<li><b>Quatre modèles</b> : mariage (rétroplanning sur 12 mois, démarches du mariage civil sourcées, plan de table), séminaire ou offsite (participants, qui voyage avec qui, chambres, programme en salles parallèles), événement d'entreprise ou d'association (salon, soirée, gala, conférence : badges, pointage) et fête de famille (anniversaire, baptême : adultes et enfants, tables).</li>
<li><b>Un rétroplanning calculé depuis la date</b> : chaque tâche est à « J-n » de l'événement ; si la date bouge, tout se décale.</li>
<li><b>Le budget prévu, engagé et payé</b> par poste (postes types sans prix inventé) et par prestataire, avec l'échéancier des acomptes et des soldes, les retards signalés et le coût par invité confirmé.</li>
<li><b>Les invités</b> : réponses et relance avant la date limite, groupes, adultes et enfants, plan de table par glisser-déposer, trajets et chambres avec répartition automatique, fiche traiteur en nombres seulement, badges et export CSV.</li>
<li><b>Le jour J</b> : déroulé minute par minute par lieu, sessions en parallèle, chevauchements signalés, décalage en cascade, checklist et impression.</li>
<li><b>Plusieurs événements de front</b>, de types différents, dans un seul tableau de bord.</li>
</ul>
<h3>Comment ça marche</h3>
<ol>
<li>Après l'achat, tu reçois une <b>clé de licence</b> par e-mail.</li>
<li>Ouvre <b>qm-engineering.fr/connexion</b> et colle ta clé : ton organisateur s'ouvre dans le navigateur.</li>
<li>Choisis le modèle de ton événement et sa date : le rétroplanning se cale dessus. Partage la clé avec ceux qui organisent avec toi : les données suivent tout le monde sur ordinateur, tablette et téléphone.</li>
</ol>
<p><b>Démo par modèle</b>, ouverte à tous : qm-engineering.fr/templates/evenementiel/?demo=mariage (ou seminaire, entreprise, fete).</p>
<p>Achat unique, sans abonnement. Application en français. Aucun prix de référence intégré. Régimes, allergies et besoins d'accessibilité des invités sont des données sensibles (RGPD) : liste fermée, cases sans diagnostic, fiche traiteur sans nom, rappel d'effacement après l'événement. Outil d'organisation, pas un conseil juridique ni comptable. Tu avais l'Organisateur de mariage ? Ta clé ouvre l'Organisateur d'événement.</p>
```

## Détails

- Format : application web (navigateur), en français
- Modèles : mariage, séminaire ou offsite, entreprise ou association, fête de famille
- Essai : 14 jours gratuits, sans carte
- Accès : achat unique, à vie, tous tes appareils

## Reçu (500 caractères au plus)

Merci ! Ta clé de licence est ci-dessous. Ouvre qm-engineering.fr/connexion, colle-la, puis choisis le modèle de ton
événement. 🧪 Après l'essai gratuit : dans le template, bouton « J'ai acheté », colle ta clé, tes données sont reprises.
❓ Une question : quentin.morel@qm-engineering.fr
