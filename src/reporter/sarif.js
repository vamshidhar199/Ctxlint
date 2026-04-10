import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const { version } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8')
);

// SARIF severity mapping
const LEVEL_MAP = {
  error: 'error',
  warn: 'warning',
  info: 'note',
};

// Rule metadata for the SARIF tool.driver.rules section
const RULE_METADATA = {
  'stale-file-ref':      { name: 'StaleFileRef',      short: 'References to files/directories that do not exist' },
  'stale-command':       { name: 'StaleCommand',       short: 'Build commands that do not match project scripts' },
  'no-directory-tree':   { name: 'NoDirectoryTree',    short: 'Embedded directory tree structures agents ignore' },
  'redundant-readme':    { name: 'RedundantReadme',    short: 'Content that overlaps with README.md' },
  'no-inferable-stack':  { name: 'NoInferableStack',   short: 'Tech stack discoverable from config files' },
  'max-lines':           { name: 'MaxLines',           short: 'Context file exceeds recommended line limit' },
  'no-style-guide':      { name: 'NoStyleGuide',       short: 'Style rules that belong in a linter, not a context file' },
  'token-budget':        { name: 'TokenBudget',        short: 'Token cost estimate and signal-to-noise ratio' },
};

const HELP_URI = 'https://github.com/vamshidhar199/Ctxlint#what-it-checks';

// Accumulates results across multiple files — call reportSarif() once per file,
// then flushSarif() at the end to emit the full SARIF document.
const _results = [];
const _artifactUris = new Set();

export function reportSarif(diagnostics, contextFileName, contextFilePath) {
  const uri = contextFilePath || contextFileName;
  _artifactUris.add(uri);

  for (const d of diagnostics) {
    _results.push({
      ruleId: d.rule,
      level: LEVEL_MAP[d.severity] || 'note',
      message: {
        text: d.suggestion ? `${d.message} — ${d.suggestion}` : d.message,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri, uriBaseId: '%SRCROOT%' },
            region: {
              startLine: d.line || 1,
              ...(d.endLine && d.endLine !== d.line ? { endLine: d.endLine } : {}),
            },
          },
        },
      ],
    });
  }
}

export function flushSarif() {
  // Build unique rule list from results seen
  const ruleIds = [...new Set(_results.map(r => r.ruleId))];
  const rules = ruleIds.map(id => {
    const meta = RULE_METADATA[id] || { name: id, short: id };
    return {
      id,
      name: meta.name,
      shortDescription: { text: meta.short },
      helpUri: HELP_URI,
      properties: { tags: ['correctness', 'context-file'] },
    };
  });

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'ctxlint',
            version,
            informationUri: 'https://github.com/vamshidhar199/Ctxlint',
            rules,
          },
        },
        artifacts: [..._artifactUris].map(uri => ({
          location: { uri, uriBaseId: '%SRCROOT%' },
        })),
        results: _results,
      },
    ],
  };

  console.log(JSON.stringify(sarif, null, 2));
}
