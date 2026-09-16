# reviewheat — product spec

> The canonical product document. The public landing page is README.md;
> this file is the full spec including decision rationale.

## Positioning

**One line**: Your agents write 80% of the code. Review it in 10% of the time.

**Shape**: a CLI. Point it at any diff (working tree / last commit / a commit
ref / a diff file) and it produces a **risk heatmap**: which files and hunks
contain real behavioral change without test coverage. It writes **no review
comments** — it is a triage surface for the human reviewer.

**Who it's for**: developers whose PRs are now mostly written by coding
agents (Copilot, Claude Code, Cursor, ...) and who can no longer read every
line. Any language — reviewheat reads the diff, not your stack.

**What it is NOT**: it does not judge correctness. Compilers catch syntax;
humans and AI reviewers judge semantics. reviewheat ranks where that
judgment should be spent first — triage, not diagnosis.

## Why this exists

Two facts from 2026 (evidence in the git history and launch notes):

1. Agents generate code faster than humans can review it. The HN thread
   "There is an AI code review bubble" (351 pts, Jan 2026) crystallized the
   consensus; a companion thread (257 pts) showed the community hates that
   AI reviewers respond with even more comments.
2. Alibaba's open-code-review (29k+ stars, May 2026) optimizes comment
   *precision* — still more comments, and no visual triage for the human.

reviewheat takes the other side of the problem: compress what a human must
read. It is a complement to AI reviewers, not a competitor — `--ocr` pins
open-code-review findings onto the same heatmap.

## Risk model (deterministic, documented, arguable)

Every hunk is scored independently. Factor weights (constants in
`src/score.ts`; changes must update this file and the tests):

| Factor | Weight | Meaning |
|---|---|---|
| behavioral-churn | 0.30 | share of added lines that are code, not comments/blank |
| control-flow | 0.25 | if/for/return/throw/=> hits (normalized, capped) |
| definition-change | 0.20 | function/class/interface/export lines changed |
| logic-operators | 0.10 | && / \|\| / ?? / === flips |
| complexity-delta | 0.15 | net branch-point increase / 6, capped |
| deletion-only | 0.30 | lines deleted without replacement |

Modifiers:

- **test-gap**: source file has no co-changed test file (convention-based
  inference) → +25 once base risk ≥ 20;
- scales: test files ×0.4, docs ×0.5, config/CI ×0.6 (no test-gap),
  churn (lockfiles/snapshots/CHANGELOG/LICENSE) ×0.05;
- **pure-reformat** (added set ≡ removed set after trim) → capped at 5;
- levels: <25 low, <50 medium, <75 high, ≥75 critical;
- file score = worst hunk (review urgency is set by the worst part).

Rationale and the benchmark that drove the config/churn categories:
see docs/BENCH.md.

## CLI contract

```
reviewheat                     # analyze uncommitted changes (default)
reviewheat --last              # analyze the last commit
reviewheat --ref <sha>         # analyze any commit (<sha>~1..<sha>)
reviewheat --diff-file <f>     # analyze a unified diff file
reviewheat --repo <label>      # display label (useful with --diff-file)
reviewheat --out <file>        # report path (default reviewheat-report.html)
reviewheat --no-open           # don't open the HTML report
reviewheat --fail-on <level>   # CI gate: exit 1 if a file ≥ level lacks tests
reviewheat --ocr <file|->      # pin open-code-review JSON findings ('-' = stdin)
reviewheat --with-ocr          # run `ocr review` itself, then overlay
reviewheat --pr <n>            # (planned v0.5) analyze a GitHub PR
reviewheat --llm               # (planned v0.4) LLM behavior classification, BYO key
```

Exit codes: 0 ok, 1 `--fail-on` triggered, 2 usage/environment error.

## Roadmap

| Version | Scope | Status |
|---|---|---|
| v0.1 | diff parser + heuristics + terminal summary + HTML heatmap + fail-on | done |
| v0.2 | config/snapshot heuristics (50-PR benchmark), --ref, bench harness | done |
| v0.3 | --ocr overlay + --with-ocr one-command flow + --diff-file + demo GIF | done |
| v0.4 | --llm behavior classification + targeted test generation | planned |
| v0.5 | GitHub Action + --pr mode | planned |
| v0.6 | standalone binaries (macOS/Linux/Windows, no Node needed) | planned |

## Success metrics

- Compression verified on 50 real PRs across 10 repos: median 5.4%,
  39/50 ≤ 30%, zero false alarms (docs/BENCH.md);
- On GitHub Trending within 48h of launch;
- 1,000 stars in the first month.
