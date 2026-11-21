#!/usr/bin/env python3
"""Vue 5 « essai gratuit » des carrousels de template à venir (21/11/2026, demande de Quentin : tout mettre en
conformité après l'extension de l'essai aux templates pro). Remplace l'ancienne vue 5 « Démo libre / Achat unique »
(et les « bientôt en vente » d'IG-22 et IG-63) : appel à l'action principal = 14 jours d'essai gratuit, sans carte ;
l'achat unique en second (REGLES-CONTENU.md § 7). Même maquette et même feuille de style que publications-2.html.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/construire_cta_essai.py
  node docs/templates/communication/instagram/rendre.mjs publications-cta-essai.html
Sortie : png/<IG-nn>-<slug>-5-essai.png (1080 × 1350). Prix : cta-essai-templates.json (tiré de outils/packs/donnees.mjs).
"""
import html, importlib.util, json, pathlib, re

ICI = pathlib.Path(__file__).resolve().parent
e = html.escape

# Carrousel → template (code de outils/packs/donnees.mjs).
CARROUSELS = {
 'IG-62': 'ABN', 'IG-07': 'MCE', 'IG-08': 'BCM', 'IG-09': 'GNT', 'IG-10': 'TCH', 'IG-12': 'VSA', 'IG-13': 'NCF',
 'IG-14': 'CRM', 'IG-17': 'RSV', 'IG-21': 'MRG', 'IG-63': 'HBT', 'IG-26': 'TRV', 'IG-134': 'RDV', 'IG-69': 'RCV',
 'IG-135': 'ETD', 'IG-136': 'RNT', 'IG-137': 'DRP', 'IG-138': 'EQP', 'IG-15': 'VHC', 'IG-16': 'PHR', 'IG-18': 'PRS',
 'IG-22': 'PRC', 'IG-65': 'DTT', 'IG-67': 'NDF', 'IG-68': 'APD', 'IG-70': 'ARD', 'IG-71': 'CNG', 'IG-72': 'STK',
 'IG-74': 'VTR', 'IG-75': 'RPS', 'IG-76': 'MSC', 'IG-77': 'CAR', 'IG-84': 'PGS', 'IG-86': 'TVA', 'IG-66': 'SNH',
}
PLUS_DEFAUT = 'Vos règles, votre métier, vos outils'


def module_0633():
    spec = importlib.util.spec_from_file_location('ig0633', ICI / 'construire_ig_06_33.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def euros(c):
    return f"{c // 100} €" if c % 100 == 0 else f"{c / 100:.2f} €".replace('.', ',')


def vue(ig, t, plus):
    return f'''<section class="cadre cta" id="{ig}-{t['slug']}-5-essai">
  <span class="compteur">5 / 5</span>
  <div class="bloc">
    <h2 style="font-size:96px">Essayez-le 14&nbsp;jours, gratuitement.</h2>
    <div class="liste"><div><i></i>Sans carte bancaire, avec vos données</div><div><i></i>Ordinateur, tablette, téléphone</div><div><i></i>Si vous achetez, tout est repris</div></div>
  </div>
  <div class="plus" style="top:{760 if len(plus) <= 52 else 720}px"><b>Besoin de plus ?</b> {e(plus)} : <b>je le construis sur mesure.</b></div>
  <div class="bouton"><b>Lien en bio</b><span>Essai gratuit · puis {euros(t['prix'])}</span></div>
  {MARQUE}
</section>'''


def main():
    global MARQUE
    source = (ICI / 'publications-2.html').read_text(encoding='utf-8')
    # En-tête (styles) et début du corps (définitions SVG du symbole), jusqu'à la première vue.
    tete = source[:source.index('<section class="cadre', source.index('<body'))]
    m = module_0633()
    # Pied de page identique aux vues 5 existantes (symbole, QME, adresse du site).
    MARQUE = m.MARQUE.format(s='symbole', ms='', es=' style="color:var(--surface)"', url='qm-engineering.fr')
    plus = {t['id']: t['plus'] for t in m.T if 'plus' in t}
    templates = json.loads((ICI / 'cta-essai-templates.json').read_text(encoding='utf-8'))
    corps = [vue(ig, templates[code], plus.get(ig, PLUS_DEFAUT)) for ig, code in CARROUSELS.items()]
    (ICI / 'publications-cta-essai.html').write_text(tete + '\n'.join(corps) + '\n</body>\n</html>\n', encoding='utf-8')
    print(f'{len(corps)} vues 5 écrites dans publications-cta-essai.html')


if __name__ == '__main__':
    main()
