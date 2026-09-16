import type { AnalysisResult, FileEntry, HunkScore } from './types.js';
import { LEVEL_ORDER } from './types.js';

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** LLM is opt-in via environment: REVIEWHEAT_LLM_API_KEY (+ optional BASE_URL / MODEL).
 *  Works with any OpenAI-compatible endpoint, including local Ollama. No CLI flag
 *  ever accepts a key (it would leak into shell history). */
export function resolveLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  const apiKey = env.REVIEWHEAT_LLM_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (env.REVIEWHEAT_LLM_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = env.REVIEWHEAT_LLM_MODEL?.trim() || 'gpt-4o-mini';
  return { baseUrl, apiKey, model };
}

export interface LlmInsight {
  label: string;
  confidence: number;
  reason: string;
}

export interface LlmVerdict {
  index: number;
  label: string;
  confidence: number;
  reason: string;
}

export interface LlmCandidate {
  file: string;
  hunkIndex: number;
  location: string;
  snippet: string;
}

/** Ambiguous zone: hunks at "medium" — too noisy to demand full attention,
 *  too risky to skim blindly. That's exactly where semantics help. */
export function collectCandidates(result: AnalysisResult, cap = 40): LlmCandidate[] {
  const out: LlmCandidate[] = [];
  for (const e of result.files) {
    if (e.score.isChurn || e.score.isDoc || e.score.isTest) continue;
    e.file.hunks.forEach((h, hunkIndex) => {
      const s: HunkScore = e.score.hunks[hunkIndex];
      if (s.level !== 'medium' || out.length >= cap) return;
      const lines = [
        ...h.removed.slice(0, 12).map((l) => `-${l}`),
        ...h.added.slice(0, 20).map((l) => `+${l}`),
      ].join('\n');
      out.push({
        file: e.file.newPath || e.file.oldPath,
        hunkIndex,
        location: `${e.file.newPath} @ +${h.newStart}`,
        snippet: lines.slice(0, 1200),
      });
    });
  }
  return out;
}

const CLASSIFICATION_RULES = `Classify each hunk as exactly one of:
- "cosmetic": formatting, whitespace, comments, docs, renames with no logic impact
- "refactor": code reorganized but behavior is unchanged
- "behavioral": logic that alters program behavior
- "risky": behavioral AND likely to introduce a regression (error paths, edge cases, concurrency, security)
Respond with ONLY a JSON array, one object per hunk, in order:
[{"index": <hunk index>, "label": "<cosmetic|refactor|behavioral|risky>", "confidence": <0.0-1.0>, "reason": "<one short sentence>"}]
No prose outside the JSON.`;

export function buildClassificationPrompt(candidates: LlmCandidate[]): string {
  const body = candidates
    .map(
      (c, i) =>
        `--- hunk ${i} | index=${i} | ${c.location} ---\n${c.snippet}`
    )
    .join('\n\n');
  return `${CLASSIFICATION_RULES}\n\n${body}\n\nTotal hunks: ${candidates.length}.`;
}

/** Tolerant parse: strips code fences, finds the JSON array, drops bad entries. */
export function parseClassificationJson(text: string): LlmVerdict[] {
  const fence = text.indexOf('[');
  const fenceEnd = text.lastIndexOf(']');
  if (fence === -1 || fenceEnd === -1) throw new Error('no JSON array in LLM response');
  const parsed: unknown = JSON.parse(text.slice(fence, fenceEnd + 1));
  if (!Array.isArray(parsed)) throw new Error('LLM response is not an array');
  return parsed
    .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
    .map((v) => ({
      index: Number(v.index),
      label: String(v.label ?? '').toLowerCase(),
      confidence: Math.max(0, Math.min(1, Number(v.confidence ?? 0))),
      reason: String(v.reason ?? '').slice(0, 200),
    }))
    .filter((v) => Number.isInteger(v.index) && v.label);
}

export async function chat(
  cfg: LlmConfig,
  userPrompt: string,
  systemPrompt: string,
  timeoutMs = 120_000
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`LLM API ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return String(data?.choices?.[0]?.message?.content ?? '');
}

export async function classifyWithLlm(
  cfg: LlmConfig,
  prompt: string,
  timeoutMs = 90_000
): Promise<LlmVerdict[]> {
  const content = await chat(
    cfg,
    prompt,
    'You are a precise code-review triage assistant. Output only valid JSON.',
    timeoutMs
  );
  return parseClassificationJson(content);
}

/** Ask the LLM for one complete test file targeting the changed behavior. */
export async function generateTestCode(
  cfg: LlmConfig,
  prompt: string,
  timeoutMs = 180_000
): Promise<string> {
  const raw = await chat(
    cfg,
    prompt,
    'You are a senior test engineer. Respond with code only — no prose, no markdown fences.',
    timeoutMs
  );
  return raw
    .replace(/^```[a-z]*\r?\n?/i, '')
    .replace(/\r?\n?```\s*$/i, '')
    .trimEnd();
}

// ---------------------------------------------------------------------------
// Verdict application — bounded adjustments, always labeled as LLM-sourced
// ---------------------------------------------------------------------------

const COSMETIC_CAP = 15;
const REFACTOR_CAP = 35;
const BEHAVIORAL_FLOOR = 50;
const RISKY_FLOOR = 75;
const CONFIDENCE_GATE = 0.6;

export interface LlmApplyStats {
  candidates: number;
  classified: number;
  adjusted: number;
}

export function applyVerdicts(
  result: AnalysisResult,
  candidates: LlmCandidate[],
  verdicts: LlmVerdict[]
): LlmApplyStats {
  const stats: LlmApplyStats = { candidates: candidates.length, classified: 0, adjusted: 0 };
  for (const v of verdicts) {
    const cand = candidates[v.index];
    if (!cand) continue;
    const entry = result.files.find(
      (e) => (e.file.newPath || e.file.oldPath) === cand.file
    );
    if (!entry) continue;
    const hs = entry.score.hunks[cand.hunkIndex];
    if (!hs) continue;
    stats.classified++;
    const insight: LlmInsight = { label: v.label, confidence: v.confidence, reason: v.reason };
    hs.llm = [...(hs.llm ?? []), insight];

    const before = hs.risk;
    if (v.label === 'cosmetic') hs.risk = Math.min(hs.risk, COSMETIC_CAP);
    else if (v.label === 'refactor') hs.risk = Math.min(hs.risk, REFACTOR_CAP);
    else if (v.label === 'behavioral' && v.confidence >= CONFIDENCE_GATE)
      hs.risk = Math.max(hs.risk, BEHAVIORAL_FLOOR);
    else if (v.label === 'risky' && v.confidence >= CONFIDENCE_GATE)
      hs.risk = Math.max(hs.risk, RISKY_FLOOR);
    hs.risk = Math.max(0, Math.min(100, hs.risk));
    if (hs.risk !== before) stats.adjusted++;
    hs.level = levelOf(hs.risk);
  }
  // file score follows its worst hunk
  for (const e of result.files) {
    const worst = e.score.hunks.reduce((m, h) => Math.max(m, h.risk), 0);
    e.score.risk = worst;
    e.score.level = levelOf(worst);
  }
  return stats;

  function levelOf(risk: number) {
    if (risk < 25) return 'low' as const;
    if (risk < 50) return 'medium' as const;
    if (risk < 75) return 'high' as const;
    return 'critical' as const;
  }
}

// ---------------------------------------------------------------------------
// Targeted test generation for red zones
// ---------------------------------------------------------------------------

const EXT_LANG: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript (React)', '.js': 'JavaScript', '.jsx': 'JavaScript (React)',
  '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.py': 'Python', '.go': 'Go', '.rs': 'Rust',
  '.java': 'Java', '.rb': 'Ruby', '.php': 'PHP', '.cs': 'C#',
};

const EXT_TEST: Record<string, { ext: string; frame: string }> = {
  '.ts': { ext: 'test.ts', frame: 'vitest or jest style (describe/it/expect)' },
  '.tsx': { ext: 'test.tsx', frame: 'vitest or jest style' },
  '.js': { ext: 'test.js', frame: 'jest style (describe/it/expect)' },
  '.jsx': { ext: 'test.jsx', frame: 'jest style' },
  '.py': { ext: 'test.py', frame: 'pytest style (test_ functions, assert)' },
  '.go': { ext: 'test.go', frame: 'go test style (func TestXxx(t *testing.T))' },
  '.rs': { ext: 'test.rs', frame: 'rust #[cfg(test)] module with #[test] fns' },
};

export function testTargetFor(path: string): { lang: string; testFile: string; frame: string } | null {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = path.slice(dot);
  const lang = EXT_LANG[ext];
  const t = EXT_TEST[ext];
  if (!lang || !t) return null;
  const stem = path.slice(0, dot).split('/').pop() ?? path;
  return { lang, testFile: `reviewheat-suggested-tests/${stem}.${t.ext}`, frame: t.frame };
}

export function buildTestPrompt(entry: FileEntry): string | null {
  const path = entry.file.newPath || entry.file.oldPath;
  const target = testTargetFor(path);
  if (!target) return null;
  const diff = entry.file.hunks
    .map((h, i) => `--- hunk ${i} @ +${h.newStart} ---\n` + [
      ...h.removed.slice(0, 15).map((l) => `-${l}`),
      ...h.added.slice(0, 25).map((l) => `+${l}`),
    ].join('\n'))
    .join('\n\n');
  return `You are a senior test engineer. The following diff in "${path}" (${target.lang}) contains
HIGH-risk behavioral changes that currently have no test coverage.

Write ONE complete, runnable test file (${target.frame}) that targets exactly the
changed behavior — happy path first, then the edge cases the diff suggests
(error returns, boundary conditions, null/empty inputs). Use concise but real
assertions; do not stub the module under test.

Respond with ONLY the code, no explanations, no markdown fences.

DIFF:
${diff.slice(0, 6000)}`;
}

/** Red files (HIGH+ with test gap), capped so one run stays cheap. */
export function redZoneTargets(result: AnalysisResult, cap = 5): FileEntry[] {
  return result.files
    .filter((e) => LEVEL_ORDER[e.score.level] >= LEVEL_ORDER.high && e.score.testGap)
    .sort((a, b) => b.score.risk - a.score.risk)
    .slice(0, cap);
}
