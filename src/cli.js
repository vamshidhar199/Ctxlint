import { Command } from 'commander';
import { readFileSync } from 'fs';
import { check } from './commands/check.js';
import { init } from './commands/init.js';
import { slim } from './commands/slim.js';
import { diff } from './commands/diff.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const program = new Command();

program
  .name('ctxlint')
  .description('Lint AI agent context files. Find stale references, inferable content, and token waste.')
  .version(version);

program
  .command('check [path]')
  .description('Lint context file(s) in the project')
  .option('--format <type>', 'Output format: terminal (default), json', 'terminal')
  .option('--severity <level>', 'Minimum severity: info (default), warn, error', 'info')
  .action(async (projectPath, options) => {
    const exitCode = await check(projectPath || process.cwd(), options);
    process.exit(exitCode);
  });

program
  .command('init [path]')
  .description('Generate a minimal context file')
  .option('--format <type>', 'Output: agents (default), claude, gemini, all', 'agents')
  .option('--dry-run', 'Print to stdout instead of writing')
  .option('--force', 'Overwrite existing file')
  .action(async (projectPath, options) => {
    const exitCode = await init(projectPath || process.cwd(), {
      format: options.format,
      dryRun: options.dryRun || false,
      force: options.force || false,
    });
    process.exit(exitCode);
  });

program
  .command('slim [file]')
  .description('Remove flagged content from a context file')
  .option('--dry-run', 'Show diff without modifying')
  .option('--backup', 'Save original as .bak')
  .action(async (filePath, options) => {
    if (!filePath) {
      console.error('Usage: ctxlint slim <file> [--dry-run] [--backup]');
      process.exit(1);
    }
    const exitCode = await slim(filePath, {
      dryRun: options.dryRun || false,
      backup: options.backup || false,
    });
    process.exit(exitCode);
  });

program
  .command('diff [path]')
  .description('Check for drift between context file and codebase')
  .option('--since <ref>', 'Compare against date or git ref')
  .option('--fail-on-stale', 'Exit 1 if drift detected (for CI)')
  .action(async (projectPath, options) => {
    const exitCode = await diff(projectPath || process.cwd(), {
      since: options.since || null,
      failOnStale: options.failOnStale || false,
    });
    process.exit(exitCode);
  });

// Default: run check on current directory
program.action(async () => {
  const exitCode = await check(process.cwd(), { format: 'terminal', severity: 'info' });
  process.exit(exitCode);
});

export function run(argv) {
  // If no subcommand is given, default to check
  if (argv.length <= 2 || (argv.length === 3 && !['check', 'init', 'slim', 'diff', '--version', '--help', '-V', '-h'].includes(argv[2]))) {
    // Path argument passed without subcommand — treat as check
    if (argv.length === 3 && !argv[2].startsWith('-')) {
      check(argv[2], { format: 'terminal', severity: 'info' }).then(code => process.exit(code));
      return;
    }
  }
  program.parse(argv);
}
