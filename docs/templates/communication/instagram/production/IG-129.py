"""Carrousel Instagram IG-129 (Sur mesure), 11/02/2027, adapté de LI-70 « 10 minutes ». Seuls les faits du
Google Doc LI-70 (v2) sont repris ; cas d'un domaine skiable fictif, aucune capture d'outil, aucune donnée réelle.

Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié). Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-129.py
Écrit un HTML temporaire, le rend avec rendre.mjs (png/IG-129-poste-vacant-1..5.png), puis le supprime.
"""
import importlib.util
import pathlib
import subprocess

ICI = pathlib.Path(__file__).resolve().parent
IG = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-129', slug='poste-vacant', titre='Sur mesure · 10 minutes pour combler un poste vacant',
  date='11/02/2027', li='LI-70', sourcil='Sur mesure · planning et habilitations',
  h1='<mark>10 minutes</mark> pour décider.',
  sous="Le délai avant que l'outil comble lui-même un poste vacant.",
  p2=("Un agent de quai prévient le matin qu'il sera absent.",
      "Son poste devient vacant, et le télésiège s'arrête."),
  p2_bas="Un télésiège ne tourne pas sans tous ses postes tenus par une personne qualifiée.",
  v3=("Le poste d'exploitation", 'Qui remplace, et quand.', [
      ('quart', 'Pendant 10 minutes', "Le chef d'exploitation choisit lui-même qui remplace.", None),
      ('rond', 'Ensuite, la réserve', "L'outil propose une personne présente, libre et qualifiée pour ce poste.", None),
      ('barres', "Les plus qualifiés d'abord", 'Envoyés vers les postes les plus exigeants.', None)],
      'Conçu pour un domaine skiable fictif'),
  v4=('Pourquoi un délai ?', "Le chef sait ce que l'outil ignore.", [
      ('Qui est déjà en route', 'Qui préfère quel poste, qui finit plus tôt.'),
      ('Un filet de sécurité', "L'automatisme rattrape les oublis ; la décision reste au chef.")]),
  v5=('Qui comble un poste vacant chez vous ?', ['Une règle écrite ?', 'Ou la première personne qui répond au téléphone ?']),
  alt=["Titre « 10 minutes pour décider. » Le délai avant que l'outil comble lui-même un poste vacant.",
       "Fond noir : un agent de quai prévient le matin qu'il sera absent ; son poste devient vacant et le télésiège s'arrête, car il ne tourne pas sans tous ses postes tenus par une personne qualifiée.",
       "Le poste d'exploitation : pendant 10 minutes, le chef d'exploitation choisit qui remplace ; ensuite, l'outil propose la réserve, une personne présente, libre et qualifiée, en envoyant les plus qualifiés vers les postes les plus exigeants. Domaine skiable fictif.",
       "Pourquoi un délai ? Le chef sait ce que l'outil ignore : qui est déjà en route, qui préfère quel poste, qui finit plus tôt. L'automatisme est un filet de sécurité, la décision reste au chef.",
       "Fond rouge : qui comble un poste vacant chez vous, une règle écrite ou la première personne qui répond au téléphone ? Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""10 minutes. C'est le temps que l'outil laisse au chef avant de combler lui-même un poste vacant.

Le scénario, dans le poste d'exploitation que j'ai conçu pour un domaine skiable fictif : un agent de quai prévient le matin qu'il sera absent. Son poste devient vacant et l'appareil s'arrête, car un télésiège ne tourne pas sans tous ses postes tenus par une personne qualifiée.

Pendant 10 minutes, le chef d'exploitation choisit qui le remplace. S'il ne le fait pas, l'outil propose la réserve : une personne présente, libre et qualifiée pour ce poste, les plus qualifiés allant d'abord vers les postes les plus exigeants.

Pourquoi un délai plutôt qu'une affectation immédiate ? Parce que le chef sait souvent ce que l'outil ignore : qui est déjà en route, qui préfère quel poste, qui finit plus tôt. L'automatisme sert de filet de sécurité, la décision reste au chef.

Dans vos équipes, qui comble un poste vacant à la dernière minute ? Votre métier a ses règles ? Parlons-en : lien en bio.

#Planning #Exploitation #Automatisation #OutilsSurMesure""")


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
    rendre(S, 3)
    print('\n'.join(f'{k + 1}. {a}' for k, a in enumerate(S['alt'])))
