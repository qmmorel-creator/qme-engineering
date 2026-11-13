# Fiche Gumroad anglaise · Quick Gantt Planner

Même template que la fiche française (préfixe GNT, mêmes données) ; la connexion par une clé de cette fiche
ouvre l'interface en anglais. Nom validé par Quentin le 13/11/2026 ; prix proposé 49 $ (feu vert de
publication du 13/11/2026). Clé de licence à activer par Quentin dans l'éditeur Gumroad de **cette** fiche
(Content → Insert → License key, sans multi-postes) : la clé de la fiche française ne vaut pas pour celle-ci.
Une fois la fiche créée, reporter son identifiant dans `gumroadEn` de `PRODUITS`
(`netlify/lib/templates-acces.mjs`).

- **Nom** : Quick Gantt Planner
- **Prix** : 49 $ (USD)
- **Permalien** : `quick-gantt-planner`
- **Catégorie** : `business-and-money/management-and-leadership` (comme la fiche française)
- **Contenu** : lien vers https://qm-engineering.fr/templates/gantt/?lang=en (bouton « Open my planner »)
- **Couverture** : `assets/templates-gantt-en-couverture.png` (1280 × 720), source `couverture-en.html`
- **Tags** : gantt, project-planning, critical-path, project-management, construction, small-business, scheduling

## Summary (1 sentence)

An online Gantt planner you type one line per task, with dependencies, public holidays, progress and the
critical path calculated for you.

## Details (rows)

- Format : Web app (computer, tablet, phone)
- Access : License key sent by email
- Language : English (French available)
- Public holidays : England and Wales, United States, France
- Payment : One-time purchase, no subscription

## Receipt text

Your license key (above) is your access code. Click "Open my planner", paste the key, and your planner
opens. Keep this email: the same key works on all your devices.

## Description (HTML)

```html
<h2>Your project plan, one line per task.</h2>
<p>Project management software is too heavy for a renovation, an event or a small-business project, and a spreadsheet can't handle dependencies or public holidays. Type "Install cabinets 12/12 3d after 7": the bar, the link and the dates follow.</p>
<h3>What you get</h3>
<ul>
<li><strong>Quick entry</strong>: name, date, duration, progress, dependencies (after 3, 5SS+2), milestones with a target window, sections; paste several lines at once.</li>
<li><strong>Table and Gantt chart in sync</strong>: edit a cell or drag a bar, everything is recalculated; zoom from days to years.</li>
<li><strong>Full dependencies</strong>: finish-to-start, start-to-start, finish-to-finish, start-to-finish, with lag or lead; loops are refused.</li>
<li><strong>Working days</strong>: weekends and public holidays calculated every year for England and Wales, the United States (federal) or France, or no holidays at all; shaded periods for your own closures.</li>
<li><strong>Critical path</strong>: total and free float, critical tasks in red.</li>
<li><strong>Tracking</strong>: actual progress against today's expected progress, delays, variance against your baseline.</li>
<li><strong>12 templates</strong> ready to adapt (kitchen and bathroom renovation, house build, moving, starting a business, website launch, event, trade show…), A4 or A3 landscape printing and PDF, PNG export.</li>
</ul>
<h3>How it works</h3>
<ol>
<li>After purchase, you receive your <strong>license key</strong> by email.</li>
<li>Click "Open my planner" (or go to <strong>qm-engineering.fr/templates/gantt/?lang=en</strong>) and paste it.</li>
<li>Your plans are saved online: open them on your computer, tablet and phone with the same key.</li>
</ol>
<p>Nothing to install, no account to create. One-time purchase, no subscription. Data hosted in the European Union.</p>
<p><em>Try before you buy: a demo with sample data is available at qm-engineering.fr/en/templates.</em></p>
```
