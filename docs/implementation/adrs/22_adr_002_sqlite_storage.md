# ADR-002: SQLite storage behind a small interface

Date: 5 October 2026.

Status: SQLite is established by D14. The node:sqlite binding is the planned engineering choice, subject to M1 and M2 evidence.

## Context

Each routing process must reuse the saved index without a background service. Multiple hook processes can access the same database. Usage records and capability metadata have different retention rules.

## Decision

Place SQLite behind Store, inventory, and history functions. Start with Node's built-in node:sqlite binding to avoid an extra database binary dependency. The reviewed Node 24 documentation labels this API a release candidate, not stable. P01 must test it before the plan depends on it.

Use explicit tables, prepared statements, transaction-based migrations, and host/project keys. Use a 100 ms initial lock timeout. Bound the outer hook process separately because synchronous database calls can block a worker.

The project key includes the active host profile. Refresh metadata when declared sources change. Preserve the old transaction on discovery failure, but abstain when current eligibility cannot be established. Reset cached tool availability unless current host information proves it for the routing request.

Keep capability metadata across requests. Delete only usage records older than 30 days. Do not store prompt text, project source code, or raw tool payloads in usage tables.

## Alternatives

| Alternative | Disposition |
| --- | --- |
| JSON files | Not selected by the user for persistent storage. |
| External SQLite binding | Revisit if the built-in binding fails runtime or packaging tests. |
| Hosted database | Outside the local-core first release. |
| Search/vector extensions | Defer until simple lexical routing demonstrates a measured limitation. |

## Consequences and evidence

The release-candidate binding is a compatibility risk that tests must address. The Store interface limits changes if another binding is needed. The first schema stores metadata, not a general conversation archive.

M2 requires migration, reopen, rollback, scope isolation, and competing-writer tests. P03 adds retention and privacy evidence.

Source: [Node 24 SQLite API](https://nodejs.org/docs/latest-v24.x/api/sqlite.html).

Implementation: [P02](../phases/16_phase_02_index_routing.md). Product decisions: [D13, D14, and D19](../../architecture/06_decision_log.md).
