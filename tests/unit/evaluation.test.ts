import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, aggregateBy, compareAll, decideRelease, type Gates } from '../../evaluation/report.js';
import { ingestTrial, type Metrics, type TrialResult } from '../../evaluation/run.js';

const base: TrialResult = {
  caseId: 'a', condition: 'kitroute', success: false, observedIds: null,
  selectedIds: ['debug'], addedMs: 10, guidanceChars: 80, nativeContextChars: null,
  unnecessarySelections: 0, explicitReminders: 1
};

test('aggregate keeps unknown observation and context as unknown', () => {
  const result = aggregate([base]);
  assert.equal(result.successRate, 0);
  assert.equal(result.unknownActivationTrials, 1);
  assert.equal(result.measuredActivationTrials, 0);
  assert.equal(result.meanNativeContextChars, null);
});

test('ingestTrial accepts a valid trial and rejects bad values with fixed codes', () => {
  assert.deepEqual(ingestTrial(base), base);
  const bad = (patch: object, code: string) =>
    assert.throws(() => ingestTrial({ ...base, ...patch }), { message: code });
  bad({ addedMs: Number.NaN }, 'INVALID_TRIAL');
  bad({ addedMs: Infinity }, 'INVALID_TRIAL');
  bad({ guidanceChars: -1 }, 'INVALID_TRIAL');
  bad({ unnecessarySelections: -1 }, 'INVALID_TRIAL');
  bad({ explicitReminders: -2 }, 'INVALID_TRIAL');
  bad({ caseId: '' }, 'INVALID_TRIAL');
  bad({ condition: 'bogus' }, 'INVALID_TRIAL');
  assert.throws(() => ingestTrial(null), { message: 'INVALID_TRIAL' });
});

test('aggregateBy groups by condition, host and catalog size', () => {
  const rows: TrialResult[] = [
    { ...base, success: true, host: 'codex', catalogSize: 10 },
    { ...base, success: false, host: 'codex', catalogSize: 50 },
    { ...base, success: true, condition: 'native', host: 'claude-code', catalogSize: 50 }
  ];
  assert.deepEqual(Object.keys(aggregateBy(rows, 'catalogSize')).sort(), ['10', '50']);
  assert.equal(aggregateBy(rows, 'catalogSize')['50']!.successRate, 0.5);
  assert.equal(aggregateBy(rows, 'condition')['native']!.successRate, 1);
  assert.deepEqual(Object.keys(aggregateBy(rows, 'host')).sort(), ['claude-code', 'codex']);
  assert.ok('unknown' in aggregateBy([base], 'host'));
});

const gates: Gates = { maxMeanAddedMs: 2500, maxMeanGuidanceChars: 2000, maxUnnecessarySelections: 2, maxExplicitReminders: 5 };
const baseline: Metrics = {
  successRate: 0.5, measuredActivationTrials: 10, unknownActivationTrials: 0, meanAddedMs: 0,
  meanGuidanceChars: 0, meanNativeContextChars: null, unnecessarySelections: 0, explicitReminders: 4
};
const better: Metrics = { ...baseline, successRate: 0.6, meanAddedMs: 100, meanGuidanceChars: 300 };

test('release gate: equal success without fewer reminders has no measured benefit', () => {
  assert.deepEqual(decideRelease({ ...better, successRate: 0.5 }, baseline, gates),
    { pass: false, reasons: ['NO_MEASURED_BENEFIT'] });
});

test('release gate: success regression alone', () => {
  assert.deepEqual(decideRelease({ ...better, successRate: 0.4, explicitReminders: 1 }, baseline, gates),
    { pass: false, reasons: ['SUCCESS_REGRESSION'] });
});

test('release gate: overhead alone', () => {
  assert.deepEqual(decideRelease({ ...better, meanAddedMs: 2501 }, baseline, gates).reasons, ['EXCESS_OVERHEAD']);
});

test('release gate: excess context alone, independent of time', () => {
  assert.deepEqual(decideRelease({ ...better, meanGuidanceChars: 2001 }, baseline, gates).reasons, ['EXCESS_CONTEXT']);
});

test('release gate: fewer reminders with equal success passes', () => {
  assert.deepEqual(decideRelease({ ...better, successRate: 0.5, explicitReminders: 3 }, baseline, gates),
    { pass: true, reasons: [] });
});

test('compareAll fails when any one baseline regresses', () => {
  const ok = compareAll(better, { native: baseline, descriptions: baseline }, gates);
  assert.equal(ok.pass, true);
  const bad = compareAll(better, { native: baseline, router: { ...baseline, successRate: 0.9 } }, gates);
  assert.equal(bad.pass, false);
  assert.ok(bad.reasons.includes('router:SUCCESS_REGRESSION'));
  assert.ok(bad.reasons.every(reason => reason.startsWith('router:')));
});
