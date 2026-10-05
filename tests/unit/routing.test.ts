import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Capability, RouteRequest } from '../../src/contracts.js';
import { select } from '../../src/routing/select.js';
import { makeCapability, request, policy } from '../fixtures/capabilities.js';

const catalog: Capability[] = JSON.parse(readFileSync(
  fileURLToPath(new URL('../../../tests/fixtures/catalog.json', import.meta.url)), 'utf8'));
const req = (o: Partial<RouteRequest>): RouteRequest => ({ ...request, ...o });

test('brief snippet: explicit-only, unknown tool, five relevant', () => {
  const explicitOnly = makeCapability({ policy: 'explicit-only' });
  const unknownTool = makeCapability({
    kind: 'tool', availability: 'unknown', target: 'synthetic_tool', action: 'tool-guidance'
  });
  const five = Array.from({ length: 5 }, (_, index) => makeCapability({ id: `synthetic-${index}` }));
  assert.equal(select(request, [explicitOnly], policy).status, 'abstain');
  assert.equal(select(request, [unknownTool], policy).ids.length, 0);
  assert.ok(select(request, five, policy).ids.length <= 3);
});

test('unrelated acknowledgement and empty text abstain', () => {
  for (const text of ['thanks, looks good', '']) {
    const r = select(req({ text }), catalog, policy);
    assert.equal(r.status, 'abstain');
    assert.deepEqual(r.ids, []);
    assert.equal(r.guidance, '');
  }
});

test('ineligible policy/availability/scope never selected', () => {
  const r = select(req({ text: 'checkout', phase: 'general' }), catalog, policy);
  for (const bad of ['a-explicit', 'a-disabled', 'a-policy-unknown', 'a-tool-unknown',
    'a-tool-unavailable', 'b-debug-checkout', 'cc-debug-checkout']) {
    assert.ok(!r.ids.includes(bad), bad);
  }
  const b = select(req({ text: 'checkout', projectId: 'b' }), catalog, policy);
  assert.deepEqual(b.ids, ['b-debug-checkout']);
  const cc = select(req({ text: 'checkout', host: 'claude-code' }), catalog, policy);
  assert.deepEqual(cc.ids, ['cc-debug-checkout']);
});

test('overlapping names rank deterministically', () => {
  const text = 'debug checkout error';
  const a = select(req({ text }), catalog, policy);
  const b = select(req({ text }), [...catalog].reverse(), policy);
  assert.equal(a.ids[0], 'a-debug-checkout');
  assert.deepEqual(a.ids, b.ids);
});

test('exact ties break by id ascending, stable across input order', () => {
  const items = ['z', 'm', 'a', 'q'].map(s => makeCapability({ id: `tie-${s}` }));
  const perms = [items, [...items].reverse(), [items[2], items[0], items[3], items[1]]];
  for (const p of perms) {
    assert.deepEqual(select(request, p, policy).ids, ['tie-a', 'tie-m', 'tie-q']);
  }
});

test('phase eligibility', () => {
  const fix = [catalog.find((c: Capability) => c.id === 'a-fix-checkout')!];
  assert.deepEqual(select(req({ text: 'fix checkout', phase: 'implement' }), fix, policy).ids,
    ['a-fix-checkout']);
  assert.equal(select(req({ text: 'fix checkout', phase: 'reproduce' }), fix, policy).status, 'abstain');
  const general = [makeCapability({ phases: ['general'] })];
  for (const phase of ['reproduce', 'implement'] as const) {
    assert.equal(select(req({ phase }), general, policy).status, 'selected');
  }
});

test('more than three relevant yields exactly three', () => {
  const r = select(req({ text: 'checkout', phase: 'general' }), catalog, policy);
  assert.equal(r.status, 'selected');
  assert.equal(r.ids.length, 3);
  assert.equal(r.guidance, '');
});

test('reason codes are fixed and leak nothing', () => {
  const text = 'secret-token-xyz checkout';
  const weak = [makeCapability({ terms: [], description: 'zzz', name: 'zzz' })];
  for (const items of [catalog, [], weak]) {
    const r = select(req({ text }), items, policy);
    assert.ok(r.reasonCodes.length > 0);
    assert.ok(r.reasonCodes.every(c => /^[A-Z_]+$/.test(c)));
    assert.ok(!JSON.stringify(r).includes('secret-token'));
  }
  assert.deepEqual(select(request, [], policy).reasonCodes, ['NO_ELIGIBLE']);
  assert.deepEqual(select(req({ text: 'unrelated' }), catalog, policy).reasonCodes, ['WEAK_MATCH']);
  assert.deepEqual(select(request, catalog, policy).reasonCodes, ['SELECTED']);
  assert.ok(Number.isInteger(select(request, catalog, policy).elapsedMs));
});

test('unicode text does not throw', () => {
  assert.doesNotThrow(() => select(req({ text: 'résumé 日本語 🚀 \u0000 checkout' }), catalog, policy));
});
