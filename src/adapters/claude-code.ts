import { basename, dirname } from 'node:path';
import type { Adapter, Capability, InvocationPolicy } from '../contracts.js';
import { discoverSkills } from '../discovery/skills.js';
import { normalizePost, normalizeStart, normalizePrompt, observePost, renderPrompt, validatePromptOutput } from './shared.js';

export const claudeCode: Adapter = {
  host: 'claude-code',
  normalize: (raw, event) => normalizePrompt('claude-code', raw, event, 'prompt_id')
    ?? normalizeStart('claude-code', raw, event)
    ?? normalizePost('claude-code', raw, event, 'PostToolUseFailure'),
  discover: (context) => discoverSkills(context),
  render: renderPrompt,
  validateOutput: validatePromptOutput,
  // Proven in P01.T3: PostToolUse/PostToolUseFailure with tool_name "Skill" and tool_input.skill.
  observe: observePost,
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
// docs: "off" and "user-invocable-only" hide the skill from the model; "on" and "name-only" keep it listed.
const HIDDEN = new Map<string, InvocationPolicy>([['off', 'disabled'], ['user-invocable-only', 'explicit-only']]);
const VISIBLE = ['on', 'name-only'];
const RANK: InvocationPolicy[] = ['disabled', 'explicit-only', 'unknown'];
const overridePolicy = (state: unknown): InvocationPolicy | null =>
  typeof state !== 'string' ? 'unknown' : VISIBLE.includes(state) ? null : HIDDEN.get(state) ?? 'unknown';

// skillOverrides from settings texts in precedence order, lowest first (user, project, project-local); for each
// skill name the highest-precedence file that names it wins. A personal or project skill answers to its frontmatter
// name and its directory name, so either key applies. Unparseable files or values fail closed.
// ponytail: managed settings and --settings files are invisible to hooks and are not read.
export function applyClaudeOverrides(items: Capability[], texts: Array<string | null>): Capability[] {
  const states = new Map<string, unknown>();
  let bad = false;
  for (const text of texts) {
    if (text === null || text.trim() === '') continue;
    let doc: unknown;
    try { doc = JSON.parse(text); } catch { bad = true; continue; }
    const overrides = isObj(doc) ? doc['skillOverrides'] : undefined;
    if (!isObj(doc) || (overrides !== undefined && !isObj(overrides))) { bad = true; continue; }
    for (const [name, state] of Object.entries(overrides ?? {})) states.set(name, state);
  }
  return items.map((c) => {
    if (c.host !== 'claude-code' || c.kind !== 'skill' || c.policy === 'disabled' || c.policy === 'explicit-only') return c;
    if (bad) return { ...c, policy: 'unknown' };
    const found = [c.name, basename(dirname(c.source))].filter((k) => states.has(k)).map((k) => overridePolicy(states.get(k)));
    const policy = RANK.find((p) => found.includes(p));
    return policy ? { ...c, policy } : c;
  });
}
