import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, unlinkSync, copyFileSync } from 'fs';
import { slim } from '../../src/commands/slim.js';

const BLOATED_REPO = join(new URL('.', import.meta.url).pathname, '../fixtures/bloated-repo');
const BLOATED_FILE = join(BLOATED_REPO, 'CLAUDE.md');

// We need a temp copy so we don't destroy the fixture
const TEMP_FILE = join(BLOATED_REPO, 'CLAUDE.test-slim.md');

describe('slim command', () => {
  beforeEach(() => {
    // Copy fixture to temp file for destructive tests
    copyFileSync(BLOATED_FILE, TEMP_FILE);
  });

  afterEach(() => {
    // Clean up temp file and any backups
    if (existsSync(TEMP_FILE)) unlinkSync(TEMP_FILE);
    if (existsSync(TEMP_FILE + '.bak')) unlinkSync(TEMP_FILE + '.bak');
  });

  it('returns 0 for --dry-run on a bloated file', async () => {
    const exitCode = await slim(BLOATED_FILE, { dryRun: true });
    expect(exitCode).toBe(0);
  });

  it('--dry-run does not modify the file', async () => {
    const before = readFileSync(BLOATED_FILE, 'utf8');
    await slim(BLOATED_FILE, { dryRun: true });
    const after = readFileSync(BLOATED_FILE, 'utf8');
    expect(before).toBe(after);
  });

  it('writes slimmed file when not dry-run', async () => {
    const before = readFileSync(TEMP_FILE, 'utf8');
    await slim(TEMP_FILE, { dryRun: false });
    const after = readFileSync(TEMP_FILE, 'utf8');
    expect(after.length).toBeLessThan(before.length);
  });

  it('slimmed file has fewer lines than original', async () => {
    const before = readFileSync(TEMP_FILE, 'utf8').split('\n').length;
    await slim(TEMP_FILE, { dryRun: false });
    const after = readFileSync(TEMP_FILE, 'utf8').split('\n').length;
    expect(after).toBeLessThan(before);
  });

  it('--backup creates a .bak file', async () => {
    await slim(TEMP_FILE, { dryRun: false, backup: true });
    expect(existsSync(TEMP_FILE + '.bak')).toBe(true);
  });

  it('.bak file contains original content', async () => {
    const before = readFileSync(TEMP_FILE, 'utf8');
    await slim(TEMP_FILE, { dryRun: false, backup: true });
    const bak = readFileSync(TEMP_FILE + '.bak', 'utf8');
    expect(bak).toBe(before);
  });

  it('slimmed content does not contain directory tree characters', async () => {
    await slim(TEMP_FILE, { dryRun: false });
    const after = readFileSync(TEMP_FILE, 'utf8');
    expect(after).not.toMatch(/[├└│]/);
  });

  it('returns 2 for a non-existent file', async () => {
    const exitCode = await slim('/tmp/does-not-exist-xyz.md', { dryRun: true });
    expect(exitCode).toBe(2);
  });
});
