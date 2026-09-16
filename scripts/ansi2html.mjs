// 把 reviewheat 的 ANSI 终端输出转成终端风格的独立 HTML（demo GIF 素材用）
// 用法：node dist/cli.js --diff-file ... --no-open | npx tsx scripts/ansi2html.mjs demo/terminal.html
import { readFileSync, writeFileSync } from 'node:fs';

const outPath = process.argv[2] ?? 'demo/terminal.html';
const input = readFileSync(0, 'utf8');

const COLORS = {
  30: '#000', 31: '#f87171', 32: '#4ade80', 33: '#fbbf24', 34: '#60a5fa',
  35: '#e879f9', 36: '#22d3ee', 37: '#e6edf3', 90: '#8b949e',
};

let html = input
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('\x1b[1m', '<b>')
  .replaceAll('\x1b[2m', '<span class="dim">')
  .replaceAll('\x1b[0m', '</span></b>')
  .replace(/\x1b\[3(\d)m/g, (_, c) => `<span style="color:${COLORS['3' + c]}">`)
  .replace(/\x1b\[9(\d)m/g, (_, c) => `<span style="color:${COLORS['9' + c]}">`);

// close any spans opened by color codes
html = html.replace(/<span style="color:[^"]+">(?![\s\S]*<\/span>)/g, (m) => m + '</span>');
// simpler: append closers per line for any unbalanced spans
html = html
  .split('\n')
  .map((line) => {
    const open = (line.match(/<span/g) ?? []).length - (line.match(/<span class="dim">/g) ?? []).length;
    const close = (line.match(/<\/span>/g) ?? []).length;
    const need = open - close;
    return need > 0 ? line + '</span>'.repeat(need) : line;
  })
  .join('\n');

const page = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin:0; background:#1a1d29; display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .term { width: 1040px; border-radius:10px; box-shadow:0 20px 60px rgba(0,0,0,.5); overflow:hidden; border:1px solid #30363d; }
  .bar { background:#2a2e3d; padding:10px 14px; display:flex; gap:8px; align-items:center; }
  .dot { width:12px; height:12px; border-radius:50%; }
  .title { margin-left:10px; color:#8b949e; font:12px ui-monospace,monospace; }
  pre { margin:0; padding:22px 26px; background:#0d1117; color:#c9d1d9; font:15px/1.7 "Cascadia Code",ui-monospace,Consolas,monospace; white-space:pre; }
  .dim { opacity:.75; }
</style></head>
<body><div class="term">
  <div class="bar">
    <span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span>
    <span class="title">terminal — npx reviewheat</span>
  </div>
  <pre>${html}</pre>
</div></body></html>`;

writeFileSync(outPath, page);
console.log('written', outPath);
