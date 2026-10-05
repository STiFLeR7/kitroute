import { POLICY, openDefaultStore, setup } from '../cli.js';
import { claudeCode } from '../adapters/claude-code.js';
import { codex } from '../adapters/codex.js';
import type { Host } from '../contracts.js';
import { normalizeProject, projectScopeId } from '../paths.js';
import { appendUsage, pruneUsage, recordObservation } from '../history/records.js';
import { advanceState, continuationText, phaseFromInput } from '../lifecycle/state.js';
import type { Phase, SessionState, Store } from '../contracts.js';
import { select } from '../routing/select.js';

const PHASES: Phase[] = ['general', 'reproduce', 'implement', 'verify'];

function loadState(store: Store, host: Host, sessionId: string, projectId: string, revision: string): SessionState {
  try {
    const r = store.db.prepare('SELECT project_id, inventory_revision, phase, signature FROM session_state WHERE host = ? AND session_id = ?')
      .get(host, sessionId) as { project_id: string; inventory_revision: string; phase: string; signature: string } | undefined;
    if (r && r.project_id === projectId && r.inventory_revision === revision && PHASES.includes(r.phase as Phase))
      return { phase: r.phase as Phase, signature: r.signature };
  } catch { /* state must not affect routing */ }
  return { phase: 'general', signature: '' };
}

function saveState(store: Store, host: Host, sessionId: string, projectId: string, revision: string, st: SessionState): void {
  try {
    store.db.prepare('INSERT OR REPLACE INTO session_state (host, session_id, project_id, inventory_revision, phase, signature, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(host, sessionId, projectId, revision, st.phase, st.signature, Date.now());
  } catch { /* ignore */ }
}

async function main(): Promise<void> {
  const host = process.argv[2] as Host, event = process.argv[3] ?? '';
  if (host !== 'claude-code' && host !== 'codex') throw new Error('INVALID_HOST');
  let raw = '';
  for await (const c of process.stdin) raw += c;
  const input = (host === 'codex' ? codex : claudeCode).normalize(JSON.parse(raw), event);
  if (!input) return;
  const s = await setup(host, input.cwd);
  const projectId = projectScopeId(normalizeProject(input.cwd), 'default');
  let store;
  try {
    store = await openDefaultStore();
    try { pruneUsage(store, Date.now()); } catch { /* history must not affect routing */ }
    const { currentAvailability, ensureInventory, sourceRevision } = await import('../discovery/refresh.js');
    const revision = await sourceRevision(s.roots, s.configFiles);
    const cached = await ensureInventory(store, s.adapter, s.context, revision);
    const adapter = s.adapter;
    const scoped = { ...input, projectId, inventoryRevision: revision };
    if (event === 'SessionStart') {
      // Old context may be gone after resume/compaction: reroute from the saved phase and re-emit.
      const phase = loadState(store, host, input.sessionId, projectId, revision).phase;
      try { store.db.prepare('DELETE FROM session_state WHERE host = ? AND session_id = ?').run(host, input.sessionId); } catch { /* ignore */ }
      const result = select({ host, projectId, sessionId: input.sessionId, text: continuationText(phase), phase },
        currentAvailability(cached, undefined), POLICY);
      saveState(store, host, input.sessionId, projectId, revision, advanceState({ phase, signature: '' }, scoped, result.ids));
      process.stdout.write(adapter.render(result, event));
      return;
    }
    if (event !== 'UserPromptSubmit') {
      const obs = adapter.observe({ ...input, projectId }, cached);
      const item = obs && cached.find(c => c.id === obs.capabilityId);
      try { if (obs && item) recordObservation(store, { ...input, projectId }, obs, item.name, Date.now()); } catch { /* ignore */ }
      return;
    }
    const previous = loadState(store, host, input.sessionId, projectId, revision);
    const result = select({
      host, projectId, sessionId: input.sessionId, text: input.text ?? '', phase: phaseFromInput(input) ?? previous.phase,
      ...(input.turnId !== undefined ? { turnId: input.turnId } : {})
    }, currentAvailability(cached, undefined), POLICY);
    const next = advanceState(previous, scoped, result.ids);
    saveState(store, host, input.sessionId, projectId, revision, next);
    if (result.status === 'selected' && next.signature === previous.signature) return; // unchanged: no repeat guidance
    for (const id of result.ids) {
      const item = cached.find(c => c.id === id);
      if (!item) continue;
      try {
        appendUsage(store, { host, projectId, sessionId: input.sessionId, capabilityId: id, capabilityName: item.name,
          event: 'selection', result: 'unknown', elapsedMs: result.elapsedMs, atMs: Date.now() });
      } catch { /* ignore */ }
    }
    process.stdout.write(s.adapter.render(result, event));
  } finally {
    store?.close();
  }
}

main().catch(() => { process.exitCode = 1; });
