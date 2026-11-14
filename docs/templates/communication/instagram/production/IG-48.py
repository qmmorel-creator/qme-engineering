"""IG-48 · Carrousel « Méthode » : votre planning est-il encore vrai ? D'après le script J9 de
videos-30-jours.md (raisonnement de chef de projet : carrousel plutôt que Reel). Gabarits du template
(couverture, problème, écran, appel à l'action) de construire_ig_06_33.py, vue 4 au gabarit des points
du sur mesure. Faits : script J9, gantt/linkedin.md (planning de référence, suivi face au prévu) et l'écran
Suivi de la démo (capture assets/templates-gantt-suivi.webp, données fictives). Prix : gumroad-en-vente
du 15/11/2026 (45 €).

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-48.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-48.html
"""
import importlib.util
import json
import pathlib

ICI = pathlib.Path(__file__).resolve().parent
IG = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)


def ecrire(pid, blocs):
    tete = (IG / 'publications.html').read_text(encoding='utf-8').split('<!-- ============ IG-01')[0]
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f'<title>Publication Instagram {pid}</title>')
    page = tete + '\n'.join(blocs) + '\n\n</body>\n</html>\n'
    page = page.replace("../../../../assets/", "../../../../../assets/")
    (ICI / f'{pid}.html').write_text(page, encoding='utf-8')


PID, SLUG = 'IG-48', 'planning-encore-vrai'
T = dict(id=PID, slug=SLUG, prix=45, demo='quatre plannings fictifs',
         plus='Plusieurs chantiers, vos équipes, vos ressources')


def points(n, sourcil, h2, pts):
    pts_html = '\n    '.join(f'<div><b>{ig.e(b)}</b>{ig.e(t)}</div>' for b, t in pts)
    return f'''<section class="cadre choix" id="{PID}-{SLUG}-{n}">
  <div class="bandeau" style="background:var(--jaune)"><p class="sourcil">{ig.e(sourcil)}</p><h2 style="max-width:none">{ig.e(h2)}</h2></div>
  <span class="compteur">{n} / 5</span>
  <div class="pts large grand" style="top:410px;gap:64px">
    {pts_html}
  </div>
  {ig.MARQUE.format(s='symbole', ms='', es='', url='qm-engineering.fr/templates')}
</section>'''


BLOCS = [
    f"\n<!-- ============ {PID} · Méthode · Votre planning est-il encore vrai ? (script J9) ============ -->",
    ig.couv(PID, SLUG, 'Méthode · chef de projet', 'rouge', 'Votre planning <span style="white-space:nowrap">est-il</span> <mark>encore vrai</mark> ?',
            "Un planning qui ne bouge jamais, personne ne le regarde.", 2),
    ig.probleme(PID, SLUG, ("Un planning qui ne bouge jamais, c'est un planning que personne ne regarde.",
                            "Le retard ne pose pas problème. Le découvrir trop tard, si."), None, 'rouge'),
    ig.ecran(PID, SLUG, 3, 'bleu', 'Deux plannings', 'La référence, puis le suivi.', 'gantt-suivi', [
        "<b>Le planning du lancement</b> est gardé comme référence.",
        "<b>Le planning suivi</b> est mis à jour chaque semaine.",
        "<b>L'écart entre les deux</b> dit où en est le projet."],
        'Planning Gantt rapide, capture de la démo · données fictives'),
    points(4, "Chaque semaine", "L'écart, en clair.", [
        ("L'avancement réel", "Face à l'avancement attendu à la date du jour."),
        ('Les retards', "Tâches en retard et jalons sortis de leur plage."),
        ("L'écart à la référence", "En jours ouvrés, tâche par tâche, et sur la fin du projet.")]),
    ig.cta_template(T),
]

ALT = [
 "Titre « Votre planning est-il encore vrai ? » Un planning qui ne bouge jamais, personne ne le regarde.",
 "Fond noir : un planning qui ne bouge jamais, c'est un planning que personne ne regarde. Le retard ne pose pas problème. Le découvrir trop tard, si.",
 "Deux plannings : celui du lancement gardé comme référence, celui qu'on suit mis à jour chaque semaine ; l'écart entre les deux dit où en est le projet. Capture de l'écran Suivi du Planning Gantt rapide, données fictives.",
 "Chaque semaine, l'écart en clair : l'avancement réel face à l'attendu, les tâches en retard et les jalons hors plage, l'écart à la référence en jours ouvrés.",
 "Fond jaune : essayez le Planning Gantt rapide avec quatre plannings fictifs, démo libre, achat unique à 45 €. Besoin de plus ? Plusieurs chantiers, vos équipes, vos ressources : version sur mesure. Lien en bio.",
]

LEGENDE = """Un planning qui ne bouge jamais, c'est un planning que personne ne regarde.

Le planning du lancement, je le garde comme référence. Celui que je suis, je le mets à jour chaque semaine. C'est l'écart entre les deux qui dit où en est le projet : l'avancement réel face à l'attendu, les tâches en retard, le décalage de la fin.

Quinze ans de projets m'ont appris ça : ce n'est pas le retard qui pose problème, c'est de le découvrir trop tard.

Le Planning Gantt rapide garde ce planning de référence et suit l'avancement face au prévu, en jours ouvrés. Achat unique, 45 €. Plusieurs chantiers, vos équipes, vos ressources ? Je construis la version sur mesure.

Démo libre avec quatre plannings fictifs : lien en bio.

Et vous, votre planning, vous le remettez à jour à quel rythme ?

#GestionDeProjet #Planning #ChefDeProjet #PME"""

PREMIER_COMMENTAIRE = "Planning Gantt rapide, achat unique 45 € : https://qmengineering.gumroad.com/l/planning-gantt"

if __name__ == '__main__':
    ecrire(PID, BLOCS)
    print(json.dumps(dict(alt=ALT, legende=LEGENDE, commentaire=PREMIER_COMMENTAIRE), ensure_ascii=False))
