/**
 * End-to-end verification of the STATIC demo build, driven in a real browser.
 *
 * The static build (scripts/build_static_site.sh) has no server: every answer comes from the
 * precomputed bundle under data-bundle/. This drives the built site the way a visitor would
 * and asserts that what the page displays is what the bundle holds, and that nothing tries
 * to reach an API that is not there.
 *
 * Usage:
 *   scripts/build_static_site.sh                       # writes static-site/
 *   python3 -m http.server 8080 -d static-site &       # localhost: crypto.subtle needs it
 *   node scripts/verify/drive-static.mjs [baseUrl] [screenshotDir]
 *
 * Exits non-zero on any failed assertion.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const SHOTS = process.argv[3] ?? '.';

// Same two classes as drive-demo.mjs: "/" and "+" ids are the ones a naive file or URL
// scheme breaks on, so both must be reachable.
const CLASSES = [
  { name: 'slash-and-plus', pick: (m) => m.msno.includes('/') && m.msno.includes('+') },
  { name: 'neither',        pick: (m) => !m.msno.includes('/') && !m.msno.includes('+') },
];

const memberKey = (msno) => createHash('sha256').update(msno, 'utf8').digest('hex').slice(0, 16);

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
  if (!ok) failures++;
};

const listing = await (await fetch(`${BASE}/data-bundle/members.json`)).json();
const manifest = await (await fetch(`${BASE}/data-bundle/manifest.json`)).json();
if (!listing.total) {
  console.error('FATAL: the bundle lists 0 members.');
  process.exit(1);
}
console.log(`bundle population: ${listing.total}, exported: ${manifest.members_exported}`);
check('every listed member has a file', manifest.members_exported === listing.total);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const watch = (page) => {
  const apiCalls = [], errors = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    // Only the page's own files and Google Fonts. Anything else is a runtime dependency the
    // static host does not control (the Tailwind Play CDN and an esm.sh import map were).
    const own = u.origin === new URL(BASE).origin && !u.pathname.includes('/api/');
    if (!own && !/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) apiCalls.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return { apiCalls, errors };
};

for (const { name, pick } of CLASSES) {
  const m = listing.members.find(pick);
  if (!m) { console.log(`SKIP ${name}: no such member in the bundle`); continue; }
  console.log(`\n=== ${name} ===\n  ${m.msno}\n  saved ${m.risk_score} ${m.risk_tier}`);

  const file = await fetch(`${BASE}/data-bundle/m/${memberKey(m.msno)}.json`);
  check('member file exists at its key', file.ok);

  const page = await context.newPage();
  const { apiCalls, errors } = watch(page);
  await page.goto(`${BASE}/#/lookup`, { waitUntil: 'networkidle' });
  await page.fill('input[type="text"]', m.msno.slice(-8));
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  const body = await page.locator('body').innerText();
  const lc = body.toLowerCase();
  const pct = (m.risk_score * 100).toFixed(2) + '%';

  check('member id rendered', lc.includes(m.msno.toLowerCase()));
  check('saved score rendered', body.includes(pct), pct);
  check('tier rendered', lc.includes(m.risk_tier.toLowerCase() + '_risk'));
  check('explanation drawn', lc.includes('log-odds'));
  check('explanation reconciles on the page', lc.includes('they reconcile to within'));
  check('precomputed notice shown', lc.includes('calculated once by the served model'));
  check('no rejected-explanation notice', !lc.includes('was rejected because'));
  check('no API or third-party script calls', apiCalls.length === 0, apiCalls.join(' | '));
  check('no page errors', errors.length === 0, errors.join(' | '));

  await page.screenshot({ path: `${SHOTS}/static-lookup-${name}.png`, fullPage: true });
  await page.close();
}

// --- random member, intro page, dashboard --------------------------------------------------
{
  console.log('\n=== random member ===');
  const page = await context.newPage();
  const { apiCalls, errors } = watch(page);
  await page.goto(`${BASE}/#/lookup`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /random member/i }).click();
  await page.waitForTimeout(2500);
  const lc = (await page.locator('body').innerText()).toLowerCase();
  check('random pick shows a score', lc.includes('log-odds') && lc.includes('_risk'));
  check('no API or third-party script calls', apiCalls.length === 0, apiCalls.join(' | '));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: `${SHOTS}/static-random-member.png`, fullPage: true });
  await page.close();
}

for (const [route, label, needle] of [
  ['/#/how', 'how-it-works', 'which subscribers are about to leave'],
  ['/#/', 'dashboard', 'static demo'],
]) {
  console.log(`\n=== ${label} ===`);
  const page = await context.newPage();
  const { apiCalls, errors } = watch(page);
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const lc = (await page.locator('body').innerText()).toLowerCase();
  check(`"${needle}" shown`, lc.includes(needle));
  check('no API or third-party script calls', apiCalls.length === 0, apiCalls.join(' | '));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: `${SHOTS}/static-${label}.png`, fullPage: true });
  await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
