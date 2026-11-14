"""Carrousel Instagram IG-107 (Sur mesure · 10 règles chiffrées qui évitent des erreurs), 19/01/2027,
adapté de LI-48 (Google Doc du planning LinkedIn).

Seuls les faits du post LinkedIn sont repris (les dix règles, mot pour mot ou presque). Gabarit
sur_mesure de construire_ig_06_33.py (importé, non modifié) ; vues 3 et 4 remplacées par deux listes
numérotées (règles 1 à 5, 6 à 10).
Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-107.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-107.html
"""
import importlib.util
import pathlib

ICI = pathlib.Path(__file__).resolve().parent
IG_DIR = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG_DIR / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)


def ecrire(pid, titre, li, sections):
    source = (IG_DIR / 'publications.html').read_text(encoding='utf-8')
    tete = source.split('<!-- ============ IG-01')[0].replace("'../../../../assets/", "'../../../../../assets/")
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f'<title>Publication Instagram {pid}</title>')
    corps = [f"\n<!-- ============ {pid} · {titre} (d'après {li}) ============ -->"] + sections
    (ICI / f'{pid}.html').write_text(tete + '\n'.join(corps) + '\n\n</body>\n</html>\n', encoding='utf-8')

REGLES = [
    ('Urgent', 'Marge de moins de 7 jours (jours avant l\'échéance − travail restant).'),
    ('Facturation au temps', 'Tolérance de 5 minutes, arrondi aux 15 minutes.'),
    ('Alerte budget au rythme', 'Écart de 15 points entre le budget consommé et le mois écoulé.'),
    ('Dépense inhabituelle', 'Plus de 1,8 fois la moyenne, et au moins 20 € d\'écart.'),
    ('Abonnement hebdomadaire', '× 52 / 12, pas × 4.'),
    ('Point de commande', 'Consommation pendant le délai + stock de sécurité.'),
    ('Adultes requis', 'Enfants ÷ taux, arrondi au supérieur.'),
    ('TRS', 'Disponibilité × performance × qualité.'),
    ('Stock d\'un ravitaillement', 'Coureurs attendus × consommation × 1,25.'),
    ('Une automatisation', '20 actions par jour au plus, et tout s\'annule.'),
]

S = dict(id='IG-107', slug='dix-regles', titre='Sur mesure · 10 règles chiffrées qui évitent des erreurs',
  sourcil='Sur mesure · méthode',
  h1="<mark>10 règles</mark> chiffrées qui évitent des erreurs.", sous="Tirées des outils que je conçois. À enregistrer.",
  p2=("Urgent = moins de 7 jours de marge.",
      "Écrite une fois, plus personne n'a besoin de s'en souvenir."),
  p2_bas="Dans les outils que je conçois, beaucoup de cas tiennent en une règle chiffrée. En voici dix.",
  v3=('', '', [], None), v4=('', '', []),
  v5=('Et les règles de votre métier ?', ['Écrites une fois', 'Elles ne dépendent plus de la mémoire de quelqu\'un']))

STYLE = '''<style>
.regles{position:absolute;left:84px;right:84px;top:350px;display:flex;flex-direction:column;gap:22px}
.regle{display:grid;grid-template-columns:110px 1fr;gap:28px;align-items:center;background:var(--surface);border:4px solid var(--encre);padding:20px 26px}
.regle .n{width:110px;height:110px;display:grid;place-items:center;font-size:60px;font-weight:800;letter-spacing:-.03em}
.regle b{display:block;font-size:40px;font-weight:800;letter-spacing:-.025em;line-height:1.05}
.regle span{display:block;font-size:29px;line-height:1.3;color:var(--texte-2);margin-top:6px}
</style>'''
FORMES = ['background:var(--jaune);border-radius:50%', 'background:var(--rouge);color:#fff',
          'background:var(--bleu);color:#fff;border-top-left-radius:110px']


def vue(n, debut, bandeau, sourcil, h2):
    lignes = '\n    '.join(
        f'<div class="regle"><div class="n" style="{FORMES[k % 3]}">{k + 1}</div>'
        f'<div><b>{ig.e(t)}</b><span>{ig.e(d)}</span></div></div>'
        for k, (t, d) in list(enumerate(REGLES))[debut:debut + 5])
    coul = 'background:var(--encre);color:var(--papier)' if bandeau == 'encre' else 'background:var(--jaune)'
    sc = ' style="color:var(--jaune)"' if bandeau == 'encre' else ''
    return f'''<section class="cadre choix" id="IG-107-dix-regles-{n}">
  <div class="bandeau" style="{coul}"><p class="sourcil"{sc}>{ig.e(sourcil)}</p><h2 style="max-width:none">{ig.e(h2)}</h2></div>
  <span class="compteur">{n} / 5</span>
  <div class="regles">
    {lignes}
  </div>
</section>'''


out = ig.sur_mesure(S, 1)
out[2] = vue(3, 0, 'encre', 'Règles 1 à 5', 'Temps, argent, alertes.')
out[3] = vue(4, 5, 'jaune', 'Règles 6 à 10', 'Stocks, encadrement, machines.')
ecrire(S['id'], S['titre'], 'LI-48', [STYLE] + out)
