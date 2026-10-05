# Milestones

Status: planned. A milestone is complete only when its evidence is recorded and its tests pass.

## Register

| ID | Milestone | Depends on | Exit evidence | State |
| --- | --- | --- | --- | --- |
| M1 | Integration feasibility | Planning review | Runtime/build tests; synthetic hook round trips; live host entry/discovery report on Windows and Fedora. | In progress, blocked: Codex live entry (hook trust review) and all Fedora runs; see [evidence 29](evidence/29_p01_host_feasibility.md). |
| M2 | Local routing | M1 | Database migration/reopen/concurrency tests; eligibility, abstention, scope, ranking, and three-capability tests. | Not started |
| M3 | Automatic host routing | M2 | Ordinary requests invoke routing; supported hook output; observed-use classification; 30-day privacy and retention tests. | Not started |
| M4 | Installable preview | M3 | Task-change tests; setup preview/apply/repeat/uninstall tests; manual host smoke tests on both systems. | Not started |
| M5 | Evaluated candidate | M4 | Pinned comparative trials; calibrated release gates; completed developer pilot; documented decision. | Not started |
| M6 | Community release | M5 | Clean installation on both systems; support docs; explicit license; package-name rights; authorized publication and public-package smoke tests. | Not started |

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
