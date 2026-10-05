import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregate, aggregateBy } from '../../evaluation/report.js';
import { ingestTrial, type TrialResult } from '../../evaluation/run.js';

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
