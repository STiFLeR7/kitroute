# ADR-007: Evidence before community release

Date: 5 October 2026.

Status: established policies D21, D22, D23, and D24.

## Context

Existing routers and native implicit activation already address part of the problem. More invocations do not necessarily mean better completed work. Official directories can impose package restrictions independent of local distribution.

## Decision

Compare native defaults, improved descriptions, applicable existing routers, and Kitroute in fixed environments. Keep manual naming as an additional reference. Calibrate thresholds on development cases and freeze them before held-out evaluation.

Require repeatable comparisons and a small developer pilot before release. Report task assertions, unnecessary activation, reminders, observation gaps, and overhead. Require measured benefit without task-success regression relative to the strongest applicable baseline.

Publish a community repository and installable package first after the release evidence passes and the maintainer authorizes publication. Seek eligible official directory listings afterward. Keep local routing free and investigate paid extras later.

## Alternatives

| Alternative | Disposition |
| --- | --- |
| Native-only comparison | Not selected by the user. |
| Release without a pilot | Not selected by the user. |
| Wait for official acceptance first | Not selected; community release comes first. |
| Charge for the first local release | Not selected by the user. |

## Consequences and evidence

Evaluation and pilot completion are release gates, not optional marketing tasks. A private development package name or public source tree does not establish package ownership or license rights.

M5 records comparison and pilot evidence. M6 records the reviewed package, explicit license, authorization, published identity, and public-version smoke tests.

Implementation: [P05](../phases/19_phase_05_evaluation_pilot.md) and [P06](../phases/20_phase_06_community_release.md). Product decisions: [D21-D24](../../architecture/06_decision_log.md).
