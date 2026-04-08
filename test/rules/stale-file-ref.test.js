import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { staleFileRef } from '../../src/rules/stale-file-ref.js';
import { parseContextFile } from '../../src/parser/context-file.js';
import { scanProject } from '../../src/detector/project.js';

const STALE_REPO = join(new URL('.', import.meta.url).pathname, '../fixtures/stale-repo');

describe('stale-file-ref rule', () => {
  it('flags a reference to a non-existent file', () => {
    const content = '- Auth config: `src/config/auth-config.ts`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleFileRef.run(parsed, projectData);

    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].rule).toBe('stale-file-ref');
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].message).toContain('src/config/auth-config.ts');
  });

  it('does NOT flag a reference to an existing file', () => {
    const content = '- Database: `src/db/connection.ts`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleFileRef.run(parsed, projectData);

    expect(diagnostics).toHaveLength(0);
  });

  it('does NOT flag a reference to an existing file (src/index.ts)', () => {
    const content = '- Main entry: `src/index.ts`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleFileRef.run(parsed, projectData);

    expect(diagnostics).toHaveLength(0);
  });

  it('flags stale ref from full AGENTS.md fixture', () => {
    const content = `# AGENTS.md

## Build & test
- Install: \`pnpm install\`
- Test: \`pnpm test:e2e\`
- Lint: \`pnpm lint:fix\`

## Key files
- Auth config: \`src/config/auth-config.ts\`
- Database: \`src/db/connection.ts\`
- Main entry: \`src/index.ts\`
`;
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleFileRef.run(parsed, projectData);

    const stalePaths = diagnostics.map(d => d.message);
    expect(stalePaths.some(m => m.includes('src/config/auth-config.ts'))).toBe(true);

    // Existing files should NOT be flagged
    const messages = diagnostics.map(d => d.message);
    expect(messages.every(m => !m.includes('src/db/connection.ts'))).toBe(true);
    expect(messages.every(m => !m.includes('src/index.ts'))).toBe(true);
  });

  it('does NOT flag URLs', () => {
    const content = 'See https://example.com/auth-config.ts for docs';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleFileRef.run(parsed, projectData);
    expect(diagnostics).toHaveLength(0);
  });

  it('does NOT flag glob patterns', () => {
    const content = 'Run tests: `src/**/*.test.ts`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleFileRef.run(parsed, projectData);
    expect(diagnostics).toHaveLength(0);
  });

  it('does NOT flag file references inside code blocks', () => {
    const content = '```\nnpm install src/config/auth-config.ts\n```';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleFileRef.run(parsed, projectData);
    expect(diagnostics).toHaveLength(0);
  });

  it('provides a suggestion when a similar file exists elsewhere', () => {
    // connection.ts exists at src/db/connection.ts
    const content = '- Database: `src/connection.ts`';
    const parsed = parseContextFile(content);
    const projectData = scanProject(STALE_REPO);

    const diagnostics = staleFileRef.run(parsed, projectData);
    // It's stale (wrong path), and it should suggest the correct one
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].suggestion).toContain('src/db/connection.ts');
  });

  it('downgrades to warn with monorepo prefix suggestion when path is a suffix of an existing file', () => {
    // Simulates: context references "src/cli/next-dev.ts" but file exists at "packages/next/src/cli/next-dev.ts"
    const content = '- CLI entry: `src/cli/next-dev.ts`';
    const parsed = parseContextFile(content);
    const projectData = {
      dir: '/fake/monorepo',
      files: new Set(['packages/next/src/cli/next-dev.ts', 'packages/next/package.json']),
      dirs: new Set(['packages', 'packages/next', 'packages/next/src', 'packages/next/src/cli']),
    };

    const diagnostics = staleFileRef.run(parsed, projectData);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('warn');
    expect(diagnostics[0].message).toContain('needs a monorepo prefix');
    expect(diagnostics[0].suggestion).toContain('packages/next/src/cli/next-dev.ts');
  });

  it('emits error (not warn) when path does not match any suffix in the project', () => {
    const content = '- Old API: `src/old-api/handler.ts`';
    const parsed = parseContextFile(content);
    const projectData = {
      dir: '/fake/monorepo',
      files: new Set(['packages/next/src/new-api/handler.ts']),
      dirs: new Set(['packages', 'packages/next', 'packages/next/src', 'packages/next/src/new-api']),
    };

    const diagnostics = staleFileRef.run(parsed, projectData);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('error');
  });
});
