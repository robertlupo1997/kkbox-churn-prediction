# Verifying the demo by driving it

The suite does not prove the demo works. It proves the Python is self-consistent. Every
frontend defect this project has had — a client wired to routes that do not exist, a health
check hitting an HTML page, fabricated SHAP factors, a chart drawn in the wrong units, an
explanation that did not explain the score beside it — survived a green suite.

`drive-demo.mjs` is the check that does not.

## Run it against a clean clone, never a shared worktree

A pass in a tree someone else is editing describes a tree that no longer exists.

```sh
git clone --branch <branch> <remote> /tmp/verify && cd /tmp/verify

# 1. build the bundle and stage it the way the Dockerfile does
cd brutalist-aesthetic-kkbox-churn-analysis-pro
npm ci --legacy-peer-deps && npm run build
cd .. && rm -rf static && cp -r brutalist-aesthetic-kkbox-churn-analysis-pro/dist static

# 2. serve it from the API, on a port nobody else wants
python -m uvicorn api.main:app --host 127.0.0.1 --port <your-port>

# 3. drive it
npm i playwright && npx playwright install chromium
node scripts/verify/drive-demo.mjs http://127.0.0.1:<your-port>
```

Serve the **built bundle**, not `vite dev`. Verifying a dev server proves nothing about what
ships.

## What it asserts, and why each one exists

| Assertion | The defect it was written for |
|---|---|
| served population is non-empty | the API reported `healthy` for months while `/api/members` returned `{"total":0}` |
| no saturated probability | isotonic calibration pinned 11 of 1,000 members to exactly 1.0; the page rendered "100.00%" |
| explanation names what it explains | the calibrated score and the raw-margin SHAP were different numbers, off by 15 log-odds |
| no approximation path | a fallback returns `importance * z_score * 0.1` with `base_value` hardcoded to -1.5. It is not an attribution and only a boolean distinguishes it |
| explanations reconcile | as above, arithmetically |
| body-based lookup and SHAP | 4,927 of 10,000 msnos contain `/`; no path route can carry them, encoded or not |
| no path-parameter member call | a regression here silently breaks half the population |
| no "demo mode", no "placeholder" | the shipped UI told every visitor it was in demo mode |

## Read the number of failures, not just the verdict

This harness scored 24/24, then 20/24 two commits later when calibration landed, then 24/24
after the fix. That is what a useful harness does. If it has never failed for you, check that
it is actually reaching the page.
