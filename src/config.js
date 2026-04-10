import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const CONFIG_FILES = ['.ctxlintrc', '.ctxlintrc.json'];

const DEFAULTS = {
  checks: null,           // null = run all rules
  ignore: [],             // rule names to skip
  strict: false,          // exit 1 on warnings too
  contextFiles: [],       // additional custom context file paths
  tokenThresholds: {
    info: 500,
    warning: 2000,
    error: 5000,
  },
};

export function loadConfig(projectDir) {
  const absDir = resolve(projectDir);

  for (const name of CONFIG_FILES) {
    const filePath = join(absDir, name);
    if (existsSync(filePath)) {
      try {
        const raw = readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return mergeWithDefaults(parsed, filePath);
      } catch (err) {
        console.error(`Warning: could not parse ${name}: ${err.message}`);
      }
    }
  }

  return { ...DEFAULTS, _source: null };
}

function mergeWithDefaults(parsed, source) {
  return {
    checks: Array.isArray(parsed.checks) ? parsed.checks : DEFAULTS.checks,
    ignore: Array.isArray(parsed.ignore) ? parsed.ignore : DEFAULTS.ignore,
    strict: typeof parsed.strict === 'boolean' ? parsed.strict : DEFAULTS.strict,
    contextFiles: Array.isArray(parsed.contextFiles) ? parsed.contextFiles : DEFAULTS.contextFiles,
    tokenThresholds: {
      ...DEFAULTS.tokenThresholds,
      ...(parsed.tokenThresholds || {}),
    },
    _source: source,
  };
}
