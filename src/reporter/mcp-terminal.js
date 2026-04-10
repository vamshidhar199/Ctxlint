import { ANSI } from '../constants.js';

const ICONS = {
  error: `${ANSI.RED}✗${ANSI.RESET}`,
  warn:  `${ANSI.YELLOW}⚠${ANSI.RESET}`,
  info:  `${ANSI.BLUE}ℹ${ANSI.RESET}`,
};

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 };

export function reportMcpTerminal(diagnostics, configName, parseError) {
  console.log(`\n${ANSI.BOLD}${configName}${ANSI.RESET}`);

  if (parseError) {
    console.log(`\n  ${ICONS.error} ${ANSI.BOLD}parse-error${ANSI.RESET}  Cannot parse JSON: ${parseError}`);
    console.log(`     ${ANSI.GRAY}Fix the JSON syntax before ctxlint can validate this file.${ANSI.RESET}`);
    console.log(`\n${ANSI.BOLD}Summary:${ANSI.RESET}`);
    console.log(`  ${ANSI.RED}1 error${ANSI.RESET}, ${ANSI.YELLOW}0 warnings${ANSI.RESET}, ${ANSI.BLUE}0 info${ANSI.RESET}\n`);
    return;
  }

  if (diagnostics.length === 0) {
    console.log(`  ${ANSI.GREEN}✓ No issues found${ANSI.RESET}`);
  } else {
    const sorted = [...diagnostics].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    );

    for (const d of sorted) {
      const icon = ICONS[d.severity] || ICONS.info;
      const location = d.server
        ? `${ANSI.GRAY}server: ${d.server}${d.field ? ` → ${d.field}` : ''}${ANSI.RESET}`
        : '';
      console.log(`\n  ${icon} ${ANSI.BOLD}${d.rule}${ANSI.RESET}  ${d.message}`);
      if (d.suggestion) console.log(`     ${ANSI.GRAY}${d.suggestion}${ANSI.RESET}`);
      if (location) console.log(`     ${location}`);
    }
  }

  const errors   = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warn').length;
  const infos    = diagnostics.filter(d => d.severity === 'info').length;

  console.log(`\n${ANSI.BOLD}Summary:${ANSI.RESET}`);
  console.log(
    `  ${ANSI.RED}${errors} error${errors !== 1 ? 's' : ''}${ANSI.RESET}, ` +
    `${ANSI.YELLOW}${warnings} warning${warnings !== 1 ? 's' : ''}${ANSI.RESET}, ` +
    `${ANSI.BLUE}${infos} info${ANSI.RESET}\n`
  );
}

export function reportMcpJson(diagnostics, configName, parseError) {
  const output = {
    file: configName,
    parseError: parseError || null,
    diagnostics: parseError ? [] : diagnostics.map(d => ({
      rule: d.rule,
      severity: d.severity,
      server: d.server,
      field: d.field,
      message: d.message,
      suggestion: d.suggestion,
    })),
    summary: {
      errors:   parseError ? 1 : diagnostics.filter(d => d.severity === 'error').length,
      warnings: parseError ? 0 : diagnostics.filter(d => d.severity === 'warn').length,
      info:     parseError ? 0 : diagnostics.filter(d => d.severity === 'info').length,
    },
  };
  console.log(JSON.stringify(output, null, 2));
}
