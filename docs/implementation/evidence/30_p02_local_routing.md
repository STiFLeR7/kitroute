# P02 local routing evidence

Tasks: P02.T0 (Codex per-skill disable, added by controller ruling), P02.T1, P02.T2, P02.T3. Branch feat/p01-foundation-discovery. Commits 19a34d9 (T1), 9d684d3 (T2), 61092c5 and 4fd7b2d (T0), 53f72cf and 1cf9230 (T3).

## Environment
- Windows 11 Home 10.0.26200, node v24.11.0, npm 11.6.1. This is below the planned 24.21.0 baseline, which remains untested.
- node:sqlite loads and prints an ExperimentalWarning on stderr.
- Fedora: NOT RUN. This report makes no Linux claim.

## Commands and outcomes
- `rm -rf dist && npm test`: 86 tests, 86 pass, 0 fail.
- `npx tsc --noEmit -p .`: passes.
- Manual smoke test with KITROUTE_HOME, HOME and USERPROFILE pointing to a temporary directory, and two synthetic Codex project skills:
  - `index` returns `{"command":"index","host":"codex","count":2}`.
  - The request "debug the checkout error" first selected both skills, because the function word "the" gave the unrelated skill a score of 0.25. Commit 1cf9230 fixed this. The request now selects only the matching skill.
  - The request "thanks looks good" returns abstain with WEAK_MATCH.
  - Five warm route process runs took 134–161 ms wall clock each. This includes Node startup. It is not a performance claim.
- Writer contention, from the T1 test: a second writer process received STORE_BUSY 146–165 ms after starting, while the first process held a 300 ms write transaction. The busy timeout is 100 ms and the timing includes process startup. The second writer's transaction rolled back.

## M2 requirement coverage (Windows only)
| Requirement | Test location | Result |
| --- | --- | --- |
| Migration, reopen and rollback | tests/integration/storage.test.ts | PASS |
| Competing writers | tests/integration/concurrency.test.ts | PASS |
| Scope isolation (project, profile, host) | storage.test.ts, routing.test.ts, route-cli.test.ts | PASS |
| Eligibility (explicit-only, disabled, unknown policy, unknown tools) | routing.test.ts, codex-config.test.ts, route-cli.test.ts | PASS |
| Abstention | routing.test.ts, route-cli.test.ts | PASS |
| Cap of three, plus the guidance budget | routing.test.ts, guidance.test.ts, route-cli.test.ts | PASS |
| Persistence and revision reuse | refresh.test.ts, route-cli.test.ts | PASS |
| Request text kept out of output and errors | route-cli.test.ts | PASS |

## Gaps
- Fedora and the Node 24.21.0 baseline have not been run.
- minScore 0.2, the function-word list and the 2,000-character cap are starting settings, not calibrated values. P05 calibrates them.
- Tool availability in the CLI path is always unknown, because no current host evidence reaches it. Tools become selectable only once P03 supplies native inventory.
- Unless overridden, the route command uses the profile identity `default`.

## Decision
The M2 tests pass on Windows. M2 is not marked complete, because the target-platform requirement includes Fedora, and M1 remains open by user deferral.
