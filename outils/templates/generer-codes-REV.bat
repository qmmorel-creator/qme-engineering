@echo off
title Codes d'acces - Planning de revision QME
where node >nul 2>nul || (echo Node.js est introuvable. Installe-le depuis https://nodejs.org puis relance. & pause & exit /b 1)
node -e "eval(require('fs').readFileSync(process.argv[1],'utf8').split(/\/\/ DEBUT-JS\r?\n/)[1])" "%~f0"
echo.
pause
exit /b

// DEBUT-JS
// Genere des codes d'acces au planning de revision (format REV-XXXX-XXXX-XXXX-XXXX).
// Le secret doit etre identique a la variable TEMPLATES_SECRET du site Netlify.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), readline = require('readline');
const dossier = path.dirname(process.argv[1]);
const fichierSecret = path.join(dossier, 'secret-templates.txt');
const historique = path.join(dossier, 'codes-generes.csv');
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const lignes = rl[Symbol.asyncIterator]();
const question = async (q) => { process.stdout.write(q); return (await lignes.next()).value ?? ''; };

function base32(octets) {
  let v = 0n;
  for (const o of octets) v = v * 256n + BigInt(o);
  let s = '';
  for (let i = 7; i >= 0; i--) s += ALPHABET[Number((v >> BigInt(5 * i)) & 31n)];
  return s;
}
function code(secret) {
  const id = base32(crypto.randomBytes(5));
  const sig = base32(crypto.createHmac('sha256', secret).update('REV:' + id).digest().subarray(0, 5));
  return `REV-${id.slice(0, 4)}-${id.slice(4)}-${sig.slice(0, 4)}-${sig.slice(4)}`;
}

(async () => {
  let secret = fs.existsSync(fichierSecret) ? fs.readFileSync(fichierSecret, 'utf8').trim() : '';
  if (!secret) {
    console.log('Premier lancement : colle la valeur de TEMPLATES_SECRET (celle enregistree sur Netlify),');
    console.log('puis appuie sur Entree. Elle sera gardee dans secret-templates.txt, a cote de ce fichier.\n');
    secret = (await question('Secret : ')).trim().replace(/^"|"$/g, '');
    if (secret.length < 32) { console.log('\nTrop court : le secret fait au moins 32 caracteres. Rien n\'a ete enregistre.'); rl.close(); return; }
    fs.writeFileSync(fichierSecret, secret);
    console.log('\nSecret enregistre.\n');
  }
  const reponse = (await question('Combien de codes ? (Entree = 1) : ')).trim();
  rl.close();
  const n = Math.min(Math.max(parseInt(reponse || '1', 10) || 1, 1), 100);
  const codes = Array.from({ length: n }, () => code(secret));
  const date = new Date().toLocaleString('fr-FR');
  if (!fs.existsSync(historique)) fs.writeFileSync(historique, 'date;code;acheteur\r\n');
  fs.appendFileSync(historique, codes.map((c) => `${date};${c};`).join('\r\n') + '\r\n');
  console.log('\n' + codes.join('\n'));
  try {
    require('child_process').execSync('clip', { input: codes.join('\r\n'), stdio: ['pipe', 'ignore', 'ignore'] });
    console.log(`\n${n > 1 ? 'Codes copies' : 'Code copie'} dans le presse-papiers (Ctrl+V pour coller).`);
  } catch { /* presse-papiers indisponible */ }
  console.log('Historique : codes-generes.csv (colonne acheteur a remplir).');
})();
