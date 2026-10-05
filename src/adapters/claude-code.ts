import type { Adapter } from '../contracts.js';
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
