# Decision log

Recorded: 5 October 2026.

All 14 guided product questions are resolved. Established entries record the selected choices. Architecture baseline entries record the design used to plan implementation. Neither status claims completed code or tested compatibility.

| ID | Status | Decision | Reason |
| --- | --- | --- | --- |
| D01 | Established | Name the project Kitroute. | Selected during project setup. |
| D02 | Established | Focus on utilization of existing installed skills and tools. | The core problem is repeated manual prompting and missed activation. |
| D03 | Established | Use a shared local routing core with host-specific adapters. | Agent lifecycle and loading APIs differ; selection logic can be shared. |
| D04 | Established | Make hooks/extensions the automatic entry point; MCP is an optional interface. | Exposing a router tool alone does not guarantee its invocation. |
| D05 | Established | Preserve native restrictions and distinguish checking, activation, and useful outcomes. | Routing is not authorization or proof of task success. |
| D06 | Architecture baseline | Begin the MVP with Claude Code and Codex. | They match the initial audience and the documented first implementation scope. |
| D07 | Architecture baseline | Start with lexical retrieval and bounded context output. | A simple baseline makes later complexity measurable. |
| D08 | Architecture baseline | Route connected MCP tools without becoming a general MCP gateway. | Connection management and execution would significantly expand the initial scope. |
| D09 | Established | Reconsider selection on each user request and clear task changes; avoid repeated guidance when selection is unchanged. | Selected by the user in question 8 of 14. New evidence and changes such as debugging to testing trigger reconsideration where the adapter can observe them. |
| D10 | Architecture baseline | Continue the host task if routing fails. | Routing failure must not stall ordinary development. |
| D11 | Established | Use globally unique `NN_name.md` filenames under `docs/`. | Requested documentation nomenclature, with an index for reading order. |
| D12 | Established | Use TypeScript for the shared core and adapter code where supported. | Selected by the user in question 1 of 14. Pin the execution runtime during implementation. |
| D13 | Established | Start Kitroute when needed for each routing request and reuse a saved local index. | Selected by the user in question 2 of 14. The initial release does not require a background service. |
| D14 | Established | Use SQLite for the local capability index and usage records. | Selected by the user in question 3 of 14. Select the TypeScript database library during implementation. |
| D15 | Established | Discover capabilities from supported agent information first, with skill and configuration files as a fallback. Keep unknown availability explicit. | Selected by the user in question 4 of 14. Each adapter's discovery coverage requires testing. |
| D16 | Established | Report capability use only from observed native loading or tool calls. Keep suggestions, file reads, and agent statements separate; report unobservable use as unknown. | Selected by the user in question 5 of 14. Observed use does not prove correct procedure or task success. |
| D17 | Established | Target Windows and Fedora Linux together for the first release, with exact tested agent versions published. | Selected by the user in question 6 of 14. The user has Fedora in a dual-boot setup. Other Linux distributions and macOS require separate compatibility evidence. |
| D18 | Established | Select at most three capabilities per routing decision, with short guidance and permission to select fewer or none. | Selected by the user in question 7 of 14. Skills and tools share this limit. Measure the numerical context budget during implementation. |
| D19 | Established | Keep basic usage records locally for 30 days. Record selected capability names, observed use, result status, and timing; exclude user prompts and project code by default. | Selected by the user in question 9 of 14. Retention applies to usage history, not the reusable capability index. |
| D20 | Established | Provide one guided setup command that detects supported agents, shows planned changes, backs up affected settings, and adds Kitroute. Uninstall removes only Kitroute-owned entries. | Selected by the user in question 10 of 14. Preserve unrelated configuration and changes made after installation. |
| D21 | Established | Launch through a public community repository and installable package first, then seek official directory listings when eligible. | Selected by the user in question 11 of 14 as A followed by B. Official acceptance is not a prerequisite for the community release. |
| D22 | Established | Compare Kitroute against native defaults, improved skill descriptions, and relevant existing routers. | Selected by the user in question 12 of 14. Manual capability naming remains a reference condition, not the sole baseline. |
| D23 | Established | Require repeatable comparative tests and a small developer pilot before the first release. | Selected by the user in question 13 of 14. Measure task success and overhead, then collect real-project feedback. Define thresholds and pilot size during evaluation setup. |
| D24 | Established | Keep local routing free and consider paid extras after developers see value. | Selected by the user in question 14 of 14. Shared team settings and cross-device synchronization are candidates, not promised features. |

## Alternatives considered

| Alternative | Current disposition |
| --- | --- |
| MCP-only router | Useful optional access path, insufficient by itself for automatic per-turn checks. |
| Registry-first product | Deferred; discovery does not directly solve utilization of installed capabilities. |
| Inject every skill into each turn | Rejected as the default; conflicts with bounded context and relevant selection. |
| Separate routing engine per host | Avoid duplication; keep differences in adapters unless evidence requires otherwise. |
| Model-based routing on every request | Deferred pending evidence that it beats a simpler baseline at acceptable overhead. |
| Full MCP gateway | Deferred pending a demonstrated need for centralized execution or tool exposure. |

## Engineering follow-through

All 14 guided choices are recorded. The question round is closed. The [implementation checklist](../delivery/11_implementation_checklist.md) tracks engineering details and test evidence under these choices.

Implementation work includes runtime and library selection, concrete schemas, configuration merges, retention cleanup, and measured routing limits. Tests establish exact supported versions and release evidence. These tasks do not reopen the selected product policies.

The documentation does not imply that implementation exists. Record engineering choices and evidence as implementation progresses. Preserve superseded entries with their replacement when the design changes.

The [implementation plan](../implementation/12_implementation_plan.md) now defines six phases and milestones. Its seven architecture decision records explain engineering choices and alternatives. Node.js 24.21.0 and node:sqlite are initial engineering choices, subject to runtime and storage tests. They are not additional user-selected product policies. The [coverage map](../implementation/28_requirement_traceability.md) links every guided choice to implementation tasks.

See the [architecture](03_system_architecture.md), [MVP scope](../delivery/08_mvp_scope.md), and [resolved questions](../10_open_questions.md).
