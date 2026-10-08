import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalizeProject, projectScopeId } from '../../src/paths.js';

const bin = fileURLToPath(new URL('../../../bin/kitroute.mjs', import.meta.url));
type H = 'claude-code' | 'codex';

function env(host: H = 'codex') {
  const tmp = mkdtempSync(join(tmpdir(), 'kit-route-'));
  const home = join(tmp, 'home');
  mkdirSync(home, { recursive: true });
  const e = { ...process.env, KITROUTE_HOME: join(tmp, 'data'), HOME: home, USERPROFILE: home };
  const skillRoot = (proj: string) => join(proj, host === 'codex' ? '.agents' : '.claude', 'skills');
  const project = (name: string, skills: Record<string, string>) => {
    const p = join(tmp, name);
    mkdirSync(p, { recursive: true });
    for (const [dir, desc] of Object.entries(skills)) {
      const d = join(skillRoot(p), dir.slice(0, 40).replace(/[^a-z0-9-]/gi, '_'));
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, 'SKILL.md'),
        `---\nname: ${JSON.stringify(dir)}\ndescription: ${JSON.stringify(desc)}\n---\nbody\n`);
    }
    return p;
  };
  const run = (args: string[], input = '') =>
    spawnSync(process.execPath, [bin, ...args], { env: e, input, encoding: 'utf8' });
  const route = (proj: string, text: string, extra: object = {}, h: H = host) =>
    run(['route', '--host', h, '--project', proj],
      JSON.stringify({ sessionId: 's', text, phase: 'general', ...extra }));
  const db = () => new DatabaseSync(join(tmp, 'data', 'kitroute.db'));
  return { tmp, home, project, run, route, db, done: () => rmSync(tmp, { recursive: true, force: true }) };
}

const lines = (g: string) => (g ? g.split('\n').map(l => JSON.parse(l)) : []);

test('unrelated prompt abstains', () => {
  const t = env();
  try {
    const p = t.project('proj', { checkout: 'Debug checkout errors' });
    const r = t.route(p, 'thanks, looks good');
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.status, 'abstain');
    assert.deepEqual(out.ids, []);
    assert.equal(out.guidance, '');
  } finally { t.done(); }
});

test('more than three matches yields exactly three', () => {
  const t = env('claude-code');
  try {
    const p = t.project('proj', Object.fromEntries(
      ['a', 'b', 'c', 'd', 'e'].map(n => [`skill-${n}`, 'Debug checkout errors'])));
    const out = JSON.parse(t.route(p, 'debug checkout errors').stdout);
    assert.equal(out.status, 'selected');
    assert.equal(out.ids.length, 3);
    assert.equal(lines(out.guidance).length, 3);
  } finally { t.done(); }
});

test('unusual name renders as valid JSON lines', () => {
  const t = env();
  try {
    const p = t.project('proj', { 'q"uote-é中': 'Debug checkout errors' });
    const out = JSON.parse(t.route(p, 'debug checkout').stdout);
    const l = lines(out.guidance);
    assert.equal(l.length, 1);
    assert.equal(l[0].capability, 'q"uote-é中');
  } finally { t.done(); }
});

test('long names keep guidance within cap, whole lines', () => {
  const t = env();
  try {
    // dir names are truncated by the helper; the frontmatter name stays long
    const skills: Record<string, string> = {};
    for (let i = 0; i < 3; i++) skills[`debug-${i}-${'n'.repeat(900)}`] = 'debug checkout ' + 'word '.repeat(3000);
    const p = t.project('proj', skills);
    const out = JSON.parse(t.route(p, 'debug checkout').stdout);
    assert.ok(out.guidance.length <= 2000);
    assert.equal(lines(out.guidance).length, out.ids.length);
    assert.ok(out.ids.length < 3);
  } finally { t.done(); }
});

test('another project target is never returned', () => {
  const t = env();
  try {
    const a = t.project('a', { alpha: 'Debug checkout' });
    const b = t.project('b', { beta: 'Debug checkout' });
    assert.equal(t.run(['index', '--host', 'codex', '--project', b]).status, 0);
    const out = JSON.parse(t.route(a, 'debug checkout').stdout);
    assert.equal(lines(out.guidance).map(l => l.capability).join(), 'alpha');
    assert.ok(!out.guidance.includes('beta'));
  } finally { t.done(); }
});

test('scope conflicts fail closed', () => {
  const t = env();
  try {
    const p = t.project('proj', { alpha: 'Debug checkout' });
    for (const extra of [{ host: 'claude-code' }, { projectId: 'other' }]) {
      const r = t.route(p, 'debug checkout', extra);
      assert.equal(r.status, 1);
      assert.equal(r.stderr, 'KITROUTE_COMMAND_FAILED\n');
      assert.equal(r.stdout, '');
    }
    const ok = t.route(p, 'debug checkout',
      { host: 'codex', projectId: projectScopeId(normalizeProject(p), 'default') });
    assert.equal(ok.status, 0);
  } finally { t.done(); }
});

test('malformed JSON fails without echo', () => {
  const t = env();
  try {
    const p = t.project('proj', { alpha: 'Debug checkout' });
    const r = t.run(['route', '--host', 'codex', '--project', p], 'SECRET-MARK {"bad":');
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, 'KITROUTE_COMMAND_FAILED\n');
  } finally { t.done(); }
});

test('second route reuses the index', () => {
  const t = env();
  try {
    const p = t.project('proj', { alpha: 'Debug checkout' });
    assert.equal(t.route(p, 'debug checkout').status, 0);
    const d = t.db();
    const before = d.prepare('SELECT revision FROM inventory_revisions').all();
    assert.equal(before.length, 1);
    d.exec(`UPDATE capabilities SET metadata_json = replace(metadata_json, '"alpha"', '"cached-marker"')`);
    d.close();
    const out = JSON.parse(t.route(p, 'debug checkout').stdout);
    assert.equal(lines(out.guidance)[0].capability, 'cached-marker');
    const d2 = t.db();
    assert.deepEqual(d2.prepare('SELECT revision FROM inventory_revisions').all(), before);
    d2.close();
  } finally { t.done(); }
});

test('codex skill disabled in config.toml is never selected', () => {
  const t = env();
  try {
    const p = t.project('proj', { alpha: 'Debug checkout', beta: 'Debug checkout' });
    mkdirSync(join(t.home, '.codex'), { recursive: true });
    const off = join(p, '.agents', 'skills', 'alpha', 'SKILL.md');
    writeFileSync(join(t.home, '.codex', 'config.toml'), `[[skills.config]]\npath = '${off}'\nenabled = false\n`);
    const out = JSON.parse(t.route(p, 'debug checkout').stdout);
    assert.deepEqual(lines(out.guidance).map(l => l.capability), ['beta']);
  } finally { t.done(); }
});

test('claude skill hidden by skillOverrides is never selected', () => {
  const t = env('claude-code');
  try {
    const p = t.project('proj', { alpha: 'Debug checkout', beta: 'Debug checkout', gamma: 'Debug checkout' });
    const names = () => lines(JSON.parse(t.route(p, 'debug checkout').stdout).guidance).map(l => l.capability).sort();
    const local = join(p, '.claude', 'settings.local.json');
    const user = join(t.home, '.claude', 'settings.json');
    mkdirSync(join(t.home, '.claude'), { recursive: true });
    assert.deepEqual(names(), ['alpha', 'beta', 'gamma']);
    // the /skills menu writes .claude/settings.local.json; name-only stays visible to the model
    writeFileSync(local, JSON.stringify({ skillOverrides: { alpha: 'off', beta: 'user-invocable-only', gamma: 'name-only' } }));
    assert.deepEqual(names(), ['gamma']);
    writeFileSync(local, JSON.stringify({ skillOverrides: { alpha: 'off' } }));
    writeFileSync(user, JSON.stringify({ skillOverrides: { gamma: 'off' } }));
    assert.deepEqual(names(), ['beta']);
    // project-local settings take precedence over user settings for the same skill
    writeFileSync(local, JSON.stringify({ skillOverrides: { gamma: 'on' } }));
    assert.deepEqual(names(), ['alpha', 'beta', 'gamma']);
    writeFileSync(local, '{');
    assert.deepEqual(names(), []);
  } finally { t.done(); }
});

test('index output has no paths; request text never leaks', () => {
  const t = env();
  try {
    const p = t.project('proj', { alpha: 'Debug checkout' });
    const idx = t.run(['index', '--host', 'codex', '--project', p]);
    assert.equal(idx.status, 0);
    assert.deepEqual(JSON.parse(idx.stdout), { command: 'index', host: 'codex', count: 1 });
    assert.ok(!/[\\/]/.test(idx.stdout));
    const r = t.route(p, 'debug checkout UNIQUE-SECRET-9f3a');
    assert.ok(!(r.stdout + r.stderr).includes('UNIQUE-SECRET-9f3a'));
    const bad = t.route(p, 'UNIQUE-SECRET-9f3a', { phase: 'nope' });
    assert.equal(bad.status, 1);
    assert.ok(!(bad.stdout + bad.stderr).includes('UNIQUE-SECRET-9f3a'));
  } finally { t.done(); }
});
