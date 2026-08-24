/**
 * End-to-end verification of the served demo, driven in a real browser.
 *
 * Every defect this project found in August 2026 came from executing something. None came
 * from reading a diff carefully. This is the executing part for the frontend: it loads the
 * built bundle from a running API, searches for a real member, and asserts that what the
 * page displays is what the API served.
 *
 * It has discriminated before. It scored 24/24 on the wired client, 20/24 once isotonic
 * calibration was applied to the score while SHAP still explained the raw margin, and 24/24
 * again after that was fixed. A harness that never fails is not evidence.
 *
 * Usage:
 *   npm i playwright && npx playwright install chromium
 *   node scripts/verify/drive-demo.mjs [baseUrl]        # default http://127.0.0.1:8000
 *
 * Exits non-zero on any failed assertion.
 *
 * The API must be serving the built bundle from ./static, the way Dockerfile assembles it —
 * not `vite dev`. Verifying a dev server proves nothing about what ships.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8000';

/**
 * Two member classes, because they exercise different routing.
 *
 * 4,927 of the 10,000 shipped msnos contain "/" and 4,802 contain "+". A path parameter
 * cannot carry either: "/" ends the segment, percent-encoding is decoded before routing, and
 * "+" decodes to a space in a query string. The demo must use POST bodies. A run that only
 * checks a clean id passes while half the population is unreachable.
 */
const CLASSES = [
  { name: 'slash-and-plus', pick: (m) => m.msno.includes('/') && m.msno.includes('+') },
  { name: 'neither',        pick: (m) => !m.msno.includes('/') && !m.msno.includes('+') },
];

const logit = (p) => Math.log(p / (1 - p));

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
  if (!ok) failures++;
};

const page1 = await (await fetch(`${BASE}/api/members?limit=1000`)).json();
if (!page1.total) {
  console.error(`FATAL: the API serves 0 members. It reports healthy while serving nothing — ` +
                `that is exactly how this demo shipped broken for months.`);
  process.exit(1);
}
console.log(`served population: ${page1.total}`);

// --- API-level assertions, independent of the browser ------------------------------------
{
  const scores = page1.members.map((m) => m.risk_score);
  check('no saturated probability', !scores.some((s) => s <= 0 || s >= 1),
        `min ${Math.min(...scores)} max ${Math.max(...scores)}`);

  let worst = 0, approx = 0, missing = 0;
  for (const m of page1.members.slice(0, 20)) {
    const res = await fetch(`${BASE}/api/shap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msno: m.msno }),
    });
    const e = (await res.json()).explanation;
    if (e.is_approximate) approx++;
    // SHAP is additive in log-odds against the probability it explains, which is NOT the
    // calibrated score the page displays. The payload must name its own target.
    const target = e.probability_explained;
    if (target === undefined) { missing++; continue; }
    const total = e.base_value + Object.values(e.shap_values).reduce((a, b) => a + b, 0);
    worst = Math.max(worst, Math.abs(logit(target) - total));
  }
  check('every explanation names what it explains', missing === 0);
  check('no explanation from the approximation path', approx === 0, `${approx}/20`);
  check('explanations reconcile', worst <= 1e-3, `worst residual ${worst.toExponential(2)}`);
}

// --- browser assertions -------------------------------------------------------------------
const browser = await chromium.launch();
for (const { name, pick } of CLASSES) {
  const m = page1.members.find(pick);
  if (!m) { console.log(`SKIP ${name}: no such member in the served population`); continue; }
  console.log(`\n=== ${name} ===\n  ${m.msno}\n  served ${m.risk_score} ${m.risk_tier}`);

  const page = await browser.newPage();
  const calls = [], errors = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/')) calls.push(`${r.method()} ${u.pathname}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${BASE}/#/lookup`, { waitUntil: 'networkidle' });
  await page.fill('input[type="text"]', m.msno.slice(-8));
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  const body = await page.locator('body').innerText();
  const lc = body.toLowerCase();
  const pct = (m.risk_score * 100).toFixed(2) + '%';

  check('member id rendered', lc.includes(m.msno.toLowerCase()));
  check('served score rendered', body.includes(pct), pct);
  check('tier rendered', lc.includes(m.risk_tier.toLowerCase() + '_risk'));
  check('explanation drawn', lc.includes('log-odds'));
  check('explanation reconciles on the page', lc.includes('they reconcile to within'));
  check('no rejected-explanation notice', !lc.includes('was rejected because'));
  check('no "demo mode"', !lc.includes('demo mode'));
  check('no "placeholder"', !lc.includes('placeholder'));
  check('body-based lookup used', calls.includes('POST /api/members/lookup'));
  check('body-based shap used', calls.includes('POST /api/shap'));
  check('no path-parameter member call',
        !calls.some((c) => /^GET \/api\/(members|shap)\/./.test(c)));
  check('no page errors', errors.length === 0, errors.join(' | '));

  await page.screenshot({ path: `verify-${name}.png`, fullPage: true });
  await page.close();
}
await browser.close();

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
