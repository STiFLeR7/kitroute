import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Capability } from '../../src/contracts.js';
import {
  expandCatalog, kitrouteSelectionExecutor, liveExecutor, loadBaseCatalog, loadCases, runAssertion, runCli, runTrials,
  type EvalCase, type TrialResult
} from '../../evaluation/run.js';
import { aggregateBy } from '../../evaluation/report.js';

const base = loadBaseCatalog();
const find = (id: string): EvalCase => loadCases().find(c => c.id === id)!;
const stub = async (c: EvalCase, condition: TrialResult['condition'], catalog: Capability[]): Promise<TrialResult> => ({
  caseId: c.id, condition, success: true, observedIds: null, selectedIds: [], addedMs: 1,
  guidanceChars: catalog.length, nativeContextChars: null, unnecessarySelections: 0, explicitReminders: 0
});

test('case set shape: 28 cases, category counts, balanced splits', () => {
  const cases = loadCases();
  assert.equal(cases.length, 28);
  const count = (f: (c: EvalCase) => boolean) => cases.filter(f).length;
  for (const [cat, n] of [['relevant', 12], ['overlapping', 6], ['no-specialist', 6], ['unavailable', 4]] as const) {
    assert.equal(count(c => c.category === cat), n);
    for (const split of ['development', 'held-out'] as const) assert.ok(count(c => c.category === cat && c.split === split) > 0);
  }
  assert.equal(count(c => c.split === 'development'), 14);
  assert.equal(count(c => c.split === 'held-out'), 14);
});

test('catalog expansion is deterministic with exact sizes', () => {
  for (const size of [10, 50, 200]) {
    const a = expandCatalog(base, size);
    assert.equal(a.length, size);
    assert.deepEqual(a, expandCatalog(base, size));
    assert.equal(new Set(a.map(c => c.id)).size, size);
  }
  assert.throws(() => expandCatalog(base, 3), { message: 'INVALID_CATALOG_SIZE' });
});

test('runTrials groups results by condition and catalog size with a fake executor', async () => {
  const dev = loadCases().filter(c => c.split === 'development').slice(0, 2);
  const results = await runTrials(dev, ['kitroute', 'native'], { sizes: [10, 50], repeats: 3 }, stub);
  assert.equal(results.length, 2 * 2 * 2 * 3);
  const bySize = aggregateBy(results, 'catalogSize');
  assert.equal(bySize['10']!.meanGuidanceChars, 10);
  assert.equal(bySize['50']!.meanGuidanceChars, 50);
  assert.equal(Object.keys(aggregateBy(results, 'condition')).length, 2);
});

test('offline executor abstains on no-specialist and never selects explicit-only or unavailable entries', async () => {
  const catalog = expandCatalog(base, 50);
  const none = await kitrouteSelectionExecutor(find('dev-none-thanks'), 'kitroute', catalog);
  assert.deepEqual(none.selectedIds, []);
  assert.equal(none.success, true);
  assert.equal(none.observedIds, null);
  assert.equal(none.nativeContextChars, null);
  for (const id of ['dev-unav-deploy', 'dev-unav-translate']) {
    const r = await kitrouteSelectionExecutor(find(id), 'kitroute', catalog);
    assert.deepEqual(r.selectedIds, []);
    assert.equal(r.success, true);
  }
  const rel = await kitrouteSelectionExecutor(find('dev-rel-debug'), 'kitroute', catalog);
  assert.deepEqual(rel.selectedIds, ['debug-failing-test']);
});

test('live executors are not authorized', async () => {
  await assert.rejects(liveExecutor(find('dev-rel-debug'), 'native', base), { message: 'LIVE_EXECUTOR_NOT_AUTHORIZED' });
});

test('runAssertion runs a fixture assertion with an argument array', () => {
  assert.equal(runAssertion(find('dev-rel-debug')).passed, true);
  assert.equal(runAssertion({ ...find('dev-rel-debug'), assertionCommand: ['node', '-e', 'process.exit(3)'] }).passed, false);
});

test('held-out split is refused without confirmation', async () => {
  await assert.rejects(runCli(['--split', 'held-out', '--sizes', '10', '--repeats', '1', '--out', 'x.json']),
    { message: 'HELD_OUT_NOT_CONFIRMED' });
});
