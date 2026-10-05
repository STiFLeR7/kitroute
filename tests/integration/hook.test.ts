import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { handleHook } from '../../src/hooks/handle.js';

const W = (n: string) => fileURLToPath(new URL(`../../../tests/fixtures/workers/${n}.mjs`, import.meta.url));
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const EV = 'UserPromptSubmit';
const payload = (cwd: string, prompt: string) =>
  JSON.stringify({ session_id: 's1', cwd, prompt, prompt_id: 'p1', hook_event_name: EV });

test('invalid host input does not block a request', async () => {
  assert.equal(await handleHook('codex', 'UserPromptSubmit', '{'), '');
});

test('fixture workers', async () => {
  assert.match(await handleHook('claude-code', EV, '{}', W('success')), /additionalContext/);
  assert.equal(await handleHook('claude-code', EV, '{}', W('crash')), '');
  assert.equal(await handleHook('claude-code', EV, '{}', W('invalid')), '');
  assert.equal(await handleHook('claude-code', EV, '{}', W('big-output')), '');
});

test('deadline expiry returns empty promptly', async () => {
  const t = Date.now();
  assert.equal(await handleHook('claude-code', EV, '{}', W('timeout'), 300), '');
  assert.ok(Date.now() - t < 2000);
});

test('oversized input returns empty without spawning', async () => {
  assert.equal(await handleHook('claude-code', EV, 'x'.repeat(1024 * 1024 + 1), W('success')), '');
});

function env() {
  const tmp = mkdtempSync(join(tmpdir(), 'kit-hook-'));
  const home = join(tmp, 'home');
  const proj = join(tmp, 'proj');
  const d = join(proj, '.claude', 'skills', 'kt-checkout-debug');
  mkdirSync(home, { recursive: true });
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'SKILL.md'),
    '---\nname: kt-checkout-debug\ndescription: Debug synthetic checkout failures\n---\nbody\n');
  const e = { KITROUTE_HOME: join(tmp, 'data'), HOME: home, USERPROFILE: home };
  return { tmp, proj, e };
}

test('routes through the real worker; secret never leaks; spaces in path', async () => {
  const t = env();
  const saved = { ...process.env };
  Object.assign(process.env, t.e);
  try {
    const out = await handleHook('claude-code', EV, payload(t.proj, 'debug the checkout failure please'), undefined, 20000);
    assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /kt-checkout-debug/);
    assert.equal(await handleHook('claude-code', EV, payload(t.proj, 'thanks, looks good'), undefined, 20000), '');

    const link = join(t.tmp, 'kit route link');
    symlinkSync(repo, link, process.platform === 'win32' ? 'junction' : 'dir');
    const secret = 'SECRET-MARKER-9f31c2';
    const r = spawnSync(process.execPath, [join(link, 'bin', 'kitroute.mjs'), 'hook', '--host', 'claude-code', '--event', EV],
      { env: process.env, input: payload(t.proj, `debug checkout ${secret}`), encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /kt-checkout-debug/);
    assert.ok(!r.stdout.includes(secret) && !r.stderr.includes(secret));
    assert.equal(r.stderr, '');
  } finally {
    for (const k of Object.keys(t.e)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    rmSync(t.tmp, { recursive: true, force: true });
  }
});

test('process-level hook with garbage stdin exits 0 silently', () => {
  for (const args of [['--host', 'claude-code', '--event', EV], ['--bogus']]) {
    const r = spawnSync(process.execPath, [join(repo, 'bin', 'kitroute.mjs'), 'hook', ...args],
      { input: '\u0000not json{', encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, '');
  }
});
