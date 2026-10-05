import type { TrialResult, Metrics } from './run.js';

export function aggregate(results: TrialResult[]): Metrics {
  if (!results.length) throw new Error('NO_TRIALS');
  const count = results.length;
  const measuredContext = results.filter(
    (result): result is TrialResult & { nativeContextChars: number } => result.nativeContextChars !== null
  );
  return {
    successRate: results.filter(result => result.success).length / count,
    measuredActivationTrials: results.filter(result => result.observedIds !== null).length,
    unknownActivationTrials: results.filter(result => result.observedIds === null).length,
    meanAddedMs: results.reduce((sum, result) => sum + result.addedMs, 0) / count,
    meanGuidanceChars: results.reduce((sum, result) => sum + result.guidanceChars, 0) / count,
    meanNativeContextChars: measuredContext.length
      ? measuredContext.reduce((sum, result) => sum + result.nativeContextChars, 0) / measuredContext.length
      : null,
    unnecessarySelections: results.reduce((sum, result) => sum + result.unnecessarySelections, 0),
    explicitReminders: results.reduce((sum, result) => sum + result.explicitReminders, 0)
  };
}

export function aggregateBy(results: TrialResult[], key: 'condition' | 'host' | 'catalogSize'): Record<string, Metrics> {
  const groups = new Map<string, TrialResult[]>();
  for (const result of results) {
    const label = String(result[key] ?? 'unknown');
    groups.set(label, [...(groups.get(label) ?? []), result]);
  }
  return Object.fromEntries([...groups].map(([label, rows]) => [label, aggregate(rows)]));
}
