import { renderGuidance } from './guidance.js';
import type { Capability, RouteRequest, RouteResult, RoutingPolicy } from '../contracts.js';

export const REASON_SELECTED = 'SELECTED';
export const REASON_NO_ELIGIBLE = 'NO_ELIGIBLE';
export const REASON_WEAK_MATCH = 'WEAK_MATCH';
export const GUIDANCE_BUDGET = 'GUIDANCE_BUDGET';

export function select(request: RouteRequest, items: Capability[], policy: RoutingPolicy): RouteResult {
  const start = performance.now();
  const query = new Set(request.text.toLowerCase().match(/[a-z0-9]+/gu) ?? []);
  const eligible = items.filter(item =>
    item.host === request.host && item.projectId === request.projectId &&
    item.policy === 'implicit' && item.availability === 'available' &&
    (item.phases.includes(request.phase) || item.phases.includes('general')));
  const ranked = eligible.map(item => {
    const words = new Set([item.name, item.description, ...item.terms]
      .join(' ').toLowerCase().match(/[a-z0-9]+/gu) ?? []);
    const hits = [...query].filter(word => words.has(word)).length;
    return { item, score: query.size ? hits / query.size : 0 };
  }).filter(candidate => candidate.score > 0 && candidate.score >= policy.minScore)
    .sort((a, b) => b.score - a.score || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
  const selected = ranked.slice(0, policy.maxSelections);
  const { ids, guidance } = renderGuidance(selected.map(({ item }) => item), policy);
  const reason = ids.length ? REASON_SELECTED : selected.length ? GUIDANCE_BUDGET
    : eligible.length ? REASON_WEAK_MATCH : REASON_NO_ELIGIBLE;
  return {
    status: ids.length ? 'selected' : 'abstain',
    ids,
    reasonCodes: [reason],
    guidance,
    elapsedMs: Math.round(performance.now() - start)
  };
}
