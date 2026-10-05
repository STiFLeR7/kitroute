# Kitroute documentation

Kitroute helps coding agents select and use relevant installed skills and tools without requiring the developer to name them.

## Reading order

| Document | Purpose |
| --- | --- |
| [01 Product overview](01_product_overview.md) | Problem, user experience, and product boundaries. |
| [02 Research findings](research/02_research_findings.md) | Agent capabilities, competing projects, and primary sources. |
| [03 System architecture](architecture/03_system_architecture.md) | Shared local core, host adapters, and optional MCP interface. |
| [04 Routing lifecycle](architecture/04_routing_lifecycle.md) | Selection, activation, observation, and recovery behavior. |
| [05 Data contracts](architecture/05_data_contracts.md) | Design records and adapter responsibilities to implement. |
| [06 Decision log](architecture/06_decision_log.md) | Selected product decisions and architecture baseline. |
| [07 Agent adapters](integrations/07_agent_adapters.md) | Integration surfaces and host-specific limitations. |
| [08 MVP scope](delivery/08_mvp_scope.md) | First-release scope, delivery stages, and acceptance criteria. |
| [09 Validation plan](delivery/09_validation_plan.md) | Compatibility checks and comparative routing evaluation. |
| [10 Resolved questions](10_open_questions.md) | Closure record for all 14 guided questions. |
| [11 Implementation checklist](delivery/11_implementation_checklist.md) | Engineering and test tasks under the selected policies. |
| [12 Implementation plan](implementation/12_implementation_plan.md) | Six phases, dependencies, commands, constraints, and execution rules. |
| [13 Milestones](implementation/13_milestones.md) | Six milestones with exit evidence and current status. |
| [14 Module map and contracts](implementation/14_module_map_contracts.md) | Planned files, interfaces, and complete synthetic fixtures. |
| [15 Foundation and discovery](implementation/phases/15_phase_01_foundation_discovery.md) | P01 tasks: executable, discovery policies, and host feasibility. |
| [16 Index and routing](implementation/phases/16_phase_02_index_routing.md) | P02 tasks: SQLite scope, ranking, abstention, and guidance. |
| [17 Adapters and evidence](implementation/phases/17_phase_03_adapters_evidence.md) | P03 tasks: automatic hooks, bounded execution, history, and observation. |
| [18 Lifecycle and setup](implementation/phases/18_phase_04_lifecycle_setup.md) | P04 tasks: task changes, deduplication, reversible configuration, and preview package. |
| [19 Evaluation and pilot](implementation/phases/19_phase_05_evaluation_pilot.md) | P05 tasks: repeatable comparisons, release gates, and developer pilot. |
| [20 Community release](implementation/phases/20_phase_06_community_release.md) | P06 tasks: packaging, release documentation, and authorized publication. |
| [21 ADR 001: runtime and package](implementation/adrs/21_adr_001_runtime_package.md) | Compiled TypeScript, initial Node baseline, and single-package distribution. |
| [22 ADR 002: SQLite storage](implementation/adrs/22_adr_002_sqlite_storage.md) | SQLite binding, scoped transactions, and concurrency boundaries. |
| [23 ADR 003: host adapters](implementation/adrs/23_adr_003_host_adapters.md) | Automatic host entry, native permissions, and optional MCP boundary. |
| [24 ADR 004: selection and lifecycle](implementation/adrs/24_adr_004_selection_lifecycle.md) | Bounded lexical selection, abstention, and task-change state. |
| [25 ADR 005: history and privacy](implementation/adrs/25_adr_005_history_privacy.md) | Evidence classification, basic records, and 30-day retention. |
| [26 ADR 006: reversible setup](implementation/adrs/26_adr_006_reversible_setup.md) | Configuration ownership, backup, apply, conflict, and uninstall rules. |
| [27 ADR 007: evaluation and release](implementation/adrs/27_adr_007_evaluation_release.md) | Comparative evidence, pilot, community release, and free local core. |
| [28 Requirement traceability](implementation/28_requirement_traceability.md) | Coverage of all 14 selected choices and architecture requirements. |

## Naming convention

Use `NN_descriptive_name.md`, with a two-digit number, an underscore, and lowercase snake_case. Numbers are unique across the entire `docs/` tree and define reading order; they do not restart within subdirectories. Add the next unused number when adding a document, and update this index. Keep existing filenames stable once referenced.

Subdirectories group related documents: `research/`, `architecture/`, `integrations/`, `delivery/`, and `implementation/`. Phase plans live in `implementation/phases/`. Architecture decision records (ADRs) explain decisions and alternatives in `implementation/adrs/`. Markdown links use relative paths within the repository.

## Document status

The shared local core, host-specific adapters, and optional MCP interface form the architecture baseline. All 14 guided choices are recorded in the decision log. These include TypeScript, execution on demand, SQLite, Windows and Fedora Linux, and a free local core.

The 14-question round is closed. The implementation checklist tracks the broad work. The phase plans define exact tasks and tests. All six milestones remain not started. Design contracts and release targets do not claim completed implementation or tested compatibility.

Research was collected on 5 October 2026. It remains a dated source snapshot. Use the decision log and current design documents for the selected direction.

Update the decision log when implementation choices are made or established choices change. Record tested host versions and evidence before marking an adapter as verified. Keep `10_open_questions.md` as the stable filename for the resolved-question record.
