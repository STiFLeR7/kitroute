# Implementation checklist

Status: engineering work under the completed architecture decisions. No implementation or compatibility results are claimed.

## Purpose

All 14 guided product questions are resolved. This checklist turns the selected policies into implementation and test tasks. Engineering details belong here rather than reopening the completed question round.

Use the [resolved choices](../10_open_questions.md) and [decision log](../architecture/06_decision_log.md) as the product baseline. Record implementation choices and evidence as work progresses.

The [implementation plan](../implementation/12_implementation_plan.md) defines six phases with task IDs and tests. Use the [milestone register](../implementation/13_milestones.md) for completion evidence. The [coverage map](../implementation/28_requirement_traceability.md) connects every selected choice to those tasks. This checklist remains the broad view of the same work.

## Core and storage

- [ ] Prove and pin the Node baseline from ADR 001 on Windows and Fedora Linux.
- [ ] Prove the SQLite binding from ADR 002 and implement capability, index revision, and usage tables.
- [ ] Implement execution on demand with reuse of the saved local index.
- [ ] Handle concurrent requests and bounded database retries without requiring a background service.
- [ ] Turn the [data contracts](../architecture/05_data_contracts.md) into concrete schemas.
- [ ] Implement local candidate search and exclusion of disabled or explicit-only capabilities.
- [ ] Enforce the three-capability maximum across skills and tools together.
- [ ] Measure and set the context budget, ranking thresholds, and execution deadline.
- [ ] Return control to the host after routing failure and test the recovery path.

## Agent integrations

- [ ] Implement the initial Claude Code and Codex integrations using supported host interfaces.
- [ ] Discover capabilities from agent information first, with supported files as a fallback.
- [ ] Preserve unknown availability and document each adapter's discovery coverage.
- [ ] Attach skills natively where supported, otherwise supply concise loading guidance.
- [ ] Observe native skill loading and tool calls without treating file reads or statements as proof of use.
- [ ] Reconsider selection on each user request and observable clear task changes.
- [ ] Avoid repeated guidance when selections do not change.
- [ ] Test session resume, compaction, interruptions, and changing project scope where supported.
- [ ] Record exact Windows, Fedora, host, and model versions used in compatibility tests.

## Usage history

- [ ] Save basic usage records locally for 30 days.
- [ ] Exclude user prompts and project code from saved records, reasons, and error details by default.
- [ ] Remove expired usage records without deleting the reusable capability index.
- [ ] Keep observation status separate from task success.
- [ ] Document export behavior if an export feature is implemented.

## Setup and community release

- [ ] Implement one guided setup command with agent detection and planned changes.
- [ ] Back up affected settings and track Kitroute-owned entries.
- [ ] Test repeated setup, configuration conflicts, partial failures, and uninstall.
- [ ] Preserve unrelated settings and changes made after installation.
- [ ] Finalize package names, commands, repository license, and release packaging.
- [ ] Prepare the community repository and installable package after release criteria pass.

## Evaluation and pilot

- [ ] Pin native, improved-description, and relevant existing-router comparison environments.
- [ ] Run repeatable task comparisons using the [validation plan](09_validation_plan.md).
- [ ] Measure task success, unnecessary activation, observed use, time, and context overhead.
- [ ] Set numerical release thresholds from the measured baseline before judging final results.
- [ ] Define the small developer pilot and collect feedback from real projects.
- [ ] Record failures and unfavorable feedback alongside successful cases.
- [ ] Make sure that comparisons, pilot feedback, and packaging tests meet the release criteria.

## After the community release

- [ ] Check current official directory rules against each final adapter package before submission.
- [ ] Pursue eligible official listings without making acceptance a community-release dependency.
- [ ] Keep local routing free and research paid extras only after the core demonstrates value.

These tasks do not change the selected product policies. Compatibility and performance become verified only when recorded test evidence supports them.
