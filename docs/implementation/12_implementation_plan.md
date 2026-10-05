# Kitroute Implementation Plan

> For agentic workers: Use superpowers:executing-plans for direct execution, or superpowers:subagent-driven-development when the user chooses delegation. Complete tasks in order and track their checkbox steps. This document authorizes planning only.

Goal: Build a free local router that helps Claude Code and Codex use eligible installed capabilities without repeated manual naming.

Architecture: Host adapters call a shared TypeScript core on demand. SQLite holds the capability index and basic usage history. Hosts retain native loading, execution, consent, and trust.

Tech Stack: TypeScript compiled to JavaScript, Node.js 24.21.0 as the initial runtime baseline, npm, SQLite, and Node's test runner. The storage ADR makes the node:sqlite choice conditional on the foundation tests.

Spec: [Product](../01_product_overview.md), [architecture](../architecture/03_system_architecture.md), [resolved choices](../10_open_questions.md), and [validation](../delivery/09_validation_plan.md).

Status: ready for plan review. No implementation phase is complete. All future source paths in this plan are planned files, not existing code.

A phase groups related tasks. A milestone records a working outcome with test evidence. An architecture decision record (ADR) explains a choice, its alternatives, and its consequences.

## Global constraints

- Use TypeScript for the shared core and supported adapter code.
- Start when needed for each routing request. Reuse a saved local index. No background service is required for the first release.
- Use SQLite for the capability index and basic usage records.
- Target Windows and Fedora Linux together. Publish exact tested OS and agent versions.
- Select at most three capabilities per decision, counting skills and tools together. Fewer or none are valid. Keep guidance short.
- Reconsider on each user request and clear task changes. Avoid repeated guidance when selection is unchanged.
- Keep basic local records for 30 days. Save capability names, observed use, result status, and timing. Exclude prompts and project code by default.
- Report use only from observed native loading or tool calls. Keep suggestions, file reads, and agent statements separate.
- Provide one guided setup command with backups and removal of only Kitroute-owned entries during uninstall.
- Release through the community first, then pursue eligible official listings.
- Complete repeatable comparisons and a small developer pilot before release.
- Keep local routing free. Paid extras are outside the first release.

## Review focus

| Condition | Required behavior | Owning task |
| --- | --- | --- |
| A configured MCP server is disconnected | Do not label its tools callable from configuration alone. | P01.T2 and P02.T2 |
| A capability ID exists in multiple projects | Keep project identity and active scope separate. | P02.T1 and P04.T1 |
| Two hook processes write at the same time | Bound lock waits and continue the host after deadline failure. | P02.T1 and P03.T1 |
| Raw prompts or tool errors contain a unique secret marker | The marker never enters stored usage records or diagnostics. | P03.T2 |
| A user edits configuration after setup | Uninstall removes owned entries and preserves the user's later edits. | P04.T2 |

## Phase sequence

| Phase | Plan | Working outcome | Milestone |
| --- | --- | --- | --- |
| P01 | [Foundation and discovery](phases/15_phase_01_foundation_discovery.md) | A compiled local executable and proven host entry/discovery contracts. | M1: integration feasibility |
| P02 | [Index and routing](phases/16_phase_02_index_routing.md) | Persistent scoped inventory and deterministic bounded selection. | M2: local routing |
| P03 | [Adapters and evidence](phases/17_phase_03_adapters_evidence.md) | Automatic prompt routing and truthful local usage reports. | M3: host routing |
| P04 | [Lifecycle and setup](phases/18_phase_04_lifecycle_setup.md) | Task-change handling and reversible setup on both target systems. | M4: installable preview |
| P05 | [Evaluation and pilot](phases/19_phase_05_evaluation_pilot.md) | Comparative results and real-project feedback for a release decision. | M5: evaluated candidate |
| P06 | [Community release](phases/20_phase_06_community_release.md) | Tested public package, community documentation, and support matrix. | M6: community release |

Each phase depends on the previous milestone. A task can be reviewed independently but must use the shared contracts. No calendar dates are promised.

## Planned commands

The implementation will expose these commands through a compiled executable:

```text
kitroute doctor
kitroute index --host claude-code --project <absolute-path>
kitroute route --host claude-code --project <absolute-path>
kitroute hook --host claude-code --event UserPromptSubmit
kitroute hook --host codex --event UserPromptSubmit
kitroute history
kitroute setup --dry-run
kitroute setup
kitroute uninstall --dry-run
kitroute uninstall
```

The angle-bracket argument is a CLI synopsis, not an execution command. Route and hook requests arrive through standard input. Do not put user prompts in command arguments.

The ordinary route command returns Kitroute JSON. The hook command emits only the host's supported response and returns success after routing failure. The optional MCP interface is a later feature and does not block M6.

## Execution rules

- [ ] Read the phase plan and its referenced ADRs before changing source code.
- [ ] Write the task's behavioral test and run it to observe the expected failure.
- [ ] Implement the smallest code that passes that test and the listed failure cases.
- [ ] Run the targeted tests, type compilation, and the full suite at the milestone boundary.
- [ ] Record compatibility or evaluation evidence without raw user prompts or project code.
- [ ] Review and commit the task's source, tests, and relevant documentation when execution is authorized.

Planning does not install packages, alter agent configuration, or publish code. Execute setup tests against temporary directories before any real host configuration changes.

## Release and handoff

Use the [milestone register](13_milestones.md) to record pass/fail evidence. Use the [module map](14_module_map_contracts.md) for source ownership and exact shared types. Use [requirement coverage](28_requirement_traceability.md) to make sure that every selected policy has a task and test.

The plan is ready for review when file links, task references, interfaces, and policy coverage pass inspection. Implementation starts only after the user requests execution and selects the execution approach.
