# MVP scope

Status: first-release plan aligned with the completed product decisions. This document defines expected outcomes, not a calendar estimate or completed implementation.

## Release goal

Demonstrate automatic, useful selection of installed skills and available MCP tools on Claude Code and Codex, with minimal setup and observable behavior. Exact support levels depend on the adapter spike.

The first release targets Windows and Fedora Linux together. The user's dual-boot setup provides both test environments. Publish exact tested agent versions and Fedora versions. Support for other Linux distributions or macOS requires separate testing.

## Initial features

- Automatic routing on ordinary user requests through a host adapter.
- Inventory of eligible installed skills and available MCP tool metadata, with discovery coverage reported.
- Shared local candidate retrieval, ranking, abstention, and concise explanations.
- Native skill attachment where supported, otherwise guidance using native loading.
- Tool recommendations referencing actual host-visible operations.
- Local selection and usage evidence with a small inspection interface.
- Bounded routing work, deduplication, and graceful continuation after failure.
- One guided setup command with agent detection, planned changes, affected-settings backups, and removal of only Kitroute-owned entries during uninstall.

The optional MCP interface belongs to the architecture, but does not need to block the first automatic-routing prototype.

## Launch sequence

Publish a community repository and installable package first, once the release criteria pass. Follow with official directory submissions where eligible. Official acceptance does not block the first community release. This is a release plan, not authorization to publish unfinished work during the design stage.

Keep local routing free. Consider paid extras only after developers see value. Shared team settings and cross-device synchronization are later candidates, not first-release requirements.

## Delivery sequence

| Stage | Deliverable | Exit evidence |
| --- | --- | --- |
| 1. Integration spike | Minimal Claude/Codex adapters and capability discovery report. | Automatic entry demonstrated; loading and observation limits recorded for pinned versions. |
| 2. Routing baseline | Shared inventory and lexical router with abstention. | Labeled selection cases exercise eligible, overlapping, unavailable, and irrelevant capabilities. |
| 3. End-to-end prototype | Adapter actions, local traces, and basic continuation handling. | Ordinary user requests produce observed native loading/calling where supported without naming Kitroute. |
| 4. Comparative evaluation and pilot | Native defaults, improved skill descriptions, relevant existing routers, and Kitroute results, plus a small developer pilot. | Repeatable task outcomes and overhead reported under the [validation plan](09_validation_plan.md), with feedback from real projects. |
| 5. Release packaging | Reversible setup, diagnostics, supported-version matrix, and documentation. | Clean install/uninstall and failure recovery pass on declared platforms. |

## Acceptance criteria

1. The user does not need to invoke Kitroute on each eligible turn after setup.
2. Explicit-only or disabled capabilities are not implicitly activated.
3. The router can choose nothing when specialist capabilities are unnecessary.
4. Explanations identify the selected capability and relevant evidence.
5. Reports distinguish recommendation, attachment request, observed loading/calling, and task outcome.
6. Missing tools or router failures do not produce invented operations or indefinite task stalls.
7. Compatibility claims list tested versions and discovery/observation limits.
8. Comparative results show whether task success improves, with latency and token overhead visible.
9. Setup and uninstall preserve unrelated agent settings, including changes made after installation.
10. Repeatable comparative tests and a small developer pilot are completed before the first release, with results and feedback recorded.

Numerical performance targets require a measured baseline before they become release gates.

## Deferred work

Marketplace discovery, automatic package updates, cloud accounts, cross-device synchronization, monetization, team policy management, a general MCP gateway, and universal support for every CLI agent are outside the first release.

The original registry/update idea remains a possible later direction. The present MVP focuses on utilization of installed capabilities.

## Implementation follow-through

Follow the [implementation checklist](11_implementation_checklist.md) to select libraries, implement packaging, and test adapter coverage. Basic usage history lasts 30 days and excludes user prompts and project code. Record engineering choices and evidence in the [decision log](../architecture/06_decision_log.md).
