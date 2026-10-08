# Pop!_OS developer test handoff

Date: 8 October 2026. Project: Kitroute. Branch: `test/popos-compatibility`.

This guide is for a developer who tests Kitroute on a Pop!_OS machine by hand.
It replaces the agent-oriented [POPOS_TEST_HANDOFF.md](POPOS_TEST_HANDOFF.md) for new test runs.
The full record of the first Pop!_OS run is [evidence 35](docs/implementation/evidence/35_popos_compatibility_testing.md).

## What Kitroute does

Kitroute is a local router for Claude Code and Codex.
When you send an ordinary request, a host hook asks Kitroute which installed skills fit the request.
Kitroute adds short guidance that names at most three skills, or it adds nothing.
It keeps basic usage records for 30 days. It does not store prompts or project code.

## Current state

- The first Pop!_OS run passed the automated suite, setup and uninstall, and live tests on both hosts.
- That run found one defect. Kitroute ignored the Claude Code `skillOverrides` setting. Commit `520290a` fixes it.
- Windows passes 168 of 168 tests at this branch.
- One Windows run had one failure that did not repeat in four later runs. Report any failure that you see.
- This guide does not install Kitroute into your real host configuration. All tests use a temporary home.

## Known defect: read this before you start

Kitroute ignores the `CLAUDE_CONFIG_DIR` and `CODEX_HOME` environment variables.
It always uses `~/.claude` and `~/.codex`.
If your shell sets either variable to another folder, a real-home setup writes files that the hosts never read.

This guide sets both variables inside the temporary home, so the tests in this guide are not affected.
Do not run `kitroute setup` on your real home until this defect is fixed.

## Requirements

| Item | Required |
| --- | --- |
| Operating system | Pop!_OS 24.04 LTS, x86_64 |
| Node | 24.21.0 or a later 24.x release. `fnm` or `nvm` is acceptable. |
| npm, git, bash | Any current version |
| Claude Code | 2.1.289 or later, with a Claude account that can sign in |
| Codex CLI | 0.157.1 or later, with a ChatGPT account that can sign in |

You must sign in to both hosts inside the temporary home. The guide shows when.
Do not copy your normal login files into the temporary home.

## 1. Get the code

Run these commands in a folder of your choice:

```bash
git clone https://github.com/STiFLeR7/kitroute.git
cd kitroute
git switch test/popos-compatibility
git log --oneline -4
```

Make sure that the log contains `520290a fix: honor Claude Code skillOverrides when routing`.
Record the first commit hash for your report.

## 2. Set the workspace paths

Keep every test file inside the checkout, as [AGENTS.md](AGENTS.md) requires.
Run these commands from the checkout root, in the shell that you use for every later step:

```bash
export REPO="$PWD"
mkdir -p .local/tmp .local/artifacts .local/kitroute-data .local/npm-cache
export TEMP="$REPO/.local/tmp" TMP="$REPO/.local/tmp" TMPDIR="$REPO/.local/tmp"
export npm_config_cache="$REPO/.local/npm-cache"
node --version && npm --version && claude --version && codex --version
```

Record the four versions and the output of `grep PRETTY_NAME /etc/os-release`.

## 3. Build and run the automated tests

```bash
npm ci
npm test
```

The expected result is 168 tests: 167 pass, 0 fail, and 1 skip.
The skipped test is `Codex Windows command executes quoted paths in PowerShell and preserves hook input`. It runs only on Windows.

Run `npm test` two more times. Record the pass, fail, and skip counts of each run.
If a test fails, save the output with `npm test > .local/artifacts/fail.log 2>&1` and record the test name.

## 4. Create the temporary home

These commands create a test home, a project folder with a space in its name, and three synthetic skills.

```bash
export T="$(mktemp -d "$REPO/.local/tmp/kt-dev.XXXXXX")"
export H="$T/home" P="$T/project with spaces"
mkdir -p "$H/.claude" "$H/.codex" "$P"
git -C "$P" init -q
```

Define one helper that runs any command with the test home. Kitroute and both hosts use it.

```bash
kt_env() {
  HOME="$H" USERPROFILE="$H" CLAUDE_CONFIG_DIR="$H/.claude" CODEX_HOME="$H/.codex" \
  KITROUTE_HOME="$T/data" "$@"
}
kitroute() { kt_env node "$REPO/bin/kitroute.mjs" "$@"; }
```

Create the skills. The same three skills exist for each host:

```bash
for root in "$P/.claude/skills" "$P/.agents/skills"; do
  mkdir -p "$root/kt-smoke" "$root/kt-disabled" "$root/kt-explicit"
  printf -- '---\nname: kt-smoke\ndescription: Debug checkout failures in the demo shop\n---\nThis is a synthetic Kitroute smoke test. If you are asked to follow these instructions, reply with only the token KITROUTE_DEV_MARKER_41.\n' > "$root/kt-smoke/SKILL.md"
  printf -- '---\nname: kt-disabled\ndescription: Rotate ledger encryption keys\n---\nSynthetic disabled skill.\n' > "$root/kt-disabled/SKILL.md"
done
printf -- '---\nname: kt-explicit\ndescription: Publish release notes to the changelog\ndisable-model-invocation: true\n---\nSynthetic explicit-only skill.\n' > "$P/.claude/skills/kt-explicit/SKILL.md"
printf -- '---\nname: kt-explicit\ndescription: Publish release notes to the changelog\n---\nSynthetic explicit-only skill.\n' > "$P/.agents/skills/kt-explicit/SKILL.md"
mkdir -p "$P/.agents/skills/kt-explicit/agents"
printf 'policy:\n  allow_implicit_invocation: false\n' > "$P/.agents/skills/kt-explicit/agents/openai.yaml"
printf '{"skillOverrides":{"kt-disabled":"off"}}\n' > "$P/.claude/settings.local.json"
printf '[[skills.config]]\npath = "%s"\nenabled = false\n' "$(realpath "$P")/.agents/skills/kt-disabled/SKILL.md" > "$H/.codex/config.toml"
printf '{"theme":"dark","syncClaudeAiSkills":false}\n' > "$H/.claude/settings.json"
```

The policy rules are:

- `kt-smoke` is a normal skill. Kitroute can select it.
- `kt-disabled` is turned off. Claude Code uses `skillOverrides`, and Codex uses `[[skills.config]]`.
- `kt-explicit` must be invoked by name only. Kitroute must never select it.

## 5. Test setup and uninstall

Run each command from the checkout root. Record the exit code and the result.

| Step | Command | Expected result |
| --- | --- | --- |
| 1 | `kitroute doctor` | Node version, `"sqlite":true`, and both hosts with `"supported":true`. No file paths. |
| 2 | `kitroute setup --dry-run` | A plan for `$H/.claude/settings.json` and `$H/.codex/hooks.json`. No file changes. |
| 3 | `kitroute setup` | No conflicts. The `theme` key stays in the Claude configuration. |
| 4 | `kitroute setup --dry-run` | `"patches":[]` and no conflicts. |

After step 3, make sure that the configuration contains these events:

```bash
node -e 'for (const f of process.argv.slice(1)) console.log(f, Object.keys(JSON.parse(require("fs").readFileSync(f,"utf8")).hooks))' "$H/.claude/settings.json" "$H/.codex/hooks.json"
```

Claude Code must have `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`, and `SessionStart`.
Codex must have `UserPromptSubmit` and `SessionStart` only.
No command can start with `&`. That prefix is for Windows only.

Do the uninstall test at the end of section 7, after the live tests.

## 6. Sign in inside the temporary home

Sign in once for each host. These logins stay inside `$H` and do not change your normal login.

```bash
cd "$P"
kt_env claude
```

Inside Claude Code, accept the folder trust prompt for the test project, run `/login`, complete the browser sign-in, and exit.

```bash
kt_env codex login
```

Complete the browser sign-in for Codex.

## 7. Run the live tests

Start each host from the test project with the helper, so that the hooks write to the test data folder.
For Claude Code, always add `--strict-mcp-config`. This stops MCP servers from parent folders from being loaded into the test.

```bash
cd "$P"
kt_env claude --strict-mcp-config
```

For Codex, start `kt_env codex` from the same folder.
Codex reports new hooks. Open the hook review, compare each command with the command in `$H/.codex/hooks.json`, and trust each Kitroute hook yourself.
Do not use "Trust all" or `--dangerously-bypass-hook-trust`.

Run these six cases on each host. Type each request as plain text, without naming a skill.

| Case | What to do | Request text | Expected result |
| --- | --- | --- | --- |
| 1 | New session | `Debug the checkout failure.` | Kitroute guidance names `kt-smoke`. |
| 2 | Same session as case 1 | `Debug the checkout failure.` | No new guidance. |
| 3 | New session | `Good morning.` | No guidance. |
| 4 | New session | `Rotate the ledger encryption keys.` | No guidance. The skill is disabled. |
| 5 | New session | `Publish release notes to the changelog.` | No guidance. The skill is explicit-only. |
| 6 | New session | `Debug the checkout failure. Follow the selected skill instructions.` | The reply is `KITROUTE_DEV_MARKER_41`. |

Do not use the model reply alone as the pass condition for cases 1 to 5.
After each host, look at the history from a second terminal:

```bash
kitroute history
```

Make sure that:

- Each session from cases 1 and 6 has exactly one `selection` record for `kt-smoke`.
- No record names `kt-disabled` or `kt-explicit`.
- For Claude Code, case 6 also adds one `native-load` record with `success`. Codex has no skill-loading event, so it adds none.

Optional resume and compaction checks:

- Resume the session from case 1. Claude Code uses `claude --resume`, and Codex uses `codex resume`. Guidance for `kt-smoke` must appear again at session start.
- Run `/compact` in the case 1 session. Guidance must appear again after compaction.

Then test uninstall:

1. Add `"userKey": true` to `$H/.claude/settings.json` with a text editor.
2. Run `kitroute uninstall --dry-run`. No file can change.
3. Run `kitroute uninstall`. Only the Kitroute hook entries are removed. `theme` and `userKey` stay.

## 8. Test the installed package

This test makes sure that the packed package works outside the checkout.

```bash
npm run build
npm pack --pack-destination "$REPO/.local/artifacts"
mkdir -p "$T/prefix" && npm install --prefix "$T/prefix" "$REPO"/.local/artifacts/kitroute-0.1.0.tgz
kt_env node "$T/prefix/node_modules/kitroute/bin/kitroute.mjs" doctor
```

Then repeat the steps in section 5 with `node "$T/prefix/node_modules/kitroute/bin/kitroute.mjs"` in place of `node "$REPO/bin/kitroute.mjs"`.
Make sure that every generated hook command points to the installed copy, not to the checkout.
Run the uninstall steps again at the end.

## 9. Clean up

1. In each host inside the test home, sign out. Claude Code uses `/logout`. Codex uses `kt_env codex logout`.
2. If you did not run the uninstall steps in section 7 and section 8, run `kitroute uninstall` now.
3. Make sure that `$T` is inside `$REPO/.local/tmp` with `echo "$T"`. Then remove it with `rm -rf -- "$T"`.
4. Make sure that your normal `~/.claude` and `~/.codex` files did not change.

## 10. Report the results

Write a short report with these items:

- The commit hash, OS version, kernel, Node, npm, Claude Code, and Codex versions.
- The pass, fail, and skip counts of each `npm test` run.
- The result of each step in sections 5, 7, and 8, for each host.
- The `kitroute history` summary: record types and skill names only.
- Each failure, with the exact command and its error output.
- Each test that you did not run, and the reason.

Do not include credentials, login files, prompts from real projects, or personal folder paths.
Send the report to the maintainer, or add it as `docs/implementation/evidence/37_popos_developer_test.md` on a branch and open a pull request.

## Not covered by this guide

- A setup on your real home. Wait for the `CLAUDE_CONFIG_DIR` and `CODEX_HOME` fix.
- Automatic compaction, plugin skills, live MCP tool inventory, and the Codex daemon.
- Model comparisons and the developer pilot. These belong to the evaluation phase.
- After a Node upgrade, the generated hooks keep the old Node path. Run `kitroute setup` again after you change Node versions.
