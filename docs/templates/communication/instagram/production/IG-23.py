"""IG-23 · Carrousel template T51 · Pilote événementiel (5 vues), lendemain de LI-94. Faits repris de
docs/templates/communication/evenementiel/linkedin.md ; captures de la démo (assets/templates-evenementiel-*),
données fictives. T51 n'est pas en vente (gumroad-en-vente.md du 15/11/2026) : aucun prix ni achat, vue 5
« bientôt en vente ». Gabarits de construire_ig_06_33.py, vue 5 adaptée.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-23.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-23.html
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
T = dict(id='IG-23', slug='evenementiel', nom='Pilote événementiel', couleur='Événementiel',
  h1="Trois événements, <mark>un seul</mark> outil.", sous="Rétroplanning, budget, invités et jour J.",
  p2=("Le rétroplanning dans un fichier, le budget dans un autre, les devis dans les e-mails.",
      "Et des acomptes qu'on découvre en retard."),
  v3=('Pilote événementiel', 'Tout se recale sur la date.', 'evenementiel-bord', [
      "<b>Un rétroplanning</b> calculé depuis la date de chaque événement.",
      "<b>Les retards</b> remontent sur un tableau de bord commun.",
      "<b>Trois modèles</b> : séminaire, salon côté exposant, soirée de lancement."],
      'Capture de la démo, données fictives.'),
  v4=('Le jour J', 'Un conducteur minute par minute.', 'evenementiel-jourj', [
      "<b>Le programme glisse ?</b> Le conducteur se décale en cascade.",
      "<b>Budget prévu, engagé, payé</b>, par poste et par prestataire, acomptes compris."],
      'Aucun prix de référence inventé. Données fictives.'))

VUE5 = f'''<section class="cadre cta" id="IG-23-evenementiel-5">
  <span class="compteur">5 / 5</span>
  <div class="bloc">
    <h2 style="font-size:84px">Essayez-le avec une agence fictive.</h2>
    <div class="liste"><div><i></i>Démo libre, sans inscription</div><div><i></i>Ordinateur, tablette, téléphone</div><div><i></i>Toute l'équipe sur les mêmes données</div></div>
  </div>
  <div class="plus" style="top:800px"><b>Besoin de plus ?</b> {ig.e("Vos prestataires, vos clients, vos portails")} : <b>je le construis sur mesure.</b></div>
  <div class="bouton"><b>Lien en bio</b><span>Bientôt en vente</span></div>
  {ig.MARQUE.format(s='symbole', ms='', es=' style="color:var(--surface)"', url='qm-engineering.fr')}
</section>'''

ALT = [
    "Titre « Trois événements, un seul outil. » Rétroplanning, budget, invités et jour J.",
    "Fond noir : le rétroplanning dans un fichier, le budget dans un autre, les devis dans les e-mails. Et des acomptes qu'on découvre en retard.",
    "Le template Pilote événementiel : tout se recale sur la date. Rétroplanning calculé depuis la date de chaque événement, retards sur un tableau de bord commun, trois modèles (séminaire, salon, soirée de lancement). Capture, données fictives.",
    "Le jour J : un conducteur minute par minute qui se décale en cascade, et le budget prévu, engagé et payé par poste et par prestataire. Capture, données fictives.",
    "Fond jaune : essayez-le avec une agence fictive, démo libre, bientôt en vente. Besoin de plus ? Vos prestataires, vos clients, vos portails : version sur mesure. Lien en bio.",
]

if __name__ == '__main__':
    t = T
    ecrire(t['id'], [f"\n<!-- ============ IG-23 · T51 · Pilote événementiel (d'après LI-94) ============ -->",
                     ig.couv(t['id'], t['slug'], t['couleur'], 'bleu', t['h1'], t['sous'], 2),
                     ig.probleme(t['id'], t['slug'], t['p2'], None, 'rouge'),
                     ig.ecran(t['id'], t['slug'], 3, 'bleu', *t['v3']),
                     ig.ecran(t['id'], t['slug'], 4, 'jaune', *t['v4']),
                     VUE5])
    print(json.dumps(ALT, ensure_ascii=False))
