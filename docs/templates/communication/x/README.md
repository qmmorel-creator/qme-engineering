# Campagne X · sur mesure, en anglais

Décision de Quentin du 18/11/2026 : une campagne quotidienne sur X, **uniquement en anglais**, **uniquement sur le
volet sur mesure**. Une publication par jour, en alternant **post** et **vidéo**. Non publié (dossier `docs/`).
Production quotidienne : skill `.claude/skills/campagne-x/`. Journal : `journal-x.md`.

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
- Vidéo : moteur unique `docs/videos/` (`rendu.mjs`, page HTML animée), 1080 × 1920, 20 à 30 s, **musique QME**,
  captures réelles des démos, sous-titres anglais sur l'interface française, mention « French interface · sample data »
  sur chaque capture, carton final « qm-engineering.fr/x ». Texte d'accompagnement ≤ 280 caractères.
- Horaire : **15:30 (Europe/Paris)** = 9:30 à New York, 14:30 à Londres.
- Rotation : jamais le même template deux fois en 7 jours sur X ; alterner les thèmes de la page.

## Profil X

- **Bannière** : `png/banniere-x.png` (1500 × 500), source `banniere.html`, rendu `node docs/templates/communication/x/rendre.mjs`
  (produit aussi `assets/x-english-version.png`, image de partage de la page). Contrôle : `png/banniere-x-zone-sure.png`
  (cadre magenta = texte, cercle = photo de profil ; ne pas importer).
- **Nom** : `Quentin Morel · QME`
- **Bio** (160 caractères au plus, 140 ici) :
  `Engineer in France. I build custom web apps for small businesses and freelancers. 97 tools built so far, all in French. Want one in English?`
- **Lien** : `qm-engineering.fr/x` · **Localisation** : `France`
- **Post épinglé** : X-01.

## Planning des 14 premiers jours

Posts rédigés ci-dessous (longueurs contrôlées : `node docs/templates/communication/x/longueurs.mjs`). Vidéos : scénario à
produire par le skill `campagne-x` la veille au plus tard.

| ID | Date | Type | Sujet | Template montré |
|---|---|---|---|---|
| X-01 | 19/11/2026 | Post (épinglé) | Présentation : 97 outils en français | — |
| X-02 | 20/11/2026 | Vidéo | « 97 tools. All in French. » : montage de 8 captures, une par thème | plusieurs |
| X-03 | 21/11/2026 | Post | Le tableur que seule une personne comprend | — |
| X-04 | 22/11/2026 | Vidéo | « Who should I follow up today? » | CRM freelance |
| X-05 | 23/11/2026 | Post | Le plus simple qui suffit (existant, no-code ou sur mesure) | — |
| X-06 | 24/11/2026 | Vidéo | « One task slips. What happens to the end date? » | Gantt |
| X-07 | 25/11/2026 | Post | 11 outils pour le bâtiment et l'exploitation | — |
| X-08 | 26/11/2026 | Vidéo | « Who owes what? » | Budget commun |
| X-09 | 27/11/2026 | Post | Traduire ne suffit pas : 34 outils suivent des règles françaises | — |
| X-10 | 28/11/2026 | Vidéo | « Your spreadsheet, as an app » : avant / après | Stocks |
| X-11 | 29/11/2026 | Post | La méthode en 4 étapes | — |
| X-12 | 30/11/2026 | Vidéo | « Snags, by contractor, with delays computed » | Levée de réserves |
| X-13 | 01/12/2026 | Post | Question aux freelances : que suivez-vous dans un tableur ? | — |
| X-14 | 02/12/2026 | Vidéo | « How a custom tool starts » : la méthode en motion design | — |

### X-01 · 19/11 · post épinglé

```
I'm Quentin, an engineer in France. I build custom web apps for small businesses and freelancers.

To show what that looks like, I built 97 ready-made tools. All in French for now.

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
- **X-08** · Budget commun (22 s) : « Who owes what? » → dépenses saisies → soldes calculés (valeurs de la démo).
- **X-10** · Stocks (25 s) : avant (tableur figé, dessiné en HTML, sans marque) / après (tableau de bord, alertes, liste à
  commander de la démo).
- **X-12** · Levée de réserves (25 s) : réserves par entreprise, retards calculés, PV prêt à imprimer.
- **X-14** · Méthode (20 s, motion design sans capture) : les 4 étapes de la page Method, durées 2-3 / 5-10 jours.
