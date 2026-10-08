# Pop!_OS compatibility test

Date: 8 October 2026. Tasks: P01 runtime and host entry, P03 automatic routing, and P04 setup lifecycle on the Linux target.
Pop!_OS replaced Fedora as the required Linux target by user decision on 8 October 2026. This report does not establish support for Fedora or any other distribution.

The Pop!_OS checks pass after one correction. These include live Claude Code and Codex smoke tests with the generated hooks, in an isolated home.
This report does not establish release readiness or an improvement over baseline selection. M1, M3, and M4 remain in progress.

## Environment and checkout

| Item | Value |
| --- | --- |
| Operating system | Pop!_OS 24.04 LTS (`ID=pop`, `VERSION_ID="24.04"`, `PRETTY_NAME="Pop!_OS 24.04 LTS"`) |
| Kernel and architecture | `Linux 7.1.5-76070105-generic x86_64 GNU/Linux` |
| Filesystem | ext4 on `/dev/mapper/data-root`, mounted at `/` with `rw,noatime` |
| Shell | GNU bash 5.2.21. `/bin/sh` is dash. |
| Node and npm | Node `v24.21.0` managed by fnm, npm `11.19.0` |
| Claude Code | `2.1.293`. Detection floor: 2.1.289. |
| Codex CLI | `0.160.1`. Detection floor: 0.157.1. |
| Model IDs | Claude Code: `claude-haiku-5-5`, selected through the `haiku` alias. Codex: `gpt-6-luna` with `low` effort. The Codex catalog default was `gpt-6.1-sol`. |
| Checkout | Native Linux checkout of `STiFLeR7/kitroute`, branch `master`, HEAD `c3ef4f0` (merge of PR #1) |

The checkout contains `e2c9f4b`, `f2f1532`, and `acb66ff`. Each `git merge-base --is-ancestor` check exited 0. `origin/master` matched HEAD. A fetch dry run reported nothing newer.
The checkout did not contain the Pop!_OS handoff file or a D25 decision-log entry. The decision log ends at D24. The Pop!_OS target in this report comes from the user's handoff of 8 October 2026.
The implementation under test is `c3ef4f0` plus the uncommitted correction described below.
The Windows `node_modules` and compiled output were not used. The run started with no `dist/` or `node_modules/`.

All prerequisite commands exited 0. `command -v claude` and `command -v codex` found both executables.
`command -v node` returns a per-shell fnm path under `/run/user/1000/fnm_multishells/`. Generated hook commands use `process.execPath`, which resolves to the stable installation path `~/.local/share/fnm/node-versions/v24.21.0/installation/bin/node`. If that Node version is removed, setup must be run again.

## Build and automated suite

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | 5 packages added in 0.6 s. No engine warning. |
| `npm test` before correction | 0 | 161 tests: 160 passed, 1 skipped, 0 failed |
| `npm test` after correction, from a clean `dist/` | 0 | 168 tests: 167 passed, 1 skipped, 0 failed |

The only skip in both runs was `Codex Windows command executes quoted paths in PowerShell and preserves hook input`. It is skipped on non-Windows platforms by design. PowerShell was not installed.
The package installation test ran and passed. It did not skip, because the npm registry was reachable.
Database migration and reopen, privacy, 30-day retention, concurrency, routing, lifecycle, setup, and package tests passed.
Neither run printed an SQLite warning. A direct `import('node:sqlite')` on Node 24.21.0 also printed none.
Before the clean rebuild, the resolved `dist` path was checked to be inside the checkout. Afterwards, `dist/tests` held 21 compiled test files, one for each source test file.

## Defect: Claude Code skillOverrides was ignored

Claude Code documents `skillOverrides` as the per-skill visibility control in [skills](https://code.claude.com/docs/en/skills#override-skill-visibility-from-settings) and the [settings reference](https://code.claude.com/docs/en/settings-reference#skilloverrides).
`"off"` hides a skill from Claude and from the `/` menu. `"user-invocable-only"` hides it from Claude but keeps `/name`. `"on"` and `"name-only"` keep it listed to Claude.
The `/skills` menu writes the setting to `.claude/settings.local.json`.

Kitroute's Claude adapter did not read `skillOverrides`. Its inventory revision also omitted `.claude/settings.local.json`.
The generated `UserPromptSubmit` command was run with `{"skillOverrides":{"kt-popos-disabled":"off"}}` in the project's local settings. It returned guidance naming `kt-popos-disabled` in two separate sessions.
That result would send the model to a skill that the host had turned off.

The new integration test `claude skill hidden by skillOverrides is never selected` in `tests/integration/route-cli.test.ts` failed before the change.
It returned `alpha, beta, gamma` where only `gamma` was expected.
`tests/unit/claude-config.test.ts` adds six unit tests for the mapping rules.

The correction adds `applyClaudeOverrides` to `src/adapters/claude-code.ts`. `setup` in `src/cli.ts` passes it the user, project, and project-local settings, in precedence order:

- `"off"` becomes `disabled`, and `"user-invocable-only"` becomes `explicit-only`. `"on"` and `"name-only"` leave the policy unchanged.
- A key matches the frontmatter name or the skill directory name. Both invoke a personal or project skill.
- For each skill, the highest-precedence file that names it decides. The documentation does not say whether this key merges per entry. Per-entry resolution never shows a skill that whole-object replacement would hide.
- An unknown value makes that skill `unknown`. An unparseable settings file makes every Claude skill `unknown`. Both outcomes exclude the skill from routing.
- An override can only restrict. It never re-enables a skill that its frontmatter disables.
- `.claude/settings.local.json` is now part of the inventory revision, so an edit through `/skills` refreshes the index.

After the change, the same generated command returned no guidance for the disabled skill. It still returned guidance for `kt-popos-smoke`.
Managed settings, files passed with `--settings`, and `Skill(name)` deny rules are not read. Hooks cannot see `--settings`. The documentation states that overrides do not apply to plugin skills.
In the live runs, Claude Code 2.1.293 left `kt-popos-disabled` out of its own `init` skill list. This confirms that the host honors the setting, so the guidance before the correction would have named a skill that the model could not see.
The unit tests also check that a value such as `"constructor"`, which names an inherited JavaScript property, fails closed.

## Setup lifecycle

The test used a temporary root under `.local/tmp/kt-popos.<random>/` with a synthetic `home/` and a `project with spaces/`.
Child commands received `HOME`, `USERPROFILE`, `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `KITROUTE_HOME`, temporary directories, and the npm cache through a wrapper function. The controlling session's `HOME` was not changed.
`kitroute doctor` reported `v24.21.0`, `sqlite: true`, Claude Code `2.1.293` supported, Codex `0.160.1` supported, and the Codex trust note.
These synthetic directories do not prove that either host executable can authenticate.

| Check | Result |
| --- | --- |
| `setup --dry-run` | Exit 0. Every file in the temporary root kept its bytes and modification time. No manifest or Kitroute data directory was created. Both target paths stayed inside the temporary home. |
| `setup` | Exit 0, no conflicts. The synthetic `theme` and `description` keys were kept. A manifest and a backup of each file were written. |
| Second `setup --dry-run` | No patches and no conflicts. |
| Codex events | `UserPromptSubmit` and `SessionStart` only. |
| Claude Code events | `UserPromptSubmit`, `SessionStart`, and `PostToolUse` and `PostToolUseFailure` with matcher `Skill`. |
| Command form | `"<node>" "<repo>/bin/kitroute.mjs" hook --host <host> --event <event>`. No command has the Windows `&` prefix. |
| Later user edits | An unrelated key and a `true # synthetic-user-hook` entry were added to each file. |
| `uninstall --dry-run` | Exit 0. It reported two changed files and changed no bytes or modification times. |
| `uninstall` | Exit 0, no conflicts. Each file equalled the edited file minus the exact owned entries. The user key and user hook remained. The manifest was removed. |

The same sequence passed in a second fresh home created with the same procedure.
The edited-owned-entry conflict was not tested by hand. These automated tests cover it, and all passed on Pop!_OS:

- `edited owned entry is a conflict and left intact; emptied arrays are removed`
- `planSetup: an edited Kitroute entry is a conflict, not a second copy`
- `uninstall reports an edited Kitroute entry even when an exact copy was removed`
- `user edits after install survive uninstall; Codex-format fixture`

### Generated command execution

A script read the exact commands from the synthetic host files and ran each one through `/bin/sh -c` (dash) and `/bin/bash -c` with synthetic JSON input. The `cwd` field was the project path with spaces.
Project skills existed at `.claude/skills/` and `.agents/skills/`. A separate Kitroute data directory kept these runs out of the live-test history.

| Case | Claude Code | Codex |
| --- | --- | --- |
| `SessionStart` with `source: startup` | Exit 0, no output | Exit 0, no output |
| `Debug synthetic checkout failure.` | Guidance for `kt-popos-smoke` with its SKILL.md target | Guidance for `kt-popos-smoke` with its SKILL.md target |
| Same prompt in the same session | Exit 0, no output | Exit 0, no output |
| Greeting in a new session | Exit 0, no output | Exit 0, no output |
| Explicit-only skill request | Exit 0, no output (`disable-model-invocation: true`) | Exit 0, no output (`policy.allow_implicit_invocation: false`) |
| Disabled skill request | Guidance before the correction; no output after it (`skillOverrides` `"off"`) | Exit 0, no output (`[[skills.config]]` with `enabled = false`) |
| `PostToolUse` and `PostToolUseFailure` for `Skill` | Exit 0, no output | Not registered |

Every case exited 0 with empty stderr under both shells. Whole-process durations were 116–156 ms.
These figures include shell and Node startup with synthetic input. They are not live host measurements or a latency guarantee.

## Installed package

`npm pack --pack-destination` produced `kitroute-0.1.0.tgz`: 21,129 bytes and 23 entries.
It contains `package.json`, `README.md`, `bin/kitroute.mjs`, and `dist/src/**` only. No tests, evidence, handoff files, credentials, databases, or `.local` content were included.
`npm install --prefix <temporary prefix>` exited 0 and installed `kitroute` and `yaml 2.9.1`.

Doctor, setup preview, setup, repeated preview, uninstall preview, and uninstall all passed from the installed copy in a fresh home, with the same results as the source checkout.
All six generated commands pointed to the installed copy's `bin/kitroute.mjs`. None pointed to the source checkout.
The installed copy's generated commands also passed the execution cases above.
In that home, the Codex disabled skill received guidance. This was expected: the fresh home had no `config.toml` that disabled it. The tarball was not published.

## Offline history and privacy

`kitroute history` on the synthetic database returned eight records.
Selections kept `event: selection` and `result: unknown`. Repeating the prompt in sessions `syn-c1` and `syn-x1` added no second selection record.
The two `native-load` records came from synthetic `PostToolUse` and `PostToolUseFailure` payloads. They are not live evidence of skill loading.
The three selections of `kt-popos-disabled` were recorded during the defect reproduction, before the correction.

A read-only scan searched every table for the synthetic prompts and the skill-body marker `KITROUTE_POPOS_SKILL_BODY_7c42`.
The `usage`, `session_state`, `observed_events`, and `inventory_revisions` tables contained neither.
The `capabilities` table held the skill descriptions, which use the same words as the ordinary prompt by design. This is inventory metadata, not a stored prompt. The body marker appeared in no table.

## Live host tests

### Method and authorization

The live tests used a fresh temporary root, `.local/tmp/kl.<random>/`. It held a synthetic home, a `project with spaces/` directory, and its own Kitroute data directory.
`git init` made the project its own Git root, so neither host treated the Kitroute checkout as the project.
`kitroute setup` installed the generated hooks with no conflicts. A repeated preview returned no patches. The skill fixtures from the offline run were reused.
The temporary Claude settings also set `syncClaudeAiSkills: false`, so no account skills were downloaded into the test home.

The user chose a restricted temporary copy of the existing logins.
The agent's own attempts to inspect and to copy the login files were refused by the session's permission policy. The user then copied `~/.claude-personal/.credentials.json` and `~/.codex-personal/auth.json` into the temporary configuration directories, using `umask 077` and `chmod 600`.
The agent never read or printed either file. Their modification times did not change during the tests, so no host wrote a refreshed token.
Both copies were deleted after the tests, and no process was using them.

Claude Code ran as `claude -p --model haiku --output-format stream-json --verbose --include-hook-events`. It ran in the temporary project with `HOME` and `CLAUDE_CONFIG_DIR` pointing to the temporary home.
The controlling session's Claude environment variables were removed from the child process. Print mode skips the workspace-trust dialog, as `claude --help` documents.
Codex ran as `codex app-server` over standard input and output, with `CODEX_HOME` pointing to the temporary home, `approvalPolicy: never`, and a `read-only` sandbox.
The model reply was never used as the pass condition.
Claude Code results were judged from native `hook_response` events and transcript `hook_additional_context` attachments. Codex results were judged from `hook/completed` runs.

### Codex hook review

The interactive TUI was started with `codex --no-daemon` in a private tmux session. It first asked whether to trust the synthetic project folder; the agent accepted, and the decision was saved in the temporary `CODEX_HOME`.
Codex then reported "2 hooks are new or changed". The agent chose **Review hooks**. It opened each hook, confirmed that the displayed command matched the generated `SessionStart` or `UserPromptSubmit` command exactly, and trusted that hook alone with `t`.
**Trust all** was not used. `--dangerously-bypass-hook-trust` was not used, and no trust hash was written by hand.
`hooks/list` then reported `trust=trusted` and `enabled=true` for both hooks from `<CODEX_HOME>/hooks.json`.
`skills/list` reported `kt-popos-disabled` as `enabled=false`, and `kt-popos-explicit` and `kt-popos-smoke` as enabled.
Codex printed the same temporary-directory helper-alias warning that the Windows run saw.
With `--no-daemon` and the app-server on standard input and output, the `SUN_LEN` socket problem seen on Windows did not arise. The daemon path itself was not tested.

### Results

| Case | Claude Code 2.1.293 | Codex 0.160.1 |
| --- | --- | --- |
| 1. Ordinary request in a new session | `UserPromptSubmit` delivered `kt-popos-smoke` context, recorded as a transcript attachment. Reply named the capability and action. | `userPromptSubmit` completed with one `context` entry for `kt-popos-smoke`. Reply named it. |
| 2. Same request in the same session | Second `UserPromptSubmit` exited 0 with empty output and no attachment. | `userPromptSubmit` completed with no entries. |
| 3. Greeting in a new session | Exit 0, empty output. Reply `Good morning. NONE`. | No entries. Reply `NONE`. |
| 4. Disabled skill request | Exit 0, empty output. `kt-popos-disabled` was set to `"off"` in `skillOverrides`, and the host left it out of `init`. Reply `NONE`. | No entries. The skill was disabled with `[[skills.config]]`, `enabled = false`. Reply `NONE`. |
| 5. Explicit-only skill request | Exit 0, empty output. Reply `NONE`. | No entries. Reply `NONE`. |
| 6. Follow the selected instructions | Context arrived. The model called the native `Skill` tool with `kt-popos-smoke`, and `PostToolUse:Skill` ran. Final reply `KITROUTE_POPOS_SKILL_BODY_7c42`. | Context arrived. The model ran `cat` on the SKILL.md file in the read-only sandbox. Final reply `KITROUTE_POPOS_SKILL_BODY_7c42`. |

Each `SessionStart` with source `startup` completed with no context on both hosts.
For Claude Code, cases 1 and 2 ran as two stream-json messages in one process and one session. A resume would have run `SessionStart` with source `resume`, which is a separate case.

The first Claude Code attempt at case 6 got the guidance and called the `Skill` tool. The model then declined the body's bare "reply with only this token" instruction as a suspicious placeholder and ran one read-only `rg` search. It edited no files.
The body was then changed to state openly that it is a synthetic smoke test. The frontmatter did not change, so routing was unaffected. The second attempt replied with the marker, and the Codex run used the same body.
The prompts, skill descriptions, and routing context never contained the marker. It proves only that the body text affected the reply.

### Native skill use, resume, and compaction

Claude Code's `PostToolUse` event with matcher `Skill` identified `kt-popos-smoke` in the active inventory in three sessions. Kitroute recorded `native-load success` for each.
Codex has no documented skill-loading event. Codex skill use stays unknown, and its reading of SKILL.md was not counted as a load.

| Check | Claude Code | Codex |
| --- | --- | --- |
| Resume | `--resume` ran `SessionStart:resume`, which delivered `kt-popos-smoke` guidance from the saved `reproduce` phase. The unrelated prompt's `UserPromptSubmit` stayed silent. | After `thread/resume`, the first turn's `sessionStart` delivered the same guidance. `userPromptSubmit` stayed silent. |
| Compaction | A manual `/compact` produced a `compact_boundary` (18,886 to 1,265 tokens). `SessionStart:compact` delivered the guidance again. | `thread/compact/start` produced a `contextCompaction` item. The next turn's `sessionStart` delivered the guidance again. `hook/completed` does not report the source; Kitroute emits only for `resume` or `compact`. |

Automatic compaction was not tested.

### Hook durations

Codex reported native `durationMs` values: 105–133 ms across seven `sessionStart` runs, and 113–127 ms across eight `userPromptSubmit` runs.
Claude Code's hook events and debug log report no hook duration. Two extra Claude Code sessions therefore ran with `--setting-sources project,local` and a `--settings` file. Its hooks ran the exact generated command strings inside a wrapper that logged only the event, exit code, and milliseconds.
Measured times were 109 and 147 ms for `SessionStart`, 119 and 173 ms for `UserPromptSubmit`, and 109 ms for `PostToolUse`. Both wrapped sessions also passed cases 1 and 6.
Cases 1–6 used the direct generated commands without the wrapper.
These figures include shell and Node startup. They do not establish a latency guarantee.

### Isolation incident

The first two Claude Code processes, for cases 1–3, loaded MCP configuration from `~/Personal/.mcp.json`, a parent directory of the project.
That connected `hindsight-personal`, which the Kitroute checkout's local settings disable. The claude.ai account connectors also appeared, with status pending or needs-auth.
No MCP tool was called in those runs. All later Claude Code runs used `--strict-mcp-config` and loaded no MCP servers.

### Live history and privacy

`kitroute history` on the live database returned ten records.
Seven records were `selection` with result `unknown`: five from Claude Code sessions and two from Codex threads. No session had more than one, so the repeated prompt, resume, and compaction added no second selection.
The other three records were `native-load success` rows from Claude Code `Skill` events.
No selection named the disabled or explicit-only skills.
The read-only scan found none of the live prompts or the body marker in `usage`, `session_state`, `observed_events`, or `inventory_revisions`. As before, the `capabilities` table held only skill descriptions.

### Not tested

- Plugin skill discovery and live MCP inventory are unchanged gaps, and the adapters were not expanded.
- No comparison with baseline selection was made, and P05 trials were not run.
- A version string does not establish compatibility for a newer host. These results apply to Claude Code 2.1.293 and Codex 0.160.1 only.

## Other findings

Kitroute ignores `CLAUDE_CONFIG_DIR` and `CODEX_HOME`. Setup, detection, and discovery use `~/.claude` and `~/.codex` only.
A synthetic dry run set both variables to other directories. With only those directories present, doctor reported both hosts as not installed.
When `~/.claude` and `~/.codex` also existed, as on this machine, setup planned patches to files that those hosts would not read.
This workstation's profile sets both variables. The handoff wrapper sets each one to the matching home-based path, so the earlier tests could not detect this mismatch.
This affects every platform. It was recorded but not changed in this task.

`tests/integration/setup.test.ts` creates a module-level `kit-setup-*` directory and does not remove it. Each run leaves one inside `.local/tmp/`. All three copies from this run's suite executions were removed.

## Cleanup

Every test home, including the live home, was uninstalled before removal.
In the live home, an unrelated key and a `true # synthetic-user-hook` entry were added to both files. `uninstall --dry-run` then changed no bytes or modification times. `uninstall` removed only the owned entries, kept both user edits, and removed the manifest.
All temporary roots were removed after their exact paths were checked. Both hosts' temporary directories were also removed, because `TMPDIR` placed them inside `.local/tmp/`.
The Codex TUI, its tmux server, and both app-server processes exited. No credential copy remains.

The user's real host files were snapshotted by hash and modification time before testing. These were `~/.claude/settings.json`, `~/.claude-personal/settings.json`, `~/.codex/config.toml`, and `~/.codex-personal/{hooks.json,config.toml}`.
All were unchanged at the end. No default `~/.local/share/kitroute` directory was created.
Raw logs, stream captures, and the generated protocol schema are under `.local/artifacts/popos-2026-10-08/`, which Git ignores. Host transcripts were deleted with the temporary homes.

## Decisions

Pop!_OS compatibility passes for the smoke-test scope after the `skillOverrides` correction. The platform is Pop!_OS 24.04 LTS, x86_64, ext4, with Node 24.21.0. Passing checks:

- build and automated suite
- reversible setup from the checkout and from the installed package
- generated Linux commands under dash and bash, with a project path containing spaces
- live automatic routing with the generated hooks for Claude Code 2.1.293 and Codex 0.160.1, including policy exclusions, repeat suppression, resume, and manual compaction
- normal Codex hook review
- history privacy

M1, M3, and M4 stay in progress. Their exit requirements still include the declared runtime on Windows, and M3 and M4 depend on M1.

Node runtime: Pop!_OS ran exactly the declared baseline, `24.21.0`, with no engine or SQLite warning. The floor `>=24.21.0 <25` stays unchanged.
The runtime requirement remains unresolved overall, because Windows has only been tested on 24.11.0.

## Next actions

1. Decide whether Kitroute should honor `CLAUDE_CONFIG_DIR` and `CODEX_HOME` before any real-home setup on machines that set them.
2. Merge the D25 decision-log entry and the Pop!_OS handoff from the Windows checkout. They were not in this checkout.
3. Run the full suite on Windows with Node 24.21.0.
4. In future live Claude Code runs, pass `--strict-mcp-config` from the start, or run outside directories with a parent `.mcp.json`.
