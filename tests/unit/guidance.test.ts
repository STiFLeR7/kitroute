import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderGuidance } from '../../src/routing/guidance.js';
import { select, GUIDANCE_BUDGET } from '../../src/routing/select.js';
import { makeCapability, request, policy } from '../fixtures/capabilities.js';

test('empty selection renders nothing', () => {
  assert.deepEqual(renderGuidance([], policy), { ids: [], guidance: '' });
});

test('cap drops whole lines, never truncates', () => {
  const a = makeCapability({ id: 'a' });
  const big = makeCapability({ id: 'big', target: 'x'.repeat(500) });
  const one = JSON.stringify({ capability: a.name, action: a.action, target: a.target });
  const r = renderGuidance([a, big, makeCapability({ id: 'c' })], { ...policy, maxGuidanceChars: one.length * 2 + 1 });
  assert.deepEqual(r.ids, ['a', 'c']);
  for (const l of r.guidance.split('\n')) JSON.parse(l);
});

test('select abstains with GUIDANCE_BUDGET when nothing fits', () => {
  const r = select(request, [makeCapability()], { ...policy, maxGuidanceChars: 5 });
  assert.equal(r.status, 'abstain');
  assert.deepEqual(r.ids, []);
  assert.deepEqual(r.reasonCodes, [GUIDANCE_BUDGET]);
  assert.equal(r.guidance, '');
});
