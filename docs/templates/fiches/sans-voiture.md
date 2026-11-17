# T98 · Vivre sans voiture : simulateur

Slug `sans-voiture`, préfixe `SVT` (clés locales `qme-svt-*`, règles dans `window.SVT`), prix **9 €** (demande
explicite de Quentin du 17/11/2026, en dérogation à la règle du prix minimum de 12 € du 13/11/2026), permalien
Gumroad prévu `simulateur-vivre-sans-voiture`, catégorie Gumroad `business-and-money/personal-finance`, taille S
à M. Origine : idée de Quentin du 17/11/2026, après un simulateur personnel construit pour sa propre situation
(seule la **mécanique** est reprise : aucun montant, lieu, contrat, marque ni donnée de ce simulateur dans le
produit, ses exemples, ses captures ou sa communication). Marques de risque : **argent** (simulation, pas un
conseil financier) ; **daté** évité : aucun tarif de transport, de carburant ou de location intégré, tout est
saisi. Pas de modèle tableur : application web.

Lien avec les templates existants : **Simulateur leasing ou achat** (T66, VTR) compare des façons de payer une
voiture ; **Carnet de voiture** (T10, CAR) suit une voiture qu'on garde. T98 répond à la question d'avant :
faut-il une voiture du tout ? **Pack Ma voiture (PVT), décision de Quentin du
17/11/2026** (annoncé « À venir » dans le pack, déjà en vente à 22 € ; à la sortie de T98 : 34 €, −15 %, 28 €, option
évolutif 9 €).

## Pour qui

Particuliers, couples et familles (y compris avec de jeunes enfants) qui se demandent s'ils peuvent vendre leur
voiture ou ne pas la remplacer, et utiliser à la place le vélo (électrique ou non), les transports en commun, le
train, l'autopartage, le taxi et une voiture de location de temps en temps. Ils connaissent mal le coût complet
de leur voiture et craignent les situations où elle manquerait (enfant malade, urgence de nuit, vacances).

## Promesse

« Ta voiture te coûte combien, vraiment ? Et sans elle, tu gagnes combien ? » Le gain (ou la perte) annuel de se
passer de voiture, calculé avec tes chiffres, et un plan pour chaque situation où elle te manquerait.

## Principe

Tout est **paramétrable et saisi à la main** : aucune valeur de marché intégrée. Des valeurs par défaut sont
proposées, signalées comme des exemples à remplacer. L'outil donne :
1. le **coût annuel complet** de la voiture actuelle ;
2. le **coût annuel des solutions de remplacement** ;
3. le **gain annuel** (positif ou négatif), par mois, et cumulé sur un horizon choisi, **coût de sortie compris** ;
4. un **score de faisabilité** et la liste des **cas d'urgence avec leurs parades**.

## Écrans (5 onglets + réglages)

1. **Bilan** : verdict en tête (« Sans voiture, tu gagnes X € par an » ou « Garder la voiture coûte moins
   cher »), gain mensuel, gain cumulé sur l'horizon, barres comparées des deux coûts annuels par poste,
   courbe du gain cumulé (coût de sortie inclus), sensibilité (« si la location coûte 30 % plus cher »,
   « jours de location supplémentaires avant que l'option sans voiture coûte plus cher »), score de
   faisabilité, trois urgences non couvertes les plus graves, avertissement.
2. **Questionnaire** (premier lancement, puis modifiable) : questions à choix qui ouvrent les champs utiles,
   pour ne montrer que ce qui concerne la personne (voir « Questionnaire »).
3. **Ma voiture** : coût complet saisi poste par poste (voir « Paramètres »), mode de détention (achetée,
   crédit, LOA, LLD), coût de sortie.
4. **Sans voiture** : solutions de remplacement poste par poste (vélo, transports, location, autopartage,
   taxi, train, livraisons, équipement), avec le détail du calcul.
5. **Urgences et organisation** : cas d'urgence et parades (voir « Cas d'urgence »), cochés « couvert » ou
   « à prévoir » ; semaine type ; liste d'équipement ; calendrier de réservation des locations ; phase de test
   avant de se séparer de la voiture.
6. **Réglages** : export CSV du bilan, sauvegarde et restauration JSON, compte, « Sur téléphone » (fenêtre
   « Comme une application »), à propos, avertissement.

Plusieurs **scénarios** (5 au plus) : par exemple « vendre maintenant », « attendre la fin du contrat »,
« garder une petite voiture d'occasion ». Création, duplication, suppression, comparaison des gains.

## Questionnaire

Chaque réponse ouvre ou ferme des champs ; tout reste modifiable ensuite.

- **Foyer** : nombre d'adultes, nombre d'enfants et leur âge (pour le siège auto et le siège vélo), adultes
  qui conduisent.
- **Vélo** : as-tu un vélo ? électrique ou non ? l'utilises-tu déjà au quotidien ? équipement déjà présent
  (siège enfant homologué, sacoches, panier, remorque, vélo cargo) ? sinon, budget d'achat, aides déduites
  (saisies), durée d'amortissement, entretien et assurance vol par an.
- **Transports en commun** : utilises-tu le bus, le tram, le métro, le train régional ? abonnement mensuel par
  adulte (montant saisi), part remboursée par l'employeur (en %, saisie), tickets occasionnels par an, coût
  pour les enfants (saisi), trajets professionnels payés par l'employeur (oui / non).
- **Travail** : trajet domicile-travail sans voiture possible ? durée porte à porte ; télétravail (jours par
  semaine) ; horaires décalés ou astreintes.
- **École et santé** : distance de l'école ; médecin ou pédiatre accessible sans voiture ; urgences de nuit à
  quelle distance (saisie libre, aucune adresse intégrée).
- **Usages de la voiture aujourd'hui** : kilomètres par an, part domicile-travail, part week-ends et vacances ;
  nombre de départs en vacances, de week-ends hors de la ville, de gros achats par an.
- **Entourage** : personne de recours pour récupérer un enfant, covoiturage possible avec d'autres parents.

## Paramètres (tous saisis, valeurs par défaut marquées « exemple »)

**Voiture actuelle** : mode de détention ; valeur de revente estimée ; perte de valeur par an ; crédit restant
(mensualité) ou loyer (LOA, LLD) et services facultatifs ; assurance ; entretien et pneus ; contrôle technique
lissé ; carburant ou recharge, au choix **(a)** en € par an saisi, ou **(b)** kilomètres par an ×
consommation (L ou kWh aux 100 km) × prix du litre ou du kWh ; stationnement, garage, péages, lavage ;
amendes et divers.

**Sortie de la voiture** (selon le mode) :
- achetée : vente (prix saisi, frais et remise de négociation en %) ;
- crédit : capital restant dû saisi, remboursé à la vente ;
- LOA : **rachat anticipé** au barème du contrat (tableau saisi : après le loyer n, % du prix ou montant ;
  date du premier rachat possible), revente le même jour à un particulier ou reprise par un professionnel
  (écarts en % saisis) ; ou levée de l'option finale ; ou restitution avec frais de remise en état et
  kilomètres supplémentaires ;
- LLD : restitution anticipée avec indemnité saisie (en % des loyers restants ou montant), ou fin de contrat.
- Le **délai avant la sortie** compte : tant que le contrat court, les loyers restent dus et le gain ne commence
  qu'à la sortie. Un paiement déjà fait (apport, premier loyer) n'entre pas dans le calcul : il est le même
  quelle que soit la décision, et l'écran le dit.

**Remplacement** : jours de location isolés par an et prix par jour ; semaines de location par an et prix par
semaine ; rachat de franchise par jour ; kilomètres faits en location et carburant au km ; autopartage (€ par an
ou heures × prix) ; taxis ou VTC (nombre × prix moyen) ; surcoût de train pour les trajets faits avant en
voiture ; livraisons de courses ; transports en commun ; vélo ; rehausseur pliable pour les locations (une fois).

**Temps** (facultatif) : minutes de plus par jour ouvré et valeur d'une heure (0 pour ignorer).

**Horizon** : 1 à 15 ans.

## Calculs (règles pures, `templates/sans-voiture/regles.js`, `window.SVT`)

Montants en centimes, durées en mois.
- Coût annuel voiture = Σ postes (perte de valeur, crédit ou loyers et services, assurance, entretien,
  contrôle technique, carburant, stationnement et divers).
- Coût annuel sans voiture = transports (abonnements × 12 × (1 − part employeur) + enfants + tickets) +
  vélo (achat − aides) / durée + entretien + location (jours × prix + semaines × prix + jours loués ×
  franchise) + carburant en location + autopartage + taxis + train + livraisons.
- Coût du temps = minutes / 60 × valeur horaire × jours ouvrés (220 par défaut, paramétrable).
- **Gain annuel** = coût voiture − coût sans voiture − coût du temps ; gain mensuel = gain / 12.
- **Coût de sortie** selon le mode (voir plus haut) ; rachat de LOA : prix du barème − valeur de revente
  estimée à la date du rachat (valeur actuelle × (1 − dépréciation)^(années jusqu'au rachat), moins l'écart de
  vente).
- **Gain cumulé** au mois m = 0 avant la sortie ; ensuite gain mensuel × (m − mois de sortie) − coût de
  sortie − équipement unique. Meilleur moment de sortie (balayage des dates possibles) ; délai pour amortir le
  coût de sortie.
- **Sensibilité** : gain si la location coûte 30 % plus cher ; jours de location supplémentaires possibles =
  gain / (prix par jour + franchise + carburant moyen par jour loué).
- **Amortissement implicite d'une LOA** (si le barème est saisi) : capital remboursé et intérêts par loyer,
  taux implicite annuel (le contrat ne le donne pas toujours), coût total loyers + rachat face au prix
  comptant.
- **Score de faisabilité** sur 100 : questions pondérées (trajet de travail sans voiture, école proche ou
  desservie, arrêt de transport fréquent, personne de recours, médecin accessible, télétravail, location ou
  autopartage proche, local vélo, horaires réguliers, famille accessible en train, accord du foyer, vélo qui
  porte l'enfant et les courses). Verdict bloquant si le trajet de travail ou celui de l'école n'est pas réglé.
- Tests `node --test` dans `outils/templates/sans-voiture.test.mjs` : coût annuel connu, part employeur, mode
  carburant (a) et (b), gain négatif, sortie différée (gain nul avant), coût de rachat LOA et taux implicite
  (cas chiffré recalculé à la main), seuil de jours de location, score et verdict bloquant, normalisation
  d'un état ancien ou incomplet.

## Cas d'urgence et parades (mis en avant)

Bloc dédié, visible dans le bilan et dans l'onglet « Urgences et organisation ». Pour chaque cas : gravité
(bloquant, à anticiper, favorable), solution habituelle, plan B, coût indicatif saisi, case « couvert ».
Textes rédigés pour QME, génériques (aucune ville, aucun réseau ni service nommé).

- **Urgence médicale la nuit** : appeler le 15 (SAMU) en cas d'urgence vitale, le 112 depuis un portable,
  sinon service de médecins de garde ou taxi ; rehausseur prêt à l'entrée ; taxis et VTC n'ont pas les mêmes
  obligations pour les sièges enfant (à vérifier avant de réserver).
- **Enfant malade à récupérer à l'école** : adulte le plus proche, à pied ou à vélo si l'état de l'enfant le
  permet ; personne de recours inscrite à l'école ; taxi.
- **Siège auto obligatoire pour l'enfant** dans tout véhicule loué, emprunté ou partagé : rehausseur pliable
  homologué à emporter.
- **Panne ou vol du vélo** quand il est le seul moyen rapide : assurance vol, deux antivols, entretien, kit
  crevaison, atelier repéré, transports en secours.
- **Grève ou travaux** : vélo, télétravail, billets échangeables, location de repli.
- **Retour tardif avec un enfant endormi** : rentrer avant la baisse des fréquences, sinon taxi.
- **Météo** (pluie, froid, canicule) : protection du siège enfant, cape, transports ou taxi les jours difficiles.
- **Gros achats, déchetterie, déménagement** : location à la journée regroupée, livraison du magasin, utilitaire
  à l'heure.
- **Vacances et visites lointaines** : train puis location sur place ; réservation 2 à 3 mois avant les
  vacances scolaires.
- **Disponibilité et caution des locations** : deux loueurs au moins, plafond de carte bancaire, franchise.
- **Limite de poids du siège vélo** (enfant qui grandit) : barre de traction, tandem parent-enfant, remorque.
- **Bonus d'assurance** : relevé d'information demandé à la résiliation et conservé.
- **Contrat en cours** (LOA, LLD) : la sortie anticipée peut coûter cher ; lire le contrat, demander le montant
  exact au financeur avant de décider.
- **Évolution de la famille** (deuxième enfant, déménagement, nouvel emploi) : faire le point une fois par an ;
  la décision est réversible.

Organisation proposée (modifiable) : semaine type, équipement (déjà en place / à acheter), comptes à ouvrir
avant de vendre (location, autopartage, taxi), calendrier des réservations, **phase de test** : vivre sans la
voiture pendant au moins deux mois (ou jusqu'à la date de sortie d'un contrat), noter chaque location, train ou
taxi, puis décider.

## Base intégrée (`templates/sans-voiture/donnees.js`)

Aucune donnée de marché (pas de tarif, de prix de carburant, de cote, de marque, de réseau ni de ville).
- Questionnaire (questions, réponses, champs ouverts par chaque réponse).
- Valeurs par défaut signalées comme exemples ; trois profils de location (sobre, moyen, fréquent).
- 14 cas d'urgence et leurs parades, 20 cas de figure du quotidien (école, travail, courses, activités,
  anniversaires, sorties, vacances, garde alternée, grève, déplacement professionnel…), équipement type,
  semaine type, calendrier de réservation, étapes de la phase de test, questions du score de faisabilité.

## Démo (`donneesDemo()`, données fictives relatives à aujourd'hui)

Foyer fictif : deux adultes, un enfant de 4 ans, un vélo électrique avec siège enfant, une citadine en LOA
depuis 7 mois (barème de rachat fictif), un scénario « racheter et revendre au premier rachat possible », un
scénario « attendre la fin du contrat », un scénario « voiture achetée, vente immédiate ». Cas d'urgence en
partie couverts. Aucun montant, lieu ou contrat réel.

## Risques

- **Argent** : simulation à partir de la saisie ; valeur de revente, dépréciation et prix de location choisis
  par l'utilisateur ; le contrat et le financeur font foi. Avertissement dans l'application, la page catalogue
  et la fiche Gumroad.
- **Sécurité** : les cas d'urgence sont des repères d'organisation, pas un avis médical ; en cas d'urgence
  vitale, appeler le 15 ou le 112 (numéros à vérifier sur une source officielle au moment du développement).
- **Siège enfant, taxis et VTC** : règles à vérifier sur une source officielle avant de les écrire ; sinon,
  formulation « à vérifier ».
- Aucune marque, réseau, ville, loueur ou service nommé ; aucune connexion externe ; aucune automatisation.
