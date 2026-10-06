import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { AdapterInput } from '../../src/contracts.js';
import { claudeCode } from '../../src/adapters/claude-code.js';
import { codex } from '../../src/adapters/codex.js';
import { runCli } from '../../src/cli.js';
import { handleHook } from '../../src/hooks/handle.js';
import { listUsage, observedUse, pruneUsage, recordObservation } from '../../src/history/records.js';
import { openStore } from '../../src/storage/database.js';
import { makeCapability } from '../fixtures/capabilities.js';

const fx = (n: string) => JSON.parse(readFileSync(
  fileURLToPath(new URL(`../../../tests/fixtures/hooks/${n}.json`, import.meta.url)), 'utf8'));
const DAY = 24 * 60 * 60 * 1000;

test('observedUse classifier', () => {
  assert.equal(observedUse({ capabilityId: 'c', kind: 'guidance', succeeded: null }), false);
  assert.equal(observedUse({ capabilityId: 'c', kind: 'file-read', succeeded: true }), false);
  assert.equal(observedUse({ capabilityId: 'c', kind: 'tool-call', succeeded: false }), true);
});

const skill = makeCapability({ id: 'sk', host: 'claude-code', projectId: 'a', kind: 'skill', name: 'debug' });
const otherProj = makeCapability({ id: 'sk2', host: 'claude-code', projectId: 'b', kind: 'skill', name: 'debug' });
const mcp = makeCapability({ id: 'm', host: 'claude-code', projectId: 'a', kind: 'tool', name: 'search',
  target: 'mcp__synthetic__search', action: 'tool-guidance' });
const cmcp = { ...mcp, id: 'cm', host: 'codex' as const };
const inp = (o: Partial<AdapterInput>): AdapterInput =>
  ({ host: 'claude-code', event: 'PostToolUse', cwd: '/x', sessionId: 's', projectId: 'a', ...o });

test('normalize: PostToolUse, failure event, skill, no payload leakage', () => {
  const n = claudeCode.normalize(fx('claude-code-posttooluse'), 'PostToolUse')!;
  assert.deepEqual(n, { host: 'claude-code', event: 'PostToolUse', cwd: 'C:/synthetic/project',
    sessionId: 'synthetic-session-1', toolName: 'Skill', skillTarget: 'debug', eventId: 'toolu_synthetic_1', succeeded: true });
  const f = claudeCode.normalize({ ...fx('claude-code-posttooluse'), error: 'UNIQUE_ERROR_MARKER' }, 'PostToolUseFailure')!;
  assert.equal(f.succeeded, false);
  assert.equal(JSON.stringify(f).includes('MARKER'), false);
  assert.equal(claudeCode.normalize({ session_id: 's', cwd: 'c' }, 'PostToolUse'), null);
  const c = codex.normalize(fx('codex-posttooluse'), 'PostToolUse')!;
  assert.equal(c.toolName, 'mcp__synthetic__search');
  assert.equal(c.eventId, 'call_synthetic_1');
  assert.equal(c.succeeded, undefined);
  assert.equal(JSON.stringify(c).includes('MARKER'), false);
});

test('proven Claude Skill call is native-load, scoped to the active inventory', () => {
  const i = inp({ toolName: 'Skill', skillTarget: 'debug', succeeded: true });
  assert.deepEqual(claudeCode.observe(i, [skill, otherProj, mcp]), { capabilityId: 'sk', kind: 'native-load', succeeded: true });
  assert.equal(claudeCode.observe(i, [otherProj]), null);
  assert.equal(claudeCode.observe(i, [{ ...skill, host: 'codex' }]), null);
  assert.equal(claudeCode.observe(inp({ toolName: 'Skill', skillTarget: 'nope', succeeded: true }), [skill]), null);
});

test('MCP tool success and failure are tool-calls and count as use', () => {
  for (const ok of [true, false]) {
    const o = claudeCode.observe(inp({ toolName: 'mcp__synthetic__search', succeeded: ok }), [skill, mcp])!;
    assert.deepEqual(o, { capabilityId: 'm', kind: 'tool-call', succeeded: ok });
    assert.equal(observedUse(o), true);
  }
  assert.equal(claudeCode.observe(inp({ toolName: 'mcp__other__x', succeeded: true }), [skill, mcp]), null);
  assert.equal(claudeCode.observe(inp({ toolName: 'mcp__synthetic__search' }), [mcp])!.succeeded, null);
});

test('Codex: tool-call only; skill-like events stay unknown', () => {
  const o = codex.observe(inp({ host: 'codex', toolName: 'mcp__synthetic__search' }), [cmcp])!;
  assert.deepEqual(o, { capabilityId: 'cm', kind: 'tool-call', succeeded: null });
  const s = makeCapability({ id: 'cs', host: 'codex', projectId: 'a', kind: 'skill', name: 'debug' });
  assert.equal(codex.observe(inp({ host: 'codex', toolName: 'Skill', skillTarget: 'debug', succeeded: true }), [s]), null);
  assert.equal(codex.observe(inp({ host: 'codex', toolName: 'Bash' }), [s, cmcp]), null);
});

test('duplicate eventId yields one row; distinct ids two; no id appends each time', () => {
  const store = openStore(':memory:');
  const obs = { capabilityId: 'm', kind: 'tool-call' as const, succeeded: false };
  const i = inp({ eventId: 'e1' });
  assert.equal(recordObservation(store, i, obs, 'search', 1000), true);
  assert.equal(recordObservation(store, i, obs, 'search', 1001), false);
  assert.equal(recordObservation(store, { ...i, eventId: 'e2' }, obs, 'search', 1002), true);
  assert.equal(listUsage(store).length, 2);
  assert.equal(listUsage(store)[0]!.result, 'failure');
  const { eventId: _e, ...noId } = i;
  recordObservation(store, noId, obs, 'search', 1003);
  recordObservation(store, noId, obs, 'search', 1004);
  assert.equal(listUsage(store).length, 4);
  store.close();
});

test('retention also prunes observed_events', () => {
  const store = openStore(':memory:');
  const now = 100 * DAY;
  const ins = store.db.prepare("INSERT INTO observed_events VALUES ('codex','s',?,?)");
  ins.run('old', now - 31 * DAY); ins.run('edge', now - 30 * DAY); ins.run('new', now);
  assert.equal(pruneUsage(store, now), 0);
  assert.deepEqual(store.db.prepare('SELECT event_id FROM observed_events ORDER BY at_ms').all()
    .map((r) => r.event_id), ['edge', 'new']);
  store.close();
});

test('end to end: PostToolUse is silent, records one row; history and tables are private', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kit-obs-'));
  const home = join(tmp, 'home'), proj = join(tmp, 'proj'), data = join(tmp, 'data');
  const d = join(proj, '.claude', 'skills', 'kt-checkout-debug');
  mkdirSync(home, { recursive: true }); mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'SKILL.md'),
    '---\nname: kt-checkout-debug\ndescription: Debug synthetic checkout failures\n---\nbody\n');
  const saved = { ...process.env };
  Object.assign(process.env, { KITROUTE_HOME: data, HOME: home, USERPROFILE: home });
  try {
    const M = ['UNIQUE_PROMPT_MARKER', 'UNIQUE_INPUT_MARKER', 'UNIQUE_RESPONSE_MARKER', 'UNIQUE_ERROR_MARKER'];
    const base = { session_id: 's1', cwd: proj, hook_event_name: 'PostToolUse', tool_name: 'Skill',
      tool_input: { skill: 'kt-checkout-debug', args: M[1] }, tool_response: { out: M[2] }, tool_use_id: 'toolu_1' };
    const post = JSON.stringify(base);
    assert.equal(await handleHook('claude-code', 'PostToolUse', post, undefined, 20000), '');
    assert.equal(await handleHook('claude-code', 'PostToolUse', post, undefined, 20000), '');
    assert.equal(await handleHook('claude-code', 'PostToolUseFailure',
      JSON.stringify({ ...base, tool_use_id: 'toolu_2', error: M[3] }), undefined, 20000), '');
    await handleHook('claude-code', 'UserPromptSubmit', JSON.stringify({
      session_id: 's1', cwd: proj, prompt: `debug the checkout failure ${M[0]}`, prompt_id: 'p1' }), undefined, 20000);
    const db = new DatabaseSync(join(data, 'kitroute.db'));
    const rows = db.prepare('SELECT event, result FROM usage').all() as Array<{ event: string; result: string }>;
    assert.deepEqual(rows.map((r) => `${r.event}:${r.result}`).sort(),
      ['native-load:failure', 'native-load:success', 'selection:unknown']);
    const dump = JSON.stringify([db.prepare('SELECT * FROM usage').all(), db.prepare('SELECT * FROM observed_events').all()]);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM observed_events').get()!.n, 2);
    db.close();
    const history = await runCli(['history'], '');
    assert.equal(JSON.parse(history).command, 'history');
    assert.equal(JSON.parse(history).records.length, 3);
    for (const m of M) { assert.equal(dump.includes(m), false); assert.equal(history.includes(m), false); }
  } finally {
    for (const k of ['KITROUTE_HOME', 'HOME', 'USERPROFILE']) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('observe without projectId is null (no cross-project leak)', () => {
  const { projectId: _p, ...noProj } = inp({ toolName: 'Skill', skillTarget: 'debug', succeeded: true });
  assert.equal(claudeCode.observe(noProj, [skill, otherProj]), null);
  assert.equal(claudeCode.observe({ ...noProj, skillTarget: undefined, toolName: 'mcp__synthetic__search' } as AdapterInput, [mcp]), null);
});

test('failed usage insert rolls back the dedupe row so a retry succeeds', () => {
  const store = openStore(':memory:');
  const obs = { capabilityId: 'm', kind: 'tool-call' as const, succeeded: true };
  const i = inp({ eventId: 'e9' });
  assert.throws(() => recordObservation(store, i, obs, '', 1000), { message: 'STORE_WRITE_FAILED' });
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM observed_events').get()!.n, 0);
  assert.equal(recordObservation(store, i, obs, 'search', 1001), true);
  store.close();
});

test('worker start prunes usage older than 30 days', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kit-prune-'));
  const home = join(tmp, 'home'), proj = join(tmp, 'proj'), data = join(tmp, 'data');
  mkdirSync(home, { recursive: true }); mkdirSync(proj, { recursive: true }); mkdirSync(data, { recursive: true });
  const saved = { ...process.env };
  Object.assign(process.env, { KITROUTE_HOME: data, HOME: home, USERPROFILE: home });
  try {
    const s = openStore(join(data, 'kitroute.db'));
    s.db.prepare("INSERT INTO usage VALUES ('codex','p','s','c','n','selection','unknown',1,?)").run(Date.now() - 31 * DAY);
    s.close();
    await handleHook('claude-code', 'PostToolUse', JSON.stringify({
      session_id: 's', cwd: proj, tool_name: 'Bash', tool_use_id: 't' }), undefined, 20000);
    const db = new DatabaseSync(join(data, 'kitroute.db'));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM usage').get()!.n, 0);
    db.close();
  } finally {
    for (const k of ['KITROUTE_HOME', 'HOME', 'USERPROFILE']) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
    rmSync(tmp, { recursive: true, force: true });
  }
});
