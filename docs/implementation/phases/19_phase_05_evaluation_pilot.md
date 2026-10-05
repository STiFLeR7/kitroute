# Evaluation and Pilot Implementation Plan

> For agentic workers: Use superpowers:executing-plans, or superpowers:subagent-driven-development when the user chooses delegation. Complete task tests before advancing.

Goal: Establish whether Kitroute improves real work at acceptable overhead before release.

Architecture: A synthetic case runner captures comparable outcomes from fixed environments. A separate pilot collects basic usage records and voluntary feedback.

Tech Stack: TypeScript evaluation scripts, JSON fixtures, Node tests, and pinned host/model environments.

Spec: [Validation plan](../../delivery/09_validation_plan.md), [milestones](../13_milestones.md), and [release ADR](../adrs/27_adr_007_evaluation_release.md).

## Global constraints

Compare native defaults, improved descriptions, relevant existing routers, and Kitroute. Complete a small developer pilot before release. Do not store real prompts or project code in basic history.

## Review focus

A benchmark must not tune against its held-out cases. Unknown use must not count as zero or proven activation. Success must come from task assertions rather than model claims.

## Task P05.T1: Case runner and reproducible comparisons

Files: create evaluation/cases.json, evaluation/run.ts, evaluation/report.ts, evaluation/fixtures/, tests/unit/evaluation.test.ts, and tests/integration/evaluation-runner.test.ts.

Interfaces: define EvalCase and TrialResult in evaluation/run.ts. Export aggregate(results: TrialResult[]): Metrics from evaluation/report.ts.

```typescript
export interface EvalCase {
  id: string;
  split: 'development' | 'held-out';
  request: string;
  projectFixture: string;
  acceptableCapabilityIds: string[];
  assertionCommand: string[];
}
export interface TrialResult {
  caseId: string;
  condition: 'native' | 'descriptions' | 'existing-router' | 'kitroute' | 'manual';
  success: boolean;
  observedIds: string[] | null;
  selectedIds: string[];
  addedMs: number;
  guidanceChars: number;
  nativeContextChars: number | null;
  unnecessarySelections: number;
  explicitReminders: number;
}
export interface Metrics {
  successRate: number;
  measuredActivationTrials: number;
  unknownActivationTrials: number;
  meanAddedMs: number;
  meanGuidanceChars: number;
  meanNativeContextChars: number | null;
  unnecessarySelections: number;
  explicitReminders: number;
}
```

- [ ] Write the aggregate test using a failed task and unknown observation:

```typescript
import assert from 'node:assert/strict';
import { aggregate } from '../../evaluation/report.js';

const result = aggregate([
  { caseId: 'a', condition: 'kitroute', success: false, observedIds: null,
    selectedIds: ['debug'], addedMs: 10, guidanceChars: 80, nativeContextChars: null,
    unnecessarySelections: 0, explicitReminders: 1 }
]);
assert.equal(result.successRate, 0);
assert.equal(result.unknownActivationTrials, 1);
assert.equal(result.measuredActivationTrials, 0);
```

- [ ] Run the test and observe failure. Implement metrics without converting null observations into an empty successful set.

```typescript
import type { TrialResult, Metrics } from './run.js';

export function aggregate(results: TrialResult[]): Metrics {
  if (!results.length) throw new Error('NO_TRIALS');
  const count = results.length;
  const measuredContext = results.filter(
    (result): result is TrialResult & { nativeContextChars: number } => result.nativeContextChars !== null
  );
  return {
    successRate: results.filter(result => result.success).length / count,
    measuredActivationTrials: results.filter(result => result.observedIds !== null).length,
    unknownActivationTrials: results.filter(result => result.observedIds === null).length,
    meanAddedMs: results.reduce((sum, result) => sum + result.addedMs, 0) / count,
    meanGuidanceChars: results.reduce((sum, result) => sum + result.guidanceChars, 0) / count,
    meanNativeContextChars: measuredContext.length
      ? measuredContext.reduce((sum, result) => sum + result.nativeContextChars, 0) / measuredContext.length
      : null,
    unnecessarySelections: results.reduce((sum, result) => sum + result.unnecessarySelections, 0),
    explicitReminders: results.reduce((sum, result) => sum + result.explicitReminders, 0)
  };
}
```

- [ ] Reject non-finite timings, negative counts, and empty case IDs at trial ingestion. Aggregate each condition, host, and catalog size separately.
- [ ] Measure routing guidance separately from native skill context. Preserve unknown native context as null. Report host token counts separately when available.
- [ ] Create 28 synthetic cases: 12 relevant, 6 overlapping, 6 requiring no specialist capability, and 4 unavailable/explicit-only cases.
- [ ] Put 14 cases in the development split and 14 in the held-out split, with every category represented in each.
- [ ] Expand each catalog to 10, 50, and 200 skills using deliberately irrelevant synthetic entries. Keep tool availability constant across comparison conditions.
- [ ] Run five repeats per condition and case. Reset the project fixture and agent session for every trial. Use the same host, model, permission mode, and test command.
- [ ] Pin one applicable existing-router version per host and document its install and automatic-entry behavior. Keep manual naming as an additional reference condition.
- [ ] Execute assertions as argument arrays with shell false. Retain raw model output only for synthetic evaluation cases, outside ordinary usage history.
- [ ] Run npm test and commit with test: add reproducible routing comparisons.

## Task P05.T2: Calibration and release decision

Files: create evaluation/gates.json and a numbered results report; modify evaluation/report.ts and tests/unit/evaluation.test.ts.

Interfaces: export decideRelease(metrics: Metrics, baseline: Metrics, gates: Gates): { pass: boolean; reasons: string[] }. Define Gates in evaluation/report.ts.

```typescript
export interface Gates {
  maxMeanAddedMs: number;
  maxMeanGuidanceChars: number;
  maxUnnecessarySelections: number;
  maxExplicitReminders: number;
}
export function decideRelease(metrics: Metrics, baseline: Metrics, gates: Gates) {
  const reasons = [];
  if (metrics.successRate < baseline.successRate) reasons.push('SUCCESS_REGRESSION');
  if (metrics.meanAddedMs > gates.maxMeanAddedMs) reasons.push('EXCESS_OVERHEAD');
  if (metrics.meanGuidanceChars > gates.maxMeanGuidanceChars) reasons.push('EXCESS_CONTEXT');
  if (metrics.unnecessarySelections > gates.maxUnnecessarySelections) reasons.push('EXTRA_SELECTIONS');
  if (metrics.explicitReminders > gates.maxExplicitReminders) reasons.push('EXTRA_REMINDERS');
  const improves = metrics.successRate > baseline.successRate ||
    metrics.explicitReminders < baseline.explicitReminders;
  if (!improves) reasons.push('NO_MEASURED_BENEFIT');
  return { pass: reasons.length === 0, reasons };
}
```

- [ ] Write tests proving that equal success with no reminder reduction fails the benefit gate. Test success regression and excessive overhead independently.
- [ ] Measure development-split results before choosing thresholds. Start the overhead ceiling at the 2,500 ms hook deadline, then tighten it only from measured data.
- [ ] Start maxMeanGuidanceChars at 2,000 and tighten it from development measurements. Test excessive context independently from time overhead.
- [ ] Set unnecessary-selection and reminder ceilings no higher than the strongest applicable baseline. Commit gates.json before running the held-out split.
- [ ] Compare matched trials against every applicable baseline. A release must not regress against any baseline. Normalize counts to equal trial sets.
- [ ] Freeze ranking thresholds and guidance limits with the development results. Do not retune using held-out failures and report them as independent success.
- [ ] Run held-out comparisons and report variability across repeats, not just average counts. Require zero policy violations and zero privacy/configuration-loss failures in dedicated tests.
- [ ] Record an explicit pass or revise decision for M5. Commit with docs: record comparative release evidence.

## Task P05.T3: Small developer pilot

Files: create evaluation/pilot-guide.md, evaluation/feedback-template.md, and a numbered pilot summary. Do not create a contact list or send invitations during plan execution without user authorization.

Interfaces: voluntary feedback records environment, workflow category, helpfulness, missed/extra selections, overhead impressions, and whether the developer keeps Kitroute enabled. Project names and source code are not required.

- [ ] Prepare a preview package and guide for five developers over five days, with at least two participants testing each target system.
- [ ] Ask each participant to complete at least three ordinary development sessions. Preserve native host permissions and collect basic history only with the stated defaults.
- [ ] Use this feedback shape:

```json
{
  "platform": "fedora",
  "host": "codex",
  "workflow": "debugging",
  "helpful": true,
  "missedSelections": 0,
  "unnecessarySelections": 0,
  "keepsEnabled": true,
  "notes": "No project identifiers or source excerpts required"
}
```

- [ ] Summarize participant counts, sessions, useful behavior, failures, and unfavorable feedback. If recruitment or sessions are incomplete, leave M5 incomplete.
- [ ] Require no unresolved task-blocking or configuration-loss defects. Investigate repeated missed selections and excessive overhead before judging the release candidate.
- [ ] Combine the comparison decision and pilot evidence, then record M5. Commit with docs: record developer pilot findings.

## Milestone M5

M5 requires repeatable comparisons, frozen gates, and completed pilot evidence. A favorable selection score alone does not satisfy the milestone. An unsuccessful evaluation leads to correction or a narrower product before community release.
