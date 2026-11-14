"""Carrousel Instagram IG-24 (T53 · Inscriptions associatives), 21/12/2026, d'après LI-95.

Gabarits de construire_ig_06_33.py (importé, non modifié). Captures : démo ?demo servie en local,
capturées avec Playwright (bandeau démo masqué) dans captures/.
Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-24.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-24.html
"""
import importlib.util
import pathlib

ICI = pathlib.Path(__file__).resolve().parent
IG_DIR = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG_DIR / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)
ig.A = 'captures/'

T = dict(id='IG-24', slug='inscriptions', dossier='inscriptions', nom='Inscriptions associatives',
  titre='T53 · Inscriptions associatives', prix=29, couleur='Associations · clubs',
  h1="Qui était <mark>le premier</mark> sur la liste d'attente\u00a0?",
  sous="Les inscriptions d'une association, sans un tableur par activité.",
  p2=("En septembre, le judo du mercredi est complet en quelques jours.",
      "En octobre, plus personne ne sait qui était le premier sur la liste d'attente."),
  v3=('Inscriptions associatives', 'Chaque place, chaque famille.', 'inscriptions-bord', [
      "<b>Créneaux et capacité</b> : complet, l'inscription passe en liste d'attente.",
      "<b>Une place se libère</b> : elle revient au premier de la file.",
      "<b>Tableau de bord</b> : remplissage, attente, impayés, fiches à compléter."],
      'Capture de la démo, données fictives.'),
  v4=('Tarifs et paiements', 'Le bon tarif pour chaque famille.', 'inscriptions-activites', [
      "<b>Vos tranches de quotient familial</b> : aucun barème imposé.",
      "<b>Paiements en plusieurs fois</b>, retards et reste dû par famille.",
      "<b>Listes d'appel</b> par créneau et par mois, prêtes à imprimer."],
      'Capture de la démo, données fictives.'),
  demo='une maison de quartier fictive', plus="Vos propres règles d'inscription et de tarif")

source = (IG_DIR / 'publications.html').read_text(encoding='utf-8')
tete = source.split('<!-- ============ IG-01')[0].replace("'../../../../assets/", "'../../../../../assets/")
tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', '<title>Publication Instagram IG-24</title>')
corps = [f"\n<!-- ============ IG-24 · {T['titre']} (d'après LI-95) ============ -->",
         ig.couv('IG-24', T['slug'], T['couleur'], 'bleu', T['h1'], T['sous'], 2),
         ig.probleme('IG-24', T['slug'], T['p2'], None, 'rouge'),
         ig.ecran('IG-24', T['slug'], 3, 'bleu', *T['v3']),
         ig.ecran('IG-24', T['slug'], 4, 'jaune', *T['v4']),
         ig.cta_template(T)]
(ICI / 'IG-24.html').write_text(tete + '\n'.join(corps) + '\n\n</body>\n</html>\n', encoding='utf-8')
print('\n'.join(ig.alt_template(T)))
