import type { AdapterInput, Host, RouteResult } from '../contracts.js';

const EVENT = 'UserPromptSubmit';
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export function normalizePrompt(host: Host, raw: unknown, event: string, turnKey = 'turn_id'): AdapterInput | null {
  if (event !== EVENT) return null;
  const v = obj(raw);
  if (!v) return null;
  if (typeof v.session_id !== 'string' || typeof v.cwd !== 'string' || typeof v.prompt !== 'string') return null;
  const input: AdapterInput = { host, event, cwd: v.cwd, sessionId: v.session_id, text: v.prompt };
  const turn = v[turnKey];
  if (typeof turn === 'string') input.turnId = turn;
  return input;
}

export function renderPrompt(result: RouteResult, event: string): string {
  if (event !== EVENT || result.status !== 'selected' || result.guidance.trim() === '') return '';
  return JSON.stringify({ hookSpecificOutput: { hookEventName: EVENT, additionalContext: result.guidance } });
}

export function validatePromptOutput(output: string, event: string): string | null {
  if (event !== EVENT) return null;
  if (output === '') return output;
  let v: unknown;
  try {
    v = JSON.parse(output);
  } catch {
    return null;
  }
  const top = obj(v);
  if (!top || Object.keys(top).join() !== 'hookSpecificOutput') return null;
  const h = obj(top.hookSpecificOutput);
  if (!h || Object.keys(h).sort().join() !== 'additionalContext,hookEventName') return null;
  return h.hookEventName === EVENT && typeof h.additionalContext === 'string' && h.additionalContext !== '' ? output : null;
}
