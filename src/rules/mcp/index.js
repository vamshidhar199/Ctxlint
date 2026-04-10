import { mcpSchema } from './schema.js';
import { mcpHardcodedSecret } from './hardcoded-secret.js';
import { mcpLocalhostUrl } from './localhost-url.js';
import { mcpDeprecatedTransport } from './deprecated-transport.js';
import { mcpMissingCommand } from './missing-command.js';
import { mcpEnvSyntax } from './env-syntax.js';

export const mcpRules = [
  mcpSchema,
  mcpMissingCommand,
  mcpHardcodedSecret,
  mcpLocalhostUrl,
  mcpDeprecatedTransport,
  mcpEnvSyntax,
];
