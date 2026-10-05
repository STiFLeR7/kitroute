# Lifecycle and Setup Implementation Plan

> For agentic workers: Use superpowers:executing-plans, or superpowers:subagent-driven-development when the user chooses delegation. Complete task tests before advancing.

Goal: Reconsider selection at clear task changes and provide reversible setup on both target systems.

Architecture: Persist only small routing state without request text. A setup planner previews owned configuration entries before an atomic apply step.

Tech Stack: TypeScript, SQLite, platform-aware paths, and Node tests.

Spec: [Contracts](../14_module_map_contracts.md), [routing ADR](../adrs/24_adr_004_selection_lifecycle.md), and [setup ADR](../adrs/26_adr_006_reversible_setup.md).

## Global constraints

Reconsider each user request and clear task changes. Avoid repeated guidance when selection is unchanged. One guided setup command must preserve unrelated configuration and later user edits.

## Review focus

A changed project must invalidate routing state. A repeated event must not add duplicate guidance. Uninstall must not restore an old backup over new user settings.

## Task P04.T1: Phase state and deduplication

Files: create src/lifecycle/state.ts and tests/unit/lifecycle.test.ts; modify the hook worker and storage schema.

Interfaces: implement advanceState from the module map. Export phaseFromInput(input: AdapterInput): Phase | null and continuationText(phase: Phase): string.

- [ ] Write tests for debugging to verification, unchanged selections, resume, compaction, and the same session in a different project.

```typescript
import assert from 'node:assert/strict';
import { advanceState } from '../../src/lifecycle/state.js';

const previous = { phase: 'reproduce' as const, signature: 'old' };
const next = advanceState(previous, {
  host: 'codex', event: 'UserPromptSubmit', cwd: '/synthetic',
  projectId: 'a', inventoryRevision: 'fixture-v1',
  sessionId: 's', text: 'Now run the regression tests'
}, ['testing']);
assert.equal(next.phase, 'verify');
assert.notEqual(next.signature, previous.signature);
```

- [ ] Run the lifecycle test and observe failure. Implement request phase hints and only the continuation signals proven by adapter tests.
- [ ] Derive a stable signature from active scope, inventory revision, phase, and sorted selected IDs. Save no prompt text or raw tool response.
- [ ] If a supported continuation indicates a phase change, reroute from canonical phase text rather than a saved user prompt:

```typescript
export function continuationText(phase: Phase): string {
  return {
    general: 'general project work',
    reproduce: 'debug reproduce investigate error',
    implement: 'implement fix project behavior',
    verify: 'test verify regression behavior'
  }[phase];
}
```

- [ ] Emit changed guidance only through a supported host context channel. Record unavailable continuation channels in the compatibility report.
- [ ] Invalidate the state on project or inventory change. On resume/compaction, refresh available metadata and do not suppress needed guidance from an old context.
- [ ] Run targeted tests and commit with feat: reroute at supported task changes.

## Task P04.T2: Configuration planner and ownership

Files: create src/setup/detect.ts, src/setup/plan.ts, src/setup/apply.ts, tests/integration/setup.test.ts, and tests/fixtures/configuration/; modify src/cli.ts.

Interfaces: implement detectHosts, planSetup, applySetup, and uninstall from the module map. Use the supported host entries established in P01. Ownership lives in Kitroute's manifest.

- [ ] Write tests for dry-run immutability, malformed JSON, changed hashes, repeated setup, conflicts, partial failure, and a user edit after installation:

```typescript
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { uninstall } from '../../src/setup/plan.js';
import type { Patch } from '../../src/contracts.js';

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
const remaining = JSON.parse(result.files['hooks.json']);
assert.deepEqual(result.conflicts, []);
assert.equal(remaining.theme, 'light');
assert.deepEqual(remaining.hooks.UserPromptSubmit, [unrelatedEntry]);
```

This test uses a synthetic Claude-shaped hook container. Add a separate fixture for the Codex format proven in P01. owned-hook-id is manifest metadata, not a native configuration property.

- [ ] Run npm run build, then node --test dist/tests/integration/setup.test.js. Observe failure before implementing mutation.
- [ ] Test detection with neither host, each host alone, both hosts, and an unsupported version. Limit discovery to declared local paths and bounded native checks.
- [ ] Make one setup command compose plans for detected supported hosts. Report missing or unsupported hosts before proposing changes.
- [ ] Make preview return changed files, exact additions, backups, and conflicts. Recheck the original content hash immediately before apply.
- [ ] Back up the current file once, write a temporary sibling, and atomically replace the target where the platform permits it. If a step fails, restore only files changed by that incomplete transaction and preserve user changes.
- [ ] Use parsed object structure to preserve unrelated keys. Reject unsupported or ambiguous configuration formats rather than rewriting them destructively.
- [ ] On uninstall, remove exact manifest-owned entries. If an owned entry was edited by the user, report the conflict and leave it intact.
- [ ] Generate shell-specific hook commands from absolute runtime and entry paths. Test spaces and metacharacters. Do not use JSON encoding as shell escaping.
- [ ] Run setup tests on Windows and Fedora. Commit with feat: add reversible guided setup.

## Task P04.T3: Preview package and lifecycle smoke tests

Files: create tests/integration/package-preview.test.ts and a numbered compatibility report; modify README.md and package.json.

Interfaces: the setup, setup --dry-run, uninstall, and uninstall --dry-run commands use the same planner. Doctor reports missing trust or unsupported host versions without bypassing them.

- [ ] Write a child-process test that runs setup preview against a temporary home and confirms no file changes.
- [ ] Package locally with npm pack and inspect its file list. Include compiled code and required metadata, not tests, evaluation results, user records, or local databases.
- [ ] Install the tarball into a temporary prefix and run doctor, setup preview, apply, and uninstall against synthetic homes.
- [ ] Run the same sequence manually in Windows and Fedora, then test real host prompts after intentional setup. Keep native hook trust review intact.
- [ ] Record M4 evidence and commit with test: prove installable preview on target systems.

## Milestone M4

M4 requires a reversible preview package, task-change handling where the hosts support it, and documented gaps. Both operating systems must pass setup and uninstall tests. A package that installs only in the development checkout does not pass.
