# ADR-003: Host adapters provide automatic entry

Date: 5 October 2026.

Status: architecture baseline and established policies D04, D15, and D16.

## Context

An optional router tool cannot guarantee that the host calls it on each prompt. Agents expose different context, loading, discovery, and observation interfaces. Their configured capabilities are not always available in the current session.

## Decision

Use host lifecycle adapters for automatic entry. Start with Claude Code and Codex UserPromptSubmit command hooks. Their current docs support additional context, while Codex requires native hook trust review. Do not bypass that review.

Normalize host input into transient AdapterInput. Prefer supported agent inventory and use declared files for gaps. Keep configuration-only MCP availability unknown.

Prefer native loading where the host permits it. Otherwise emit concise instructions to use native loading. Prove observed use only from native loading or tool calls. Unsupported evidence remains unknown.

The optional MCP interface calls the same core. It neither intercepts all host prompts nor discovers sibling servers automatically.

## Alternatives

| Alternative | Disposition |
| --- | --- |
| MCP-only entry | Keep as optional access, not the automatic-entry mechanism. |
| Read private transcripts universally | Avoid a dependency on unstable or undocumented formats. |
| Load every skill body into context | Reject as the default because selection must stay bounded. |
| Count file reads as native activation | Reject under the selected evidence policy. |

## Consequences and evidence

Each host needs its own compatibility report. A shared interface does not imply equal features. Missing native skill events reduce observation coverage, not the truthfulness of reports.

P01 proves actual entry and payload mappings. P03 proves output, native evidence classification, and failure recovery. P04 proves continuation channels.

Sources: [Claude hooks](https://code.claude.com/docs/en/hooks), [Codex hooks](https://learn.chatgpt.com/docs/hooks), and the [dated research](../../research/02_research_findings.md).

Implementation: [P01](../phases/15_phase_01_foundation_discovery.md) and [P03](../phases/17_phase_03_adapters_evidence.md).
