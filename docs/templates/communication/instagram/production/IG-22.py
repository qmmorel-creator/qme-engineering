"""Carrousel Instagram IG-22 (T45 · Gestion de parc informatique), 17/02/2027, d'après LI-93.

Template pas encore en vente au 15/11/2026 (absent de Gumroad) : aucun prix, « Bientôt en vente ».
Gabarits de construire_ig_06_33.py (importé, non modifié). Captures : démo ?demo servie en local,
capturées avec Playwright (bandeau démo masqué) dans captures/.
Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-22.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-22.html
"""
import importlib.util
import pathlib

ICI = pathlib.Path(__file__).resolve().parent
IG_DIR = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG_DIR / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)
ig.A = 'captures/'

T = dict(id='IG-22', slug='parc-informatique', dossier='parc-informatique', nom='Gestion de parc informatique',
  titre='T45 · Gestion de parc informatique', prix=None, prix_txt='Bientôt en vente', couleur='PME · parc informatique',
  h1="<mark>Qui récupère</mark> son portable vendredi\u00a0?",
  sous="Un salarié part : matériel, téléphone, licences, tout au même endroit.",
  p2=("Les numéros de série dorment sur des factures, les garanties expirent sans prévenir.",
      "Et les licences s'achètent au jugé."),
  v3=('Gestion de parc informatique', 'Les alertes qui comptent.', 'parc-informatique-alertes', [
      "<b>Départ avec matériel non rendu</b>, licence expirée, garantie qui se termine.",
      "<b>Fin de garantie calculée</b> à partir de la date d'achat.",
      "<b>Qui a eu quoi, et quand</b> : affectations nominatives datées."],
      'Capture de la démo, données fictives.'),
  v4=('Licences', 'Postes achetés, postes attribués.', 'parc-informatique-licences', [
      "<b>Dépassements et échéances</b> de renouvellement.",
      "<b>Attributions à libérer</b> au départ d'un salarié.",
      "<b>Fiches de remise et de restitution</b> à imprimer, exports CSV."],
      'Capture de la démo, données fictives.'),
  demo="le parc d'une PME fictive", plus="Vos sites, vos fournisseurs, vos propres règles")

source = (IG_DIR / 'publications.html').read_text(encoding='utf-8')
tete = source.split('<!-- ============ IG-01')[0].replace("'../../../../assets/", "'../../../../../assets/")
tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', '<title>Publication Instagram IG-22</title>')
cta = ig.cta_template(T).replace('Achat unique, sans abonnement', 'Achat unique, bientôt en vente')
corps = [f"\n<!-- ============ IG-22 · {T['titre']} (d'après LI-93) ============ -->",
         ig.couv('IG-22', T['slug'], T['couleur'], 'bleu', T['h1'], T['sous'], 3),
         ig.probleme('IG-22', T['slug'], T['p2'], None, 'jaune'),
         ig.ecran('IG-22', T['slug'], 3, 'bleu', *T['v3']),
         ig.ecran('IG-22', T['slug'], 4, 'jaune', *T['v4']),
         cta]
(ICI / 'IG-22.html').write_text(tete + '\n'.join(corps) + '\n\n</body>\n</html>\n', encoding='utf-8')
