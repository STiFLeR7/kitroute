# ADR-004: Bounded selection and task-change routing

Date: 5 October 2026.

Status: established policies D18 and D09. Lexical scoring and numerical budgets are initial engineering settings.

## Context

Selecting every installed capability adds context and can distract the host. A long task can change phase after the initial request. Repeating unchanged guidance adds overhead without new information.

## Decision

Filter by host, project, invocation policy, and proven availability before ranking. Start with deterministic lexical overlap and stable ID tie-breaking. Return abstention when relevance is weak.

Select at most three skills and tools together. Start the development score threshold at 0.2 and the guidance cap at 2,000 characters. Measure and calibrate these engineering settings on development cases before held-out evaluation.

Reconsider each user request and observable clear task changes. Store phase and selection signatures without prompt text. Invalidate state when the project or inventory changes, or model context is reset.

For a continuation, use canonical phase context and current project metadata if the host does not provide task text. Report detection limits. Do not claim that a heuristic understands every task transition.

## Alternatives

| Alternative | Disposition |
| --- | --- |
| One capability maximum | Not selected by the user. |
| Reroute after every tool response | Not selected; use meaningful changes. |
| Model call for every selection | Defer until a lexical baseline demonstrates a measurable need. |
| Save the original prompt for reuse | Excluded from default persistent history. |

## Consequences and evidence

The initial lexical matcher targets the English evaluation corpus. It must preserve Unicode identifiers even when it cannot establish a relevance match. Broader language retrieval needs separate evidence before a support claim.

P02 tests selection, eligibility, cap, and abstention. P04 tests task changes and deduplication. P05 measures quality and overhead.

Implementation: [P02](../phases/16_phase_02_index_routing.md) and [P04](../phases/18_phase_04_lifecycle_setup.md). Product decisions: [D09 and D18](../../architecture/06_decision_log.md).
