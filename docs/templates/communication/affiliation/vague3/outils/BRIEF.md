# Brief sourcing · vague 3 d'affiliation QME (validée par Quentin le 27/11/2026)

QME (Quentin Morel Engineering, qm-engineering.fr) vend sur Gumroad des outils en ligne prêts à l'emploi (navigateur,
téléphone ou ordinateur, sans abonnement, en français, prix en euros). On cherche des créateurs de contenu
FRANCOPHONES à qui proposer un partenariat d'affiliation (commission sur chaque vente via leur lien). Ta mission :
SOURCER et VÉRIFIER, rien d'autre. Tu n'envoies aucun mail, ne crées aucun brouillon, n'écris rien dans Nexora.

## Critères (obligatoires, sinon le créateur est écarté)
1. Francophone, actif (publication dans les 6 derniers mois), contenu lié à la niche demandée.
2. Plus de 5 000 abonnés sur au moins une plateforme : chiffre LU sur une page (YouTube, site, média kit…), avec la
   date de lecture (27/11/2026) et l'URL source. Jamais estimé.
3. Adresse e-mail PUBLIQUE, affichée par le créateur lui-même (site, page contact, mentions légales, description
   YouTube lisible, Linktree, flux RSS, média kit). Jamais devinée, jamais construite. Note l'URL où tu l'as lue.
4. Exclus : créateurs qui vendent déjà leur propre outil, tableur, appli, planner imprimable ou formation concurrente
   sur le même usage (noter "concurrent" et écarter) ; finance/investissement ; contenus pour adultes ou polémiques ;
   comptes de grandes marques/enseignes ; agences (sauf si on te les demande).
5. Anti-doublon (à faire pour CHAQUE candidat retenu, avant de le garder) :
   a. Nexora : ToolSearch "select:mcp__Nexora__list_qme,mcp__Gmail__search_threads" puis
      `mcp__Nexora__list_qme` domain "createurs", query = l'adresse e-mail, puis query = le domaine de l'adresse (si ce
      n'est pas gmail/hotmail/outlook/yahoo/orange/free/laposte/icloud/sfr/wanadoo/live), puis query = le nom du créateur.
      Toute correspondance = déjà contacté → écarter.
   b. Gmail : `mcp__Gmail__search_threads` query "to:<adresse>" puis "from:<adresse>". Un résultat → écarter.
   c. Opposition : `curl -s -H "X-Prospection-Token: dummy" "https://qm-engineering.fr/api/compte/opposition?email=<adresse url-encodée>"`
      (le proxy injecte le vrai jeton). Si la réponse indique que l'adresse ou le domaine est opposé → écarter. Si
      l'API ne répond pas correctement, note "opposition non vérifiée" (ne pas écarter, mais le signaler).
6. Pas de doublon dans ta propre liste (même adresse ou même personne).

## Outils web
WebSearch et WebFetch (charge-les avec ToolSearch "select:WebSearch,WebFetch" si besoin). Instagram/TikTok/LinkedIn
bloquent souvent la lecture : privilégie YouTube (page /about, description), sites et blogs, podcasts, Linktree.

## Produits QME (démo sans inscription : https://qm-engineering.fr/templates/<slug>/?demo)
voyage (Planificateur de voyage : étapes, nuits, activités, budget, qui doit quoi) · voiture (Carnet de voiture :
entretiens à la date ou au km, dépenses, coût au km) · animal (Suivi d'un animal : soins, vétérinaire, poids, frais) ·
travaux (Pilote de travaux : devis comparés, budget et planning des artisans) · entretien (Entretien de la maison :
chaudière, ramonage, VMC, échéances) · demenagement (Déménagement : rétroplanning, démarches, cartons retrouvés) ·
garde-manger (DLC et DDM, à consommer en priorité, gaspillage) · repas (Repas et courses : menus de la semaine, liste
par rayon) · course-a-pied (Plan d'entraînement course à pied : allures, semaines jusqu'à la course) · bebe (Suivi du
bébé : tétées, sommeil, couches, à deux parents) · potager (Calendrier du potager : semis, rotation des planches) ·
gestion-classe (notes, moyennes, compétences, bulletins) · progression (Progression pédagogique) · quiz (Banque de quiz)
· assemblee-generale · benevoles · subventions (associations) · location-saisonniere · gestion-locative · copropriete.
Packs : Pack Propriétaire, Pack Maison et famille, Pack Forme, Pack Écoles et formateurs, Pack Associations.

## Sortie
Écris un fichier JSON (tableau) au chemin indiqué dans ta mission. Un objet par créateur RETENU :
{ "nom": "Prénom Nom ou nom du compte", "compte": "@handle ou nom de chaîne", "plateforme": "YouTube|Instagram|…",
  "url": "lien principal", "abonnes": "34,4 k YouTube (lu le 27/11/2026)", "abonnesSource": "URL",
  "email": "adresse", "emailSource": "URL où l'adresse est affichée", "niche": "<ta niche>",
  "produits": ["slug principal", "slug 2", "slug 3"], "demo": "slug de la démo à montrer (le plus pertinent)",
  "accroche": "UNE phrase factuelle et précise sur SON contenu récent (titre ou sujet d'une vidéo/article daté), qui
  servira à ouvrir le mail ; pas de flatterie",
  "pourquoi": "en quoi les produits servent son audience (1 phrase)", "derniere": "date de la dernière publication",
  "aVerifier": "" ou un point de vigilance (ex. 'vend un ebook voyage', 'opposition non vérifiée'),
  "controles": "nexora ok · gmail ok · opposition ok" }
Puis un second tableau dans <fichier>-ecartes.json : { nom, url, motif } pour les candidats écartés (doublon,
concurrent, < 5 000, pas de mail public…), pour traçabilité.

Rapport final (court) : nombre retenus, nombre écartés par motif, chemin des fichiers, et toute difficulté.
Rigueur absolue : aucune donnée inventée. Si tu ne trouves pas le nombre visé avec les critères, rends moins.
