# Adapters and Evidence Implementation Plan

> For agentic workers: Use superpowers:executing-plans, or superpowers:subagent-driven-development when the user chooses delegation. Complete task tests before advancing.

Goal: Route ordinary host prompts automatically and report only observed capability use.

Architecture: A small hook parent isolates routing in a worker process. Adapters render supported host responses. An allowlisted history layer stores basic events.

Tech Stack: TypeScript, Node child processes, SQLite, and Node tests.

Spec: [Contracts](../14_module_map_contracts.md), [adapter ADR](../adrs/23_adr_003_host_adapters.md), and [history ADR](../adrs/25_adr_005_history_privacy.md).

## Execution status

Windows 11 with Node v24.11.0 only. Codex live entry was deferred by the user. Fedora has not been run.

| Task | State | Commits |
| --- | --- | --- |
| P03.T1 | Implemented and reviewed. The live Claude Code hook passes on Windows. | 861a199, b7469d7 |
| P03.T2 | Implemented and reviewed | bc4a5a2 |
| P03.T3 | Implemented and reviewed. AdapterInput gains an optional eventId. The history command and worker records were added here by ruling. | f16aa01, 59fc703 |

Evidence: [31](../evidence/31_p03_hook_smoke.md), [32](../evidence/32_p03_observation_history.md). M3 is not complete.

## Global constraints

Hook failure returns control to the host. Native trust and consent remain intact. Save basic records for 30 days without user prompts or project code. Unknown observation stays unknown.

## Review focus

A hung worker must not stall the host indefinitely. A suggested skill must not count as loaded. Secrets in input and tool errors must not enter saved records.

## Task P03.T1: Bounded automatic hook execution

Files: create src/hooks/handle.ts, src/hooks/worker.ts, tests/integration/hook.test.ts, and tests/fixtures/workers/{success,timeout,crash}.mjs; modify src/cli.ts and the two adapters.

Interfaces: export handleHook(host: Host, event: string, input: string): Promise<string> and runWorker from the contracts map. A hook failure returns empty output and exit code zero. Ordinary CLI errors remain errors.

- [ ] Write process tests for normal routing, invalid JSON, worker crash, oversized input/output, and deadline expiry. Use fixture workers, not timing-sensitive model calls:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleHook } from '../../src/hooks/handle.js';

test('invalid host input does not block a request', async () => {
  assert.equal(await handleHook('codex', 'UserPromptSubmit', '{'), '');
});
```

- [ ] Run npm run build, then node --test dist/tests/integration/hook.test.js. Observe failure before implementing the handler.
- [ ] Bound hook input at 1 MiB and use a 2,500 ms outer worker deadline as initial engineering limits. Make the worker filename injectable in process tests.
- [ ] Implement the watchdog with one settlement path:

```typescript
import { spawn } from 'node:child_process';
import type { Host } from '../contracts.js';

export function runWorker(
  workerPath: string, host: Host, event: string, input: string,
  validateOutput: (raw: string) => string | null, deadlineMs = 2500
): Promise<string> {
  if (Buffer.byteLength(input) > 1024 * 1024) return Promise.resolve('');
  return new Promise(resolve => {
    const child = spawn(process.execPath, [workerPath, host, event], {
      stdio: ['pipe', 'pipe', 'pipe'], shell: false
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const finish = (output: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(output);
    };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(''); }, deadlineMs);
    child.stderr.resume();
    child.stdin.on('error', () => { child.kill('SIGKILL'); finish(''); });
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 65536) { child.kill('SIGKILL'); finish(''); return; }
      if (!settled) chunks.push(chunk);
    });
    child.once('error', () => finish(''));
    child.once('close', code => {
      if (code !== 0) { finish(''); return; }
      try { finish(validateOutput(Buffer.concat(chunks).toString('utf8')) ?? ''); }
      catch { finish(''); }
    });
    child.stdin.end(input);
  });
}
```

handleHook chooses the compiled worker path and passes Adapter.validateOutput bound to the host event. Test that invalid output produces no context. Do not retain stderr payloads.

- [ ] In the worker, normalize input and establish the active root/profile. Call ensureInventory, then currentAvailability before select. Emit nothing on abstention or failure.
- [ ] Obtain fresh tool metadata only through supported current host interfaces. Test routing without such an interface and keep cached tools unknown.
- [ ] Prove that compiled hook commands work from paths containing spaces on Windows and Fedora. Do not add network package downloads to the prompt path.
- [ ] Run process tests and live ordinary-request smoke tests. Commit with feat: route host prompts through bounded workers.

## Task P03.T2: Basic history and retention

Files: create src/history/records.ts, tests/unit/history.test.ts, and tests/integration/retention.test.ts; modify src/storage/database.ts and src/cli.ts.

Interfaces: implement toUsageRecord, appendUsage, and pruneUsage from the contracts document. Export observedUse(event: Observation): boolean for the report classifier.

- [ ] Write tests containing unique markers in prompt, project code, raw tool arguments, and error text. Confirm they are absent from every stored record and diagnostic.

```typescript
import assert from 'node:assert/strict';
import { toUsageRecord } from '../../src/history/records.js';

const raw = {
  host: 'codex', projectId: 'p', sessionId: 's', capabilityId: 'c',
  capabilityName: 'test', event: 'selection', result: 'unknown',
  elapsedMs: 3, atMs: 1000,
  prompt: 'UNIQUE_SECRET_MARKER', projectCode: 'UNIQUE_CODE_MARKER'
};
const saved = JSON.stringify(toUsageRecord(raw));
assert.equal(saved.includes('UNIQUE_SECRET_MARKER'), false);
assert.equal(saved.includes('UNIQUE_CODE_MARKER'), false);
```

- [ ] Run the history test before implementing the allowlist. Reject invalid host, event, result, name, and non-finite timing fields with a fixed error code.
- [ ] Build the returned record by selecting named fields. Never spread the incoming object:

```typescript
import type { UsageRecord } from '../contracts.js';

export function toUsageRecord(value: unknown): UsageRecord {
  const invalid = () => new Error('INVALID_USAGE_RECORD');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const row = value as Record<string, unknown>;
  for (const field of ['projectId', 'sessionId', 'capabilityId', 'capabilityName']) {
    if (typeof row[field] !== 'string' || !row[field].trim()) throw invalid();
  }
  if (!['claude-code', 'codex'].includes(row.host as string)) throw invalid();
  if (!['selection', 'native-load', 'tool-call', 'file-read', 'guidance']
    .includes(row.event as string)) throw invalid();
  if (!['success', 'failure', 'unknown'].includes(row.result as string)) throw invalid();
  for (const field of ['elapsedMs', 'atMs']) {
    if (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || row[field] < 0) throw invalid();
  }
  return {
    host: row.host as UsageRecord['host'],
    projectId: row.projectId as string, sessionId: row.sessionId as string,
    capabilityId: row.capabilityId as string, capabilityName: row.capabilityName as string,
    event: row.event as UsageRecord['event'], result: row.result as UsageRecord['result'],
    elapsedMs: row.elapsedMs as number, atMs: row.atMs as number
  };
}
```

- [ ] Create a usage table with explicit columns for these fields and bound inserts. Do not store a request JSON column.
- [ ] Use an injected clock for retention tests. Delete atMs values older than nowMs minus 30 days. Preserve the boundary row and every inventory row.
- [ ] Add a history command returning only stored basic fields. Prune on a bounded maintenance path during ordinary process startup.
- [ ] Run unit and retention tests, then commit with feat: add private basic usage history.

## Task P03.T3: Native observation classification

Files: modify src/adapters/claude-code.ts and src/adapters/codex.ts; create tests/unit/observation.test.ts and synthetic observation fixtures.

Interfaces: Adapter.observe(input: AdapterInput, items: Capability[]): Observation | null resolves targets in the active inventory. observedUse returns true only for native-load and tool-call events. A failed observed call remains a call.

- [ ] Write tests for guidance, file reads, proven native skill invocation, MCP tool success/failure, unmatched capability targets, and duplicate event delivery:

```typescript
import assert from 'node:assert/strict';
import { observedUse } from '../../src/history/records.js';

assert.equal(observedUse({ capabilityId: 'c', kind: 'guidance', succeeded: null }), false);
assert.equal(observedUse({ capabilityId: 'c', kind: 'file-read', succeeded: true }), false);
assert.equal(observedUse({ capabilityId: 'c', kind: 'tool-call', succeeded: false }), true);
```

- [ ] Run the observation test and observe failure. Implement the classifier:

```typescript
import type { Observation } from '../contracts.js';

export function observedUse(event: Observation): boolean {
  return event.kind === 'native-load' || event.kind === 'tool-call';
}
```

- [ ] Add only the mappings proven in P01.T3. Match host-provided targets to indexed capabilities in the active scope. Leave unsupported native skill evidence unknown.
- [ ] Deduplicate observation events using host identifiers where available. When identifiers are absent, report that limitation rather than discarding distinct calls by guesswork.
- [ ] Run npm test, record M3 evidence, and commit with feat: distinguish observed use from recommendations.

## Milestone M3

M3 requires automatic prompt routing on both hosts, worker failure recovery, truthful evidence classification, and privacy/retention tests. The host smoke report identifies any skill use that cannot be observed. It does not promise that loaded instructions were followed correctly.
