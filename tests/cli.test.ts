import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { failOnViolations, VERSION, buildHelp } from '../src/cli.js';
import { analyze } from '../src/score.js';

describe('cli', () => {
  it('keeps VERSION in sync with package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(VERSION).toBe(pkg.version);
  });

  it('documents the shipped and planned options', () => {
    const help = buildHelp();
    expect(help).toContain('--last');
    expect(help).toContain('--ref');
    expect(help).toContain('--ocr');
    expect(help).toContain('--llm');
    expect(help).toContain('--fail-on');
    expect(help).toContain('--no-open');
  });

  it('flags only high+ files that lack co-changed tests', () => {
    const hot = {
      oldPath: 'src/g.ts',
      newPath: 'src/g.ts',
      status: 'modified',
      binary: false,
      hunks: [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 2,
          context: '',
          added: ['if (a && b) { throw new Error("x"); }', 'return a;'],
          removed: ['if (a) {'],
          addedCount: 2,
          removedCount: 1,
        },
      ],
      addedCount: 2,
      removedCount: 1,
    } as const;
    const result = analyze([hot], {
      mode: 'worktree',
      repoName: 't',
      branch: 'main',
      commit: 'abc',
      subject: '',
      generatedAt: 'now',
    });
    expect(['high', 'critical']).toContain(result.files[0].score.level);
    expect(failOnViolations(result, 'high').map((e) => e.file.newPath)).toEqual(['src/g.ts']);
    result.files[0].score.testGap = false;
    expect(failOnViolations(result, 'high')).toHaveLength(0);
  });
});
