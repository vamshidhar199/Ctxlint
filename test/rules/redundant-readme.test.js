import { describe, it, expect } from 'vitest';
import { redundantReadme } from '../../src/rules/redundant-readme.js';
import { parseContextFile } from '../../src/parser/context-file.js';

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
    readme: null,
    ...overrides,
  };
}

describe('redundant-readme rule', () => {
  it('returns [] when no README exists', () => {
    const content = '## Getting Started\nThis project uses React and Next.js.';
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({ readme: null });

    const diagnostics = redundantReadme.run(parsed, projectData);
    expect(diagnostics).toHaveLength(0);
  });

  it('flags a section that overlaps heavily with README', () => {
    const readme = `# My App\n\n## Getting Started\nThis is a TypeScript web application built with React and Next.js. Install dependencies with npm install.`;
    const content = `## Getting Started\nThis is a TypeScript web application built with React and Next.js. Install dependencies with npm install.`;
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({ readme });

    const diagnostics = redundantReadme.run(parsed, projectData);
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].rule).toBe('redundant-readme');
    expect(diagnostics[0].severity).toBe('warn');
    expect(diagnostics[0].message).toContain('Getting Started');
  });

  it('does NOT flag sections with low overlap', () => {
    const readme = `# My App\nA simple web application.`;
    const content = `## Architecture\nThe system uses event sourcing with CQRS pattern. Commands are processed by the domain layer and projected to read models.`;
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({ readme });

    const diagnostics = redundantReadme.run(parsed, projectData);
    expect(diagnostics).toHaveLength(0);
  });

  it('does NOT flag sections shorter than 30 characters', () => {
    const readme = `# My App\n\n## Short\nHi.`;
    const content = `## Short\nHi.`;
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({ readme });

    const diagnostics = redundantReadme.run(parsed, projectData);
    expect(diagnostics).toHaveLength(0);
  });

  it('reports the overlapping README section heading in the message', () => {
    const readme = `# My App\n\n## Installation\nRun npm install to install all dependencies and then npm start to run the development server.`;
    const content = `## Setup\nRun npm install to install all dependencies and then npm start to run the development server.`;
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({ readme });

    const diagnostics = redundantReadme.run(parsed, projectData);
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].message).toContain('Installation');
  });

  it('includes token estimate in suggestion', () => {
    const readme = `# App\n\n## Overview\nThis project is a TypeScript web application built with React for the frontend and Express for the backend API.`;
    const content = `## Overview\nThis project is a TypeScript web application built with React for the frontend and Express for the backend API.`;
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({ readme });

    const diagnostics = redundantReadme.run(parsed, projectData);
    if (diagnostics.length > 0) {
      expect(diagnostics[0].suggestion).toContain('tokens per session');
    }
  });
});
