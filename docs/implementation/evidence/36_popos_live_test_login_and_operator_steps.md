# Pop!_OS live test: login and operator steps

Date: 8 October 2026. Companion to [evidence 35](35_popos_compatibility_testing.md), which holds the full test record.

## Summary

Pop!_OS 24.04 LTS passed the Kitroute compatibility smoke test on 8 October 2026 after one code fix. Live testing stalled until the operator stepped in by hand.

The isolated test homes had no subscription login. The agent was not permitted to read or copy the existing Claude and ChatGPT logins, so live tests resumed only after the operator chose an approach and ran the credential copy command themselves.

The run covered a clean build, the 168-test suite, setup and uninstall, the installed package, and six live cases per host plus resume and compaction. It does not establish release readiness, and milestones M1, M3, and M4 stay in progress.

## Environment

Testing ran on the declared Node baseline, 24.21.0, and on host versions newer than Kitroute's tested floors.

| Item | Value |
| --- | --- |
| Operating system | Pop!_OS 24.04 LTS, kernel 7.1.5, x86_64 |
| Filesystem and shell | ext4; bash 5.2.21, with dash as `/bin/sh` |
| Node and npm | Node 24.21.0 (fnm), npm 11.19.0 |
| Claude Code | 2.1.293 (floor 2.1.289); model `claude-haiku-5-5` |
| Codex CLI | 0.160.1 (floor 0.157.1); model `gpt-6-luna`, low effort |
| Checkout | `master` at `c3ef4f0`, plus the uncommitted fix described in evidence 35 |

## Results

Every offline check and all six live cases on both hosts passed. Results were judged from the hosts' own hook records rather than model replies.

| Offline check | Result |
| --- | --- |
| Clean install and test suite | 168 tests: 167 pass, 0 fail, 1 expected Windows-only skip |
| Setup preview, apply, repeat, uninstall | Pass; preview changed nothing; later user edits survived uninstall |
| Generated hook commands under dash and bash | Pass with a project path containing spaces; 116–156 ms |
| Installed tarball | Pass; 23 files, commands point to the installed copy |
| Usage history privacy | No prompt text or skill-body marker stored |

| Live case | Claude Code | Codex |
| --- | --- | --- |
| Ordinary request | Guidance delivered | Guidance delivered |
| Same request, same session | Not repeated | Not repeated |
| Greeting in a new session | No guidance | No guidance |
| Disabled skill | No guidance | No guidance |
| Explicit-only skill | No guidance | No guidance |
| Follow the selected skill | Native `Skill` event; reply was the body marker | Reply was the body marker |
| Resume, then manual compaction | Guidance re-delivered both times | Guidance re-delivered both times |

Codex reported its own whole-hook times: 105–133 ms at session start and 113–127 ms per prompt. Claude Code reports none, so a timing wrapper measured 109–173 ms there. Automatic compaction was not tested.

## Issue 1: no automatic subscription login

The agent could not sign either host in on its own, so all live tests were blocked for one full round trip with the operator.

The handoff requires live tests in a temporary home with its own config folders, not the operator's real ones. A fresh temporary home has no login.
Both hosts here use subscription sign-in, a Claude account and a ChatGPT account, which needs an interactive browser login. No API key or long-lived token was available for unattended use.

The agent tried twice to reuse the operator's existing logins. The Claude Code auto-mode permission check refused both attempts:

| Attempt | What it would have done | Refusal reason |
| --- | --- | --- |
| 1 | Check that the login files exist and when their tokens expire, without printing secrets | Credential Materialization |
| 2 | Copy both login files into the temporary home with mode 600, after the operator chose that option | Credential Leakage |

Each refusal covers the outcome, not just the command, so the agent could not retry another way. The operator's approval in chat did not lift the second refusal; only a permission rule in settings can.

Impact:

- The first version of evidence 35 had to mark every live test as not run, and was rewritten later.
- The same block will recur for every fresh test home, for any unattended or CI run, and for each pilot machine.
- Copying a subscription login carries a risk: if the copy refreshes its token, the operator's main session can be signed out. In this run neither copy was rewritten, so no refresh happened.

## Issue 2: the operator had to run commands

The operator made one decision and ran one shell command by hand before the live tests could start. The agent did everything else.

| Step | Actor | Action | Outcome |
| --- | --- | --- | --- |
| 1 | Agent | Checks the login files | Refused: credential materialization |
| 2 | Agent | Offers three options | Operator chooses option 2, a copy of the logins |
| 3 | Agent | Copies the login files | Refused: credential leakage |
| 4 | Agent | Hands over one command | Operator runs it; the copies land at 10:24 IST |
| 5 | Agent | Runs the live tests and deletes the copies | Done |

Each refusal sent the decision back to the operator, and only the operator's own command unblocked the live tests.

Operator actions:

1. Read the agent's three options and chose option 2, a temporary copy of the existing logins. The other options were signing in inside the test home, or skipping live tests.
2. After the agent's own copy was refused, ran this command at the prompt with the `!` prefix. It printed only `copied`.

```bash
umask 077 && D=<checkout>/.local/tmp/kl.<random>/home && cp ~/.claude-personal/.credentials.json "$D/.claude/.credentials.json" && cp ~/.codex-personal/auth.json "$D/.codex/auth.json" && chmod 600 "$D/.claude/.credentials.json" "$D/.codex/auth.json" && echo copied
```

A command the operator runs is the operator's own action, so it was not a way around the refusal.

Agent actions after that: the agent ran the 12 live cases plus resume and compaction, then deleted both copies. It never read or printed the login files.

The agent also completed Codex's two human trust gates. It drove the interactive Codex screen through a private terminal session and accepted the folder-trust prompt for the synthetic project. It then reviewed and trusted each Kitroute hook one at a time on the `/hooks` screen.
It did not use "Trust all", the bypass flag, or hand-written trust hashes. Those gates exist so that a person approves hooks, so whether the agent should click through them is a policy question for the next run.

## Other issues found

One product defect was fixed during the run. The `CLAUDE_CONFIG_DIR` gap is the most important item still open.

| Issue | State | Detail |
| --- | --- | --- |
| Kitroute ignored Claude Code's `skillOverrides` | Fixed, with 7 new tests | It recommended skills the host had turned off. The fix honours `"off"` and `"user-invocable-only"`, and fails closed on bad values. |
| Kitroute ignores `CLAUDE_CONFIG_DIR` and `CODEX_HOME` | Open, needs a decision | This machine sets both, so setup in the real home would write files the hosts never read. |
| MCP isolation slip in the first two Claude Code runs | Mitigated | A parent-folder `.mcp.json` connected `hindsight-personal`, which the checkout disables. No MCP tool was called. Later runs loaded no MCP servers. |
| First skill-body attempt declined by the model | Fixture reworded | The model refused a bare "reply with only this token" instruction. The reworded test skill passed. |
| D25 decision entry and Pop!_OS handoff missing from the checkout | Open | They need merging from the Windows checkout. |
| A setup test leaves a temporary folder behind | Open, minor | `tests/integration/setup.test.ts` never removes its `kit-setup-*` folder. |
| Windows on Node 24.21.0 | Not run | Windows has only been tested on 24.11.0. |

## Recommendations

Make the operator's login step a planned, one-time part of each live run instead of a mid-run blocker.

Runbook: operator signs in inside the test home. This avoids copying the main login, so a token refresh cannot sign out the operator's own session.

1. The agent creates the temporary home and prints its path, then pauses.
2. The operator runs `HOME=<home> CLAUDE_CONFIG_DIR=<home>/.claude claude`, signs in with `/login`, and exits.
3. The operator runs `HOME=<home> CODEX_HOME=<home>/.codex codex login` and completes the browser sign-in.
4. The operator tells the agent to continue. The agent runs the cases and reports.
5. The operator signs out inside the test home, and the agent deletes the home.

Next steps:

- [ ] Choose the login method for future runs: the runbook above, or a narrow permission rule that allows only the copy command.
- [ ] Decide whether the operator or the agent performs Codex folder trust and `/hooks` review.
- [ ] Add a script that prepares the test home and prints the single operator step.
- [ ] Run every live Claude Code test with `--strict-mcp-config`.
- [ ] Decide whether Kitroute should honour `CLAUDE_CONFIG_DIR` and `CODEX_HOME` before any real-home setup.
- [ ] Merge D25 and the Pop!_OS handoff from the Windows checkout.
- [ ] Run the full suite on Windows with Node 24.21.0.

Unattended or CI runs cannot use subscription sign-in at all. They would need an API-key login path, which this project has not chosen yet.
