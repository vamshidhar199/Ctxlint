import { describe, it, expect } from 'vitest';
import { noStyleGuide } from '../../src/rules/no-style-guide.js';
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
    ...overrides,
  };
}

describe('no-style-guide rule', () => {
  it('flags indentation rules', () => {
    const content = '- Indent with 2 spaces for all files';
    const parsed = parseContextFile(content);
    const diagnostics = noStyleGuide.run(parsed, makeProjectData());
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].rule).toBe('no-style-guide');
    expect(diagnostics[0].severity).toBe('info');
  });

  it('flags "prefer const over let"', () => {
    const content = '- Prefer const over let whenever possible';
    const parsed = parseContextFile(content);
    const diagnostics = noStyleGuide.run(parsed, makeProjectData());
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
  });

  it('flags camelCase naming conventions', () => {
    const content = '- Use camelCase for all variable names';
    const parsed = parseContextFile(content);
    const diagnostics = noStyleGuide.run(parsed, makeProjectData());
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
  });

  it('flags semicolon rules', () => {
    const content = '- Always use semicolons at end of statements';
    const parsed = parseContextFile(content);
    const diagnostics = noStyleGuide.run(parsed, makeProjectData());
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
  });

  it('flags quote style rules', () => {
    const content = '- Use single quotes for strings';
    const parsed = parseContextFile(content);
    const diagnostics = noStyleGuide.run(parsed, makeProjectData());
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
  });

  it('flags trailing comma rules', () => {
    const content = '- Always add trailing commas in multi-line expressions';
    const parsed = parseContextFile(content);
    const diagnostics = noStyleGuide.run(parsed, makeProjectData());
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
  });

  it('mentions the linter config when hasLinter is true', () => {
    const content = '- Prefer const over let';
    const parsed = parseContextFile(content);
    const projectData = makeProjectData({
      hasLinter: true,
      linterConfigs: ['.prettierrc'],
    });
    const diagnostics = noStyleGuide.run(parsed, projectData);
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].message).toContain('.prettierrc');
    expect(diagnostics[0].message).toContain('already enforces this');
  });

  it('suggests linter setup when no linter config found', () => {
    const content = '- Use single quotes for strings';
    const parsed = parseContextFile(content);
    const diagnostics = noStyleGuide.run(parsed, makeProjectData({ hasLinter: false }));
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].suggestion).toContain('eslint/prettier/ruff');
  });

  it('does NOT flag lines inside code blocks', () => {
    const content = '```\n- Use 2-space indentation\n- Prefer const over let\n```';
    const parsed = parseContextFile(content);
    const diagnostics = noStyleGuide.run(parsed, makeProjectData());
    expect(diagnostics).toHaveLength(0);
  });

  it('only emits one diagnostic per line even if multiple patterns match', () => {
    const content = '- Use camelCase and always use semicolons';
    const parsed = parseContextFile(content);
    const diagnostics = noStyleGuide.run(parsed, makeProjectData());
    // Should be exactly 1 per line (breaks after first match)
    expect(diagnostics).toHaveLength(1);
  });

  it('returns [] for clean content', () => {
    const content = '## Build\n- Run `npm test` to run tests\n- Deploy with `npm run build`';
    const parsed = parseContextFile(content);
    const diagnostics = noStyleGuide.run(parsed, makeProjectData());
    expect(diagnostics).toHaveLength(0);
  });
});
