import { POLICY, openDefaultStore, setup } from '../cli.js';
import { claudeCode } from '../adapters/claude-code.js';
import { codex } from '../adapters/codex.js';
import type { Host } from '../contracts.js';
import { normalizeProject, projectScopeId } from '../paths.js';
import { appendUsage, pruneUsage, recordObservation } from '../history/records.js';
import { advanceState, continuationText, phaseFromInput } from '../lifecycle/state.js';
import type { Phase, SessionState, Store } from '../contracts.js';
import { select } from '../routing/select.js';
import { emitThenCommit, readAll, writeStdout } from './emit.js';

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
  const raw = await readAll(process.stdin);
  const input = (host === 'codex' ? codex : claudeCode).normalize(JSON.parse(raw), event);
  if (!input) return;
  const s = await setup(host, input.cwd);
  const projectId = projectScopeId(normalizeProject(input.cwd), 'default');
  let store: Store | undefined;
  try {
    const st: Store = store = await openDefaultStore();
    try { pruneUsage(st, Date.now()); } catch { /* history must not affect routing */ }
    const { currentAvailability, ensureInventory, sourceRevision } = await import('../discovery/refresh.js');
    const revision = await sourceRevision(s.roots, s.configFiles);
    const cached = await ensureInventory(st, s.adapter, s.context, revision);
    const adapter = s.adapter;
    const scoped = { ...input, projectId, inventoryRevision: revision };
    if (event === 'SessionStart') {
      // Only resume/compact may have lost context. clear/startup (and unknown sources) drop state and stay silent.
      // Otherwise reroute only from a saved task phase.
      let saved: { project_id: string; phase: string } | undefined;
      const reroute = input.sessionSource === 'resume' || input.sessionSource === 'compact';
      try {
        if (reroute) saved = st.db.prepare('SELECT project_id, phase FROM session_state WHERE host = ? AND session_id = ?')
          .get(host, input.sessionId) as typeof saved;
        const phase = saved?.project_id === projectId ? PHASES.find(p => p === saved!.phase) : undefined;
        if (!phase || phase === 'general') {
          st.db.prepare('DELETE FROM session_state WHERE host = ? AND session_id = ?').run(host, input.sessionId);
          return;
        }
      } catch { return; }
      const phase = PHASES.find(p => p === saved!.phase)!;
      const result = select({ host, projectId, sessionId: input.sessionId, text: continuationText(phase), phase },
        currentAvailability(cached, undefined), POLICY);
      await emitThenCommit(adapter.render(result, event), writeStdout,
        () => saveState(st, host, input.sessionId, projectId, revision, advanceState({ phase, signature: '' }, scoped, result.ids)));
      return;
    }
    if (event !== 'UserPromptSubmit') {
      const obs = adapter.observe({ ...input, projectId }, cached);
      const item = obs && cached.find(c => c.id === obs.capabilityId);
      try { if (obs && item) recordObservation(st, { ...input, projectId }, obs, item.name, Date.now()); } catch { /* ignore */ }
      return;
    }
    const previous = loadState(st, host, input.sessionId, projectId, revision);
    const result = select({
      host, projectId, sessionId: input.sessionId, text: input.text ?? '', phase: phaseFromInput(input) ?? previous.phase,
      ...(input.turnId !== undefined ? { turnId: input.turnId } : {})
    }, currentAvailability(cached, undefined), POLICY);
    const next = advanceState(previous, scoped, result.ids);
    const silent = result.status === 'selected' && next.signature === previous.signature; // unchanged: no repeat guidance
    await emitThenCommit(silent ? '' : s.adapter.render(result, event), writeStdout, () => {
      saveState(st, host, input.sessionId, projectId, revision, next);
      if (silent) return;
      for (const id of result.ids) {
        const item = cached.find(c => c.id === id);
        if (!item) continue;
        try {
          appendUsage(st, { host, projectId, sessionId: input.sessionId, capabilityId: id, capabilityName: item.name,
            event: 'selection', result: 'unknown', elapsedMs: result.elapsedMs, atMs: Date.now() });
        } catch { /* ignore */ }
      }
    });
  } finally {
    store?.close();
  }
}

main().catch(() => { process.exitCode = 1; });
