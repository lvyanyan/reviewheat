import { describe, expect, it } from 'vitest';
import {
  applyVerdicts,
  collectCandidates,
  parseClassificationJson,
  resolveLlmConfig,
  testTargetFor,
  type LlmCandidate,
} from '../src/llm.js';
import { analyze, isChurnPath, isTestPath } from '../src/score.js';
import { parseDiff } from '../src/diff.js';

const META = {
  mode: 'worktree',
  repoName: 't',
  branch: 'main',
  commit: 'abc',
  subject: '',
  generatedAt: 'now',
} as const;

describe('resolveLlmConfig', () => {
  it('returns null without an API key', () => {
    expect(resolveLlmConfig({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('fills defaults from env overrides', () => {
    const cfg = resolveLlmConfig({
      REVIEWHEAT_LLM_API_KEY: ' k ',
      REVIEWHEAT_LLM_BASE_URL: 'http://localhost:11434/v1/',
      REVIEWHEAT_LLM_MODEL: ' qwen3:8b ',
    } as NodeJS.ProcessEnv);
    expect(cfg).toEqual({
      apiKey: 'k',
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen3:8b',
    });
  });
});

describe('parseClassificationJson', () => {
  it('tolerates fences and surrounding prose', () => {
    const raw = 'Sure!\n```json\n[{"index":0,"label":"cosmetic","confidence":0.9,"reason":"comments only"}]\n```';
    expect(parseClassificationJson(raw)).toEqual([
      { index: 0, label: 'cosmetic', confidence: 0.9, reason: 'comments only' },
    ]);
  });

  it('drops entries without index/label and clamps confidence', () => {
    const raw = '[{"index":0,"label":"risky","confidence":5,"reason":"x"},{"label":"no-index"}]';
    const verdicts = parseClassificationJson(raw);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].confidence).toBe(1);
  });
});

describe('collectCandidates', () => {
  it('skips test/doc/churn files and only picks medium hunks', () => {
    const diff = `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
-const a = compute(a, b);
+const a = compute(a, b, c);
+log.debug('a=', a);
+// done tweaking
diff --git a/README.md b/README.md
index 3333333..4444444 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,3 @@
+new docs line
diff --git a/package-lock.json b/package-lock.json
index 5555555..6666666 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,2 +1,3 @@
+{"locked": true}
`;
    const result = analyze(parseDiff(diff), META);
    const candidates = collectCandidates(result);
    expect(candidates.every((c) => !isTestPath(c.file) && !isChurnPath(c.file))).toBe(true);
    expect(candidates.some((c) => c.file === 'README.md')).toBe(false);
    expect(candidates.some((c) => c.file === 'src/app.ts')).toBe(true);
  });
});

describe('applyVerdicts', () => {
  it('caps cosmetic verdicts and floors confident risky ones, always labeled', () => {
    const diff = `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,4 +1,5 @@
-const limit = readConfig();
+const limit = readConfig() ?? 100;
+if (limit < 0) throw new RangeError('limit');
+process.exitCode = limit;
`;
    const result = analyze(parseDiff(diff), META);
    const candidates: LlmCandidate[] = [
      { file: 'src/app.ts', hunkIndex: 0, location: 'src/app.ts', snippet: '' },
    ];
    const before = result.files[0].score.risk;
    const stats = applyVerdicts(result, candidates, [
      { index: 0, label: 'cosmetic', confidence: 0.9, reason: 'default value only' },
    ]);
    expect(stats.classified).toBe(1);
    expect(result.files[0].score.risk).toBeLessThanOrEqual(15);
    expect(result.files[0].score.risk).toBeLessThan(before);
    expect(result.files[0].score.hunks[0].llm![0].label).toBe('cosmetic');
  });
});

describe('testTargetFor', () => {
  it('maps languages to test file conventions', () => {
    expect(testTargetFor('src/auth/session.ts')?.testFile).toBe('reviewheat-suggested-tests/session.test.ts');
    expect(testTargetFor('app.py')?.testFile).toBe('reviewheat-suggested-tests/app.test.py');
    expect(testTargetFor('pkg/store.go')?.frame).toContain('go test');
    expect(testTargetFor('README.md')).toBeNull();
  });
});
