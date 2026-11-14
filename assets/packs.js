// Packs QME : calcul du pack sur mesure (/packs/composer/) et tableau de bord de l'acheteur (/packs/espace/).
// Remise : barème de netlify/lib/packs.mjs, prix arrondi à l'euro inférieur (même calcul que le serveur).
(() => {
  const euros = (c) => (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €';
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // --- Pack sur mesure -----------------------------------------------------------------------------
  const composer = document.querySelector('[data-composer]');
  if (composer) {
    const D = JSON.parse(document.getElementById('donnees-composer').textContent);
    const remise = (n) => { for (const [min, pct] of D.remises) if (n >= min) return pct; return 0; };
    const prixPack = (prix) => {
      const valeur = prix.reduce((s, p) => s + p, 0), pct = remise(prix.length);
      return { valeur, pct, prix: pct ? Math.floor(valeur * (100 - pct) / 100 / 100) * 100 : valeur };
    };
    const parPre = Object.fromEntries(D.templates.map((t) => [t.pre, t]));
    const cases = [...composer.querySelectorAll('input[type=checkbox]')];
    const $ = (s) => composer.querySelector(s);
    const commander = $('[data-commander]');

    const choisis = () => cases.filter((c) => c.checked).map((c) => parPre[c.value]);
    function majAdresse(liste) {
      const u = new URL(location.href);
      if (liste.length) u.searchParams.set('t', liste.map((t) => t.pre).join(',')); else u.searchParams.delete('t');
      history.replaceState(null, '', u);
    }
    function maj() {
      const liste = choisis(), p = prixPack(liste.map((t) => t.prix));
      $('[data-vide]').hidden = liste.length > 0;
      $('[data-choisis]').innerHTML = liste.map((t) => `<li><span>${esc(t.nom)}</span><span>${euros(t.prix)}</span></li>`).join('');
      $('[data-valeur]').textContent = euros(p.valeur);
      $('[data-remise]').textContent = p.pct ? `−${p.pct} % (−${euros(p.valeur - p.prix)})` : '—';
      $('[data-total]').textContent = euros(p.prix);
      $('[data-barre-texte]').textContent = liste.length ? `${liste.length} template${liste.length > 1 ? 's' : ''} · ${euros(p.prix)}${p.pct ? ` (−${p.pct} %)` : ''}` : 'Aucun template choisi';
      // Conseils : palier suivant, pack existant moins cher, templates pas encore en vente.
      const conseils = [];
      const suivant = [...D.remises].reverse().find(([min]) => min > liste.length);
      if (liste.length < 2) conseils.push('La remise commence à deux templates.');
      else if (suivant) conseils.push(`Encore ${suivant[0] - liste.length} template${suivant[0] - liste.length > 1 ? 's' : ''} pour passer à −${suivant[1]} %.`);
      const pres = new Set(liste.map((t) => t.pre));
      const pack = D.packs.filter((k) => liste.length >= 2 && [...pres].every((x) => k.produits.includes(x)) && k.prix <= p.prix).sort((a, b) => a.prix - b.prix)[0];
      if (pack) conseils.push(`Le ${pack.nom} contient tout votre choix${pack.produits.length > liste.length ? ', et plus encore,' : ''} pour ${euros(pack.prix)}. <a href="/packs/${pack.slug}/">Voir ce pack</a>.`);
      if (liste.some((t) => t.statut !== 'vente')) conseils.push('Certains templates choisis sont en mise en vente prochaine : leur démo est déjà ouverte.');
      $('[data-conseil]').innerHTML = conseils.join(' ');
      const ok = liste.length >= 2;
      commander.setAttribute('aria-disabled', String(!ok));
      const corps = `Bonjour,\n\nJe souhaite commander un pack sur mesure :\n${liste.map((t) => `- ${t.nom} (${euros(t.prix)})`).join('\n')}\n\nAchat séparé : ${euros(p.valeur)}\nRemise : ${p.pct} %\nPrix du pack : ${euros(p.prix)}\n\nMerci de m'envoyer le lien de paiement.\n`;
      commander.href = `mailto:quentin.morel@qm-engineering.fr?subject=${encodeURIComponent(`Pack sur mesure (${liste.length} templates, ${euros(p.prix)})`)}&body=${encodeURIComponent(corps)}`;
      majAdresse(liste);
    }
    const depart = (new URLSearchParams(location.search).get('t') || '').split(',');
    for (const c of cases) { if (depart.includes(c.value)) c.checked = true; c.addEventListener('change', maj); }
    maj();
  }

  // --- Espace de l'acheteur d'un pack -----------------------------------------------------------------
  const espace = document.querySelector('[data-espace]');
  if (espace) {
    const CLE = 'qme-packs';
    const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || '[]'); } catch { return []; } };
    const ecrire = (l) => { try { localStorage.setItem(CLE, JSON.stringify(l)); } catch {} };
    const zone = espace.querySelector('[data-mes-packs]');
    const form = document.getElementById('espace-form'), champ = document.getElementById('espace-cle'), erreur = document.getElementById('espace-erreur');

    async function ouvrirPack(code) {
      const r = await fetch('/api/templates/connexion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? 'Clé inconnue. Vérifiez-la dans l’e-mail reçu après l’achat.' : (j.erreur || 'Le service ne répond pas. Réessayez dans un instant.'));
      if (!j.pack) throw new Error('Cette clé ouvre un seul template : utilisez la page Connexion.');
      return j;
    }
    function rendre(packs) {
      zone.innerHTML = packs.map((p, i) => `<div class="pack-espace">
        <div class="pack-espace-tete"><h2>${esc(p.nom)}</h2><button class="lien-discret" type="button" data-oublier="${i}">Oublier ce pack sur cet appareil</button></div>
        <ul>${p.templates.map((t) => `<li><button type="button" data-ouvrir="${esc(t.produit)}" data-code="${esc(t.code)}" data-url="${esc(t.url)}">${esc(t.nom)}<span aria-hidden="true">→</span></button></li>`).join('')}</ul>
      </div>`).join('');
      form.querySelector('button').textContent = packs.length ? 'Ajouter un autre pack' : 'Ouvrir mon pack';
    }
    zone.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ouvrir]');
      if (b) {
        // Le template lit son code dans qme-<préfixe>-code : il s'ouvre comme après une connexion normale.
        try { localStorage.setItem(`qme-${b.dataset.ouvrir.toLowerCase()}-code`, JSON.stringify(b.dataset.code)); } catch {}
        location.href = b.dataset.url;
        return;
      }
      const o = e.target.closest('[data-oublier]');
      if (o) { const l = lire(); l.splice(Number(o.dataset.oublier), 1); ecrire(l); charger(); }
    });
    async function charger() {
      const codes = lire();
      if (!codes.length) { zone.innerHTML = ''; rendre([]); return; }
      zone.innerHTML = '<p>Chargement de vos packs…</p>';
      const res = await Promise.allSettled(codes.map(ouvrirPack));
      rendre(res.filter((r) => r.status === 'fulfilled').map((r) => r.value));
      if (res.some((r) => r.status === 'rejected')) erreur.textContent = 'Un pack n’a pas pu être chargé. Vérifiez votre connexion, puis rechargez la page.';
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = champ.value.trim();
      if (!code) { champ.focus(); return; }
      const bouton = form.querySelector('button');
      bouton.disabled = true; erreur.textContent = '';
      try {
        const j = await ouvrirPack(code);
        const l = lire().filter((c) => c !== j.code);
        l.push(j.code); ecrire(l); champ.value = '';
        await charger();
      } catch (x) { erreur.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessayez une fois en ligne.' : x.message; }
      bouton.disabled = false;
    });
    charger();
  }
})();
