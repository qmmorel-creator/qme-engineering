"""Carrousel Instagram IG-26 (T67 · Pilote de travaux maison), 5 vues, en lien avec LI-97.

Réutilise les gabarits de construire_ig_06_33.py (couverture, problème, écrans, appel à l'action) et
l'en-tête de styles de publications.html. Faits repris de travaux/linkedin.md ; captures de la démo
(assets/templates-travaux-*.webp), données fictives. Prix : gumroad-en-vente (15/11/2026), 25 €.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-26.py
→ png/IG-26-travaux-1..5.png (HTML temporaire rendu par rendre.mjs, puis supprimé).
"""
import importlib.util
import pathlib
import subprocess

PROD = pathlib.Path(__file__).resolve().parent
ICI = PROD.parent
spec = importlib.util.spec_from_file_location('ig', ICI / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

T = dict(id='IG-26', slug='travaux', dossier='travaux', nom='Pilote de travaux maison',
  titre='T67 · Pilote de travaux maison', prix=25, couleur='Maison',
  h1="Le moins cher <mark>n'inclut pas</mark> l'étanchéité.",
  sous='Trois devis fictifs pour une salle de bains : 3 025, 3 410 et 3 910 €.',
  p2=("Des devis dans les e-mails, un budget qui ne sait pas ce qui est signé.",
      "Et les dates des artisans au dos d'une enveloppe."),
  v3=('Pilote de travaux maison', 'Les devis, poste par poste.', 'travaux-devis', [
      "<b>HT, TTC, taux de TVA déduit</b>, ce qui est inclus ou non, délai, assurance déclarée.",
      "<b>Le moins cher et les écarts</b> calculés, à côté de votre propre note.",
      "<b>Aucun prix moyen</b> ni montant d'aide : seuls vos devis comptent."],
      'Capture de la démo, données fictives.'),
  v4=('Budget et planning', 'Prévu, engagé, payé.', 'travaux-budget', [
      "<b>Engagé</b> : les devis signés et les imprévus, avec la provision qui se consomme.",
      "<b>Le planning des artisans</b> signale deux interventions dans la même pièce le même jour.",
      "<b>En fin de travaux</b>, les défauts à reprendre, poste par poste."],
      'Capture de la démo, données fictives.'),
  demo='un T3 fictif en chantier', plus='Plusieurs logements, vos artisans, vos propres règles')

T['legende'] = """Trois devis pour la même salle de bains. Le moins cher n'inclut pas l'étanchéité.

Quand on rénove avec plusieurs artisans sans maître d'œuvre, on devient chef de chantier sans les outils. J'en ai construit un pour les particuliers.

Le Pilote de travaux maison compare les devis poste par poste (HT, TTC, ce qui est inclus ou non, délai, assurance déclarée), tient un budget qui sépare le prévu, l'engagé et le payé, et place les interventions sur une frise. Deux artisans dans la même pièce le même jour, ou une peinture prévue avant la plâtrerie : il le signale.

Volontairement, aucun prix moyen et aucun montant d'aide : seuls vos devis comptent. Achat unique, 25 €.

Besoin de plus ? Plusieurs logements, vos artisans, vos propres règles : je construis la version sur mesure.

Démo libre avec un appartement T3 fictif en plein chantier : lien en bio.

#Rénovation #Travaux #Maison #Budget #Organisation"""

PREMIER_COMMENTAIRE = "Le lien d'achat (25 €, achat unique) : https://qmengineering.gumroad.com/l/pilote-travaux"


def sections():
    return [ig.couv('IG-26', 'travaux', T['couleur'], 'bleu', T['h1'], T['sous'], 2),
            ig.probleme('IG-26', 'travaux', T['p2'], None, 'jaune'),
            ig.ecran('IG-26', 'travaux', 3, 'bleu', *T['v3']),
            ig.ecran('IG-26', 'travaux', 4, 'jaune', *T['v4']),
            ig.cta_template(T)]


def alt():
    a = ig.alt_template(T)
    a[0] = ("Titre « Le moins cher n'inclut pas l'étanchéité. » Trois devis fictifs pour une salle de bains : "
            "3 025, 3 410 et 3 910 €.")
    return a


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
    rendre('IG-26', sections())
    print('\n'.join(alt()))
