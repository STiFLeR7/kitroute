import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Patch } from '../../src/contracts.js';
import { detectHosts, detectStatus } from '../../src/setup/detect.js';
import { buildCommand, planSetup, uninstall } from '../../src/setup/plan.js';
import { applySetup, readManifest, toPatches } from '../../src/setup/apply.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const tmp = mkdtempSync(join(tmpdir(), 'kit-setup-'));
const data = join(tmp, 'data');
// never touch the real home or data dir
process.env['HOME'] = process.env['USERPROFILE'] = join(tmp, 'home');
process.env['KITROUTE_HOME'] = data;
const bin = fileURLToPath(new URL('../../../bin/kitroute.mjs', import.meta.url));
const fixture = (n: string) => readFileSync(fileURLToPath(new URL(`../../../tests/fixtures/configuration/${n}`, import.meta.url)), 'utf8');
let n = 0;
const dir = () => { const d = join(tmp, `t${n++}`); mkdirSync(d, { recursive: true }); return d; };
const owned = (file: string, cmd = 'node k.mjs hook --event UserPromptSubmit'): Patch =>
  ({ file, beforeHash: '', add: [{ event: 'UserPromptSubmit', entry: { hooks: [{ type: 'command', command: cmd }] }, ownedId: 'id1' }] });

test('uninstall removes the exact owned entry and keeps later user edits', () => {
  const unrelatedEntry = { hooks: [{ type: 'command', command: 'echo user-hook' }] };
  const ownedEntry = { hooks: [{ type: 'command', command: 'node synthetic-kitroute.mjs hook' }] };
  const initial = { hooks: { UserPromptSubmit: [unrelatedEntry, ownedEntry] }, theme: 'dark' };
  const later = { ...initial, theme: 'light' };
  const ownedPatch: Patch = {
    file: 'hooks.json',
    beforeHash: createHash('sha256').update(JSON.stringify(initial)).digest('hex'),
    add: [{ event: 'UserPromptSubmit', entry: ownedEntry, ownedId: 'owned-hook-id' }]
  };
  const result = uninstall({ 'hooks.json': JSON.stringify(later) }, [ownedPatch]);
  const remaining = JSON.parse(result.files['hooks.json']!);
  assert.deepEqual(result.conflicts, []);
  assert.equal(remaining.theme, 'light');
  assert.deepEqual(remaining.hooks.UserPromptSubmit, [unrelatedEntry]);
});

test('edited owned entry is a conflict and left intact; emptied arrays are removed', () => {
  const p = owned('h.json');
  const edited = { hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node k.mjs hook --event UserPromptSubmit', timeout: 5 }] }] } };
  const r = uninstall({ 'h.json': JSON.stringify(edited) }, [p]);
  assert.match(r.conflicts[0]!, /ENTRY_MODIFIED/);
  assert.deepEqual(JSON.parse(r.files['h.json']!), edited);
  const only = { hooks: { UserPromptSubmit: [p.add[0]!.entry] } };
  const r2 = uninstall({ 'h.json': JSON.stringify(only) }, [p]);
  assert.deepEqual(JSON.parse(r2.files['h.json']!).hooks, {});
});

test('planSetup: hashes, idempotence, malformed and conflicting configuration', () => {
  const p = owned('a.json');
  const plan = planSetup({ 'a.json': '' }, [p]);
  assert.equal(plan.patches[0]!.beforeHash, sha(''));
  assert.deepEqual(plan.patches[0]!.add, p.add);
  const done = JSON.stringify({ hooks: { UserPromptSubmit: [p.add[0]!.entry] } });
  assert.deepEqual(planSetup({ 'a.json': done }, [p]).patches, []);
  const bad = planSetup({ 'a.json': '{nope' }, [p]);
  assert.deepEqual(bad.patches, []);
  assert.match(bad.conflicts[0]!, /MALFORMED_JSON/);
  assert.match(planSetup({ 'a.json': '[]' }, [p]).conflicts[0]!, /NOT_OBJECT/);
  assert.match(planSetup({ 'a.json': '{"hooks":[]}' }, [p]).conflicts[0]!, /HOOKS_NOT_OBJECT/);
  assert.match(planSetup({ 'a.json': '{"hooks":{"UserPromptSubmit":{}}}' }, [p]).conflicts[0]!, /HOOK_EVENT_NOT_ARRAY/);
});

test('applySetup: backup, manifest, idempotent, user keys kept', () => {
  const d = dir(), f = join(d, 'settings.json');
  writeFileSync(f, JSON.stringify({ theme: 'dark' }));
  const plan = planSetup({ [f]: readFileSync(f, 'utf8') }, [owned(f)]);
  applySetup(plan, d);
  const after = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(after.theme, 'dark');
  assert.equal(after.hooks.UserPromptSubmit.length, 1);
  const manifest = JSON.parse(readFileSync(join(data, 'setup-manifest.json'), 'utf8'));
  assert.equal(manifest.entries[0].ownedId, 'id1');
  assert.ok(existsSync(join(data, 'backups')));
  const again = planSetup({ [f]: readFileSync(f, 'utf8') }, [owned(f)]);
  assert.deepEqual(again.patches, []);
  applySetup(again, d);
  assert.equal(JSON.parse(readFileSync(f, 'utf8')).hooks.UserPromptSubmit.length, 1);
});

test('applySetup aborts with HASH_CHANGED before writing anything', () => {
  const d = dir(), a = join(d, 'a.json'), b = join(d, 'b.json');
  writeFileSync(a, '{}'); writeFileSync(b, '{}');
  const plan = planSetup({ [a]: '{}', [b]: '{}' }, [owned(a), owned(b)]);
  writeFileSync(b, '{"theme":"x"}');
  assert.throws(() => applySetup(plan, d), /HASH_CHANGED/);
  assert.equal(readFileSync(a, 'utf8'), '{}');
  assert.equal(readFileSync(b, 'utf8'), '{"theme":"x"}');
});

test('partial failure restores only files this transaction replaced', () => {
  const d = dir(), a = join(d, 'a.json'), b = join(d, 'b.json'), c = join(d, 'c.json');
  writeFileSync(a, '{"k":1}'); writeFileSync(c, '{"k":3}');
  const plan = planSetup({ [a]: '{"k":1}', [b]: '', [c]: '{"k":3}' }, [owned(a), owned(b), owned(c)]);
  let calls = 0;
  const rename = (from: string, to: string) => {
    if (++calls === 2) throw new Error('boom');
    renameSync(from, to);
  };
  assert.throws(() => applySetup(plan, d, { rename }), /boom/);
  assert.equal(readFileSync(a, 'utf8'), '{"k":1}');
  assert.equal(existsSync(b), false);
  assert.equal(readFileSync(c, 'utf8'), '{"k":3}');
});

test('user edits after install survive uninstall; Codex-format fixture', () => {
  const d = dir(), f = join(d, 'hooks.json');
  const text = fixture('codex-hooks.json');
  writeFileSync(f, text);
  const p = owned(f);
  applySetup(planSetup({ [f]: text }, [p]), d);
  const edited = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(edited.description, 'synthetic Codex hooks fixture');
  edited.theme = 'light';
  edited.hooks.Stop = [{ hooks: [{ type: 'command', command: 'echo mine' }] }];
  const r = uninstall({ [f]: JSON.stringify(edited) }, [p]);
  const out = JSON.parse(r.files[f]!);
  assert.deepEqual(r.conflicts, []);
  assert.equal(out.theme, 'light');
  assert.equal(out.hooks.Stop.length, 1);
  assert.equal(out.hooks.UserPromptSubmit.length, 1);
  assert.equal(out.hooks.PostToolUse[0].matcher, '^Bash$');
});

test('buildCommand quotes paths with spaces and refuses shell metacharacters', () => {
  const c = buildCommand('C:\\Program Files\\node\\node.exe', 'D:\\my kit\\bin\\kitroute.mjs', 'codex', 'PostToolUse');
  assert.equal(c, '"C:/Program Files/node/node.exe" "D:/my kit/bin/kitroute.mjs" hook --host codex --event PostToolUse');
  for (const ch of ['"', '$', '`', '%', '!', '\n']) {
    assert.throws(() => buildCommand(`/a${ch}b/node`, '/k/bin.mjs', 'codex', 'X'), /UNSUPPORTED_PATH_CHARACTERS/);
    assert.throws(() => buildCommand('/n', `/k${ch}/bin.mjs`, 'codex', 'X'), /UNSUPPORTED_PATH_CHARACTERS/);
  }
});

test('detection: neither, each alone, both, unsupported, unknown version', async () => {
  const home = dir();
  const ok = async (h: string) => (h === 'claude-code' ? 'claude 2.1.289 (x)' : 'codex-cli 0.157.1');
  assert.deepEqual(await detectHosts(home, ok), []);
  mkdirSync(join(home, '.claude'));
  assert.deepEqual(await detectHosts(home, ok), ['claude-code']);
  rmSync(join(home, '.claude'), { recursive: true, force: true });
  mkdirSync(join(home, '.codex'));
  assert.deepEqual(await detectHosts(home, ok), ['codex']);
  mkdirSync(join(home, '.claude'));
  assert.deepEqual(await detectHosts(home, ok), ['claude-code', 'codex']);
  const old = async (h: string) => (h === 'claude-code' ? '2.1.288' : '0.157.1');
  assert.deepEqual(await detectHosts(home, old), ['codex']);
  const st = await detectStatus(home, old);
  const cl = st.find(s => s.host === 'claude-code')!;
  assert.equal(cl.present, true);
  assert.equal(cl.supported, false);
  assert.match(cl.note, /unsupported|below/i);
  const none = await detectStatus(home, async () => null);
  assert.equal(none[0]!.version, null);
});

function cli(home: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [bin, ...args], {
    encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home, KITROUTE_HOME: join(home, '..', 'kdata') }
  });
  return { code: r.status, out: r.stdout ? JSON.parse(r.stdout) : null, err: r.stderr };
}

test('CLI: no host means no changes; dry-run is immutable; setup and uninstall round trip', () => {
  const root = dir(), home = join(root, 'home');
  mkdirSync(home);
  const none = cli(home, 'setup', '--dry-run');
  assert.equal(none.code, 0);
  assert.equal(none.out.plan.patches.length, 0);
  assert.equal(cli(home, 'setup').code, 0);
  assert.equal(existsSync(join(root, 'kdata', 'setup-manifest.json')), false);

  mkdirSync(join(home, '.claude')); mkdirSync(join(home, '.codex'));
  const cf = join(home, '.claude', 'settings.json');
  writeFileSync(cf, '{"theme":"dark"}');
  const before = statSync(cf).mtimeMs;
  const dry = cli(home, 'setup', '--dry-run');
  assert.equal(dry.out.dryRun, true);
  assert.equal(dry.out.command, 'setup');
  assert.ok(dry.out.trust.some((t: string) => t.includes('/hooks')));
  assert.equal(readFileSync(cf, 'utf8'), '{"theme":"dark"}');
  assert.equal(statSync(cf).mtimeMs, before);
  assert.equal(existsSync(join(home, '.codex', 'hooks.json')), false);
  assert.equal(existsSync(join(root, 'kdata', 'setup-manifest.json')), false);

  const run = cli(home, 'setup');
  assert.equal(run.code, 0);
  const claude = JSON.parse(readFileSync(cf, 'utf8'));
  assert.equal(claude.theme, 'dark');
  assert.deepEqual(Object.keys(claude.hooks).sort(), ['PostToolUse', 'PostToolUseFailure', 'SessionStart', 'UserPromptSubmit']);
  assert.equal(claude.hooks.PostToolUse[0].matcher, 'Skill');
  const codex = JSON.parse(readFileSync(join(home, '.codex', 'hooks.json'), 'utf8'));
  assert.deepEqual(Object.keys(codex.hooks).sort(), ['PostToolUse', 'SessionStart', 'UserPromptSubmit']);
  assert.equal(cli(home, 'setup').out.plan.patches.length, 0);

  claude.theme = 'light';
  writeFileSync(cf, JSON.stringify(claude));
  const udry = cli(home, 'uninstall', '--dry-run');
  assert.equal(udry.out.dryRun, true);
  assert.equal(JSON.parse(readFileSync(cf, 'utf8')).hooks.UserPromptSubmit.length, 1);
  const un = cli(home, 'uninstall');
  assert.equal(un.code, 0);
  assert.deepEqual(un.out.conflicts, []);
  const left = JSON.parse(readFileSync(cf, 'utf8'));
  assert.equal(left.theme, 'light');
  assert.deepEqual(left.hooks, {});
});

test('repeated setup with a changed command replaces the stale owned entry', () => {
  const d = dir(), f = join(d, 'settings.json');
  const user = { hooks: [{ type: 'command', command: 'echo user' }] };
  writeFileSync(f, JSON.stringify({ hooks: { UserPromptSubmit: [user] } }));
  const run = (cmd: string) => {
    const p = owned(f, cmd);
    const plan = planSetup({ [f]: readFileSync(f, 'utf8') }, [p], toPatches(readManifest()));
    applySetup(plan, d);
    return plan;
  };
  run('node A.mjs hook');
  const plan = run('node B.mjs hook');
  assert.equal(plan.patches[0]!.remove!.length, 1);
  const arr = JSON.parse(readFileSync(f, 'utf8')).hooks.UserPromptSubmit;
  assert.equal(arr.length, 2);
  assert.deepEqual(arr[0], user);
  assert.equal(arr[1].hooks[0].command, 'node B.mjs hook');
  const m = readManifest().filter(x => x.file === f);
  assert.equal(m.length, 1);
  assert.equal(m[0]!.entry['hooks'] && (m[0]!.entry['hooks'] as Array<{ command: string }>)[0]!.command, 'node B.mjs hook');
  const r = uninstall({ [f]: readFileSync(f, 'utf8') }, toPatches(m));
  assert.deepEqual(JSON.parse(r.files[f]!).hooks.UserPromptSubmit, [user]);
  assert.deepEqual(r.conflicts, []);
  // an edited stale entry stays and is reported
  writeFileSync(f, JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node B.mjs hook', timeout: 1 }] }] } }));
  const edited = planSetup({ [f]: readFileSync(f, 'utf8') }, [owned(f, 'node C.mjs hook')], toPatches(m));
  assert.match(edited.conflicts[0]!, /ENTRY_MODIFIED/);
  assert.equal(edited.patches[0]!.remove, undefined);
});
