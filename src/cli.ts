#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { parseDiff } from './diff.js';
import { getDiffText, getHeadInfo, openInBrowser, type DiffMode } from './git.js';
import {
  applyVerdicts,
  buildClassificationPrompt,
  buildTestPrompt,
  classifyWithLlm,
  collectCandidates,
  generateTestCode,
  redZoneTargets,
  resolveLlmConfig,
  testTargetFor,
  type LlmApplyStats,
} from './llm.js';
import { applyOcr, parseOcrJson, type OcrStats } from './ocr.js';
import { renderHtml } from './reportHtml.js';
import { analyze } from './score.js';
import { renderTerminal } from './terminal.js';
import { LEVEL_ORDER, type AnalysisResult, type FileEntry, type RiskLevel } from './types.js';

export const VERSION = '0.4.0';

export function buildHelp(): string {
  return `reviewheat ${VERSION}
Risk heatmap for pull requests — review the code that matters.

Usage
  $ reviewheat [options]

Options
  --last            Analyze the last commit instead of uncommitted changes
  --ref <sha>       Analyze a specific commit (<sha>~1..<sha>)
  --diff-file <f>   Analyze a unified diff file instead of the local git repo
  --pr <number>     Analyze a GitHub pull request (planned — v0.5)
  --ocr <file|->    Pin open-code-review findings onto the heatmap ('-' reads stdin)
  --with-ocr        One command: run \`ocr review\` itself, then overlay its findings
                    (requires ocr installed + LLM configured; it will spend tokens)
  --llm             Classify ambiguous (medium) hunks with an LLM — env config:
                    REVIEWHEAT_LLM_API_KEY / _BASE_URL / _MODEL (Ollama works)
  --tests           Generate test-file suggestions for HIGH+ files lacking tests
                    (same env config; files land in reviewheat-suggested-tests/)
  --fail-on <risk>  Exit 1 when a HIGH+ file has no co-changed test (low|medium|high|critical)
  --out <file>      Report path (default: reviewheat-report.html)
  --repo <label>    Display label for the repo (useful with --diff-file)
  --no-open         Do not open the HTML report in the browser
  -h, --help        Show this help
  -v, --version     Show version

How it works
  Deterministic, offline heuristics score every hunk: behavioral change vs
  cosmetic churn, control-flow and API-definition hits, complexity delta,
  deletions, and whether any test file changed alongside. The 5% that matters
  shows up red; the churn stays green.
`;
}

interface Options {
  help?: boolean;
  version?: boolean;
  last?: boolean;
  ref?: string;
  diffFile?: string;
  pr?: string;
  ocr?: string;
  withOcr?: boolean;
  llm?: boolean;
  tests?: boolean;
  failOn?: RiskLevel;
  out?: string;
  repo?: string;
  open: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-h': case '--help': opts.help = true; break;
      case '-v': case '--version': opts.version = true; break;
      case '--last': opts.last = true; break;
      case '--ref': opts.ref = argv[++i] ?? ''; break;
      case '--diff-file': opts.diffFile = argv[++i] ?? ''; break;
      case '--llm': opts.llm = true; break;
      case '--tests': opts.tests = true; break;
      case '--no-open': opts.open = false; break;
      case '--pr': opts.pr = argv[++i] ?? ''; break;
      case '--ocr': opts.ocr = argv[++i] ?? ''; break;
      case '--with-ocr': opts.withOcr = true; break;
      case '--out': opts.out = argv[++i]; break;
      case '--repo': opts.repo = argv[++i]; break;
      case '--fail-on': {
        const v = (argv[++i] ?? '') as RiskLevel;
        if (!(v in LEVEL_ORDER)) {
          throw new Error(`--fail-on expects one of: low | medium | high | critical (got "${v}")`);
        }
        opts.failOn = v;
        break;
      }
      default:
        throw new Error(`Unknown option: ${a}\nRun \`reviewheat --help\` for usage.`);
    }
  }
  return opts;
}

const PLANNED: Record<string, string> = {
  '--pr': 'analyzing GitHub pull requests lands in v0.5',
};

const OCR_BINARY = process.platform === 'win32' ? 'ocr.cmd' : 'ocr';

/** Run `ocr review --format json --output <tmp>`; returns the JSON text. OCR's own
 *  stdout/stderr stream through so the user watches progress (it can take minutes). */
function runOcrAndCapture(): string {
  const out = resolve(tmpdir(), `reviewheat-ocr-${Date.now()}.json`);
  const quoted = (s: string) => (process.platform === 'win32' ? `"${s}"` : s);
  const cmd = [quoted(OCR_BINARY), 'review', '--format', 'json', '--output', quoted(out)].join(' ');
  try {
    console.error('running `ocr review --format json` — uses your configured LLM, may take minutes…');
    execFileSync(cmd, {
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: process.platform === 'win32', // Node refuses to spawn .cmd directly (CVE-2024-27980)
      maxBuffer: 16 * 1024 * 1024,
    });
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(out, { force: true });
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  let opts: Options;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return 2;
  }

  if (opts.version) { console.log(VERSION); return 0; }
  if (opts.help) { console.log(buildHelp()); return 0; }

  for (const [flag, note] of Object.entries(PLANNED)) {
    const used = flag === '--llm' ? opts.llm : opts.pr !== undefined;
    if (used) {
      console.error(`${flag}: ${note} — track https://github.com/lvyanyan/reviewheat`);
      return 2;
    }
  }

  const cwd = process.cwd();
  const mode: 'diff-file' | DiffMode = opts.diffFile ? 'diff-file' : opts.last ? 'last' : opts.ref ? 'ref' : 'worktree';

  let diffText: string;
  try {
    if (opts.diffFile) {
      diffText = readFileSync(resolve(opts.diffFile), 'utf8');
    } else {
      diffText = getDiffText(cwd, mode as DiffMode, opts.ref);
    }
  } catch {
    console.error(
      opts.diffFile
        ? `error: cannot read diff file ${opts.diffFile}.`
        : mode === 'worktree'
          ? 'error: not a git repository (or git is unavailable). Run reviewheat inside a git repo.'
          : `error: cannot diff ${mode === 'last' ? 'HEAD~1..HEAD' : `${opts.ref}~1..${opts.ref}`} — bad ref, or the commit has no parent?`
    );
    return 2;
  }

  const files = parseDiff(diffText);
  const head = opts.diffFile ? { branch: '', commit: '', subject: '' } : getHeadInfo(cwd);
  const result = analyze(files, {
    mode: opts.diffFile ? 'diff-file' : mode === 'last' ? 'last-commit' : mode === 'ref' ? `ref ${opts.ref?.slice(0, 10)}` : 'worktree',
    repoName: opts.repo ?? basename(cwd),
    branch: head.branch,
    commit: head.commit,
    subject: head.subject,
    generatedAt: new Date().toISOString(),
  });

  if (result.totals.files === 0) {
    console.log(
      mode === 'worktree'
        ? 'No uncommitted changes found. Tip: use --last to analyze the last commit.'
        : `No changes found in ${mode === 'last' ? 'the last commit' : opts.ref}.`
    );
    return 0;
  }

  let ocrStats: OcrStats | undefined;
  if (opts.withOcr && opts.ocr) {
    console.error('--with-ocr and --ocr are mutually exclusive (run OCR, or read a JSON).');
    return 2;
  }
  if (opts.withOcr) {
    try {
      ocrStats = applyOcr(result, parseOcrJson(runOcrAndCapture()));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(
        msg.includes('ENOENT')
          ? `--with-ocr: \`${OCR_BINARY}\` not found. Install it first: npm i -g @alibaba-group/open-code-review (and configure an LLM, or use its delegation mode).`
          : `--with-ocr: OCR run failed (${msg.split('\n')[0]}). Its findings were not overlaid.`
      );
      return 2;
    }
  }
  if (opts.ocr) {
    try {
      const raw =
        opts.ocr === '-'
          ? readFileSync(0, 'utf8') // '-' = read from stdin: ocr ... --format json | reviewheat --ocr -
          : readFileSync(resolve(opts.ocr), 'utf8');
      ocrStats = applyOcr(result, parseOcrJson(raw));
    } catch (e) {
      console.error(
        `--ocr: cannot read or parse ${opts.ocr === '-' ? 'stdin' : opts.ocr} (${e instanceof Error ? e.message : e}). ` +
          `Expected open-code-review output: ocr --format json --output ocr.json`
      );
      return 2;
    }
  }

  let llmStats: LlmApplyStats | undefined;
  const generatedTests: string[] = [];
  if (opts.llm || opts.tests) {
    const cfg = resolveLlmConfig();
    if (!cfg) {
      console.error(
        '--llm/--tests: no LLM configured. Set REVIEWHEAT_LLM_API_KEY (+ optional\n' +
          'REVIEWHEAT_LLM_BASE_URL and REVIEWHEAT_LLM_MODEL). Local Ollama works:\n' +
          '  REVIEWHEAT_LLM_BASE_URL=http://localhost:11434/v1 REVIEWHEAT_LLM_MODEL=qwen3:8b'
      );
      return 2;
    }
    if (opts.llm) {
      const candidates = collectCandidates(result);
      if (candidates.length === 0) {
        console.error('--llm: no ambiguous (medium) hunks to classify.');
      } else {
        console.error(`--llm: classifying ${candidates.length} hunks via ${cfg.model}…`);
        try {
          const verdicts = await classifyWithLlm(cfg, buildClassificationPrompt(candidates));
          llmStats = applyVerdicts(result, candidates, verdicts);
        } catch (e) {
          console.error(`--llm failed: ${e instanceof Error ? e.message : e}`);
          return 2;
        }
      }
    }
    if (opts.tests) {
      const targets = redZoneTargets(result);
      if (targets.length === 0) {
        console.error('--tests: no HIGH+ test-gap files — nothing to generate.');
      } else {
        mkdirSync('reviewheat-suggested-tests', { recursive: true });
        for (const entry of targets) {
          const prompt = buildTestPrompt(entry);
          if (!prompt) continue;
          const path = entry.file.newPath || entry.file.oldPath;
          console.error(`--tests: generating test file for ${path}…`);
          try {
            const code = await generateTestCode(cfg, prompt);
            const outPath = testTargetFor(path)!.testFile;
            writeFileSync(resolve(outPath), code.endsWith('\n') ? code : code + '\n');
            generatedTests.push(outPath);
          } catch (e) {
            console.error(`  ! ${path}: ${e instanceof Error ? e.message : e}`);
          }
        }
      }
    }
  }

  console.log(renderTerminal(result, opts.ocr ? ocrStats : undefined));
  if (llmStats) {
    console.log(
      `[llm] ${llmStats.classified}/${llmStats.candidates} ambiguous hunks classified, ${llmStats.adjusted} scores adjusted.`
    );
  }
  if (generatedTests.length > 0) {
    console.log(`[tests] ${generatedTests.length} suggestion file(s) written:`);
    for (const g of generatedTests) console.log('  ' + g);
  }

  const outPath = resolve(opts.out ?? 'reviewheat-report.html');
  writeFileSync(outPath, renderHtml(result, opts.ocr ? ocrStats : undefined));
  if (opts.open) openInBrowser(outPath);

  if (opts.failOn) {
    const worst = failOnViolations(result, opts.failOn);
    if (worst.length > 0) {
      console.error(
        `fail-on ${opts.failOn}: ${worst.map((e) => e.file.newPath).join(', ')} at or above ${opts.failOn} with no co-changed tests.`
      );
      return 1;
    }
  }
  return 0;
}

export function failOnViolations(result: AnalysisResult, level: RiskLevel): FileEntry[] {
  return result.files.filter(
    (e) => LEVEL_ORDER[e.score.level] >= LEVEL_ORDER[level] && e.score.testGap
  );
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (invokedDirectly) {
  Promise.resolve(main()).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(e instanceof Error ? (e.stack ?? e.message) : e);
      process.exitCode = 2;
    }
  );
}
