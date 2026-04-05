import { noDirectoryTree } from './no-directory-tree.js';
import { staleFileRef } from './stale-file-ref.js';
import { staleCommand } from './stale-command.js';
import { noInferableStack } from './no-inferable-stack.js';
import { redundantReadme } from './redundant-readme.js';
import { noStyleGuide } from './no-style-guide.js';
import { maxLines } from './max-lines.js';
import { tokenBudget } from './token-budget.js';

export const rules = [
  noDirectoryTree,
  staleFileRef,
  staleCommand,
  noInferableStack,
  redundantReadme,
  noStyleGuide,
  maxLines,
  tokenBudget,
];
