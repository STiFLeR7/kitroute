# Requirement traceability

Status: coverage map for implementation. Tests and milestone reports are planned evidence, not completed results.

## Selected-policy coverage

| Guided choice | Task coverage | Required evidence | ADR |
| --- | --- | --- | --- |
| Q1: TypeScript | P01.T1 | Strict compilation and compiled executable tests. | [001](adrs/21_adr_001_runtime_package.md) |
| Q2: On-demand execution | P01.T1, P02.T1, P03.T1 | No resident service; fresh-process routing with revised metadata and reused index. | [001](adrs/21_adr_001_runtime_package.md) |
| Q3: SQLite | P02.T1 | Reopen, migration, rollback, scope, and contention tests. | [002](adrs/22_adr_002_sqlite_storage.md) |
| Q4: Agent-first discovery | P01.T2, P01.T3, P02.T2 | Source precedence and unknown disconnected-tool tests. | [003](adrs/23_adr_003_host_adapters.md) |
| Q5: Observed-use evidence | P03.T2, P03.T3 | Guidance/read/statement exclusions and native-event mappings. | [005](adrs/25_adr_005_history_privacy.md) |
| Q6: Windows and Fedora | P01.T3, P04.T3, P06.T1 | Exact-version reports from both target systems. | [001](adrs/21_adr_001_runtime_package.md) |
| Q7: Three-capability maximum | P02.T2, P02.T3 | Combined skill/tool cap and valid abstention tests. | [004](adrs/24_adr_004_selection_lifecycle.md) |
| Q8: Requests and task changes | P04.T1 | Phase transitions, unchanged guidance, resume, and project changes. | [004](adrs/24_adr_004_selection_lifecycle.md) |
| Q9: Basic 30-day history | P03.T2 | Secret-marker exclusions, boundary deletion, and index preservation. | [005](adrs/25_adr_005_history_privacy.md) |
| Q10: Guided setup | P04.T2, P04.T3 | Preview, backup, owned entries, conflicts, and uninstall preservation. | [006](adrs/26_adr_006_reversible_setup.md) |
| Q11: Community then official | P06.T2, P06.T3 | Community release record and later eligibility assessment. | [007](adrs/27_adr_007_evaluation_release.md) |
| Q12: Multiple baselines | P05.T1, P05.T2 | Pinned comparison conditions and actual trial results. | [007](adrs/27_adr_007_evaluation_release.md) |
| Q13: Tests plus pilot | P05.T2, P05.T3 | Frozen gates, held-out comparisons, and real-project feedback. | [007](adrs/27_adr_007_evaluation_release.md) |
| Q14: Free core | P06.T2, P06.T3 | Free local package and paid features excluded from first release. | [007](adrs/27_adr_007_evaluation_release.md) |

## Architecture coverage

| Requirement | Task coverage | Evidence |
| --- | --- | --- |
| Host-specific automatic entry | P01.T3, P03.T1 | Ordinary prompt reaches the routing hook without naming Kitroute. |
| Explicit-only and disabled policy | P01.T2, P02.T2 | Excluded entries never enter implicit selections. |
| Project and profile boundaries | P01.T2, P02.T1, P04.T1 | IDs and inventories respect active scope and host discovery rules. |
| Native permission and trust | P01.T3, P04.T3 | No bypass flags; normal native review remains intact. |
| Graceful routing failure | P03.T1 | Crash, malformed input, and deadline tests return control. |
| Optional MCP interface | Deferred beyond M6 | Same core contracts; no first-release dependency or sibling-server claim. |

## Ownership and status

Task IDs remain stable even when implementation details change. Update this map when a task is split or an ADR is superseded. Link actual milestone reports only after they exist.

The executor must resolve missing coverage before marking a phase complete. The [milestone register](13_milestones.md) records the actual pass/fail state.
