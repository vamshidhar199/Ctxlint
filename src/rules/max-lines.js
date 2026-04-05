import { THRESHOLDS } from '../constants.js';

export const maxLines = {
  name: 'max-lines',
  severity: 'warn',
  description: 'Flags context files exceeding recommended line count thresholds',

  run(parsedFile) {
    const { nonEmptyLines, totalLines } = parsedFile;
    const n = nonEmptyLines;

    if (n <= THRESHOLDS.MAX_LINES_EXCELLENT) return [];

    let severity;
    let message;

    if (n <= THRESHOLDS.MAX_LINES_WARN) {
      severity = 'info';
      message = `Your context file is ${n} lines. Good, but review for any inferable content.`;
    } else if (n <= THRESHOLDS.MAX_LINES_ERROR) {
      severity = 'warn';
      message = `Your context file is ${n} lines. Files over 200 lines almost always contain inferable content.`;
    } else {
      severity = 'error';
      message = `Your context file is ${n} lines. This is very likely hurting agent performance.`;
    }

    return [{
      rule: 'max-lines',
      severity,
      line: totalLines,
      endLine: null,
      message,
      suggestion: 'Production teams keep theirs under 60 lines.',
    }];
  },
};
