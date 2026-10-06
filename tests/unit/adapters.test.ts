import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { claudeCode } from '../../src/adapters/claude-code.js';
import { codex } from '../../src/adapters/codex.js';
import type { RouteResult } from '../../src/contracts.js';

const dir = fileURLToPath(new URL('../../../tests/fixtures/hooks/', import.meta.url));
const load = async (n: string) => JSON.parse(await readFile(dir + n, 'utf8')) as Record<string, unknown>;
const res = (status: RouteResult['status'], guidance: string): RouteResult =>
  ({ status, ids: [], reasonCodes: [], guidance, elapsedMs: 0 });
const E = 'UserPromptSubmit';

test('normalization keeps request text transient', () => {
  const raw = { session_id: 's', cwd: '/synthetic/project', prompt: 'Fix checkout' };
  const input = claudeCode.normalize(raw, 'UserPromptSubmit');
  assert.equal(input?.sessionId, 's');
  assert.equal(input?.text, 'Fix checkout');
});

for (const [name, adapter, fixture] of [['claude-code', claudeCode, 'claude-code.json'], ['codex', codex, 'codex.json']] as const) {
  test(`${name}: fixture normalizes without copying unknown fields`, async () => {
    const raw = await load(fixture);
    const input = adapter.normalize(raw, E)!;
    assert.equal(input.host, name);
    assert.equal(input.sessionId, raw.session_id);
    assert.equal(input.cwd, raw.cwd);
    assert.equal(input.text, 'Fix checkout');
    assert.equal(input.turnId, raw.turn_id ?? raw.prompt_id);
    assert.equal(typeof input.turnId, 'string');
    assert.deepEqual(Object.keys(input).filter((k) => !['host', 'event', 'cwd', 'sessionId', 'turnId', 'text'].includes(k)), []);
  });

  test(`${name}: malformed and unsupported input returns null`, async () => {
    const ok = await load(fixture);
    for (const bad of [null, undefined, 'x', 5, [], { ...ok, session_id: undefined }, { ...ok, cwd: 1 }, { ...ok, prompt: 3 }]) {
      assert.equal(adapter.normalize(bad, E), null);
    }
    assert.equal(adapter.normalize(ok, 'PreToolUse'), null);
    assert.equal(adapter.normalize(ok, 'Stop'), null);
  });

  test(`${name}: render selected/abstain/degraded`, () => {
    const out = adapter.render(res('selected', 'Use skill X'), E);
    assert.deepEqual(JSON.parse(out), { hookSpecificOutput: { hookEventName: E, additionalContext: 'Use skill X' } });
    assert.equal(adapter.validateOutput(out, E), out);
    assert.equal(adapter.render(res('abstain', 'g'), E), '');
    assert.equal(adapter.render(res('degraded', 'g'), E), '');
    assert.equal(adapter.render(res('selected', '  '), E), '');
    assert.equal(adapter.render(res('selected', 'g'), 'Stop'), '');
    assert.equal(adapter.validateOutput('', E), '');
  });

  test(`${name}: validateOutput rejects extras and wrong shapes`, () => {
    const h = (o: object) => JSON.stringify({ hookSpecificOutput: { hookEventName: E, additionalContext: 'x', ...o } });
    assert.equal(adapter.validateOutput(h({}), E) !== null, true);
    assert.equal(adapter.validateOutput(h({ permissionDecision: 'deny' }), E), null);
    assert.equal(adapter.validateOutput(h({ hookEventName: 'Stop' }), E), null);
    assert.equal(adapter.validateOutput(h({ additionalContext: 5 }), E), null);
    assert.equal(adapter.validateOutput(h({}), 'Stop'), null);
    assert.equal(adapter.validateOutput(JSON.stringify({ decision: 'block', hookSpecificOutput: { hookEventName: E, additionalContext: 'x' } }), E), null);
    assert.equal(adapter.validateOutput('not json', E), null);
    assert.equal(adapter.validateOutput('[]', E), null);
  });

  test(`${name}: observe is unknown`, () => {
    assert.equal(adapter.observe({ host: name, event: E, cwd: '/s', sessionId: 's' }, []), null);
  });
}
