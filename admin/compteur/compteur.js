/* Compteur réseaux QME : calculs et graphiques (mêmes que la page Claude « Compteur réseaux QME »). */
dash.loader('publications', {
  description: "Transforme la grille du Sheet en lignes. Les compteurs deviennent des nombres ; une case vide reste vide (publication non relevée).",
  fn: ({answer}) => {
    const a = answer && answer.content ? answer.content : answer;
    const values = (a && a.values) || [];
    if (!values.length) throw new Error("Le Sheet n'a renvoyé aucune ligne.");
    const head = values[0].map((h) => String(h).trim());
    const nums = new Set(['Vues', "J'aime", 'Commentaires', 'Partages', 'Enregistrements', 'Clics', "Dont moi : J'aime", 'Dont moi : commentaires']);
    const toNum = (v) => {
      if (v === undefined || v === null) return null;
      const s = String(v).replace(/[\s  ]/g, '').replace(',', '.');
      if (s === '') return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    const rows = values.slice(1).filter((r) => r && r[1]).map((r) => {
      const o = {};
      head.forEach((h, i) => {
        const v = r[i];
        o[h] = nums.has(h) ? toNum(v) : (v === undefined || v === null || v === '' ? null : String(v));
      });
      return o;
    });
    return {columns: head, rows};
  }
});

dash.calc('totaux', {
  inputs: ['publications'],
  title: 'Totaux par réseau',
  description: "Somme de chaque compteur par réseau (LinkedIn, Instagram, YouTube, TikTok, X) et au total. En mode « sans moi » (bouton du bandeau), les colonnes « Dont moi » sont retirées des J'aime et des commentaires de chaque publication. Engagement % = (J'aime + commentaires + partages + enregistrements) ÷ vues × 100, sur les seules publications où les vues et au moins une interaction sont saisies.",
  fn: (publications) => {
    const sansMoi = (dash.params().mode || 'net') !== 'brut';
    if (sansMoi) publications = publications.map((r) => Object.assign({}, r, {
      "J'aime": r["J'aime"] == null ? null : Math.max(0, r["J'aime"] - (r["Dont moi : J'aime"] || 0)),
      Commentaires: r.Commentaires == null ? null : Math.max(0, r.Commentaires - (r['Dont moi : commentaires'] || 0))
    }));
    const champs = ['Vues', "J'aime", 'Commentaires', 'Partages', 'Enregistrements', 'Clics'];
    const somme = (lignes) => {
      const o = {Publications: lignes.length, 'Relevées': lignes.filter((r) => r.Vues != null).length};
      champs.forEach((k) => { o[k] = lignes.reduce((s, r) => s + (r[k] || 0), 0); });
      const avecInter = lignes.filter((r) => r.Vues > 0 && ["J'aime", 'Commentaires', 'Partages', 'Enregistrements'].some((k) => r[k] != null));
      const vues = avecInter.reduce((s, r) => s + r.Vues, 0);
      const inter = avecInter.reduce((s, r) => s + (r["J'aime"] || 0) + (r.Commentaires || 0) + (r.Partages || 0) + (r.Enregistrements || 0), 0);
      o['Engagement %'] = vues > 0 ? Math.round((inter / vues) * 1000) / 10 : null;
      return o;
    };
    const reseaux = ['LinkedIn', 'Instagram', 'YouTube', 'TikTok', 'X'];
    return [
      ...reseaux.map((n) => Object.assign({'Réseau': n}, somme(publications.filter((r) => r['Réseau'] === n)))),
      Object.assign({'Réseau': 'Total'}, somme(publications))
    ];
  }
});

window.rqCouleurs = {LinkedIn: '#2E5A88', Instagram: '#B84A34', YouTube: '#E8B93A', TikTok: '#2E7D4F', X: '#24221F'};
window.rqColor = (net) => window.rqCouleurs[net] || '#6E685F';
window.rqFmt = (v, champ) => {
  if (v === null || v === undefined) return '—';
  if (champ === 'Revenu $') return new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'USD', maximumFractionDigits: 2}).format(v);
  const s = new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 1}).format(v);
  return champ && champ.endsWith('%') ? s + ' %' : s;
};
window.rqFind = (rows, where) => {
  if (!where) return rows[0];
  const [k, v] = where.split('=');
  return rows.find((r) => String(r[decodeURIComponent(k)]) === decodeURIComponent(v));
};

document.querySelectorAll('.rq-dot[data-net]').forEach((el) => { el.style.background = window.rqColor(el.dataset.net); });

dash.draw('n', (el) => {
  const d = dash.data(el.dataset.source);
  el.classList.toggle('dash-skeleton', d.status === 'loading');
  if (d.status !== 'ok' || !Array.isArray(d.data)) { el.textContent = '—'; return; }
  const row = window.rqFind(d.data, el.dataset.where);
  el.textContent = row ? window.rqFmt(row[el.dataset.field], el.dataset.field) : '—';
});

const rqTop = () => {
  const d = dash.data('publications');
  if (d.status !== 'ok') return null;
  return d.data.filter((r) => r.Vues != null).sort((a, b) => b.Vues - a.Vues)[0] || null;
};

dash.draw('resume-switch', () => {
  const t = dash.data('totaux');
  const ok = t.status === 'ok' && Array.isArray(t.data);
  const total = ok ? t.data.find((r) => r['Réseau'] === 'Total') : null;
  const vide = !total || total['Relevées'] === 0;
  document.querySelectorAll('#resume .rq-s0').forEach((s) => { s.hidden = !(ok && vide); });
  document.querySelectorAll('#resume .rq-s1').forEach((s) => { s.hidden = !ok || vide; });
});

dash.draw('top-id', (el) => {
  const top = rqTop();
  el.textContent = top ? top.ID + ' (' + top['Réseau'] + ')' : '—';
});

dash.draw('top-vues', (el) => {
  const top = rqTop();
  if (!top) { el.textContent = '—'; el.removeAttribute('data-where'); return; }
  el.setAttribute('data-where', 'ID=' + encodeURIComponent(top.ID));
  el.textContent = window.rqFmt(top.Vues);
});

dash.draw('bars', (el) => {
  const d = dash.data('publications');
  el.replaceChildren();
  if (d.status === 'error') { const p = document.createElement('p'); p.className = 'rq-empty'; p.textContent = 'Échec du chargement du Sheet.'; el.append(p); return; }
  if (d.status !== 'ok') { el.textContent = '—'; return; }
  const rows = d.data.filter((r) => r.Vues != null).sort((a, b) => b.Vues - a.Vues);
  if (!rows.length) { const p = document.createElement('p'); p.className = 'rq-empty'; p.textContent = 'Aucune publication relevée : saisis les vues dans le Sheet pour voir le classement.'; el.append(p); return; }

  const W = Math.max(280, el.clientWidth || 600);
  const barH = 22, gap = 8, top = 4, bottom = 24;
  const H = top + rows.length * (barH + gap) + bottom;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);

  const probe = svg.append('g');
  let left = 0;
  rows.forEach((r) => { const t = probe.append('text').attr('class', 'rq-lbl').text(r.ID); left = Math.max(left, t.node().getComputedTextLength()); });
  let valW = 0;
  rows.forEach((r) => { const t = probe.append('text').attr('class', 'rq-lbl').text(window.rqFmt(r.Vues)); valW = Math.max(valW, t.node().getComputedTextLength()); });
  probe.remove();
  left = Math.ceil(left) + 10;
  const right = Math.ceil(valW) + 10;

  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.Vues) || 1]).nice().range([left, W - right]);
  const ticks = Math.max(2, Math.floor((W - left - right) / 90));
  svg.append('g').attr('transform', `translate(0,${H - bottom})`).call(d3.axisBottom(x).ticks(ticks).tickSize(-(H - bottom - top)).tickFormat((v) => new Intl.NumberFormat('fr-FR', {notation: 'compact'}).format(v)));

  const tip = document.createElement('div');
  tip.className = 'rq-tip';
  tip.hidden = true;
  el.append(tip);

  const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r, i) => `translate(0,${top + i * (barH + gap)})`);
  g.append('text').attr('class', 'rq-lbl').attr('x', left - 8).attr('y', barH / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((r) => r.ID);
  g.append('rect').attr('x', left).attr('height', barH).attr('rx', 3).attr('width', (r) => Math.max(1, x(r.Vues) - left)).style('fill', (r) => window.rqColor(r['Réseau']));
  g.append('text').attr('class', 'rq-lbl').attr('x', (r) => x(r.Vues) + 6).attr('y', barH / 2).attr('dy', '0.35em').text((r) => window.rqFmt(r.Vues));
  g.append('rect').attr('x', 0).attr('width', W).attr('height', barH + gap).attr('y', -gap / 2).style('fill', 'transparent')
    .on('pointerenter pointermove', (ev, r) => {
      tip.replaceChildren();
      const s = document.createElement('strong'); s.textContent = r.ID + ' · ' + (r.Titre || ''); tip.append(s);
      [['Vues', 'Vues'], ["J'aime", "J'aime"], ['Commentaires', 'Commentaires'], ['Partages', 'Partages'], ['Enregistrements', 'Enregistrements'], ['Clics', 'Clics'], ['Relevé le', 'Relevé le']].forEach(([k, lab]) => {
        if (r[k] == null) return;
        const sp = document.createElement('span'); sp.textContent = lab + ' : ' + (typeof r[k] === 'number' ? window.rqFmt(r[k]) : r[k]); tip.append(sp);
      });
      tip.hidden = false;
      const box = el.getBoundingClientRect();
      const px = ev.clientX - box.left, py = ev.clientY - box.top;
      const tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(px + 12, box.width - tw)) + 'px';
      tip.style.top = (py + 14) + 'px';
    })
    .on('pointerleave', () => { tip.hidden = true; });
});

dash.draw('rows', (tbody) => {
  const d = dash.data('publications');
  tbody.replaceChildren();
  if (d.status !== 'ok') return;
  const champs = ['ID', 'Réseau', 'Publié le', 'Format', 'Titre', 'Vues', "J'aime", 'Commentaires', 'Partages', 'Enregistrements', 'Clics', "Dont moi : J'aime", 'Dont moi : commentaires', 'Relevé le'];
  const numeriques = new Set(['Vues', "J'aime", 'Commentaires', 'Partages', 'Enregistrements', 'Clics', "Dont moi : J'aime", 'Dont moi : commentaires']);
  const rows = d.data.slice().sort((a, b) => String(b['Publié le'] || '').localeCompare(String(a['Publié le'] || '')));
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    champs.forEach((k) => {
      const td = document.createElement('td');
      const v = r[k];
      if (numeriques.has(k)) td.className = 'rq-num';
      if (k === 'Titre') td.className = 'rq-title';
      if (v === null || v === undefined) { td.classList.add('rq-nil'); td.textContent = '·'; }
      else if (k === 'Titre' && r.URL && /^https:\/\//.test(r.URL)) {
        const a = document.createElement('a'); a.href = r.URL; a.target = '_blank'; a.rel = 'noopener'; a.textContent = v; td.append(a);
      } else td.textContent = numeriques.has(k) ? window.rqFmt(v) : v;
      tr.append(td);
    });
    tbody.append(tr);
  });
});

document.querySelectorAll('.rq-mode-b').forEach((b) => b.addEventListener('click', () => dash.setParams({mode: b.dataset.mode})));
dash.onData(() => {
  const m = dash.params().mode || 'net';
  document.querySelectorAll('.rq-mode-b').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
});

dash.loader('historique', {
  description: "Transforme la grille de l'onglet Historique en lignes (une par publication et par relevé). Les compteurs deviennent des nombres ; une case vide reste vide (valeur non relevée ce jour-là). Les lignes sans date ou sans ID sont ignorées.",
  fn: ({answer}) => {
    const a = answer && answer.content ? answer.content : answer;
    const values = (a && a.values) || [];
    if (!values.length) throw new Error("L'onglet Historique n'a renvoyé aucune ligne.");
    const head = values[0].map((h) => String(h).trim());
    const nums = new Set(['Vues', "J'aime", 'Commentaires', 'Partages', 'Enregistrements', 'Clics', "Dont moi : J'aime", 'Dont moi : commentaires']);
    const toNum = (v) => {
      if (v === undefined || v === null) return null;
      const s = String(v).replace(/[\s  ]/g, '').replace(',', '.');
      if (s === '') return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    const rows = values.slice(1).filter((r) => r && r[0] && r[2]).map((r) => {
      const o = {};
      head.forEach((h, i) => {
        const v = r[i];
        o[h] = nums.has(h) ? toNum(v) : (v === undefined || v === null || v === '' ? null : String(v));
      });
      return o;
    });
    return {columns: head, rows};
  }
});

dash.calc('cumuls', {
  inputs: ['historique'],
  title: 'Compteurs cumulés par jour et par réseau',
  description: "Pour chaque jour, du premier au dernier relevé : dernière valeur connue de chaque publication à la fin du jour (une case vide garde la valeur précédente), additionnée par réseau, plus une ligne Total. En mode « sans moi », les J'aime et commentaires de mes comptes sont retirés publication par publication ; avant le premier comptage d'une publication, on retire le premier compte connu.",
  fn: (historique) => {
    const champs = ['Vues', "J'aime", 'Commentaires', 'Partages', 'Enregistrements', 'Clics'];
    const ordre = ['LinkedIn', 'Instagram', 'YouTube', 'TikTok', 'X'];
    const lignes = historique.filter((r) => r['Relevé le'] && r.ID)
      .slice().sort((a, b) => String(a['Relevé le']).localeCompare(String(b['Relevé le'])));
    if (!lignes.length) return [];
    const jourDe = (r) => String(r['Relevé le']).slice(0, 10);
    const reseaux = ordre.concat([...new Set(lignes.map((r) => r['Réseau']).filter((n) => n && !ordre.includes(n)))]);
    const jours = [];
    const fin = Date.parse(jourDe(lignes[lignes.length - 1]) + 'T00:00:00Z');
    for (let t = Date.parse(jourDe(lignes[0]) + 'T00:00:00Z'); t <= fin; t += 86400000) jours.push(new Date(t).toISOString().slice(0, 10));
    const sansMoi = (dash.params().mode || 'net') !== 'brut';
    const moi = {"J'aime": "Dont moi : J'aime", Commentaires: 'Dont moi : commentaires'};
    const premier = {};
    lignes.forEach((r) => {
      const p = premier[r.ID] || (premier[r.ID] = {});
      Object.values(moi).forEach((k) => { if (r[k] != null && p[k] == null) p[k] = r[k]; });
    });
    const valeur = (id, e, k) => {
      const v = e[k] || 0;
      if (!sansMoi || !moi[k]) return v;
      const m = e[moi[k]] != null ? e[moi[k]] : (premier[id][moi[k]] || 0);
      return Math.max(0, v - m);
    };
    const etat = {};
    const sortie = [];
    let i = 0;
    jours.forEach((jour) => {
      while (i < lignes.length && jourDe(lignes[i]) <= jour) {
        const r = lignes[i++];
        const e = etat[r.ID] || (etat[r.ID] = {});
        if (r['Réseau']) e['Réseau'] = r['Réseau'];
        champs.concat(Object.values(moi)).forEach((k) => { if (r[k] != null) e[k] = r[k]; });
      }
      const total = {Jour: jour, 'Réseau': 'Total'};
      champs.forEach((k) => { total[k] = 0; });
      reseaux.forEach((n) => {
        const o = {Jour: jour, 'Réseau': n};
        champs.forEach((k) => {
          o[k] = Object.entries(etat).filter(([, e]) => e['Réseau'] === n).reduce((s, [id, e]) => s + valeur(id, e, k), 0);
          total[k] += o[k];
        });
        sortie.push(o);
      });
      sortie.push(total);
    });
    return sortie;
  }
});

dash.draw('cumul-total', (el) => {
  const d = dash.data('cumuls');
  el.classList.toggle('dash-skeleton', d.status === 'loading');
  if (d.status !== 'ok' || !Array.isArray(d.data) || !d.data.length) { el.textContent = '—'; el.removeAttribute('data-where'); return; }
  const dernier = d.data[d.data.length - 1].Jour;
  const row = d.data.find((r) => r.Jour === dernier && r['Réseau'] === 'Total');
  el.setAttribute('data-where', 'Jour=' + encodeURIComponent(dernier) + '&Réseau=Total');
  el.textContent = row ? window.rqFmt(row[el.dataset.champ]) : '—';
});

dash.draw('cumul', (el) => {
  const d = dash.data('cumuls');
  const champ = el.dataset.champ;
  el.replaceChildren();
  const message = (texte) => { const p = document.createElement('p'); p.className = 'rq-empty'; p.textContent = texte; el.append(p); };
  if (d.status === 'error') { message("Échec du chargement de l'Historique."); return; }
  if (d.status !== 'ok') { el.textContent = '—'; return; }
  const rows = Array.isArray(d.data) ? d.data : [];
  const jours = [...new Set(rows.map((r) => r.Jour))];
  const nets = [...new Set(rows.map((r) => r['Réseau']))].filter((n) => n !== 'Total' && rows.some((r) => r['Réseau'] === n && r[champ] > 0));
  if (!jours.length || !nets.length) { message('Aucune valeur relevée pour ce compteur.'); return; }
  const table = jours.map((j) => {
    const o = {Jour: j};
    nets.forEach((n) => { o[n] = (rows.find((r) => r.Jour === j && r['Réseau'] === n) || {})[champ] || 0; });
    return o;
  });
  const series = d3.stack().keys(nets)(table);
  const max = d3.max(series[series.length - 1], (p) => p[1]) || 1;

  const W = Math.max(240, el.clientWidth || 320);
  const H = 190, top = 10, bottom = 24, right = 12;
  const y = d3.scaleLinear().domain([0, max]).nice(4).range([H - bottom, top]);
  const fmtY = (v) => new Intl.NumberFormat('fr-FR', {notation: v >= 10000 ? 'compact' : 'standard'}).format(v);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || champ);
  const probe = svg.append('g');
  let left = 0;
  y.ticks(4).forEach((v) => { const t = probe.append('text').attr('class', 'rq-lbl').text(fmtY(v)); left = Math.max(left, t.node().getComputedTextLength()); });
  probe.remove();
  left = Math.ceil(left) + 10;
  const x = d3.scalePoint().domain(jours).range([left + 4, W - right - 4]).align(0.5);
  const fmtJour = (j) => j.slice(8, 10) + '/' + j.slice(5, 7);

  svg.append('g').attr('transform', `translate(${left},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(W - left - right)).tickFormat(fmtY))
    .call((g) => g.selectAll('.tick line').attr('stroke-opacity', 1));
  const pas = Math.max(1, Math.ceil(jours.length / Math.max(2, Math.floor((W - left - right) / 52))));
  svg.append('g').attr('transform', `translate(0,${H - bottom})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(8).tickValues(jours.filter((j, i) => i % pas === 0 || i === jours.length - 1)).tickFormat(fmtJour));

  if (jours.length === 1) {
    const bw = 28;
    svg.append('g').selectAll('rect').data(series).join('rect')
      .attr('x', x(jours[0]) - bw / 2).attr('width', bw)
      .attr('y', (s) => y(s[0][1])).attr('height', (s) => Math.max(0, y(s[0][0]) - y(s[0][1])))
      .style('fill', (s) => window.rqColor(s.key)).style('stroke', 'var(--papier)').style('stroke-width', 1);
  } else {
    const aire = d3.area().x((p) => x(p.data.Jour)).y0((p) => y(p[0])).y1((p) => y(p[1])).curve(d3.curveLinear);
    svg.append('g').selectAll('path').data(series).join('path')
      .attr('d', aire)
      .style('fill', (s) => window.rqColor(s.key)).style('fill-opacity', 0.9)
      .style('stroke', 'var(--surface)').style('stroke-width', 1);
  }

  const guide = svg.append('line').attr('class', 'rq-guide').attr('y1', top).attr('y2', H - bottom).style('display', 'none');
  const tip = document.createElement('div');
  tip.className = 'rq-tip';
  tip.hidden = true;
  el.append(tip);
  const montrer = (ev) => {
    const box = el.getBoundingClientRect();
    const px = (ev.clientX - box.left) * (W / box.width);
    let j = jours[0], dist = Infinity;
    jours.forEach((k) => { const dd = Math.abs(x(k) - px); if (dd < dist) { dist = dd; j = k; } });
    const ligne = table.find((o) => o.Jour === j);
    guide.attr('x1', x(j)).attr('x2', x(j)).style('display', null);
    tip.replaceChildren();
    const s = document.createElement('strong'); s.textContent = champ + ' au ' + fmtJour(j); tip.append(s);
    let total = 0;
    nets.slice().reverse().forEach((n) => {
      total += ligne[n];
      const sp = document.createElement('span');
      const pastille = document.createElement('i'); pastille.style.background = window.rqColor(n);
      const v = document.createElement('em'); v.textContent = window.rqFmt(ligne[n]);
      sp.append(pastille, document.createTextNode(n), v); tip.append(sp);
    });
    const st = document.createElement('span'); st.className = 'tot';
    const vt = document.createElement('em'); vt.textContent = window.rqFmt(total);
    st.append(document.createTextNode('Total'), vt); tip.append(st);
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const cx = ev.clientX - box.left, cy = ev.clientY - box.top;
    tip.style.left = Math.max(0, Math.min(cx + 14, box.width - tw)) + 'px';
    tip.style.top = Math.max(0, Math.min(cy - th - 10, box.height - th)) + 'px';
  };
  svg.append('rect').attr('x', left).attr('y', 0).attr('width', W - left).attr('height', H).style('fill', 'transparent')
    .on('pointerenter pointermove', montrer)
    .on('pointerleave', () => { tip.hidden = true; guide.style('display', 'none'); });
});

dash.calc('gumroad_total', {
  inputs: ['gumroad_produits'],
  title: 'Totaux Gumroad',
  description: "Somme, sur tous les produits, des vues de page, des ventes (téléchargements gratuits compris) et du revenu (revenue_cents ÷ 100, en dollars, avant frais) ; conversion = ventes ÷ vues × 100.",
  fn: (produits) => {
    const vues = produits.reduce((s, r) => s + (Number(r.views) || 0), 0);
    const ventes = produits.reduce((s, r) => s + (Number(r.sales) || 0), 0);
    const centimes = produits.reduce((s, r) => s + (Number(r.revenue_cents) || 0), 0);
    return [{
      Vues: vues,
      Ventes: ventes,
      'Revenu $': centimes / 100,
      'Conversion %': vues > 0 ? Math.round((ventes / vues) * 1000) / 10 : null,
      'Produits vus': produits.filter((r) => Number(r.views) > 0).length,
      Produits: produits.length
    }];
  }
});

dash.calc('gumroad_cumul', {
  inputs: ['gumroad_jours'],
  title: 'Ventes et revenu Gumroad cumulés par jour',
  description: "Pour chaque jour du 01/11/2026 à aujourd'hui (ou au dernier jour de vente s'il est plus tard) : nombre de ventes (units) et revenu (revenue_cents ÷ 100, en dollars) cumulés depuis le 01/11.",
  fn: (jours) => {
    const debut = '2026-11-01';
    const parJour = {};
    jours.forEach((r) => { parJour[r.date] = r; });
    const derniere = jours.reduce((m, r) => (r.date > m ? r.date : m), debut);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const fin = derniere > aujourdhui ? derniere : aujourdhui;
    const sortie = [];
    let ventes = 0, centimes = 0;
    for (let t = Date.parse(debut + 'T00:00:00Z'); t <= Date.parse(fin + 'T00:00:00Z'); t += 86400000) {
      const j = new Date(t).toISOString().slice(0, 10);
      const r = parJour[j];
      if (r) { ventes += Number(r.units) || 0; centimes += Number(r.revenue_cents) || 0; }
      sortie.push({Jour: j, Ventes: ventes, 'Revenu $': centimes / 100});
    }
    return sortie;
  }
});

dash.draw('gcumul', (el) => {
  const d = dash.data('gumroad_cumul');
  const champ = el.dataset.champ;
  el.replaceChildren();
  const message = (texte) => { const p = document.createElement('p'); p.className = 'rq-empty'; p.textContent = texte; el.append(p); };
  if (d.status === 'error') { message('Échec du chargement depuis Gumroad.'); return; }
  if (d.status !== 'ok') { el.textContent = '—'; return; }
  const rows = Array.isArray(d.data) ? d.data : [];
  if (!rows.length) { message('Aucune donnée Gumroad.'); return; }
  const couleur = champ === 'Ventes' ? '#B84A34' : '#E8B93A';
  const W = Math.max(240, el.clientWidth || 320);
  const H = 190, top = 10, bottom = 24, right = 12;
  const max = d3.max(rows, (r) => r[champ]) || 1;
  const y = d3.scaleLinear().domain([0, max]).nice(4).range([H - bottom, top]);
  const fmt = (v) => window.rqFmt(v, champ);
  const ticks = champ === 'Ventes' ? y.ticks(Math.min(4, max)).filter((v) => Number.isInteger(v)) : y.ticks(4);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || champ);
  const probe = svg.append('g');
  let left = 0;
  ticks.forEach((v) => { const t = probe.append('text').attr('class', 'rq-lbl').text(fmt(v)); left = Math.max(left, t.node().getComputedTextLength()); });
  probe.remove();
  left = Math.ceil(left) + 10;
  const parse = (j) => new Date(j + 'T00:00:00Z');
  const x = d3.scaleUtc().domain([parse(rows[0].Jour), parse(rows[rows.length - 1].Jour)]).range([left + 4, W - right - 4]);
  svg.append('g').attr('transform', `translate(${left},0)`)
    .call(d3.axisLeft(y).tickValues(ticks).tickSize(-(W - left - right)).tickFormat(fmt));
  svg.append('g').attr('transform', `translate(0,${H - bottom})`)
    .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((W - left - right) / 60))).tickSize(0).tickPadding(8).tickFormat(d3.utcFormat('%d/%m')));
  const aire = d3.area().x((r) => x(parse(r.Jour))).y0(y(0)).y1((r) => y(r[champ])).curve(d3.curveStepAfter);
  const ligne = d3.line().x((r) => x(parse(r.Jour))).y((r) => y(r[champ])).curve(d3.curveStepAfter);
  svg.append('path').datum(rows).attr('d', aire).style('fill', couleur).style('fill-opacity', 0.25);
  svg.append('path').datum(rows).attr('d', ligne).style('fill', 'none').style('stroke', couleur).style('stroke-width', 2.5);
  const dernier = rows[rows.length - 1];
  svg.append('circle').attr('cx', x(parse(dernier.Jour))).attr('cy', y(dernier[champ])).attr('r', 4.5).style('fill', couleur).style('stroke', 'var(--surface)').style('stroke-width', 2);

  const guide = svg.append('line').attr('class', 'rq-guide').attr('y1', top).attr('y2', H - bottom).style('display', 'none');
  const tip = document.createElement('div');
  tip.className = 'rq-tip';
  tip.hidden = true;
  el.append(tip);
  svg.append('rect').attr('x', left).attr('y', 0).attr('width', W - left).attr('height', H).style('fill', 'transparent')
    .on('pointerenter pointermove', (ev) => {
      const box = el.getBoundingClientRect();
      const px = (ev.clientX - box.left) * (W / box.width);
      let r = rows[0], dist = Infinity;
      rows.forEach((k) => { const dd = Math.abs(x(parse(k.Jour)) - px); if (dd < dist) { dist = dd; r = k; } });
      guide.attr('x1', x(parse(r.Jour))).attr('x2', x(parse(r.Jour))).style('display', null);
      tip.replaceChildren();
      const s = document.createElement('strong'); s.textContent = 'Au ' + r.Jour.slice(8, 10) + '/' + r.Jour.slice(5, 7); tip.append(s);
      const sp = document.createElement('span');
      const v = document.createElement('em'); v.textContent = fmt(r[champ]);
      sp.append(document.createTextNode(champ === 'Ventes' ? 'Ventes cumulées' : 'Revenu cumulé'), v); tip.append(sp);
      tip.hidden = false;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      const cx = ev.clientX - box.left, cy = ev.clientY - box.top;
      tip.style.left = Math.max(0, Math.min(cx + 14, box.width - tw)) + 'px';
      tip.style.top = Math.max(0, Math.min(cy - th - 10, box.height - th)) + 'px';
    })
    .on('pointerleave', () => { tip.hidden = true; guide.style('display', 'none'); });
});

dash.draw('gtop', (el) => {
  const d = dash.data('gumroad_produits');
  el.replaceChildren();
  const message = (texte) => { const p = document.createElement('p'); p.className = 'rq-empty'; p.textContent = texte; el.append(p); };
  if (d.status === 'error') { message('Échec du chargement depuis Gumroad.'); return; }
  if (d.status !== 'ok') { el.textContent = '—'; return; }
  const rows = (Array.isArray(d.data) ? d.data : []).filter((r) => Number(r.views) > 0)
    .sort((a, b) => (Number(b.views) - Number(a.views)) || (Number(b.sales) - Number(a.sales))).slice(0, 12);
  if (!rows.length) { message('Aucune page produit vue sur la période.'); return; }
  const W = Math.max(260, el.clientWidth || 600);
  const pas = 40, top = 2;
  const H = top + rows.length * pas;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || 'Pages les plus vues');
  const etiquette = (r) => {
    const v = Number(r.views), s = Number(r.sales) || 0;
    return window.rqFmt(v) + ' vue' + (v > 1 ? 's' : '') + (s ? ' · ' + s + ' vente' + (s > 1 ? 's' : '') : '');
  };
  const probe = svg.append('g');
  let valW = 0;
  rows.forEach((r) => { const t = probe.append('text').attr('class', 'rq-lbl').text(etiquette(r)); valW = Math.max(valW, t.node().getComputedTextLength()); });
  probe.remove();
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => Number(r.views)) || 1]).range([0, Math.max(40, W - Math.ceil(valW) - 22)]);
  const g = svg.selectAll('g.rq-gp').data(rows).join('g').attr('class', 'rq-gp').attr('transform', (r, i) => `translate(0,${top + i * pas})`);
  g.append('text').attr('class', 'rq-lbl').attr('x', 0).attr('y', 12).style('fill', 'var(--encre)').style('font-weight', 500)
    .text((r) => r.product_name)
    .each(function () {
      const max = W - 4;
      let t = this.textContent;
      while (this.getComputedTextLength() > max && t.length > 4) { t = t.slice(0, -2); this.textContent = t + '…'; }
    });
  g.append('rect').attr('x', 0).attr('y', 18).attr('height', 12).attr('rx', 6).attr('width', (r) => Math.max(4, x(Number(r.views))))
    .style('fill', '#2E5A88');
  g.append('circle').attr('cx', (r) => x(Number(r.views)) + 10).attr('cy', 24).attr('r', 5)
    .style('fill', '#B84A34').style('display', (r) => (Number(r.sales) > 0 ? null : 'none'));
  g.append('text').attr('class', 'rq-lbl').attr('x', (r) => x(Number(r.views)) + (Number(r.sales) > 0 ? 20 : 8)).attr('y', 24).attr('dy', '0.35em')
    .text(etiquette);
});

dash.draw('gsources', (el) => {
  const d = dash.data('gumroad_sources');
  el.replaceChildren();
  const message = (texte) => { const p = document.createElement('p'); p.className = 'rq-empty'; p.textContent = texte; el.append(p); };
  if (d.status === 'error') { message('Échec du chargement depuis Gumroad.'); return; }
  if (d.status !== 'ok') { el.textContent = '—'; return; }
  const noms = {
    'direct': 'Accès direct',
    'Recommended by Gumroad': 'Recommandé par Gumroad',
    'qmengineering.gumroad.com': 'Ta boutique Gumroad',
    'qm-engineering.fr': 'Ton site qm-engineering.fr',
    'Gumroad': 'Gumroad (autre page)',
    'm.facebook.com': 'Facebook mobile',
    'Facebook': 'Facebook',
    'Google': 'Google',
    'bing.com': 'Bing'
  };
  const rows = (Array.isArray(d.data) ? d.data : []).filter((r) => Number(r.views) > 0 || Number(r.sales) > 0)
    .sort((a, b) => (Number(b.views) - Number(a.views)) || (Number(b.sales) - Number(a.sales)));
  if (!rows.length) { message('Aucune visite sur la période.'); return; }
  const W = Math.max(260, el.clientWidth || 600);
  const pas = 40, top = 2;
  const H = top + rows.length * pas;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || 'Sources de trafic');
  const etiquette = (r) => {
    const v = Number(r.views) || 0, s = Number(r.sales) || 0, c = Number(r.revenue_cents) || 0;
    let t = window.rqFmt(v) + ' vue' + (v > 1 ? 's' : '');
    if (s) t += ' · ' + s + ' vente' + (s > 1 ? 's' : '') + ' · ' + window.rqFmt(c / 100, 'Revenu $');
    return t;
  };
  const probe = svg.append('g');
  let valW = 0;
  rows.forEach((r) => { const t = probe.append('text').attr('class', 'rq-lbl').text(etiquette(r)); valW = Math.max(valW, t.node().getComputedTextLength()); });
  probe.remove();
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => Number(r.views)) || 1]).range([0, Math.max(40, W - Math.ceil(valW) - 26)]);
  const g = svg.selectAll('g.rq-gs').data(rows).join('g').attr('class', 'rq-gs').attr('transform', (r, i) => `translate(0,${top + i * pas})`);
  g.append('text').attr('class', 'rq-lbl').attr('x', 0).attr('y', 12).style('fill', 'var(--encre)').style('font-weight', 500)
    .text((r) => noms[r.referrer] ? noms[r.referrer] + (noms[r.referrer] !== r.referrer ? ' (' + r.referrer + ')' : '') : r.referrer);
  g.append('rect').attr('x', 0).attr('y', 18).attr('height', 12).attr('rx', 6).attr('width', (r) => Math.max(4, x(Number(r.views) || 0)))
    .style('fill', '#2E5A88');
  g.append('circle').attr('cx', (r) => Math.max(4, x(Number(r.views) || 0)) + 10).attr('cy', 24).attr('r', 5)
    .style('fill', '#B84A34').style('display', (r) => (Number(r.sales) > 0 ? null : 'none'));
  g.append('text').attr('class', 'rq-lbl').attr('x', (r) => Math.max(4, x(Number(r.views) || 0)) + (Number(r.sales) > 0 ? 20 : 8)).attr('y', 24).attr('dy', '0.35em')
    .text(etiquette);
});

dash.loader('gumroad_ventes', {
  description: "Une ligne par vente Gumroad, sans donnée personnelle (l'e-mail de l'acheteur est retiré). Source = utm_source, sinon le site référent ; Nature = « test » pour un code QME-TEST, « gratuit » pour une vente à 0 $. Pages suivantes chargées jusqu'à 200 ventes.",
  fn: async ({answer, call, args}) => {
    let rep = answer, ventes = [], pages = 0;
    while (rep) {
      if (rep.error) throw new Error(typeof rep.error === 'string' ? rep.error : (rep.error.message || 'Erreur Gumroad'));
      ventes = ventes.concat(Array.isArray(rep.sales) ? rep.sales : []);
      pages += 1;
      if (!rep.next_cursor || pages >= 4) break;
      rep = await call('list_sales', Object.assign({}, args, {cursor: rep.next_cursor}));
    }
    const hote = (r) => { if (!r || r === 'direct') return r || null; try { return new URL(r).hostname.replace(/^www\./, ''); } catch (e) { return String(r); } };
    const rows = ventes.map((v) => ({
      Vente: String(v.id),
      Date: String(v.created_at || '').replace('T', ' ').slice(0, 16),
      Produit: v.product_name || null,
      'Prix $': (Number(v.price_cents) || 0) / 100,
      'Net $': (Number(v.net_cents) || 0) / 100,
      Source: v.utm_source || hote(v.referrer),
      Support: v.utm_medium || null,
      Campagne: v.utm_campaign || null,
      Page: v.utm_content || null,
      Nature: /^QME-TEST/i.test(v.discount_code || '') ? 'test' : ((Number(v.price_cents) || 0) === 0 ? 'gratuit' : 'payante'),
      Remboursée: !!(v.refunded || v.chargedback)
    }));
    return {columns: ['Vente', 'Date', 'Produit', 'Prix $', 'Net $', 'Source', 'Support', 'Campagne', 'Page', 'Nature', 'Remboursée'], rows, truncated: !!(rep && rep.next_cursor && pages >= 4)};
  }
});

dash.draw('gventes', (tbody) => {
  const d = dash.data('gumroad_ventes');
  tbody.replaceChildren();
  if (d.status !== 'ok') return;
  const rows = Array.isArray(d.data) ? d.data : [];
  const champs = ['Date', 'Produit', 'Prix $', 'Source', 'Support', 'Campagne', 'Page', 'Nature'];
  if (!rows.length) {
    const tr = document.createElement('tr'); const td = document.createElement('td');
    td.colSpan = champs.length; td.className = 'rq-nil'; td.textContent = 'Aucune vente sur la période.';
    tr.append(td); tbody.append(tr); return;
  }
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-key', encodeURIComponent(r.Vente));
    champs.forEach((k) => {
      const td = document.createElement('td');
      const v = r[k];
      if (k === 'Prix $') td.className = 'rq-num';
      if (v === null || v === undefined || v === '') { td.classList.add('rq-nil'); td.textContent = '·'; }
      else td.textContent = k === 'Prix $' ? window.rqFmt(v, 'Revenu $') : v;
      tr.append(td);
    });
    tbody.append(tr);
  });
});

dash.loader('abonnes', {
  description: "Transforme l'onglet Abonnés en lignes (une par réseau et par relevé) ; « Abonnés » devient un nombre. Les lignes sans date, sans réseau ou sans nombre sont ignorées.",
  fn: ({answer}) => {
    const a = answer && answer.content ? answer.content : answer;
    const values = (a && a.values) || [];
    if (!values.length) throw new Error("L'onglet Abonnés n'a renvoyé aucune ligne.");
    const head = values[0].map((h) => String(h).trim());
    const iD = head.indexOf('Relevé le'), iR = head.indexOf('Réseau'), iN = head.indexOf('Abonnés'), iS = head.indexOf('Source');
    const rows = values.slice(1).map((r) => {
      const n = Number(String(r[iN] == null ? '' : r[iN]).replace(/[\s  ]/g, '').replace(',', '.'));
      return {'Relevé le': r[iD] ? String(r[iD]) : null, 'Réseau': r[iR] ? String(r[iR]) : null, 'Abonnés': String(r[iN] == null ? '' : r[iN]).trim() === '' || !Number.isFinite(n) ? null : n, Source: r[iS] ? String(r[iS]) : null};
    }).filter((r) => r['Relevé le'] && r['Réseau'] && r['Abonnés'] != null);
    return {columns: ['Relevé le', 'Réseau', 'Abonnés', 'Source'], rows};
  }
});

dash.calc('abonnes_jour', {
  inputs: ['abonnes'],
  title: 'Abonnés par jour et par réseau',
  description: "Pour chaque jour du premier au dernier relevé : dernier nombre d'abonnés relevé pour chaque réseau à la fin du jour (un jour sans relevé reprend la valeur précédente ; avant le premier relevé d'un réseau, pas de valeur).",
  fn: (abonnes) => {
    const lignes = abonnes.slice().sort((a, b) => String(a['Relevé le']).localeCompare(String(b['Relevé le'])));
    if (!lignes.length) return [];
    const jourDe = (r) => String(r['Relevé le']).slice(0, 10);
    const ordre = ['LinkedIn', 'Instagram', 'YouTube', 'TikTok', 'X'];
    const reseaux = ordre.filter((n) => lignes.some((r) => r['Réseau'] === n)).concat([...new Set(lignes.map((r) => r['Réseau']))].filter((n) => !ordre.includes(n)));
    const fin = Date.parse(jourDe(lignes[lignes.length - 1]) + 'T00:00:00Z');
    const etat = {}, sortie = [];
    let i = 0;
    for (let t = Date.parse(jourDe(lignes[0]) + 'T00:00:00Z'); t <= fin; t += 86400000) {
      const jour = new Date(t).toISOString().slice(0, 10);
      while (i < lignes.length && jourDe(lignes[i]) <= jour) { const r = lignes[i++]; etat[r['Réseau']] = r['Abonnés']; }
      reseaux.forEach((n) => { if (etat[n] != null) sortie.push({Jour: jour, 'Réseau': n, 'Abonnés': etat[n]}); });
    }
    return sortie;
  }
});

dash.calc('abonnes_derniers', {
  inputs: ['abonnes_jour'],
  title: 'Abonnés actuels et variation sur 7 jours',
  description: "Pour chaque réseau : abonnés du dernier jour relevé, et écart avec le même réseau 7 jours plus tôt (vide s'il n'y a pas encore 7 jours de relevés).",
  fn: (jours) => {
    const reseaux = [...new Set(jours.map((r) => r['Réseau']))];
    return reseaux.map((n) => {
      const l = jours.filter((r) => r['Réseau'] === n);
      const dernier = l[l.length - 1];
      const ref = new Date(Date.parse(dernier.Jour + 'T00:00:00Z') - 7 * 86400000).toISOString().slice(0, 10);
      const avant = l.find((r) => r.Jour === ref);
      return {'Réseau': n, Jour: dernier.Jour, 'Abonnés': dernier['Abonnés'], 'Variation 7 j': avant ? dernier['Abonnés'] - avant['Abonnés'] : null};
    });
  }
});

dash.draw('abonnes-liste', (ul) => {
  const d = dash.data('abonnes_derniers');
  ul.replaceChildren();
  const vide = (t) => { const li = document.createElement('li'); li.className = 'rq-abo-vide'; li.textContent = t; ul.append(li); };
  if (d.status === 'error') { vide("Échec du chargement de l'onglet Abonnés."); return; }
  if (d.status !== 'ok') return;
  const rows = Array.isArray(d.data) ? d.data : [];
  if (!rows.length) { vide("Aucun relevé d'abonnés pour l'instant : la courbe démarrera au premier relevé d'Instinct."); return; }
  rows.forEach((r) => {
    const li = document.createElement('li');
    const t = document.createElement('span'); t.className = 'rq-abo-r';
    const pastille = document.createElement('span'); pastille.className = 'rq-dot'; pastille.style.background = window.rqColor(r['Réseau']);
    t.append(pastille, document.createTextNode(r['Réseau']));
    const n = document.createElement('span'); n.className = 'rq-abo-n'; n.textContent = window.rqFmt(r['Abonnés']);
    n.setAttribute('data-source', 'abonnes_derniers'); n.setAttribute('data-field', 'Abonnés'); n.setAttribute('data-where', 'Réseau=' + encodeURIComponent(r['Réseau']));
    const v = document.createElement('span'); v.className = 'rq-abo-v';
    const x = r['Variation 7 j'];
    if (x == null) v.textContent = 'au ' + r.Jour.slice(8, 10) + '/' + r.Jour.slice(5, 7) + ' · variation sur 7 jours à venir';
    else { v.textContent = (x > 0 ? '+' : x < 0 ? '−' : '') + window.rqFmt(Math.abs(x)) + ' en 7 jours'; v.classList.add(x > 0 ? 'hausse' : x < 0 ? 'baisse' : 'stable'); }
    li.append(t, n, v);
    ul.append(li);
  });
});

dash.draw('abonnes', (el) => {
  const d = dash.data('abonnes_jour');
  el.replaceChildren();
  const message = (texte) => { const p = document.createElement('p'); p.className = 'rq-empty'; p.textContent = texte; el.append(p); };
  if (d.status === 'error') { message("Échec du chargement de l'onglet Abonnés."); return; }
  if (d.status !== 'ok') { el.textContent = '—'; return; }
  const rows = Array.isArray(d.data) ? d.data : [];
  if (!rows.length) { message("Aucun relevé d'abonnés pour l'instant."); return; }
  const jours = [...new Set(rows.map((r) => r.Jour))];
  const nets = [...new Set(rows.map((r) => r['Réseau']))];
  const W = Math.max(260, el.clientWidth || 600);
  const H = 240, top = 12, bottom = 24, right = 14;
  const max = d3.max(rows, (r) => r['Abonnés']) || 1;
  const y = d3.scaleLinear().domain([0, max]).nice(5).range([H - bottom, top]);
  const fmtY = (v) => new Intl.NumberFormat('fr-FR', {notation: v >= 10000 ? 'compact' : 'standard'}).format(v);
  const ticks = y.ticks(5).filter((v) => Number.isInteger(v));
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || 'Abonnés');
  const probe = svg.append('g');
  let left = 0;
  ticks.forEach((v) => { const t = probe.append('text').attr('class', 'rq-lbl').text(fmtY(v)); left = Math.max(left, t.node().getComputedTextLength()); });
  probe.remove();
  left = Math.ceil(left) + 10;
  const x = d3.scalePoint().domain(jours).range([left + 6, W - right - 6]).align(0.5);
  const fmtJour = (j) => j.slice(8, 10) + '/' + j.slice(5, 7);
  svg.append('g').attr('transform', `translate(${left},0)`).call(d3.axisLeft(y).tickValues(ticks).tickSize(-(W - left - right)).tickFormat(fmtY));
  const pas = Math.max(1, Math.ceil(jours.length / Math.max(2, Math.floor((W - left - right) / 52))));
  svg.append('g').attr('transform', `translate(0,${H - bottom})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(8).tickValues(jours.filter((j, i) => i % pas === 0 || i === jours.length - 1)).tickFormat(fmtJour));
  const ligne = d3.line().x((r) => x(r.Jour)).y((r) => y(r['Abonnés'])).curve(d3.curveLinear);
  nets.forEach((n) => {
    const serie = rows.filter((r) => r['Réseau'] === n);
    svg.append('path').datum(serie).attr('d', ligne).style('fill', 'none').style('stroke', window.rqColor(n)).style('stroke-width', 2.5);
    const der = serie[serie.length - 1];
    svg.append('circle').attr('cx', x(der.Jour)).attr('cy', y(der['Abonnés'])).attr('r', 4.5)
      .style('fill', window.rqColor(n)).style('stroke', 'var(--surface)').style('stroke-width', 2);
  });
  const guide = svg.append('line').attr('class', 'rq-guide').attr('y1', top).attr('y2', H - bottom).style('display', 'none');
  const tip = document.createElement('div');
  tip.className = 'rq-tip';
  tip.hidden = true;
  el.append(tip);
  svg.append('rect').attr('x', left).attr('y', 0).attr('width', W - left).attr('height', H).style('fill', 'transparent')
    .on('pointerenter pointermove', (ev) => {
      const box = el.getBoundingClientRect();
      const px = (ev.clientX - box.left) * (W / box.width);
      let j = jours[0], dist = Infinity;
      jours.forEach((k) => { const dd = Math.abs(x(k) - px); if (dd < dist) { dist = dd; j = k; } });
      guide.attr('x1', x(j)).attr('x2', x(j)).style('display', null);
      tip.replaceChildren();
      const s = document.createElement('strong'); s.textContent = 'Abonnés au ' + fmtJour(j); tip.append(s);
      rows.filter((r) => r.Jour === j).sort((a, b) => b['Abonnés'] - a['Abonnés']).forEach((r) => {
        const sp = document.createElement('span');
        const p = document.createElement('i'); p.style.background = window.rqColor(r['Réseau']);
        const v = document.createElement('em'); v.textContent = window.rqFmt(r['Abonnés']);
        sp.append(p, document.createTextNode(r['Réseau']), v); tip.append(sp);
      });
      tip.hidden = false;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      const cx = ev.clientX - box.left, cy = ev.clientY - box.top;
      tip.style.left = Math.max(0, Math.min(cx + 14, box.width - tw)) + 'px';
      tip.style.top = Math.max(0, Math.min(cy - th - 10, box.height - th)) + 'px';
    })
    .on('pointerleave', () => { tip.hidden = true; guide.style('display', 'none'); });
});
