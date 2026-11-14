"""IG-109 · Carrousel « Sur mesure » adapté de LI-49 (340 points de fidélité. D'où viennent-ils ?). Seuls les faits du Google Doc LI-49 sont
repris ; aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-109.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-109.html
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


S = dict(id='IG-109', slug='points-fidelite', sourcil='Sur mesure · données',
  h1="<mark>340 points</mark> de fidélité. D'où viennent-ils ?", sous="Si l'outil ne stocke que ce chiffre, personne ne peut le dire.",
  p2=("Dans l'outil de boutique de jeux de société que j'ai conçu, je n'enregistre jamais un solde.",
      "J'enregistre des mouvements, et le solde se calcule."),
  p2_bas=None,
  v3=('Les mouvements', 'Chaque point a son origine.', [
      ('carre', 'Un achat', '1 point par euro dépensé.', None),
      ('rond', 'Une soirée jeux honorée', '20 points.', None),
      ('quart', 'Une récompense utilisée', '100 points retirés, soit 5 € de remise.', None)],
      'Exemple illustratif, aucune donnée réelle'),
  v4=('Les règles', "Chaque chiffre s'explique.", [
      ('Un ajustement, avec son motif', "Geste commercial ou correction : il ne fait pas monter de palier."),
      ('Bronze, Argent, Or', 'Le palier se calcule sur les 12 derniers mois.'),
      ('Une erreur ? Un mouvement inverse', "Sans effacer l'historique. Si les règles changent, le passé reste tel qu'il était.")]),
  v5=('Un total qui évolue ?', ["Stock, compteur d'heures, crédit de formation", "Je garde les mouvements qui l'expliquent"]))

ALT = [
    "Titre « 340 points de fidélité. D'où viennent-ils ? » Si l'outil ne stocke que ce chiffre, personne ne peut le dire.",
    "Fond noir : dans l'outil de boutique de jeux de société que j'ai conçu, je n'enregistre jamais un solde. J'enregistre des mouvements, et le solde se calcule.",
    "Les mouvements : un achat rapporte 1 point par euro dépensé ; une soirée jeux honorée, 20 points ; une récompense utilisée retire 100 points, soit 5 € de remise. Exemple illustratif.",
    "Les règles : un ajustement avec son motif, qui ne fait pas monter de palier ; palier Bronze, Argent, Or sur les 12 derniers mois ; une erreur se corrige par un mouvement inverse, sans effacer l'historique.",
    "Fond rouge : un total qui évolue, stock, compteur d'heures, crédit de formation ? Je garde les mouvements qui l'expliquent. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · 340 points de fidélité. D'où viennent-ils ? (d'après LI-49) ============ -->"]
           + ig.sur_mesure(S, 3))
    print(json.dumps(ALT, ensure_ascii=False))
