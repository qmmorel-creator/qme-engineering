@echo off
title Code administrateur - interets des templates QME
where node >nul 2>nul || (echo Node.js est introuvable. Installe-le depuis https://nodejs.org puis relance. & pause & exit /b 1)
node -e "eval(require('fs').readFileSync(process.argv[1],'utf8').split(/\/\/ DEBUT-JS\r?\n/)[1])" "%~f0"
echo.
pause
exit /b

// DEBUT-JS
// Affiche le code administrateur de la page https://qm-engineering.fr/admin/interets/ (format ADM-XXXX-XXXX-XXXX-XXXX).
// Il se deduit du secret TEMPLATES_SECRET (le meme que pour les codes d'acces) : il ne change pas tant que le secret ne change pas.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), readline = require('readline');
const dossier = path.dirname(process.argv[1]);
const fichierSecret = path.join(dossier, 'secret-templates.txt');
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function base32(octets) {
  let v = 0n;
  for (const o of octets) v = v * 256n + BigInt(o);
  let s = '';
  for (let i = octets.length * 8 / 5 - 1; i >= 0; i--) s += ALPHABET[Number((v >> BigInt(5 * i)) & 31n)];
  return s;
}
(async () => {
  let secret = fs.existsSync(fichierSecret) ? fs.readFileSync(fichierSecret, 'utf8').trim() : '';
  if (!secret) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('Colle la valeur de TEMPLATES_SECRET (celle enregistree sur Netlify), puis Entree.');
    secret = (await new Promise((r) => rl.question('Secret : ', r))).trim().replace(/^"|"$/g, '');
    rl.close();
    if (secret.length < 32) { console.log('\nTrop court : le secret fait au moins 32 caracteres.'); return; }
    fs.writeFileSync(fichierSecret, secret);
  }
  const s = base32(crypto.createHmac('sha256', secret).update('admin:interets').digest().subarray(0, 10));
  const code = `ADM-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
  console.log('\nCode administrateur : ' + code);
  console.log('A saisir sur https://qm-engineering.fr/admin/interets/ (garde-le pour toi).');
  try { require('child_process').execSync('clip', { input: code, stdio: ['pipe', 'ignore', 'ignore'] }); console.log('Copie dans le presse-papiers.'); } catch { /* indisponible */ }
})();
