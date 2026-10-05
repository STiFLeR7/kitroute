import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Capability, Host } from '../src/contracts.js';
import { POLICY } from '../src/cli.js';
import { select } from '../src/routing/select.js';
import { aggregate, aggregateBy } from './report.js';

export type Condition = 'native' | 'descriptions' | 'existing-router' | 'kitroute' | 'manual';
export interface EvalCase {
  id: string;
  split: 'development' | 'held-out';
  category?: 'relevant' | 'overlapping' | 'no-specialist' | 'unavailable';
  request: string;
  projectFixture: string;
  acceptableCapabilityIds: string[];
  assertionCommand: string[];
}
export interface TrialResult {
  caseId: string;
  condition: Condition;
  success: boolean;
  observedIds: string[] | null;
  selectedIds: string[];
  addedMs: number;
  guidanceChars: number;
  nativeContextChars: number | null;
  unnecessarySelections: number;
  explicitReminders: number;
  host?: Host;
  catalogSize?: number;
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
export type Executor = (c: EvalCase, condition: Condition, catalog: Capability[]) => Promise<TrialResult>;

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CONDITIONS = ['native', 'descriptions', 'existing-router', 'kitroute', 'manual'];

const count = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');

export function ingestTrial(value: unknown): TrialResult {
  const t = value as Record<string, unknown> | null;
  if (!t || typeof t !== 'object' || typeof t.caseId !== 'string' || !t.caseId ||
    !CONDITIONS.includes(t.condition as string) || typeof t.success !== 'boolean' ||
    !(t.observedIds === null || ids(t.observedIds)) || !ids(t.selectedIds) ||
    !count(t.addedMs) || !count(t.guidanceChars) || !(t.nativeContextChars === null || count(t.nativeContextChars)) ||
    !count(t.unnecessarySelections) || !count(t.explicitReminders) ||
    !(t.host === undefined || t.host === 'claude-code' || t.host === 'codex') ||
    !(t.catalogSize === undefined || (count(t.catalogSize) && t.catalogSize > 0))) throw new Error('INVALID_TRIAL');
  return t as unknown as TrialResult;
}

export function loadCases(): EvalCase[] {
  return JSON.parse(readFileSync(join(ROOT, 'evaluation/cases.json'), 'utf8'));
}
export function loadBaseCatalog(): Capability[] {
  return JSON.parse(readFileSync(join(ROOT, 'evaluation/fixtures/catalog.json'), 'utf8'));
}

const WORDS = ['pottery', 'glaze', 'kiln', 'ceramic', 'orchard', 'harvest', 'vineyard', 'lantern', 'tapestry', 'marble',
  'quartz', 'saffron', 'meadow', 'thistle', 'walnut', 'pewter', 'cobalt', 'ember', 'fjord', 'garnet', 'heron', 'indigo',
  'juniper', 'lichen'];
const SEED = 20260101;

// Deterministic: fixed-seed LCG, so the same base and size always give the same catalog.
export function expandCatalog(base: Capability[], size: number): Capability[] {
  if (!Number.isInteger(size) || size < base.length) throw new Error('INVALID_CATALOG_SIZE');
  let state = SEED;
  const next = (n: number) => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) % n;
  const out = [...base];
  for (let i = base.length; i < size; i++) {
    const id = `filler-${String(i).padStart(4, '0')}`;
    const words = Array.from({ length: 5 }, () => WORDS[next(WORDS.length)]!);
    out.push({ ...base[0]!, id, name: id, description: words.slice(0, 3).join(' '), terms: words.slice(3),
      policy: 'implicit', availability: 'available', source: `/synthetic/${id}/SKILL.md`, target: `/synthetic/${id}/SKILL.md` });
  }
  return out;
}

// SELECTION metric only: success here means the routing selection is acceptable, not that a task passed.
export const kitrouteSelectionExecutor: Executor = async (c, condition, catalog) => {
  if (condition !== 'kitroute') throw new Error('UNSUPPORTED_CONDITION');
  const start = performance.now();
  const result = select({ host: 'codex', projectId: 'eval', sessionId: 'eval', text: c.request, phase: 'general' }, catalog, POLICY);
  const addedMs = Math.round(performance.now() - start);
  const ok = new Set(c.acceptableCapabilityIds);
  const unnecessary = result.ids.filter(id => !ok.has(id)).length;
  // Abstain-expected cases (empty acceptable list) succeed only on an empty selection.
  const success = unnecessary === 0 && (ok.size === 0 || result.ids.length > 0);
  return {
    caseId: c.id, condition, success, observedIds: null, selectedIds: result.ids, addedMs,
    guidanceChars: result.guidance.length, nativeContextChars: null, unnecessarySelections: unnecessary,
    explicitReminders: 0, host: 'codex'
  };
};

// Live host executors (native/descriptions/existing-router/manual) are not authorized in this task.
export const liveExecutor: Executor = async () => { throw new Error('LIVE_EXECUTOR_NOT_AUTHORIZED'); };

export async function runTrials(cases: EvalCase[], conditions: Condition[],
  opts: { sizes: number[]; repeats: number; baseCatalog?: Capability[] }, executor: Executor): Promise<TrialResult[]> {
  const base = opts.baseCatalog ?? loadBaseCatalog();
  const out: TrialResult[] = [];
  for (const size of opts.sizes) {
    const catalog = expandCatalog(base, size);
    for (const condition of conditions) for (const c of cases) for (let r = 0; r < opts.repeats; r++) {
      const trial = ingestTrial(await executor(c, condition, catalog));
      out.push({ ...trial, catalogSize: trial.catalogSize ?? size });
    }
  }
  return out;
}

export function runAssertion(c: EvalCase): { passed: boolean; output: string } {
  const [cmd, ...args] = c.assertionCommand;
  if (!cmd) throw new Error('INVALID_ASSERTION');
  const r = spawnSync(cmd, args, { cwd: join(ROOT, c.projectFixture), shell: false, encoding: 'utf8' });
  return { passed: r.status === 0, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

export async function runCli(argv: string[]): Promise<string> {
  const f = new Map<string, string>();
  let confirmed = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--held-out-confirmed') confirmed = true;
    else if (['--split', '--sizes', '--repeats', '--out'].includes(argv[i]!) && argv[i + 1] !== undefined) f.set(argv[i]!, argv[++i]!);
    else throw new Error('INVALID_ARGUMENTS');
  }
  const split = f.get('--split');
  if (split !== 'development' && split !== 'held-out') throw new Error('INVALID_ARGUMENTS');
  if (split === 'held-out' && !confirmed) throw new Error('HELD_OUT_NOT_CONFIRMED');
  const sizes = (f.get('--sizes') ?? '10,50,200').split(',').map(Number);
  const repeats = Number(f.get('--repeats') ?? 5);
  if (!sizes.every(Number.isInteger) || !Number.isInteger(repeats) || repeats < 1) throw new Error('INVALID_ARGUMENTS');
  const results = await runTrials(loadCases().filter(c => c.split === split), ['kitroute'],
    { sizes, repeats }, kitrouteSelectionExecutor);
  const bySize = aggregateBy(results, 'catalogSize');
  const out = f.get('--out');
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({
      metric: 'SELECTION success (acceptable routing selection), not task success; no host ran',
      split, repeats, bySize, overall: aggregate(results), results
    }, null, 2));
  }
  return ['size\tselection_success\tmean_guidance_chars\tunnecessary_selections\tmean_added_ms',
    ...Object.entries(bySize).map(([s, m]) =>
      `${s}\t${m.successRate.toFixed(3)}\t${m.meanGuidanceChars.toFixed(1)}\t${m.unnecessarySelections}\t${m.meanAddedMs.toFixed(3)}`)
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(await runCli(process.argv.slice(2))); } catch (e) {
    console.error(e instanceof Error ? e.message : 'EVALUATION_FAILED');
    process.exitCode = 1;
  }
}
