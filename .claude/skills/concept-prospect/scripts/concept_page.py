#!/usr/bin/env python3
"""Page de concept concepts/<slug>/ pour qm-engineering.fr.

Usage : python3 concept_page.py <pages.json> <dossier_sortie_pdf> <dossier_cible>
pages.json doit contenir lang, prospect, slug, lede (texte d'introduction) et pages (title).
Copie le PDF, convertit page-N.png en page-N.webp et écrit index.html depuis le gabarit.
"""
import html
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

if len(sys.argv) != 4:
    sys.exit(__doc__)
spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
out = Path(sys.argv[2])
dest = Path(sys.argv[3])
dest.mkdir(parents=True, exist_ok=True)

pdfs = sorted(out.glob("QME-concept-*.pdf"))
if len(pdfs) != 1:
    sys.exit(f"Un seul PDF attendu dans {out}, trouvé : {pdfs}")
pdf = pdfs[0]
shutil.copy(pdf, dest / pdf.name)

en = spec.get("lang") == "en"
n = len(spec["pages"])
imgs = []
for i, page in enumerate(spec["pages"], start=1):
    png = out / f"page-{i}.png"
    im = Image.open(png).convert("RGB")
    im.save(dest / f"page-{i}.webp", "WEBP", quality=82, method=6)
    lazy = "" if i == 1 else ' loading="lazy"'
    imgs.append(
        f'    <img src="page-{i}.webp" width="{im.width}" height="{im.height}" '
        f'alt="{html.escape(page["title"])}"{lazy}>'
    )

prospect = html.escape(spec["prospect"])
slug = spec["slug"]
button = (f"Download the PDF ({n} pages)" if en else f"Télécharger le PDF ({n} pages)")
values = {
    "LANG": "en" if en else "fr",
    "TITLE": (f"Concept for {prospect} · QME" if en else f"Concept pour {prospect} · QME"),
    "H1": (f"Concept for {prospect}" if en else f"Concept pour {prospect}"),
    "LEDE": html.escape(spec["lede"]),
    "PDF": pdf.name,
    "BUTTON": button,
    "EVENT": f"concept-{slug}-pdf",
    "EVENT_TITLE": html.escape(f"Concept {spec['prospect']} (PDF)"),
    "HOME": "QME home page" if en else "Accueil QME",
    "IMAGES": "\n".join(imgs),
}
tpl = (Path(__file__).resolve().parent.parent / "assets" / "concept-page-template.html").read_text(encoding="utf-8")
for key, val in values.items():
    tpl = tpl.replace("{{" + key + "}}", val)
assert "{{" not in tpl, "variable non remplacée dans le gabarit"
assert "claude" not in tpl.lower(), "le mot Claude ne doit pas apparaître"
(dest / "index.html").write_text(tpl, encoding="utf-8")
print("page", dest / "index.html", "·", n, "aperçus ·", pdf.name)
