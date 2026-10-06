import type { Capability, RoutingPolicy } from '../contracts.js';

export function renderGuidance(selected: Capability[], policy: RoutingPolicy) {
  const lines: string[] = [];
  const ids: string[] = [];
  let usedChars = 0;
  for (const item of selected.slice(0, policy.maxSelections)) {
    const line = JSON.stringify({ capability: item.name, action: item.action, target: item.target });
    const addedChars = line.length + (lines.length ? 1 : 0);
    if (usedChars + addedChars > policy.maxGuidanceChars) continue;
    lines.push(line);
    ids.push(item.id);
    usedChars += addedChars;
  }
  return { ids, guidance: lines.join('\n') };
}
