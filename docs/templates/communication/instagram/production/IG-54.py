"""IG-54 · Carrousel « Méthode » d'après le script J29 de videos-30-jours.md (Ils n'ont pas dit non), à la
place du Reel filmé prévu. Faits repris de J29 et de docs/templates/communication/prospection/linkedin.md.
Le Pipeline de prospection (T35) est en vente : vue 5 « essai gratuit 14 jours » (mise en conformité du 21/11/2026).
Gabarit sur mesure de construire_ig_06_33.py (vues 1 à 4), vue 5 propre à ce post.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-54.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-54.html
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
S = dict(id='IG-54', slug='relances', sourcil='Méthode · prospection',
  h1="Ils n'ont pas <mark>dit non</mark>.", sous="Ils n'ont jamais reçu de relance.",
  p2=("Le premier message est rarement celui qui obtient la réponse.",
      "C'est souvent la relance qu'on n'a pas envoyée."),
  p2_bas="Quand on prospecte seul, tout tient dans un tableur et dans sa tête. Les relances glissent.",
  v3=('La règle', 'Pas de date, pas de relance.', [
      ('barres', 'Une étape par prospect', "De « À contacter » à « Gagné » : on sait toujours où il en est.", None),
      ('rond', 'Une prochaine action datée', "Chaque prospect a la sienne. Sans date, personne ne relance.", None),
      ('quart', 'Une cadence choisie', "Elle fixe, à chaque échange, la date de la relance suivante.", None)],
      None),
  v4=('Chaque matin', 'Une seule liste à regarder.', [
      ('Les relances du jour', "Calculées selon la cadence, retards en tête."),
      ('Le message préparé', "Rempli avec le prénom, à relire : vous envoyez vous-même."),
      ('Les « non » respectés', "Les personnes qui ne veulent plus être contactées sont mises de côté.")]))

VUE5 = f'''<section class="cadre cta rouge" id="IG-54-relances-5">
  <span class="compteur">5 / 5</span>
  <div class="bloc">
    <h2 style="font-size:84px">{ig.e("Combien de vos prospects n'ont pas de prochaine action ?")}</h2>
    <div class="liste"><div><i></i>Une étape par prospect</div><div><i></i>Une prochaine action datée</div></div>
  </div>
  <div class="plus" style="color:var(--encre);top:720px"><b>Pipeline de prospection QME</b> {ig.e(": il applique cette règle. 14 jours d'essai gratuit, sans carte.")}</div>
  <div class="bouton"><b>Lien en bio</b><span>{ig.e("Essai gratuit · puis 25 €")}</span></div>
  {ig.MARQUE.format(s='symbole-clair', ms=' style="color:#fff"', es='', url='qm-engineering.fr/essai')}
</section>'''

ALT = [
    "Titre « Ils n'ont pas dit non. » Ils n'ont jamais reçu de relance.",
    "Fond noir : le premier message est rarement celui qui obtient la réponse. C'est souvent la relance qu'on n'a pas envoyée. Quand on prospecte seul, tout tient dans un tableur et dans sa tête.",
    "La règle, pas de date, pas de relance : une étape par prospect, de « À contacter » à « Gagné » ; une prochaine action datée pour chacun ; une cadence choisie qui fixe la date de la relance suivante.",
    "Chaque matin, une seule liste : les relances du jour, retards en tête ; le message préparé avec le prénom, envoyé par vous ; les personnes qui ne veulent plus être contactées mises de côté.",
    "Fond rouge : combien de vos prospects n'ont pas de prochaine action ? Le Pipeline de prospection QME applique cette règle : 14 jours d'essai gratuit, sans carte, puis 25 €. Lien en bio.",
]

if __name__ == '__main__':
    S['v5'] = ('', [])
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Ils n'ont pas dit non (script J29) ============ -->"]
           + ig.sur_mesure(S, 0)[:4] + [VUE5])
    print(json.dumps(ALT, ensure_ascii=False))
