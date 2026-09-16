# AGENTS.md — working conventions for reviewheat

Conventions for AI coding agents (and human collaborators) working in this repo.

## What this is

reviewheat: a risk-heatmap triage tool for AI-generated PRs. CLI, TypeScript +
Node (ESM), **zero runtime dependencies**. Full product spec: `docs/PRODUCT.md`.

## Commands

```bash
npm test          # vitest suite
npm run build     # tsc -> dist/
npx tsx src/cli.ts --no-open   # run the CLI locally (inside any git repo)
```

## Layout

```
src/       cli.ts (entry) · diff.ts (parser) · score.ts (heuristics)
           git.ts · terminal.ts · reportHtml.ts · ocr.ts · types.ts
docs/      PRODUCT.md (spec) · BENCH.md (benchmark) · img/ (assets)
scripts/   bench.mjs (evaluation) · probe.mjs · ansi2html.mjs · mkgif.mjs
tests/     vitest, inline fixtures
```

## Hard rules

1. Internal working notes (session handoff, dev log, launch playbook) live in
   a local untracked folder and are **never committed** to this public repo.
2. `npm test` green + `npm run build` clean before every commit.
3. Conventional commits (feat/fix/docs/test/chore).
4. Scoring weights/thresholds are public API: changing them requires updating
   `docs/PRODUCT.md` and the corresponding tests.
5. Zero runtime dependencies — new devDependencies need a rationale.
6. Never commit secrets, tokens, or key material of any kind.
