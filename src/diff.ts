import type { FileDiff, Hunk } from './types.js';

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
const DIFFGIT_QUOTED_RE = /^diff --git "a\/(.*)" "b\/(.*)"$/;
const DIFFGIT_PLAIN_RE = /^diff --git a\/(.*) b\/(.*)$/;

export function parseDiff(text: string): FileDiff[] {
  const files: FileDiff[] = [];
  let cur: FileDiff | null = null;
  let curHunk: Hunk | null = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');

    if (line.startsWith('diff --git ')) {
      const m = DIFFGIT_QUOTED_RE.exec(line) ?? DIFFGIT_PLAIN_RE.exec(line);
      cur = {
        oldPath: m?.[1] ?? '?',
        newPath: m?.[2] ?? '?',
        status: 'modified',
        binary: false,
        hunks: [],
        addedCount: 0,
        removedCount: 0,
      };
      files.push(cur);
      curHunk = null;
      continue;
    }

    if (!cur) continue;

    if (line.startsWith('new file mode')) {
      cur.status = 'added';
    } else if (line.startsWith('deleted file mode')) {
      cur.status = 'deleted';
    } else if (line.startsWith('rename from ')) {
      cur.status = 'renamed';
      cur.oldPath = line.slice('rename from '.length);
    } else if (line.startsWith('rename to ')) {
      cur.newPath = line.slice('rename to '.length);
    } else if (line.startsWith('Binary files') || line.startsWith('GIT binary patch')) {
      cur.binary = true;
    } else if (line.startsWith('@@')) {
      const m = HUNK_RE.exec(line);
      if (!m) continue;
      curHunk = {
        oldStart: Number(m[1]),
        oldLines: m[2] ? Number(m[2]) : 1,
        newStart: Number(m[3]),
        newLines: m[4] ? Number(m[4]) : 1,
        context: m[5] ?? '',
        added: [],
        removed: [],
        addedCount: 0,
        removedCount: 0,
      };
      cur.hunks.push(curHunk);
    } else if (curHunk) {
      if (line.startsWith('+')) {
        curHunk.added.push(line.slice(1));
        curHunk.addedCount++;
        cur.addedCount++;
      } else if (line.startsWith('-')) {
        curHunk.removed.push(line.slice(1));
        curHunk.removedCount++;
        cur.removedCount++;
      }
      // context lines (' ') and '\ No newline at end of file' are ignored
    }
  }

  return files;
}
