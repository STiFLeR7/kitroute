# ADR-006: One guided setup with owned configuration

Date: 5 October 2026. Amended 8 October 2026: Pop!_OS replaces Fedora as the Linux target under D25; the runtime and setup decisions are unchanged.

Status: established policy D20.

## Context

Developers can already have plugins, hooks, and custom settings. Setup and uninstall must preserve those entries and any edits made afterward. A backup alone cannot safely distinguish Kitroute's entries from user changes.

## Decision

Use one setup command with detection and a dry-run preview. Produce a plan containing target files, additions, hashes, and conflicts. Back up affected configuration before applying changes.

Record exact Kitroute-owned entries in a local manifest. Use supported native fields only. Recheck hashes before applying and use atomic writes where available.

On uninstall, remove only entries still matching the owned manifest. Leave changed entries intact and report the conflict. Never restore an entire old configuration over newer user settings.

Detect native hook trust requirements and present them as setup status. Do not enable bypass flags. Keep hook commands local and use platform-specific quoting tested with spaced paths.

## Alternatives

| Alternative | Disposition |
| --- | --- |
| Manual setup only | Not selected by the user. |
| Separate agent installs only | Not selected as the primary setup experience. |
| Replace complete configuration files | Reject because it loses unrelated settings. |
| Restore backup wholesale on uninstall | Reject because it loses later edits. |

## Consequences and evidence

Setup needs preview, ownership tracking, and conflict handling. Backups help recover incomplete transactions but are not uninstall ownership records.

P04 tests repeated setup, malformed configuration, partial failure, changed entries, and later user edits. M4 requires Windows and Pop!_OS results.

Implementation: [P04](../phases/18_phase_04_lifecycle_setup.md). Product decision: [D20](../../architecture/06_decision_log.md).
