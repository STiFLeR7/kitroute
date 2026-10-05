# P03.T1 hook smoke evidence

## Environment
- node v24.11.0; Claude Code 2.1.289; Windows 11 (10.0.26200). Model ID not recorded (host default).
- Settings `env` entry used to set KITROUTE_HOME to a temp dir (supported by Claude Code settings).
- Real user skills under <home>/.claude/skills may have been read by discovery (read-only); names not recorded.

## Commands
Temp project (mkdtemp) with `.claude/skills/kt-checkout-debug/SKILL.md` (description "Debug synthetic checkout failures"); temp settings JSON with a UserPromptSubmit command hook `node "<repo>/bin/kitroute.mjs" hook --host claude-code --event UserPromptSubmit`. Runs: `claude -p --settings <tmp>/s.json "<prompt>" < /dev/null`, cwd = temp project.

## Outcomes (3 runs)
1. "Which skill guidance, if any, is in your context? Reply with only its capability name or NONE." replied `ponytail, superpowers:using-superpowers` (those come from the user's installed plugins, not Kitroute). The prompt shares no terms with the synthetic skill, so Kitroute abstaining is the expected result; no kt-checkout-debug.
2. "say hello" replied a greeting; no Kitroute guidance appeared. Not a clean NONE reply (the model did not follow the reply format), so the abstain is inferred from absence only.
3. "Debug the synthetic checkout failure. <same question>" replied `kt-checkout-debug`. PASS: guidance reached the model through the compiled worker. kitroute.db was created in the temp KITROUTE_HOME.

## Gaps
- Run 1 and 2 do not give a clean NONE reply (user plugins add context and the model ignored the format).
- Windows only; the junction path-with-spaces test is automated in tests/integration/hook.test.ts.
- The worker writes no history yet; cached tool availability stays unknown.

Codex live entry: deferred by user; Fedora: not run
