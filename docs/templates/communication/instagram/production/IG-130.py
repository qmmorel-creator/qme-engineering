"""Carrousel Instagram IG-130 · Sur mesure · 8 outils pour un atelier ou un entrepôt (5 vues), adapté de LI-71.

Couverture, vue 4 et appel à l'action du gabarit sur_mesure de construire_ig_06_33.py ; vues 2 et 3 :
la liste des huit outils (variante à quatre points). Seuls les faits du Google Doc LI-71 v2 sont repris.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-130.py
→ png/IG-130-8-outils-1..5.png (HTML temporaire rendu par rendre.mjs, puis supprimé).
"""
import importlib.util
import pathlib
import re
import subprocess

PROD = pathlib.Path(__file__).resolve().parent
ICI = PROD.parent
spec = importlib.util.spec_from_file_location('ig', ICI / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)
e = ig.e

OUTILS = [
    ('1. Le TRS au fil de l\'eau', "Avec les arrêts classés par cause."),
    ('2. La traçabilité par lot', "Pour répondre à un rappel produit en quelques minutes."),
    ('3. La maintenance au compteur', "Au compteur d'heures, plutôt qu'au calendrier."),
    ('4. Le point de commande calculé', "Consommation pendant le délai + stock de sécurité."),
    ("5. L'inventaire tournant", "Compter un peu, souvent, en commençant par les références A."),
    ('6. Des créneaux de quai', "Pour la réception, au lieu d'une file d'attente."),
    ('7. Les non-conformités en 30 secondes', "Et un Pareto qui se fait seul."),
    ('8. Le calcul des besoins', "Nomenclature × ordres − stock − commandes en cours."),
]

S = dict(id='IG-130', slug='8-outils', titre='Sur mesure · 8 outils pour un atelier ou un entrepôt',
  li='LI-71', sourcil='Sur mesure · récapitulatif',
  h1="<mark>Huit outils</mark> pour un atelier ou un entrepôt.",
  sous="Aucun ne demande un progiciel complet pour démarrer.",
  p2=('', ''), p2_bas=None,
  v3=('', '', [], None),
  v4=('Pour démarrer', 'Petit, puis branché.', [
      ('Un petit outil autonome', "Chacun des huit peut commencer seul."),
      ("Puis branché sur l'existant", "Il se raccorde ensuite à ce qui existe déjà.")]),
  v5=('Lequel réglerait un problème cette semaine ?', ['Un numéro suffit, en commentaire', 'Chacun peut démarrer seul']))

ALT = [
    "Titre « Huit outils pour un atelier ou un entrepôt. » Aucun ne demande un progiciel complet pour démarrer.",
    "Outils 1 à 4 : le TRS au fil de l'eau avec les arrêts classés par cause ; la traçabilité par lot pour un rappel produit ; la maintenance au compteur d'heures ; le point de commande calculé (consommation pendant le délai + stock de sécurité).",
    "Outils 5 à 8 : l'inventaire tournant en commençant par les références A ; des créneaux de quai pour la réception ; les non-conformités déclarées en 30 secondes avec un Pareto automatique ; le calcul des besoins (nomenclature × ordres − stock − commandes en cours).",
    "Pour démarrer : chaque outil peut commencer comme un petit outil autonome, puis se brancher sur ce qui existe déjà.",
    "Fond rouge : lequel réglerait un problème cette semaine ? Un numéro suffit, en commentaire. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """Huit outils pour un atelier ou un entrepôt. Aucun ne demande un progiciel complet pour démarrer.

Ces derniers mois, j'ai partagé plusieurs idées d'outils pour les ateliers, les usines et les entrepôts. Les voici rassemblées, à garder sous la main :

1. Le TRS calculé au fil de l'eau, arrêts classés par cause.
2. La traçabilité par lot, pour répondre à un rappel produit en quelques minutes.
3. La maintenance au compteur d'heures, plutôt qu'au calendrier.
4. Le point de commande calculé.
5. L'inventaire tournant, en commençant par les références A.
6. Des créneaux de quai pour la réception.
7. Des non-conformités déclarées en 30 secondes, et un Pareto qui se fait seul.
8. Le calcul des besoins.

Chacun peut commencer comme un petit outil autonome, puis se brancher sur ce qui existe déjà.

Lequel réglerait le plus vite un problème que vous avez cette semaine ? Un numéro suffit. Et si votre métier a ses règles, parlons-en : lien en bio.

#OutilsSurMesure #Industrie #Logistique #Maintenance #PME"""


def vue_liste(pid, slug, n, fond, sourcil, h2, pts):
    style = {'encre': ('background:var(--encre);color:var(--papier)', ' style="color:var(--jaune)"'),
             'bleu': ('background:var(--bleu);color:#fff', ' style="opacity:.85"')}[fond]
    lignes = '\n    '.join(f'<div><b>{e(b)}</b>{e(t)}</div>' for b, t in pts)
    return f'''<section class="cadre choix" id="{pid}-{slug}-{n}">
  <div class="bandeau" style="{style[0]}"><p class="sourcil"{style[1]}>{e(sourcil)}</p><h2 style="max-width:none">{e(h2)}</h2></div>
  <span class="compteur">{n} / 5</span>
  <div class="pts large" style="top:390px;gap:44px">
    {lignes}
  </div>
  <p class="note" style="left:84px;right:auto">Idées partagées sur LinkedIn ces derniers mois</p>
</section>'''


def sections():
    pid, slug = S['id'], S['slug']
    v = ig.sur_mesure(S, 2)
    blocs = [v[0],
             vue_liste(pid, slug, 2, 'encre', 'Outils 1 à 4', 'Produire, tracer, entretenir, commander.', OUTILS[:4]),
             vue_liste(pid, slug, 3, 'bleu', 'Outils 5 à 8', 'Compter, recevoir, corriger, prévoir.', OUTILS[4:]),
             v[3], v[4]]
    return [re.sub(r'>\d+ / \d+</span>', f'>{k} / 5</span>', b) for k, b in enumerate(blocs, 1)]


def rendre(pid, blocs):
    tete = (ICI / 'publications.html').read_text(encoding='utf-8').split('<!-- ============ IG-01')[0]
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f'<title>Publication Instagram {pid}</title>')
    tmp = ICI / f'_{pid}.html'
    tmp.write_text(tete + '\n'.join(blocs) + '\n\n</body>\n</html>\n', encoding='utf-8')
    try:
        subprocess.run(['node', str(ICI / 'rendre.mjs'), tmp.name], check=True)
    finally:
        tmp.unlink()


if __name__ == '__main__':
    rendre(S['id'], sections())
