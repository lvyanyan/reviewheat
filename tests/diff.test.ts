import { describe, expect, it } from 'vitest';
import { parseDiff } from '../src/diff.js';

const FIXTURE = `diff --git a/src/auth/session.ts b/src/auth/session.ts
index 1111111..2222222 100644
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -10,7 +10,9 @@ export function validate(token: string) {
   const payload = decode(token);
-  if (payload.exp < Date.now()) {
-    return null;
+  if (payload.exp < Date.now() && !payload.refreshable) {
+    log.warn('expired token', { exp: payload.exp });
+    return null;
   }
   return payload;
 }
@@ -30,4 +32,4 @@ export function refresh(token: string) {
-  return extend(token, 3600);
+  return extend(token, 7200);
 }
diff --git a/src/newmod.ts b/src/newmod.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/newmod.ts
@@ -0,0 +1,3 @@
+export function hello(name: string): string {
+  return \`hi \${name}\`;
+}
diff --git a/logo.png b/logo.png
index 4444444..5555555 100644
Binary files a/logo.png and b/logo.png differ
diff --git a/src/old.ts b/src/renamed.ts
similarity index 90%
rename from src/old.ts
rename to src/renamed.ts
`;

describe('parseDiff', () => {
  const files = parseDiff(FIXTURE);

  it('parses every file section', () => {
    expect(files.map((f) => f.newPath)).toEqual([
      'src/auth/session.ts',
      'src/newmod.ts',
      'logo.png',
      'src/renamed.ts',
    ]);
  });

  it('counts added/removed lines per hunk', () => {
    const session = files[0];
    expect(session.status).toBe('modified');
    expect(session.hunks).toHaveLength(2);
    expect(session.addedCount).toBe(4);
    expect(session.removedCount).toBe(3);
    expect(session.hunks[0].added[1]).toBe("    log.warn('expired token', { exp: payload.exp });");
    expect(session.hunks[0].removed[0]).toBe('  if (payload.exp < Date.now()) {');
    expect(session.hunks[0].context).toContain('export function validate');
  });

  it('handles hunk headers without line counts', () => {
    const session = files[0];
    expect(session.hunks[1].oldStart).toBe(30);
    expect(session.hunks[1].oldLines).toBe(4);
    expect(session.hunks[1].newLines).toBe(4);
  });

  it('detects new, binary and renamed files', () => {
    expect(files[1].status).toBe('added');
    expect(files[1].addedCount).toBe(3);
    expect(files[2].binary).toBe(true);
    expect(files[3].status).toBe('renamed');
    expect(files[3].oldPath).toBe('src/old.ts');
    expect(files[3].newPath).toBe('src/renamed.ts');
  });

  it('tolerates CRLF line endings', () => {
    const crlf = parseDiff(FIXTURE.replaceAll('\n', '\r\n'));
    expect(crlf[0].hunks[0].added[0]).toContain('refreshable');
  });

  it('parses quoted paths containing spaces', () => {
    const quoted = `diff --git "a/src/with space/x.ts" "b/src/with space/x.ts"
index 1111111..2222222 100644
--- a/src/with space/x.ts
+++ b/src/with space/x.ts
@@ -1,2 +1,3 @@
+added line
`;
    const files = parseDiff(quoted);
    expect(files).toHaveLength(1);
    expect(files[0].newPath).toBe('src/with space/x.ts');
    expect(files[0].addedCount).toBe(1);
  });
});
