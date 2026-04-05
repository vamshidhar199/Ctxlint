import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import { generateContent, init } from '../../src/commands/init.js';
import { scanProject } from '../../src/detector/project.js';

const NO_CONTEXT_REPO = join(new URL('.', import.meta.url).pathname, '../fixtures/no-context-repo');
const HEALTHY_REPO = join(new URL('.', import.meta.url).pathname, '../fixtures/healthy-repo');

describe('init command', () => {
  describe('generateContent', () => {
    it('includes build scripts from package.json', () => {
      const projectData = scanProject(NO_CONTEXT_REPO);
      const content = generateContent(projectData, 'agents');
      expect(content).toContain('pnpm dev');
      expect(content).toContain('pnpm test');
      expect(content).toContain('pnpm build');
    });

    it('uses the detected package manager prefix', () => {
      const projectData = scanProject(NO_CONTEXT_REPO);
      const content = generateContent(projectData, 'agents');
      // no-context-repo has pnpm-lock.yaml
      expect(content).toContain('pnpm ');
      expect(content).not.toMatch(/\bnpm /);
    });

    it('appends test framework name when detectable', () => {
      const projectData = scanProject(NO_CONTEXT_REPO);
      const content = generateContent(projectData, 'agents');
      // no-context-repo has vitest in devDependencies
      expect(content).toContain('vitest');
    });

    it('generates content under 40 lines', () => {
      const projectData = scanProject(NO_CONTEXT_REPO);
      const content = generateContent(projectData, 'agents');
      const lines = content.split('\n');
      expect(lines.length).toBeLessThan(40);
    });

    it('does NOT include a directory tree', () => {
      const projectData = scanProject(NO_CONTEXT_REPO);
      const content = generateContent(projectData, 'agents');
      expect(content).not.toMatch(/[├└│]/);
      expect(content).not.toMatch(/^\s{2,}[\w.-]+\.(js|ts)/m);
    });

    it('starts with correct heading for agents format', () => {
      const projectData = scanProject(NO_CONTEXT_REPO);
      const content = generateContent(projectData, 'agents');
      expect(content).toMatch(/^# AGENTS\.md/);
    });

    it('starts with correct heading for claude format', () => {
      const projectData = scanProject(NO_CONTEXT_REPO);
      const content = generateContent(projectData, 'claude');
      expect(content).toMatch(/^# CLAUDE\.md/);
    });

    it('includes Constraints section when .nvmrc exists', () => {
      const projectData = scanProject(HEALTHY_REPO);
      const content = generateContent(projectData, 'agents');
      expect(content).toContain('## Constraints');
      expect(content).toContain('.nvmrc');
    });

    it('includes packageManager corepack constraint when field set', () => {
      const projectData = scanProject(HEALTHY_REPO);
      const content = generateContent(projectData, 'agents');
      // healthy-repo has "packageManager": "pnpm@9.0.0"
      expect(content).toContain('corepack');
    });

    it('does NOT include Non-obvious patterns section for simple repos', () => {
      const projectData = scanProject(NO_CONTEXT_REPO);
      const content = generateContent(projectData, 'agents');
      // no-context-repo has no workspaces, no .env.example, no unusual entry
      expect(content).not.toContain('## Non-obvious patterns');
    });
  });

  describe('init function', () => {
    it('returns 1 when context file exists and no --force', async () => {
      // healthy-repo has AGENTS.md
      const exitCode = await init(HEALTHY_REPO, { dryRun: true, force: false });
      expect(exitCode).toBe(1);
    });

    it('returns 0 with --dry-run for a repo without a context file', async () => {
      const exitCode = await init(NO_CONTEXT_REPO, { dryRun: true, force: false });
      expect(exitCode).toBe(0);
    });
  });
});
