import { createHash } from 'node:crypto';
import type { AdapterInput, Phase, SessionState } from '../contracts.js';

const VERIFY = new Set(['test', 'tests', 'testing', 'verify', 'regression', 'check', 'assert', 'ci']);
const REPRODUCE = new Set(['debug', 'reproduce', 'investigate', 'error', 'bug', 'crash', 'failing', 'broken', 'why']);
const IMPLEMENT = new Set(['implement', 'add', 'build', 'write', 'create', 'refactor', 'change', 'fix']);

/**
 * Keyword phase hint from the request text. Precedence: verify > reproduce > implement.
 * ponytail: English-only keyword list; other languages and paraphrases give null (phase kept). Calibrate in P05.
 */
export function phaseFromInput(input: AdapterInput): Phase | null {
  const words = new Set(input.text?.toLowerCase().match(/[a-z0-9]+/gu) ?? []);
  const has = (set: Set<string>) => [...words].some(w => set.has(w));
  if (has(VERIFY)) return 'verify';
  if (has(REPRODUCE)) return 'reproduce';
  if (has(IMPLEMENT)) return 'implement';
  return null;
}

/** Canonical text for rerouting after resume/compaction, so no saved prompt is needed. */
export function continuationText(phase: Phase): string {
  return {
    general: 'general project work',
    reproduce: 'debug reproduce investigate error',
    implement: 'implement fix project behavior',
    verify: 'test verify regression behavior'
  }[phase];
}

/** Signature covers scope, inventory revision, phase and sorted ids. Never prompt text. */
export function advanceState(previous: SessionState, input: AdapterInput, ids: string[]): SessionState {
  const phase = phaseFromInput(input) ?? previous.phase;
  const parts = [input.host, input.projectId ?? '', input.inventoryRevision ?? '', phase, [...ids].sort().join(',')];
  const signature = createHash('sha256').update(parts.map(p => `${p.length}:${p}`).join('|')).digest('hex');
  return { phase, signature };
}
