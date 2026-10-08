# Milestones

Status: planned. A milestone is complete only when its evidence is recorded and its tests pass.

## Register

| ID | Milestone | Depends on | Exit evidence | State |
| --- | --- | --- | --- | --- |
| M1 | Integration feasibility | Planning review | Runtime/build tests; synthetic hook round trips; live host entry/discovery report on Windows and Fedora. | In progress: Codex live entry passed on Windows with native hook review. On Pop!_OS, the build and suite pass on the declared Node 24.21.0, and live entry passed for Claude Code 2.1.293 and Codex 0.160.1 with the generated hooks. The declared runtime remains untested on Windows. See [evidence 29](evidence/29_p01_host_feasibility.md), [34](evidence/34_codex_windows_live_testing.md), and [35](evidence/35_popos_compatibility_testing.md). |
| M2 | Local routing | M1 | Database migration/reopen/concurrency tests; eligibility, abstention, scope, ranking, and three-capability tests. | In progress: tests pass on Windows and on Pop!_OS; M1 remains open. See [evidence 30](evidence/30_p02_local_routing.md) and [35](evidence/35_popos_compatibility_testing.md). |
| M3 | Automatic host routing | M2 | Ordinary requests invoke routing; supported hook output; observed-use classification; 30-day privacy and retention tests. | In progress: Claude Code routing and observation pass on Windows; Codex automatic guidance passed a live Windows smoke test. Codex skill-loading observation stays unknown. On Pop!_OS, live routing passed for both hosts, including policy exclusions, repeat suppression, resume, and compaction, and the privacy and retention tests pass. Claude Code routing now honors `skillOverrides`. See [evidence 31](evidence/31_p03_hook_smoke.md), [32](evidence/32_p03_observation_history.md), [34](evidence/34_codex_windows_live_testing.md), and [35](evidence/35_popos_compatibility_testing.md). |
| M4 | Installable preview | M3 | Task-change tests; setup preview/apply/repeat/uninstall tests; manual host smoke tests on both systems. | In progress: automated package and lifecycle tests pass on Windows. Generated Codex hooks passed live setup and uninstall tests in an isolated home. On Pop!_OS, setup preview, apply, repeat, and uninstall pass from the checkout and the installed package, and live smoke tests passed for both hosts after normal Codex hook review. See [evidence 33](evidence/33_p04_installable_preview.md), [34](evidence/34_codex_windows_live_testing.md), and [35](evidence/35_popos_compatibility_testing.md). |
| M5 | Evaluated candidate | M4 | Pinned comparative trials; calibrated release gates; completed developer pilot; documented decision. | In progress: the harness, 28 synthetic cases, gate logic and pilot guide exist. Live comparisons, gates.json, held-out runs and the developer pilot are not done, because they need user authorization for cost and recruitment. |
| M6 | Community release | M5 | Clean installation on both systems; support docs; explicit license; package-name rights; authorized publication and public-package smoke tests. | Not started |

Pop!_OS replaced Fedora as the required Linux target by user decision on 8 October 2026. Where an exit requirement names Fedora or both systems, the Linux system is Pop!_OS. Earlier evidence keeps its original Fedora references.

M6 does not require official directory acceptance. Other Linux distributions and macOS remain outside the first support claim until tested.

## Evidence locations

Future execution creates Markdown reports under docs/implementation/evidence/. Continue the global numbering convention when adding these files. Do not create empty reports or mark a checklist complete before evidence exists.

Store generated machine-readable evaluation results under evaluation/results/, which is excluded from Git by default. Commit only summaries and deliberately reviewed synthetic fixtures. Basic user usage history remains in the local SQLite database.

Every report records:

- Task IDs and commit identity.
- Exact runtime, host, operating system, and model versions.
- Commands run and their actual outcomes.
- Discovery and observation gaps.
- Pass/fail decision and any failed requirement.
- Next task or corrective action.

## Gate behavior

If host entry or native observation differs from the documentation, record the result before advancing. Do not infer missing loading events from file reads. A missing event can leave skill use unknown without invalidating automatic guidance.

If discovery cannot establish a tool's availability, keep it unknown and do not recommend it as callable. If the resulting product lacks a required capability, record a scope failure rather than claiming complete support.

If M5 shows no useful improvement, stop the release sequence and revise the implementation or product focus. Completed code alone does not satisfy the evaluation milestone.
