"""Carrousel Instagram IG-123 (Méthode), 05/02/2027, adapté de LI-64 « J+7, et « STOP » veut dire stop ».
Seuls les faits du Google Doc LI-64 (v2) sont repris ; aucune capture d'outil, aucune donnée réelle.

Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié). Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-123.py
Écrit un HTML temporaire, le rend avec rendre.mjs (png/IG-123-relances-1..5.png), puis le supprime.
"""
import importlib.util
import pathlib
import subprocess

ICI = pathlib.Path(__file__).resolve().parent
IG = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-123', slug='relances', titre='Méthode · J+7, et « STOP » veut dire stop',
  date='05/02/2027', li='LI-64', sourcil='Sur mesure · prospection',
  h1='J+7, et <mark>« STOP »</mark> veut dire stop.',
  sous="Les deux règles au cœur d'un outil de prospection que j'ai conçu.",
  p2=("Une relance de trop coûte plus cher qu'une relance oubliée.",
      "Une prospection ne se mesure pas au nombre d'envois."),
  p2_bas="Elle tient à une relance au bon moment, et au respect de ceux qui ne veulent plus être relancés.",
  v3=('Les deux règles', "Celles qui font l'essentiel.", [
      ('rond', 'J+7', 'Un premier message marqué « envoyé » : la relance est programmée sept jours plus tard, automatiquement.', None),
      ('carre', 'STOP', 'Un contact qui ne veut plus être sollicité est retiré définitivement des envois. Pas mis en pause : retiré.', None)],
      None),
  v4=('Autour, un outil sobre', "Rien de plus que l'utile.", [
      ('Une liste « À faire »', 'Les relances dues et les actions en retard.'),
      ('Un taux de réponse honnête', 'Calculé sur les cibles réellement contactées.')]),
  v5=('Vos relances partent-elles à date fixe ?', ['Ou quand vous y pensez ?', 'Indépendants, commerciaux, associations']),
  alt=["Titre « J+7, et « STOP » veut dire stop. » Les deux règles au cœur d'un outil de prospection.",
       "Fond noir : une relance de trop coûte plus cher qu'une relance oubliée. Une prospection ne se mesure pas au nombre d'envois, mais à une relance au bon moment et au respect de ceux qui ne veulent plus être relancés.",
       "Les deux règles : J+7, une relance programmée automatiquement sept jours après un premier message envoyé ; STOP, un contact qui ne veut plus être sollicité est retiré définitivement des envois, pas mis en pause.",
       "Autour, un outil sobre : une liste « À faire » avec les relances dues et les actions en retard, et un taux de réponse calculé sur les cibles réellement contactées.",
       "Fond rouge : vos relances partent-elles à date fixe, ou quand vous y pensez ? Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""Une relance de trop coûte plus cher qu'une relance oubliée.

C'est la règle que j'ai mise au cœur d'un outil de suivi commercial. Une prospection qui marche ne se mesure pas au nombre d'envois : elle tient à une relance au bon moment, et au respect de ceux qui ne veulent plus être relancés.

Deux règles font l'essentiel.
J+7 : quand un premier message est marqué « envoyé », une relance est programmée automatiquement sept jours plus tard.
STOP : quand un contact demande à ne plus être sollicité, il est retiré définitivement des envois. Pas mis en pause, retiré.

Autour, l'outil reste sobre : une liste « À faire » pour les relances dues et les actions en retard, et un taux de réponse calculé sur les cibles réellement contactées.

Vos relances partent-elles à date fixe, ou quand vous y pensez ? Votre métier a ses règles ? Parlons-en : lien en bio.

#Prospection #RelationClient #Commercial #OutilsSurMesure""")


def rendre(s, i):
    source = (IG / 'publications.html').read_text(encoding='utf-8')
    tete = source.split('<!-- ============ IG-01')[0]
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f"<title>Publication Instagram {s['id']}</title>")
    corps = [f"\n<!-- ============ {s['id']} · {s['titre']} (d'après {s['li']}) ============ -->"] + ig.sur_mesure(s, i)
    page = (tete + '\n'.join(corps) + '\n\n</body>\n</html>\n').replace('../../../../assets/', '../../../../../assets/')
    tmp = ICI / f"_{s['id']}.html"
    tmp.write_text(page, encoding='utf-8')
    try:
        subprocess.run(['node', str(IG / 'rendre.mjs'), f"production/{tmp.name}"], check=True)
    finally:
        tmp.unlink()


if __name__ == '__main__':
    rendre(S, 2)
    print('\n'.join(f'{k + 1}. {a}' for k, a in enumerate(S['alt'])))
