// Rendu de vignettes WebP par le Chromium de Playwright (canvas), sans autre dépendance. Partagé par
// outils/templates/vignettes.mjs (catalogue, packs) et outils/references/vignettes.mjs (page Sur mesure).
// Recadrage « cover » depuis le haut à gauche (là où sont le titre et les chiffres d'un écran), ou centré.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export async function ouvrirRendu() {
  // Playwright est installé globalement dans les sessions (moteur vidéo) : résolu depuis le module global si besoin.
  let playwright;
  try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.NODE_PATH || '/usr/lib/node_modules', 'playwright')); }
  const navigateur = await playwright.chromium.launch();
  const page = await navigateur.newPage();
  return {
    // source : contenu d'une image (Buffer, WebP ou PNG) ; renvoie le Buffer WebP de la vignette.
    async rendre(source, { largeur, hauteur, qualite = 0.8, centre = false, type = 'image/webp' }) {
      const donnees = `data:${type};base64,` + source.toString('base64');
      const base64 = await page.evaluate(async ({ donnees, largeur, hauteur, qualite, centre }) => {
        const img = new Image(); img.src = donnees; await img.decode();
        const echelle = Math.max(largeur / img.naturalWidth, hauteur / img.naturalHeight);
        const sl = largeur / echelle, sh = hauteur / echelle;
        const sx = centre ? (img.naturalWidth - sl) / 2 : 0, sy = centre ? (img.naturalHeight - sh) / 2 : 0;
        const c = document.createElement('canvas'); c.width = largeur; c.height = hauteur;
        const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sl, sh, 0, 0, largeur, hauteur);
        return c.toDataURL('image/webp', qualite).split(',')[1];
      }, { donnees, largeur, hauteur, qualite, centre });
      return Buffer.from(base64, 'base64');
    },
    fermer: () => navigateur.close(),
  };
}

// Empreinte courte du contenu, pour une adresse versionnée (?v=) qui suit tout changement d'image.
export const empreinte = (octets) => crypto.createHash('sha1').update(octets).digest('hex').slice(0, 8);

// Pages qui réutilisent des vignettes hors de leur page d'origine (accueils FR et EN, 22/11/2026 ; contact FR et EN,
// 23/11/2026).
export const PAGES_REPRISE = ['index.html', 'en/index.html', 'contact/index.html', 'en/contact/index.html'];

// Met à jour, dans ces pages, l'adresse versionnée de chaque vignette : adresses = Map(nom de fichier → adresse).
export function majReprises(racine, adresses) {
  for (const page of PAGES_REPRISE) {
    const fichier = path.join(racine, page);
    const avant = fs.readFileSync(fichier, 'utf8');
    let html = avant;
    for (const [nom, adresse] of adresses) {
      const motif = new RegExp(`/assets/vignettes/${nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?v=[0-9a-f]+`, 'g');
      html = html.replace(motif, adresse);
    }
    if (html !== avant) fs.writeFileSync(fichier, html);
  }
}
