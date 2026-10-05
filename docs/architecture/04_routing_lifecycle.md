# Routing lifecycle

Status: routing design under the completed product decisions. Runtime behavior still requires implementation and tests.

## Before a user turn

1. The host adapter receives a supported lifecycle event automatically.
2. It normalizes the request, session identifiers, current repository location, and available recent context.
3. It obtains or refreshes an inventory of eligible skills and tools. Unknown availability remains unknown.
4. The routing core filters ineligible entries, retrieves candidates, and ranks them using task and project signals.
5. It returns a bounded selection or abstains.
6. The adapter attaches skills natively when supported, otherwise injects concise guidance. Tool selections refer to host-visible callable operations.
7. The host continues its normal reasoning and execution.

## Selection behavior

Use description, relevant body excerpts, capability type, repository clues, current phase, and recent selections as candidate signals. Do not load every candidate's full instructions into the model context.

The router can choose zero capabilities. A short acknowledgement, an unrelated question, or a task fully handled by ordinary host tools does not require a specialist skill.

Select at most three capabilities per routing decision, counting skills and tools together. Three is a maximum, not a target. Keep selection guidance short and load full skill instructions only through the appropriate native path when needed.

Explicit-only and disabled entries are excluded from implicit selection. An explicit developer request can be passed to the host's normal activation path, subject to native restrictions.

If two skills overlap, choose the best-supported match or abstain. Measure retrieval thresholds and the numerical context budget during implementation. The accepted selection limit is three capabilities per decision.

## During execution

Observe native load events and tool calls when available. Record whether the evidence proves activation, merely shows a file read, or only confirms injected guidance.

Report capability use only when native loading or a tool call is observed. A suggestion, file read, or agent statement does not qualify as observed use. If the host does not expose sufficient evidence, report use as unknown. Keep task success separate from observed activation.

Reconsider selection on each user request and clear task changes. Examples include reproduction revealing a backend error, an implementation reaching testing, or the developer steering to a different problem. Use supported host events to detect changes and record gaps where an adapter cannot observe them. Avoid repeated guidance when the selection is unchanged; do not reroute after every tool result by default.

## After execution

Record what was selected and what was observed. Keep completion status, test results, and human feedback separate from the model's assertion that it succeeded. An observed tool call can fail, and a loaded skill can be followed incorrectly.

## Failure and recovery paths

| Condition | Expected behavior |
| --- | --- |
| Router times out or crashes | Continue the host task; record degraded routing without forcing retry loops. |
| Inventory is stale | Refresh within a bounded budget; avoid recommending entries known to be unavailable. |
| Skill is missing or invalid | Exclude it and report the discovery issue for inspection. |
| Tool is disconnected or authorization is missing | Mark unavailable; preserve native reconnect or consent behavior. |
| Selection is uncertain | Abstain or provide a limited suggestion; do not repeatedly interrupt the developer. |
| Guidance is ignored | Record no observed activation. Any reminder policy needs validation before enabling it. |
| Session is compacted or resumed | Refresh active context and inventory as supported; retain only relevant routing state. |
| Capability changes on disk | Invalidate its cached metadata before the next relevant route. |

The MVP does not block unrelated editing solely because a recommendation was not followed. Stronger enforcement is a separate product decision requiring evidence that it improves the workflow.

See the [validation plan](../delivery/09_validation_plan.md) for scenarios covering these paths.
