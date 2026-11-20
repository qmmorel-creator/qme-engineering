# Campagne X · sur mesure, en anglais

Décision de Quentin du 18/11/2026 : une campagne quotidienne sur X, **uniquement en anglais**, **uniquement sur le
volet sur mesure**. Une publication par jour, en alternant **post** et **vidéo**. Non publié (dossier `docs/`).
Production quotidienne : skill `.claude/skills/campagne-x/`. Journal : `journal-x.md`.

**Publication par Instinct**, comme LinkedIn, Instagram et YouTube (décision du 18/11/2026) :
- Sheet **« Planning publications X »** `1lri4kqQO61Ei4s6w9za2UdudsPhdpas_zKuAIG5N8hM`, onglet `Planning`, dossier Drive
  « QME – Publications X » `1W6TwJQC7BqoGBuoYJeLy62EOaXXroqyA`.
- Colonnes A–K : ID (`X-nn`) · Date · Heure (Europe/Paris) · Statut · Type (`Post` / `Image` / `Vidéo`) · Texte de la publication
  (tel quel, rien d'autre à lire) · Fichier vidéo (contrôle du nom) · ID Drive vidéo · Publié le · URL publication · Remarque.
- Statuts : `À produire` (vidéo pas encore rendue) → `Prêt` → `Programmé` (une fois la routine Instinct confirmée) →
  `Publié` / `Erreur` (écrits par Instinct) ; `Annulé`.
- Routine : `PROMPT-INSTINCT-X.md`, transmise le 18/11/2026 (connexion vérifiée ; publication, vidéo et épinglage testés
  en réel avec X-L01 et X-02). Un passage par heure, à :00, de 08:00 à 23:00.

## Principe

Les 97 templates (interface en français) servent de **preuve** : « j'en ai construit 97, je peux construire le vôtre ».
Chaque publication renvoie vers **`qm-engineering.fr/x`** (redirection 302 de `netlify.toml` vers
`/en/english-version/?utm_source=x&utm_medium=social&utm_campaign=x-custom`).

La page `/en/english-version/` (générée par `node outils/x/generer.mjs` depuis `outils/x/templates-en.json` et les pages
`catalogue/`) liste les 97 templates : capture réelle, mention « French interface », filtre par thème, bouton
**« I'd like it in English »** (compteur `/api/interets`, modules `en-<slug>`, e-mail facultatif ensuite), lien vers la
démo (en français), et deux appels au sur-mesure (`/en/contact/`, bouton `en-sur-mesure`). 34 templates fondés sur des
règles françaises (TVA, droit du travail, barèmes) portent la mention « Built on French rules: an English version would
be adapted to your country ».

**Mesure** : page admin `/admin/interets/` (lignes « · version anglaise » et « Outil sur mesure en anglais ») ;
GoatCounter : campagne `x-custom`, clics `x-contact-*`, `x-demo-<slug>`, `x-filtre-*`.

Après un ajout de template en vente : ajouter sa ligne à `outils/x/templates-en.json`, puis relancer le générateur
(il échoue si une page catalogue manque de capture).

## Règles éditoriales

- Anglais uniquement, phrases courtes, ton direct. Pas d'émoji, pas de superlatif, pas de hashtag en rafale (0 à 2).
- Sujet : **le sur-mesure** (outil construit pour une entreprise, un indépendant, une association). Un template n'est
  qu'un exemple de ce que Quentin sait construire ; jamais de prix de template, jamais de lien Gumroad.
- Honnêteté : les templates sont en français, toujours le dire. Ne jamais laisser croire qu'une version anglaise existe.
  Aucun client nommé, aucun chiffre inventé. Faits utilisables (page `/en/method/`) : appel de 30 minutes, choix de
  l'outil (existant, no-code ou sur mesure), prototype utilisable en quelques jours, automatisation ciblée en 2 à 3 jours,
  outil complet en 5 à 10 jours, Quentin ingénieur et chef de projet depuis 15 ans (dont 7 en bureau d'études).
- Post : **280 caractères au plus** (compte gratuit ; une URL compte 23), lien `qm-engineering.fr/x` en fin.
- Captures : l'interface reste en français ; choisir l'écran le plus parlant visuellement (graphique, planning
  coloré, grand chiffre en titre), jamais une fenêtre modale grisée ni une liste dense.
- Image : 1600 × 900, `production/gabarit-image.html` copié en `production/X-nn.html`, rendu
  `node docs/templates/communication/x/image.mjs production/X-nn.html`.
- Production quotidienne avec une semaine d'avance : tâche planifiée « Campagne X · contenu J+7 » (skill `campagne-x`),
  formats, accroches et thèmes en rotation.
- Vidéo : moteur unique `docs/videos/` (`rendu.mjs`, page HTML animée), 1080 × 1920, 20 à 30 s, **musique QME**,
  captures réelles des démos, sous-titres anglais sur l'interface française, mention « French interface · sample data »
  sur chaque capture, carton final « qm-engineering.fr/x ». Texte d'accompagnement ≤ 280 caractères.
- Horaire des publications quotidiennes : **10:00 heure de Californie** (America/Los_Angeles), décision de Quentin du 18/11/2026, soit **19:00 à Paris** (colonne Heure du planning, toujours en heure de Paris), sauf du 14 au 27/03/2027 et du 31/10 au 06/11/2027 : **18:00** (changements d'heure décalés entre États-Unis et Europe ; vérifier chaque année avec `Intl`).
- Rotation : jamais le même template deux fois en 7 jours sur X ; alterner les thèmes de la page.

## Profil X

Compte existant : **@qmengineering** (créé en avril 2022 ; ancien profil orienté Coda). Identifiant conservé.

- **Bannière** : `png/banniere-x.png` (1500 × 500), source `banniere.html`, rendu `node docs/templates/communication/x/rendre.mjs`
  (produit aussi `assets/x-english-version.png`, image de partage de la page). Contrôles, à ne pas importer :
  `png/banniere-x-zone-sure.png` (cadre magenta = texte, cercle = photo de profil sur ordinateur) et
  `png/banniere-x-controle-iphone.png` (cadrage de l'app iPhone relevé le 18/11/2026 : bannière rognée d'environ 8 % de
  chaque côté, boutons ronds et photo de profil posés sur l'image ; texte et adresse entièrement lisibles).
- **Photo** : logo QME actuel, inchangé.
- **Nom** (50 caractères au plus) : `Quentin Morel · QME` (les posts parlent à la première personne : « I'm Quentin »).
- **Bio** (160 caractères au plus, 140 ici) :
  `Engineer in France. I build custom web apps for small businesses and freelancers. 97 tools built so far, all in French. Want one in English?`
- **Site web** : `qm-engineering.fr/x` (remplace `qm-engineering.fr/en`) : **seulement après la fusion** de la PR qui crée la
  redirection `/x`, sinon le lien mène à une page 404.
- **Localisation** : `France`. **Catégorie professionnelle** : `Application logicielle`, conservée.
- Pas de second lien dans la bio : un seul chemin, mesuré (`utm_campaign=x-custom`).
- **Post épinglé** : X-L01 (18/11, 14:00, présentation de QME) remplace l'ancien post Coda épinglé du 31/07/2023
  (Instinct l'épingle, remarque « Épingler ce post » du planning).

## Lancement · 18/11/2026 : 10 posts, un par heure de 14:00 à 23:00 (Paris)

Demande de Quentin du 18/11 : présentation générale de QME, reprises d'anciens posts sur le sur-mesure (adaptés en
anglais, seuls leurs faits sont repris), références publiques de `/en/custom/#references` (sans nom de client). Le lien `/x`
n'étant pas encore en ligne, ces posts renvoient vers des pages anglaises déjà publiées. X-L01 est épinglé (il
remplace l'ancien post Coda de 2023) ; X-L10 annonce X-01.

### X-L01 · 18/11 14:00 · post épinglé · présentation de QME

```
I'm Quentin Morel, an engineer in France. QME is my studio.

I build custom tools for small businesses: web apps, sites, no-code setups, automation and AI.

15 years in engineering and project management. One rule: the simplest tool that does the job.

qm-engineering.fr/en
```

### X-L02 · 18/11 15:00 · référence · exploitation hydroélectrique

```
A project I'm proud of: a hydropower valley on one screen.

Structures, worksites, incidents and reservoirs on the real terrain. Each worksite opens in 3D with its team, safety and progress.

Custom software doesn't have to look like a spreadsheet.

qm-engineering.fr/en/references/
```

### X-L03 · 18/11 16:00 · reprise IG-31 / LI-46 · le tableur n'est pas le problème

```
I build custom tools. Yet I never say "stop using your spreadsheet."

Spreadsheets are great. Trouble starts when you ask one to:
- be shared by 10 people who shouldn't all see everything
- keep a change history
- send reminders
- work on a phone

qm-engineering.fr/en/custom/
```

### X-L04 · 18/11 17:00 · reprise IG-28 / LI-01 · un outil, trois rôles

```
One tool, three doors.

For a game shop, I built one app with three profiles:
- the manager sees sales, margins, VAT
- staff use the till, never see margins
- game-night hosts run events, no till, no prices

Decide early who must NOT do what.

qm-engineering.fr/en/references/
```

### X-L05 · 18/11 18:00 · reprise IG-29 / LI-03 · la fiche d'arrivée de l'atelier vélo

```
"I left the charger with the bike."
"You should have called before replacing the cassette."

In a bike workshop tool I designed, both are settled at drop-off: items left are ticked, and "go ahead without calling up to €150".

Your trade has rules too.

qm-engineering.fr/en
```

### X-L06 · 18/11 19:00 · reprise IG-30 / LI-24 · maintenance au compteur

```
"Service the press every six months."
Except it ran 200 hours in the first half, 900 in the second.

Calendar maintenance is simple, but often too early or too late. I'd rather build it on the counter: hours, cycles or km, with a date as backup.

qm-engineering.fr/en/custom/
```

### X-L07 · 18/11 20:00 · ce que QME construit · quatre familles

```
What I build, depending on the need:

1. Custom web apps, when no software fits your trade
2. Websites with a demo video and contact form
3. No-code setups in tools your team already uses (Notion, Coda, M365)
4. Automation and AI for what repeats

qm-engineering.fr/en/custom/
```

### X-L08 · 18/11 21:00 · référence · facturation d'une crèche

```
A nursery bills parents on the hours booked, then adjusts to the hours actually attended.

Done by hand, it is slow and easy to get wrong.

I built a tool that goes from the booked schedule to attendance to the invoice, with nothing retyped.

qm-engineering.fr/en/references/
```

### X-L09 · 18/11 22:00 · référence · visas de plans en bureau d'études

```
On a construction project, one late drawing approval can hold up the whole site.

For an engineering firm, I built a register that follows each drawing until it is approved, so delays show up before they stop the works.

I spent 7 years in one.

qm-engineering.fr/en/references/
```

### X-L10 · 18/11 23:00 · les 97 templates en teaser (annonce X-01)

```
To show what custom work looks like, I also built 97 ready-made tools: CRM, Gantt, cash flow, stock, snag lists, budgets.

All in French for now. Tomorrow: how to ask for the ones you'd want in English.

Good night from France.

qm-engineering.fr/en/templates/
```

## Planning des 14 premiers jours

Tous à 19:00 heure de Paris (10:00 en Californie).

Posts rédigés ci-dessous (longueurs contrôlées : `node docs/templates/communication/x/longueurs.mjs`). Vidéos : scénario à
produire par le skill `campagne-x` la veille au plus tard.

| ID | Date | Type | Sujet | Template montré |
|---|---|---|---|---|
| X-01 | 19/11/2026 | Post | Présentation : 97 outils en français | — |
| X-02 | 18/11/2026 12:00 (avancée) | Vidéo | « 97 tools. All in French. » : montage de 8 captures, une par thème | plusieurs |
| X-03 | 21/11/2026 | Post | Le tableur que seule une personne comprend | — |
| X-04 | 22/11/2026 | Vidéo | « Who should I follow up today? » | CRM freelance |
| X-05 | 23/11/2026 | Post | Le plus simple qui suffit (existant, no-code ou sur mesure) | — |
| X-06 | 24/11/2026 | Vidéo | « One task slips. What happens to the end date? » | Gantt |
| X-07 | 25/11/2026 | Post | 11 outils pour le bâtiment et l'exploitation | — |
| X-08 | 26/11/2026 | Vidéo | « Who owes what? » | Gestion Dépenses Communes |
| X-09 | 27/11/2026 | Post | Traduire ne suffit pas : 34 outils suivent des règles françaises | — |
| X-10 | 28/11/2026 | Vidéo | « Your spreadsheet, as an app » : avant / après | Stocks |
| X-11 | 29/11/2026 | Post | La méthode en 4 étapes | — |
| X-12 | 30/11/2026 | Vidéo | « Snags, by contractor, with delays computed » | Levée de réserves |
| X-13 | 01/12/2026 | Post | Question aux freelances : que suivez-vous dans un tableur ? | — |
| X-14 | 02/12/2026 | Vidéo | « How a custom tool starts » : la méthode en motion design | — |

### X-01 · 19/11 · post

```
Yesterday I said I build custom tools. Here is the proof: 97 of them, for freelancers, small businesses and associations.

All in French for now.

Pick the ones you'd want in English. The most requested go first.

qm-engineering.fr/x
```

### X-03 · 21/11 · post

```
Most small businesses run on a spreadsheet only one person understands.

A custom tool keeps the same logic, but:
- several people can use it at once
- it works on a phone
- nobody breaks a formula by accident

Tell me what your spreadsheet does: qm-engineering.fr/x
```

### X-05 · 23/11 · post

```
Not every problem needs a custom app.

Sometimes the tool you already use is enough. Sometimes a no-code setup or one automation does the job.

I start with a 30-minute call on how you work, then pick the simplest option that works.

qm-engineering.fr/x
```

### X-07 · 25/11 · post

```
11 of my 97 tools are for construction and facilities: snag lists, as-built documents, subcontractor compliance, site tracking by package.

Site teams still run these on spreadsheets and email.

All in French for now. Want one built for your sites?

qm-engineering.fr/x
```

### X-09 · 27/11 · post

```
34 of my tools follow French rules: VAT, labour law, tax scales.

Translating the screens is not enough. An English version means rebuilding the rules for your country.

That is custom work, and it is what I do.

Which one would you need? qm-engineering.fr/x
```

### X-11 · 29/11 · post

```
How a custom tool gets built:

1. A 30-minute call on how you work today
2. The right tool: existing, no-code or custom
3. A prototype you can use within days
4. Go-live: data moved, team trained

One automation: 2-3 days. A full tool: 5-10 days.

qm-engineering.fr/x
```

### X-13 · 01/12 · post

```
Freelancers: what do you still track in a spreadsheet you'd rather not?

Unpaid invoices? Time per client? Prospects to follow up?

I built a tool for each of these (in French). Reply with yours, I'll tell you honestly if a custom tool is worth it.

qm-engineering.fr/x
```

### Vidéos : scénarios

Chaque vidéo : accroche lisible dès la première seconde, 2 ou 3 plans de démo réels, sous-titres anglais, carton final
« Built in French. Want yours in English? · qm-engineering.fr/x ».

- **X-02** · « 97 tools. All in French. » (22 s) : accroche « I built 97 tools. » → 8 captures en cascade, une par thème
  (CRM, Gantt, budget commun, stocks, réserves, inscriptions, habitudes, trésorerie), étiquette anglaise sur chacune →
  « Every screen is in French. » → carton final. Texte : `I built 97 tools to show what custom software can look like for a small business. All in French. Which one would you want in English? qm-engineering.fr/x`
- **X-04** · CRM freelance (25 s) : « Who should I follow up today? » → vue « Aujourd'hui » de la démo (relances du jour,
  montant restant à encaisser lu dans l'application) → fiche contact → carton.
- **X-06** · Gantt (25 s) : réutiliser les captures du scénario `docs/videos/scenarios/gantt-retard.mjs` ; « One task
  slips 3 days. » → la barre bouge, le chemin critique se recalcule, la date de fin change (valeurs lues dans la démo).
- **X-08** · Gestion Dépenses Communes (22 s) : « Who owes what? » → dépenses saisies → soldes calculés (valeurs de la démo).
- **X-10** · Stocks (25 s) : avant (tableur figé, dessiné en HTML, sans marque) / après (tableau de bord, alertes, liste à
  commander de la démo).
- **X-12** · Levée de réserves (25 s) : réserves par entreprise, retards calculés, PV prêt à imprimer.
- **X-14** · Méthode (20 s, motion design sans capture) : les 4 étapes de la page Method, durées 2-3 / 5-10 jours.
