import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Adapter, Host, Phase, RouteRequest, RouteResult, RoutingPolicy } from './contracts.js';
import { claudeCode } from './adapters/claude-code.js';
import { applyCodexConfig, codex } from './adapters/codex.js';
import { skillRoots } from './discovery/skills.js';
import { dataDir, normalizeProject, projectScopeId } from './paths.js';
import { select } from './routing/select.js';

const POLICY: RoutingPolicy = { maxSelections: 3, minScore: 0.2, maxGuidanceChars: 2000 };
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

async function setup(host: Host, project: string) {
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
async function openDefaultStore() {
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

export async function runCli(argv: string[], input: string): Promise<string> {
  if (argv[0] === 'route') return route(argv.slice(1), input);
  if (argv[0] === 'index') return index(argv.slice(1));
  if (argv[0] !== 'doctor') throw new Error('UNKNOWN_COMMAND');
  let sqlite = false;
  try {
    await import('node:sqlite');
    sqlite = true;
  } catch {
    // sqlite stays false
  }
  return JSON.stringify({ command: 'doctor', runtime: process.version, sqlite });
}
