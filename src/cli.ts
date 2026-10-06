import { mkdir, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Adapter, Host, Patch, Phase, RouteRequest, RouteResult, RoutingPolicy } from './contracts.js';
import { claudeCode } from './adapters/claude-code.js';
import { applyCodexConfig, codex } from './adapters/codex.js';
import { skillRoots } from './discovery/skills.js';
import { dataDir, normalizeProject, projectScopeId } from './paths.js';
import { select } from './routing/select.js';

export const POLICY: RoutingPolicy = { maxSelections: 3, minScore: 0.2, maxGuidanceChars: 2000 };
const PHASES: Phase[] = ['general', 'reproduce', 'implement', 'verify'];
const FIXED = /^[A-Z_]+$/;

function parseFlags(args: string[]): { host: Host; project: string } {
  const f = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i], v = args[i + 1];
    if ((k !== '--host' && k !== '--project') || v === undefined || f.has(k)) throw new Error('INVALID_ARGUMENTS');
    f.set(k, v);
  }
  const host = f.get('--host'), project = f.get('--project');
  if ((host !== 'claude-code' && host !== 'codex') || !project) throw new Error('INVALID_ARGUMENTS');
  return { host, project };
}

function parseRequest(input: string, host: Host, projectId: string): RouteRequest {
  let v: unknown;
  try { v = JSON.parse(input); } catch { throw new Error('INVALID_REQUEST'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('INVALID_REQUEST');
  const o = v as Record<string, unknown>;
  if (typeof o['sessionId'] !== 'string' || typeof o['text'] !== 'string' ||
    !PHASES.includes(o['phase'] as Phase) ||
    (o['turnId'] !== undefined && typeof o['turnId'] !== 'string') ||
    (o['host'] !== undefined && typeof o['host'] !== 'string') ||
    (o['projectId'] !== undefined && typeof o['projectId'] !== 'string')) throw new Error('INVALID_REQUEST');
  if ((o['host'] !== undefined && o['host'] !== host) ||
    (o['projectId'] !== undefined && o['projectId'] !== projectId)) throw new Error('SCOPE_CONFLICT');
  return {
    host, projectId, sessionId: o['sessionId'], text: o['text'], phase: o['phase'] as Phase,
    ...(o['turnId'] !== undefined ? { turnId: o['turnId'] } : {})
  };
}

export async function setup(host: Host, project: string) {
  const root = normalizeProject(project);
  const projectId = projectScopeId(root, 'default'); // default profile is a recorded ruling
  const home = homedir();
  const roots = skillRoots(host, root, home);
  const configFiles = host === 'codex'
    ? [join(home, '.codex', 'config.toml')]
    : [join(home, '.claude', 'settings.json'), join(root, '.claude', 'settings.json')];
  const configText = host === 'codex' ? await readFile(configFiles[0]!, 'utf8').catch(() => null) : null;
  const adapter: Adapter = host === 'claude-code' ? claudeCode
    : { ...codex, discover: async ctx => applyCodexConfig(await codex.discover(ctx), configText) };
  return { root, projectId, roots, configFiles, adapter, context: { host, projectId, roots } };
}

// node:sqlite is imported lazily so unrelated commands stay free of its ExperimentalWarning.
export async function openDefaultStore() {
  const { openStore } = await import('./storage/database.js');
  const dir = dataDir();
  await mkdir(dir, { recursive: true });
  return openStore(join(dir, 'kitroute.db'));
}

async function route(args: string[], input: string): Promise<string> {
  const start = performance.now();
  const { host, project } = parseFlags(args);
  const s = await setup(host, project);
  const request = parseRequest(input, host, s.projectId);
  let store;
  try {
    store = await openDefaultStore();
    const { currentAvailability, ensureInventory, sourceRevision } = await import('./discovery/refresh.js');
    const revision = await sourceRevision(s.roots, s.configFiles);
    const cached = await ensureInventory(store, s.adapter, s.context, revision);
    // no current host tool evidence in the CLI path: cached tools become unknown
    return JSON.stringify(select(request, currentAvailability(cached, undefined), POLICY));
  } catch (e) {
    const code = e instanceof Error && FIXED.test(e.message) ? e.message : 'STORE_ERROR';
    const degraded: RouteResult = {
      status: 'degraded', ids: [], reasonCodes: [code], guidance: '',
      elapsedMs: Math.round(performance.now() - start)
    };
    return JSON.stringify(degraded);
  } finally {
    store?.close();
  }
}

async function index(args: string[]): Promise<string> {
  const { host, project } = parseFlags(args);
  const s = await setup(host, project);
  const store = await openDefaultStore();
  try {
    const { sourceRevision } = await import('./discovery/refresh.js');
    const { replaceInventory } = await import('./storage/inventory.js');
    const revision = await sourceRevision(s.roots, s.configFiles);
    const items = await s.adapter.discover(s.context);
    replaceInventory(store, s.context, items, revision);
    return JSON.stringify({ command: 'index', host, count: items.length });
  } finally {
    store.close();
  }
}

async function history(): Promise<string> {
  const store = await openDefaultStore();
  try {
    const { listUsage, pruneUsage } = await import('./history/records.js');
    pruneUsage(store, Date.now());
    return JSON.stringify({ command: 'history', records: listUsage(store) });
  } finally {
    store.close();
  }
}

const CODEX_NOTE = 'Codex requires reviewing new hooks with /hooks before they run; Kitroute does not bypass this.';
const CLAUDE_EVENTS: Array<[string, string?]> = [['UserPromptSubmit'], ['PostToolUse', 'Skill'], ['PostToolUseFailure', 'Skill'], ['SessionStart']];
// No Codex PostToolUse: nothing is recordable (no Codex tool inventory; skill loads are unobservable), so it would only spawn workers.
const CODEX_EVENTS: Array<[string, string?]> = [['UserPromptSubmit'], ['SessionStart']];
const text = (f: string) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };

export async function setupCommand(args: string[], platform: string = process.platform): Promise<string> {
  if (args.some(a => a !== '--dry-run')) throw new Error('INVALID_ARGUMENTS');
  const dryRun = args.length === 1;
  const [{ detectStatus }, { buildCommand, planSetup }, apply] = await Promise.all([
    import('./setup/detect.js'), import('./setup/plan.js'), import('./setup/apply.js')]);
  const home = homedir();
  const hosts = await detectStatus(home);
  const bin = fileURLToPath(new URL('../../bin/kitroute.mjs', import.meta.url));
  const entries: Patch[] = [], conflicts: string[] = [];
  for (const h of hosts.filter(s => s.present && s.supported)) {
    const file = join(home, h.host === 'codex' ? '.codex' : '.claude', h.host === 'codex' ? 'hooks.json' : 'settings.json');
    try {
      entries.push({
        file, beforeHash: '', add: (h.host === 'codex' ? CODEX_EVENTS : CLAUDE_EVENTS).map(([event, matcher]) => ({
          event, ownedId: `kitroute-${h.host}-${event}`,
          entry: { ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: buildCommand(process.execPath, bin, h.host, event, platform) }] }
        }))
      });
    } catch (e) { conflicts.push(`${file}: ${e instanceof Error ? e.message : 'ERROR'}`); }
  }
  const plan = planSetup(Object.fromEntries(entries.map(e => [e.file, text(e.file)])), entries, apply.toPatches(apply.readManifest()));
  plan.conflicts.push(...conflicts);
  if (!dryRun) apply.applySetup(plan, home);
  return JSON.stringify({ command: 'setup', dryRun, hosts, plan, trust: [CODEX_NOTE] });
}

async function uninstallCommand(args: string[]): Promise<string> {
  if (args.some(a => a !== '--dry-run')) throw new Error('INVALID_ARGUMENTS');
  const dryRun = args.length === 1;
  const [{ uninstall, sha256 }, apply] = await Promise.all([import('./setup/plan.js'), import('./setup/apply.js')]);
  const manifest = apply.readManifest();
  const patches = apply.toPatches(manifest);
  const before = Object.fromEntries(patches.map(p => [p.file, text(p.file)]));
  const result = uninstall(before, patches);
  const changed = patches.map(p => p.file).filter(f => result.files[f] !== before[f]);
  if (!dryRun && changed.length) {
    apply.commit(changed.map(f => ({ file: f, before: before[f]!, beforeHash: sha256(before[f]!), after: result.files[f]! })));
    const { isDeepStrictEqual } = await import('node:util');
    const stillThere = (m: { file: string; event: string; entry: unknown }) => {
      try {
        const hooks = (JSON.parse(text(m.file) || '{}') as { hooks?: Record<string, unknown[]> }).hooks ?? {};
        return (hooks[m.event] ?? []).some(e => isDeepStrictEqual(e, m.entry));
      } catch { return true; } // unreadable file: keep the ownership row
    };
    apply.writeManifest(manifest.filter(stillThere));
  }
  return JSON.stringify({ command: 'uninstall', dryRun, changed, conflicts: result.conflicts });
}

export async function runCli(argv: string[], input: string): Promise<string> {
  if (argv[0] === 'hook') {
    // a host must never be blocked: every hook-path failure is empty output
    try {
      const f = argv.slice(1);
      if (f.length !== 4 || f[0] !== '--host' || f[2] !== '--event' ||
        (f[1] !== 'claude-code' && f[1] !== 'codex')) return '';
      const { handleHook } = await import('./hooks/handle.js');
      return await handleHook(f[1], f[3]!, input);
    } catch { return ''; }
  }
  if (argv[0] === 'route') return route(argv.slice(1), input);
  if (argv[0] === 'index') return index(argv.slice(1));
  if (argv[0] === 'history') return history();
  if (argv[0] === 'setup') return setupCommand(argv.slice(1));
  if (argv[0] === 'uninstall') return uninstallCommand(argv.slice(1));
  if (argv[0] !== 'doctor') throw new Error('UNKNOWN_COMMAND');
  let sqlite = false;
  try {
    await import('node:sqlite');
    sqlite = true;
  } catch {
    // sqlite stays false
  }
  const { detectStatus } = await import('./setup/detect.js');
  const status = await detectStatus(homedir());
  const hosts = status.map(({ host, present, version, supported, note }) => ({ host, present, version, supported, note }));
  const trust = status.some(s => s.host === 'codex' && s.present) ? [CODEX_NOTE] : [];
  return JSON.stringify({ command: 'doctor', runtime: process.version, sqlite, hosts, trust });
}
