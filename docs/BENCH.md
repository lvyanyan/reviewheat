# Benchmark: scoring quality on real PRs

> Harness: `scripts/bench.mjs` — fetches the latest merged PRs from mainstream
> repos, runs the scoring engine, and measures the **compression ratio** and
> false-alarm count. Single-PR probe: `scripts/probe.mjs <owner/repo> <pr>`.
>
> **Compression ratio** = added lines in HIGH/CRITICAL files / total added lines.
> The product promise: a median well under 30% (see docs/PRODUCT.md).

## Sample

Merged PRs (latest per repo) from: vitejs/vite, vuejs/core, axios/axios,
expressjs/express, fastify/fastify, gin-gonic/gin (round 1–2), plus
pydantic/pydantic, denoland/deno, redis/redis, colinhacks/zod (round 3).
Mixed languages (TS/JS/Go/Python/Rust/C) and PR kinds: dependabot bumps,
release commits, CI changes, docs fixes, real features and bug fixes.

## Results

| Metric | Run 1 (30 PRs, initial weights) | Run 2 (after tuning, 30 PRs) | Run 3 (50 PRs, 10 repos) |
|---|---|---|---|
| Median compression | 7.5% | 0% | **5.4%** |
| Compression ≤ 30% | 21/30 | 27/30 | **39/50** |
| Compression ≤ 50% | 25/30 | 29/30 | **43/50** |
| False alarms (HIGH+ on docs/config) | 8 PRs | **0** | **0** |

Run 1 false alarms shared one root cause: config/CI files (package.json
version bumps, workflow YAML) received the +25 test-gap penalty they were
never meant to get. Fixed by introducing a dedicated **config category**
(×0.6 scale, exempt from test-gap) and classifying snapshots as churn.

## True-positive check (anti-overcorrection)

After tuning, 14/30 PRs still flagged red — spot-checked, all correct:
vite#23446 (build perf feature, 95%, red on `importAnalysisBuild.ts`),
three vue runtime-vapor hydration fixes, an express ETag fix, fastify perf
PRs, an axios fetch-cache fix — each red on exactly the file carrying the
real logic change.

## Known trade-offs

- Downscaling config files weakens supply-chain signals on dependency bumps.
  Accepted for v0.1; a dedicated dependency-diff factor (with OSV lookups)
  is planned.
- Sample skews toward large active repos. A dedicated evaluation on
  AI-heavy repos (where agents write nearly everything) is planned.
