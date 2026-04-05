import { staleFileRef } from './stale-file-ref.js';
import { staleCommand } from './stale-command.js';

export const rules = [
  staleFileRef,
  staleCommand,
];
