import { describe, expect, it } from 'vitest';
import { parseDiff } from '../src/diff.js';
import { applyOcr, parseOcrJson } from '../src/ocr.js';
import { analyze } from '../src/score.js';

const META = {
  mode: 'worktree',
  repoName: 't',
  branch: 'main',
  commit: 'abc',
  subject: '',
  generatedAt: 'now',
} as const;

const DIFF = `diff --git a/src/auth/session.ts b/src/auth/session.ts
index 1111111..2222222 100644
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -10,7 +10,9 @@ export function validate(token: string) {
   const payload = decode(token);
-  if (payload.exp < Date.now()) {
+  if (payload.exp < Date.now() && !payload.refreshable) {
+    log.warn('expired token');
     return null;
   }
   return payload;
 }
diff --git a/src/missing.ts b/src/missing.ts
new file mode 100644
--- /dev/null
+++ b/src/missing.ts
@@ -0,0 +1,2 @@
+const a = 1;
+const b = 2;
`;

const ENVELOPE = JSON.stringify({
  status: 'success',
  summary: { comments: 3 },
  comments: [
    {
      path: 'src/auth/session.ts',
      content: 'Possible null dereference when payload is undefined.',
      start_line: 11,
      end_line: 13,
      category: 'bug',
      severity: 'high',
    },
    {
      path: 'src/auth/session.ts',
      content: 'Consider extracting this magic number.',
      start_line: 50,
      severity: 'low',
    },
    {
      path: 'src/other.ts',
      content: 'Comment for a file that is not part of this diff.',
      start_line: 1,
      severity: 'medium',
    },
  ],
});

function fixtureResult() {
  return analyze(parseDiff(DIFF), META);
}

describe('parseOcrJson', () => {
  it('reads the open-code-review jsonOutput envelope', () => {
    const comments = parseOcrJson(ENVELOPE);
    expect(comments).toHaveLength(3);
    expect(comments[0]).toMatchObject({
      path: 'src/auth/session.ts',
      line: 11,
      endLine: 13,
      category: 'bug',
      severity: 'high',
    });
  });

  it('accepts a bare comments array', () => {
    const bare = JSON.stringify([{ path: 'a.ts', content: 'x', start_line: 2 }]);
    expect(parseOcrJson(bare)).toHaveLength(1);
  });

  it('tolerates non-JSON output before the payload', () => {
    const junky = '[ocr] reviewing 3 files...\n' + ENVELOPE;
    expect(parseOcrJson(junky)).toHaveLength(3);
  });

  it('drops entries without a path', () => {
    const odd = JSON.stringify({ comments: [{ content: 'orphan' }, { path: 'a.ts', line: 1 }] });
    expect(parseOcrJson(odd)).toHaveLength(1);
  });
});

describe('applyOcr', () => {
  it('pins comments onto the hunk containing their line span', () => {
    const result = fixtureResult();
    const stats = applyOcr(result, parseOcrJson(ENVELOPE));
    expect(stats).toEqual({ total: 3, pinned: 1, fileLevel: 1, unmatched: 1 });

    const session = result.files.find((e) => e.file.newPath === 'src/auth/session.ts')!;
    expect(session.score.hunks[0].ocr).toHaveLength(1);
    expect(session.score.hunks[0].ocr![0].content).toContain('null dereference');
  });

  it('keeps comments outside changed hunks at file level', () => {
    const result = fixtureResult();
    applyOcr(result, parseOcrJson(ENVELOPE));
    const session = result.files.find((e) => e.file.newPath === 'src/auth/session.ts')!;
    expect(session.score.ocrUnpinned).toHaveLength(1);
    expect(session.score.ocrUnpinned![0].severity).toBe('low');
  });

  it('counts comments for files not in the diff as unmatched', () => {
    const result = fixtureResult();
    const stats = applyOcr(result, parseOcrJson(ENVELOPE));
    expect(stats.unmatched).toBe(1);
  });
});
