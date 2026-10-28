// Teste Provenienta pe fișiere C2PA produse cu o unealtă REALĂ: c2pa-python 0.38.1 (c2pa-rs 0.91.3).
// Fișierele sunt SINTETICE: certificate de TEST generate local cu OpenSSL; NU provin de la aparate, servicii sau emitenți reali.
// Rezultatele „așteptate” sunt confirmate independent de c2pa-rs (vezi tests/fixtures/README.md). Rulare: node tests/real-c2pa.test.mjs
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.PW_ROOT || import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, 'fixtures');
const APP_FILE = path.resolve(HERE, '../index.html');
let fail = 0;
const ok = (n, c, x) => { console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '  ' + (x || ''))); if (!c) fail++; };
const eq = (n, a, b) => ok(n, JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a) + ' !== ' + JSON.stringify(b));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', locale: 'ro-RO' });
const netReqs = [], errs = [];
await ctx.route(/^https?:/, (r) => { const u = r.request().url(); if (u.startsWith('https://provenienta.test/index.html')) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(APP_FILE) }); netReqs.push(u); r.abort(); });
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('https://provenienta.test/index.html'); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload();
await page.waitForFunction(() => window.Provenienta);
const b64 = (f) => fs.readFileSync(path.join(FX, f)).toString('base64');
const analyze = (f) => page.evaluate(async ([s, n]) => {
  const u = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); const r = await window.Provenienta.analyze(u, n); const m = r.manifests[r.active];
  return { found: r.found, fatal: r.fatal, fmt: r.container && r.container.format, n: r.manifests.length, sig: m && m.sig.state, reason: m && m.sig.reason, bind: r.binding && r.binding.state,
    trust: m && m.trust && m.trust.state, warn: r.warnings.map((w) => w.code), checks: m ? m.assertionChecks.map((a) => a.label + ':' + a.state) : [], ai: r.summary && r.summary.ai && r.summary.ai.level };
}, [b64(f), f]);

console.log('Provenienta — fișiere C2PA sintetice produse cu c2pa-python (nu sunt eșantioane oficiale)');
let r = await analyze('signed.jpg');
eq('signed.jpg: JPEG, 1 manifest, semnătură validă, fișier nemodificat', [r.found, r.fmt, r.n, r.sig, r.bind], [true, 'JPEG', 1, 'valid', 'match']);
ok('signed.jpg: toate afirmațiile se potrivesc și AI declarat (trainedAlgorithmicMedia)', r.checks.every((c) => c.endsWith(':match')) && r.ai === 'yes', r.checks.join());
ok('signed.jpg: avertisment lanț auto-semnat / fără ștampilă de timp', r.warn.includes('chain.selfsigned') && r.warn.includes('tst.absent'), r.warn.join());
eq('signed.jpg: fără listă de încredere → nolist', r.trust, 'nolist');
r = await analyze('signed.png');
eq('signed.png: PNG valid', [r.found, r.fmt, r.sig, r.bind], [true, 'PNG', 'valid', 'match']);
r = await analyze('signed-human.jpg');
eq('signed-human.jpg: digitalCapture → fără AI', [r.sig, r.bind, r.ai], ['valid', 'match', 'none']);
r = await analyze('corrupt-pixel-flip.jpg');
eq('pixel modificat (JPEG): semnătură validă, legătură nepotrivită', [r.sig, r.bind], ['valid', 'mismatch']);
r = await analyze('corrupt-pixel-flip.png');
eq('pixel modificat (PNG): semnătură validă, legătură nepotrivită', [r.sig, r.bind], ['valid', 'mismatch']);
r = await analyze('corrupt-manifest-byte.jpg');
ok('octet modificat în manifest: nepotrivire de afirmație raportată', r.warn.includes('assert.mismatch') && r.checks.some((c) => c.endsWith(':mismatch')), r.warn.join() + ' ' + r.checks.join());
r = await analyze('corrupt-assertion-missing.jpg');
ok('afirmație lipsă: raportată ca „missing”', r.warn.includes('assert.missing') && r.checks.some((c) => /CreativeWork:missing$/.test(c)), r.checks.join());
r = await analyze('corrupt-truncated-manifest.jpg');
ok('manifest trunchiat: fără verdict „valid”, avertisment struct.truncated', r.found && r.sig !== 'valid' && r.warn.includes('struct.truncated') && r.bind !== 'match', JSON.stringify(r));
r = await analyze('corrupt-stripped.jpg');
eq('manifest eliminat: „fără C2PA”', [r.found, r.fatal, r.n], [false, null, 0]);
for (const f of ['plain.jpg', 'plain.png']) { r = await analyze(f); eq(f + ': fără C2PA', [r.found, r.fatal, r.n], [false, null, 0]); }
// lista de încredere: rădăcina de TEST importată → „trusted”; (c2pa-rs o consideră „untrusted” fără lista C2PA, ceea ce este consecvent)
const added = await page.evaluate(async (s) => window.Provenienta.addTrust(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)), 'test-root-ca.pem'), fs.readFileSync(path.join(FX, 'test-root-ca.pem')).toString('base64'));
eq('import rădăcină de test', added.added, 1);
r = await analyze('signed.jpg'); eq('signed.jpg cu rădăcina de test în listă → trusted', r.trust, 'trusted');
eq('rețea', netReqs, []); eq('erori pagină', errs, []);
await browser.close();
console.log(fail ? fail + ' EȘECURI' : 'toate testele au trecut'); process.exit(fail ? 1 : 0);
