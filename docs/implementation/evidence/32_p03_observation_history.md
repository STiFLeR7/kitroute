# P03 observation and history evidence

Tasks: P03.T1, P03.T2, P03.T3. Branch feat/p01-foundation-discovery. Commits 861a199, b7469d7 (T1); bc4a5a2 (T2); f16aa01, 59fc703 (T3).

Follow-up, 8 October 2026: [evidence 35](35_popos_compatibility_testing.md) records Pop!_OS results. Pop!_OS replaced Fedora as the required Linux target. The Fedora references below remain a historical record.

## Environment
- Windows 11 Home 10.0.26200, node v24.11.0, Claude Code 2.1.289. The model ID used for live runs was not recorded.
- Codex live entry was deferred by the user. Fedora was not run.

## Automated checks
- `rm -rf dist && npm test`: 111 tests, 111 pass, 0 fail.
- Covered by tests:
  - Hook failure recovery: invalid JSON, crash, deadline expiry, and oversized input or output.
  - Rejection of invalid hook output.
  - A path containing spaces, through a directory junction.
  - Allowlisted history, with secret markers in prompt, code, tool input, tool response and error text.
  - 30-day retention with a fixed clock. The boundary row is kept, inventory is untouched, and observed_events are pruned.
  - Observation classification: guidance and file reads are not use, and a failed call still counts as a call.
  - Active-scope matching, and deduplication by host tool_use_id.
  - The dedupe row and the usage row commit in one transaction.

## Live run (Windows, Claude Code, temporary --settings only)
Setup: a temporary project with the synthetic skill kt-checkout-debug, and a temporary KITROUTE_HOME set through the settings `env` entry. The UserPromptSubmit hook and a PostToolUse hook (matcher `Skill`) both call `kitroute hook`.
- Prompt: "Debug the synthetic checkout failure. If a skill is suggested in your context, invoke it with the Skill tool, then reply with exactly what it says." The model replied with the skill body marker.
- `kitroute history` showed `native-load success kt-checkout-debug claude-code` and no selection record.
- Diagnosis: `kitroute route` with the same text returned abstain WEAK_MATCH. Three query terms matched out of about 17, below minScore 0.2, because "failure" does not match "failures". The model loaded the skill through native Claude skill matching. History correctly records a native load without a Kitroute selection.
- The same hook run with a shorter synthetic prompt ("Debug the synthetic checkout failure.") returned valid additionalContext and wrote a `selection` record.
- The P03.T1 smoke run (evidence 31) showed routed guidance reaching the model.

## Findings
- Lexical scoring divides matches by the number of query words, so long prompts dilute it. Singular and plural forms do not match. This goes to P05 calibration, alongside minScore and the function-word list.
- Observation reaches history only when the host registers PostToolUse and PostToolUseFailure hooks. P04 setup must register them.
- Events without a host event ID are not deduplicated, and that limit is documented. Codex PostToolUse has no success field, so its result is recorded as unknown. A Codex skill load cannot be observed.
- The node:sqlite ExperimentalWarning is confined to the worker's drained stderr. The hook parent's stdout and stderr stay clean.

## Decision
M3 is NOT complete. Automatic routing is shown for Claude Code on Windows only. Codex live entry is deferred and Fedora has not been run.
