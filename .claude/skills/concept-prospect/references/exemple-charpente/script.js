// ===== Données fictives =====
const CH = {
  'C-2604': { nom: 'Grange des Clots', client: 'SCI Les Clots', ville: 'Mens', type: 'Charpente traditionnelle', ht: 72300, col: '#9A5B1E', av: 46, hp: 410, hr: 210 },
  'C-2611': { nom: 'Extension Arnaud', client: 'M. et Mme Arnaud', ville: 'Monestier-de-Clermont', type: 'Ossature bois', ht: 48600, col: '#2E7D5B', av: 62, hp: 330, hr: 236 },
  'C-2621': { nom: 'Hangar du Serre', client: 'GAEC du Serre', ville: 'Lalley', type: 'Couverture bac acier', ht: 31900, col: '#1D4E89', av: 20, hp: 150, hr: 41 },
  'C-2620': { nom: 'Copro Les Écrins', client: 'Copropriété Les Écrins', ville: 'Échirolles', type: 'Isolation sarking', ht: 26700, col: '#7A3E9D', av: 81, hp: 190, hr: 204 },
  'C-2609': { nom: 'Escalier Faure', client: 'Mme Faure', ville: 'Grenoble', type: 'Escalier chêne', ht: 9800, col: '#B54708', av: 55, hp: 70, hr: 38 },
  'C-2615': { nom: 'Carport Gilibert', client: 'M. Gilibert', ville: 'Vif', type: 'Carport et abri', ht: 12400, col: '#0E7490', av: 0, hp: 85, hr: 0 },
  'C-2618': { nom: 'Toiture Le Granier', client: 'Copropriété Le Granier', ville: 'Vif', type: 'Réfection tuiles', ht: 38500, col: '#475467', av: 92, hp: 240, hr: 233 },
};
const JOURS = ['Lun 2', 'Mar 3', 'Mer 4', 'Jeu 5', 'Ven 6'];
const EQ = [
  { id: 'E1', nom: 'Équipe 1 · Charpente', chef: 'Julien M.', n: 4, j: [['C-2604', 'Taille atelier'], ['C-2604', 'Levage'], ['C-2604', 'Levage', 'grue'], ['C-2604', 'Levage', 'vent'], ['C-2604', 'Chevronnage']] },
  { id: 'E2', nom: 'Équipe 2 · Couverture', chef: 'Karim B.', n: 4, j: [['C-2618', 'Faîtage'], ['C-2618', 'Finitions'], ['C-2621', 'Bac acier'], ['C-2621', 'Bac acier'], ['C-2621', 'Bac acier']] },
  { id: 'E3', nom: 'Équipe 3 · Ossature', chef: 'Thomas R.', n: 5, j: [['C-2611', 'Murs étage'], ['C-2611', 'Murs étage'], ['C-2611', 'Levage plancher', 'grue'], ['C-2611', 'Pare-pluie'], ['C-2620', 'Sarking']] },
  { id: 'E4', nom: 'Équipe 4 · Menuiserie', chef: 'Léo P.', n: 3, j: [['C-2609', 'Pose escalier'], ['C-2609', 'Garde-corps'], ['C-2620', 'Sarking'], ['C-2620', 'Sarking'], ['C-2615', 'Implantation']] },
];
const GRUE = [null, 'C-2604', 'C-2604 + C-2611', 'C-2604', null];

// ===== Outils =====
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const eur = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
const badge = (cls, txt) => `<span class="b ${cls}">${esc(txt)}</span>`;
const kpis = (sel, arr) => { $(sel).innerHTML = arr.map((k) => `<div class="kpi${k.alert ? ' alert' : ''}"><div class="l">${esc(k.l)}</div><div class="v tnum">${k.v}</div><div class="d">${k.d || ''}</div></div>`).join(''); };
const bar = (p, over) => `<div class="bar${over ? ' over' : ''}"><i style="width:${Math.min(p, 100)}%"></i></div>`;

// ===== Planning =====
function renderPlanning() {
  kpis('#plan-kpis', [
    { l: 'Équipes affectées', v: '4 / 4', d: '<span class="muted">16 compagnons</span>' },
    { l: 'Chantiers cette semaine', v: 7, d: '<span class="muted">dont 1 démarrage (Vif)</span>' },
    { l: 'Heures planifiées', v: '612 h', d: '<span class="muted">capacité 640 h</span>' },
    { l: 'À arbitrer', v: 2, d: '<span style="color:var(--late)">grue en double · vent jeudi</span>', alert: true },
  ]);
  let h = `<div class="plan" style="grid-template-columns:230px repeat(5,1fr)"><div class="h">Équipe</div>` + JOURS.map((j, i) => `<div class="h${i === 0 ? ' today' : ''}">${j} nov.</div>`).join('');
  for (const e of EQ) {
    h += `<div class="rl"><span class="av">${e.id}</span><div><b>${esc(e.nom)}</b><div class="muted sm">${esc(e.chef)} · ${e.n} pers.</div></div></div>`;
    e.j.forEach(([ref, tache, flag]) => {
      const c = CH[ref];
      const warn = flag === 'vent' ? `<div style="color:var(--late);font-weight:600;margin-top:2px">⚠ Vent 70 km/h prévu</div>` : flag === 'grue' ? `<div class="muted">Camion-grue</div>` : '';
      h += `<div class="c"><div class="blk${flag === 'vent' ? ' alert' : ''}" style="border-color:${c.col};background:${c.col}14"><b>${ref} · ${esc(c.nom)}</b>${esc(tache)} · ${esc(c.ville)}${warn}</div></div>`;
    });
  }
  h += `<div class="rl"><span class="av" style="background:#fdf0dc;color:#b54708">G</span><div><b>Camion-grue</b><div class="muted sm">réservation</div></div></div>`;
  GRUE.forEach((g, i) => {
    h += `<div class="c">${g ? `<div class="blk${i === 2 ? ' alert' : ''}" style="border-color:${i === 2 ? 'var(--late)' : '#b54708'}"><b>${esc(g)}</b>${i === 2 ? '<span style="color:var(--late);font-weight:600">Réservé deux fois</span>' : 'Karim B. conduit'}</div>` : ''}</div>`;
  });
  $('#plan').outerHTML = h + '</div>';
  $('#alerts').innerHTML = [
    ['var(--late)', '<b>Mercredi 4 : camion-grue demandé par deux équipes</b>', 'Grange des Clots (levage) et Extension Arnaud (plancher). Proposition : décaler le plancher Arnaud à jeudi matin.', 'Appliquer'],
    ['var(--warn)', '<b>Jeudi 5 : vent 70 km/h annoncé à Mens</b>', "Levage déconseillé l'après-midi. Proposition : chevronnage le matin, taille à l'atelier l'après-midi.", 'Voir les options'],
  ].map(([c, t, d, b]) => `<div class="li"><span class="dot" style="background:${c}"></span><div style="flex:1">${t}<div class="muted sm">${d}</div></div><button class="btn">${b}</button></div>`).join('');
  $('#notif').innerHTML = EQ.map((e) => `<div class="li"><span class="av">${e.id}</span><div style="flex:1"><b>${esc(e.chef)}</b><div class="muted sm">Mar. 3 : ${e.j[1][0]} ${esc(CH[e.j[1][0]].nom)} · ${esc(CH[e.j[1][0]].ville)}</div></div>${badge('ok', 'Lu')}</div>`).join('');
}

// ===== Fiche chantier =====
function renderChantier() {
  kpis('#ch-kpis', [
    { l: 'Montant du devis', v: '72 300 €', d: '<span class="muted">HT · signé le 16/10</span>' },
    { l: 'Avancement', v: '46 %', d: bar(46) },
    { l: 'Heures consommées', v: '210 h', d: '<span class="muted">sur 410 h prévues (51 %)</span>' },
    { l: 'À facturer', v: '28 920 €', d: '<span style="color:var(--warn)">situation n° 2 à établir</span>', alert: true },
  ]);
  const lots = [
    ['Taille de la charpente (douglas)', 14800, 100, 120, 118],
    ['Levage et assemblage', 11200, 40, 95, 71],
    ['Fourniture bois douglas 18 m³', 16900, 100, 0, 0],
    ['Chevronnage et voligeage', 9600, 10, 80, 12],
    ['Couverture tuiles canal', 13400, 0, 85, 0],
    ['Zinguerie et descentes', 3900, 0, 22, 0],
    ['Échafaudage et sécurité', 2500, 100, 8, 9],
  ];
  $('#lots').innerHTML = `<tr><th>Lot</th><th class="r">Montant HT</th><th style="width:140px">Avancement</th><th class="r">Heures</th></tr>` + lots.map(([l, m, a, hp, hr]) =>
    `<tr><td>${esc(l)}</td><td class="r tnum">${eur(m)}</td><td><div style="display:flex;gap:8px;align-items:center">${bar(a)}<span class="sm tnum muted">${a} %</span></div></td><td class="r tnum ${hr > hp && hp ? 'late' : ''}">${hp ? `${hr} / ${hp} h` : '—'}</td></tr>`).join('');
  $('#heures').innerHTML = `<div style="display:flex;justify-content:space-between" class="sm"><span>Réalisé <b class="tnum">210 h</b></span><span class="muted">Prévu 410 h</span></div>${bar(51)}
    <div class="sm" style="margin-top:12px">Rythme actuel : <b>fin estimée le 13/11</b>, dans le budget d'heures.</div>
    <div class="sm muted" style="margin-top:6px">Dernière saisie : hier 17 h 42 par Julien M.</div>`;
  $('#mat').innerHTML = [
    ['ok', 'Livré 28/10', 'Douglas 18 m³ (scierie)', 'BL signé, photo jointe'],
    ['warn', 'À commander', 'Chevrons 63×175 × 6', 'Demandé par Julien M. hier soir'],
    ['info', 'Prévu 09/11', 'Tuiles canal 2 400 u.', 'Livraison sur chantier, grue nécessaire'],
  ].map(([c, s, t, d]) => `<div class="li"><div style="flex:1"><b>${esc(t)}</b><div class="muted sm">${esc(d)}</div></div>${badge(c, s)}</div>`).join('');
  $('#journal').innerHTML = [
    ['Hier 17:42', 'Julien M.', 'Ferme 3 et 4 levées. Il manque 6 chevrons pour le versant nord.', 3],
    ['Ven. 30/10', 'Julien M.', 'Fin de la taille à l\'atelier. Marquage des pièces fait.', 2],
    ['Jeu. 29/10', 'Bureau', 'Visite du client : accord pour lasure chêne clair sur les débords.', 0],
  ].map(([d, w, t, p]) => `<div class="li"><span class="av">${w === 'Bureau' ? 'B' : 'JM'}</span><div style="flex:1"><div class="sm"><b>${esc(w)}</b> <span class="muted">· ${esc(d)}</span></div><div>${esc(t)}</div>${p ? `<div style="display:flex;gap:6px;margin-top:6px">${Array.from({ length: p }, (_, i) => `<div style="width:58px;height:42px;border-radius:6px;background:linear-gradient(135deg,#c89b6a,#7a5230 ${50 + i * 15}%)"></div>`).join('')}</div>` : ''}</div></div>`).join('');
  $('#situation').innerHTML = `<table class="t sm"><tr><td>Taille de la charpente</td><td class="r tnum">100 %</td><td class="r tnum">14 800 €</td></tr><tr><td>Levage et assemblage</td><td class="r tnum">40 %</td><td class="r tnum">4 480 €</td></tr><tr><td>Fourniture bois</td><td class="r tnum">100 %</td><td class="r tnum">16 900 €</td></tr><tr><td>Chevronnage</td><td class="r tnum">10 %</td><td class="r tnum">960 €</td></tr><tr><td>Échafaudage</td><td class="r tnum">100 %</td><td class="r tnum">2 500 €</td></tr>
    <tr><td><b>Cumul</b></td><td></td><td class="r tnum"><b>39 640 €</b></td></tr><tr><td class="muted">Déjà facturé (situation n° 1)</td><td></td><td class="r tnum muted">− 10 720 €</td></tr><tr><td><b>À facturer</b></td><td></td><td class="r tnum"><b>28 920 € HT</b></td></tr></table>
    <button class="btn pri" style="margin-top:12px">Préparer la situation n° 2</button><span class="muted sm" style="margin-left:10px">calculée depuis l'avancement saisi</span>`;
}

// ===== Pilotage =====
function renderPilotage() {
  kpis('#pi-kpis', [
    { l: 'Chantiers en cours', v: 7, d: '<span class="muted">240 200 € HT engagés</span>' },
    { l: 'Heures semaine 44', v: '598 h', d: '<span class="muted">sur 640 h disponibles</span>' },
    { l: 'Devis en attente', v: '5', d: '<span class="muted">186 400 € HT</span>' },
    { l: 'En dépassement d\'heures', v: '1', d: '<span style="color:var(--late)">Copro Les Écrins : 107 %</span>', alert: true },
  ]);
  $('#chantiers').innerHTML = `<tr><th>Chantier</th><th>Client · ville</th><th class="r">Montant HT</th><th style="width:150px">Avancement</th><th style="width:170px">Heures / budget</th><th>Statut</th></tr>` +
    Object.entries(CH).map(([ref, c]) => {
      const p = c.hp ? Math.round((c.hr / c.hp) * 100) : 0;
      const over = p > c.av + 20 || p > 100;
      const st = c.av === 0 ? badge('idle', 'Démarre ven.') : p > 100 ? badge('late', 'Dépassement') : over ? badge('warn', 'À surveiller') : c.av > 85 ? badge('info', 'À réceptionner') : badge('ok', 'Dans le budget');
      return `<tr><td><b>${ref}</b><div class="muted sm">${esc(c.type)}</div></td><td>${esc(c.client)}<div class="muted sm">${esc(c.ville)}</div></td><td class="r tnum">${eur(c.ht)}</td><td><div style="display:flex;gap:8px;align-items:center">${bar(c.av)}<span class="sm tnum muted">${c.av} %</span></div></td><td><div style="display:flex;gap:8px;align-items:center">${bar(p, p > 100)}<span class="sm tnum muted">${c.hr} / ${c.hp} h</span></div></td><td>${st}</td></tr>`;
    }).join('');
  $('#devis').innerHTML = `<tr><th>Devis</th><th class="r">Montant</th><th>Envoyé</th><th></th></tr>` + [
    ['Maison ossature bois · Clelles', 96200, '12/10', 'Relancer'],
    ['Charpente garage · Saint-Martin-de-la-Cluze', 18400, '19/10', 'Relancer'],
    ['Terrasse et pergola · Varces', 14900, '21/10', 'J+10'],
    ['Réfection toiture · Mens', 41300, '26/10', 'J+5'],
    ['Escalier hélicoïdal · Grenoble', 15600, '28/10', 'J+3'],
  ].map(([d, m, e, a]) => `<tr><td>${esc(d)}</td><td class="r tnum">${eur(m)}</td><td class="muted">${e}</td><td class="r">${a.startsWith('J') ? `<span class="muted sm">${a}</span>` : `<button class="btn">${a}</button>`}</td></tr>`).join('');
  const w = [['S45', [98, 92, 100, 88]], ['S46', [100, 75, 96, 60]], ['S47', [85, 100, 70, 45]], ['S48', [60, 80, 40, 30]]];
  $('#charge').innerHTML = `<div style="display:grid;grid-template-columns:110px repeat(4,1fr);gap:6px;align-items:center" class="sm"><span></span>${w.map((x) => `<b class="muted">${x[0]}</b>`).join('')}` +
    EQ.map((e, i) => `<span>${esc(e.nom.split(' · ')[1])}</span>` + w.map((x) => { const v = x[1][i]; return `<div style="height:26px;border-radius:6px;background:${v >= 95 ? '#fde7e3' : v >= 70 ? '#e3f6ea' : '#eef0f3'};display:grid;place-items:center;font-weight:600" class="tnum">${v} %</div>`; }).join('')).join('') +
    `</div><div class="muted sm" style="margin-top:10px">Ossature et menuiserie ont de la place en S47–S48 : de quoi caler les devis en attente.</div>`;
}

// ===== Mobile : journée du chef d'équipe =====
function renderTerrain() {
  $('#jour').innerHTML = `<div style="padding:14px 16px;border-bottom:1px solid var(--line)"><div class="muted sm">Chantier</div><div style="font-size:17px;font-weight:700">C-2604 · Grange des Clots</div><div class="sm">Levage de la charpente · SCI Les Clots</div></div>
    <div class="list">
      <div class="li"><span>🕢</span><div style="flex:1"><b>7 h 30 au dépôt</b><div class="muted sm">8 h 15 sur le chantier, Mens (38)</div></div><button class="btn">Itinéraire</button></div>
      <div class="li"><span>👷</span><div style="flex:1"><b>Équipe</b><div class="muted sm">Julien M., Bastien R., Hugo T., Nadia K.</div></div></div>
      <div class="li"><span>🚛</span><div style="flex:1"><b>Camion-grue</b><div class="muted sm">Karim B. conduit · arrive 9 h</div></div></div>
      <div class="li"><span>🌬️</span><div style="flex:1"><b>Vent 25 km/h</b><div class="muted sm">levage possible toute la journée</div></div>${badge('ok', 'OK')}</div>
    </div>`;
  $('#todo').innerHTML = [['Lever les fermes 5 et 6', 1], ['Contreventement provisoire', 0], ['Pannes faîtière et intermédiaires', 0], ['Photo de fin de journée', 0]]
    .map(([t, c]) => `<label class="li"><input type="checkbox" class="chk" ${c ? 'checked' : ''}><span style="flex:1">${esc(t)}</span></label>`).join('');
  $('#docs').innerHTML = [['Plan de charpente', 'indice B · 22/10'], ['Carnet de détails', 'PDF · 6 pages'], ['PPSPS chantier', 'à jour']].map(([t, d]) => `<div class="li"><span>📄</span><div style="flex:1"><b>${esc(t)}</b><div class="muted sm">${esc(d)}</div></div><span class="muted">›</span></div>`).join('');
}
function renderHeures() {
  $('#hrs').innerHTML = [['Julien M.', 8], ['Bastien R.', 8], ['Hugo T.', 8], ['Nadia K.', 7.5]].map(([n, h]) =>
    `<div class="li" style="align-items:center"><span class="av">${n.split(' ').map((x) => x[0]).join('')}</span><b style="flex:1">${esc(n)}</b><button class="btn" style="padding:4px 11px">−</button><b class="tnum" style="width:46px;text-align:center">${String(h).replace('.', ',')} h</b><button class="btn" style="padding:4px 11px">+</button></div>`).join('') +
    `<div class="li"><span style="flex:1" class="muted">Total</span><b class="tnum">31,5 h</b></div>`;
  $('#avt').innerHTML = `<div class="sm" style="display:flex;justify-content:space-between"><span>Levage et assemblage</span><b>55 %</b></div>${bar(55)}
    <div style="display:flex;gap:8px;margin-top:12px">${[0, 1, 2].map((i) => `<div style="flex:1;height:64px;border-radius:8px;background:linear-gradient(135deg,#c89b6a,#7a5230 ${55 + i * 12}%)"></div>`).join('')}<div style="flex:1;height:64px;border-radius:8px;border:2px dashed var(--line);display:grid;place-items:center;color:var(--muted);font-size:22px">+</div></div>`;
}

// ===== Navigation =====
function show() {
  const def = matchMedia('(max-width:600px)').matches ? 'terrain' : 'planning';
  const v = location.hash.slice(1) || def;
  document.querySelectorAll('section[data-view]').forEach((s) => s.classList.toggle('on', s.dataset.view === v));
  document.querySelectorAll('[data-v]').forEach((a) => a.classList.toggle('on', a.dataset.v === v));
  const s = document.querySelector(`section[data-view="${v}"]`);
  if (s) {
    $('#title').textContent = $('#mtitle').textContent = s.dataset.title || '';
    $('#subtitle').textContent = $('#msubtitle').textContent = s.dataset.sub || '';
  }
}
renderPlanning(); renderChantier(); renderPilotage(); renderTerrain(); renderHeures();
addEventListener('hashchange', show);
show();
