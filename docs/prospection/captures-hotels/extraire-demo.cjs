const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const t of ['verifications','maintenance','stocks','non-conformites']) {
    const p = await b.newPage();
    await p.goto(`https://qm-engineering.fr/templates/${t}/?demo`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    const ls = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
    require('fs').writeFileSync(`${process.argv[2]}/ls-${t}.json`, JSON.stringify(ls, null, 1));
    console.log(t, Object.entries(ls).map(([k,v]) => k + ':' + v.length).join(' '));
    await p.close();
  }
  await b.close();
})();
