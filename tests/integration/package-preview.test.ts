import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const repoBin = join(root, 'bin', 'kitroute.mjs');
const userSettings = { theme: 'dark', hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'echo user-hook' }] }] } };

function synthHome() {
  const base = mkdtempSync(join(tmpdir(), 'kit-preview-'));
  const home = join(base, 'home');
  mkdirSync(join(home, '.claude'), { recursive: true });
  const settings = join(home, '.claude', 'settings.json');
  writeFileSync(settings, JSON.stringify(userSettings, null, 2));
  const env = { ...process.env, HOME: home, USERPROFILE: home, KITROUTE_HOME: join(base, 'data') };
  return { base, home, settings, data: join(base, 'data'), env };
}

const run = (bin: string, env: NodeJS.ProcessEnv, ...args: string[]) => {
  const r = spawnSync(process.execPath, [bin, ...args], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, `${args.join(' ')} failed: ${r.stderr}`);
  return JSON.parse(r.stdout);
};

function snapshot(dir: string, out: Record<string, string> = {}) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) snapshot(p, out);
    else out[p] = `${readFileSync(p, 'hex')}@${statSync(p).mtimeMs}`;
  }
  return out;
}

test('setup --dry-run changes no byte or mtime and writes no manifest', () => {
  const t = synthHome();
  try {
    const before = snapshot(t.base);
    const r = run(repoBin, t.env, 'setup', '--dry-run');
    assert.equal(r.dryRun, true);
    assert.deepEqual(snapshot(t.base), before);
    assert.equal(existsSync(join(t.data, 'setup-manifest.json')), false);
    assert.equal(existsSync(t.data), false);
  } finally { rmSync(t.base, { recursive: true, force: true }); }
});

test('npm pack contains only metadata, README, bin and compiled source', () => {
  const dest = mkdtempSync(join(tmpdir(), 'kit-pack-'));
  try {
    const r = spawnSync(`npm pack --json --pack-destination "${dest}"`, { cwd: root, shell: true, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const files: string[] = JSON.parse(r.stdout)[0].files.map((f: { path: string }) => f.path);
    assert.ok(files.includes('package.json') && files.includes('README.md') && files.includes('bin/kitroute.mjs'));
    assert.ok(files.includes('dist/src/cli.js'));
    const bad = files.filter(f => !(f === 'package.json' || f === 'README.md' || f === 'bin/kitroute.mjs' || f.startsWith('dist/src/')));
    assert.deepEqual(bad, []);
  } finally { rmSync(dest, { recursive: true, force: true }); }
});

test('installed tarball runs the full lifecycle against a synthetic home', { timeout: 180000 }, t => {
  const t0 = synthHome();
  const dest = mkdtempSync(join(tmpdir(), 'kit-pack-'));
  try {
    const p = spawnSync(`npm pack --json --pack-destination "${dest}"`, { cwd: root, shell: true, encoding: 'utf8' });
    assert.equal(p.status, 0, p.stderr);
    const tgz = join(dest, JSON.parse(p.stdout)[0].filename);
    const prefix = join(dest, 'prefix');
    mkdirSync(prefix);
    const i = spawnSync(`npm install --prefix "${prefix}" --prefer-offline --no-audit --no-fund "${tgz}"`, { shell: true, encoding: 'utf8' });
    if (i.status !== 0) {
      if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|network/i.test(i.stderr)) {
        t.skip('npm registry unreachable: cannot install yaml dependency');
        return;
      }
      assert.fail(`npm install failed: ${i.stderr}`);
    }
    const bin = join(prefix, 'node_modules', 'kitroute', 'bin', 'kitroute.mjs');
    const d = run(bin, t0.env, 'doctor');
    assert.equal(d.command, 'doctor');
    const dry = run(bin, t0.env, 'setup', '--dry-run');
    assert.equal(dry.dryRun, true);
    assert.equal(existsSync(t0.data), false);
    const s = run(bin, t0.env, 'setup');
    assert.deepEqual(s.plan.conflicts, []);
    const written = JSON.parse(readFileSync(t0.settings, 'utf8'));
    const cmds: string[] = Object.values<unknown[]>(written.hooks).flat()
      .flatMap(e => (e as { hooks: { command: string }[] }).hooks.map(h => h.command))
      .filter(c => c !== 'echo user-hook');
    assert.ok(cmds.length >= 4);
    const norm = (s: string) => s.split(String.fromCharCode(92)).join('/').toLowerCase();
    const installed = norm(realpathSync.native(bin));
    for (const c of cmds) assert.ok(norm(c).includes(installed), c);
    assert.ok(existsSync(join(t0.data, 'setup-manifest.json')));
    const ud = run(bin, t0.env, 'uninstall', '--dry-run');
    assert.equal(ud.dryRun, true);
    assert.deepEqual(JSON.parse(readFileSync(t0.settings, 'utf8')), written);
    run(bin, t0.env, 'uninstall');
    assert.deepEqual(JSON.parse(readFileSync(t0.settings, 'utf8')), userSettings);
    assert.equal(existsSync(join(t0.data, 'setup-manifest.json')), false);
  } finally {
    rmSync(t0.base, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});
