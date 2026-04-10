import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

// Extracts workflow file names from .github/workflows/
function getWorkflowFiles(projectDir) {
  const workflowsDir = join(projectDir, '.github', 'workflows');
  if (!existsSync(workflowsDir)) return [];
  try {
    return readdirSync(workflowsDir)
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map(f => f.replace(/\.(yml|yaml)$/, ''));
  } catch {
    return [];
  }
}

// Checks if a workflow name is mentioned in the context file content
function isMentioned(workflowName, content) {
  // Match the filename (with or without extension), case-insensitive
  const escaped = workflowName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i').test(content);
}

export const ciCoverage = {
  name: 'ci-coverage',
  severity: 'info',
  description: 'Flags CI workflows in .github/workflows/ not mentioned in the context file',

  run(parsedFile, projectData) {
    const workflows = getWorkflowFiles(projectData.dir);
    if (workflows.length === 0) return [];

    const content = parsedFile.lines.join('\n');
    const diagnostics = [];

    for (const workflow of workflows) {
      if (!isMentioned(workflow, content)) {
        diagnostics.push({
          rule: 'ci-coverage',
          severity: 'info',
          line: 1,
          endLine: null,
          message: `CI workflow \`${workflow}\` is not mentioned in this context file`,
          suggestion: `Consider documenting what \`${workflow}\` does so agents understand your CI pipeline.`,
        });
      }
    }

    return diagnostics;
  },
};
