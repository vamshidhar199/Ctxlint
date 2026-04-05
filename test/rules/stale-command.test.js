import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { staleCommand } from '../../src/rules/stale-command.js';
import { parseContextFile } from '../../src/parser/context-file.js';
import { scanProject } from '../../src/detector/project.js';

const STALE_REPO = join(new URL('.', import.meta.url).pathname, '../fixtures/stale-repo');
const BLOATED_REPO = join(new URL('.', import.meta.url).pathname, '../fixtures/bloated-repo');

describe('stale-command rule', () => {
  it('flags a script that does not exist in package.json', () => {
    const content = '- Test: `pnpm test:e2e`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleCommand.run(parsed, projectData);

    expect(diagnostics.some(d => d.message.includes('test:e2e'))).toBe(true);
    expect(diagnostics.find(d => d.message.includes('test:e2e')).severity).toBe('error');
  });

  it('flags lint:fix when only lint exists', () => {
    const content = '- Lint: `pnpm lint:fix`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleCommand.run(parsed, projectData);

    expect(diagnostics.some(d => d.message.includes('lint:fix'))).toBe(true);
  });

  it('does NOT flag a valid script', () => {
    const content = '- Test: `pnpm test`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleCommand.run(parsed, projectData);

    expect(diagnostics.every(d => !d.message.includes('"test"'))).toBe(true);
  });

  it('flags npm run install (not a real script)', () => {
    const content = '- Install: `npm run install`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(BLOATED_REPO);

    const diagnostics = staleCommand.run(parsed, projectData);

    expect(diagnostics.some(d => d.message.includes('install'))).toBe(true);
  });

  it('flags npm run test:integration (missing script)', () => {
    const content = '- Test: `npm run test:integration`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(BLOATED_REPO);

    const diagnostics = staleCommand.run(parsed, projectData);

    expect(diagnostics.some(d => d.message.includes('test:integration'))).toBe(true);
  });

  it('flags npm run format (missing script)', () => {
    const content = '- Lint: `npm run format`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(BLOATED_REPO);

    const diagnostics = staleCommand.run(parsed, projectData);

    expect(diagnostics.some(d => d.message.includes('format'))).toBe(true);
  });

  it('warns on npm vs pnpm mismatch', () => {
    const content = '- Install: `npm run install`\n- Test: `npm run test`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(BLOATED_REPO); // has pnpm-lock.yaml

    const diagnostics = staleCommand.run(parsed, projectData);

    const mismatch = diagnostics.find(d => d.severity === 'warn' && d.message.includes('pnpm'));
    expect(mismatch).toBeDefined();
  });

  it('includes available scripts in suggestion', () => {
    const content = '- Test: `pnpm test:e2e`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleCommand.run(parsed, projectData);
    const diag = diagnostics.find(d => d.message.includes('test:e2e'));

    expect(diag.suggestion).toMatch(/Available scripts/);
  });

  it('does NOT flag commands inside code blocks', () => {
    const content = '```\npnpm test:e2e\n```';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleCommand.run(parsed, projectData);
    expect(diagnostics).toHaveLength(0);
  });
});
