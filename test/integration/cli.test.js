import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';

const ROOT = join(new URL('.', import.meta.url).pathname, '../..');
const BIN = join(ROOT, 'bin/ctxlint.js');
const FIXTURES = join(ROOT, 'test/fixtures');

function run(args, cwd = ROOT) {
  try {
    const stdout = execSync(`node "${BIN}" ${args}`, {
      encoding: 'utf8',
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: typeof err.status === 'number' ? err.status : 1,
    };
  }
}

describe('CLI integration', () => {
  describe('check command', () => {
    it('exits 0 and reports 0 errors for healthy-repo', () => {
      const { exitCode, stdout } = run(`check "${join(FIXTURES, 'healthy-repo')}"`);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('0 errors');
      expect(stdout).toContain('0 warnings');
    });

    it('exits 1 for stale-repo (has errors)', () => {
      const { exitCode, stdout } = run(`check "${join(FIXTURES, 'stale-repo')}"`);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('stale-command');
      expect(stdout).toContain('stale-file-ref');
    });

    it('stale-repo output flags test:e2e as missing', () => {
      const { stdout } = run(`check "${join(FIXTURES, 'stale-repo')}"`);
      expect(stdout).toContain('test:e2e');
    });

    it('exits 1 for bloated-repo (has errors)', () => {
      const { exitCode, stdout } = run(`check "${join(FIXTURES, 'bloated-repo')}"`);
      expect(exitCode).toBe(1);
    });

    it('bloated-repo flags no-directory-tree', () => {
      const { stdout } = run(`check "${join(FIXTURES, 'bloated-repo')}"`);
      expect(stdout).toContain('no-directory-tree');
    });

    it('bloated-repo flags no-style-guide', () => {
      const { stdout } = run(`check "${join(FIXTURES, 'bloated-repo')}"`);
      expect(stdout).toContain('no-style-guide');
    });

    it('bloated-repo flags token-budget', () => {
      const { stdout } = run(`check "${join(FIXTURES, 'bloated-repo')}"`);
      expect(stdout).toContain('token-budget');
    });

    it('exits 0 for no-context-repo with helpful message', () => {
      const { exitCode, stdout } = run(`check "${join(FIXTURES, 'no-context-repo')}"`);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('No context file found');
    });

    it('produces valid JSON with --format json for stale-repo', () => {
      const { stdout } = run(`check --format json "${join(FIXTURES, 'stale-repo')}"`);
      let parsed;
      expect(() => { parsed = JSON.parse(stdout); }).not.toThrow();
      expect(parsed).toHaveProperty('file');
      expect(parsed).toHaveProperty('diagnostics');
      expect(parsed).toHaveProperty('summary');
      expect(parsed.summary.errors).toBeGreaterThanOrEqual(1);
    });

    it('JSON format includes summary counts', () => {
      const { stdout } = run(`check --format json "${join(FIXTURES, 'healthy-repo')}"`);
      const parsed = JSON.parse(stdout);
      expect(parsed.summary).toHaveProperty('errors');
      expect(parsed.summary).toHaveProperty('warnings');
      expect(parsed.summary.errors).toBe(0);
      expect(parsed.summary.warnings).toBe(0);
    });

    it('--severity warn filters out info diagnostics', () => {
      const { stdout } = run(`check --severity warn "${join(FIXTURES, 'bloated-repo')}"`);
      expect(stdout).not.toContain('no-style-guide');
    });

    it('exits 0 and passes clean against own AGENTS.md', () => {
      const { exitCode, stdout } = run(`check "${ROOT}"`);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('0 errors');
      expect(stdout).toContain('0 warnings');
    });
  });

  describe('init command', () => {
    it('--dry-run outputs content without writing files', () => {
      const { exitCode, stdout } = run(`init --dry-run "${join(FIXTURES, 'no-context-repo')}"`);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('pnpm');
      expect(stdout).toContain('## Build & test');
    });

    it('--dry-run output is under 40 lines', () => {
      const { stdout } = run(`init --dry-run "${join(FIXTURES, 'no-context-repo')}"`);
      const lines = stdout.split('\n');
      expect(lines.length).toBeLessThan(40);
    });

    it('--dry-run output does not contain directory tree', () => {
      const { stdout } = run(`init --dry-run "${join(FIXTURES, 'no-context-repo')}"`);
      expect(stdout).not.toMatch(/[├└│]/);
    });

    it('detects vitest test framework in no-context-repo', () => {
      const { stdout } = run(`init --dry-run "${join(FIXTURES, 'no-context-repo')}"`);
      expect(stdout).toContain('vitest');
    });

    it('exits 1 when context file already exists without --force', () => {
      const { exitCode } = run(`init "${join(FIXTURES, 'healthy-repo')}"`);
      expect(exitCode).toBe(1);
    });

    it('--force overwrites existing context file with --dry-run', () => {
      const { exitCode } = run(`init --dry-run --force "${join(FIXTURES, 'healthy-repo')}"`);
      expect(exitCode).toBe(0);
    });
  });

  describe('slim command', () => {
    it('--dry-run reports line reduction for bloated-repo', () => {
      const { exitCode, stdout } = run(`slim --dry-run "${join(FIXTURES, 'bloated-repo', 'CLAUDE.md')}"`);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Lines removed');
      expect(stdout).toContain('Tokens saved');
    });

    it('--dry-run shows removed lines in diff output', () => {
      const { stdout } = run(`slim --dry-run "${join(FIXTURES, 'bloated-repo', 'CLAUDE.md')}"`);
      // Removed lines are prefixed with ANSI red + "- "
      expect(stdout).toContain('\x1b[31m- ');
    });

    it('exits 2 for non-existent file', () => {
      const { exitCode } = run('slim --dry-run /tmp/no-such-file-xyz.md');
      expect(exitCode).toBe(2);
    });
  });

  describe('diff command', () => {
    it('runs without crashing on a valid project', () => {
      const { exitCode } = run(`diff "${join(FIXTURES, 'stale-repo')}"`);
      // Exit 0 = no drift detected (or git not available), not a crash
      expect(exitCode).toBeLessThanOrEqual(1);
    });
  });

  describe('default behavior', () => {
    it('running with no subcommand checks current directory', () => {
      const { stdout, exitCode } = run('');
      // Should run check on ROOT (which has AGENTS.md)
      expect(exitCode).toBe(0);
      // Should show summary
      expect(stdout).toContain('errors');
    });

    it('passing a path without subcommand runs check on that path', () => {
      const { exitCode, stdout } = run(`"${join(FIXTURES, 'healthy-repo')}"`);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('0 errors');
    });
  });
});
