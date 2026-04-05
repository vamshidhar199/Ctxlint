export function reportJson(diagnostics, contextFileName, parsedFile) {
  const errors = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warn').length;
  const infos = diagnostics.filter(d => d.severity === 'info').length;

  const totalLines = parsedFile ? parsedFile.totalLines : 0;
  const nonEmptyLines = parsedFile ? parsedFile.nonEmptyLines : 0;

  const output = {
    file: contextFileName,
    diagnostics: diagnostics.map(d => ({
      rule: d.rule,
      severity: d.severity,
      line: d.line,
      endLine: d.endLine,
      message: d.message,
      suggestion: d.suggestion,
    })),
    summary: {
      errors,
      warnings,
      info: infos,
      totalLines,
      nonEmptyLines,
      totalTokens: 0,
      signalTokens: 0,
      noiseTokens: 0,
      signalRatio: 0,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}
