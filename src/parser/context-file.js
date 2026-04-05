export function parseContextFile(content) {
  const lines = content.split('\n');
  const codeBlocks = [];
  const sections = [];

  let inCodeBlock = false;
  let codeBlockStart = -1;
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code block boundaries
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockStart = i;
      } else {
        inCodeBlock = false;
        codeBlocks.push({ startLine: codeBlockStart, endLine: i });
      }
    }

    // Track sections by headings (only outside code blocks)
    if (!inCodeBlock && /^#{1,3}\s/.test(line)) {
      if (currentSection) {
        currentSection.endLine = i - 1;
        currentSection.content = lines.slice(currentSection.startLine, i).join('\n');
        sections.push(currentSection);
      }
      currentSection = {
        heading: line.trim(),
        headingLine: i,
        startLine: i + 1,
        endLine: lines.length - 1,
        content: '',
        inCodeBlock: false,
      };
    }
  }

  // Close last section
  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    currentSection.content = lines.slice(currentSection.startLine).join('\n');
    sections.push(currentSection);
  }

  // Close unclosed code block
  if (inCodeBlock && codeBlockStart >= 0) {
    codeBlocks.push({ startLine: codeBlockStart, endLine: lines.length - 1 });
  }

  const nonEmptyLines = lines.filter(l => l.trim().length > 0).length;

  return {
    lines,
    sections,
    codeBlocks,
    totalLines: lines.length,
    nonEmptyLines,
  };
}

export function isInCodeBlock(lineNumber, codeBlocks) {
  for (const block of codeBlocks) {
    if (lineNumber >= block.startLine && lineNumber <= block.endLine) {
      return true;
    }
  }
  return false;
}
