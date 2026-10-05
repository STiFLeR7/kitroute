import { POLICY, openDefaultStore, setup } from '../cli.js';
import { claudeCode } from '../adapters/claude-code.js';
import { codex } from '../adapters/codex.js';
import type { Host } from '../contracts.js';
import { normalizeProject, projectScopeId } from '../paths.js';
import { select } from '../routing/select.js';

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
    const { currentAvailability, ensureInventory, sourceRevision } = await import('../discovery/refresh.js');
    const cached = await ensureInventory(store, s.adapter, s.context, await sourceRevision(s.roots, s.configFiles));
    const result = select({
      host, projectId, sessionId: input.sessionId, text: input.text ?? '', phase: 'general',
      ...(input.turnId !== undefined ? { turnId: input.turnId } : {})
    }, currentAvailability(cached, undefined), POLICY);
    process.stdout.write(s.adapter.render(result, event));
  } finally {
    store?.close();
  }
}

main().catch(() => { process.exitCode = 1; });
