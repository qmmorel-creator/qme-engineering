# Passe des templates « Mise en vente prochaine » en vente sur le site (catalogue en vitrine, depuis le 14/11/2026).
# Usage, depuis la racine du dépôt : python3 outils/templates/mettre-en-vente.py slug:prix:permalienGumroad:Txx[,...]
# Exemple : python3 outils/templates/mettre-en-vente.py "visa:39 €:circuit-visa:T24"
# Produit gratuit (prix libre sur Gumroad) : prix « Gratuit » ; le bouton devient « Obtenir gratuitement ».
import re,sys,os,datetime
def lire(p): return open(p,encoding='utf-8').read()
def ecrire(p,s): open(p,'w',encoding='utf-8').write(s)

# Démo de l'application : retire « Bientôt en vente / Être prévenu de la sortie » du bandeau démo, puis change la
# version de cache de l'application (index.html et sw.js) pour que la nouvelle démo soit servie tout de suite.
# Contrôlé par outils/templates/audit-etudiants.test.mjs (aucun template en vente n'affiche « Bientôt en vente »).
def retirer_bientot(sl):
    d=f'templates/{sl}/'; a=d+'app.js'
    if not os.path.exists(a): return
    js=lire(a)
    js,n=re.subn(rf'<a class="bientot-demo" href="/catalogue/{re.escape(sl)}/"><strong>Bientôt en vente</strong><span>[^<]*</span></a>','',js)
    if not n: return
    assert 'Bientôt en vente' not in js,(sl,'bandeau démo non reconnu')
    ecrire(a,js)
    sw=lire(d+'sw.js'); m=re.search(r"const VERSION = '([\w-]+)-(\w+)';",sw); assert m,(sl,'version sw')
    vieux=m.group(2); jour=datetime.date.today().strftime('%Y%m%d')
    neuf=jour+chr(ord(vieux[-1])+1) if vieux.startswith(jour) else jour+'a'
    for f in (d+'index.html',d+'sw.js'):
        t=lire(f); assert f'?v={vieux}' in t,(sl,f,'version')
        ecrire(f,t.replace(f'?v={vieux}',f'?v={neuf}'))
    ecrire(d+'sw.js',lire(d+'sw.js').replace(f"const VERSION = '{m.group(1)}-{vieux}';",f"const VERSION = '{m.group(1)}-{neuf}';"))

items=[x.split(':') for x in sys.argv[1].split(',')]
tpl=lire('templates/index.html')
for sl,prix,perma,num in items:
    p=f'catalogue/{sl}/index.html'; t=lire(p)
    nom=re.search(r'<nav class="fil".*?<b>(.*?)</b></nav>',t).group(1)
    gratuit=prix.strip().lower()=='gratuit'
    sous='Prix libre · accès à vie · tous vos appareils' if gratuit else 'Achat unique · accès à vie · tous vos appareils'
    bouton,clic=('Obtenir gratuitement','obtenir') if gratuit else ('Acheter','achat')
    t,n=re.subn(r'<div class="prix prochaine">.*?</div>',f'<div class="prix"><b>{prix}</b><span>{sous}</span></div>',t,count=1); assert n==1,(sl,'prix')
    m=re.search(rf'<a class="btn primary" href="/templates/{sl}/\?demo"([^>]*)>Essayer la démo</a>',t); assert m,(sl,'demo')
    t=t.replace(m.group(0),f'<a class="btn primary" href="https://qmengineering.gumroad.com/l/{perma}" data-goatcounter-click="{clic}-{sl}" data-goatcounter-title="{bouton} : {nom[0].lower()+nom[1:]}">{bouton}</a>\n        <a class="btn" href="/templates/{sl}/?demo"{m.group(1)}>Essayer la démo</a>',1)
    t,n=re.subn(r'\s*<button class="btn interet"[^>]*>.*?</button>','',t,count=1); assert n==1,(sl,'interet')
    t,n=re.subn(r'\s*<p class="interet-note".*?</p>','',t,count=1); assert n==1,(sl,'note')
    if gratuit:
        t,n=re.subn(r'<p><b>Bientôt disponible, gratuitement\.</b> La démo est libre dès maintenant\. À la mise à disposition : clé gratuite',r'<p><b>Comment ça marche :</b> clé gratuite',t,count=1)
    else:
        t,n=re.subn(r'<p><b>Bientôt en vente\.</b> La démo est libre dès maintenant\. À la mise en vente : achat unique sur Gumroad',r'<p><b>Comment ça marche :</b> achat unique sur Gumroad',t,count=1)
    assert n==1,(sl,'rappel')
    t=t.replace('<a href="/catalogue/gantt/" hreflang="fr"',f'<a href="/catalogue/{sl}/" hreflang="fr"')
    ecrire(p,t)
    retirer_bientot(sl)
    # Carte : retirée de « Bientôt », ajoutée en fin de vitrine
    m=re.search(rf'\n\s*<li class="carte prochaine" data-slug="{sl}"((?: data-vignette="[^"]*")?) data-pour="(\w+)" data-theme="([\w-]+)" style="([^"]*)"><a href="[^"]*"><b>(.*?)</b><span class="phrase">(.*?)</span><span class="theme">(.*?)</span><em>Bientôt[^<]*</em></a></li>',tpl); assert m,(sl,'carte')
    vignette,pour,theme,style,b,phrase,th=m.groups()
    tpl=tpl.replace(m.group(0),'',1)
    carte=f'\n      <li class="carte" data-slug="{sl}"{vignette} data-pour="{pour}" data-theme="{theme}" style="{style}"><a href="/catalogue/{sl}/"><span class="theme">{th}</span><b>{b}</b><span class="phrase">{phrase}</span><span class="pied"><em>{prix}</em><span>Voir le détail</span></span></a></li>'
    a=tpl.index('<ul class="vitrine-piste"'); f=tpl.index('\n    </ul>',a)
    tpl=tpl[:f]+carte+tpl[f:]
    # IDEES
    s=lire('docs/templates/IDEES.md')
    s,k=re.subn(rf'^(\| {num} \|(?:[^|]*\|){{3}}) (?:prêt|en cours) \|',r'\1 en vente |',s,flags=re.M); assert k==1,(num,'idees')
    ecrire('docs/templates/IDEES.md',s)
a=tpl.index('<ul class="vitrine-piste"'); f=tpl.index('\n    </ul>',a)
n=tpl[a:f].count('<li class="carte"')
tpl,k=re.subn(r'(<p data-vitrine-sous>)\d+ templates',rf'\g<1>{n} templates',tpl,count=1); assert k==1
ecrire('templates/index.html',tpl)
print('en vente :',n,'dans la vitrine')
