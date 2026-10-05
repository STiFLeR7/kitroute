import type { Adapter } from '../contracts.js';
import { discoverSkills } from '../discovery/skills.js';
import { normalizePrompt, renderPrompt, validatePromptOutput } from './shared.js';

export const codex: Adapter = {
  host: 'codex',
  normalize: (raw, event) => normalizePrompt('codex', raw, event),
  discover: (context) => discoverSkills(context),
  render: renderPrompt,
  validateOutput: validatePromptOutput,
  // Native observation is P03; unknown is the truthful default until a loading signal is proven.
  observe: () => null,
};
