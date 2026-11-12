# T24 · Circuit de visa des documents

Slug `visa`, préfixe `VSA`, prix 39 €, permalien Gumroad `circuit-visa`. Taille M, P1.
Origine : documents de travail de Quentin (12/11/2026) + backlog n° 05 « Registre des visas
documentaires » (fusionné). **confidentiel** : mécanique seulement ; aucun nom, numéro, lot, montant ou
capture d'un artefact professionnel ; exemples fictifs (bâtiment tertiaire, logement, équipement public) ;
aucun exemple du secteur de l'énergie.

## Pour qui

Maîtres d'œuvre (architectes, mandataires de groupement), bureaux d'études qui visent les études
d'exécution des entreprises (structure, fluides, électricité, façades), OPC et cellules de synthèse,
assistants de maîtrise d'ouvrage qui suivent le circuit. Ceux qui tiennent aujourd'hui le registre des
visas dans un tableur partagé, sans échéance calculée ni relance.

## Écrans (4 onglets + réglages)

- **Pilotage** (vue chef de projet) : ce qui demande une action aujourd'hui, classé par urgence :
  avis en retard (viseur à relancer), échéances de visa dans les N jours, documents attendus en retard,
  nouveaux indices attendus après refus ou observations, relances dues. Regroupement par intervenant
  (« qui relancer ») et bouton « Relancer » qui prépare le texte (copie ou e-mail).
- **Registre** : tableau de tous les documents de l'opération (lot, numéro, titre, type, indice, reçu
  le, échéance, avis, statut), filtres lot / statut / texte, tri. Fiche du document : historique des
  indices, avis de chaque viseur, observations, relances. Actions : nouvel indice reçu, saisir un avis,
  relancer. **Export CSV** (séparateur point-virgule, UTF-8 avec BOM, lisible par un tableur) et
  **impression** du registre (A4 paysage, filtres appliqués).
- **Lots** : lots de l'opération (numéro, intitulé, entreprise titulaire, couleur) et intervenants du
  circuit (viseurs : nom, rôle). Compteurs par lot.
- **Tableau de bord** : tuiles (documents, en cours de visa, en retard, taux de VSO au premier indice,
  délai moyen de visa comparé au délai contractuel), graphique des avis rendus par semaine (VSO / VAO /
  REF, 12 semaines), tableau par lot.
- **Réglages** : délais, mode de décompte, fréquence de relance, comportement du VAO, opérations,
  export / import JSON, déconnexion.
- Un guide court (codes de visa, cycle d'un document) est intégré à l'onglet Lots et aux réglages.

## Saisie

- **Opération** : nom, maître d'ouvrage (texte libre), type (tertiaire, logement, équipement public,
  autre), délais propres facultatifs (sinon réglages généraux). Plusieurs opérations, une active à la
  fois (sélecteur dans l'en-tête).
- **Lot** : numéro, intitulé (choisi dans la liste des lots types ou libre), entreprise, couleur.
- **Viseur** : nom (de l'organisme ou de la personne), rôle (architecte, BET structure, BET fluides,
  BET électricité, économiste, contrôleur technique, OPC, maître d'ouvrage).
- **Document** : lot, numéro (proposé : `<code lot>-<code type>-<n°>`, ex. `GO-PEX-004`), titre
  (suggestions selon le lot), type, viseurs du circuit, date de remise prévue (facultative).
- **Indice reçu** : indice (proposé : lettre suivante), date de réception. **Avis** : par viseur, code
  VSO / VAO / REF, date, observations.

## Mécanique clé

1. Un indice reçu ouvre un **cycle de visa** ; son échéance = date de réception + délai de visa
   (jours calendaires, ou jours ouvrés : lundi à vendredi hors jours fériés de métropole calculés).
2. Chaque viseur du circuit rend un avis ; l'**avis de synthèse** est le plus sévère (REF > VAO > VSO),
   connu quand tous les viseurs ont répondu ; sa date est celle du dernier avis.
3. Après **REF** (et après **VAO** si le réglage « VAO : nouvel indice attendu » est actif, défaut oui),
   un nouvel indice est attendu sous le délai de resoumission ; après **VSO**, le document est clos
   (bon pour exécution).
4. **Statuts** : attendu, attendu en retard, en visa, en visa en retard, à resoumettre, à resoumettre
   en retard, visé (VSO), visé avec observations (VAO clos).
5. **Relances** : un document en retard génère une relance à faire vers l'entreprise du lot (document
   ou indice attendu) ou vers les viseurs qui n'ont pas répondu ; elle redevient due tous les N jours
   tant que le retard dure. Chaque relance envoyée est tracée (date, cible, indice).

## Base intégrée (`donnees.js`)

- **Codes de visa** : VSO (visa sans observation), VAO (visa avec observations), REF (refusé), avec
  définition et suite à donner.
- **18 lots types du bâtiment** (tous corps d'état) avec code court : démolition – désamiantage,
  terrassements – VRD, gros œuvre, charpente, couverture – étanchéité, façades – bardage, menuiseries
  extérieures, serrurerie – métallerie, cloisons – doublages – plafonds, menuiseries intérieures,
  revêtements de sols, peinture, plomberie – sanitaires, CVC, électricité courants forts, courants
  faibles, ascenseurs, aménagements extérieurs – espaces verts.
- **Types de documents** avec code : plan d'exécution (PEX), note de calcul (NDC), fiche technique (FT),
  échantillon ou prototype (ECH), carnet de détails (DET), plan de réservations (RES), méthodologie
  (MET), procès-verbal d'essai (PV), notice technique (NOT), calepinage (CAL), schéma de principe (SCH).
- **Documents usuels par lot** (4 à 6 titres types chacun) proposés à la saisie.
- **Rôles des viseurs**.
- **Délais de départ** (paramétrables, jamais présentés comme réglementaires) : visa 15 jours,
  resoumission 15 jours, relance tous les 7 jours, alerte 3 jours avant échéance.

## Calculs (règles pures, `regles.js`, testées par `outils/templates/visa.test.mjs`)

`ajouterJours` (calendaires / ouvrés), `joursFeries` (Pâques par algorithme de Meeus), `indiceSuivant`
(A → B, Z → AA, 0 → 1), `numeroSuivant`, `synthese`, `etatDocument`, `relancesAFaire`, `texteRelance`,
`statistiques` (délai moyen, taux VSO au premier indice, avis par semaine), `registreCSV`.

## Sources

- Mission de visa : Code de la commande publique, art. R2431-4, 7° (mission de base en bâtiment :
  « l'examen de la conformité au projet des études d'exécution et leur visa lorsqu'elles ont été faites
  par un opérateur économique chargé des travaux »), legifrance.gouv.fr, consulté le 12/11/2026. Cité
  dans le guide de l'application comme cadre, sans en tirer de délai.
- Jours fériés : Code du travail, art. L3133-1 (onze jours fériés, version en vigueur depuis le
  10/08/2016), legifrance.gouv.fr, consulté le 12/11/2026. Métropole seulement ; Alsace-Moselle et
  outre-mer non gérés (signalé dans l'aide).
- **Délais de visa et de resoumission : aucun délai officiel retenu.** Ils dépendent du marché (CCAP,
  CCAG de référence, convention de maîtrise d'œuvre) : valeurs de départ paramétrables, par opération.
- Codes VSO / VAO / REF : usage de la profession, non normalisé ; libellés modifiables à terme.

## Risques

- **confidentiel** (voir en-tête). Démo : trois opérations fictives (bureaux, logements collectifs,
  groupe scolaire), entreprises et viseurs fictifs (« Entreprise A », « BET Structure fictif »…).
- **RGPD** léger : noms d'intervenants ; rappel dans l'aide (données professionnelles, à limiter au
  nécessaire).
- Outil d'aide au suivi : ne remplace ni le marché ni le visa lui-même (avertissement dans les réglages).
- Format tableur complémentaire (backlog) : couvert par l'export CSV ; un modèle tableur dédié reste à
  trancher par Quentin.

## Choix d'implémentation

Socle `templates/revision/` ; règles dans `regles.js` (comme `compte-rendu`) ; stockage
`qme-vsa-code|cache|demo` ; refus d'une clé dont `produit !== 'VSA'`.
