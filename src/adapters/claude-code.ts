import type { Adapter } from '../contracts.js';
import { discoverSkills } from '../discovery/skills.js';
import { normalizePrompt, renderPrompt, validatePromptOutput } from './shared.js';

export const claudeCode: Adapter = {
  host: 'claude-code',
  normalize: (raw, event) => normalizePrompt('claude-code', raw, event, 'prompt_id'),
  discover: (context) => discoverSkills(context),
  render: renderPrompt,
  validateOutput: validatePromptOutput,
  // Native observation is P03; unknown is the truthful default until a loading signal is proven.
  observe: () => null,
};
