# P01.T3 host feasibility evidence

Follow-up, 6 October 2026: [evidence 34](34_codex_windows_live_testing.md) records passing live Codex entry on Windows after a command fix. The earlier results below remain a historical record. Fedora and the declared Node runtime remain unresolved.

Tasks: P01.T3 (host feasibility and normalized input). Base commit: 842abbe (branch feat/p01-foundation-discovery); adapters committed in the commit that adds this file.

## Environment
- node v24.11.0 (repo engines field asks >=24.21.0 <25; tests still pass)
- Claude Code 2.1.289
- codex-cli 0.157.1
- Windows: Microsoft Windows [Version 10.0.26200.9550] (`cmd /c ver`)
- Model IDs: the Claude Code run used the host default model (the `init` event reports a `model` field; value not recorded). Codex configured model was rejected (see below).
- Fedora/Linux: NOT AVAILABLE. No Fedora or Linux result is claimed.
- Claude model ID for live runs: not recorded (gap; re-record on the next live run).

## Method and safety
All runs used a mkdtemp directory outside the repo, a temp `--settings` file for Claude, and only synthetic prompts. Nothing under ~/.claude, ~/.codex or ~/.agents was edited; no credentials copied; no permission, sandbox or hook-trust bypass flag was used. Temp dir deleted afterwards. Note: the user's real Claude user-level hooks still ran alongside the temp settings (settings are additive), and the Claude run inherited permission_mode `auto` from user config.

Docs consulted: https://code.claude.com/docs/en/hooks and https://learn.chatgpt.com/docs/hooks. The Claude docs fetch summary listed the prompt field as `user_prompt`; the observed payload uses `prompt` (observed wins).

## Claude Code (Windows)
Run 1: `claude -p --settings <tmp>/settings.json "Reply with only the KITROUTE marker string from your context, or NONE."`, cwd = temp dir. UserPromptSubmit command hook (`node "<tmp>/hook.mjs"`, forward-slash path) wrote stdin to a file and printed `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"KITROUTE-MARKER-7f3a"}}`.
- Result: model replied `KITROUTE-MARKER-7f3a`. PASS: additionalContext reached the model on an ordinary prompt.
- Stdin payload fields (all string): session_id, transcript_path, cwd, prompt_id, permission_mode, hook_event_name, prompt. There is no `turn_id`; `prompt_id` (UUID) is the per-prompt id and the adapter maps it to turnId.
- Windows paths: cwd and transcript_path use backslash drive paths (`<drive>:\Users\<home-user>\AppData\Local\Temp\tmp.<rand>`, transcript under `<home>\.claude\projects\<munged-cwd>\<session-uuid>.jsonl`). The 8.3/POSIX form was not used. Hook command path worked with forward slashes.
- Warning seen with `-p` and no stdin redirect: "no stdin data received in 3s"; later runs used `< /dev/null`.

Run 2: same plus `--output-format stream-json --verbose`. Result again the marker. The `system/init` event exposes: tools (array, 438 entries), mcp_servers (8 entries; keys name, status, source; statuses observed: connected, needs-auth, pending), slash_commands (169), skills (124), agents (328), plugins (17), plugins/capabilities arrays, model, permissionMode, cwd, session_id, claude_code_version. Also hook_started/hook_progress/hook_response system events (keys include hook_event, stdout, exit_code, outcome). This is the supported native inventory interface. Gaps: counts reflect the user's real environment and a `pending` mcp status is a point-in-time snapshot, not proof of connectivity; whether skill entries distinguish explicit-only vs implicit was not inspected. Init is only available in stream-json (non-hook) mode; hooks themselves do not get an inventory.

Run 3 (skill loading): temp project skill `.claude/skills/kt-synthetic/SKILL.md` and temp PreToolUse/PostToolUse hooks with matcher `Skill`. Prompt asked the model to invoke the skill. Observed PreToolUse and PostToolUse both fired with tool_name `Skill`, tool_input `{"skill":"kt-synthetic"}`, plus tool_use_id; PostToolUse adds tool_response and duration_ms. The skill body was delivered (model replied with the synthetic body text). So PreToolUse/PostToolUse on the Skill tool are observed signals of a native skill invocation on Claude Code (after a model-initiated tool call). InstructionsLoaded and file reads are not treated as proof.

## Codex (Windows): BLOCKED
Docs: hooks are enabled by default (`[features] hooks`); hook sources are ~/.codex/hooks.json, ~/.codex/config.toml, <repo>/.codex/hooks.json, <repo>/.codex/config.toml; project-local hooks run only if the layer is trusted; non-managed hooks require review/trust via `/hooks` (trust recorded per hook hash). UserPromptSubmit stdin per docs: session_id, turn_id, prompt, cwd, hook_event_name, permission_mode. Output per docs: `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"..."}}` (or plain stdout). PreToolUse/PostToolUse cover Bash, apply_patch, MCP and most local function tools, not hosted tools like WebSearch.

Attempt: `codex exec --skip-git-repo-check -s read-only -c 'hooks.UserPromptSubmit=[{hooks=[{type="command",command="node \"<tmp>/hook.mjs\""}]}]' "<synthetic prompt>"` in a temp dir.
- Outcome: the capture file was NOT written, i.e. the hook did not fire (verified; the only capture present was Claude's). No trust prompt was possible in non-interactive exec. `codex exec --help` lists `--dangerously-bypass-hook-trust`, which was NOT used (forbidden). Likely cause: the inline hook is a non-managed hook that needs persisted trust, which requires interactive `/hooks` review stored in ~/.codex; this was not proven as the cause.
- Independent failure: the user's configured model was rejected: `The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account.` (HTTP 400), so no turn completed anyway. Overriding the model was not attempted since trust remains unresolved.
- Also observed: warning `failed to parse hooks config ~/.codex/hooks.json: unknown field SessionStart, expected description or hooks` (user's existing file; untouched).
- Marker delivery, native inventory interface and tool/skill observation events for Codex: NOT TESTED = unknown. Codex payload/output shapes in the adapter come from docs only.

## Observation events summary
| Host | Event | Status |
|---|---|---|
| Claude Code | PreToolUse/PostToolUse matcher Skill | observed (Run 3) |
| Claude Code | PreToolUse/PostToolUse for other tools | documented, not observed |
| Claude Code | InstructionsLoaded / file reads | not skill-loading proof |
| Codex | PreToolUse/PostToolUse (Bash, apply_patch, MCP, local tools) | documented only; skill-load signal unknown |

## Pass/fail per requirement
| Requirement | Result |
|---|---|
| Windows Claude entry (hook + additionalContext reaches model) | PASS |
| Windows Claude native inventory (init event) | PASS (tools, mcp_servers+status, skills, slash_commands, agents, plugins) |
| Windows Claude skill-load observation | PASS (Skill tool Pre/PostToolUse) |
| Windows Codex entry | BLOCKED (hook did not fire non-interactively; trust review needed; model rejected) |
| Fedora Claude | NOT RUN |
| Fedora Codex | NOT RUN |
| Adapter unit tests | PASS (npm test, 35 tests) |

## Discovery and observation gaps
- Codex active inventory interface unknown; fall back to skill roots (discoverSkills).
- Adapter `observe` returns null for both hosts (native observation is P03).
- MCP connectivity must come from the init `mcp_servers.status` only, never configuration.

## Next corrective action
Run the Codex test interactively on a machine where the maintainer may review hook trust via `/hooks` (or from a disposable CODEX_HOME with its own supported login), using a model the account supports. Repeat all Claude and Codex runs on Fedora.
