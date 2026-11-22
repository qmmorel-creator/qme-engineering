// Données de l'espace acheteurs (/connexion/) : un objet par template de PRODUITS (nom, url, clé de stockage,
// thème, phrase, vignette), et la liste des thèmes dans l'ordre du catalogue.
// Sources : netlify/lib/templates-acces.mjs (PRODUITS) et templates/index.html (puces de thème et cartes).
// Écrit entre les marqueurs /* ESPACE-DEBUT */ et /* ESPACE-FIN */ de connexion/index.html, et dans
// assets/espace-donnees.js (panneau « Mes templates » des applications).
// À relancer après l'ajout d'un template ou un changement de thème : node outils/connexion/generer.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PRODUITS } from '../../netlify/lib/templates-acces.mjs';
import { PACKS, prixPack } from '../../netlify/lib/packs.mjs';
import { TEMPLATES } from '../packs/donnees.mjs';

const racine = new URL('../../', import.meta.url);
const ent = (s) => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export async function donneesEspace() {
  const catalogue = await readFile(new URL('templates/index.html', racine), 'utf8');
  const themes = [];
  for (const m of catalogue.matchAll(/<button class="puce"[^>]*data-pour="([a-z]+)" data-theme="([a-z-]+)"[^>]*style="--c:var\(--([a-z]+)\)">([^<]+?)\s*<small>/g)) {
    if (!themes.some((t) => t.id === m[2])) themes.push({ id: m[2], nom: ent(m[4].trim()), pour: m[1], c: m[3] });
  }
  const cartes = {};
  for (const m of catalogue.matchAll(/<li class="carte[^"]*"([^>]*)><a [^>]*>(.*?)<\/a><\/li>/g)) {
    const attr = (n) => (m[1].match(new RegExp(`${n}="([^"]*)"`)) || [])[1];
    const slug = attr('data-slug');
    if (!slug || cartes[slug]) continue;
    cartes[slug] = { theme: attr('data-theme'), vignette: attr('data-vignette') || '', phrase: ent((m[2].match(/<span class="phrase">(.*?)<\/span>/) || [])[1] || '') };
  }
  const produits = {};
  for (const [pre, p] of Object.entries(PRODUITS)) {
    const slug = p.url.split('/').filter(Boolean).pop();
    const c = cartes[slug] || {};
    // prix (centimes) et vente : suggestions de l'espace ; slug : page catalogue.
    produits[pre] = { nom: p.nom, url: p.url, cle: `qme-${pre.toLowerCase()}-code`, theme: themes.some((t) => t.id === c.theme) ? c.theme : 'autres', phrase: c.phrase || '', img: c.vignette || '',
      slug, prix: TEMPLATES[pre]?.prix ?? null, vente: Boolean(p.gumroad), icone: `${p.url}icone.svg` };
  }
  if (Object.values(produits).some((p) => p.theme === 'autres')) themes.push({ id: 'autres', nom: 'Autres', pour: '', c: 'encre' });
  // Packs (suggestions « compléter un pack ») : templates en ligne, prix du barème, en vente si tout l'est.
  const packs = {};
  for (const [code, k] of Object.entries(PACKS)) {
    const l = k.produits.filter((x) => PRODUITS[x]);
    if (l.length < 2) continue;
    packs[code] = { nom: k.nom, slug: k.slug, produits: l, prix: prixPack(l.map((x) => TEMPLATES[x]?.prix || 0)).prix,
      vente: Boolean(k.gumroad && k.permalien) && l.every((x) => PRODUITS[x].gumroad) };
  }
  return { produits, themes, packs };
}

// Fichier assets/espace-donnees.js : mêmes données que le bloc ESPACE, en global window.QME_ESPACE.
export const donneesJs = ({ produits, themes }) => `// Généré par node outils/connexion/generer.mjs : ne pas modifier à la main.\nwindow.QME_ESPACE=${JSON.stringify({ produits, themes })};\n`;

export async function generer() {
  const { produits, themes, packs } = await donneesEspace();
  const fichier = new URL('connexion/index.html', racine);
  const page = await readFile(fichier, 'utf8');
  const bloc = `/* ESPACE-DEBUT */\nconst PRODUITS=${JSON.stringify(produits)};\nconst THEMES=${JSON.stringify(themes)};\nconst PACKS_ESPACE=${JSON.stringify(packs)};\n/* ESPACE-FIN */`;
  if (!/\/\* ESPACE-DEBUT \*\/[\s\S]*?\/\* ESPACE-FIN \*\//.test(page)) throw new Error('Marqueurs ESPACE absents de connexion/index.html');
  const neuve = page.replace(/\/\* ESPACE-DEBUT \*\/[\s\S]*?\/\* ESPACE-FIN \*\//, () => bloc);
  if (neuve !== page) await writeFile(fichier, neuve);
  // Données chargées à la demande par le panneau « Mes templates » des applications (assets/mes-templates.js).
  await writeFile(new URL('assets/espace-donnees.js', racine), donneesJs({ produits, themes }));
  return { produits: Object.keys(produits).length, themes: themes.length, sansTheme: Object.entries(produits).filter(([, p]) => p.theme === 'autres').map(([k]) => k) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await generer());
