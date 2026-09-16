import type { AnalysisResult, FileEntry } from './types.js';
import { LEVEL_ORDER } from './types.js';
import type { OcrStats } from './ocr.js';

const TTY = process.stdout.isTTY || process.env.FORCE_COLOR === '1';
const C = {
  red: TTY ? '\x1b[31m' : '',
  green: TTY ? '\x1b[32m' : '',
  yellow: TTY ? '\x1b[33m' : '',
  magenta: TTY ? '\x1b[35m' : '',
  cyan: TTY ? '\x1b[36m' : '',
  gray: TTY ? '\x1b[90m' : '',
  bold: TTY ? '\x1b[1m' : '',
  dim: TTY ? '\x1b[2m' : '',
  reset: TTY ? '\x1b[0m' : '',
};

const LEVEL_STYLE: Record<string, { label: string; color: string }> = {
  critical: { label: 'CRIT', color: C.magenta },
  high: { label: 'HIGH', color: C.red },
  medium: { label: 'MED ', color: C.yellow },
  low: { label: 'LOW ', color: C.green },
};

function paint(color: string, text: string): string {
  return color + text + C.reset;
}

function bar(risk: number): string {
  const filled = Math.round(risk / 10);
  const heat = filled >= 8 ? C.magenta : filled >= 5 ? C.red : filled >= 3 ? C.yellow : C.green;
  return paint(C.gray, '░'.repeat(10 - filled)) + paint(heat, '█'.repeat(filled));
}

function fileRow(e: FileEntry): string {
  const { level, risk, testGap, isTest, isDoc } = e.score;
  const style = LEVEL_STYLE[level];
  const path = e.file.newPath || e.file.oldPath;
  const tag = isTest
    ? paint(C.dim, ' [test]')
    : isDoc
      ? paint(C.dim, ' [doc]')
      : e.score.isConfig
        ? paint(C.dim, ' [config]')
        : e.score.isChurn
          ? paint(C.dim, ' [churn]')
          : testGap
            ? paint(C.yellow, ' [no-test]')
            : '';
  const churn = `+${e.file.addedCount}/-${e.file.removedCount}`.padEnd(11);
  const churnColored = churn.replace(`+${e.file.addedCount}`, paint(C.green, `+${e.file.addedCount}`))
    .replace(`-${e.file.removedCount}`.padEnd(1), paint(C.red, `-${e.file.removedCount}`));
  return `  ${bar(risk)}  ${paint(style.color, style.label)}   ${churnColored}${path}${tag}`;
}

export function renderTerminal(result: AnalysisResult, ocrStats?: OcrStats): string {
  const { meta, files, totals } = result;
  const sorted = [...files].sort((a, b) => b.score.risk - a.score.risk);
  const lines: string[] = [];

  lines.push(
    `${paint(C.bold, 'reviewheat')} — risk heatmap for ${paint(C.cyan, meta.repoName)} ` +
    `${paint(C.gray, `(${[meta.mode, meta.commit ? `${meta.branch}@${meta.commit}` : meta.branch].filter(Boolean).join(', ')})`)}`
  );
  lines.push('');
  lines.push(`  ${paint(C.gray, 'RISK      LEVEL  FILE')}`);
  for (const e of sorted) {
    lines.push(fileRow(e));
  }
  lines.push('');

  const reviewable = totals.redLines;
  const pct = totals.added ? Math.round((reviewable / totals.added) * 100) : 0;
  lines.push(
    `${paint(C.bold, `Review ${reviewable} of ${totals.added} added lines`)} ` +
    `${paint(C.gray, `(${pct}% — additions in HIGH/CRITICAL files)`)}, ${totals.removed} removed, ${totals.files} files.`
  );
  const gapFiles = sorted.filter(
    (e) => e.score.testGap && LEVEL_ORDER[e.score.level] >= LEVEL_ORDER.high
  );
  if (gapFiles.length > 0) {
    lines.push(paint(C.yellow, '⚠ test gap: ') + gapFiles.map((e) => e.file.newPath).join(', '));
  }
  if (ocrStats) {
    lines.push(
      paint(C.cyan, '📋 open-code-review: ') +
        `${ocrStats.pinned} pinned to hunks, ${ocrStats.fileLevel} file-level` +
        (ocrStats.unmatched ? paint(C.gray, `, ${ocrStats.unmatched} not in this diff`) : '')
    );
  }
  lines.push(paint(C.gray, 'Report written to reviewheat-report.html'));
  return lines.join('\n');
}
