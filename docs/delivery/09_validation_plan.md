# Validation plan

Status: evaluation plan aligned with the selected comparisons and pilot requirement. No results have been produced for Kitroute.

## Purpose

Validate both technical integration and useful task completion. A router can increase invocation rates while making the agent slower or less accurate; activation counts alone do not establish value.

## Compatibility checks

For each adapter, record host version, model, operating system, execution mode, skill locations, plugin state, and tool connections. Check automatic entry, context injection or native attachment, explicit-only policy, observation coverage, timeout recovery, session resume, and compaction where supported.

The initial compatibility targets are Windows and Pop!_OS Linux. Test both environments before claiming first-release support. Record exact OS and agent versions; Pop!_OS results do not establish compatibility with every Linux distribution.

Test Windows paths and executable discovery for declared Windows support. CLI results must not be reused as evidence for cloud-agent or other runtime modes.

## Comparison conditions

Compare Kitroute against native defaults, improved skill descriptions, and relevant existing routers. This comparison set was selected by the user. Manual naming can provide an additional reference but does not replace the automatic-workflow comparisons.

| Condition | Purpose |
| --- | --- |
| Native defaults | Establish current host behavior without Kitroute. |
| Improved descriptions and project instructions | Determine whether inexpensive native configuration solves the problem. |
| Existing relevant router | Establish a competitive baseline using a pinned public release. |
| Kitroute | Measure the incremental value of automatic routing and observation. |
| Explicit manual capability naming | Provide a reference for informed user selection. |

Use the same task, repository state, eligible capability set, host/model versions, and permissions across conditions. Run independent trials and report variability rather than a single best result.

## Scenario set

- Relevant skill with a weak description but useful body content.
- Multiple overlapping skills requiring different phases or frameworks.
- Task requiring no specialist skill or MCP tool.
- Browser reproduction followed by backend investigation and verification.
- Disabled, explicit-only, missing, malformed, or duplicate skills.
- Configured but disconnected tools and authorization failures.
- Project/profile changes and capability updates after indexing.
- Multi-turn requests, interruptions, resume, and compaction.
- Router failure or deadline exhaustion during otherwise ordinary work.

Begin with small labeled cases and expand to libraries of roughly 10, 50, and 200 skills. Those sizes are suggested evaluation settings, not measured capacity limits.

## Metrics

| Metric | Interpretation |
| --- | --- |
| Task success | Independent task assertions, relevant tests, or a defined review rubric. |
| Selection precision | Fraction of selected capabilities judged appropriate for the current phase. |
| Selection recall | Fraction of labeled relevant capabilities selected at the appropriate stage. |
| Observed activation | Native loading/calling evidence, separately from guidance and ordinary file reads. |
| Unnecessary activation | Extra loading or tool use that did not help the task. |
| User reminders | Additional explicit capability prompts needed to complete the task. |
| Overhead | Routing time, total elapsed time, added context, and token use where observable. |
| Recovery | Whether the task continues after routing or availability failures. |

Label relevance before evaluating results where practical. More than one capability can be valid; labels should capture acceptable choices and phase dependencies.

## Reporting

Publish the pinned environment, cases, comparison setup, aggregate results, variability, and representative failure traces. Distinguish unavailable measurements from zeros. Document any host event that cannot prove activation.

Store runnable fixtures and code under a future evaluation directory when implemented; this document defines the method only. Ordinary usage history keeps basic records for 30 days and excludes user prompts and project code. Evaluation cases and synthetic fixture data are separate from user usage history. The [implementation checklist](11_implementation_checklist.md) covers cleanup and any optional export.

## Release decision

Complete repeatable comparative tests and a small developer pilot before the first release. Measure task success and overhead in the comparisons, then collect feedback from Kitroute use on real projects. Define pilot size, recruitment, duration, and numerical thresholds during evaluation setup. Record failures and unfavorable feedback as well as successful cases.

Compare task quality and overhead together. Establish numerical thresholds after the first baseline. If improved descriptions or an existing router perform similarly, narrow the product, improve the approach, or consider contributing to an existing project before expanding scope.

The Vercel findings in [02 Research findings](../research/02_research_findings.md) motivate evaluation; they are not Kitroute results or universal agent failure rates.
