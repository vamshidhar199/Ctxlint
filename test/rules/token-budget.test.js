import { describe, it, expect } from 'vitest';
import { tokenBudget } from '../../src/rules/token-budget.js';
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

describe('token-budget rule', () => {
  it('always returns exactly one diagnostic', () => {
    const content = '## Build\n- Run tests with `npm test`\n- Build with `npm run build`';
    const parsed = parseContextFile(content);
    const diagnostics = tokenBudget.run(parsed, makeProjectData(), []);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].rule).toBe('token-budget');
  });

  it('returns info severity when no other diagnostics (excellent signal ratio)', () => {
    const content = '## Build\n- Run tests with `npm test`';
    const parsed = parseContextFile(content);
    const diagnostics = tokenBudget.run(parsed, makeProjectData(), []);
    expect(diagnostics[0].severity).toBe('info');
  });

  it('returns warn severity when other diagnostics exist', () => {
    const content = '## Build\n- Run tests with `npm test`\n- Use 2-space indentation';
    const parsed = parseContextFile(content);
    const otherDiagnostics = [{
      rule: 'no-style-guide',
      severity: 'info',
      line: 3,
      endLine: null,
      message: 'style rule',
      suggestion: 'fix it',
    }];
    const diagnostics = tokenBudget.run(parsed, makeProjectData(), otherDiagnostics);
    expect(diagnostics[0].severity).toBe('warn');
  });

  it('message includes total lines and token estimate', () => {
    const content = '## Build\n- npm test\n- npm build';
    const parsed = parseContextFile(content);
    const diagnostics = tokenBudget.run(parsed, makeProjectData(), []);
    expect(diagnostics[0].message).toContain('lines');
    expect(diagnostics[0].message).toContain('tokens');
    expect(diagnostics[0].message).toContain('Signal-to-noise ratio');
  });

  it('message includes cost projection', () => {
    const content = '## Build\n- npm test';
    const parsed = parseContextFile(content);
    const diagnostics = tokenBudget.run(parsed, makeProjectData(), []);
    expect(diagnostics[0].message).toContain('monthly cost');
    expect(diagnostics[0].message).toContain('Current:');
    expect(diagnostics[0].message).toContain('After fixes:');
  });

  it('noise tokens are calculated from other diagnostics line ranges', () => {
    // Create content where line 2 is flagged
    const content = '## Build\n- Use camelCase naming convention\n- Run tests';
    const parsed = parseContextFile(content);
    const otherDiagnostics = [{
      rule: 'no-style-guide',
      severity: 'info',
      line: 2,
      endLine: null,
      message: 'style rule',
      suggestion: 'fix',
    }];

    const diagsWithNoise = tokenBudget.run(parsed, makeProjectData(), otherDiagnostics);
    const diagsClean = tokenBudget.run(parsed, makeProjectData(), []);

    // With noise, noiseTokens > 0, so severity should be warn
    expect(diagsWithNoise[0].severity).toBe('warn');
    // Without noise, severity should be info
    expect(diagsClean[0].severity).toBe('info');
  });

  it('suggestion mentions removing flagged content when noise exists', () => {
    const content = '## Style\n- Use 2 spaces for indentation\n- Always use semicolons';
    const parsed = parseContextFile(content);
    const otherDiagnostics = [
      { rule: 'no-style-guide', severity: 'info', line: 2, endLine: null, message: '', suggestion: '' },
      { rule: 'no-style-guide', severity: 'info', line: 3, endLine: null, message: '', suggestion: '' },
    ];
    const diagnostics = tokenBudget.run(parsed, makeProjectData(), otherDiagnostics);
    expect(diagnostics[0].suggestion).toContain('Remove flagged content');
  });

  it('suggestion praises clean files when no noise', () => {
    const content = '## Build\n- npm test';
    const parsed = parseContextFile(content);
    const diagnostics = tokenBudget.run(parsed, makeProjectData(), []);
    expect(diagnostics[0].suggestion).toContain('No removable content');
  });

  it('sets line=1 and endLine=totalLines', () => {
    const content = '## Build\n- npm test\n- npm build';
    const parsed = parseContextFile(content);
    const diagnostics = tokenBudget.run(parsed, makeProjectData(), []);
    expect(diagnostics[0].line).toBe(1);
    expect(diagnostics[0].endLine).toBe(parsed.totalLines);
  });
});
