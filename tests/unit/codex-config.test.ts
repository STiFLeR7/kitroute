import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCodexConfig } from '../../src/adapters/codex.js';
import type { Capability } from '../../src/contracts.js';

const cap = (source: string, o: Partial<Capability> = {}): Capability => ({
  id: source, host: 'codex', projectId: 'p', kind: 'skill', name: 'n', description: 'd', terms: [], phases: [],
  policy: 'implicit', availability: 'available', revision: 'r', source, target: source, action: 'load',
  ...o,
} as Capability);
const blk = (p: string, e: string) => `[[skills.config]]\npath = ${p}\nenabled = ${e}\n`;
const pol = (items: Capability[], text: string | null) => applyCodexConfig(items, text).map((c) => c.policy);

test('disabled by path', () => {
  assert.deepEqual(pol([cap('/h/a/SKILL.md'), cap('/h/b/SKILL.md')], blk('"/h/a/SKILL.md"', 'false')), ['disabled', 'implicit']);
});
test('enabled=true leaves policy', () => {
  assert.deepEqual(pol([cap('/h/a/SKILL.md')], blk('"/h/a/SKILL.md"', 'true')), ['implicit']);
});
test('unrelated tables and comments ignored', () => {
  const t = `# c\n[model]\npath = "/h/a/SKILL.md"\nenabled = false\n[[skills.config]] # x\n# path = "/zzz"\npath = "/h/a/SKILL.md" # trailing\nenabled = false # no\n[other]\nx = 1\n`;
  assert.deepEqual(pol([cap('/h/a/SKILL.md')], t), ['disabled']);
});
test('single-quoted path', () => {
  assert.deepEqual(pol([cap('C:\\h\\a\\SKILL.md')], blk("'C:\\h\\a\\SKILL.md'", 'false')), ['disabled']);
});
test('windows backslash vs forward slash, case-insensitive drive paths only', () => {
  assert.deepEqual(pol([cap('C:\\Users\\X\\a\\SKILL.md')], blk('"c:/users/x/a/SKILL.md"', 'false')), ['disabled']);
  assert.deepEqual(pol([cap('/h/A/SKILL.md')], blk('"/h/a/SKILL.md"', 'false')), ['implicit']);
});
test('unparseable block fails closed', () => {
  for (const t of [
    '[[skills.config]]\nenabled = false\n',
    '[[skills.config]]\npath = /h/a/SKILL.md\nenabled = false\n',
    '[[skills.config]]\npath = "/h/a/SKILL.md"\nenabled = "no"\n',
    '[[skills.config]]\npath = "/h/\\a/SKILL.md"\nenabled = false\n',
    '[[skills.config]]\npath = """/h/a"""\nenabled = false\n',
  ]) {
    assert.deepEqual(
      pol([cap('/h/a/SKILL.md'), cap('/h/b/SKILL.md', { policy: 'disabled' }), cap('/h/c/SKILL.md', { policy: 'explicit-only' })], t),
      ['unknown', 'disabled', 'explicit-only'],
      t,
    );
  }
});
test('explicit-only never upgraded', () => {
  assert.deepEqual(pol([cap('/h/a/SKILL.md', { policy: 'explicit-only' })], blk('"/h/a/SKILL.md"', 'true')), ['explicit-only']);
  assert.deepEqual(pol([cap('/h/a/SKILL.md', { policy: 'unknown' })], blk('"/h/a/SKILL.md"', 'true')), ['unknown']);
});
test('null config unchanged; tool and non-codex items untouched', () => {
  const items = [cap('/h/a/SKILL.md')];
  assert.deepEqual(applyCodexConfig(items, null), items);
  const t = cap('/h/a/SKILL.md', { kind: 'tool' });
  const c = cap('/h/a/SKILL.md', { host: 'claude-code' });
  assert.deepEqual(pol([t, c], blk('"/h/a/SKILL.md"', 'false')), ['implicit', 'implicit']);
  assert.deepEqual(pol([t, c], '[[skills.config]]\nenabled = false\n'), ['implicit', 'implicit']);
});
