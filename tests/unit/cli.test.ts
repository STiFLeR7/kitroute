import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli.js';

const bin = fileURLToPath(new URL('../../../bin/kitroute.mjs', import.meta.url));

test('doctor returns bounded structured status', async () => {
  const raw = await runCli(['doctor'], '');
  const result = JSON.parse(raw);
  assert.equal(result.command, 'doctor');
  assert.equal(typeof result.runtime, 'string');
  assert.equal(typeof result.sqlite, 'boolean');
  assert.equal('environment' in result, false);
  assert.deepEqual(Object.keys(result).sort(), ['command', 'hosts', 'runtime', 'sqlite', 'trust']);
  assert.equal(result.hosts.length, 2);
  for (const h of result.hosts) {
    assert.deepEqual(Object.keys(h).sort(), ['host', 'note', 'present', 'supported', 'version']);
    assert.equal(typeof h.present, 'boolean');
  }
  assert.ok(Array.isArray(result.trust));
  if (result.hosts.some((h: { host: string; present: boolean }) => h.host === 'codex' && h.present)) assert.match(result.trust[0], /\/hooks/);
  else assert.deepEqual(result.trust, []);
  assert.ok(raw.length < 1000);
  assert.equal(/[\\/]/.test(raw.replace(/\/hooks/g, '')), false);
});

test('unknown command rejects with UNKNOWN_COMMAND', async () => {
  await assert.rejects(runCli(['nope'], ''), { message: 'UNKNOWN_COMMAND' });
  await assert.rejects(runCli([], ''), { message: 'UNKNOWN_COMMAND' });
});

test('malformed input is never echoed in errors', async () => {
  const secret = 'SECRET-PROMPT-{"broken":';
  for (const cmd of ['bogus', 'route']) {
    await assert.rejects(runCli([cmd], secret), (e: Error) => {
      assert.equal(e.message.includes('SECRET'), false);
      assert.equal(String(e.stack).includes('SECRET'), false);
      return true;
    });
  }
});

test('hook failures return empty instead of throwing', async () => {
  assert.equal(await runCli(['hook'], 'SECRET'), '');
});

test('process: doctor works from a cwd containing a space', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit route '));
  try {
    const r = spawnSync(process.execPath, [bin, 'doctor'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).command, 'doctor');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('process: unknown command exits 1 with generic stderr and empty stdout', () => {
  const r = spawnSync(process.execPath, [bin, 'nope'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(r.stderr, 'KITROUTE_COMMAND_FAILED\n');
  assert.equal(r.stdout, '');
});

test('process: doctor via piped stdin ignores input', () => {
  const r = spawnSync(process.execPath, [bin, 'doctor'], { input: 'x\n', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).command, 'doctor');
});
