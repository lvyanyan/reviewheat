import { describe, expect, it } from 'vitest';
import type { Hunk } from '../src/types.js';
import {
  analyze,
  candidateTestPaths,
  hasTestCoChange,
  isChurnPath,
  isConfigPath,
  isDocPath,
  isSnapshotPath,
  isTestPath,
  scoreHunk,
} from '../src/score.js';

const META = {
  mode: 'worktree',
  repoName: 't',
  branch: 'main',
  commit: 'abc',
  subject: '',
  generatedAt: 'now',
} as const;

function mkHunk(partial: Partial<Hunk>): Hunk {
  const added = partial.added ?? [];
  const removed = partial.removed ?? [];
  return {
    oldStart: 1,
    oldLines: removed.length,
    newStart: 1,
    newLines: added.length,
    context: '',
    added,
    removed,
    addedCount: added.length,
    removedCount: removed.length,
    ...partial,
  };
}

describe('scoreHunk', () => {
  it('scores behavioral control-flow changes with no tests as critical', () => {
    const h = mkHunk({
      added: [
        '  if (payload.exp < Date.now() && !payload.refreshable) {',
        "    log.warn('expired');",
        '    return null;',
        '  }',
      ],
      removed: ['  if (payload.exp < Date.now()) {'],
    });
    const s = scoreHunk(h, { testGap: true, fileScale: 1 });
    expect(s.factors.map((f) => f.id)).toContain('test-gap');
    expect(s.risk).toBeGreaterThanOrEqual(75);
    expect(s.level).toBe('critical');
  });

  it('keeps comment-only changes low', () => {
    const h = mkHunk({ added: ['# TODO: tighten limits'], removed: ['# TODO'] });
    const s = scoreHunk(h, { testGap: true, fileScale: 1 });
    expect(s.behavioralLines).toBe(0);
    expect(s.level).toBe('low');
  });

  it('detects pure reformatting (same lines, different whitespace)', () => {
    const h = mkHunk({
      added: ['  const x = compute(a, b);'],
      removed: ['    const x = compute(a, b);'],
    });
    const s = scoreHunk(h, { testGap: true, fileScale: 1 });
    expect(s.factors.map((f) => f.id)).toContain('pure-reformat');
    expect(s.risk).toBeLessThanOrEqual(5);
  });

  it('flags deletions without replacement', () => {
    const h = mkHunk({ removed: ['  const cache = new Map();', '  cache.clear();'] });
    const s = scoreHunk(h, { testGap: false, fileScale: 1 });
    expect(s.factors.map((f) => f.id)).toContain('deletion-only');
  });

  it('scales test-file changes down', () => {
    const big = mkHunk({
      added: Array.from({ length: 12 }, (_, i) => `  if (case${i}) { runCase(${i}); }`),
    });
    const s = scoreHunk(big, { testGap: false, fileScale: 0.4 });
    expect(s.risk).toBeLessThan(50);
    expect(s.level).not.toBe('high');
  });
});

describe('path heuristics', () => {
  it('recognizes test paths across languages', () => {
    expect(isTestPath('tests/foo.ts')).toBe(true);
    expect(isTestPath('src/__tests__/foo.ts')).toBe(true);
    expect(isTestPath('src/foo.test.tsx')).toBe(true);
    expect(isTestPath('pkg/foo_test.go')).toBe(true);
    expect(isTestPath('pkg/test_foo.py')).toBe(true);
    expect(isTestPath('app/FooTest.java')).toBe(true);
    expect(isTestPath('src/foo.ts')).toBe(false);
    expect(isTestPath('docs/guide.md')).toBe(false);
  });

  it('recognizes doc paths', () => {
    expect(isDocPath('README.md')).toBe(true);
    expect(isDocPath('docs/guide.md')).toBe(true);
    expect(isDocPath('src/index.ts')).toBe(false);
  });

  it('recognizes lockfiles and generated churn', () => {
    expect(isChurnPath('package-lock.json')).toBe(true);
    expect(isChurnPath('web/pnpm-lock.yaml')).toBe(true);
    expect(isChurnPath('CHANGELOG.md')).toBe(true);
    expect(isChurnPath('src/lockfile-utils.ts')).toBe(false);
    expect(isSnapshotPath('src/__snapshots__/a.ts.snap')).toBe(true);
  });

  it('recognizes config and CI paths', () => {
    expect(isConfigPath('package.json')).toBe(true);
    expect(isConfigPath('.github/workflows/ci.yml')).toBe(true);
    expect(isConfigPath('config/app.toml')).toBe(true);
    expect(isConfigPath('deploy/Dockerfile')).toBe(true);
    expect(isConfigPath('src/index.ts')).toBe(false);
  });

  it('keeps config files out of the test-gap penalty', () => {
    // 回归：bench 发现 package.json 版本号改动曾被 +25 抬成 HIGH
    const result = analyze(
      [
        {
          oldPath: 'package.json',
          newPath: 'package.json',
          status: 'modified',
          binary: false,
          hunks: [mkHunk({ added: ['  "version": "0.2.0",'] })],
          addedCount: 1,
          removedCount: 0,
        },
      ],
      META
    );
    expect(result.files[0].score.isConfig).toBe(true);
    expect(result.files[0].score.testGap).toBe(false);
    expect(result.totals.redLines).toBe(0);
  });

  it('generates convention-based test path candidates', () => {
    const candidates = candidateTestPaths('src/auth/session.ts');
    expect(candidates).toContain('src/auth/session.test.ts');
    expect(candidates).toContain('tests/auth/session.test.ts');
    expect(candidates).toContain('src/auth/__tests__/session.ts');
    expect(candidateTestPaths('pkg/mod.py')).toContain('pkg/test_mod.py');
  });

  it('detects co-changed tests', () => {
    expect(hasTestCoChange(['src/auth/session.test.ts'], 'src/auth/session.ts')).toBe(true);
    expect(hasTestCoChange(['src/other.ts'], 'src/auth/session.ts')).toBe(false);
  });
});

describe('analyze', () => {
  it('aggregates totals and red lines', () => {
    const hot: Hunk = mkHunk({
      added: [
        'if (!user.admin && !user.token) {',
        '  throw new Error("denied");',
        '}',
        'return user;',
      ],
      removed: ['if (!user.admin) {'],
    });
    const result = analyze(
      [
        {
          oldPath: 'src/g.ts',
          newPath: 'src/g.ts',
          status: 'modified',
          binary: false,
          hunks: [hot],
          addedCount: 4,
          removedCount: 1,
        },
        {
          oldPath: 'README.md',
          newPath: 'README.md',
          status: 'modified',
          binary: false,
          hunks: [mkHunk({ added: ['note'] })],
          addedCount: 1,
          removedCount: 0,
        },
      ],
      {
        mode: 'worktree',
        repoName: 't',
        branch: 'main',
        commit: 'abc',
        subject: '',
        generatedAt: 'now',
      }
    );
    expect(result.totals.files).toBe(2);
    expect(result.totals.added).toBe(5);
    expect(result.totals.redLines).toBe(4);
    expect(result.files[0].score.testGap).toBe(true);
    expect(result.files[1].score.isDoc).toBe(true);
  });
});
