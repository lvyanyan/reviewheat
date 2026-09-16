import { execFileSync } from 'node:child_process';

export type DiffMode = 'worktree' | 'last' | 'ref';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function getDiffText(cwd: string, mode: DiffMode, ref?: string): string {
  const range =
    mode === 'last'
      ? ['HEAD~1', 'HEAD']
      : mode === 'ref' && ref
        ? [`${ref}~1`, ref]
        : ['HEAD'];
  return git(cwd, ['-c', 'core.quotepath=false', 'diff', '--find-renames', ...range]);
}

export interface HeadInfo {
  branch: string;
  commit: string;
  subject: string;
}

export function getHeadInfo(cwd: string): HeadInfo {
  const safe = (fn: () => string, fallback: string) => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  return {
    branch: safe(() => git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(), 'unknown'),
    commit: safe(() => git(cwd, ['rev-parse', '--short', 'HEAD']).trim(), 'unknown'),
    subject: safe(() => git(cwd, ['log', '-1', '--pretty=%s']).trim(), ''),
  };
}

const OPENERS: Record<string, [string, string[]]> = {
  win32: ['cmd.exe', ['/c', 'start', '']],
  darwin: ['open', []],
  linux: ['xdg-open', []],
};

export function openInBrowser(path: string): void {
  const opener = OPENERS[process.platform];
  if (!opener) return;
  try {
    execFileSync(opener[0], [...opener[1], path], { stdio: 'ignore', shell: process.platform === 'win32' });
  } catch {
    // best effort — the report path is printed to the terminal anyway
  }
}
