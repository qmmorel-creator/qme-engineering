# Prospection LinkedIn · packs Chef de projet BTP et Enseignant et formateur

Lancée le 20/11/2026 à la demande de Quentin. Envoi **à la main par Quentin** depuis son compte LinkedIn
(aucun outil d'automatisation : LinkedIn les interdit et suspend les comptes). Aucune liste nominative dans ce
dépôt : le suivi des personnes se fait dans le template QME « Pipeline de prospection B2B » de Quentin (ou un
Sheet privé), pas ici.

## État des produits au 20/11/2026 (vérifié sur Gumroad et en production)

| Pack | Gumroad | Page | Conséquence |
|---|---|---|---|
| Chef de projet BTP (8 templates, 192 € au lieu de 256 €) | publié | https://qm-engineering.fr/packs/chef-de-projet-btp/ | Prospection **vente** possible tout de suite |
| Enseignant et formateur (4 templates, 83 € au lieu de 104 €) | **aucun des 4 templates publié** (Progression, Quiz, Gestion de classe, Emploi du temps) | https://qm-engineering.fr/packs/enseignant/ (« bientôt ») | Rien à vendre : prospection **testeurs** (accès gratuit contre un retour), ou publication Gumroad d'abord. **Décision de Quentin.** |

## Décisions de Quentin (20/11/2026)

- **BTP : lancé.** Envoi depuis le profil personnel de Quentin (une page entreprise LinkedIn ne peut ni inviter
  ni écrire la première à un membre ; elle répond seulement aux messages reçus).
- **Enseignant : testeurs à moitié prix contre un retour d'utilisation** (et non plus un accès gratuit). Ce choix
  suppose une vente : il faut que les produits soient publiés sur Gumroad, puis un code de réduction de 50 % à
  nombre d'utilisations limité. Prérequis en attente :
  1. décision RGPD sur T55 Gestion de classe (`docs/templates/QUESTIONS.md`, données d'élèves mineurs) ;
  2. fiches Gumroad des 4 templates et du pack, clé de licence activée à la main par Quentin, publication
     (`docs/templates/communication/gumroad-priorite.md`), PR et fusion avec son feu vert.
  Tant que ces prérequis ne sont pas remplis, aucun message n'est envoyé aux enseignants.

## Liens à mettre dans les messages (suivi de provenance)

Convention : `utm_source=linkedin&utm_medium=dm&utm_campaign=prosp-btp` (ou `prosp-ens`). `dm` distingue les
messages privés des publications (`social`).

- Pack BTP : `https://qm-engineering.fr/packs/chef-de-projet-btp/?utm_source=linkedin&utm_medium=dm&utm_campaign=prosp-btp`
- Démo suivi de chantier : `https://qm-engineering.fr/templates/suivi-chantier/?demo&utm_source=linkedin&utm_medium=dm&utm_campaign=prosp-btp`
- Démo Gantt : `https://qm-engineering.fr/templates/gantt/?demo&utm_source=linkedin&utm_medium=dm&utm_campaign=prosp-btp`
- Pack Enseignant : `https://qm-engineering.fr/packs/enseignant/?utm_source=linkedin&utm_medium=dm&utm_campaign=prosp-ens`
- Démo gestion de classe : `https://qm-engineering.fr/templates/gestion-classe/?demo&utm_source=linkedin&utm_medium=dm&utm_campaign=prosp-ens`
- Démo emploi du temps : `https://qm-engineering.fr/templates/emploi-du-temps/?demo&utm_source=linkedin&utm_medium=dm&utm_campaign=prosp-ens`

Ne jamais mettre de lien dans la note d'invitation (taux d'acceptation plus bas) : le lien vient au premier
message, une fois la connexion acceptée.

## Cibles

### BTP (priorité 1)

Petites structures uniquement : les majors ont déjà un logiciel de gestion de chantier.

| Segment | Recherche LinkedIn (Personnes, champ mots-clés) | Filtres |
|---|---|---|
| Conducteurs de travaux, PME second œuvre / gros œuvre | `"conducteur de travaux" NOT (stagiaire OR alternant OR recrute)` | Secteur Construction ; taille 1-50 et 51-200 |
| Chefs de projet / chargés d'affaires BTP | `("chef de projet" OR "chargé d'affaires") AND (BTP OR travaux OR bâtiment)` | idem |
| Maîtres d'œuvre d'exécution, OPC | `("maître d'œuvre" OR "maîtrise d'œuvre" OR OPC) AND (indépendant OR gérant OR fondateur)` | Secteur Architecture et urbanisme, Construction |
| Architectes en petite agence | `architecte AND (gérant OR associé OR fondateur)` | taille 1-10 |
| Économistes de la construction, AMO indépendants | `("économiste de la construction" OR AMO OR "assistant à maîtrise d'ouvrage")` | taille 1-10 |

Commencer par le **réseau de 2e niveau** de Quentin (ingénierie, chef de projet) : acceptation plus forte.

### Enseignement et formation (priorité 2, selon la décision ci-dessus)

| Segment | Recherche LinkedIn | Template le plus parlant |
|---|---|---|
| Formateurs indépendants | `formateur AND (indépendant OR freelance OR "organisme de formation")` | Banque de questions et quiz, Progression |
| Responsables pédagogiques d'organismes de formation, CFA, écoles privées | `("responsable pédagogique" OR "coordinateur pédagogique" OR "directeur des études")` | Emploi du temps d'établissement |
| Enseignants de collège et lycée | `(professeur OR enseignant) AND (collège OR lycée)` | Gestion de classe, Progression |
| Formateurs BTP (pont entre les deux campagnes) | `formateur AND (BTP OR "conduite de travaux" OR "génie civil")` | Pack BTP en support de TP + pack Enseignant |

Les enseignants du public sont peu présents et peu réactifs sur LinkedIn : viser d'abord formateurs, CFA et
écoles privées (ils achètent sur facture).

## Séquences de messages

Vouvoiement. Personnaliser la première phrase à partir du profil (poste, chantier ou formation récents).
Notes d'invitation : 200 caractères au plus (limite des comptes gratuits ; le nombre de notes personnalisées par
mois est aussi limité, à vérifier dans le compte de Quentin). Sans note si le quota est atteint.

### BTP

**Invitation, version du 20/11/2026 (Quentin : lien du pack et de la page QME dans la note)**

Compte gratuit, 178 caractères avec un prénom de 10 lettres (limite 200) :

> Bonjour {Prénom}, situations, réserves, DOE, Gantt : 8 outils de chantier, sans abonnement.
> qm-engineering.fr/packs/chef-de-projet-btp · linkedin.com/company/qme-qm-engineering

Compte Premium, 287 caractères (limite 300) :

> Bonjour {Prénom}, ingénieur chef de projet, j'ai réuni 8 outils de chantier dans un pack : situations et
> avenants par lot, Gantt, visas, réserves, DOE, sous-traitants. Achat unique, démo libre :
> qm-engineering.fr/packs/chef-de-projet-btp · QME : linkedin.com/company/qme-qm-engineering

Liens sans paramètres de suivi, faute de place : une vente issue de l'invitation n'est pas attribuée à
`prosp-btp`. Les liens du message 1 gardent leurs paramètres. Mesurer le taux d'acceptation dès la première
semaine : une note avec des liens peut le faire baisser ; sous 25 %, repasser à une note sans lien.

**Message 1, à l'acceptation**

> Merci {Prénom}. J'ai conçu un pack d'outils pour piloter un chantier sans logiciel lourd : suivi par lot
> (marché, avenants, situations), Gantt, circuit de visa, levée de réserves, non-conformités, DOE et sous-traitants.
> La démo tourne avec une opération fictive, sans inscription : {lien démo suivi de chantier}
> Qu'utilisez-vous aujourd'hui pour suivre vos situations et vos réserves ?

**Relance, J+5 sans réponse**

> Je me permets une relance courte : le pack complet (8 outils) est à 192 € au lieu de 256 €, achat unique,
> sans abonnement : {lien pack BTP}. Si un seul outil vous suffit, je vous indique lequel.

**Dernier message, J+12** : aucun. On s'arrête après une relance.

**Si réponse intéressée** : proposer un appel de 15 min (template « Préparateur d'appel découverte ») ; si le
besoin dépasse le pack (plusieurs utilisateurs, rôles), basculer vers le sur-mesure (`/sur-mesure/`).

### Enseignant et formateur, variante testeurs (si les templates ne sont pas publiés)

**Invitation**

> Bonjour {Prénom}, je conçois des outils simples pour les formateurs (progression, quiz, emploi du temps). Votre
> regard de terrain m'intéresserait beaucoup.

**Message 1**

> Merci {Prénom}. Je termine quatre outils pour enseignants et formateurs : progression pédagogique, banque de
> questions et quiz, gestion de classe, emploi du temps d'établissement. Je cherche quelques testeurs : le pack
> à moitié prix, en échange d'un retour d'utilisation après quelques semaines. Aperçu : {lien démo gestion de
> classe}. Cela vous tente ?

Code : réduction Gumroad de 50 % sur le pack, nombre d'utilisations limité (20 par exemple), créé une fois le pack
publié et noté ici. Le retour attendu est à cadrer avec le testeur (10 minutes d'appel ou un court questionnaire).

### Enseignant et formateur, variante vente (une fois les 4 templates publiés)

Même invitation ; message 1 identique au BTP sur le fond : problème, démo, question ouverte ; relance avec le
prix du pack (83 € au lieu de 104 €).

## Cadence et règles

- **20 invitations par jour ouvré au plus**, environ 100 par semaine (au-delà, LinkedIn restreint les
  invitations des comptes gratuits). Répartition conseillée : 15 BTP + 5 enseignement.
- Retirer chaque semaine les invitations en attente depuis plus de 3 semaines.
- Un seul message de relance. Un « non » ou l'absence de réponse clôt le contact. Pas de copier-coller visible :
  la première phrase est toujours propre au profil.
- Pas de promesse chiffrée (gain de temps, économies), pas de conseil juridique ou réglementaire.
- Publications du moment à aligner : un post BTP dans la semaine augmente l'acceptation (le profil est visité).

## Suivi

Chaque vendredi, noter ici : invitations envoyées, acceptées, réponses, appels, ventes (Gumroad, filtre
`utm_campaign=prosp-btp` / `prosp-ens`).

| Semaine | Campagne | Invitations | Acceptées | Réponses | Appels | Ventes |
|---|---|---|---|---|---|---|
| 23/11/2026 | prosp-btp | | | | | |
| 23/11/2026 | prosp-ens | | | | | |

Seuils de révision après 2 semaines : acceptation < 25 % → revoir la cible ou l'invitation ; réponse < 10 % des
acceptés → revoir le message 1.
