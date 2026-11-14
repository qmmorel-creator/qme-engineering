"""Carrousel Instagram IG-112 · Sur mesure · charge contre capacité d'un atelier (6 vues), adapté de LI-53.

Gabarit sur_mesure de construire_ig_06_33.py, plus une vue graphique (charge face à la capacité) et une
vue de points ; seuls les faits du Google Doc LI-53 v2 sont repris (exemple fictif sur une semaine).

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-112.py
→ png/IG-112-charge-capacite-1..6.png (HTML temporaire rendu par rendre.mjs, puis supprimé).
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

S = dict(id='IG-112', slug='charge-capacite', titre="Sur mesure · Charge contre capacité : l'atelier en un coup d'œil",
  li='LI-53', sourcil='Sur mesure · atelier',
  h1="« On a de la <mark>place</mark> cette semaine ? »",
  sous="Charge contre capacité : l'atelier en un coup d'œil.",
  p2=("Dans beaucoup d'ateliers, on répond de tête, poste par poste.",
      "Et on découvre la surcharge le jeudi soir."),
  p2_bas=None,
  v3=('Pour un responsable de production', 'Je partirais de deux choses.', [
      ('barres', 'Les ordres de fabrication', "Chacun avec sa gamme : les postes par lesquels il passe, et le temps prévu sur chacun.", None),
      ('rond', 'La capacité de chaque poste', "Heures d'ouverture × équipes × rendement habituel, moins les arrêts prévus.", None),
      ('quart', 'Un graphique simple', "Une barre par poste : la charge planifiée face à la capacité.", None)],
      None),
  v4=('Le voir lundi', 'Il reste le temps de décider.', [
      ('Le lundi', "plutôt que le jeudi soir."),
      ('Trois options', "Décaler un ordre, ouvrir une équipe le samedi, sous-traiter une série.")]),
  v5=('« Est-ce que ça passe ? »', ['Posée chaque semaine, avec des chiffres', "Pas un logiciel de planification complet"]))

# Exemple fictif du post : (poste, charge h, capacité h)
POSTES = [('Découpe', 32, 40), ('Pliage', 46, 40), ('Soudure', 28, 35), ('Peinture', 18, 30)]

ALT = [
    "Titre « On a de la place cette semaine ? » Charge contre capacité : l'atelier en un coup d'œil.",
    "Fond noir : dans beaucoup d'ateliers, on répond de tête, poste par poste. Et on découvre la surcharge le jeudi soir.",
    "Je partirais de deux choses : les ordres de fabrication avec leur gamme (postes et temps prévus), la capacité de chaque poste (heures d'ouverture × équipes × rendement, moins les arrêts prévus). Le tout donne une barre par poste, la charge face à la capacité.",
    "Graphique, exemple fictif sur une semaine : découpe 32 h pour 40 h, pliage 46 h pour 40 h en surcharge, soudure 28 h pour 35 h, peinture 18 h pour 30 h. Le pliage déborde de 6 heures.",
    "Le voir le lundi plutôt que le jeudi soir : il reste le temps de décider. Trois options : décaler un ordre, ouvrir une équipe le samedi, sous-traiter une série.",
    "Fond rouge : « Est-ce que ça passe ? », posée chaque semaine avec des chiffres, pas un logiciel de planification complet. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """« On a de la place cette semaine ? » Dans beaucoup d'ateliers, on répond de tête. Et la surcharge se voit le jeudi soir.

Pour un responsable de production, je partirais de deux choses : chaque ordre de fabrication avec sa gamme (les postes par lesquels il passe et le temps prévu sur chacun), et la capacité de chaque poste sur la semaine.

Le résultat tient en un graphique : une barre par poste, la charge face à la capacité. Dans l'exemple fictif du carrousel, le pliage déborde de 6 heures. On le voit le lundi, et il reste le temps de décaler un ordre, d'ouvrir une équipe le samedi ou de sous-traiter une série.

Pas un logiciel de planification complet. Juste la question « est-ce que ça passe ? », posée chaque semaine avec des chiffres.

Votre métier a ses règles ? Parlons-en : lien en bio.

#OutilsSurMesure #Industrie #Production #Atelier #PME"""


def vue_graphique(pid, slug):
    echelle = 880 / 50  # px par heure, axe de 0 à 50 h
    lignes = []
    for nom, charge, cap in POSTES:
        sur = charge > cap
        coul = 'var(--rouge)' if sur else 'var(--bleu)'
        etiquette = f"{charge} h pour {cap} h" + (' · surcharge' if sur else '')
        lignes.append(f'''<div style="margin-bottom:46px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:40px;font-weight:800;letter-spacing:-.025em"><span>{e(nom)}</span><span style="font-size:30px;font-weight:700;{'color:var(--rouge)' if sur else 'color:var(--texte-2)'}">{e(etiquette)}</span></div>
      <div style="position:relative;height:64px;margin-top:14px;width:880px">
        <div style="position:absolute;left:0;top:0;height:64px;width:{charge * echelle:.0f}px;background:{coul}"></div>
        <div style="position:absolute;left:0;top:-8px;height:80px;width:{cap * echelle:.0f}px;border:5px solid var(--encre)"></div>
      </div>
    </div>''')
    return f'''<section class="cadre choix" id="{pid}-{slug}-4">
  <div class="bandeau" style="background:var(--jaune)"><p class="sourcil">Exemple fictif · une semaine</p><h2 style="max-width:none">Le pliage déborde de 6 heures.</h2></div>
  <span class="compteur">4 / 5</span>
  <div style="position:absolute;left:84px;right:84px;top:380px">
    {''.join(lignes)}
  </div>
  <div style="position:absolute;left:84px;bottom:76px;display:flex;gap:34px;align-items:center;font-size:26px;color:var(--discret)">
    <span style="display:flex;gap:12px;align-items:center"><i style="width:30px;height:30px;background:var(--bleu);display:inline-block"></i>Charge planifiée</span>
    <span style="display:flex;gap:12px;align-items:center"><i style="width:30px;height:30px;border:5px solid var(--encre);display:inline-block"></i>Capacité</span>
    <span>Données fictives</span>
  </div>
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
    v = ig.sur_mesure(S, 1)
    return renumeroter([v[0], v[1], v[2], vue_graphique(S['id'], S['slug']), v[3], v[4]], S['id'], S['slug'])


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
