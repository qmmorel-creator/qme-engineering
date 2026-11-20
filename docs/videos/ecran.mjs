// Mode « écran » du moteur vidéo QME (décision du 20/11/2026) : vidéo qui ressemble à un enregistrement d'écran
// d'une personne qui utilise l'application, sur téléphone (iPhone) ou sur ordinateur (Windows), sans habillage QME.
// Appelé par moteur.mjs quand le scénario déclare `config.ecran` ('telephone' | 'ordinateur') : même entrée
// (`node docs/videos/moteur.mjs <scenario>`), mêmes briques que le reste du moteur (rendu.mjs : temps virtuel,
// encodage). L'application réelle tourne dans une iframe ; le cadre (barre d'état, clavier, barre des tâches,
// navigateur, curseur) est dessiné autour. Les repères (`v.repere`) datent les actions pour caler la voix (voix.mjs).
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium, PAS_ANIM, encoder, FPS, RACINE } from './rendu.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const PAS = 1000 / FPS;

// Écrans : taille en points, densité, taille de la vidéo. Téléphone : iPhone 6,1 pouces, la vidéo a la taille d'un
// enregistrement d'écran iOS. Ordinateur : portable Windows 1920 × 1080 à 125 % (1536 × 864 points).
export const ECRANS = {
  telephone: { l: 393, h: 852, dsf: 3, sortie: [886, 1920], mobile: true },
  ordinateur: { l: 1536, h: 864, dsf: 1.25, sortie: [1920, 1080], mobile: false },
};
const CLAVIER = 336; // hauteur du clavier iOS (suggestions comprises)
const HAUT_PC = 84, BAS_PC = 48; // navigateur (onglets + adresse), barre des tâches

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function cadreTelephone(urlApp) {
  const { l, h } = ECRANS.telephone;
  const rangs = [['a','z','e','r','t','y','u','i','o','p'], ['q','s','d','f','g','h','j','k','l','m'], ['⇧','w','x','c','v','b','n',"'",'⌫'], ['123','🌐','espace','retour']];
  const classe = (k) => (k === 'espace' ? ' e' : k === 'retour' ? ' ret' : k.length > 1 || '⇧⌫🌐'.includes(k) ? ' s' : '');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box;margin:0}html,body{width:${l}px;height:${h}px;overflow:hidden;background:#000;font-family:-apple-system,"SF Pro Text",Inter,Roboto,sans-serif}
#app{position:absolute;left:0;top:0;width:${l}px;height:${h}px;border:0;background:#fff}
#etat{position:absolute;top:0;left:0;right:0;height:54px;display:flex;align-items:center;justify-content:space-between;padding:6px 30px 0 46px;z-index:5;pointer-events:none;color:#000}
#heure{font-weight:600;font-size:17px;letter-spacing:-.2px}#icones{display:flex;gap:6px;align-items:center}
#ilot{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:125px;height:37px;border-radius:20px;background:#000;z-index:6}
#accueil{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:139px;height:5px;border-radius:3px;background:#000;z-index:7;pointer-events:none}
/* Conteneur « clip » : le clavier caché sous l'écran ne doit créer aucun débordement défilable (sinon un focus fait glisser tout le cadre). */
#zone{position:absolute;left:0;right:0;bottom:0;height:${CLAVIER}px;overflow:clip;z-index:6;pointer-events:none}
#clavier{position:absolute;inset:0;background:#d1d4db;transform:translateY(100%);padding:0 3px;display:flex;flex-direction:column}
#sugg{height:44px;display:flex;align-items:center;color:#000;font-size:16px}#sugg span{flex:1;text-align:center}#sugg span+span{border-left:1px solid #b8bbc2}
.r{display:flex;justify-content:center;gap:6px;margin-top:11px}
.k{height:42px;flex:0 0 33px;border-radius:5px;background:#fff;box-shadow:0 1px 0 #898a8d;display:flex;align-items:center;justify-content:center;font-size:23px;color:#000;position:relative}
.k.s{background:#abb0bb;font-size:16px;flex-basis:42px}.k.e{flex:1 1 auto;font-size:16px}.k.ret{flex-basis:88px;font-size:16px;background:#abb0bb}.k.on{background:#abb0bb}
.bulle{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:52px;height:96px;background:#fff;border-radius:9px;box-shadow:0 1px 3px rgba(0,0,0,.35);display:flex;justify-content:center;padding-top:8px;font-size:34px}
</style></head><body>
<iframe id="app" src="${esc(urlApp)}"></iframe>
<div id="etat"><span id="heure"></span><span id="icones">
<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM3.5 6.9a6.4 6.4 0 0 1 9 0l1.4-1.5a8.5 8.5 0 0 0-11.8 0zM.9 4.3a10.2 10.2 0 0 1 14.2 0L16 3.2a11.6 11.6 0 0 0-16 0z"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="#000" stroke-opacity=".4"/><rect x="2" y="2" width="16" height="9" rx="2.4"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill-opacity=".45"/></svg>
</span></div><div id="ilot"></div>
<div id="zone"><div id="clavier"><div id="sugg"><span>« le »</span><span>la</span><span>les</span></div>
${rangs.map((r) => `<div class="r">${r.map((k) => `<div class="k${classe(k)}" data-k="${k}">${k}</div>`).join('')}</div>`).join('')}</div></div>
<div id="accueil"></div>
<script>const h=document.getElementById('heure');const maj=()=>{h.textContent=new Date().toLocaleTimeString('fr-FR',{hour:'numeric',minute:'2-digit',timeZone:'Europe/Paris'}).replace(/^0/,'');};maj();setInterval(maj,500);</script>
</body></html>`;
}

// Ordinateur Windows : navigateur générique agrandi (aucune marque), barre des tâches, curseur.
function cadreOrdinateur(urlApp, { barre, onglet }) {
  const { l, h } = ECRANS.ordinateur;
  const fleche = `<svg width="20" height="28" viewBox="0 0 20 28"><path d="M1.5 1.5v21.2l5.2-4.9 3.6 8.2 3.4-1.5-3.6-8h7.1z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  const main = `<svg width="22" height="26" viewBox="0 0 22 26"><path d="M7.5 2.2c0-.9.7-1.6 1.6-1.6s1.6.7 1.6 1.6v8.3l.9-.2c.8-.1 1.6.4 1.8 1.2l.1.4.6-.2c.8-.2 1.7.3 1.9 1.1l.1.4.5-.1c.9-.1 1.7.5 1.8 1.4l.4 5.4c.1 1.7-.4 3.4-1.5 4.7l-.8 1H8.6l-4.8-6.5c-.6-.8-.5-1.9.3-2.5.7-.5 1.6-.4 2.2.2l1.2 1.3z" fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}html,body{width:${l}px;height:${h}px;overflow:hidden;background:#202020;font-family:"Segoe UI",Inter,Roboto,system-ui,sans-serif}
#nav{position:absolute;left:0;right:0;top:0;height:${HAUT_PC}px;background:#f3f3f3;border-bottom:1px solid #d6d6d6}
#onglets{height:40px;display:flex;align-items:flex-end;padding-left:8px;background:#e8e8e8}
.onglet{height:34px;width:240px;background:#f3f3f3;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:8px;padding:0 10px;font-size:12px;color:#1a1a1a}
.onglet i{width:16px;height:16px;border-radius:4px;background:#141414;display:inline-block;flex:none;box-shadow:inset -5px -5px 0 #D9302A}
.onglet span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.onglet b{font-weight:400;color:#555}
.plus{margin:0 0 8px 10px;color:#444;font-size:18px}
#fenetre{position:absolute;right:0;top:0;display:flex}#fenetre span{width:46px;height:32px;display:flex;align-items:center;justify-content:center;color:#222;font-size:13px}
#adresse{height:44px;display:flex;align-items:center;gap:14px;padding:0 12px;color:#444;font-size:15px}
#url{flex:1;height:32px;border-radius:16px;background:#fff;border:1px solid #e1e1e1;display:flex;align-items:center;gap:8px;padding:0 14px;font-size:14px;color:#1a1a1a}
#url s{text-decoration:none;color:#666}
#app{position:absolute;left:0;top:${HAUT_PC}px;width:${l}px;height:${h - HAUT_PC - BAS_PC}px;border:0;background:#fff}
#taches{position:absolute;left:0;right:0;bottom:0;height:${BAS_PC}px;background:rgba(238,240,245,.97);border-top:1px solid #d0d3da;display:flex;align-items:center;justify-content:center;gap:6px}
#taches .ic{width:40px;height:40px;border-radius:6px;display:flex;align-items:center;justify-content:center}
#taches .ic.actif{background:rgba(255,255,255,.75);position:relative}#taches .ic.actif:after{content:"";position:absolute;bottom:2px;width:16px;height:3px;border-radius:2px;background:#0067c0}
#recherche{width:200px;height:32px;border-radius:16px;background:#fff;border:1px solid #d9dbe0;display:flex;align-items:center;gap:8px;padding:0 12px;font-size:13px;color:#666;margin:0 6px}
#horloge{position:absolute;right:12px;bottom:0;z-index:2;height:${BAS_PC}px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;font-size:12px;color:#1a1a1a;line-height:1.35}
#systeme{position:absolute;right:100px;bottom:0;z-index:2;height:${BAS_PC}px;display:flex;align-items:center;gap:10px;color:#1a1a1a;font-size:13px}
#curseur{position:absolute;left:0;top:0;z-index:20;pointer-events:none;transform:translate(-100px,-100px)}#curseur>div{display:none}#curseur[data-f="fleche"] .f,#curseur[data-f="main"] .m{display:block}
#curseur .m{margin:-1px 0 0 -7px}
</style></head><body>
<div id="nav"><div id="onglets"><div class="onglet"><i></i><span>${esc(onglet)}</span><b>✕</b></div><span class="plus">+</span></div>
<div id="fenetre"><span>—</span><span>▢</span><span>✕</span></div>
<div id="adresse"><span>←</span><span style="color:#aaa">→</span><span>↻</span><div id="url"><s>🔒</s>${esc(barre)}</div><span>☆</span><span>⋯</span></div></div>
<iframe id="app" src="${esc(urlApp)}"></iframe>
<div id="taches">
<div class="ic"><svg width="22" height="22" viewBox="0 0 22 22"><rect x="1" y="1" width="9" height="9" rx="1.5" fill="#0a7ad6"/><rect x="12" y="1" width="9" height="9" rx="1.5" fill="#0a7ad6"/><rect x="1" y="12" width="9" height="9" rx="1.5" fill="#0a7ad6"/><rect x="12" y="12" width="9" height="9" rx="1.5" fill="#0a7ad6"/></svg></div>
<div id="recherche">⌕ Rechercher</div>
<div class="ic"><svg width="24" height="20" viewBox="0 0 24 20"><path d="M1 3a2 2 0 0 1 2-2h6l2 2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" fill="#f2b632"/><path d="M1 7h22v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" fill="#ffcf4d"/></svg></div>
<div class="ic actif"><svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="#1f8fe0"/><path d="M1.5 12h21M12 1.5c3 3 4.5 6.5 4.5 10.5S15 19.5 12 22.5M12 1.5C9 4.5 7.5 8 7.5 12S9 19.5 12 22.5" stroke="#cfe8fb" stroke-width="1.3" fill="none"/></svg></div>
<div class="ic"><svg width="22" height="22" viewBox="0 0 22 22"><rect x="1" y="3" width="20" height="16" rx="2" fill="#2b6fd1"/><path d="M1 6l10 6 10-6" stroke="#fff" stroke-width="1.6" fill="none"/></svg></div>
</div>
<div id="systeme"><svg width="12" height="8" viewBox="0 0 12 8"><path d="M1 7l5-5 5 5" stroke="#1a1a1a" stroke-width="1.3" fill="none"/></svg>
<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM3.5 6.9a6.4 6.4 0 0 1 9 0l1.4-1.5a8.5 8.5 0 0 0-11.8 0zM.9 4.3a10.2 10.2 0 0 1 14.2 0L16 3.2a11.6 11.6 0 0 0-16 0z" fill="#1a1a1a"/></svg>
<svg width="16" height="14" viewBox="0 0 16 14"><path d="M1 5h3l4-3.5v11L4 9H1z" fill="#1a1a1a"/><path d="M10.5 4.5a3.5 3.5 0 0 1 0 5M12.5 2.5a6.3 6.3 0 0 1 0 9" stroke="#1a1a1a" stroke-width="1.2" fill="none"/></svg>
<svg width="22" height="12" viewBox="0 0 22 12"><rect x=".6" y=".6" width="18" height="10.8" rx="2" fill="none" stroke="#1a1a1a" stroke-width="1.2"/><rect x="2.4" y="2.4" width="11" height="7.2" rx="1" fill="#1a1a1a"/><rect x="19.6" y="4" width="1.8" height="4" rx=".6" fill="#1a1a1a"/></svg></div>
<div id="horloge"><span id="h1"></span><span id="h2"></span></div>
<div id="curseur" data-f="fleche"><div class="f">${fleche}</div><div class="m">${main}</div></div>
<script>const a=document.getElementById('h1'),b=document.getElementById('h2');const maj=()=>{const d=new Date();a.textContent=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});b.textContent=d.toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'});};maj();setInterval(maj,500);</script>
</body></html>`;
}

export async function tournerEcran({ scenario, cfg, nom, brouillon, garder }) {
  const type = cfg.ecran;
  const E = ECRANS[type];
  if (!E) throw new Error(`config.ecran inconnu : ${type} (telephone | ordinateur)`);
  const SORTIE = join(ICI, 'sortie');
  const TMP = join(SORTIE, `.tmp-${nom}`), IMAGES = join(TMP, 'images');
  rmSync(TMP, { recursive: true, force: true }); mkdirSync(IMAGES, { recursive: true });

  // Application : template QME (chemin, servi par le serveur local) ou adresse complète (serveur déjà lancé).
  let serveur = null, urlApp = cfg.app;
  if (cfg.app.startsWith('/')) {
    const port = Number(process.env.PORT_VIDEO || 8897);
    serveur = spawn('node', [join(RACINE, 'outils/templates/serveur-local.mjs')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
    process.on('exit', () => { try { serveur.kill(); } catch {} });
    urlApp = `http://localhost:${port}${cfg.app}`;
    for (let i = 0; i < 50; i++) { try { await fetch(urlApp); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  }
  const origine = new URL(urlApp).origin;
  const cadre = type === 'telephone' ? cadreTelephone(urlApp)
    : cadreOrdinateur(urlApp, { barre: cfg.barre || new URL(urlApp).host + new URL(urlApp).pathname, onglet: cfg.onglet || 'Application' });

  const navigateur = await chromium.launch({ args: ['--lang=fr-FR'], env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr' } });
  const contexte = await navigateur.newContext({ viewport: { width: E.l, height: E.h }, deviceScaleFactor: E.dsf, isMobile: E.mobile, hasTouch: E.mobile, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await contexte.clock.install(cfg.heure ? { time: new Date(cfg.heure) } : {});
  // Cadre servi sur l'origine de l'application (même origine : l'iframe se pilote et se lit directement).
  await contexte.route(`${origine}/__ecran.html`, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: cadre }));
  // Remplacements de texte dans les fichiers servis (renommer une donnée de démo, un libellé) : le dépôt ne change pas.
  for (const { url, de, vers } of cfg.remplacer || []) {
    await contexte.route(url, async (r) => { const rep = await r.fetch(); const t = await rep.text(); if (!t.includes(de)) console.error(`Remplacement sans effet (${url}) : « ${de} »`); r.fulfill({ response: rep, body: t.split(de).join(vers) }); });
  }
  const page = await contexte.newPage();
  page.on('pageerror', (e) => console.error('Erreur page :', e.message));
  await page.goto(`${origine}/__ecran.html`);
  const app = () => page.frames().find((f) => f !== page.mainFrame());
  await app().waitForLoadState('load');
  if (cfg.css) await app().addStyleTag({ content: cfg.css });
  const cdp = await contexte.newCDPSession(page);
  const decalage = type === 'ordinateur' ? HAUT_PC : 0; // position de l'iframe dans le cadre

  // Horloge du tournage : temps réel pendant la préparation, puis figé et avancé de 1/30 s par image.
  let fige = false, n = 0;
  const reperes = {};
  async function image() {
    await contexte.clock.runFor(PAS);
    await Promise.all(page.frames().map((f) => f.evaluate(PAS_ANIM, PAS).catch(() => {})));
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: brouillon ? 70 : 92 });
    writeFileSync(join(IMAGES, `${String(n).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
    n++;
  }
  const pause = async (ms) => { if (!fige) return page.waitForTimeout(ms); for (let i = 0, k = Math.max(1, Math.round(ms / PAS)); i < k; i++) await image(); };
  let graine = 7; const alea = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
  const loc = (cible) => (typeof cible === 'string' ? app().locator(cible) : cible);
  // Élément défilant : `config.defilement` (sélecteur) ou la page de l'application.
  const defileur = cfg.defilement || null;
  const lireDefil = () => app().evaluate((s) => (s ? document.querySelector(s) : document.scrollingElement).scrollTop, defileur);
  const ecrireDefil = (y) => app().evaluate(([s, v]) => { (s ? document.querySelector(s) : document.scrollingElement).scrollTop = v; }, [defileur, y]);
  let souris = { x: E.l * 0.62, y: E.h * 0.55 };

  const v = {
    page, get app() { return app(); }, type, pause,
    // Repère daté (s) : sert à caler la voix (voix.mjs) ; lu dans <nom>.json.
    repere(nom) { reperes[nom] = Number((n / FPS).toFixed(2)); },
    async attendre(cible, { max = 5000 } = {}) {
      const l = loc(cible);
      for (let i = 0; i < Math.round(max / PAS); i++) { if (await l.count() && await l.first().isVisible()) return l.first(); if (fige) await image(); else await page.waitForTimeout(PAS); }
      throw new Error(`Élément absent : ${cible}`);
    },
    lire: async (cible) => (await v.attendre(cible)).evaluate((e) => (e.value ?? e.textContent).trim()),
    // Défilement : départ vif puis freinage (doigt sur téléphone, molette lissée sur ordinateur).
    async glisser(dy, ms = 650) {
      const depart = await lireDefil(), k = Math.round(ms / PAS);
      for (let i = 1; i <= k; i++) { const t = i / k; await ecrireDefil(depart + dy * (1 - Math.pow(1 - t, 3.2))); await image(); }
    },
    // Amène un élément à `marge` px du haut de la zone visible, en `gestes` mouvements avec de courtes pauses.
    async glisserVers(cible, { marge = 120, gestes = 2, ms = 620 } = {}) {
      const l = await v.attendre(cible);
      const y = await l.evaluate((e, s) => { const d = s ? document.querySelector(s) : document.scrollingElement; return e.getBoundingClientRect().top + d.scrollTop - (s ? d.getBoundingClientRect().top : 0); }, defileur);
      const total = y - marge - await lireDefil();
      const parts = gestes === 1 ? [1] : gestes === 2 ? [0.62, 0.38] : [0.42, 0.38, 0.2];
      for (const [i, p] of parts.entries()) { await v.glisser(total * p, ms - i * 40); if (i < parts.length - 1) await pause(300 + alea() * 120); }
    },
    // Téléphone : toucher (appui et relâchement sans image entre les deux : en temps réel, la capture ferait un appui long).
    // Ordinateur : le curseur va sur l'élément, puis la vraie souris clique.
    async toucher(cible, { fx = 0.5, fy = 0.5, ms = 650 } = {}) {
      const l = await v.attendre(cible);
      const b = await l.boundingBox();
      const x = b.x + b.width * fx + (alea() - 0.5) * 6, y = b.y + b.height * fy + (alea() - 0.5) * 6;
      if (type === 'telephone') {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        return pause(100 + alea() * 40);
      }
      await v.survoler(cible, { fx, fy, ms, x, y });
      await page.mouse.down(); await page.mouse.up();
      await pause(120);
    },
    // Ordinateur : déplacement du curseur (courbe légère, accélération puis freinage) ; la vraie souris suit image par
    // image, donc les survols de l'application réagissent. Le curseur devient une main sur un élément cliquable.
    async survoler(cible, { fx = 0.5, fy = 0.5, ms = 650, x, y } = {}) {
      if (x === undefined) { const b = await (await v.attendre(cible)).boundingBox(); x = b.x + b.width * fx; y = b.y + b.height * fy; }
      const a = { ...souris }, k = Math.max(1, Math.round(ms / PAS)), courbe = (alea() - 0.5) * 0.18;
      for (let i = 1; i <= k; i++) {
        const t = i / k, e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const px = a.x + (x - a.x) * e - (y - a.y) * courbe * Math.sin(Math.PI * e), py = a.y + (y - a.y) * e + (x - a.x) * courbe * Math.sin(Math.PI * e);
        souris = { x: px, y: py };
        await page.mouse.move(px, py);
        const forme = await app().evaluate(([cx, cy]) => { const el = document.elementFromPoint(cx, cy); return el && getComputedStyle(el).cursor === 'pointer' ? 'main' : 'fleche'; }, [px, py - decalage]).catch(() => 'fleche');
        await page.evaluate(([cx, cy, f]) => { const c = document.getElementById('curseur'); c.style.transform = `translate(${cx}px,${cy}px)`; c.dataset.f = f; }, [px, py, forme]);
        await image();
      }
    },
    // Téléphone : clavier iOS. `variable` : propriété CSS de l'application qui reçoit sa hauteur (ex. '--clavier') ;
    // sinon l'iframe raccourcit (la page se replace au-dessus du clavier).
    async clavier(visible) {
      if (type !== 'telephone') return;
      await page.evaluate((vis) => document.getElementById('clavier').animate([{ transform: `translateY(${vis ? '100%' : '0'})` }, { transform: `translateY(${vis ? '0' : '100%'})` }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }), visible);
      if (cfg.clavierVariable) await app().evaluate(([vis, h, nomVar]) => document.documentElement.style.setProperty(nomVar, vis ? `${h}px` : '0px', 'important'), [visible, CLAVIER, cfg.clavierVariable]);
      else await page.evaluate(([vis, h, H]) => document.getElementById('app').animate([{ height: `${vis ? H : H - h}px` }, { height: `${vis ? H - h : H}px` }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }), [visible, CLAVIER, E.h]);
      await pause(330);
    },
    // Focus sans défilement (Chromium mobile ferait glisser toute la vue, barre d'état comprise).
    focus: (cible) => loc(cible).first().evaluate((e) => e.focus({ preventScroll: true })),
    // Frappe humaine (rythme irrégulier) ; sur téléphone, touches du clavier allumées avec la bulle.
    async taper(texte) {
      let maj = true;
      for (const c of texte) {
        if (type === 'telephone') {
          const cle = c === ' ' ? 'espace' : /[0-9]/.test(c) ? '123' : c.toLowerCase();
          await page.evaluate(([k, aff]) => {
            const e = document.querySelector(`[data-k="${CSS.escape(k)}"]`); if (!e) return;
            e.classList.add('on'); if (k.length === 1) { const b = document.createElement('div'); b.className = 'bulle'; b.textContent = aff; e.appendChild(b); }
            setTimeout(() => { e.classList.remove('on'); e.querySelector('.bulle')?.remove(); }, 110);
          }, [cle, maj ? c.toUpperCase() : c]);
        }
        await page.keyboard.type(c); maj = false;
        await pause(c === ' ' ? 150 + alea() * 120 : (type === 'telephone' ? 85 : 55) + alea() * (type === 'telephone' ? 110 : 90));
      }
    },
    // Ferme les fenêtres du premier lancement (guide « Comment ça marche »), hors caméra.
    async fermerDialogues({ attente = 1500 } = {}) {
      // Le guide s'ouvre peu après le chargement (minuteur de l'application) : on lui laisse le temps d'apparaître.
      for (let t = 0; t < attente; t += PAS) { if (await app().$('dialog[open]').catch(() => null)) break; await pause(PAS); }
      for (let i = 0; i < 3; i++) {
        const reste = await app().evaluate(() => { const d = document.querySelector('dialog[open]'); if (!d) return false; const b = d.querySelector('button[aria-label="Fermer"], button.fermer, [data-action="fermer"]'); if (b) b.click(); else d.close(); return true; });
        if (!reste) return; await pause(250);
      }
    },
  };

  if (scenario.preparer) await scenario.preparer(v);
  if (type === 'ordinateur') await page.evaluate(([x, y]) => { document.getElementById('curseur').style.transform = `translate(${x}px,${y}px)`; }, [souris.x, souris.y]);
  await contexte.clock.pauseAt((await page.evaluate(() => Date.now())) + 250);
  fige = true;
  try { await scenario.jouer(v); } catch (e) {
    await page.screenshot({ path: join(SORTIE, `${nom}-erreur.png`) });
    console.error(`Échec du scénario (capture : ${join(SORTIE, `${nom}-erreur.png`)})`); await navigateur.close(); serveur?.kill(); throw e;
  }
  await pause(300);
  const duree = n / FPS;
  await navigateur.close(); serveur?.kill();
  console.log(`Capture : ${n} images (${duree.toFixed(1)} s, temps virtuel), repères : ${JSON.stringify(reperes)}`);

  // Vidéo muette à la taille de l'écran ; la voix et l'ambiance sont ajoutées par voix.mjs (place gardée pour l'audio).
  const video = join(SORTIE, `${nom}.mp4`);
  encoder({ dossier: IMAGES, duree, sortie: video, largeur: E.sortie[0], hauteur: E.sortie[1], tailleMaxMo: cfg.tailleMaxMo ?? 2.9, audio: true, rapide: brouillon, tmp: TMP });
  const couverture = join(SORTIE, `${nom}-couverture.png`);
  const img = join(IMAGES, `${String(Math.min(n - 1, Math.round((cfg.affiche ?? 1) * FPS))).padStart(5, '0')}.jpg`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', img, '-vf', `scale=${E.sortie[0]}:${E.sortie[1]}`, couverture]);
  writeFileSync(join(SORTIE, `${nom}.json`), JSON.stringify({ nom, ecran: type, video, couverture, duree: Number(duree.toFixed(2)), reperes,
    taille: statSync(video).size, produit: cfg.produit || null, type: cfg.type || null, titre: cfg.titre || null }, null, 2));
  if (!garder) rmSync(TMP, { recursive: true, force: true });
  console.log(`Vidéo (sans son) : ${video} (${duree.toFixed(1)} s, ${(statSync(video).size / 1e6).toFixed(2)} Mo). Voix : node docs/videos/voix.mjs texte <scenario>`);
}
