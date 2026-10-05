import type { AdapterInput, Capability, Host, Observation, RouteResult } from '../contracts.js';

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

/** Post-tool events only. Copies identifiers and the skill name; never tool_input/response/error text. */
export function normalizePost(host: Host, raw: unknown, event: string, failureEvent?: string): AdapterInput | null {
  if (event !== 'PostToolUse' && event !== failureEvent) return null;
  const v = obj(raw);
  if (!v || typeof v.session_id !== 'string' || typeof v.cwd !== 'string' || typeof v.tool_name !== 'string') return null;
  const input: AdapterInput = { host, event, cwd: v.cwd, sessionId: v.session_id, toolName: v.tool_name };
  const skill = obj(v.tool_input)?.skill;
  if (host === 'claude-code' && v.tool_name === 'Skill' && typeof skill === 'string') input.skillTarget = skill;
  if (typeof v.tool_use_id === 'string') input.eventId = v.tool_use_id;
  if (host === 'claude-code') input.succeeded = event === 'PostToolUse'; // Codex payload has no success field
  return input;
}

/** Match a post-tool event to a capability of the active host and project. Codex skill loads stay unknown. */
export function observePost(input: AdapterInput, items: Capability[]): Observation | null {
  if (input.projectId === undefined) return null;
  const scope = items.filter(c => c.host === input.host && c.projectId === input.projectId);
  const succeeded = input.succeeded ?? null;
  if (input.host === 'claude-code' && input.skillTarget !== undefined) {
    const s = scope.find(c => c.kind === 'skill' && c.name === input.skillTarget);
    return s ? { capabilityId: s.id, kind: 'native-load', succeeded } : null;
  }
  const t = input.toolName === undefined ? undefined : scope.find(c => c.kind === 'tool' && c.target === input.toolName);
  return t ? { capabilityId: t.id, kind: 'tool-call', succeeded } : null;
}
