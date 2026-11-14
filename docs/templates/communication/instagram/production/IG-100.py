"""Carrousel Instagram IG-100 · Méthode · le point de commande, calculé (6 vues), adapté de LI-27.

Gabarit sur_mesure de construire_ig_06_33.py, plus une vue de points (construction de l'outil) ; seuls
les faits du Google Doc LI-27 v2 sont repris (exemple chiffré du post, données fictives).

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-100.py
→ png/IG-100-point-de-commande-1..6.png (HTML temporaire rendu par rendre.mjs, puis supprimé).
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

S = dict(id='IG-100', slug='point-de-commande', titre='Méthode · Quand recommander ? Le point de commande, calculé',
  li='LI-27', sourcil='Sur mesure · méthode',
  h1="Quand recommander ? <mark>Au calcul</mark>, pas au jugé.",
  sous="Le point de commande tient en une ligne.",
  p2=("« On recommande quand il n'y en a presque plus. »",
      "Soit la rupture pendant le délai de livraison, soit le surstock par peur."),
  p2_bas="C'est la règle la plus répandue, et la plus coûteuse.",
  v3=('Le point de commande', '40 × 10 + 120 = 520.', [
      ('barres', 'Consommation pendant le délai', "40 unités par jour × 10 jours de délai fournisseur.", None),
      ('rond', '+ stock de sécurité', "120 unités dans l'exemple.", None),
      ('quart', '= 520', "Dès que le stock disponible passe sous 520, on commande.", None)],
      'Exemple chiffré, données fictives'),
  v4=('Le stock de sécurité', 'Reste une décision.', [
      ('Il dépend du coût d\'une rupture', "Une vis à 2 centimes et une pièce qui bloque une ligne entière n'ont pas la même marge."),
      ("L'outil calcule le reste", "La décision, elle, reste la vôtre.")]),
  v5=('Combien de vos références sont recommandées « au jugé » ?', ['Magasin, atelier, entrepôt', 'Une règle par article, calculée chaque matin']))

CONSTRUCTION = [
    ('La consommation moyenne', "calculée sur les sorties réelles des dernières semaines, au lieu d'être estimée."),
    ('Le délai de chaque fournisseur', "mis à jour à chaque réception : celui qui annonce 10 jours et livre en 14 se voit."),
    ('Le stock disponible', "le stock physique moins ce qui est déjà réservé."),
    ('Chaque matin', "la liste des articles passés sous leur point de commande, avec la quantité proposée."),
]

ALT = [
    "Titre « Quand recommander ? Au calcul, pas au jugé. » Le point de commande tient en une ligne.",
    "Fond noir : « On recommande quand il n'y en a presque plus. » Soit la rupture pendant le délai de livraison, soit le surstock par peur. C'est la règle la plus répandue, et la plus coûteuse.",
    "Le point de commande : 40 unités par jour × 10 jours de délai + 120 unités de sécurité = 520. Dès que le stock disponible passe sous 520, on commande. Exemple chiffré, données fictives.",
    "Comment je le construirais : consommation moyenne calculée sur les sorties réelles, délai de chaque fournisseur mis à jour à chaque réception, stock disponible égal au physique moins le réservé, et chaque matin la liste des articles à recommander avec la quantité proposée.",
    "Le stock de sécurité reste une décision : il dépend du coût d'une rupture. Une vis à 2 centimes et une pièce qui bloque une ligne entière n'ont pas la même marge.",
    "Fond rouge : combien de vos références sont recommandées « au jugé » ? Magasin, atelier, entrepôt. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """« On recommande quand il n'y en a presque plus. » C'est la règle la plus répandue, et la plus coûteuse.

Elle mène soit à la rupture pendant le délai de livraison, soit au surstock par peur. La règle utile tient en une ligne : consommation pendant le délai fournisseur, plus stock de sécurité. 40 unités par jour, 10 jours de délai, 120 de sécurité : on commande dès que le stock disponible passe sous 520.

Pour un magasin, un atelier ou un entrepôt, je la construirais avec des chiffres tenus à jour : la consommation tirée des sorties réelles, le délai propre à chaque fournisseur, le stock réservé déduit. Et chaque matin, la liste de ce qu'il faut commander.

Le stock de sécurité, lui, reste votre décision : une vis à 2 centimes n'a pas la même marge qu'une pièce qui bloque une ligne entière.

Votre métier a ses règles ? Parlons-en : lien en bio.

#Logistique #Stock #Approvisionnement #OutilsSurMesure #PME"""


def vue_points(pid, slug, sourcil, h2, pts):
    lignes = '\n    '.join(f'<div><b>{e(b)}</b>{e(t)}</div>' for b, t in pts)
    return f'''<section class="cadre choix" id="{pid}-{slug}-9">
  <div class="bandeau" style="background:var(--bleu);color:#fff"><p class="sourcil" style="opacity:.85">{e(sourcil)}</p><h2 style="max-width:none">{e(h2)}</h2></div>
  <span class="compteur">9 / 9</span>
  <div class="pts large" style="top:380px;gap:40px">
    {lignes}
  </div>
  {ig.MARQUE.format(s='symbole', ms='', es='', url='qm-engineering.fr/sur-mesure')}
</section>'''


def renumeroter(blocs, pid, slug):
    n = len(blocs)
    sortie = []
    for k, b in enumerate(blocs, 1):
        b = re.sub(rf'id="{pid}-{slug}-\d+"', f'id="{pid}-{slug}-{k}"', b)
        b = re.sub(r'>\d+ / \d+</span>', f'>{k} / {n}</span>', b)
        sortie.append(b)
    return sortie


def sections():
    v = ig.sur_mesure(S, 2)
    construction = vue_points(S['id'], S['slug'], 'Comment je le construirais', 'Des chiffres tenus à jour.', CONSTRUCTION)
    return renumeroter([v[0], v[1], v[2], construction, v[3], v[4]], S['id'], S['slug'])


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
