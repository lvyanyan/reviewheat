// 批量评测台：拉取真实已合并 PR 的 diff，喂给打分引擎，量化压缩比与疑似误报。
// 用法：npx tsx scripts/bench.mjs [每仓库PR数，默认5]
// 网络走 oss-contrib 的 SOCKS 隧道（127.0.0.1:1080），token 运行时读取，不入库。
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseDiff } from '../src/diff.js';
import { analyze, isChurnPath } from '../src/score.js';

const TOKEN = readFileSync('E:/oss-contrib/.token', 'utf8').replace(/\s+/g, '');
const REPOS = [
  'vitejs/vite',
  'vuejs/core',
  'axios/axios',
  'expressjs/express',
  'fastify/fastify',
  'gin-gonic/gin',
  // 第二轮扩充：Python / Rust(C++) / C / TS 强类型生态
  'pydantic/pydantic',
  'denoland/deno',
  'redis/redis',
  'colinhacks/zod',
];
const PER_REPO = Number(process.argv[2] ?? 5);

function gh(path, accept = 'application/vnd.github+json') {
  return execFileSync(
    'curl',
    [
      '-s',
      '--max-time',
      '40',
      '--socks5-hostname',
      '127.0.0.1:1080',
      '-H',
      `Authorization: Bearer ${TOKEN}`,
      '-H',
      `Accept: ${accept}`,
      `https://api.github.com${path}`,
    ],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }
  );
}

function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// 高风险文件里，这些特征大概率是误报（文档/快照/锁文件/纯配置）
const SUSPECT_RE = /\.(md|mdx|txt|snap|json|ya?ml|toml|ini|cfg)$/i;

const results = [];
for (const repo of REPOS) {
  const list = JSON.parse(
    gh(`/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=40`)
  );
  const merged = list.filter((p) => p.merged_at).slice(0, PER_REPO);
  for (const pr of merged) {
    try {
      const diff = gh(`/repos/${repo}/pulls/${pr.number}`, 'application/vnd.github.v3.diff');
      const files = parseDiff(diff);
      const result = analyze(files, {
        mode: 'bench',
        repoName: repo,
        branch: pr.head?.ref ?? '',
        commit: String(pr.merge_commit_sha ?? '').slice(0, 8),
        subject: pr.title,
        generatedAt: new Date().toISOString(),
      });
      const t = result.totals;
      const sorted = [...result.files].sort((a, b) => b.score.risk - a.score.risk);
      const hot = sorted.filter((e) => e.score.level === 'high' || e.score.level === 'critical');
      results.push({
        repo,
        number: pr.number,
        title: pr.title,
        files: t.files,
        added: t.added,
        removed: t.removed,
        redLines: t.redLines,
        compression: t.added ? t.redLines / t.added : 0,
        hotPaths: hot.map((e) => e.file.newPath),
        suspects: hot
          .map((e) => e.file.newPath)
          .filter((p) => SUSPECT_RE.test(p) && !isChurnPath(p)),
      });
      console.log(
        `#${pr.number} ${String(t.redLines).padStart(4)}/${String(t.added).padStart(5)} ` +
          `${(t.added ? Math.round((t.redLines / t.added) * 100) : 0).toString().padStart(3)}% ` +
          `${repo} — ${pr.title.slice(0, 70)}`
      );
    } catch (e) {
      console.error(`  ! skip ${repo}#${pr.number}: ${e.message.split('\n')[0]}`);
    }
  }
}

const comps = results.map((r) => r.compression);
const summary = {
  prs: results.length,
  medianCompression: median(comps),
  within30: comps.filter((c) => c <= 0.3).length,
  within50: comps.filter((c) => c <= 0.5).length,
  suspectPrs: results.filter((r) => r.suspects.length > 0).length,
};
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
console.log('\n=== SUSPECTS (high/critical on doc/config-ish files) ===');
for (const r of results.filter((r) => r.suspects.length > 0).slice(0, 15)) {
  console.log(`${r.repo}#${r.number} ${r.suspects.join(', ')}`);
}

writeFileSync('bench-results.json', JSON.stringify({ summary, results }, null, 2));
console.log('\nwritten to bench-results.json');
