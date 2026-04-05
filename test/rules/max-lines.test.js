import { describe, it, expect } from 'vitest';
import { maxLines } from '../../src/rules/max-lines.js';
import { parseContextFile } from '../../src/parser/context-file.js';

function makeLines(count, content = '- item') {
  return Array(count).fill(content).join('\n');
}

describe('max-lines rule', () => {
  it('returns [] for files under 60 non-empty lines', () => {
    const content = makeLines(50);
    const parsed = parseContextFile(content);
    const diagnostics = maxLines.run(parsed, {});
    expect(diagnostics).toHaveLength(0);
  });

  it('returns [] for exactly 60 non-empty lines', () => {
    const content = makeLines(60);
    const parsed = parseContextFile(content);
    const diagnostics = maxLines.run(parsed, {});
    expect(diagnostics).toHaveLength(0);
  });

  it('returns info for 61-200 non-empty lines', () => {
    const content = makeLines(100);
    const parsed = parseContextFile(content);
    const diagnostics = maxLines.run(parsed, {});
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].rule).toBe('max-lines');
    expect(diagnostics[0].severity).toBe('info');
    expect(diagnostics[0].message).toContain('100 lines');
  });

  it('returns warn for 201-400 non-empty lines', () => {
    const content = makeLines(250);
    const parsed = parseContextFile(content);
    const diagnostics = maxLines.run(parsed, {});
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('warn');
    expect(diagnostics[0].message).toContain('250 lines');
    expect(diagnostics[0].message).toContain('200 lines');
  });

  it('returns error for over 400 non-empty lines', () => {
    const content = makeLines(450);
    const parsed = parseContextFile(content);
    const diagnostics = maxLines.run(parsed, {});
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].message).toContain('450 lines');
  });

  it('suggestion mentions 60 lines threshold', () => {
    const content = makeLines(100);
    const parsed = parseContextFile(content);
    const diagnostics = maxLines.run(parsed, {});
    expect(diagnostics[0].suggestion).toContain('60 lines');
  });

  it('counts only non-empty lines', () => {
    // 50 non-empty lines + 20 blank lines = 70 total, but only 50 non-empty
    const nonEmpty = Array(50).fill('- item');
    const empty = Array(20).fill('');
    const content = [...nonEmpty, ...empty].join('\n');
    const parsed = parseContextFile(content);
    expect(parsed.nonEmptyLines).toBe(50);
    const diagnostics = maxLines.run(parsed, {});
    expect(diagnostics).toHaveLength(0);
  });
});
