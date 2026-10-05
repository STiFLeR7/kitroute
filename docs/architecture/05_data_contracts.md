# Data contracts

Status: design contracts under the completed product decisions. Convert these records into concrete schemas during implementation; no implemented API is claimed.

## Capability record

| Field | Purpose |
| --- | --- |
| `id` | Stable identity scoped to host, project/profile, and source; display name alone is insufficient. |
| `kind` | `skill` or `tool` for the initial release. |
| `name`, `description` | Human-readable identity and candidate retrieval metadata. |
| `source` | Skill location or host tool/server identity, plus optional containing plugin identity. |
| `scope` | Project, user, profile, or other host-defined visibility scope. |
| `availability` | Known state and evidence: enabled, visible, connected, callable, or unknown as applicable. |
| `invocation_policy` | Implicitly eligible, explicit-only, disabled, or unknown. |
| `revision` | Source change marker for cache invalidation. |
| `activation` | Supported native action or guidance target supplied by the adapter. |
| `references` | Optional local assets or source excerpts available for inspection. |

Do not collapse all availability states into one installed flag. An unknown invocation policy must not be treated as permission to bypass host restrictions. The adapter must establish eligibility from supported host behavior.

## Route request

Provide `host`, `host_version`, `session_id`, `turn_id` when available, `request`, `project_root`, a bounded context summary, optional phase hints, and an inventory revision. Omitted context should remain absent rather than being synthesized as fact.

The adapter controls how context is obtained. Do not make a private transcript format a required universal interface.

## Route result

Return a decision of select, abstain, or degraded; a ranked list of capability IDs; concise reasons and source evidence; the requested adapter action; and timing information. Optional scores are ranking signals, not calibrated probabilities unless evaluation establishes calibration.

Keep IDs and activation targets host-scoped. Never invent a native tool name from a description or use a capability from a different active profile.

A route result contains no more than three selected capabilities, counting skills and tools together. It can contain fewer or none. Keep model-visible selection guidance short and set its numerical budget from implementation measurements.

## Observation event

Record session/turn association where available, capability ID, event type, timestamp, evidence source, and result status. Useful initial event types are:

- Routing checked and selection returned.
- Guidance injected or native attachment requested.
- Native skill activation observed or file read observed.
- Tool call observed and tool result observed.
- Selection skipped, unavailable, or router failed.
- Task outcome evaluated or user feedback received.

Different evidence types must remain distinct in reports. A successful tool response is not equivalent to successful task completion.

Only observed native loading and tool calls qualify for reporting capability use. Guidance, file reads, and agent statements remain separate evidence types. Represent use as unknown when observation is unavailable.

## Adapter capability declaration

Each adapter declares automatic entry events, inventory coverage, native loading support, context injection support, tool observation coverage, skill activation observation coverage, and compaction/resume handling.

Represent unsupported and unknown explicitly. Compatibility claims must correspond to the tested declaration for a particular host version.

## Optional MCP surface

The design uses logical operations `route`, `inspect`, and `explain`. Define exact tool names and schemas when implementing the optional MCP interface. Each operation calls the shared core and returns the same selection evidence as native adapters.

## Persistence

Keep basic usage records locally for 30 days. Save selected capability identities and names, observed use, result status, and timing. Do not save user prompts or project code in usage history by default. Transient routing context must not become a stored request snapshot or appear in stored reasons or error messages.

The 30-day limit applies to usage history, not the capability index reused across routing requests. Skill metadata and source references needed for indexing remain separate from usage records. Do not copy project code into that index. Implement record cleanup under the selected retention policy. Local routing does not require uploading user requests to a service.

The [module map and contracts](../implementation/14_module_map_contracts.md) define the first implementation's TypeScript interfaces. They retain unknown availability and scope boundaries while using a smaller record shape. Host declarations and feasibility reports retain version and evidence details outside those records.

See the [implementation checklist](../delivery/11_implementation_checklist.md) for the broad work and the [phase plans](../implementation/12_implementation_plan.md) for schemas, cleanup, tests, and milestones.
