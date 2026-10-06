# Fedora testing handoff for Claude Code

Date: 6 October 2026. Project: Kitroute.

Run the Fedora compatibility tests described here. Use the existing implementation and temporary host homes.
Record actual results, fix confirmed Fedora defects, and leave a clear report for the Windows session.
Do not claim release readiness from these tests alone.

## Current state

Kitroute selects relevant installed skills when a developer sends an ordinary request to Claude Code or Codex.
The shared core uses TypeScript, SQLite, and native host hooks. The package remains a private development preview.
ChatGPT web and desktop chat adapters are outside this task.

The latest reviewed commits are:

- `e2c9f4b`: Adds the PowerShell call operator only for Codex on Windows.
- `f2f1532`: Records the Windows Codex evidence and milestone updates.
- Base branch: `feat/p01-foundation-discovery`.

The user requested a push of this branch after the handoff was written.
Make sure that the Fedora checkout includes these commits and the later workspace storage changes.
Read `AGENTS.md`. Keep all artifacts, caches, temporary homes, and worktrees inside the checkout.

Windows passed all 161 automated tests with no skips on Node `24.11.0`.
Codex CLI `0.157.1` passed six live checks with ChatGPT sign-in and model `gpt-6-luna`.
The live test used normal `/hooks` review. It did not bypass hook trust.
Codex skill-loading observation remains unknown, although the synthetic skill body affected one reply.

Fedora remains untested. The package requires Node `>=24.21.0 <25`, which differs from the Windows test runtime.
The PowerShell regression test requires `pwsh` on Windows. Windows PowerShell `5.1` remains untested.
Do not expand this task into those Windows shell tests.

## Read before testing

Read these files in this checkout:

- `README.md`, `package.json`, and `package-lock.json`.
- `docs/implementation/evidence/34_codex_windows_live_testing.md`.
- `docs/implementation/13_milestones.md`.
- `docs/implementation/adrs/21_adr_001_runtime_package.md`.
- `docs/implementation/phases/15_phase_01_foundation_discovery.md`.
- `docs/implementation/phases/17_phase_03_adapters_evidence.md`.
- `docs/implementation/phases/18_phase_04_lifecycle_setup.md`.

Read applicable `AGENTS.md` or `CLAUDE.md` instructions if they exist on Fedora.
Keep unrelated local edits. Do not reset or replace the checkout.
Use the current branch unless the user asks for another branch.

## Scope and authorization

Run builds, automated tests, temporary package installation, and small live host smoke tests.
Use synthetic prompts and skills. Small live calls can use an existing authenticated account.
Do not run the full P05 comparison trials, recruit the pilot, publish, push, or merge.
Do not apply setup to the user's normal home or change global runtimes without explicit authorization.
Do not remove host trust requirements or change the Node requirement merely to silence npm warnings.

If a defect appears, reproduce it before changing production code.
Add a failing regression test when the defect needs one. Make the smallest supported correction.
Run the relevant tests, then the full suite after a code change.
Do not rerun passing paid model calls unless a relevant change requires them.

## 1. Confirm the checkout and environment

Use a writable Fedora checkout of this repository. Record the filesystem actually tested.
The Windows checkout path is `D:\kitroute`. Find its Linux location instead of assuming a mount path.
Do not reuse Windows `node_modules` or compiled output as Fedora test evidence.
If you copy the checkout, preserve its commits and unrelated edits.

From the repository root, run:

```bash
pwd -P
git status --short
git branch --show-current
git log -5 --oneline
git merge-base --is-ancestor e2c9f4b HEAD
git merge-base --is-ancestor f2f1532 HEAD
cat /etc/fedora-release
uname -srmo
findmnt -T .
node --version
npm --version
command -v node
command -v claude || true
command -v codex || true
```

If either commit is missing, obtain the correct local checkout before testing the fix.
Make sure that the checkout uses the pushed feature branch, rather than assuming that `master` contains the implementation.
Record each command's exit status. Do not hide a failed prerequisite with `|| true`.
The two optional executable searches above only collect availability information.

Record installed host versions with `claude --version` and `codex --version` when available.
The current detection floors are Claude Code `2.1.289` and Codex CLI `0.157.1`.
A newer version needs its own recorded live result. A version string alone does not prove compatibility.

Use Node `24.21.0` for the planned baseline if it is available.
Record another Node 24 version as that version, without claiming that it proves the exact baseline.
If a supported runtime is missing, use an isolated runtime installation or ask before changing the global runtime.
Use official downloads and their checksums for a temporary runtime.
If only Node `24.11.0` is available, record the mismatch and run useful tests without changing `engines`.
Do not mark the declared runtime gate complete from a run below its requirement.

## 2. Run a clean build and the full suite

Run `npm ci` in the Fedora checkout. Do not use `npm install` to rewrite the lockfile.
Make sure that the resolved `dist` directory is inside this checkout before deleting its generated contents.
Remove only that generated directory for the clean rebuild.

```bash
set -o pipefail
npm ci
npm test
```

Capture output and exit statuses under `.local/artifacts/`, which is excluded from Git.
The test runner places temporary files under `.local/tmp/` and the npm cache under `.local/npm-cache/`.
The current suite contains 161 tests. Fedora normally runs 160 and skips the Windows-only PowerShell command test.
Make sure that the skipped test is `Codex Windows command executes quoted paths in PowerShell and preserves hook input`.
Do not install PowerShell on Fedora merely to remove that expected skip.

The package installation test can skip when the npm registry is unreachable.
Record that additional skip as a coverage gap. Resolve the network issue and rerun it when possible.
Do not report complete package coverage while that test remains skipped.
Record actual counts if a correction changes the suite.

Make sure that database, privacy, retention, concurrency, routing, lifecycle, and package tests pass.
Treat SQLite warnings as separate from test failures. Record them with the exact Node version.
After a clean rebuild, make sure that no stale test files remain in `dist/tests`.

## 3. Prepare an isolated home

Keep the controlling Claude Code session's `HOME` unchanged.
Apply test environment variables only to child commands through the function below.
This keeps setup away from the user's real host configuration.

Run this Bash block from the repository root:

```bash
KITROUTE_REPO="$(pwd -P)"
KITROUTE_NODE="$(command -v node)"
mkdir -p "$KITROUTE_REPO/.local/tmp" "$KITROUTE_REPO/.local/artifacts"
KITROUTE_TEST_ROOT="$(mktemp -d "$KITROUTE_REPO/.local/tmp/kt-fedora.XXXXXX")"
KITROUTE_TEST_HOME="$KITROUTE_TEST_ROOT/home"
KITROUTE_TEST_PROJECT="$KITROUTE_TEST_ROOT/project with spaces"
mkdir -p "$KITROUTE_TEST_HOME/.claude" "$KITROUTE_TEST_HOME/.codex"
mkdir -p "$KITROUTE_TEST_PROJECT"

test_env() {
  env HOME="$KITROUTE_TEST_HOME" \
    TEMP="$KITROUTE_REPO/.local/tmp" \
    TMP="$KITROUTE_REPO/.local/tmp" \
    TMPDIR="$KITROUTE_REPO/.local/tmp" \
    npm_config_cache="$KITROUTE_REPO/.local/npm-cache" \
    USERPROFILE="$KITROUTE_TEST_HOME" \
    CODEX_HOME="$KITROUTE_TEST_HOME/.codex" \
    CLAUDE_CONFIG_DIR="$KITROUTE_TEST_HOME/.claude" \
    KITROUTE_HOME="$KITROUTE_TEST_ROOT/data" "$@"
}

kt() {
  test_env "$KITROUTE_NODE" "$KITROUTE_REPO/bin/kitroute.mjs" "$@"
}

printf '%s\n' '{"theme":"synthetic-user-setting","hooks":{}}' \
  > "$KITROUTE_TEST_HOME/.claude/settings.json"
printf '%s\n' '{"description":"synthetic-user-setting","hooks":{}}' \
  > "$KITROUTE_TEST_HOME/.codex/hooks.json"
kt doctor
```

These directories are synthetic. Their presence does not prove that either host executable exists or can authenticate.
If a host is missing, finish the offline checks and report its live tests as blocked.
Do not treat a detection result with an unknown version as live-host evidence.

Keep the test home short to reduce native socket path problems.
For separate host or lifecycle cases, create fresh temporary homes as needed.

## 4. Test preview, apply, repeat, and uninstall

Before preview, save the bytes and modification times of both synthetic host files.
Run `kt setup --dry-run` and inspect its JSON output.
Make sure that preview changes no configuration file and creates no manifest or Kitroute data directory.
Make sure that each target path stays within the temporary home.

Then run:

```bash
kt setup
kt setup --dry-run
```

Make sure that setup reports no conflicts and preserves the synthetic user keys.
Make sure that the second preview returns no patches.
Make sure that Codex registers only `UserPromptSubmit` and `SessionStart`.
Make sure that Claude Code registers those events plus `PostToolUse` and `PostToolUseFailure`, matched to `Skill`.
Inspect the actual generated commands. Linux commands must not contain the Windows `&` prefix.
Execute generated Linux commands with synthetic JSON input, including a project path with spaces.
Do not substitute a hand-written command and claim that generated setup passed.

Leave these entries installed until the live checks finish.
Afterward, add an unrelated user key and a harmless unrelated user hook to each synthetic configuration.
Snapshot the bytes and modification times again, then run:

```bash
kt uninstall --dry-run
kt uninstall
```

Make sure that uninstall preview changes no bytes or modification times.
Make sure that uninstall removes only exact owned entries and preserves later user edits.
Make sure that the ownership manifest disappears when no owned entries remain.
In a fresh case, edit an owned entry and make sure that uninstall reports a conflict and leaves it intact.
The automated suite already covers this behavior. Record the relevant Fedora test result instead of inventing a manual pass.

## 5. Test live entry for both hosts

Test Claude Code and Codex separately with their actual Fedora executables.
Use the temporary home, temporary project, and commands produced by setup.
Consult the installed host's `--help` and official documentation before using version-specific launch flags.
Do not launch the live target inside the Kitroute source checkout.

Use an isolated authenticated login. Reuse an existing login through a restricted temporary copy only when supported.
Do not print credential contents, symlink the real configuration directory, or copy the entire user home.
Use restrictive file permissions for any temporary credentials. Remove them after the test.
If authentication requires the user, finish independent checks and report the exact blocked live step.

For Codex, complete normal `/hooks` review for the exact generated definitions.
Do not use `--dangerously-bypass-hook-trust`, manually write trusted hashes, or disable native review.
If a model is unavailable, choose an available model from the host's native catalog and record its exact ID.
The Windows model ID is context, not a required Fedora model.

Create a project skill for each host using these roots:

- Claude Code: `<test-project>/.claude/skills/kt-fedora-smoke/SKILL.md`.
- Codex: `<test-project>/.agents/skills/kt-fedora-smoke/SKILL.md`.
- Skill metadata: `name: kt-fedora-smoke` and `description: Debug synthetic checkout failure`.

Use valid YAML frontmatter. Put a unique reply marker only in the skill body.
For example, instruct the model to reply `KITROUTE_FEDORA_SKILL_BODY_7c42` and avoid file edits.
Do not include that marker in the model prompt, skill description, or routing context.

Run these cases and record the actual hook events:

| Case | Expected routing behavior |
| --- | --- |
| Ordinary checkout request | Matching guidance reaches the model without an explicit skill name. |
| Same request in the same session | No repeated guidance for the unchanged selection and phase. |
| Unrelated greeting in a fresh session | No selected guidance. |
| Request matching a disabled skill | No selected guidance for that skill. |
| Request matching an explicit-only skill | No selected guidance for that skill. |
| Request to follow selected instructions | Guidance arrives, and the skill-body marker appears if the model follows it. |

Use this ordinary prompt for the first case:

```text
Debug synthetic checkout failure. Reply with the capability name and action from hook guidance, or NONE. Do not read files or call tools.
```

Use this prompt for the skill-body case in a fresh session:

```text
Debug synthetic checkout failure. Follow the selected skill instructions. You can read its SKILL.md. Do not edit files.
```

Use distinct descriptions for disabled and explicit-only fixtures to avoid accidental matches with the ordinary skill.
For Codex, disable a fixture through `[[skills.config]]`, its absolute `SKILL.md` path, and `enabled = false`.
For Codex explicit-only policy, use `policy.allow_implicit_invocation: false` in that skill's `agents/openai.yaml`.
For Claude Code explicit-only policy, use `disable-model-invocation: true` in its skill frontmatter.
Use the installed Claude Code version's documented disable mechanism for the disabled case.
If that mechanism is unavailable, record the gap and retain the offline policy results.

Assert routing against native hook events and delivered context, not against model replies alone.
For Codex app-server tests, inspect `hook/completed` status and context entries for each turn.
Its notifications can use `userPromptSubmit`, while hook payloads use `UserPromptSubmit`.
For Claude Code, record native hook evidence or a minimal instrumented capture around the generated command.
If a wrapper is needed, also test the direct generated command and record the distinction.
Do not store real user prompts or source code in captures.

A skill-body marker proves that the instructions affected that reply. It does not prove a native loading event.
Keep Codex skill use unknown unless a documented native event proves it.
For Claude Code, count native skill use only when the documented `Skill` event identifies the active inventory entry.
Do not infer skill loading from a file read or the model's claim.
Do not claim an improvement over baseline selection from these smoke tests.

If supported, test resume and compaction separately. Record them as unrun when their event path cannot be exercised.
Do not equate a synthetic hook invocation with a live resume or compaction test.
Record plugin skill discovery and MCP inventory gaps without expanding the adapter implementation in this task.

## 6. Inspect history and the installable package

Run `kt history` against the temporary database.
Make sure that ordinary selections remain `event: selection` with `result: unknown` unless stronger evidence exists.
Make sure that an unchanged repeated selection adds no duplicate selection record in the same session.
Inspect `usage` and `session_state` rows for the synthetic prompt and skill body marker. Neither must appear.
Inventory descriptions are separate from basic history. Do not confuse their stored metadata with a prompt leak.

Make sure that the Fedora package tests pass, including local packing and installation into a temporary prefix.
From the installed copy, run doctor, setup preview, setup, uninstall preview, and uninstall in a fresh temporary home.
Make sure that generated commands point to the installed package, not the source checkout.
Make sure that the tarball excludes tests, evidence captures, credentials, databases, and this handoff.
Do not publish the tarball.

## 7. Clean up and record evidence

Stop only the test-owned host sessions, workers, and app-server processes.
Run uninstall in each managed temporary home before removing it.
Remove temporary credential copies, including copies left by a failed probe.
Make sure that no live process still holds those copies.
Before recursive cleanup, resolve the exact temporary path and make sure that it is the directory created for this run.
Do not delete the controlling session's home, the checkout, or another session's files.

Record whether the user's normal host files changed. Do not copy their contents into the report.
Make sure that the repository contains no credentials, databases, tarballs, or raw user transcripts.
Run `git diff --check` and inspect `git status --short`.
Keep the original unpublished commits and any user edits intact.

Write `docs/implementation/evidence/35_fedora_compatibility_testing.md` if `35` remains unused.
Otherwise, use the next unused global document number and update `docs/00_index.md`.
Keep raw synthetic logs under `.local/artifacts/`, outside Git. Add only a reviewed summary and useful sanitized excerpts.

The evidence report must include:

- Fedora release, filesystem, architecture, shell, Node, npm, host versions, model IDs, branch, and commit identity.
- Commands, exit statuses, test counts, each skip reason, and any defect with its regression test.
- Preview immutability, repeated setup, generated command execution, user-edit preservation, and uninstall results.
- Live results for each host and case, trust handling, measured whole hook durations, and observation limits.
- History privacy results, installed-package results, cleanup status, and each unrun or blocked check.
- A separate decision for Fedora compatibility and for the unresolved Node runtime requirement.

Update `README.md` and the milestone register only where this evidence supports a change.
Keep previous Windows reports as historical evidence and link the Fedora follow-up.
Do not mark M1, M3, or M4 complete until all of their exit requirements are satisfied.
M5 still requires comparison trials and the developer pilot. M6 remains outside this task.

Do not lower the Node floor without a supported decision.
If the floor changes with user authorization, update `package.json`, ADR-001, and affected runtime documentation together.
A Fedora pass on Node `24.21.0` still leaves Windows testing on that baseline open.

Leave changes reviewable and uncommitted unless the user explicitly asks for a commit.
Do not push. Finish with a short summary of passing checks, corrections, remaining gaps, and the evidence file path.
