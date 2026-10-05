import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { advanceState, continuationText, phaseFromInput } from '../../src/lifecycle/state.js';
import { handleHook } from '../../src/hooks/handle.js';
import { pruneUsage } from '../../src/history/records.js';
import { openStore } from '../../src/storage/database.js';
import { claudeCode } from '../../src/adapters/claude-code.js';
import { codex } from '../../src/adapters/codex.js';

const base = {
  host: 'codex' as const, event: 'UserPromptSubmit', cwd: '/synthetic',
  projectId: 'a', inventoryRevision: 'fixture-v1', sessionId: 's'
};

test('brief: regression tests move reproduce to verify', () => {
  const previous = { phase: 'reproduce' as const, signature: 'old' };
  const next = advanceState(previous, { ...base, text: 'Now run the regression tests' }, ['testing']);
  assert.equal(next.phase, 'verify');
  assert.notEqual(next.signature, previous.signature);
});

test('phase heuristic and precedence', () => {
  const p = (text?: string) => phaseFromInput({ ...base, ...(text === undefined ? {} : { text }) });
  assert.equal(p('why is this crashing? debug it'), 'reproduce');
  assert.equal(p('implement the feature'), 'implement');
  assert.equal(p('debug then add a test'), 'verify');
  assert.equal(p('fix the bug'), 'reproduce');
  assert.equal(p('hello there'), null);
  assert.equal(p(), null);
});

test('no match keeps the previous phase; signature ignores text and id order', () => {
  const prev = { phase: 'implement' as const, signature: '' };
  const a = advanceState(prev, { ...base, text: 'thanks SECRET' }, ['x', 'y']);
  const b = advanceState(prev, { ...base, text: 'other words' }, ['y', 'x']);
  assert.equal(a.phase, 'implement');
  assert.equal(a.signature, b.signature);
  assert.notEqual(a.signature, advanceState(prev, { ...base, projectId: 'b' }, ['x', 'y']).signature);
  assert.notEqual(a.signature, advanceState(prev, { ...base, inventoryRevision: 'v2' }, ['x', 'y']).signature);
  assert.equal(continuationText('verify'), 'test verify regression behavior');
});

const EV = 'UserPromptSubmit';
const prompt = (cwd: string, text: string, session = 's1') =>
  JSON.stringify({ session_id: session, cwd, prompt: text, prompt_id: 'p', hook_event_name: EV });
const start = (cwd: string, source: string, session = 's1') =>
  JSON.stringify({ session_id: session, cwd, source, hook_event_name: 'SessionStart' });

function mkProject(tmp: string, name: string) {
  const proj = join(tmp, name);
  const d = join(proj, '.claude', 'skills', 'kt-checkout-debug');
  mkdirSync(d, { recursive: true });
  const file = join(d, 'SKILL.md');
  const write = (desc: string) =>
    writeFileSync(file, `---\nname: kt-checkout-debug\ndescription: ${desc}\n---\nbody\n`);
  write('Debug synthetic checkout failures');
  return { proj, write };
}

async function withEnv(fn: (tmp: string) => Promise<void>) {
  const tmp = mkdtempSync(join(tmpdir(), 'kit-life-'));
  const home = join(tmp, 'home');
  mkdirSync(home, { recursive: true });
  const e = { KITROUTE_HOME: join(tmp, 'data'), HOME: home, USERPROFILE: home };
  const saved = { ...process.env };
  Object.assign(process.env, e);
  try { await fn(tmp); } finally {
    for (const k of Object.keys(e)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    rmSync(tmp, { recursive: true, force: true });
  }
}
const run = (event: string, body: string) => handleHook('claude-code', event, body, undefined, 20000);

test('unchanged selection is deduped; project change, inventory change, compaction re-emit', async () => {
  await withEnv(async (tmp) => {
    const a = mkProject(tmp, 'projA');
    const b = mkProject(tmp, 'projB');
    const q = 'debug the checkout failure please';
    assert.match(await run(EV, prompt(a.proj, q)), /kt-checkout-debug/);
    assert.equal(await run(EV, prompt(a.proj, q)), '');
    // same session, different project
    assert.match(await run(EV, prompt(b.proj, q)), /kt-checkout-debug/);
    assert.equal(await run(EV, prompt(b.proj, q)), '');
    // inventory change
    await new Promise(r => setTimeout(r, 20));
    b.write('Debug synthetic checkout failures and crashes');
    assert.match(await run(EV, prompt(b.proj, q)), /kt-checkout-debug/);
    assert.equal(await run(EV, prompt(b.proj, q)), '');
    // compaction: guidance re-emitted via SessionStart, then identical prompt suppressed again
    const out = JSON.parse(await run('SessionStart', start(b.proj, 'compact')));
    assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.match(out.hookSpecificOutput.additionalContext, /kt-checkout-debug/);
    assert.equal(await run(EV, prompt(b.proj, q)), '');
  });
});

test('SessionStart stays silent without a saved task phase and never suppresses the next prompt', async () => {
  await withEnv(async (tmp) => {
    const a = mkProject(tmp, 'projA');
    assert.equal(await run('SessionStart', start(a.proj, 'startup')), '');
    assert.match(await run(EV, prompt(a.proj, 'debug the checkout failure')), /kt-checkout-debug/);
    assert.equal(await run('SessionStart', start(a.proj, 'resume', 's2')), '');
    // general-phase prompt (no keyword), then SessionStart
    assert.match(await run(EV, prompt(a.proj, 'checkout', 's3')), /kt-checkout-debug/);
    assert.equal(await run('SessionStart', start(a.proj, 'compact', 's3')), '');
    assert.match(await run(EV, prompt(a.proj, 'checkout', 's3')), /kt-checkout-debug/);
  });
});

test('no-match prompt keeps the previous phase and emits nothing', async () => {
  await withEnv(async (tmp) => {
    const a = mkProject(tmp, 'projA');
    assert.match(await run(EV, prompt(a.proj, 'debug the checkout failure')), /kt-checkout-debug/);
    assert.equal(await run(EV, prompt(a.proj, 'thanks')), '');
  });
});

test('session_state holds no prompt text', async () => {
  await withEnv(async (tmp) => {
    const a = mkProject(tmp, 'projA');
    const secret = 'SECRET-MARKER-77ab';
    await run(EV, prompt(a.proj, `debug checkout ${secret}`));
    const db = new DatabaseSync(join(tmp, 'data', 'kitroute.db'));
    const rows = db.prepare('SELECT * FROM session_state').all();
    db.close();
    assert.equal(rows.length, 1);
    assert.ok(!JSON.stringify(rows).includes(secret));
  });
});

test('retention prunes session_state older than 30 days', () => {
  const DAY = 86400000, now = 100 * DAY;
  const store = openStore(':memory:');
  const ins = store.db.prepare("INSERT INTO session_state VALUES ('codex', ?, 'p', 'r', 'general', 'sig', ?)");
  ins.run('old', now - 31 * DAY);
  ins.run('edge', now - 30 * DAY);
  assert.equal(pruneUsage(store, now), 0);
  assert.deepEqual(store.db.prepare('SELECT session_id FROM session_state').all().map(r => r.session_id), ['edge']);
  store.close();
});

test('SessionStart adapter shape', () => {
  for (const [adapter, host] of [[claudeCode, 'claude-code'], [codex, 'codex']] as const) {
    const i = adapter.normalize({ session_id: 's', cwd: '/c', source: 'compact', extra: 'x' }, 'SessionStart')!;
    assert.deepEqual(i, { host, event: 'SessionStart', cwd: '/c', sessionId: 's' });
    assert.equal(adapter.normalize({ cwd: '/c' }, 'SessionStart'), null);
    const res = { status: 'selected' as const, ids: ['a'], reasonCodes: [], guidance: 'G', elapsedMs: 0 };
    const out = adapter.render(res, 'SessionStart');
    assert.deepEqual(JSON.parse(out), { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'G' } });
    assert.equal(adapter.validateOutput(out, 'SessionStart'), out);
    const bad = JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'G', watchPaths: [] } });
    assert.equal(adapter.validateOutput(bad, 'SessionStart'), null);
    assert.equal(adapter.validateOutput(out.replace('SessionStart', 'UserPromptSubmit'), 'SessionStart'), null);
  }
});
