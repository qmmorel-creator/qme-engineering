import re
t=open('<skill>/assets/demo-template.html').read()
content=open('parts/content.html').read(); js=open('parts/script.js').read()
t=t.replace('__NOM_OUTIL__','Chantiers').replace('__PROSPECT__',"Charpentes de l'Obiou").replace('__I__','CO').replace('__INI__','MD').replace('__PRENOM__ __I.__','Marc D.').replace('__FONCTION__','Gérant')
t=t.replace('--accent:#1D4E89; --accent-soft:#e3ebf5;','--accent:#9A5B1E; --accent-soft:#f6ece1;')
t=re.sub(r'<nav class="nav" id="nav">.*?</nav>','''<nav class="nav" id="nav">
      <a href="#planning" data-v="planning">Planning <span class="n">2</span></a>
      <a href="#chantier" data-v="chantier">Chantiers</a>
      <a href="#pilotage" data-v="pilotage">Pilotage</a>
      <a href="#terrain" data-v="terrain">Vue chef d'équipe</a>
    </nav>''',t,flags=re.S)
t=re.sub(r'(<div class="content">).*?(\n    </div>\n  </div>\n</div>)',lambda m:m.group(1)+'\n'+content+m.group(2),t,flags=re.S)
t=re.sub(r'<nav class="tabbar" id="tabbar">.*?</nav>','<nav class="tabbar" id="tabbar"><a href="#terrain" data-v="terrain"><span>◉</span>Ma journée</a><a href="#heures" data-v="heures"><span>◷</span>Heures</a><a href="#docs"><span>▤</span>Documents</a><a href="#msg"><span>✉</span>Bureau</a></nav>',t,flags=re.S)
t=re.sub(r'<script>.*?</script>',lambda m:'<script>\n'+js+'</script>',t,flags=re.S)
open('demo/index.html','w').write(t)
