import { noDirectoryTree } from './no-directory-tree.js';
import { staleFileRef } from './stale-file-ref.js';
import { staleCommand } from './stale-command.js';
import { noInferableStack } from './no-inferable-stack.js';

export const rules = [
  noDirectoryTree,
  staleFileRef,
  staleCommand,
  noInferableStack,
];
