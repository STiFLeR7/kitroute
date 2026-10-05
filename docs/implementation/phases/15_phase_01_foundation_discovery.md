# Foundation and Discovery Implementation Plan

> For agentic workers: Use superpowers:executing-plans, or superpowers:subagent-driven-development when the user chooses delegation. Track checkbox steps and run each task's tests before advancing.

Goal: Produce a local executable and prove the initial host interfaces before implementing routing.

Architecture: One TypeScript package compiles to JavaScript. Two adapters normalize supported host input, and skill discovery supplies scoped metadata.

Tech Stack: Node.js 24.21.0 baseline, TypeScript, npm, Node tests, and the yaml parser.

Spec: [Main plan](../12_implementation_plan.md), [contracts](../14_module_map_contracts.md), and [runtime ADR](../adrs/21_adr_001_runtime_package.md).

## Global constraints

All constraints in the main plan apply. Test on Windows and Fedora Linux. Do not edit real host configuration during unit tests. No phase is complete from documentation alone.

## Review focus

Malformed frontmatter must not enable implicit invocation. Active project scope must control duplicate names. Configuration must not prove MCP connectivity.

## Task P01.T1: Executable and test harness

Files: create package.json, tsconfig.json, bin/kitroute.mjs, src/cli.ts, src/contracts.ts, src/paths.ts, scripts/run-tests.mjs, tests/fixtures/capabilities.ts, tests/unit/cli.test.ts, and .github/workflows/ci.yml.

Interfaces: implement the contracts document. Export runCli(argv: string[], input: string): Promise<string> from src/cli.ts. The initial doctor command returns runtime and database import status without file paths or environment dumps.

- [ ] Create package.json as a private development package. Use the following scripts and runtime floor:

```json
{
  "name": "kitroute",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "kitroute": "bin/kitroute.mjs" },
  "engines": { "node": ">=24.21.0 <25" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "npm run build && node scripts/run-tests.mjs"
  }
}
```

- [ ] Install development dependencies with exact versions and commit the resulting lockfile during execution:

```text
npm install --save-dev --save-exact typescript @types/node@24
npm install --save-exact yaml
```

- [ ] Set strict TypeScript compilation, NodeNext modules, rootDir '.', and outDir 'dist'. Include src, tests, and evaluation when that directory exists.
- [ ] Write tests for doctor output, unknown commands, malformed input, and paths containing spaces:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../../src/cli.js';

test('doctor returns bounded structured status', async () => {
  const result = JSON.parse(await runCli(['doctor'], ''));
  assert.equal(result.command, 'doctor');
  assert.equal(typeof result.runtime, 'string');
  assert.equal('environment' in result, false);
});
```

- [ ] Run npm run build and observe the missing-export failure. Create the minimal dispatch:

```typescript
export async function runCli(argv: string[], input: string): Promise<string> {
  if (argv[0] !== 'doctor') throw new Error('UNKNOWN_COMMAND');
  await import('node:sqlite');
  return JSON.stringify({ command: 'doctor', runtime: process.version, sqlite: true });
}
```

- [ ] Add a bin wrapper that invokes runCli and prints exactly its response. Keep generic error codes on stderr without echoing input.

```javascript
#!/usr/bin/env node
import { runCli } from '../dist/src/cli.js';

try {
  let input = '';
  if (['route', 'hook'].includes(process.argv[2])) {
    let bytes = 0;
    const chunks = [];
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) throw new Error('INPUT_TOO_LARGE');
      chunks.push(chunk);
    }
    input = Buffer.concat(chunks).toString('utf8');
  }
  process.stdout.write(await runCli(process.argv.slice(2), input));
} catch {
  if (process.argv[2] !== 'hook') {
    process.stderr.write('KITROUTE_COMMAND_FAILED\n');
    process.exitCode = 1;
  }
}
```

The wrapper reads stdin only for route and hook. Test doctor from an interactive terminal as well as a pipe.
- [ ] Create the shell-independent test runner:

```javascript
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function collect(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await collect(path));
    else if (entry.name.endsWith('.test.js')) result.push(path);
  }
  return result;
}
const files = (await collect('dist/tests')).sort();
if (!files.length) throw new Error('NO_TEST_FILES');
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
if (result.error) throw new Error('TEST_RUNNER_FAILED');
process.exitCode = result.status ?? 1;
```

- [ ] Run npm test on both systems. Add CI jobs for Windows and Linux; Fedora manual evidence is required separately.
- [ ] Commit the reviewed scaffold with the message feat: add local executable and test harness.

## Task P01.T2: Safe scoped skill discovery

Files: create src/discovery/skills.ts, tests/unit/discovery.test.ts, and tests/fixtures/skills/{valid,explicit-only,malformed}/SKILL.md.

Interfaces: export parseSkill with the exact contract from the module map. Export discoverSkills(context: DiscoveryContext): Promise<Capability[]> and use declared roots, not a recursive scan of the home directory.

- [ ] Write parser tests for valid metadata, explicit-only controls, malformed YAML, duplicate names in different projects, and inactive roots.

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSkill } from '../../src/discovery/skills.js';

test('explicit-only frontmatter stays explicit-only', () => {
  const text = '---\nname: publish\ndescription: Publish a package\ndisable-model-invocation: true\n---\nPublish.';
  const result = parseSkill(text, '/synthetic/publish/SKILL.md', 'claude-code', 'project-a');
  assert.equal(result.policy, 'explicit-only');
});
```

- [ ] Run npm run build, then node --test dist/tests/unit/discovery.test.js. Observe the missing-function failure.
- [ ] Parse only the leading YAML block with the yaml package. Require non-empty string name and description. Treat malformed metadata as excluded, and report a fixed error code.

```typescript
import { parse } from 'yaml';

export function frontmatter(text: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text);
  if (!match) throw new Error('INVALID_SKILL_METADATA');
  const value: unknown = parse(match[1]);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_SKILL_METADATA');
  }
  return value as Record<string, unknown>;
}
```

- [ ] Translate each host's implicit-invocation controls into InvocationPolicy. Use supported host configuration to establish active roots and scope precedence.
- [ ] Implement projectScopeId using normalized root and the active profile identity. Generate capability IDs from host, that scope ID, and canonical source.
- [ ] Test two profiles sharing one project root. Hash metadata for revision changes. Do not persist project source code.
- [ ] Prefer supplied native inventory and use files only for documented gaps. Configuration-discovered MCP entries remain unknown until a supported interface establishes availability.
- [ ] Run parser and discovery tests, then commit with feat: add scoped capability discovery.

## Task P01.T3: Host feasibility and normalized input

Files: create src/adapters/claude-code.ts, src/adapters/codex.ts, tests/unit/adapters.test.ts, tests/fixtures/hooks/{claude-code,codex}.json, and a numbered evidence report.

Interfaces: implement Adapter.normalize, Adapter.render, and Adapter.validateOutput. Accept only output fields supported by the tested host event. A native skill observation requires a proven loading signal.

- [ ] Write synthetic prompt tests for both adapters and for malformed or unsupported events:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { claudeCode } from '../../src/adapters/claude-code.js';

test('normalization keeps request text transient', () => {
  const raw = { session_id: 's', cwd: '/synthetic/project', prompt: 'Fix checkout' };
  const input = claudeCode.normalize(raw, 'UserPromptSubmit');
  assert.equal(input?.sessionId, 's');
  assert.equal(input?.text, 'Fix checkout');
});
```

- [ ] Run the adapter test and observe failure. Implement explicit field mappings with string/type guards:

```typescript
if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
const value = raw as Record<string, unknown>;
if (typeof value.session_id !== 'string' || typeof value.cwd !== 'string') return null;
if (event === 'UserPromptSubmit' && typeof value.prompt !== 'string') return null;
```

- [ ] In temporary host configurations, make a minimal command hook emit a fixed additional-context marker. Confirm it reaches ordinary prompts on both systems.
- [ ] Inspect supported active skill and tool discovery interfaces. Record exact coverage and fallback roots without storing real user prompts.
- [ ] Test the available native loading/tool observation events. Document unknown evidence explicitly. Do not use InstructionsLoaded as proof of skill loading merely because it reports instruction files.
- [ ] Run npm test, record M1 evidence, and commit with feat: establish initial host adapter contracts.

## Milestone M1

M1 requires a compiled executable, tested discovery policies, and live hook entry evidence for both hosts on both systems. If a host feature is unavailable, document the scope consequence before advancing. Source tests alone do not prove host compatibility.
