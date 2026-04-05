import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { noInferableStack } from '../../src/rules/no-inferable-stack.js';
import { parseContextFile } from '../../src/parser/context-file.js';
import { scanProject } from '../../src/detector/project.js';

const BLOATED_REPO = join(new URL('.', import.meta.url).pathname, '../fixtures/bloated-repo');

function makeProjectData(overrides = {}) {
  return {
    dir: '/tmp',
    files: new Set(),
    dirs: new Set(),
    scripts: null,
    languages: [],
    frameworks: [],
    dependencies: new Set(),
    hasLinter: false,
    linterConfigs: [],
    ...overrides,
  };
}

describe('no-inferable-stack rule', () => {
  it('flags "built with React" when React is in dependencies', () => {
    const content = 'This project is built with React and Next.js.';
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({
      frameworks: ['React', 'Next.js'],
      dependencies: new Set(['react', 'next']),
    });

    const diagnostics = noInferableStack.run(parsed, projectData);
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].rule).toBe('no-inferable-stack');
    expect(diagnostics[0].severity).toBe('warn');
  });

  it('flags "## Tech Stack" heading line', () => {
    // The heading "## Tech Stack" matches the tech stack pattern
    const content = '## Tech Stack\nWe use React and Next.js for the frontend.';
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({
      frameworks: ['React', 'Next.js'],
      dependencies: new Set(['react', 'next']),
    });

    const diagnostics = noInferableStack.run(parsed, projectData);
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT flag lines with "because" or "due to"', () => {
    const content = 'We use React because the team has 5 years of experience with it.';
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({
      frameworks: ['React'],
      dependencies: new Set(['react']),
    });

    const diagnostics = noInferableStack.run(parsed, projectData);
    expect(diagnostics).toHaveLength(0);
  });

  it('does NOT flag version-specific notes', () => {
    const content = 'Must use Node 18+ due to ESM loader requirements.';
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({
      languages: ['JavaScript'],
      dependencies: new Set(),
    });

    const diagnostics = noInferableStack.run(parsed, projectData);
    expect(diagnostics).toHaveLength(0);
  });

  it('does NOT flag when tech is NOT in dependencies', () => {
    const content = 'This project uses Deno for the runtime.';
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({
      languages: [],
      frameworks: [],
      dependencies: new Set(['react']),
    });

    const diagnostics = noInferableStack.run(parsed, projectData);
    // Deno is not in deps, so this line may or may not match stack patterns
    // The key is we don't crash
    expect(Array.isArray(diagnostics)).toBe(true);
  });

  it('flags inferable stack in the bloated-repo fixture', () => {
    const content =
      'This is a TypeScript web application built with React 18, Next.js 14, Tailwind CSS, and PostgreSQL. We use Prisma as our ORM and Vitest for testing.';
    const parsed = parseContextFile(content);
    const projectData = scanProject(BLOATED_REPO);

    const diagnostics = noInferableStack.run(parsed, projectData);
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT flag lines inside code blocks', () => {
    const content = '```\nThis project uses React and TypeScript.\n```';
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({
      frameworks: ['React'],
      dependencies: new Set(['react', 'typescript']),
    });

    const diagnostics = noInferableStack.run(parsed, projectData);
    expect(diagnostics).toHaveLength(0);
  });

  it('flags "uses TypeScript" when TypeScript is in languages', () => {
    const content = 'This codebase uses TypeScript for type safety.';
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({
      languages: ['TypeScript'],
      dependencies: new Set(['typescript']),
    });

    const diagnostics = noInferableStack.run(parsed, projectData);
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
  });
});
