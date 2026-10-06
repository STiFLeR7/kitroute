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

export interface Gates {
  maxMeanAddedMs: number;
  maxMeanGuidanceChars: number;
  maxUnnecessarySelections: number;
  maxExplicitReminders: number;
}

export function decideRelease(metrics: Metrics, baseline: Metrics, gates: Gates) {
  const reasons: string[] = [];
  if (metrics.successRate < baseline.successRate) reasons.push('SUCCESS_REGRESSION');
  if (metrics.meanAddedMs > gates.maxMeanAddedMs) reasons.push('EXCESS_OVERHEAD');
  if (metrics.meanGuidanceChars > gates.maxMeanGuidanceChars) reasons.push('EXCESS_CONTEXT');
  if (metrics.unnecessarySelections > gates.maxUnnecessarySelections) reasons.push('EXTRA_SELECTIONS');
  if (metrics.explicitReminders > gates.maxExplicitReminders) reasons.push('EXTRA_REMINDERS');
  const improves = metrics.successRate > baseline.successRate ||
    metrics.explicitReminders < baseline.explicitReminders;
  if (!improves) reasons.push('NO_MEASURED_BENEFIT');
  return { pass: reasons.length === 0, reasons };
}

export function compareAll(metrics: Metrics, baselines: Record<string, Metrics>, gates: Gates) {
  const reasons = Object.entries(baselines).flatMap(([name, baseline]) =>
    decideRelease(metrics, baseline, gates).reasons.map(reason => `${name}:${reason}`));
  return { pass: reasons.length === 0, reasons };
}

export function aggregateBy(results: TrialResult[], key: 'condition' | 'host' | 'catalogSize'): Record<string, Metrics> {
  const groups = new Map<string, TrialResult[]>();
  for (const result of results) {
    const label = String(result[key] ?? 'unknown');
    groups.set(label, [...(groups.get(label) ?? []), result]);
  }
  return Object.fromEntries([...groups].map(([label, rows]) => [label, aggregate(rows)]));
}
