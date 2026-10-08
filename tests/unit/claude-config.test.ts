import test from 'node:test';
import assert from 'node:assert/strict';
import { applyClaudeOverrides } from '../../src/adapters/claude-code.js';
import type { Capability } from '../../src/contracts.js';

const cap = (name: string, o: Partial<Capability> = {}): Capability => ({
  id: name, host: 'claude-code', projectId: 'p', kind: 'skill', name, description: 'd', terms: [], phases: [],
  policy: 'implicit', availability: 'available', revision: 'r', source: `/p/.claude/skills/${name}/SKILL.md`,
  target: `/p/.claude/skills/${name}/SKILL.md`, action: 'load', ...o,
} as Capability);
const set = (o: unknown) => JSON.stringify({ skillOverrides: o });
const pol = (items: Capability[], ...texts: Array<string | null>) => applyClaudeOverrides(items, texts).map((c) => c.policy);

test('off disables, user-invocable-only is explicit-only, on and name-only leave policy', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map((n) => cap(n));
  assert.deepEqual(pol(items, set({ a: 'off', b: 'user-invocable-only', c: 'on', d: 'name-only' })),
    ['disabled', 'explicit-only', 'implicit', 'implicit', 'implicit']);
});
test('directory name also matches', () => {
  assert.deepEqual(pol([cap('deploy', { source: '/p/.claude/skills/deploy-staging/SKILL.md' })], set({ 'deploy-staging': 'off' })), ['disabled']);
});
test('higher-precedence file wins per skill; other entries still apply', () => {
  assert.deepEqual(pol([cap('a'), cap('b')], set({ a: 'off', b: 'off' }), null, set({ a: 'on' })), ['implicit', 'disabled']);
});
test('unknown state fails closed for that skill', () => {
  assert.deepEqual(pol([cap('a'), cap('b'), cap('c')], set({ a: 'hidden', b: { hidden: true }, c: 'constructor' })),
    ['unknown', 'unknown', 'unknown']);
});
test('unparseable settings fail closed; missing or blank files are ignored', () => {
  for (const t of ['{', '[]', set([]), set('off')]) assert.deepEqual(pol([cap('a')], t), ['unknown'], t);
  assert.deepEqual(pol([cap('a')], null, ' \n', '{"theme":"dark"}'), ['implicit']);
});
test('never loosens policy; other hosts and tools untouched', () => {
  assert.deepEqual(pol([cap('a', { policy: 'explicit-only' }), cap('b', { policy: 'disabled' })], set({ a: 'on', b: 'on' })), ['explicit-only', 'disabled']);
  assert.deepEqual(pol([cap('a', { host: 'codex' }), cap('b', { kind: 'tool' })], set({ a: 'off', b: 'off' })), ['implicit', 'implicit']);
});
