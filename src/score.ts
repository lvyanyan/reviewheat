import { LEVEL_ORDER } from './types.js';
import type {
  AnalysisResult,
  FileDiff,
  FileEntry,
  FileScore,
  Hunk,
  HunkScore,
  RiskFactor,
  RiskLevel,
} from './types.js';

// ---------------------------------------------------------------------------
// Line classification
// ---------------------------------------------------------------------------

const COMMENT_RE = /^\s*(\/\/|\/\*|\*|#|<!--|;;)/;
const BRACE_ONLY_RE = /^\s*[{}()）;]+;?\s*$/;

export function isCosmeticLine(line: string): boolean {
  const t = line.trim();
  return t === '' || COMMENT_RE.test(t) || BRACE_ONLY_RE.test(t);
}

const CONTROL_FLOW_RE =
  /\b(if|else|for|while|switch|case|catch|finally|return|throw|await|yield|elif|match)\b|=>|->/;
const DEFINITION_RE =
  /\b(function|class|interface|enum|struct|impl|trait|def|fn|export|public|private|protected)\b/;
const BRANCH_COUNT_RE = /\b(if|elif|for|while|case|catch)\b|&&|\|\||\?\?/g;

export function isWhitespaceOnlyHunk(h: Hunk): boolean {
  if (h.addedCount === 0 || h.addedCount !== h.removedCount) return false;
  const a = h.added.map((l) => l.trim()).sort();
  const b = h.removed.map((l) => l.trim()).sort();
  return a.every((v, i) => v === b[i]);
}

// ---------------------------------------------------------------------------
// Path classification
// ---------------------------------------------------------------------------

export function isTestPath(p: string): boolean {
  return (
    /(^|\/)(tests?|__tests__|specs?)(\/|$)/i.test(p) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/i.test(p) ||
    /_test\.(go|rs|py)$/i.test(p) ||
    /(^|\/)test_[^/]*\.py$/i.test(p) ||
    /Test\.java$|Tests\.cs$/i.test(p)
  );
}

export function isDocPath(p: string): boolean {
  return /\.(md|mdx|txt|rst|adoc)$/i.test(p) || /(^|\/)docs(\/|$)/i.test(p);
}

/** Lockfiles and generated dependency manifests — churn by definition, never review-worthy. */
export function isChurnPath(p: string): boolean {
  const base = basename(p);
  return (
    /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|npm-shrinkwrap\.json|composer\.lock|poetry\.lock|Cargo\.lock|go\.sum|Gemfile\.lock|flake\.lock)$/i.test(
      base
    ) || /(^|\/)(changelog|license|notice)(\.[a-z0-9]+)?$/i.test(p)
    );
}

export function isSnapshotPath(p: string): boolean {
  return /(^|\/)__snapshots__(\/|$)/i.test(p) || /\.snap$/i.test(p);
}

/** Config & CI plumbing: structured data, rarely "logic", test-gap makes no sense. */
export function isConfigPath(p: string): boolean {
  return (
    /\.(json|ya?ml|toml|ini|cfg|conf|properties|env)$/i.test(p) ||
    /(^|\/)\.github(\/|$)/i.test(p) ||
    /(^|\/)(Dockerfile|Makefile|docker-compose)/i.test(p) ||
    /(^|\/)(go\.mod|requirements\.txt|Pipfile|pyproject\.toml)$/i.test(p)
  );
}

const dirname = (p: string) => {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
};
const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1);
const splitExt = (base: string) => {
  const i = base.lastIndexOf('.');
  return i === -1 ? [base, ''] : [base.slice(0, i), base.slice(i)];
};

/** Candidate test-file paths that would cover `src`, by common naming conventions. */
export function candidateTestPaths(src: string): string[] {
  const dir = dirname(src);
  const base = basename(src);
  const [stem, ext] = splitExt(base);
  const names =
    ext === '.py'
      ? [`test_${stem}.py`]
      : [
          `${stem}.test${ext}`,
          `${stem}.spec${ext}`,
          `${stem}_test${ext}`,
          `${stem}Test${ext}`,
        ];
  const dirs = [dir, dir ? `${dir}/tests` : 'tests', dir ? `${dir}/test` : 'test', dir ? `${dir}/__tests__` : '__tests__', 'tests', 'test', '__tests__'];
  const out = new Set<string>();
  for (const d of dirs) {
    for (const n of names) out.add(d ? `${d}/${n}` : n);
  }
  // monorepo convention: tests mirrored under a root tests/ tree (src/ prefix stripped)
  const stripped = src.replace(/^src\//, '');
  const strippedDir = dirname(stripped);
  for (const root of ['tests', 'test', '__tests__']) {
    out.add(`${root}/${stripped}`);
    out.add(strippedDir ? `${root}/${strippedDir}/${names[0]}` : `${root}/${names[0]}`);
  }
  // jest-style: original basename kept inside a sibling __tests__ directory
  if (dir) out.add(`${dir}/__tests__/${base}`);
  out.add(`__tests__/${base}`);
  return [...out];
}

export function hasTestCoChange(changedPaths: string[], src: string): boolean {
  const set = new Set(changedPaths);
  return candidateTestPaths(src).some((c) => set.has(c));
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

// Factor weights are a public, documented product decision (see docs/PRODUCT.md).
const W = {
  behavior: 0.3,
  controlFlow: 0.25,
  definition: 0.2,
  logicOp: 0.1,
  complexityDelta: 0.15,
  deletionOnly: 0.3,
};
const TEST_GAP_PENALTY = 25;
const TEST_FILE_SCALE = 0.4;
const DOC_FILE_SCALE = 0.5;
const CONFIG_FILE_SCALE = 0.6;
const CHURN_FILE_SCALE = 0.05;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function scoreHunk(h: Hunk, opts: { testGap: boolean; fileScale: number }): HunkScore {
  const factors: RiskFactor[] = [];
  const pureReformat = isWhitespaceOnlyHunk(h);

  const behavioralLines = pureReformat ? 0 : h.added.filter((l) => !isCosmeticLine(l)).length;
  const cosmeticLines = h.addedCount - behavioralLines;
  const behaviorRatio = h.addedCount ? behavioralLines / h.addedCount : 0;

  let v = W.behavior * behaviorRatio;
  if (h.addedCount > 0) {
    factors.push({
      id: 'behavioral-churn',
      weight: W.behavior * behaviorRatio,
      detail: `${behavioralLines}/${h.addedCount} added lines are behavioral`,
    });
  }

  const cfLines = h.added.filter((l) => CONTROL_FLOW_RE.test(l) && !isCosmeticLine(l)).length;
  const cfVal = clamp01(h.addedCount ? (cfLines / h.addedCount) * 2 : 0);
  v += W.controlFlow * cfVal;
  if (cfLines > 0) {
    factors.push({
      id: 'control-flow',
      weight: W.controlFlow * cfVal,
      detail: `${cfLines} added lines touch control flow`,
    });
  }

  const defHit =
    h.added.concat(h.removed).some((l) => DEFINITION_RE.test(l)) && !pureReformat ? 1 : 0;
  v += W.definition * defHit;
  if (defHit) {
    factors.push({ id: 'definition-change', weight: W.definition, detail: 'API/type definitions changed' });
  }

  const logicLines = h.added.filter((l) => /&&|\|\||\?\?|===|!==/.test(l) && !isCosmeticLine(l)).length;
  const logicVal = clamp01(h.addedCount ? (logicLines / h.addedCount) * 2 : 0);
  v += W.logicOp * logicVal;
  if (logicLines > 0) {
    factors.push({ id: 'logic-operators', weight: W.logicOp * logicVal, detail: `${logicLines} lines change boolean logic` });
  }

  const branchAdded = h.added.join('\n').match(BRANCH_COUNT_RE)?.length ?? 0;
  const branchRemoved = h.removed.join('\n').match(BRANCH_COUNT_RE)?.length ?? 0;
  const cdVal = clamp01((branchAdded - branchRemoved) / 6);
  v += W.complexityDelta * cdVal;
  if (cdVal > 0) {
    factors.push({
      id: 'complexity-delta',
      weight: W.complexityDelta * cdVal,
      detail: `branch points +${branchAdded - branchRemoved}`,
    });
  }

  if (h.addedCount === 0 && h.removedCount > 0) {
    v += W.deletionOnly;
    factors.push({
      id: 'deletion-only',
      weight: W.deletionOnly,
      detail: `${h.removedCount} lines deleted without replacement`,
    });
  }

  let risk = Math.round(100 * clamp01(v));
  if (pureReformat) {
    risk = Math.min(risk, 5);
    factors.push({ id: 'pure-reformat', weight: 0, detail: 'whitespace-only churn' });
  }
  if (opts.fileScale < 1) {
    risk = Math.round(risk * opts.fileScale);
  }
  if (opts.fileScale === 1 && opts.testGap && risk >= 20) {
    risk = Math.min(100, risk + TEST_GAP_PENALTY);
    factors.push({ id: 'test-gap', weight: TEST_GAP_PENALTY / 100, detail: 'no co-changed test file' });
  }
  risk = Math.max(0, Math.min(100, risk));

  return { risk, level: levelOf(risk), factors, behavioralLines, cosmeticLines };
}

export function levelOf(risk: number): RiskLevel {
  if (risk < 25) return 'low';
  if (risk < 50) return 'medium';
  if (risk < 75) return 'high';
  return 'critical';
}

export function analyze(files: FileDiff[], meta: AnalysisResult['meta']): AnalysisResult {
  const changedPaths = files.map((f) => f.newPath);

  const entries: FileEntry[] = files.map((file) => {
    const path = file.newPath || file.oldPath;
    const isTest = isTestPath(path);
    const isDoc = isDocPath(path);
    const isConfig = isConfigPath(path);
    const isChurn = isChurnPath(path) || isSnapshotPath(path);
    const fileScale = isChurn
      ? CHURN_FILE_SCALE
      : isTest
        ? TEST_FILE_SCALE
        : isDoc
          ? DOC_FILE_SCALE
          : isConfig
            ? CONFIG_FILE_SCALE
            : 1;
    const testGap =
      !isTest && !isDoc && !isConfig && !isChurn && file.status !== 'deleted' && !hasTestCoChange(changedPaths, path);

    const hunks = file.hunks.map((h) => scoreHunk(h, { testGap, fileScale }));
    const risk = hunks.reduce((m, s) => Math.max(m, s.risk), 0);

    const score: FileScore = {
      risk,
      level: levelOf(risk),
      isTest,
      isDoc,
      isConfig,
      isChurn,
      testGap,
      hunks,
    };
    return { file, score };
  });

  const totals = {
    files: entries.length,
    added: entries.reduce((s, e) => s + e.file.addedCount, 0),
    removed: entries.reduce((s, e) => s + e.file.removedCount, 0),
    redLines: entries
      .filter((e) => LEVEL_ORDER[e.score.level] >= LEVEL_ORDER.high)
      .reduce((s, e) => s + e.file.addedCount, 0),
    redAddedLines: entries
      .filter((e) => LEVEL_ORDER[e.score.level] >= LEVEL_ORDER.high)
      .reduce((s, e) => s + e.score.hunks.reduce((m, h) => Math.max(m, h.behavioralLines), 0), 0),
  };

  return { meta, files: entries, totals };
}
