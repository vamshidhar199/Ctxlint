import { ANSI, SEVERITY } from '../constants.js';

const ICONS = {
  [SEVERITY.ERROR]: `${ANSI.RED}✗${ANSI.RESET}`,
  [SEVERITY.WARN]: `${ANSI.YELLOW}⚠${ANSI.RESET}`,
  [SEVERITY.INFO]: `${ANSI.BLUE}ℹ${ANSI.RESET}`,
};

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 };

export function reportTerminal(diagnostics, contextFileName) {
  const sorted = [...diagnostics].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.line - b.line
  );

  const errors = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warn').length;
  const infos = diagnostics.filter(d => d.severity === 'info').length;

  console.log(`\n${ANSI.BOLD}${contextFileName}${ANSI.RESET}`);

  if (sorted.length === 0) {
    console.log(`  ${ANSI.GREEN}✓ No issues found${ANSI.RESET}`);
  } else {
    for (const d of sorted) {
      const icon = ICONS[d.severity] || ICONS.info;
      const lineRef = d.endLine ? `lines ${d.line}-${d.endLine}` : `line ${d.line}`;
      console.log(`\n  ${icon} ${ANSI.BOLD}${d.rule}${ANSI.RESET}  ${d.message}`);
      if (d.suggestion) {
        console.log(`     ${ANSI.GRAY}${d.suggestion}${ANSI.RESET}`);
      }
      console.log(`     ${ANSI.GRAY}${lineRef}${ANSI.RESET}`);
    }
  }

  console.log(`\n${ANSI.BOLD}Summary:${ANSI.RESET}`);
  console.log(
    `  ${ANSI.RED}${errors} error${errors !== 1 ? 's' : ''}${ANSI.RESET}, ` +
    `${ANSI.YELLOW}${warnings} warning${warnings !== 1 ? 's' : ''}${ANSI.RESET}, ` +
    `${ANSI.BLUE}${infos} info${ANSI.RESET}`
  );
  console.log('');
}
