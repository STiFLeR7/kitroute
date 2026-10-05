# Module map and implementation contracts

Status: planned file boundaries and interfaces. The repository currently contains documentation only.

## File ownership

| Planned path | Responsibility | First phase |
| --- | --- | --- |
| package.json, package-lock.json, tsconfig.json | Build scripts, runtime floor, pinned development dependencies. | P01 |
| src/contracts.ts | Common records and adapter interfaces. | P01 |
| src/cli.ts | Command parsing and dispatch without host-specific logic. | P01 |
| bin/kitroute.mjs | Read standard input and dispatch the compiled executable. | P01 |
| src/paths.ts | Local data paths and normalized project identity. | P01 |
| src/discovery/skills.ts | Parse eligible skill metadata from declared host roots. | P01 |
| src/adapters/claude-code.ts, src/adapters/codex.ts | Normalize supported events and render host-specific output. | P01, P03 |
| src/storage/database.ts | Open SQLite, migrations, and bounded transactions. | P02 |
| src/storage/inventory.ts | Scoped inventory replacement and revision handling. | P02 |
| src/discovery/refresh.ts | Bounded source revision checks and request-local tool availability. | P02 |
| src/routing/select.ts, src/routing/guidance.ts | Eligibility, ranking, abstention, and bounded guidance. | P02 |
| src/hooks/handle.ts, src/hooks/worker.ts | Isolated routing execution with an outer deadline. | P03 |
| src/history/records.ts | Allowlisted usage persistence and 30-day cleanup. | P03 |
| src/lifecycle/state.ts | Task phase, deduplication, resume, and project changes. | P04 |
| src/setup/plan.ts, src/setup/apply.ts | Configuration preview, backup, owned entries, and recovery. | P04 |
| src/setup/detect.ts | Detect supported host installations through declared local paths and bounded native checks. | P04 |
| scripts/run-tests.mjs | Run compiled test files without shell glob dependencies. | P01 |
| tests/unit/, tests/integration/, tests/fixtures/ | Deterministic behaviors, process boundaries, synthetic host data. | P01 onward |
| tests/fixtures/capabilities.ts | Complete synthetic capabilities and routing inputs shared by tests. | P01 |
| evaluation/cases.json, evaluation/run.ts, evaluation/report.ts | Synthetic benchmark cases, trial input/output, aggregate metrics. | P05 |
| .github/workflows/ci.yml, README.md | Automated checks and community usage docs. | P01, P06 |

Use one npm package initially. Split packages only when a tested integration requires separate distribution. Compile source and tests into dist/ with TypeScript NodeNext modules.

## Shared types

Create these definitions in src/contracts.ts. Later phase examples use these exact names and fields.

```typescript
export type Host = 'claude-code' | 'codex';
export type Phase = 'general' | 'reproduce' | 'implement' | 'verify';
export type Availability = 'available' | 'unavailable' | 'unknown';
export type InvocationPolicy = 'implicit' | 'explicit-only' | 'disabled' | 'unknown';
export type Action = 'native-attach' | 'load-guidance' | 'tool-guidance';

export interface Capability {
  id: string;
  host: Host;
  projectId: string;
  kind: 'skill' | 'tool';
  name: string;
  description: string;
  terms: string[];
  phases: Phase[];
  policy: InvocationPolicy;
  availability: Availability;
  revision: string;
  source: string;
  target: string;
  action: Action;
}

export interface RouteRequest {
  host: Host;
  projectId: string;
  sessionId: string;
  turnId?: string;
  text: string;
  phase: Phase;
}

export interface RouteResult {
  status: 'selected' | 'abstain' | 'degraded';
  ids: string[];
  reasonCodes: string[];
  guidance: string;
  elapsedMs: number;
}

export interface AdapterInput {
  host: Host;
  event: string;
  cwd: string;
  projectId?: string;
  inventoryRevision?: string;
  sessionId: string;
  turnId?: string;
  text?: string;
  toolName?: string;
  skillTarget?: string;
  nativeLoadTarget?: string;
  observedToolAvailable?: string;
  succeeded?: boolean;
}

export interface DiscoveryContext {
  host: Host;
  projectId: string;
  roots: string[];
  nativeInventory?: Capability[];
}

export interface Adapter {
  host: Host;
  normalize(raw: unknown, event: string): AdapterInput | null;
  discover(context: DiscoveryContext): Promise<Capability[]>;
  render(result: RouteResult, event: string): string;
  validateOutput(output: string, event: string): string | null;
  observe(input: AdapterInput, items: Capability[]): Observation | null;
}

export interface Observation {
  capabilityId: string;
  kind: 'native-load' | 'tool-call' | 'file-read' | 'guidance';
  succeeded: boolean | null;
}

export interface UsageRecord {
  host: Host;
  projectId: string;
  sessionId: string;
  capabilityId: string;
  capabilityName: string;
  event: 'selection' | Observation['kind'];
  result: 'success' | 'failure' | 'unknown';
  elapsedMs: number;
  atMs: number;
}
```

AdapterInput is transient. Never persist its text, raw payload, tool arguments, or project output. UsageRecord is an allowlist, not a wrapper around AdapterInput.

projectId identifies a project and its active host profile together. Build it from the normalized project root and adapter-established profile identity. A profile change therefore changes the inventory key. Hosts without profiles use the literal profile identity default. The worker enriches AdapterInput with projectId and inventoryRevision before lifecycle processing.

The available state requires evidence from a supported host interface. A file-discovered skill can be available when its active scope and invocation policy are established. Configuration alone leaves tool availability unknown.

Do not assume that nativeInventory exists on every host. Adapter discovery uses declared fallbacks and reports its coverage. The core receives tool targets from adapters, never guesses native names.

## Shared interfaces

```typescript
import type { DatabaseSync } from 'node:sqlite';

export interface Store {
  db: DatabaseSync;
  close(): void;
}

export interface RoutingPolicy {
  maxSelections: 3;
  minScore: number;
  maxGuidanceChars: number;
}

export interface SessionState {
  phase: Phase;
  signature: string;
}

export interface Patch {
  file: string;
  beforeHash: string;
  add: Array<{ event: string; entry: Record<string, unknown>; ownedId: string }>;
}

export interface SetupPlan {
  patches: Patch[];
  conflicts: string[];
}

export interface UninstallResult {
  files: Record<string, string>;
  conflicts: string[];
}
```

| Function | Contract |
| --- | --- |
| normalizeProject(root: string): string | Resolve real paths, normalize platform conventions, and return a stable project ID. |
| projectScopeId(normalizedRoot: string, profileId: string): string | Hash a length-delimited root/profile tuple. Use the result as projectId in every core record and database key. |
| parseSkill(text: string, source: string, host: Host, projectId: string): Capability | Parse frontmatter and enforce invocation policy without treating malformed metadata as implicit permission. |
| openStore(path: string): Store | Open and migrate SQLite with a bounded lock timeout. |
| replaceInventory(store: Store, context: DiscoveryContext, items: Capability[], revision?: string): void | Replace only the host/project scope after discovery completes. Commit an optional source revision in the same transaction. |
| listInventory(store: Store, host: Host, projectId: string): Capability[] | Return the current scope without borrowing another project's capabilities. |
| ensureInventory(store: Store, adapter: Adapter, context: DiscoveryContext, revision: string): Promise<Capability[]> | Discover on first use or source revision change, replace atomically, and otherwise reuse metadata. |
| currentAvailability(cached: Capability[], fresh: Capability[] \| undefined): Capability[] | Reset cached tools to unknown. Merge only current host/project inventory supplied for this request. |
| select(request: RouteRequest, items: Capability[], policy: RoutingPolicy): RouteResult | Filter, rank deterministically, cap selections, and return abstention when evidence is weak. |
| renderGuidance(selected: Capability[], policy: RoutingPolicy): { ids: string[]; guidance: string } | Render complete action/target records within the character budget. |
| toUsageRecord(value: unknown): UsageRecord | Construct only allowed fields; reject invalid records without echoing input. |
| appendUsage(store: Store, record: UsageRecord): void | Insert an allowlisted record. |
| pruneUsage(store: Store, nowMs: number): number | Delete usage older than 30 days without touching inventory. |
| runWorker(workerPath: string, host: Host, event: string, input: string, validateOutput: (raw: string) => string \| null, deadlineMs?: number): Promise<string> | Bound the isolated worker, drain stderr, and return only adapter-validated output. |
| advanceState(previous: SessionState, input: AdapterInput, ids: string[]): SessionState | Update phase and deduplication signature without storing prompt text. |
| detectHosts(homeRoot: string): Promise<Host[]> | Detect supported installations without installing agents or rewriting their configuration. |
| planSetup(files: Record<string, string>, entries: Patch[]): SetupPlan | Preview exact owned entries and report malformed/conflicting configuration. |
| applySetup(plan: SetupPlan, root: string): void | Recheck file hashes, back up, and atomically apply owned entries. |
| uninstall(files: Record<string, string>, ownedPatches: Patch[]): UninstallResult | Remove exact owned entries and report conflicts while preserving user-modified entries. |

The setup filesystem wrapper and adapters implement their platform details in the owning tasks. These contracts define Kitroute behavior, not undocumented host APIs.

Source revision covers active root listings, eligible metadata, and host configuration/profile changes. Do not reuse a revision after resume without checking sources. Tool availability never survives through the saved index alone. The worker resets it before selection unless a supported current host interface establishes it again.

## Complete synthetic fixtures

Create tests/fixtures/capabilities.ts in P01.T1. These values contain no developer catalog data. Later phase examples import them.

```typescript
import type { Capability, RouteRequest, RoutingPolicy } from '../../src/contracts.js';

export function makeCapability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: 'synthetic-debug', host: 'codex', projectId: 'a', kind: 'skill',
    name: 'debug', description: 'Debug a checkout error', terms: ['checkout'],
    phases: ['general', 'reproduce'], policy: 'implicit', availability: 'available',
    revision: 'fixture-v1', source: '/synthetic/debug/SKILL.md',
    target: '/synthetic/debug/SKILL.md', action: 'load-guidance', ...overrides
  };
}

export const request: RouteRequest = {
  host: 'codex', projectId: 'a', sessionId: 's', turnId: 't',
  text: 'Debug a checkout error', phase: 'reproduce'
};
export const policy: RoutingPolicy = {
  maxSelections: 3, minScore: 0.2, maxGuidanceChars: 2000
};
```
