// Teste Provenienta 2.1: „Verificare strictă” = listă de condiții evaluate local (NU un verdict de conformitate C2PA).
// Toate fișierele C2PA și certificatele sunt SINTETICE (tests/synth.mjs); nu s-a testat pe fișiere reale.
// Rulare: node tests/strict.test.mjs
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from './synth.mjs';

const require = createRequire(process.env.PW_ROOT || import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_FILE = path.resolve(HERE, '../index.html');
let fail = 0;
const ok = (n, c, x) => { console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '  ' + (x || ''))); if (!c) fail++; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, locale: 'ro-RO' });
const netReqs = [], errs = [];
await ctx.route(/^https?:/, (r) => { const u = r.request().url(); if (u.startsWith('https://provenienta.test/index.html')) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(APP_FILE) });
  const m = /^https:\/\/provenienta\.test\/(manifest\.webmanifest|icon-192\.png|icon-512\.png|icon-maskable-512\.png)$/.exec(u);
  if (m) return r.fulfill({ status: 200, contentType: m[1].endsWith('png') ? 'image/png' : 'application/manifest+json', body: fs.readFileSync(path.resolve(HERE, '..', m[1])) });
  netReqs.push(u); r.abort(); });
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('https://provenienta.test/index.html'); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload();
await page.waitForFunction(() => window.Provenienta && document.querySelector('#lang option'));
const settled = (name) => page.waitForFunction((n) => { const st = window.Provenienta.state; return !st.busy && st.res.A && st.res.A.name === n; }, name, { timeout: 60000 });
const load = async (buf, name) => { await page.setInputFiles('#file-A', { name, mimeType: 'application/octet-stream', buffer: buf }); await settled(name); };
const strict = () => page.evaluate(() => ({ verdict: document.querySelector('#strict-verdict')?.innerText || '', items: [...document.querySelectorAll('#strict-list li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim().replace(/^\S+\s/, '')), tst: document.querySelector('#strict-tst')?.innerText || '' }));
const pem = (der, label = 'CERTIFICATE') => `-----BEGIN ${label}-----\n${Buffer.from(der).toString('base64').replace(/(.{64})/g, '$1\n')}\n-----END ${label}-----\n`;

const svg = S.baseSvg();
const signer = S.makeSigner({ alg: 'ES256', cn: 'Semnatar Strict', chain: 'root' });
const good = S.signAsset('svg', svg, { signer, assertions: [S.actionsAssertion({ source: S.SRC.capture })] }).file;

console.log('Provenienta — teste verificare strictă');
// 1. fără listă de încredere: o condiție (emitent) neîndeplinită
await load(good, 'ok.svg');
let s = await strict();
ok('fără listă proprie: 7 din 8 condiții îndeplinite, emitentul nu', s.items.length === 8 && s.items.filter((x) => /^Îndeplinită/.test(x)).length === 7 && /^Neîndeplinită.*lista ta de încredere/.test(s.items.find((x) => /lista ta de încredere/.test(x)) || ''), JSON.stringify(s));
ok('verdict: „1 din 8 condiții neîndeplinite”', /1 din 8 condiții neîndeplinite/.test(s.verdict), s.verdict);
ok('mesaj de limită: nu este verdict de conformitate C2PA', /nu este un verdict de conformitate C2PA/i.test(await page.locator('#result').innerText()));
// 2. cu rădăcina importată: toate îndeplinite
await page.setInputFiles('#trust-file', [{ name: 'root.pem', mimeType: 'application/octet-stream', buffer: Buffer.from(pem(signer.certs[1])) }]);
await page.waitForFunction(() => /Adăugate|Added/.test(document.querySelector('#trust-msg').textContent), null, { timeout: 15000 });
await load(good, 'ok2.svg'); s = await strict();
ok('cu rădăcina importată: toate condițiile îndeplinite', /Toate condițiile sunt îndeplinite/.test(s.verdict) && s.items.every((x) => /^Îndeplinită/.test(x)), JSON.stringify(s));
ok('marcaj temporal absent: notă informativă', /fără marcaj temporal/i.test(s.tst), s.tst);
// 3. fișier modificat => „fișier” și (dacă hash-ul afirmației e afectat) altele neîndeplinite
const bad = Buffer.from(good); const i = bad.indexOf(Buffer.from('<rect')); bad[i + 2] ^= 0x01;
await load(bad, 'mod.svg'); s = await strict();
ok('octet modificat în fișier: condiția „fișierul se potrivește” neîndeplinită, verdictul nu e „toate”', s.items.some((x) => /^Neîndeplinită.*Fișierul se potrivește/.test(x)) && !/Toate condițiile/.test(s.verdict), JSON.stringify(s));
// 4. certificat expirat
const exp = S.makeSigner({ alg: 'ES256', chain: 'self', notBefore: new Date(Date.UTC(2020, 0, 1)), notAfter: new Date(Date.UTC(2021, 0, 1)) });
await load(S.signAsset('svg', svg, { signer: exp, assertions: [S.actionsAssertion()] }).file, 'exp.svg'); s = await strict();
ok('certificat expirat: „valabil la data de azi” neîndeplinită', s.items.some((x) => /^Neîndeplinită.*valabil la data de azi/.test(x)), JSON.stringify(s));
// 5. raport JSON / Markdown
const rep = await page.evaluate(() => { const r = window.Provenienta.state.res.A; return window.Provenienta.buildReport(r, { name: false, details: false }); });
ok('raport JSON: strictChecklist cu 8 condiții și notă', rep.strictChecklist && rep.strictChecklist.conditions.length === 8 && typeof rep.strictChecklist.allConditionsMet === 'boolean' && /conformitate C2PA/.test(rep.strictChecklist.note), JSON.stringify(rep.strictChecklist));
// 6. fără manifest: fără secțiune
await load(svg, 'fara.svg'); ok('fără manifest: nu apare lista strictă', (await page.locator('#strict-list').count()) === 0);
// 7. limbi: engleză
await page.selectOption('#lang', 'en'); await load(good, 'ok3.svg'); s = await strict();
ok('engleză: etichete traduse', /^(Met|Not met)/.test(s.items[0]) && /conditions/.test(s.verdict), JSON.stringify(s));
ok('0 erori de pagină, 0 cereri de rețea', errs.length === 0 && netReqs.length === 0, JSON.stringify([errs, netReqs]));
await browser.close();
console.log(fail ? '\n' + fail + ' EȘECURI' : '\nToate testele au trecut.'); process.exit(fail ? 1 : 0);
