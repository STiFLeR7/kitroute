# ADR-005: Basic local history and truthful evidence

Date: 5 October 2026.

Status: established policies D16 and D19.

## Context

The product must show what it selected and whether the host used it. Raw host input can include prompts, project code, tool arguments, and error text. None is required for the selected basic history.

## Decision

Construct UsageRecord from an explicit field allowlist. Store capability identity/name, event type, observed result, timing, and local association fields. Never serialize the incoming host object into history.

Keep basic history for 30 days and prune it during a bounded on-demand maintenance path. Do not expire the capability index under that rule. Store fixed error codes rather than raw exception messages.

Keep selection, guidance, file read, native load, tool call, and task outcome separate. An observed failed tool call counts as an observed call, not task success. Unknown observation remains unknown.

Synthetic evaluation fixtures can retain their authored task inputs outside usage history. Real pilot history uses the ordinary defaults.

## Alternatives

| Alternative | Disposition |
| --- | --- |
| No saved records | Not selected by the user. |
| Seven-day history | Not selected by the user. |
| Raw conversation archive | Excluded by default. |
| Model statements as proof | Not selected as evidence of use. |

## Consequences and evidence

Debugging must use reason codes, reproduction fixtures, and voluntarily supplied information rather than hidden prompt retention. Default history is not a complete agent transcript.

P03 injects secret markers into every unsupported field and tests the saved data. Retention tests use a fixed clock and protect the index.

Implementation: [P03](../phases/17_phase_03_adapters_evidence.md). Product decisions: [D16 and D19](../../architecture/06_decision_log.md).
