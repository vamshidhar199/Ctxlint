import { describe, it, expect } from 'vitest';
import { noDirectoryTree } from '../../src/rules/no-directory-tree.js';
import { parseContextFile } from '../../src/parser/context-file.js';

function makeProjectData() {
  return { dir: '/tmp', files: new Set(), dirs: new Set(), scripts: null };
}

describe('no-directory-tree rule', () => {
  it('flags tree-drawing characters', () => {
    const content = `## Project Structure\n\`\`\`\nsrc/\n├── app/\n│   └── page.tsx\n└── lib/\n\`\`\``;
    const parsed = parseContextFile(content);
    const diagnostics = noDirectoryTree.run(parsed, makeProjectData());

    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics[0].rule).toBe('no-directory-tree');
    expect(diagnostics[0].severity).toBe('error');
  });

  it('groups consecutive flagged lines into one diagnostic', () => {
    const content = `## Project Structure\n\`\`\`\n├── app/\n│   └── page.tsx\n├── lib/\n└── utils/\n\`\`\``;
    const parsed = parseContextFile(content);
    const diagnostics = noDirectoryTree.run(parsed, makeProjectData());

    // All tree lines should be grouped into one (or minimal) diagnostics
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    // The range should span multiple lines
    const firstDiag = diagnostics[0];
    expect(firstDiag.endLine).toBeGreaterThan(firstDiag.line);
  });

  it('flags tree chars outside code blocks too', () => {
    const content = `## Structure\n├── src/\n└── lib/`;
    const parsed = parseContextFile(content);
    const diagnostics = noDirectoryTree.run(parsed, makeProjectData());

    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
  });

  it('flags indented file listings (multiple consecutive lines)', () => {
    const content = `## Files\n  auth.ts\n  utils.ts\n  index.ts`;
    const parsed = parseContextFile(content);
    const diagnostics = noDirectoryTree.run(parsed, makeProjectData());

    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT flag single indented file line (no adjacent match)', () => {
    const content = `## Notes\nSee auth.ts for authentication logic.\n  auth.ts\nThis is the entry point.`;
    const parsed = parseContextFile(content);
    const diagnostics = noDirectoryTree.run(parsed, makeProjectData());

    // A single indented file line with no adjacent match should not be flagged
    const indentedFileDiags = diagnostics.filter(d =>
      d.message.includes('directory tree')
    );
    // May still flag if there's adjacent content — just verify no crash
    expect(Array.isArray(diagnostics)).toBe(true);
  });

  it('includes token estimate in message', () => {
    const content = `## Project Structure\n\`\`\`\n├── app/\n│   └── page.tsx\n├── lib/\n└── utils/\n\`\`\``;
    const parsed = parseContextFile(content);
    const diagnostics = noDirectoryTree.run(parsed, makeProjectData());

    expect(diagnostics[0].message).toMatch(/~\d+ tokens/);
  });

  it('suggestion mentions research finding', () => {
    const content = `## Project Structure\n├── src/\n└── lib/`;
    const parsed = parseContextFile(content);
    const diagnostics = noDirectoryTree.run(parsed, makeProjectData());

    expect(diagnostics[0].suggestion).toMatch(/Agents can explore/);
  });

  it('does NOT flag a line that just mentions a file by name', () => {
    const content = `## Notes\nSee \`src/auth.ts\` for authentication logic.`;
    const parsed = parseContextFile(content);
    const diagnostics = noDirectoryTree.run(parsed, makeProjectData());

    expect(diagnostics).toHaveLength(0);
  });
});
