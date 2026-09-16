import type { AnalysisResult, FileEntry, RiskLevel } from './types.js';
import { LEVEL_ORDER } from './types.js';
import type { OcrComment, OcrStats } from './ocr.js';

const SEV_COLOR: Record<string, string> = {
  critical: '#e879f9',
  high: '#f87171',
  medium: '#fbbf24',
  low: '#4ade80',
};
const sevColor = (s?: string) => SEV_COLOR[(s ?? '').toLowerCase()] ?? '#8b949e';

function ocrHtml(list: OcrComment[] | undefined): string {
  if (!list || list.length === 0) return '';
  const items = list
    .map((c) => {
      const color = sevColor(c.severity);
      return `<div class="ocritem" style="border-left-color:${color}">
        <span class="sev" style="color:${color}">${esc(c.severity ?? 'review')}</span>
        ${c.category ? `<span class="chip">${esc(c.category)}</span>` : ''}
        <span class="ocrtext">${esc(c.content)}</span>
        ${c.endLine > c.line ? `<span class="fmeta">L${c.line}–${c.endLine}</span>` : `<span class="fmeta">L${c.line}</span>`}
      </div>`;
    })
    .join('');
  return `<div class="ocrbox"><div class="ocrhead">📋 open-code-review · ${list.length} finding${list.length > 1 ? 's' : ''}</div>${items}</div>`;
}

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const LEVEL_META: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  critical: { label: 'critical', color: '#e879f9', bg: 'rgba(232,121,249,.12)' },
  high: { label: 'high', color: '#f87171', bg: 'rgba(248,113,113,.12)' },
  medium: { label: 'medium', color: '#fbbf24', bg: 'rgba(251,191,36,.10)' },
  low: { label: 'low', color: '#4ade80', bg: 'rgba(74,222,128,.10)' },
};

function hunkHtml(entry: FileEntry, idx: number): string {
  const h = entry.file.hunks[idx];
  const s = entry.score.hunks[idx];
  const chips = s.factors.length
    ? s.factors
        .map(
          (f) =>
            `<span class="chip">${esc(f.id)}${f.weight ? ` · ${esc(f.detail)}` : ''}</span>`
        )
        .join('')
    : '<span class="chip">context-only</span>';
  const llmChips = (s.llm ?? [])
    .map(
      (l) =>
        `<span class="chip llmchip">🤖 ${esc(l.label)} ${Math.round(l.confidence * 100)}% — ${esc(l.reason)}</span>`
    )
    .join('');
  const body = h.added.length || h.removed.length
    ? [
        ...h.removed.map((l) => `<span class="dl">-${esc(l)}</span>`),
        ...h.added.map((l) => `<span class="al">+${esc(l)}</span>`),
      ].join('\n')
    : '<span class="ct">(no line changes)</span>';
  return `
  <div class="hunk" style="border-left-color:${LEVEL_META[s.level].color}">
    <div class="hunkhead">
      <span class="hunkloc">@ +${h.newStart},${h.newLines} −${h.oldStart},${h.oldLines}${h.context ? ` @@ ${esc(h.context)}` : ''}</span>
      <span class="risknum" style="color:${LEVEL_META[s.level].color}">risk ${s.risk}</span>
    </div>
    <div class="chips">${chips}${llmChips}</div>
    ${ocrHtml(s.ocr)}
    <pre>${body}</pre>
  </div>`;
}

function fileHtml(entry: FileEntry): string {
  const m = LEVEL_META[entry.score.level];
  const path = entry.file.newPath || entry.file.oldPath;
  const tags: string[] = [];
  if (entry.score.isTest) tags.push('<span class="tag">test</span>');
  if (entry.score.isDoc) tags.push('<span class="tag">doc</span>');
  if (entry.score.isConfig) tags.push('<span class="tag">config</span>');
  if (entry.score.isChurn) tags.push('<span class="tag">churn</span>');
  if (entry.score.testGap) tags.push('<span class="tag warntag">no co-changed test</span>');
  if (entry.file.binary) tags.push('<span class="tag">binary</span>');
  const status = entry.file.status !== 'modified' ? ` · ${entry.file.status}` : '';
  const title = `
    <summary>
      <span class="fbar" style="width:${Math.max(2, Math.round(entry.score.risk / 5))}px;background:${m.color}"></span>
      <span class="fname">${esc(path)}</span>${tags.join('')}
      <span class="fmeta">+${entry.file.addedCount}/−${entry.file.removedCount}${status}</span>
      <span class="flevel" style="color:${m.color}">${entry.score.risk} ${m.label}</span>
    </summary>`;
  const body = entry.file.binary
    ? '<p class="ct">Binary file — not analyzed.</p>'
    : entry.file.hunks.map((_, i) => hunkHtml(entry, i)).join('') +
      (entry.score.ocrUnpinned?.length ? ocrHtml(entry.score.ocrUnpinned) : '');
  return `<details ${entry.score.risk >= 50 ? 'open' : ''} class="file" style="--lvl:${m.color}">${title}${body}</details>`;
}

export function renderHtml(result: AnalysisResult, ocrStats?: OcrStats): string {
  const { meta, files, totals } = result;
  const sorted = [...files].sort((a, b) => b.score.risk - a.score.risk);
  const pct = totals.added ? Math.round((totals.redLines / totals.added) * 100) : 0;
  const body = sorted.map(fileHtml).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>reviewheat — ${esc(meta.repoName)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0d1117; color:#c9d1d9; font:14px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace; padding:32px; }
  h1 { font-size:18px; margin:0 0 4px; color:#e6edf3; }
  h1 em { color:#f87171; font-style:normal; }
  .sub { color:#8b949e; margin:0 0 24px; font-size:12px; }
  .cards { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:24px; }
  .card { border:1px solid #21262d; border-radius:8px; padding:12px 16px; min-width:150px; }
  .card .n { font-size:22px; font-weight:700; color:#e6edf3; }
  .card .l { font-size:11px; color:#8b949e; text-transform:uppercase; letter-spacing:.08em; }
  .card.hot .n { color:#f87171; }
  details.file { border:1px solid #21262d; border-radius:8px; margin-bottom:10px; background:#0d1117; }
  details.file[open] { border-color:var(--lvl); }
  summary { cursor:pointer; padding:10px 14px; display:flex; align-items:center; gap:10px; list-style:none; }
  summary::-webkit-details-marker { display:none; }
  .fbar { height:14px; border-radius:3px; flex:none; }
  .fname { color:#e6edf3; }
  .fmeta { margin-left:auto; color:#8b949e; font-size:12px; white-space:nowrap; }
  .flevel { font-weight:700; white-space:nowrap; }
  .tag { font-size:10px; border:1px solid #30363d; border-radius:10px; padding:1px 8px; color:#8b949e; }
  .warntag { border-color:rgba(251,191,36,.5); color:#fbbf24; }
  .hunk { margin:10px 14px 16px; padding:8px 12px; border:1px solid #21262d; border-left:3px solid #30363d; border-radius:6px; }
  .hunkhead { display:flex; justify-content:space-between; gap:12px; }
  .hunkloc { color:#8b949e; font-size:12px; }
  .risknum { font-weight:700; font-size:12px; }
  .chips { margin:6px 0; display:flex; gap:6px; flex-wrap:wrap; }
  .chip { font-size:11px; background:#161b22; border:1px solid #30363d; border-radius:10px; padding:1px 8px; color:#a5b1bd; }
  .llmchip { border-color:#1f6feb; color:#79c0ff; }
  pre { margin:0; padding:8px 0; overflow-x:auto; font-size:12px; line-height:1.55; }
  .al { display:block; color:#7ee2a8; background:rgba(46,160,67,.12); }
  .dl { display:block; color:#ffb3b3; background:rgba(248,81,73,.12); }
  .ct { color:#8b949e; }
  .ocrbox { margin:6px 0 10px; border:1px solid #1c3a5e; border-radius:6px; background:rgba(31,111,235,.06); padding:6px 10px; }
  .ocrhead { font-size:11px; color:#79c0ff; margin-bottom:4px; }
  .ocritem { display:flex; gap:8px; align-items:baseline; border-left:2px solid #8b949e; padding:2px 0 2px 8px; margin:4px 0; }
  .sev { font-size:11px; font-weight:700; text-transform:uppercase; flex:none; }
  .ocrtext { color:#c9d1d9; }
  .foot { margin-top:28px; color:#8b949e; font-size:11px; }
</style>
</head>
<body>
  <h1>review<em>heat</em> — ${esc(meta.repoName)}</h1>
  <p class="sub">${esc(meta.branch)}@${esc(meta.commit)} · ${esc(meta.subject)} · ${esc(meta.mode)} · generated ${esc(meta.generatedAt)}</p>

  <div class="cards">
    <div class="card hot"><div class="n">${totals.redLines}</div><div class="l">lines to review (${pct}%)</div></div>
    <div class="card"><div class="n">${totals.added}</div><div class="l">added lines</div></div>
    <div class="card"><div class="n">${totals.removed}</div><div class="l">removed lines</div></div>
    <div class="card"><div class="n">${totals.files}</div><div class="l">files changed</div></div>
    ${ocrStats ? `<div class="card"><div class="n" style="color:#79c0ff">${ocrStats.pinned + ocrStats.fileLevel}</div><div class="l">ocr findings pinned</div></div>` : ''}
  </div>

  ${body || '<p class="ct">No textual changes found.</p>'}

  <p class="foot">Generated by reviewheat — review the 5% of AI-generated code that actually matters.</p>
</body>
</html>
`;
}
