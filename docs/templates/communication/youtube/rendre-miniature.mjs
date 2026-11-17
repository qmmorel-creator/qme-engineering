// node docs/templates/communication/youtube/rendre-miniature.mjs → png/miniature-presentation.png (1280 × 720)
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/user/qme-engineering/')('playwright');
const d='/home/user/qme-engineering/docs/templates/communication/youtube/';
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1280,height:720} });
await p.goto('file://'+d+'miniature.html'); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(300);
await p.screenshot({ path: d+'png/miniature-presentation.png' }); await b.close();
