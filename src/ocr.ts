import type { AnalysisResult, HunkScore, FileScore } from './types.js';

export interface OcrComment {
  path: string;
  line: number;
  endLine: number;
  content: string;
  category?: string;
  severity?: string;
}

export interface OcrStats {
  total: number;
  pinned: number;
  fileLevel: number;
  unmatched: number;
}

/**
 * Parse open-code-review's `--format json` output (alibaba/open-code-review).
 * Tolerant: accepts the full jsonOutput envelope, a bare comments array, or
 * slightly different key spellings.
 */
export function parseOcrJson(text: string): OcrComment[] {
  // tolerate stray output before the JSON (progress lines etc.)
  const tryParse = (t: string): unknown | undefined => {
    try {
      return JSON.parse(t);
    } catch {
      return undefined;
    }
  };
  let data: unknown = tryParse(text);
  if (data === undefined) {
    const idxs = [text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0).sort((a, b) => a - b);
    for (const i of idxs) {
      data = tryParse(text.slice(i));
      if (data !== undefined) break;
    }
    if (data === undefined) throw new Error('no JSON payload found in OCR output');
  }
  const raw: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.comments)
      ? ((data as Record<string, unknown>).comments as unknown[])
      : [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c) => ({
      path: String(c.path ?? c.file ?? c.filename ?? ''),
      line: Number(c.start_line ?? c.line ?? 0) || 0,
      endLine: Number(c.end_line ?? c.endLine ?? c.line ?? c.start_line ?? 0) || 0,
      content: String(c.content ?? c.message ?? c.body ?? '').trim(),
      category: c.category ? String(c.category) : undefined,
      severity: c.severity ? String(c.severity) : undefined,
    }))
    .filter((c) => c.path && (c.line > 0 || c.content));
}

function hunkCovers(h: { newStart: number; newLines: number }, start: number, end: number): boolean {
  const first = h.newStart;
  const last = h.newLines > 0 ? h.newStart + h.newLines - 1 : h.newStart - 1;
  return start <= last && end >= first;
}

function pinToHunks(score: FileScore, file: { newPath: string; oldPath: string; hunks: Array<{ newStart: number; newLines: number }> }, c: OcrComment): boolean {
  if (c.path !== file.newPath && c.path !== file.oldPath) return false;
  const end = c.endLine >= c.line ? c.endLine : c.line;
  let pinned = false;
  file.hunks.forEach((h, i) => {
    if (hunkCovers(h, c.line, end)) {
      const hs: HunkScore = score.hunks[i];
      hs.ocr = [...(hs.ocr ?? []), c];
      pinned = true;
    }
  });
  return pinned;
}

/**
 * Pin OCR comments onto hunks whose new-line range contains the comment's line
 * span. Comments that land in unchanged regions stay at file level; comments
 * for files not in the diff are counted as unmatched.
 */
export function applyOcr(result: AnalysisResult, comments: OcrComment[]): OcrStats {
  const stats: OcrStats = { total: comments.length, pinned: 0, fileLevel: 0, unmatched: 0 };
  for (const c of comments) {
    const entry = result.files.find(
      (e) => e.file.newPath === c.path || e.file.oldPath === c.path
    );
    if (!entry) {
      stats.unmatched++;
      continue;
    }
    if (pinToHunks(entry.score, entry.file, c)) {
      stats.pinned++;
    } else {
      entry.score.ocrUnpinned = [...(entry.score.ocrUnpinned ?? []), c];
      stats.fileLevel++;
    }
  }
  return stats;
}
