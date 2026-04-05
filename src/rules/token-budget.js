import { THRESHOLDS } from '../constants.js';

const SONNET_INPUT_PRICE = 3.00 / 1_000_000;
const SONNET_CACHED_PRICE = 0.30 / 1_000_000;

function getRating(ratio) {
  if (ratio >= 0.8) return 'excellent';
  if (ratio >= 0.6) return 'good';
  if (ratio >= 0.4) return 'poor';
  return 'very poor';
}

export const tokenBudget = {
  name: 'token-budget',
  severity: 'warn',
  description: 'Estimates token cost and reports signal-to-noise ratio',

  run(parsedFile, projectData, otherDiagnostics = []) {
    const content = parsedFile.lines.join('\n');
    const totalTokens = Math.round(content.length * THRESHOLDS.TOKENS_PER_CHAR);

    // Estimate noise tokens from flagged line ranges by other rules
    let noiseTokens = 0;
    const { lines } = parsedFile;

    for (const diag of otherDiagnostics) {
      const startIdx = (diag.line || 1) - 1;
      const endIdx = diag.endLine != null ? diag.endLine - 1 : startIdx;

      for (let i = startIdx; i <= endIdx && i < lines.length; i++) {
        if (i >= 0) {
          noiseTokens += Math.round(lines[i].length * THRESHOLDS.TOKENS_PER_CHAR);
        }
      }
    }

    noiseTokens = Math.min(noiseTokens, totalTokens);
    const signalTokens = totalTokens - noiseTokens;
    const signalRatio = totalTokens > 0 ? signalTokens / totalTokens : 1;
    const noisePct = Math.round((noiseTokens / Math.max(totalTokens, 1)) * 100);
    const signalPct = 100 - noisePct;
    const rating = getRating(signalRatio);

    // Cost projections: 5 devs, 20 sessions/day, 20 working days/month
    const perSessionUncached = totalTokens * SONNET_INPUT_PRICE;
    const perSessionCached = totalTokens * SONNET_CACHED_PRICE;
    const dailyCostPerDev = perSessionUncached + (19 * perSessionCached);
    const teamSize = 5;
    const currentCost = (dailyCostPerDev * 20 * teamSize).toFixed(2);

    const fixedTokens = signalTokens;
    const fixedPerSessionUncached = fixedTokens * SONNET_INPUT_PRICE;
    const fixedPerSessionCached = fixedTokens * SONNET_CACHED_PRICE;
    const fixedDailyCostPerDev = fixedPerSessionUncached + (19 * fixedPerSessionCached);
    const fixedCost = (fixedDailyCostPerDev * 20 * teamSize).toFixed(2);
    const savingsPct = parseFloat(currentCost) > 0
      ? Math.round(((currentCost - fixedCost) / currentCost) * 100)
      : 0;

    // Use 'info' severity when the signal ratio is excellent (no removable noise)
    const severity = noiseTokens > 0 ? 'warn' : 'info';

    const message = [
      `Context file: ${parsedFile.totalLines} lines, ~${totalTokens} tokens`,
      ``,
      `Token breakdown:`,
      `  High-signal (non-inferable):  ${signalTokens} tokens (${signalPct}%)  \u2713`,
      `  Flagged as removable:         ${noiseTokens} tokens (${noisePct}%)    \u2717`,
      ``,
      `Signal-to-noise ratio: ${signalRatio.toFixed(2)} (${rating})`,
      ``,
      `Estimated monthly cost (5 developers, 20 sessions/day):`,
      `  Current:     $${currentCost}`,
      `  After fixes: $${fixedCost} (${savingsPct}% reduction)`,
    ].join('\n');

    return [{
      rule: 'token-budget',
      severity,
      line: 1,
      endLine: parsedFile.totalLines,
      message,
      suggestion: noiseTokens > 0
        ? `Remove flagged content to save ~${noiseTokens} tokens (~${noisePct}% of total) per session.`
        : 'No removable content detected \u2014 great signal-to-noise ratio!',
    }];
  },
};
