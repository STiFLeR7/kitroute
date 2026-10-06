import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeProject, projectScopeId } from '../../src/paths.js';

test('normalizeProject normalizes a real directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit route '));
  try {
    const n = normalizeProject(dir);
    assert.equal(n.includes('\\'), false);
    assert.equal(n.endsWith('/'), false);
    assert.equal(normalizeProject(dir + (process.platform === 'win32' ? '\\' : '/')), n);
    if (process.platform === 'win32') {
      assert.equal(n, n.toLowerCase());
      assert.equal(normalizeProject(dir.toUpperCase()), n);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('normalizeProject resolves dot segments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kitroute-'));
  try {
    mkdirSync(join(dir, 'a'));
    assert.equal(normalizeProject(join(dir, 'a', '..', 'a')), normalizeProject(join(dir, 'a')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('normalizeProject throws fixed code without path echo', () => {
  const missing = join(tmpdir(), 'kitroute-missing-SECRETNAME');
  assert.throws(() => normalizeProject(missing), (e: Error) => {
    assert.equal(e.message, 'INVALID_PROJECT_ROOT');
    assert.equal(e.message.includes('SECRETNAME'), false);
    return true;
  });
});

test('projectScopeId is stable, profile-sensitive and unambiguous', () => {
  assert.equal(projectScopeId('/r', 'default'), projectScopeId('/r', 'default'));
  assert.match(projectScopeId('/r', 'default'), /^[0-9a-f]{64}$/);
  assert.notEqual(projectScopeId('/r', 'p1'), projectScopeId('/r', 'p2'));
  assert.notEqual(projectScopeId('ab', 'c'), projectScopeId('a', 'bc'));
});

test('dataDir honors KITROUTE_HOME', async () => {
  const { dataDir } = await import('../../src/paths.js');
  const old = process.env['KITROUTE_HOME'];
  process.env['KITROUTE_HOME'] = '/synthetic/data';
  try { assert.equal(dataDir(), '/synthetic/data'); }
  finally { if (old === undefined) delete process.env['KITROUTE_HOME']; else process.env['KITROUTE_HOME'] = old; }
});
