import type { Capability, RouteRequest, RoutingPolicy } from '../../src/contracts.js';

export function makeCapability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: 'synthetic-debug', host: 'codex', projectId: 'a', kind: 'skill',
    name: 'debug', description: 'Debug a checkout error', terms: ['checkout'],
    phases: ['general', 'reproduce'], policy: 'implicit', availability: 'available',
    revision: 'fixture-v1', source: '/synthetic/debug/SKILL.md',
    target: '/synthetic/debug/SKILL.md', action: 'load-guidance', ...overrides
  };
}

export const request: RouteRequest = {
  host: 'codex', projectId: 'a', sessionId: 's', turnId: 't',
  text: 'Debug a checkout error', phase: 'reproduce'
};
export const policy: RoutingPolicy = {
  maxSelections: 3, minScore: 0.2, maxGuidanceChars: 2000
};
