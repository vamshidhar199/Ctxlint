import { THRESHOLDS } from '../constants.js';

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trigrams(text) {
  const set = new Set();
  for (let i = 0; i + 3 <= text.length; i++) {
    set.add(text.slice(i, i + 3));
  }
  return set;
}

function trigramOverlap(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return intersection / Math.min(setA.size, setB.size);
}

function splitReadmeSections(content) {
  const sections = [];
  const lines = content.split('\n');
  let currentHeading = 'Introduction';
  let currentLines = [];

  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      if (currentLines.length > 0) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n') });
      }
      currentHeading = line.replace(/^#+\s+/, '');
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    sections.push({ heading: currentHeading, content: currentLines.join('\n') });
  }
  return sections;
}

export const redundantReadme = {
  name: 'redundant-readme',
  severity: 'warn',
  description: 'Flags content that overlaps significantly with README.md',

  run(parsedFile, projectData) {
    if (!projectData.readme) return [];

    const diagnostics = [];
    const readmeSections = splitReadmeSections(projectData.readme);

    for (const section of parsedFile.sections) {
      if (section.content.length < 30) continue;

      const normCtx = normalize(section.content);
      if (normCtx.length < 20) continue;

      const ctxTrigrams = trigrams(normCtx);

      let maxOverlap = 0;
      let overlappingSection = null;

      for (const readmeSec of readmeSections) {
        const normReadme = normalize(readmeSec.content);
        if (normReadme.length < 10) continue;

        const readmeTrigrams = trigrams(normReadme);
        const overlap = trigramOverlap(ctxTrigrams, readmeTrigrams);

        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          overlappingSection = readmeSec;
        }
      }

      if (maxOverlap >= THRESHOLDS.TRIGRAM_OVERLAP_THRESHOLD && overlappingSection) {
        const startLine = section.headingLine + 1;
        const endLine = section.endLine + 1;
        const tokenEstimate = Math.round(section.content.length * THRESHOLDS.TOKENS_PER_CHAR);
        const percentage = Math.round(maxOverlap * 100);

        diagnostics.push({
          rule: 'redundant-readme',
          severity: 'warn',
          line: startLine,
          endLine: endLine,
          message: `Lines ${startLine}-${endLine} ("${section.heading}") overlap ~${percentage}% with README.md section "${overlappingSection.heading}"`,
          suggestion: `Agents already read README.md. Remove this section to save ~${tokenEstimate} tokens per session.`,
        });
      }
    }

    return diagnostics;
  },
};
