# Index and Routing Implementation Plan

> For agentic workers: Use superpowers:executing-plans, or superpowers:subagent-driven-development when the user chooses delegation. Complete task tests before advancing.

Goal: Persist a scoped capability index and produce deterministic selections with valid abstention.

Architecture: SQLite stores metadata by host and project. A pure routing function filters availability and policy before ranking candidates.

Tech Stack: TypeScript, the runtime chosen in P01, SQLite behind Store, and Node tests.

Spec: [Contracts](../14_module_map_contracts.md), [storage ADR](../adrs/22_adr_002_sqlite_storage.md), and [routing ADR](../adrs/24_adr_004_selection_lifecycle.md).

## Execution status

Windows 11 with Node v24.11.0 only. Fedora has not been run. M1 is open: the user deferred Codex live entry and Fedora.

| Task | State | Commits |
| --- | --- | --- |
| P02.T0 (added) Codex config.toml per-skill disable | Implemented and reviewed | 61092c5, 4fd7b2d |
| P02.T1 | Implemented and reviewed. replaceInventory takes an optional atomic `revision` argument. | 19a34d9 |
| P02.T2 | Implemented and reviewed | 9d684d3 |
| P02.T3 | Implemented and reviewed. Function words are removed from queries by ruling. | 53f72cf, 1cf9230 |

Evidence: [30](../evidence/30_p02_local_routing.md). M2 is not complete.

## Global constraints

Select no more than three skills and tools together. Never borrow another project's entries. Exclude disabled and explicit-only capabilities from implicit routing. Preserve the 30-day history policy separately from the persistent index.

## Review focus

Scope changes must not leak candidates across projects. Unknown tool availability must not become callable. Database contention must fit inside the routing deadline.

## Task P02.T1: Database and scope isolation

Files: create src/storage/database.ts, src/storage/inventory.ts, src/discovery/refresh.ts, tests/integration/storage.test.ts, tests/integration/concurrency.test.ts, and tests/unit/refresh.test.ts.

Interfaces: implement openStore, replaceInventory, listInventory, ensureInventory, and currentAvailability from the module map. Migrate in one transaction using PRAGMA user_version.

- [ ] Write reopen, rollback, duplicate-name, removed-skill, and project-isolation tests. Use temporary directories and synthetic capabilities:

```typescript
import assert from 'node:assert/strict';
import { openStore } from '../../src/storage/database.js';
import { replaceInventory, listInventory } from '../../src/storage/inventory.js';
import { makeCapability } from '../fixtures/capabilities.js';

const capabilityA = makeCapability({ projectId: 'a' });
const store = openStore(':memory:');
replaceInventory(store, { host: 'codex', projectId: 'a', roots: [] }, [capabilityA]);
assert.equal(listInventory(store, 'codex', 'b').length, 0);
store.close();
```

The shared factory supplies a complete synthetic record. Do not load a real developer catalog in this test.

- [ ] Run npm run build, then node --test dist/tests/integration/storage.test.js. Observe failure before implementing storage.
- [ ] Create metadata tables and a scoped uniqueness constraint:

```sql
CREATE TABLE capabilities (
  host TEXT NOT NULL,
  project_id TEXT NOT NULL,
  id TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  revision TEXT NOT NULL,
  PRIMARY KEY (host, project_id, id)
);
CREATE TABLE inventory_revisions (
  host TEXT NOT NULL,
  project_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  PRIMARY KEY (host, project_id)
);
```

- [ ] Bind values in prepared statements. Replace one host/project inventory atomically after successful discovery; do not publish partial scans.
- [ ] Test first-use discovery, unchanged revision reuse, additions/removals, metadata edits, profile changes, and discovery failure. A failed refresh must not delete the saved index.
- [ ] Compute source revisions from declared active roots and metadata only. Bound discovery by the worker deadline. If freshness cannot be established, abstain for that scope.
- [ ] Implement ensureInventory to reuse only a matching source revision. Run discovery and replaceInventory on a miss. Make the index command force refresh.
- [ ] Implement request-local tool availability as follows. Reject fresh records outside the active host/project scope before calling this function.

```typescript
import type { Capability } from '../contracts.js';

export function currentAvailability(
  cached: Capability[], fresh: Capability[] | undefined
): Capability[] {
  const tools = new Map((fresh ?? []).filter(item => item.kind === 'tool')
    .map(item => [JSON.stringify([item.host, item.projectId, item.id]), item]));
  return cached.map<Capability>(item => {
    if (item.kind !== 'tool') return item;
    const current = tools.get(JSON.stringify([item.host, item.projectId, item.id]));
    return current ?? { ...item, availability: 'unknown' };
  }).concat((fresh ?? []).filter(item => item.kind === 'tool' &&
    !cached.some(saved => saved.host === item.host && saved.projectId === item.projectId && saved.id === item.id)));
}
```

- [ ] Test a tool that was previously connected but lacks fresh evidence. It must become unknown before selection. Test another session's inventory is rejected.
- [ ] Use a 100 ms SQLite busy timeout as an initial implementation setting. Run two writer processes against the same file and test bounded failure and rollback.
- [ ] Close the database in finally blocks. Record the measured contention result and commit with feat: persist scoped capability inventory.

## Task P02.T2: Eligibility, ranking, and abstention

Files: create src/routing/select.ts, tests/unit/routing.test.ts, and tests/fixtures/catalog.json.

Interfaces: export select(request: RouteRequest, items: Capability[], policy: RoutingPolicy): RouteResult. Return fixed reason codes rather than saved query excerpts.

- [ ] Write tests for an unrelated acknowledgement, explicit-only skills, unknown tools, overlapping names, deterministic ties, phase changes, and more than three matches.

```typescript
import assert from 'node:assert/strict';
import { select } from '../../src/routing/select.js';
import { makeCapability, request, policy } from '../fixtures/capabilities.js';

const explicitOnly = makeCapability({ policy: 'explicit-only' });
const unknownTool = makeCapability({
  kind: 'tool', availability: 'unknown', target: 'synthetic_tool', action: 'tool-guidance'
});
const fiveRelevantCapabilities = Array.from({ length: 5 }, (_, index) =>
  makeCapability({ id: `synthetic-${index}` }));
assert.equal(select(request, [explicitOnly], policy).status, 'abstain');
assert.equal(select(request, [unknownTool], policy).ids.length, 0);
assert.ok(select(request, fiveRelevantCapabilities, policy).ids.length <= 3);
```

Each record uses the complete fixture factory from the contracts document.

- [ ] Run npm run build, then node --test dist/tests/unit/routing.test.js. Observe failure before writing the ranking function.
- [ ] Implement the first lexical score as token overlap. Use this deterministic filter and scoring boundary:

```typescript
const query = new Set(request.text.toLowerCase().match(/[a-z0-9]+/gu) ?? []);
const eligible = items.filter(item =>
  item.host === request.host && item.projectId === request.projectId &&
  item.policy === 'implicit' && item.availability === 'available');
const ranked = eligible.map(item => {
  const words = new Set([item.name, item.description, ...item.terms]
    .join(' ').toLowerCase().match(/[a-z0-9]+/gu) ?? []);
  const hits = [...query].filter(word => words.has(word)).length;
  return { item, score: query.size ? hits / query.size : 0 };
}).filter(candidate => candidate.score > 0 && candidate.score >= policy.minScore)
  .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
const selected = ranked.slice(0, policy.maxSelections);
```

- [ ] Add phase eligibility using item.phases. A capability supporting general can be considered across phases, subject to its query match.
- [ ] Return abstain with no guidance when no candidate survives. Treat scores as uncalibrated ranking signals.
- [ ] Use a minScore of 0.2 as an initial engineering setting, then calibrate it in P05. Never tune against held-out cases.
- [ ] Run targeted tests and commit with feat: add bounded lexical routing and abstention.

## Task P02.T3: Guidance and local route command

Files: create src/routing/guidance.ts and tests/integration/route-cli.test.ts; modify src/routing/select.ts and src/cli.ts.

Interfaces: implement renderGuidance(selected: Capability[], policy: RoutingPolicy): { ids: string[]; guidance: string }. The route command consumes RouteRequest JSON and returns RouteResult. Targets come from adapters.

- [ ] Write tests for empty selection, three selected entries, unusual names, a long description, and a target that belongs to a different project.
- [ ] Run npm run build, then node --test dist/tests/integration/route-cli.test.js. Observe the unsupported-command failure.
- [ ] Render action-specific short guidance and apply a 2,000-character initial cap:

```typescript
import type { Capability, RoutingPolicy } from '../contracts.js';

export function renderGuidance(selected: Capability[], policy: RoutingPolicy) {
  const lines: string[] = [];
  const ids: string[] = [];
  let usedChars = 0;
  for (const item of selected.slice(0, policy.maxSelections)) {
    const line = JSON.stringify({ capability: item.name, action: item.action, target: item.target });
    const addedChars = line.length + (lines.length ? 1 : 0);
    if (usedChars + addedChars > policy.maxGuidanceChars) continue;
    lines.push(line);
    ids.push(item.id);
    usedChars += addedChars;
  }
  return { ids, guidance: lines.join('\n') };
}
```

- [ ] Drop complete candidate lines that exceed the cap instead of truncating an identifier or JSON record. Count native full skill loading separately from routing guidance.
- [ ] Return only IDs whose guidance fits. If every line exceeds the budget, return abstain with reason GUIDANCE_BUDGET.
- [ ] Call renderGuidance inside select after ranking. Pass selected.map(({ item }) => item) and copy its IDs and guidance into RouteResult.
- [ ] Wire route dispatch to scoped inventory, selection, and the JSON result. Keep requests out of history and diagnostics.
- [ ] Reconcile CLI host/project flags with the JSON request. Reject conflicting scope rather than selecting from a caller-supplied foreign scope.
- [ ] Run npm test and record M2 evidence. Commit with feat: expose local routing and bounded guidance.

## Milestone M2

M2 requires scope, eligibility, abstention, cap, persistence, and contention tests. The score and output limits are starting settings, not performance claims. P05 can change measured settings without changing the three-capability product limit.
