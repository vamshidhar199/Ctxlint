import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { CONTEXT_FILES, CURSOR_FILES } from '../constants.js';

export function detectContextFiles(projectDir) {
  const found = [];

  for (const name of CONTEXT_FILES) {
    const filePath = join(projectDir, name);
    if (existsSync(filePath)) {
      found.push({
        name,
        path: filePath,
        content: readFileSync(filePath, 'utf8'),
      });
    }
  }

  for (const name of CURSOR_FILES) {
    const filePath = join(projectDir, name);
    if (existsSync(filePath)) {
      found.push({
        name,
        path: filePath,
        content: readFileSync(filePath, 'utf8'),
      });
    }
  }

  return found;
}
