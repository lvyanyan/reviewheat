// 临时探针：拉单个 PR 的 diff 并逐文件打印打分因子（调优用）
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseDiff } from '../src/diff.js';
import { analyze } from '../src/score.js';

const [, , repoPath, prNumber] = process.argv;
const TOKEN = readFileSync('E:/oss-contrib/.token', 'utf8').replace(/\s+/g, '');
const diff = execFileSync(
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
    'Accept: application/vnd.github.v3.diff',
    `https://api.github.com/repos/${repoPath}/pulls/${prNumber}`,
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);
const r = analyze(parseDiff(diff), {
  mode: 'probe',
  repoName: repoPath,
  branch: '',
  commit: '',
  subject: `#${prNumber}`,
  generatedAt: '',
});
for (const e of r.files) {
  console.log(e.file.newPath, '→ risk', e.score.risk, e.score.level, '| testGap', e.score.testGap);
  e.file.hunks.forEach((fh, i) => {
    const h = e.score.hunks[i];
    console.log(
      `  hunk +${fh.addedCount}/-${fh.removedCount} risk ${h.risk} [${h.factors
        .map((f) => `${f.id}:${f.weight.toFixed(2)}`)
        .join(' ')}]`
    );
  });
}
