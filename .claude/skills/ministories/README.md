# Skill « ministories » · notice

**Installation.** Le skill est déjà en place dans le dépôt (`.claude/skills/ministories/`) : toute session Claude Code
ouverte sur `qme-engineering` le charge (il apparaît sous le nom `ministories`). Pour l'importer ailleurs :
- Claude Code : décompresser `ministories-skill.zip` dans `.claude/skills/` d'un projet (ou `~/.claude/skills/`).
- claude.ai : dans les réglages, section des skills, importer le ZIP (le dossier `ministories/` est à sa racine ; libellés du menu non vérifiés depuis cette session).
Hors du dépôt QME, les chemins `docs/videos/rendu.mjs`, `carreau.js` et l'épisode pilote n'existent pas : le skill
sert alors de méthode, la production complète demande le dépôt.

**Utilisation.** « Fais une mini-story QME sur <sujet> » ou « une mini-story avec Caro sur <sujet> ».

**Contenu.** `SKILL.md` (procédure) · `references/` (charte QME, Carreau, écriture, production) · `modeles/` (brief,
script, découpage, contrôle qualité) · `outils/apercu.cjs` (planche d'aperçu) · exemple complet :
`docs/ministories/episodes/2026-11-27-le-salaire-a-disparu/`.
