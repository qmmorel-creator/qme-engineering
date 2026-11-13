// MétréPro · interface. Socle commun : templates/commun/socle.js. Règles de calcul : regles.js (window.MTR).
// Aucune lecture de plan, aucune analyse BIM : toutes les quantités viennent de dimensions saisies.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.MTR;
  const O = window.QME_OUTILS;
  let S = null;
  const esc = window.QME_SOCLE.esc;
  const uid = () => O.nouvelId();
  const U = (u) => R.nomUnite(u);
  const decimales = (u) => (u === 'm3' || u === 't' ? 3 : 2);
  const q = (n, u) => `${O.fmtNombre(n, { dec: decimales(u) })} ${U(u)}`;
  const nomFamille = (id) => R.nomFamille(id);
  const lireDim = (v) => O.lireNombre(v);

  // État d'interface (non enregistré)
  const ui = { sousVue: 'familles', detailZones: true, avecCommande: true, rechercheBiblio: '', familleBiblio: 'toutes' };

  const projet = () => S.E.projets.find((p) => p.id === S.E.projetActif) || null;
  const ouvrage = (id) => R.ouvrageDe(S.E.bibliotheque, id);
  const variante = (p, id) => p.variantes.find((v) => v.id === id);

  // ---------- Données de démonstration (fictives) ----------
  function donneesDemo() {
    const e = R.etatVide();
    const t = O.iso(new Date());
    const L = (zoneId, ouvrageId, forme, dims, extra = {}) => ({ id: uid(), zoneId, ouvrageId, forme, dims, nombre: 1, deductions: [], perte: null, retenue: null, variantes: [], precision: '', note: '', ...extra });
    const fen = (n = 1) => ({ id: uid(), libelle: 'Fenêtre 1,20 × 1,35', nombre: n, a: 1.2, b: 1.35 });
    const porte = (n = 1) => ({ id: uid(), libelle: 'Porte 0,83 × 2,04', nombre: n, a: 0.83, b: 2.04 });
    const p1 = {
      id: uid(), nom: 'Rénovation d\'un appartement T3', client: 'Client fictif', adresse: 'Exemple, aucune adresse réelle', date: O.ajout(t, -6),
      note: 'Projet d\'exemple : dimensions et ouvrages fictifs.',
      hypotheses: [
        { id: uid(), texte: 'Hauteur sous plafond 2,50 m dans toutes les pièces, mesurée sur place.' },
        { id: uid(), texte: 'Menuiseries existantes conservées ; tableaux de fenêtres non peints (déduits).' },
        { id: uid(), texte: 'Variante A : carrelage dans le séjour ; variante B : parquet flottant.' },
        { id: uid(), texte: 'Sous-couche d\'impression sur tous les murs (plâtre neuf ou repris).' },
      ],
      variantes: [{ id: 'va', nom: 'A · Carrelage' }, { id: 'vb', nom: 'B · Parquet' }], varianteActive: 'va', zones: [], lignes: [],
    };
    const z = (nom, note = '') => { const x = { id: uid(), nom, note }; p1.zones.push(x); return x.id; };
    const sej = z('Séjour', '4,80 × 3,90 m'), ch1 = z('Chambre 1', '3,60 × 3,20 m'), sde = z('Salle d\'eau', '2,10 × 1,80 m'), cou = z('Couloir', '4,20 × 1,10 m'), cel = z('Cellier', 'À métrer lors de la prochaine visite');
    p1.lignes.push(
      L(sej, 'carrelage-sol', 'rect', { L: 4.8, l: 3.9 }, { variantes: ['va'], precision: 'Grès cérame 60 × 60' }),
      L(sej, 'parquet', 'rect', { L: 4.8, l: 3.9 }, { variantes: ['vb'], precision: 'Chêne contrecollé' }),
      L(sej, 'plinthes', 'perimetre', { L: 4.8, l: 3.9 }, { deductions: [{ id: uid(), libelle: 'Passage de porte', nombre: 2, a: 0.83 }] }),
      L(sej, 'peinture-murs', 'mur', { L: 17.4, H: 2.5 }, { deductions: [fen(2), porte(2)] }),
      L(sej, 'peinture-plafond', 'rect', { L: 4.8, l: 3.9 }),
      L(sej, 'prise', 'unite', {}, { nombre: 7 }),
      L(sej, 'point-lumineux', 'unite', {}, { nombre: 2 }),
      L(ch1, 'parquet', 'rect', { L: 3.6, l: 3.2 }, { retenue: 13.2, note: 'Arrondi à 6 paquets entiers après visite (stock du fournisseur).' }),
      L(ch1, 'plinthes', 'perimetre', { L: 3.6, l: 3.2 }, { deductions: [{ id: uid(), libelle: 'Passage de porte', nombre: 1, a: 0.83 }] }),
      L(ch1, 'peinture-murs', 'mur', { L: 13.6, H: 2.5 }, { deductions: [fen(1), porte(1)] }),
      L(ch1, 'peinture-plafond', 'rect', { L: 3.6, l: 3.2 }),
      L(ch1, 'cloison72', 'mur', { L: 2.4, H: 2.5 }, { precision: 'Placard, cloison neuve', deductions: [porte(1)] }),
      L(ch1, 'prise', 'unite', {}, { nombre: 4 }),
      L(sde, 'carrelage-sol', 'rect', { L: 2.1, l: 1.8 }, { perte: 15, precision: 'Petit format, nombreuses découpes', note: 'Perte portée à 15 % : pièce petite avec receveur et WC.' }),
      L(sde, 'faience', 'mur', { L: 7.8, H: 2.2 }, { deductions: [porte(1)], precision: 'Toute hauteur sur 2,20 m' }),
      L(sde, 'peinture-plafond', 'rect', { L: 2.1, l: 1.8 }),
      L(sde, 'sanitaire', 'unite', {}, { nombre: 3, precision: 'Receveur, vasque, WC suspendu' }),
      L(sde, 'per', 'lineaire', { L: 14 }, { precision: 'Eau froide et eau chaude' }),
      L(sde, 'evacuation', 'lineaire', { L: 6.5 }),
      L(cou, 'carrelage-sol', 'rect', { L: 4.2, l: 1.1 }, { variantes: ['va'] }),
      L(cou, 'parquet', 'rect', { L: 4.2, l: 1.1 }, { variantes: ['vb'] }),
      L(cou, 'peinture-murs', 'mur', { L: 10.6, H: 2.5 }, { deductions: [porte(4)] }),
      L(cou, 'protection', 'direct', { q: 25 }, { note: 'Protection de tout le parcours depuis l\'entrée : estimation forfaitaire sur place.' }),
    );
    const p2 = {
      id: uid(), nom: 'Garage et terrasse', client: 'Client fictif', adresse: '', date: O.ajout(t, -2), note: 'Exemple fictif de gros œuvre.',
      hypotheses: [{ id: uid(), texte: 'Sol de bonne tenue, foisonnement des terres pris à 1,25.' }, { id: uid(), texte: 'Dalle de 12 cm sur hérisson de 15 cm.' }],
      variantes: [{ id: 'base', nom: 'Solution de base' }], varianteActive: 'base', zones: [], lignes: [],
    };
    const zg = { id: uid(), nom: 'Garage 6,00 × 3,50 m', note: '' }, zt = { id: uid(), nom: 'Terrasse', note: '' };
    p2.zones.push(zg, zt);
    p2.lignes.push(
      L(zg.id, 'fouille', 'volume', { L: 19, l: 0.5, e: 60 }, { precision: 'Périmètre des murs' }),
      L(zg.id, 'semelle', 'volume', { L: 19, l: 0.5, e: 35 }),
      L(zg.id, 'deblai', 'volume', { L: 6, l: 3.5, e: 30 }),
      L(zg.id, 'herisson', 'volume', { L: 6, l: 3.5, e: 15 }),
      L(zg.id, 'polyane', 'rect', { L: 6, l: 3.5 }),
      L(zg.id, 'treillis', 'rect', { L: 6, l: 3.5 }),
      L(zg.id, 'dalle', 'volume', { L: 6, l: 3.5, e: 12 }),
      L(zg.id, 'parpaing20', 'mur', { L: 19, H: 2.5 }, { deductions: [{ id: uid(), libelle: 'Porte de garage 2,40 × 2,00', nombre: 1, a: 2.4, b: 2 }, { id: uid(), libelle: 'Porte de service', nombre: 1, a: 0.9, b: 2.05 }] }),
      L(zg.id, 'linteau', 'unite', {}, { nombre: 2 }),
      L(zt.id, 'paves', 'rect', { L: 5, l: 4 }),
      L(zt.id, 'bordure', 'perimetre', { L: 5, l: 4 }, { deductions: [{ id: uid(), libelle: 'Côté contre la maison', nombre: 1, a: 5 }] }),
      L(zt.id, 'paves', 'disque', { d: 2.4 }, { precision: 'Rond devant la porte' }),
    );
    e.projets = [p1, p2].map(R.normaliserProjet);
    e.projetActif = e.projets[0].id;
    return e;
  }

  // ---------- Premier lancement ----------
  function accueil() {
    return `
      <p class="surtitre">Bienvenue</p>
      <h1>Ton premier projet, en une minute.</h1>
      <p class="intro">Donne un nom au chantier et liste ses zones (pièces, niveaux, bâtiments). Tu saisiras ensuite les dimensions ligne par ligne : quantités, pertes et commande se calculent.</p>
      <form id="form-accueil" class="formulaire-accueil" novalidate>
        <label class="champ">Nom du projet<input name="nom" required maxlength="120" placeholder="Ex. : Rénovation de la maison Martin"></label>
        <label class="champ">Client <small>Facultatif.</small><input name="client" maxlength="120"></label>
        <label class="champ">Zones de départ <small>Une par ligne. Tu pourras en ajouter.</small><textarea name="zones" rows="4">Séjour\nChambre\nSalle d'eau</textarea></label>
        <label class="case"><input type="checkbox" name="exemple"> Ajouter aussi les deux projets d'exemple (fictifs, supprimables)</label>
        <p class="erreur" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer le projet</button></div>
      </form>
      <ol class="conseils" style="margin-top:32px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>`;
  }
  function apresAccueil() {
    S.$('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const nom = O.texte(f.get('nom'), 120);
      if (!nom) { e.target.querySelector('.erreur').textContent = 'Donne un nom au projet.'; return; }
      const etat = R.etatVide();
      const zones = String(f.get('zones') || '').split('\n').map((z) => O.texte(z, 80)).filter(Boolean).slice(0, 50).map((z) => ({ id: uid(), nom: z }));
      const p = R.normaliserProjet({ id: uid(), nom, client: f.get('client'), date: O.iso(new Date()), zones });
      etat.projets.push(p);
      if (f.get('exemple')) etat.projets.push(...donneesDemo().projets);
      etat.projetActif = p.id;
      S.terminerAccueil(etat, { vue: 'metre', message: `Projet « ${nom} » créé. Ajoute ta première ligne de métré.` });
    });
  }

  // ---------- Vues ----------
  const vueVideProjet = () => `<div class="vide-etat">${S.FORME_VIDE}<div><h3>Aucun projet ouvert</h3><p>Crée un projet ou ouvre-en un depuis l'onglet Projets.</p><div class="actions"><button class="btn primaire" data-action="projet-nouveau">${S.ICONES.plus}Nouveau projet</button><button class="btn" data-action="vue" data-vue="projets">Voir les projets</button></div></div></div>`;
  const AVERTISSEMENT = `<p class="mention avertissement">Aide au métré : les quantités dépendent des dimensions et des ratios saisis. Elles ne remplacent ni un métreur, ni les règles de l'art (DTU), ni les fiches techniques des produits. ${esc(B.sourceRatios)}</p>`;

  function vueProjets() {
    const ps = S.E.projets;
    const cartes = ps.map((p) => {
      const s = R.synthese(p, S.E.bibliotheque);
      return `<div class="carte-el carte-projet ${p.id === S.E.projetActif ? 'actif' : ''}">
        <button class="lien-ligne" data-action="projet-ouvrir" data-id="${p.id}"><b>${esc(p.nom)}</b><span>${esc([p.client, p.date ? O.versDate(p.date).toLocaleDateString('fr-FR') : ''].filter(Boolean).join(' · ') || 'Sans client')}</span></button>
        <span class="detail">${S.pluriel(p.zones.length, 'zone')} · ${S.pluriel(p.lignes.length, 'ligne')} · ${S.pluriel(p.variantes.length, 'variante')}</span>
        <span class="etiquettes">${p.id === S.E.projetActif ? '<span class="etiquette ciel">Ouvert</span>' : ''}${s.erreurs.length ? `<span class="etiquette rouge">${S.pluriel(s.erreurs.length, 'ligne à corriger', 'lignes à corriger')}</span>` : ''}</span>
        <div class="rang-boutons"><button class="btn petit primaire" data-action="projet-ouvrir" data-id="${p.id}">Ouvrir le métré</button><button class="btn petit" data-action="projet-modifier" data-id="${p.id}">Modifier</button><button class="btn petit" data-action="projet-dupliquer" data-id="${p.id}">Dupliquer</button></div>
      </div>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Projets</h1><p>Un projet regroupe des zones, des lignes de métré, des variantes et des hypothèses. Ouvre-le pour métrer.</p></div>
        <div class="actions"><button class="btn primaire" data-action="projet-nouveau">${S.ICONES.plus}Nouveau projet</button></div></div>
      ${ps.length ? `<div class="grille-cartes">${cartes}</div>` : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>Aucun projet</h3><p>Crée ton premier projet : nom, client, zones. Tu saisiras ensuite les dimensions.</p><div class="actions"><button class="btn primaire" data-action="projet-nouveau">${S.ICONES.plus}Nouveau projet</button><button class="btn" data-action="charger-exemple">Ajouter les projets d'exemple</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  function selecteurVariante(p, action = 'variante') {
    if (p.variantes.length < 2) return '';
    return `<div class="onglets-internes" role="group" aria-label="Variante affichée">${p.variantes.map((v) => `<button data-action="${action}" data-id="${v.id}" aria-pressed="${v.id === p.varianteActive}">${esc(v.nom)}</button>`).join('')}</div>`;
  }

  function etiquettesLigne(p, l, c) {
    const t = [];
    if (!c.ok) t.push('<span class="etiquette rouge">À corriger</span>');
    if (l.variantes.length) t.push(...l.variantes.map((id) => `<span class="etiquette ciel">${esc(variante(p, id)?.nom || '')}</span>`));
    if (l.perte !== null) t.push(`<span class="etiquette jaune">Perte ${O.fmtNombre(l.perte)} %</span>`);
    if (l.retenue !== null) t.push('<span class="etiquette rose">Quantité retenue forcée</span>');
    if (!ouvrage(l.ouvrageId)) t.push('<span class="etiquette rouge">Ouvrage absent de la bibliothèque</span>');
    if (l.note) t.push(`<span class="etiquette sable" title="${esc(l.note)}">Note</span>`);
    return t.join('');
  }

  function ligneMetre(p, l) {
    const o = ouvrage(l.ouvrageId);
    const c = R.calculerLigne(l, o);
    const horsVariante = !R.dansVariante(l, p.varianteActive);
    return `<li class="ligne ligne-metre ${c.ok ? '' : 'alerte-rouge'} ${horsVariante ? 'hors-variante' : ''}">
      <button class="ligne-info" data-action="ligne-ouvrir" data-id="${l.id}">
        <b>${esc(o?.nom || 'Ouvrage supprimé')}${l.precision ? ` · ${esc(l.precision)}` : ''}</b>
        <span class="formule">${c.ok ? esc(c.formule) : esc(c.erreur)}</span>
        <span class="ligne-etiquettes">${etiquettesLigne(p, l, c)}${horsVariante ? '<span class="etiquette">Hors variante affichée</span>' : ''}</span>
      </button>
      <div class="ligne-droite">
        ${c.ok ? `<span class="ligne-cout"><b>${q(c.retenue, c.unite)}</b><small>théorique ${O.fmtNombre(c.theorique, { dec: decimales(c.unite) })}${c.perte ? ` · perte ${O.fmtNombre(c.perte)} %` : ''}</small></span>` : '<span class="ligne-proch">Non comptée</span>'}
        <span class="rang-boutons"><button class="btn petit" data-action="ligne-dupliquer" data-id="${l.id}" aria-label="Dupliquer la ligne">Dupliquer</button></span>
      </div>
    </li>`;
  }

  function vueMetre() {
    const p = projet();
    if (!p) return vueVideProjet();
    const s = R.synthese(p, S.E.bibliotheque);
    const sansZone = p.lignes.filter((l) => !p.zones.some((z) => z.id === l.zoneId));
    const blocs = p.zones.map((z) => {
      const ls = p.lignes.filter((l) => l.zoneId === z.id);
      return `<section class="zone-bloc">
        <h2 class="titre-cat"><button class="lien-titre" data-action="zone-modifier" data-id="${z.id}">${esc(z.nom)}</button><span>${S.pluriel(ls.length, 'ligne')}${z.note ? ` · ${esc(z.note)}` : ''}</span><button class="btn petit" data-action="ligne-nouvelle" data-zone="${z.id}">${S.ICONES.plus}Ligne</button></h2>
        ${ls.length ? `<ul class="lignes-abos">${ls.map((l) => ligneMetre(p, l)).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Zone vide</h3><p>Ajoute une ligne : choisis l'ouvrage, la forme de calcul et saisis les dimensions.</p><div class="actions"><button class="btn petit primaire" data-action="ligne-nouvelle" data-zone="${z.id}">${S.ICONES.plus}Ajouter une ligne</button></div></div></div>`}
      </section>`;
    }).join('');
    return `
      <p class="fil-app"><button data-action="vue" data-vue="projets">Projets</button><span>›</span><b>${esc(p.nom)}</b></p>
      <div class="vue-tete"><div><h1>Métré</h1><p>Chaque ligne affiche sa formule développée et sa quantité retenue (théorique + pertes, ou valeur forcée). ${s.erreurs.length ? `<b class="texte-rouge">${S.pluriel(s.erreurs.length, 'ligne est à corriger', 'lignes sont à corriger')} : elles ne comptent pas dans les quantités.</b>` : ''}</p></div>
        <div class="actions"><button class="btn" data-action="zone-nouvelle">${S.ICONES.plus}Zone</button><button class="btn" data-action="variantes">Variantes</button><button class="btn" data-action="hypotheses">Hypothèses (${p.hypotheses.length})</button><button class="btn primaire" data-action="ligne-nouvelle">${S.ICONES.plus}Ligne</button></div></div>
      ${selecteurVariante(p)}
      ${p.zones.length ? blocs : `<div class="vide-etat">${S.FORME_VIDE}<div><h3>Aucune zone</h3><p>Une zone est une pièce, un niveau, un bâtiment ou un lot. Crée la première pour y ranger tes lignes.</p><div class="actions"><button class="btn primaire" data-action="zone-nouvelle">${S.ICONES.plus}Créer une zone</button></div></div></div>`}
      ${sansZone.length ? `<section class="zone-bloc"><h2 class="titre-cat">Sans zone<span>${S.pluriel(sansZone.length, 'ligne')}</span></h2><ul class="lignes-abos">${sansZone.map((l) => ligneMetre(p, l)).join('')}</ul></section>` : ''}
      ${AVERTISSEMENT}`;
  }

  function tuilesSynthese(p, s) {
    const zero = s.composants.filter((k) => k.besoin > 0);
    return `<div class="tuiles">
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Lignes comptées</p><b>${s.lignes.length - s.erreurs.length}</b><span>sur ${S.pluriel(s.lignes.length, 'ligne')} de la variante</span></div>
      <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Ouvrages</p><b>${s.ouvrages.length}</b><span>en ${S.pluriel(s.familles.length, 'famille')} de travaux</span></div>
      <div class="tuile" style="--c:var(--encre)"><p class="surtitre">Composants</p><b>${zero.length}</b><span>à commander</span></div>
      <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">À corriger</p><b>${s.erreurs.length}</b><span>${s.erreurs.length ? 'lignes exclues des totaux' : 'aucune ligne en erreur'}</span></div>
    </div>`;
  }

  function vueQuantites() {
    const p = projet();
    if (!p) return vueVideProjet();
    const s = R.synthese(p, S.E.bibliotheque);
    const sous = [['familles', 'Par famille'], ['commande', 'À commander'], ...(p.variantes.length > 1 ? [['comparaison', 'Comparer les variantes']] : [])];
    if (!sous.some(([id]) => id === ui.sousVue)) ui.sousVue = 'familles';
    let corps = '';
    if (!s.lignes.length) corps = `<div class="vide-etat petit"><div><h3>Rien à totaliser</h3><p>Ajoute des lignes dans l'onglet Métré.</p><div class="actions"><button class="btn petit" data-action="vue" data-vue="metre">Aller au métré</button></div></div></div>`;
    else if (ui.sousVue === 'familles') {
      corps = s.familles.map((g) => `<h2 class="titre-section">${esc(nomFamille(g.famille))}<span>${S.pluriel(g.ouvrages.length, 'ouvrage')}</span></h2>
        <div class="defile"><table class="tableau compact"><thead><tr><th>Ouvrage</th><th class="nb">Théorique</th><th class="nb">Avec pertes</th><th class="nb">Retenu</th><th class="nb">Écart retenu − théorique</th><th class="nb">Lignes</th></tr></thead>
        <tbody>${g.ouvrages.map((o) => `<tr><td>${esc(o.nom)}</td><td class="nb">${q(o.theorique, o.unite)}</td><td class="nb">${q(o.avecPertes, o.unite)}</td><td class="nb"><b>${q(o.retenue, o.unite)}</b></td><td class="nb ${o.ecart > 0 ? 'ecart-plus' : o.ecart < 0 ? 'ecart-moins' : ''}">${o.ecart > 0 ? '+' : ''}${O.fmtNombre(o.ecart, { dec: decimales(o.unite) })}${o.theorique ? ` (${o.ecart > 0 ? '+' : ''}${O.fmtNombre(O.arrondi((o.ecart / o.theorique) * 100, 1))} %)` : ''}</td><td class="nb">${o.nbLignes}</td></tr>`).join('')}</tbody></table></div>`).join('');
    } else if (ui.sousVue === 'commande') {
      const ks = s.composants;
      corps = ks.length ? `<p class="aide">Besoin = quantité retenue de chaque ouvrage × ratio du composant, additionné sur tout le projet, puis arrondi au conditionnement supérieur. Les ouvrages sans composant (unités posées) n'apparaissent pas ici.</p>
        <div class="defile"><table class="tableau compact"><thead><tr><th>Composant</th><th class="nb">Besoin</th><th>Conditionnement</th><th class="nb">Nombre</th><th class="nb">À commander</th><th class="nb">Surplus</th><th>Utilisé par</th></tr></thead>
        <tbody>${B.familles.map((fa) => { const lk = ks.filter((k) => k.famille === fa.id); return lk.length ? `<tr class="sous-titre"><td colspan="7">${esc(fa.nom)}</td></tr>${lk.map((k) => `<tr><td>${esc(k.nom)}</td><td class="nb">${q(k.besoin, k.unite)}</td><td>${esc(k.uc || 'au détail')}</td><td class="nb">${k.nbCond ?? '–'}</td><td class="nb"><b>${q(k.commande, k.unite)}</b></td><td class="nb">${O.fmtNombre(k.surplus, { dec: decimales(k.unite) })}</td><td class="mini">${esc(k.sources.join(', '))}</td></tr>`).join('')}` : ''; }).join('')}</tbody></table></div>`
        : '<div class="vide-etat petit"><div><h3>Aucun composant</h3><p>Les ouvrages de ce projet n\'ont pas de composants dans la bibliothèque.</p></div></div>';
    } else {
      const c = R.comparaison(p, S.E.bibliotheque);
      corps = `<p class="aide">Quantités retenues de chaque ouvrage dans chaque variante. Les lignes qui diffèrent sont surlignées.</p>
        <div class="defile"><table class="tableau compact"><thead><tr><th>Ouvrage</th>${c.variantes.map((v) => `<th class="nb">${esc(v.nom)}</th>`).join('')}</tr></thead>
        <tbody>${c.ouvrages.map((o) => `<tr class="${o.differe ? 'differe' : ''}"><td>${esc(o.nom)} <span class="mini">${esc(nomFamille(o.famille))}</span></td>${o.q.map((x) => `<td class="nb">${x ? q(x, o.unite) : '–'}</td>`).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><td>Lignes à corriger</td>${c.erreurs.map((n) => `<td class="nb">${n}</td>`).join('')}</tr></tfoot></table></div>`;
    }
    return `
      <p class="fil-app"><button data-action="vue" data-vue="projets">Projets</button><span>›</span><b>${esc(p.nom)}</b></p>
      <div class="vue-tete"><div><h1>Quantités</h1><p>Totaux de la variante <b>${esc(variante(p, s.varianteId)?.nom || '')}</b> : théorique, avec pertes, retenu, puis composants à commander.</p></div>
        <div class="actions"><button class="btn" data-action="csv-commande">À commander (CSV)</button><button class="btn" data-action="csv-metre">Métré détaillé (CSV)</button></div></div>
      ${selecteurVariante(p)}
      ${tuilesSynthese(p, s)}
      <div class="onglets-internes" role="group" aria-label="Affichage" style="margin-top:24px">${sous.map(([id, nom]) => `<button data-action="sous-vue" data-id="${id}" aria-pressed="${ui.sousVue === id}">${nom}</button>`).join('')}</div>
      ${corps}
      ${AVERTISSEMENT}`;
  }

  function vueBordereau() {
    const p = projet();
    if (!p) return vueVideProjet();
    const v = variante(p, p.varianteActive);
    const bd = R.bordereau(p, S.E.bibliotheque, p.varianteActive);
    const s = R.synthese(p, S.E.bibliotheque);
    const postes = bd.map((g) => `<tr class="sous-titre"><td>${g.numero}</td><td colspan="3">${esc(nomFamille(g.famille).toUpperCase())}</td></tr>${g.postes.map((x) => `<tr><td>${x.numero}</td><td>${esc(x.designation)}${ui.detailZones && x.zones.length > 1 ? `<div class="mini">${x.zones.map((z) => `${esc(z.zone)} : ${O.fmtNombre(z.q, { dec: decimales(x.unite) })}`).join(' · ')}</div>` : ui.detailZones ? `<div class="mini">${esc(x.zones[0]?.zone || '')}</div>` : ''}</td><td>${U(x.unite)}</td><td class="nb"><b>${O.fmtNombre(x.quantite, { dec: decimales(x.unite) })}</b></td></tr>`).join('')}`).join('');
    const commande = s.composants.filter((k) => k.besoin > 0);
    return `
      <p class="fil-app pas-imprimer"><button data-action="vue" data-vue="projets">Projets</button><span>›</span><b>${esc(p.nom)}</b></p>
      <div class="vue-tete pas-imprimer"><div><h1>Bordereau</h1><p>Bordereau quantitatif de la variante affichée, prêt à imprimer ou à exporter. Les quantités sont les quantités retenues.</p></div>
        <div class="actions"><button class="btn" data-action="csv-bordereau">Exporter (CSV)</button><button class="btn primaire" data-action="imprimer">Imprimer</button></div></div>
      <div class="pas-imprimer">${selecteurVariante(p)}
        <div class="rang-boutons options-impression"><label class="case"><input type="checkbox" data-action="opt-zones" ${ui.detailZones ? 'checked' : ''}> Détail par zone</label><label class="case"><input type="checkbox" data-action="opt-commande" ${ui.avecCommande ? 'checked' : ''}> Quantités à commander</label></div></div>
      <article class="document">
        <div class="entete-doc"><div><p class="surtitre">Bordereau quantitatif</p><h2>${esc(p.nom)}</h2><p class="mini">Variante : ${esc(v?.nom || '')} · édité le ${new Date().toLocaleDateString('fr-FR')}</p></div>
          <dl>${p.client ? `<dt>Client</dt><dd>${esc(p.client)}</dd>` : ''}${p.adresse ? `<dt>Adresse</dt><dd>${esc(p.adresse)}</dd>` : ''}${p.date ? `<dt>Date du projet</dt><dd>${O.versDate(p.date).toLocaleDateString('fr-FR')}</dd>` : ''}<dt>Lignes</dt><dd>${s.lignes.length - s.erreurs.length} comptées${s.erreurs.length ? `, ${s.erreurs.length} à corriger (exclues)` : ''}</dd></dl></div>
        ${p.hypotheses.length ? `<h3>Hypothèses</h3><ul class="puces">${p.hypotheses.map((h) => `<li>${esc(h.texte)}</li>`).join('')}</ul>` : ''}
        <h3>Postes</h3>
        ${bd.length ? `<div class="defile"><table class="tableau compact"><thead><tr><th>N°</th><th>Désignation</th><th>Unité</th><th class="nb">Quantité</th></tr></thead><tbody>${postes}</tbody></table></div>` : '<p class="aide">Aucune ligne comptée dans cette variante.</p>'}
        ${ui.avecCommande && commande.length ? `<h3>Quantités à commander</h3><div class="defile"><table class="tableau compact"><thead><tr><th>Composant</th><th class="nb">Besoin</th><th>Conditionnement</th><th class="nb">À commander</th></tr></thead><tbody>${commande.map((k) => `<tr><td>${esc(k.nom)}</td><td class="nb">${q(k.besoin, k.unite)}</td><td>${esc(k.nbCond ? `${k.nbCond} × ${k.uc}` : k.uc || 'au détail')}</td><td class="nb"><b>${q(k.commande, k.unite)}</b></td></tr>`).join('')}</tbody></table></div>` : ''}
        <p class="mention" style="margin-top:18px">Quantités établies à partir des dimensions saisies et des ratios de la bibliothèque de l'utilisateur ; elles sont à vérifier avant commande. Document établi avec MétréPro (QME).</p>
      </article>`;
  }

  function vueBibliotheque() {
    const rq = ui.rechercheBiblio.trim().toLowerCase();
    const liste = S.E.bibliotheque.filter((o) => (ui.familleBiblio === 'toutes' || o.famille === ui.familleBiblio) && (!rq || `${o.nom} ${o.note} ${o.composants.map((c) => c.nom).join(' ')}`.toLowerCase().includes(rq)));
    const groupes = B.familles.map((fa) => ({ fa, os: liste.filter((o) => o.famille === fa.id) })).filter((g) => g.os.length);
    return `
      <div class="vue-tete"><div><h1>Bibliothèque</h1><p>${S.pluriel(S.E.bibliotheque.length, 'ouvrage')} avec leur unité, leur perte par défaut et leurs composants. Tout est modifiable : adapte les ratios à tes produits et à tes habitudes.</p></div>
        <div class="actions"><button class="btn primaire" data-action="ouvrage-nouveau">${S.ICONES.plus}Nouvel ouvrage</button></div></div>
      <div class="outils-liste">
        <label class="champ"><span class="sr-only">Famille</span><select id="famille-biblio" data-action="famille-biblio"><option value="toutes">Toutes les familles</option>${B.familles.map((fa) => `<option value="${fa.id}" ${ui.familleBiblio === fa.id ? 'selected' : ''}>${esc(fa.nom)}</option>`).join('')}</select></label>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-biblio" type="search" placeholder="Rechercher un ouvrage ou un composant" value="${esc(ui.rechercheBiblio)}"></label>
      </div>
      ${groupes.length ? groupes.map(({ fa, os }) => `<section class="groupe-cat"><h2 class="titre-cat">${esc(fa.nom)}<span>${S.pluriel(os.length, 'ouvrage')}</span></h2><ul class="lignes-abos">${os.map((o) => {
        const n = R.usages(S.E, o.id);
        return `<li class="ligne"><button class="ligne-info" data-action="ouvrage-ouvrir" data-id="${o.id}"><b>${esc(o.nom)}</b><span class="ligne-detail">${U(o.unite)} · perte ${O.fmtNombre(o.perte)} % · ${o.composants.length ? o.composants.map((c) => esc(c.nom.split(' (')[0])).join(', ') : 'sans composant'}</span><span class="ligne-etiquettes">${o.perso ? '<span class="etiquette jaune">Modifié</span>' : ''}${n ? `<span class="etiquette ciel">${S.pluriel(n, 'ligne')}</span>` : ''}</span></button></li>`;
      }).join('')}</ul></section>`).join('') : `<div class="vide-etat petit"><div><h3>Aucun ouvrage ne correspond</h3><p>Change la famille ou la recherche.</p></div></div>`}
      <p class="mention avertissement">${esc(B.sourceRatios)}</p>`;
  }

  // ---------- Modales : projet, zone, variantes, hypothèses ----------
  function modaleProjet(id) {
    const p = id ? S.E.projets.find((x) => x.id === id) : null;
    const v = p || { nom: '', client: '', adresse: '', date: S.auj(), note: '' };
    S.ouvrirModale(p ? 'Modifier le projet' : 'Nouveau projet', `
      <label class="champ">Nom<input name="nom" required maxlength="120" value="${esc(v.nom)}"></label>
      <div class="rang-champs"><label class="champ">Client<input name="client" maxlength="120" value="${esc(v.client)}"></label><label class="champ">Date<input type="date" name="date" value="${v.date || ''}"></label></div>
      <label class="champ">Adresse du chantier <small>Facultative.</small><input name="adresse" maxlength="200" value="${esc(v.adresse)}"></label>
      <label class="champ">Note<textarea name="note" rows="3" maxlength="1000">${esc(v.note)}</textarea></label>
      ${p ? '' : '<label class="champ">Zones de départ <small>Une par ligne.</small><textarea name="zones" rows="3"></textarea></label>'}
      <p class="erreur" role="alert"></p>`,
    p ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') {
        if (!S.confirmer(`Supprimer le projet « ${p.nom} » et ses ${p.lignes.length} lignes ?`)) { S.garderModale(); return undefined; }
        S.retenir();
        S.E.projets = S.E.projets.filter((x) => x.id !== p.id);
        if (S.E.projetActif === p.id) S.E.projetActif = S.E.projets[0]?.id ?? null;
        S.sauver(); S.rendre(); S.toast(`Projet « ${p.nom} » supprimé.`, { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      }
      const nom = O.texte(f.get('nom'), 120);
      if (!nom) return 'Donne un nom au projet.';
      S.retenir();
      const champs = { nom, client: O.texte(f.get('client'), 120), adresse: O.texte(f.get('adresse'), 200), date: O.dateOuNull(f.get('date')), note: O.texte(f.get('note'), 1000) };
      if (p) Object.assign(p, champs);
      else {
        const zones = String(f.get('zones') || '').split('\n').map((z) => O.texte(z, 80)).filter(Boolean).map((z) => ({ id: uid(), nom: z }));
        const np = R.normaliserProjet({ id: uid(), ...champs, zones });
        S.E.projets.push(np); S.E.projetActif = np.id;
      }
      S.sauver();
      if (p) { S.rendre(); S.toast('Projet enregistré.'); } else { S.changerVue('metre'); S.toast(`Projet « ${nom} » créé.`); }
      return undefined;
    });
  }

  function modaleZone(id) {
    const p = projet();
    const z = id ? p.zones.find((x) => x.id === id) : null;
    const n = z ? p.lignes.filter((l) => l.zoneId === z.id).length : 0;
    S.ouvrirModale(z ? 'Modifier la zone' : 'Nouvelle zone', `
      <label class="champ">Nom<small>Pièce, niveau, bâtiment, lot…</small><input name="nom" required maxlength="80" value="${esc(z?.nom || '')}"></label>
      <label class="champ">Note <small>Facultative (dimensions relevées, état…).</small><input name="note" maxlength="300" value="${esc(z?.note || '')}"></label>
      <p class="erreur" role="alert"></p>`,
    z ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>` : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') {
        if (!S.confirmer(n ? `Supprimer la zone « ${z.nom} » et ses ${n} lignes ?` : `Supprimer la zone « ${z.nom} » ?`)) { S.garderModale(); return undefined; }
        S.retenir();
        p.zones = p.zones.filter((x) => x.id !== z.id);
        p.lignes = p.lignes.filter((l) => l.zoneId !== z.id);
        S.sauver(); S.rendre(); S.toast(`Zone « ${z.nom} » supprimée.`, { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      }
      const nom = O.texte(f.get('nom'), 80);
      if (!nom) return 'Donne un nom à la zone.';
      S.retenir();
      if (z) Object.assign(z, { nom, note: O.texte(f.get('note'), 300) });
      else p.zones.push({ id: uid(), nom, note: O.texte(f.get('note'), 300) });
      S.sauver(); S.rendre(); S.toast(z ? 'Zone enregistrée.' : `Zone « ${nom} » créée.`);
      return undefined;
    });
  }

  function modaleVariantes() {
    const p = projet();
    const lignesV = (id) => p.lignes.filter((l) => l.variantes.includes(id));
    S.ouvrirModale('Variantes', `
      <p class="aide">Une variante est une solution alternative (matériau, épaisseur, périmètre). Les lignes sans variante comptent dans toutes ; une ligne peut être réservée à une ou plusieurs variantes depuis sa fiche.</p>
      ${p.variantes.map((v, i) => `<div class="rang-champs variante-rang"><label class="champ">Variante ${i + 1}<input name="v-${v.id}" maxlength="60" value="${esc(v.nom)}"></label><span class="mini">${S.pluriel(lignesV(v.id).length, 'ligne propre', 'lignes propres')}</span>${p.variantes.length > 1 ? `<label class="case"><input type="checkbox" name="suppr-${v.id}"> Supprimer</label>` : ''}</div>`).join('')}
      ${p.variantes.length < 8 ? '<label class="champ">Ajouter une variante <small>Facultatif.</small><input name="nouvelle" maxlength="60" placeholder="Ex. : B · Isolation renforcée"></label>' : ''}
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const garder = p.variantes.filter((v) => !f.get(`suppr-${v.id}`));
      const nouvelle = O.texte(f.get('nouvelle'), 60);
      if (!garder.length && !nouvelle) return 'Garde au moins une variante.';
      for (const v of garder) if (!O.texte(f.get(`v-${v.id}`), 60)) return 'Chaque variante doit avoir un nom.';
      const supprimees = p.variantes.filter((v) => f.get(`suppr-${v.id}`));
      // Une ligne réservée uniquement aux variantes supprimées disparaît (elle ne doit pas devenir commune).
      const perdues = p.lignes.filter((l) => l.variantes.length && l.variantes.every((id) => supprimees.some((v) => v.id === id)));
      if (supprimees.length && !S.confirmer(`Supprimer ${S.pluriel(supprimees.length, 'variante')}${perdues.length ? ` et ${S.pluriel(perdues.length, 'ligne qui lui est propre', 'lignes qui leur sont propres')}` : ''} ?`)) return 'Suppression annulée : décoche « Supprimer ».';
      S.retenir();
      p.lignes = p.lignes.filter((l) => !perdues.includes(l));
      p.lignes.forEach((l) => { l.variantes = l.variantes.filter((id) => !supprimees.some((v) => v.id === id)); });
      p.variantes = garder.map((v) => ({ ...v, nom: O.texte(f.get(`v-${v.id}`), 60) }));
      if (nouvelle) p.variantes.push({ id: uid(), nom: nouvelle });
      if (!p.variantes.some((v) => v.id === p.varianteActive)) p.varianteActive = p.variantes[0].id;
      S.sauver(); S.rendre(); S.toast('Variantes enregistrées.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    });
  }

  function modaleHypotheses() {
    const p = projet();
    S.ouvrirModale('Hypothèses du projet', `
      <p class="aide">Ce que tu as supposé ou relevé pour établir le métré (hauteurs, épaisseurs, éléments conservés, exclusions). Elles sont imprimées en tête du bordereau.</p>
      <label class="champ">Une hypothèse par ligne<textarea name="h" rows="8" maxlength="12000">${esc(p.hypotheses.map((h) => h.texte).join('\n'))}</textarea></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      S.retenir();
      p.hypotheses = String(f.get('h') || '').split('\n').map((t) => O.texte(t, 300)).filter(Boolean).slice(0, 60).map((texte) => ({ id: uid(), texte }));
      S.sauver(); S.rendre(); S.toast(`${S.pluriel(p.hypotheses.length, 'hypothèse enregistrée', 'hypothèses enregistrées')}.`);
      return undefined;
    });
  }

  // ---------- Modale : ligne de métré ----------
  const optionsOuvrages = (choisi) => B.familles.map((fa) => {
    const os = S.E.bibliotheque.filter((o) => o.famille === fa.id);
    return os.length ? `<optgroup label="${esc(fa.nom)}">${os.map((o) => `<option value="${o.id}" ${o.id === choisi ? 'selected' : ''}>${esc(o.nom)} (${U(o.unite)})</option>`).join('')}</optgroup>` : '';
  }).join('');
  const formesPour = (o) => B.formes.filter((fo) => !o || fo.unite === null || fo.unite === o.unite);

  function champsDims(fo, l) {
    if (!fo.champs.length) return '<p class="mini">Pas de dimension : saisis seulement le nombre d\'unités.</p>';
    return `<div class="rang-champs">${fo.champs.map((c) => `<label class="champ">${B.champs[c].nom}${B.champs[c].unite ? ` (${B.champs[c].unite})` : ''}${c === 'e' ? '<small>En centimètres : 12 pour 12 cm.</small>' : ''}<input name="d-${c}" inputmode="decimal" autocomplete="off" value="${O.saisieNombre(l.dims?.[c])}" required></label>`).join('')}</div>`;
  }
  function blocDeductions(fo, l) {
    if (!fo.deduction) return '';
    const deds = l.deductions || [];
    const rang = (d) => `<div class="rang-ded" data-ded="${d.id}">
      <label class="champ">Libellé<input name="dl-${d.id}" maxlength="80" value="${esc(d.libelle)}" placeholder="${fo.deduction === 'surface' ? 'Fenêtre, porte…' : 'Passage de porte…'}"></label>
      <label class="champ">Nombre<input name="dn-${d.id}" inputmode="decimal" value="${O.saisieNombre(d.nombre ?? 1)}"></label>
      <label class="champ">${fo.deduction === 'surface' ? 'Largeur (m)' : 'Longueur (m)'}<input name="da-${d.id}" inputmode="decimal" value="${O.saisieNombre(d.a || null)}"></label>
      ${fo.deduction === 'surface' ? `<label class="champ">Hauteur (m)<input name="db-${d.id}" inputmode="decimal" value="${O.saisieNombre(d.b || null)}"></label>` : ''}
      <button class="btn-icone" type="button" data-action="ded-retirer" data-id="${d.id}" aria-label="Retirer la déduction">×</button></div>`;
    return `<fieldset class="champ cadre-champs"><legend>Déductions <small>${fo.deduction === 'surface' ? 'Ouvertures non traitées (fenêtres, portes) : nombre × largeur × hauteur.' : 'Longueurs à retirer (passages de porte) : nombre × longueur.'}</small></legend>
      <div id="deductions">${deds.map(rang).join('')}</div>
      <button class="btn petit" type="button" data-action="ded-ajouter">${S.ICONES.plus}Ajouter une déduction</button></fieldset>`;
  }

  // Lit le formulaire de la modale et reconstruit une ligne (sans l'enregistrer).
  function lireLigne(form, base) {
    const f = new FormData(form);
    const fo = R.forme(f.get('forme'));
    const dims = {};
    let illisible = null;
    for (const c of fo?.champs || []) {
      const brut = String(f.get(`d-${c}`) || '').trim();
      const v = lireDim(brut);
      if (brut && v === null) illisible = `${B.champs[c].nom} illisible : écris un nombre positif, par exemple 2,45.`;
      if (v !== null) dims[c] = v;
    }
    const deductions = [...form.querySelectorAll('[data-ded]')].map((r) => {
      const id = r.dataset.ded;
      return { id, libelle: O.texte(f.get(`dl-${id}`), 80), nombre: lireDim(f.get(`dn-${id}`)) ?? 0, a: lireDim(f.get(`da-${id}`)) ?? 0, b: lireDim(f.get(`db-${id}`)) ?? 0 };
    });
    const nombreBrut = String(f.get('nombre') || '').trim();
    const perteBrut = String(f.get('perte') || '').trim();
    const retenueBrut = String(f.get('retenue') || '').trim();
    const perte = perteBrut ? lireDim(perteBrut) : null;
    const retenue = retenueBrut ? lireDim(retenueBrut) : null;
    if (nombreBrut && lireDim(nombreBrut) === null) illisible = 'Nombre illisible.';
    if (perteBrut && (perte === null || perte > 100)) illisible = 'La perte doit être un pourcentage entre 0 et 100.';
    if (retenueBrut && retenue === null) illisible = 'Quantité retenue illisible : laisse vide pour la calculer.';
    const variantes = projet().variantes.filter((v) => f.get(`var-${v.id}`)).map((v) => v.id);
    return {
      ligne: { ...base, ouvrageId: f.get('ouvrage'), zoneId: f.get('zone') || null, precision: O.texte(f.get('precision'), 120), forme: f.get('forme'), dims, nombre: nombreBrut ? lireDim(nombreBrut) : 1, deductions, perte, retenue, variantes: variantes.length === projet().variantes.length ? [] : variantes, note: O.texte(f.get('note'), 400) },
      illisible,
    };
  }

  function modaleLigne(id, { zoneId = null, copie = null } = {}) {
    const p = projet();
    if (!p) return;
    const existante = id ? p.lignes.find((x) => x.id === id) : null;
    if (id && !existante) return;
    if (!p.zones.length && !existante) { S.toast('Crée d\'abord une zone.'); modaleZone(null); return; }
    const premier = S.E.bibliotheque[0];
    let l = structuredClone(existante || copie || { id: uid(), zoneId: zoneId || p.zones[0]?.id, ouvrageId: premier.id, forme: premier.forme, dims: {}, nombre: 1, deductions: [], perte: null, retenue: null, variantes: [], precision: '', note: '' });
    if (copie) l.id = uid();
    const rendreCorps = () => {
      const o = ouvrage(l.ouvrageId);
      const formes = formesPour(o);
      if (!formes.some((fo) => fo.id === l.forme)) l.forme = o?.forme || formes[0].id;
      const fo = R.forme(l.forme);
      return `
        <label class="champ">Ouvrage<select name="ouvrage" data-maj="ouvrage">${optionsOuvrages(l.ouvrageId)}${o ? '' : `<option value="${esc(l.ouvrageId)}" selected>Ouvrage supprimé</option>`}</select></label>
        ${o?.note ? `<p class="aide">${esc(o.note)}</p>` : ''}
        <div class="rang-champs">
          <label class="champ">Zone<select name="zone">${p.zones.map((z) => `<option value="${z.id}" ${z.id === l.zoneId ? 'selected' : ''}>${esc(z.nom)}</option>`).join('')}</select></label>
          <label class="champ">Précision <small>Facultative.</small><input name="precision" maxlength="120" value="${esc(l.precision)}" placeholder="Ex. : mur nord, grès 60 × 60"></label>
        </div>
        <label class="champ">Forme de calcul<select name="forme" data-maj="forme">${formes.map((x) => `<option value="${x.id}" ${x.id === l.forme ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        ${champsDims(fo, l)}
        <label class="champ">Nombre <small>Éléments identiques (2 murs pareils, 7 prises…).</small><input name="nombre" inputmode="decimal" value="${O.saisieNombre(l.nombre)}"></label>
        ${blocDeductions(fo, l)}
        <div class="rang-champs">
          <label class="champ">Perte (%) <small>Vide : ${O.fmtNombre(o?.perte ?? 0)} % de la bibliothèque.</small><input name="perte" inputmode="decimal" value="${O.saisieNombre(l.perte)}" placeholder="${O.fmtNombre(o?.perte ?? 0)}"></label>
          <label class="champ">Quantité retenue <small>Vide : théorique + pertes.</small><input name="retenue" inputmode="decimal" value="${O.saisieNombre(l.retenue)}" placeholder="Calculée"></label>
        </div>
        ${p.variantes.length > 1 ? `<fieldset class="champ cadre-champs"><legend>Variantes <small>Tout coché = ligne commune à toutes les variantes.</small></legend><div class="rang-boutons">${p.variantes.map((v) => `<label class="case"><input type="checkbox" name="var-${v.id}" ${!l.variantes.length || l.variantes.includes(v.id) ? 'checked' : ''}> ${esc(v.nom)}</label>`).join('')}</div></fieldset>` : ''}
        <label class="champ">Note ${l.forme === 'direct' ? '<small><b>Obligatoire</b> pour une quantité saisie directement : d\'où vient-elle ?</small>' : '<small>Facultative : source de la mesure, hypothèse.</small>'}<input name="note" maxlength="400" value="${esc(l.note)}"></label>
        <div class="apercu-calcul" id="apercu-ligne" aria-live="polite"></div>
        <p class="erreur" role="alert"></p>`;
    };
    const pied = existante
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="ok-suivant">Ajouter et nouvelle</button><button class="btn" value="annuler">Annuler</button>';
    const d = S.ouvrirModale(existante ? 'Ligne de métré' : 'Nouvelle ligne de métré', rendreCorps(), pied, (f, action) => {
      if (action === 'supprimer') {
        S.retenir();
        p.lignes = p.lignes.filter((x) => x.id !== existante.id);
        S.sauver(); S.rendre(); S.toast('Ligne supprimée.', { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      }
      const { ligne, illisible } = lireLigne(d.querySelector('form'), l);
      if (illisible) return illisible;
      if (!ligne.zoneId) return 'Choisis une zone.';
      const c = R.calculerLigne(ligne, ouvrage(ligne.ouvrageId));
      if (!c.ok) return c.erreur;
      if (ligne.forme === 'direct' && !ligne.note) return 'Indique dans la note d\'où vient la quantité saisie directement.';
      if (p.variantes.length > 1 && !ligne.variantes.length && ![...d.querySelectorAll('[name^="var-"]')].some((x) => x.checked)) return 'Coche au moins une variante.';
      S.retenir();
      const propre = R.normaliserLigne(ligne, p.zones, p.variantes);
      if (existante) Object.assign(existante, propre); else p.lignes.push(propre);
      S.sauver(); S.rendre();
      S.toast(`${ouvrage(propre.ouvrageId)?.nom || 'Ligne'} : ${q(c.retenue, c.unite)}.`, { libelle: 'Annuler', faire: S.annuler });
      if (action === 'ok-suivant') { S.garderModale(); setTimeout(() => modaleLigne(null, { zoneId: propre.zoneId, copie: { ...propre, dims: {}, deductions: [], retenue: null, note: '', precision: '' } }), 0); }
      return undefined;
    }, { large: true });
    const form = d.querySelector('form');
    const corpsEl = d.querySelector('.modale-corps');
    const apercu = () => {
      const { ligne, illisible } = lireLigne(form, l);
      const c = R.calculerLigne(ligne, ouvrage(ligne.ouvrageId));
      const el = d.querySelector('#apercu-ligne');
      if (!el) return;
      el.className = `apercu-calcul ${c.ok && !illisible ? '' : 'en-erreur'}`;
      el.innerHTML = illisible ? `<b>${esc(illisible)}</b>` : c.ok
        ? `<span class="formule">${esc(c.formule)}</span><span class="chaine"><span>Théorique <b>${q(c.theorique, c.unite)}</b></span><span>Perte ${O.fmtNombre(c.perte)} % → <b>${q(c.avecPertes, c.unite)}</b></span><span>Retenue <b>${q(c.retenue, c.unite)}</b>${ligne.retenue !== null ? ` (écart ${c.ecart > 0 ? '+' : ''}${O.fmtNombre(c.ecart, { dec: decimales(c.unite) })})` : ''}</span></span>`
        : `<b>${esc(c.erreur)}</b>`;
    };
    // Changement d'ouvrage ou de forme : on garde la saisie, puis on redessine les champs.
    form.addEventListener('change', (e) => {
      const m = e.target.dataset.maj;
      if (!m) return;
      l = lireLigne(form, l).ligne;
      if (m === 'ouvrage') { const o = ouvrage(l.ouvrageId); if (o && !formesPour(o).some((fo) => fo.id === l.forme)) l.forme = o.forme; else if (o && !Object.keys(l.dims).length) l.forme = o.forme; }
      corpsEl.innerHTML = rendreCorps();
      apercu();
    });
    form.addEventListener('input', apercu);
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action="ded-ajouter"],[data-action="ded-retirer"]');
      if (!b) return;
      e.stopPropagation();
      l = lireLigne(form, l).ligne;
      if (b.dataset.action === 'ded-ajouter') l.deductions.push({ id: uid(), libelle: '', nombre: 1, a: 0, b: 0 });
      else l.deductions = l.deductions.filter((x) => x.id !== b.dataset.id);
      corpsEl.innerHTML = rendreCorps();
      apercu();
      if (b.dataset.action === 'ded-ajouter') corpsEl.querySelector('#deductions .rang-ded:last-child input')?.focus();
    });
    apercu();
  }

  // ---------- Modale : ouvrage de la bibliothèque ----------
  function modaleOuvrage(id) {
    const o = id ? ouvrage(id) : null;
    let v = structuredClone(o || { id: uid(), nom: '', famille: 'divers', unite: 'm2', forme: 'rect', perte: 0, composants: [], note: '', perso: true });
    const d0 = B.ouvrages.find((x) => x.id === v.id);
    const n = o ? R.usages(S.E, o.id) : 0;
    const rendreCorps = () => `
      <label class="champ">Nom<input name="nom" required maxlength="120" value="${esc(v.nom)}"></label>
      <div class="rang-champs">
        <label class="champ">Famille<select name="famille">${B.familles.map((fa) => `<option value="${fa.id}" ${fa.id === v.famille ? 'selected' : ''}>${esc(fa.nom)}</option>`).join('')}</select></label>
        <label class="champ">Unité<select name="unite" data-maj="unite" ${n ? 'disabled' : ''}>${R.UNITES.map((u) => `<option value="${u}" ${u === v.unite ? 'selected' : ''}>${U(u)}</option>`).join('')}</select>${n ? '<small>Utilisé dans des lignes : unité verrouillée.</small>' : ''}</label>
        <label class="champ">Perte par défaut (%)<input name="perte" inputmode="decimal" value="${O.saisieNombre(v.perte)}"></label>
      </div>
      <label class="champ">Forme proposée<select name="forme">${formesPour(v).map((fo) => `<option value="${fo.id}" ${fo.id === v.forme ? 'selected' : ''}>${esc(fo.nom)}</option>`).join('')}</select></label>
      <fieldset class="champ cadre-champs"><legend>Composants à commander <small>Ratio par ${U(v.unite)} d'ouvrage. Conditionnement : quantité par unité de commande (vide = au détail).</small></legend>
        <div id="composants">${v.composants.map((c, i) => `<div class="rang-comp" data-comp="${i}">
          <label class="champ">Composant<input name="cn-${i}" maxlength="120" value="${esc(c.nom)}"></label>
          <label class="champ">Ratio<input name="cr-${i}" inputmode="decimal" value="${O.saisieNombre(c.ratio)}"></label>
          <label class="champ">Unité<select name="cu-${i}">${R.UNITES.map((u) => `<option value="${u}" ${u === c.unite ? 'selected' : ''}>${U(u)}</option>`).join('')}</select></label>
          <label class="champ">Conditionnement<input name="cc-${i}" inputmode="decimal" value="${O.saisieNombre(c.cond)}" placeholder="détail"></label>
          <label class="champ">Libellé de commande<input name="cl-${i}" maxlength="60" value="${esc(c.uc)}" placeholder="sac de 25 kg"></label>
          <button class="btn-icone" type="button" data-action="comp-retirer" data-id="${i}" aria-label="Retirer le composant">×</button></div>`).join('')}</div>
        <button class="btn petit" type="button" data-action="comp-ajouter">${S.ICONES.plus}Ajouter un composant</button></fieldset>
      <label class="champ">Note<textarea name="note" rows="2" maxlength="400">${esc(v.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    const lire = (form) => {
      const f = new FormData(form);
      const comps = [...form.querySelectorAll('[data-comp]')].map((r) => { const i = r.dataset.comp; return { nom: O.texte(f.get(`cn-${i}`), 120), ratio: lireDim(f.get(`cr-${i}`)), unite: f.get(`cu-${i}`), cond: String(f.get(`cc-${i}`) || '').trim() ? lireDim(f.get(`cc-${i}`)) : null, uc: O.texte(f.get(`cl-${i}`), 60), condIllisible: String(f.get(`cc-${i}`) || '').trim() && !(lireDim(f.get(`cc-${i}`)) > 0) }; });
      return { ...v, nom: O.texte(f.get('nom'), 120), famille: f.get('famille'), unite: n ? v.unite : f.get('unite'), forme: f.get('forme'), perte: lireDim(f.get('perte')), composants: comps, note: O.texte(f.get('note'), 400) };
    };
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${o ? `<button class="btn" value="dupliquer">Dupliquer</button>${d0 ? '<button class="btn" value="reinit">Valeurs d\'origine</button>' : ''}<button class="btn danger gauche" value="supprimer">Supprimer</button>` : ''}`;
    const d = S.ouvrirModale(o ? 'Ouvrage' : 'Nouvel ouvrage', rendreCorps(), pied, (f, action) => {
      if (action === 'supprimer') {
        if (n) return `Impossible : ${S.pluriel(n, 'ligne utilise', 'lignes utilisent')} cet ouvrage. Change d'abord ces lignes.`;
        if (!S.confirmer(`Supprimer « ${o.nom} » de la bibliothèque ?`)) { S.garderModale(); return undefined; }
        S.retenir();
        S.E.bibliotheque = S.E.bibliotheque.filter((x) => x.id !== o.id);
        S.sauver(); S.rendre(); S.toast('Ouvrage supprimé.', { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      }
      if (action === 'reinit') {
        if (!S.confirmer('Revenir aux valeurs d\'origine de la base (nom, perte, composants) ?')) { S.garderModale(); return undefined; }
        S.retenir();
        Object.assign(o, R.normaliserOuvrage(structuredClone(d0)), { perso: false });
        S.sauver(); S.rendre(); S.toast('Valeurs d\'origine rétablies.', { libelle: 'Annuler', faire: S.annuler });
        return undefined;
      }
      const x = lire(d.querySelector('form'));
      if (!x.nom) return 'Donne un nom à l\'ouvrage.';
      if (x.perte === null || x.perte > 100) return 'La perte doit être un pourcentage entre 0 et 100.';
      for (const c of x.composants) {
        if (!c.nom) return 'Chaque composant doit avoir un nom (ou retire-le).';
        if (!(c.ratio > 0)) return `Ratio de « ${c.nom} » : nombre strictement positif.`;
        if (c.condIllisible) return `Conditionnement de « ${c.nom} » : nombre strictement positif, ou vide pour « au détail ».`;
      }
      S.retenir();
      const propre = R.normaliserOuvrage({ ...x, perso: true, id: action === 'dupliquer' ? uid() : x.id, nom: action === 'dupliquer' ? `${x.nom} (copie)` : x.nom });
      if (o && action !== 'dupliquer') Object.assign(o, propre); else S.E.bibliotheque.push(propre);
      S.sauver(); S.rendre(); S.toast(action === 'dupliquer' ? 'Copie créée.' : 'Ouvrage enregistré.', { libelle: 'Annuler', faire: S.annuler });
      return undefined;
    }, { large: true });
    const form = d.querySelector('form');
    const corpsEl = d.querySelector('.modale-corps');
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action="comp-ajouter"],[data-action="comp-retirer"]');
      if (!b) return;
      e.stopPropagation();
      v = lire(form);
      if (b.dataset.action === 'comp-ajouter') v.composants.push({ nom: '', ratio: null, unite: v.unite, cond: null, uc: '' });
      else v.composants.splice(Number(b.dataset.id), 1);
      corpsEl.innerHTML = rendreCorps();
    });
    form.addEventListener('change', (e) => { if (e.target.dataset.maj === 'unite') { v = lire(form); corpsEl.innerHTML = rendreCorps(); } });
  }

  // ---------- Actions ----------
  function dupliquerProjet(id) {
    const p = S.E.projets.find((x) => x.id === id);
    if (!p) return;
    S.retenir();
    const c = structuredClone(p);
    const carte = new Map();
    c.id = uid(); c.nom = `${p.nom} (copie)`;
    c.zones.forEach((z) => { const n = uid(); carte.set(z.id, n); z.id = n; });
    c.lignes.forEach((l) => { l.id = uid(); l.zoneId = carte.get(l.zoneId) ?? l.zoneId; });
    S.E.projets.push(R.normaliserProjet(c));
    S.sauver(); S.rendre(); S.toast(`Copie de « ${p.nom} » créée.`, { libelle: 'Annuler', faire: S.annuler });
  }
  const p_ = () => projet();
  const actions = {
    'projet-nouveau': () => modaleProjet(null),
    'projet-modifier': (el) => modaleProjet(el.dataset.id),
    'projet-dupliquer': (el) => dupliquerProjet(el.dataset.id),
    'projet-ouvrir': (el) => { S.E.projetActif = el.dataset.id; S.sauver(); S.changerVue('metre'); },
    'charger-exemple': () => { S.retenir(); S.E.projets.push(...donneesDemo().projets); S.E.projetActif = S.E.projetActif || S.E.projets[0].id; S.sauver(); S.rendre(); S.toast('Projets d\'exemple ajoutés.', { libelle: 'Annuler', faire: S.annuler }); },
    'zone-nouvelle': () => modaleZone(null),
    'zone-modifier': (el) => modaleZone(el.dataset.id),
    variantes: () => modaleVariantes(),
    hypotheses: () => modaleHypotheses(),
    variante: (el) => { p_().varianteActive = el.dataset.id; S.sauver(); S.rendre(); },
    'ligne-nouvelle': (el) => modaleLigne(null, { zoneId: el.dataset.zone }),
    'ligne-ouvrir': (el) => modaleLigne(el.dataset.id),
    'ligne-dupliquer': (el) => {
      const p = p_(); const l = p.lignes.find((x) => x.id === el.dataset.id);
      if (!l) return;
      S.retenir();
      const c = { ...structuredClone(l), id: uid(), deductions: l.deductions.map((d) => ({ ...d, id: uid() })) };
      p.lignes.splice(p.lignes.indexOf(l) + 1, 0, c);
      S.sauver(); S.rendre(); S.toast('Ligne dupliquée : modifie ses dimensions.', { libelle: 'Annuler', faire: S.annuler });
    },
    'sous-vue': (el) => { ui.sousVue = el.dataset.id; S.rendre(); },
    'opt-zones': (el) => { ui.detailZones = el.checked; S.rendre(); },
    'opt-commande': (el) => { ui.avecCommande = el.checked; S.rendre(); },
    'ouvrage-nouveau': () => modaleOuvrage(null),
    'ouvrage-ouvrir': (el) => modaleOuvrage(el.dataset.id),
    imprimer: () => { if (S.vue !== 'bordereau') S.changerVue('bordereau'); S.imprimer(); },
    'csv-metre': () => { const p = p_(); if (!p) return S.toast('Aucun projet ouvert.'); S.exporterCsv(R.csvMetre(p, S.E.bibliotheque), 'metre-detaille'); },
    'csv-commande': () => { const p = p_(); if (!p) return S.toast('Aucun projet ouvert.'); S.exporterCsv(R.csvCommande(p, S.E.bibliotheque, p.varianteActive), 'a-commander'); },
    'csv-bordereau': () => { const p = p_(); if (!p) return S.toast('Aucun projet ouvert.'); S.exporterCsv(R.csvBordereau(p, S.E.bibliotheque, p.varianteActive), 'bordereau'); },
  };

  S = window.QME_SOCLE.creer({
    produit: 'MTR', prefixe: 'mtr', nom: 'MétréPro', fichier: 'metre', titreBarre: 'MétréPro<br>Métrés et quantités',
    connexion: { titre: 'Des dimensions aux quantités à commander.', texte: 'Saisis tes dimensions zone par zone : surfaces, volumes et longueurs se calculent avec leur formule, les pertes s\'ajoutent, et la liste de commande s\'arrondit au conditionnement.', ouvrir: 'Ouvre MétréPro', bouton: 'Ouvrir MétréPro' },
    onglets: [
      { id: 'projets', nom: 'Projets', icone: 'grille' },
      { id: 'metre', nom: 'Métré', icone: 'lignes' },
      { id: 'quantites', nom: 'Quantités', icone: 'barres' },
      { id: 'bordereau', nom: 'Bordereau', icone: 'carre' },
      { id: 'bibliotheque', nom: 'Bibliothèque', icone: 'triangle' },
    ],
    vueParDefaut: 'metre',
    etatVide: R.etatVide, normaliser: R.normaliser, donneesDemo,
    accueil, apresAccueil,
    vues: { projets: vueProjets, metre: vueMetre, quantites: vueQuantites, bordereau: vueBordereau, bibliotheque: vueBibliotheque },
    apresRendu() {
      const r = S.$('#recherche-biblio');
      if (r) r.addEventListener('input', (e) => { ui.rechercheBiblio = e.target.value; S.rendre(); });
      const fam = S.$('#famille-biblio');
      if (fam) fam.addEventListener('change', (e) => { ui.familleBiblio = e.target.value; S.rendre(); });
    },
    actions,
    reglages: {
      exports: [['csv-metre', 'Métré détaillé (CSV)'], ['csv-commande', 'À commander (CSV)'], ['csv-bordereau', 'Bordereau (CSV)'], ['imprimer', 'Imprimer le bordereau']],
      aPropos: () => `<p class="mention">Bibliothèque de départ : ${B.ouvrages.length} ouvrages en ${B.familles.length} familles, ${B.formes.length} formes de calcul (version ${B.version}). ${esc(B.sourceRatios)} MétréPro ne lit pas de plans et ne fait pas d'analyse BIM : toutes les quantités viennent de dimensions saisies.</p>`,
    },
    importValide: (d) => d && typeof d === 'object' && Array.isArray(d.projets),
    resumeImport: (d) => S.pluriel(d.projets.length, 'projet'),
  });
  S.lancer();
})();
