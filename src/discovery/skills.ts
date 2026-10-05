import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Capability, DiscoveryContext, Host, InvocationPolicy } from '../contracts.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const lp = (s: string) => `${s.length}:${s}`;

export function frontmatter(text: string): { data: Record<string, unknown>; block: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text);
  if (!match) throw new Error('INVALID_SKILL_METADATA');
  let value: unknown;
  try {
    value = parse(match[1]!);
  } catch {
    throw new Error('INVALID_SKILL_METADATA');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_SKILL_METADATA');
  }
  return { data: value as Record<string, unknown>, block: match[0] };
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function parseSkill(text: string, source: string, host: Host, projectId: string): Capability {
  const { data, block } = frontmatter(text);
  const { name, description } = data;
  if (!nonEmpty(name) || !nonEmpty(description)) throw new Error('INVALID_SKILL_METADATA');
  const canonical = source.replaceAll('\\', '/');
  let policy: InvocationPolicy = 'implicit';
  // Only Claude Code reads this key; Codex policy comes from agents/openai.yaml (see discoverSkills).
  if (host === 'claude-code' && 'disable-model-invocation' in data) {
    const flag = data['disable-model-invocation'];
    policy = flag === true ? 'explicit-only' : flag === false ? 'implicit' : 'unknown';
  }
  const terms = [...new Set(`${name} ${description}`.toLowerCase().match(/[a-z0-9-]{3,}/g) ?? [])].sort();
  return {
    id: sha(`${lp(host)}${lp(projectId)}${lp(canonical)}`),
    host,
    projectId,
    kind: 'skill',
    name,
    description,
    terms,
    phases: ['general', 'reproduce', 'implement', 'verify'],
    policy,
    availability: 'available',
    revision: sha(block),
    source,
    target: source,
    action: 'load-guidance',
  };
}

async function codexPolicy(yamlText: string): Promise<InvocationPolicy> {
  try {
    const v: unknown = parse(yamlText);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return 'unknown';
    const policy = (v as Record<string, unknown>)['policy'];
    if (policy === undefined || policy === null) return 'implicit';
    if (typeof policy !== 'object' || Array.isArray(policy)) return 'unknown';
    const flag = (policy as Record<string, unknown>)['allow_implicit_invocation'];
    if (flag === undefined) return 'implicit';
    return flag === false ? 'explicit-only' : flag === true ? 'implicit' : 'unknown';
  } catch {
    return 'unknown';
  }
}

const readOrNull = (p: string) => readFile(p, 'utf8').catch(() => null);

export async function discoverSkills(context: DiscoveryContext): Promise<Capability[]> {
  const out: Capability[] = [...(context.nativeInventory ?? [])];
  const seen = new Set(out.map((c) => c.name));
  for (const root of context.roots) {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue; // missing root
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!e.isDirectory()) continue;
      const file = join(root, e.name, 'SKILL.md');
      const text = await readOrNull(file);
      if (text === null) continue;
      let cap: Capability;
      try {
        cap = parseSkill(text, file, context.host, context.projectId);
      } catch {
        continue; // malformed: excluded
      }
      if (seen.has(cap.name)) continue;
      if (context.host === 'codex') {
        const yamlText = await readOrNull(join(root, e.name, 'agents', 'openai.yaml'));
        if (yamlText !== null) {
          cap.policy = await codexPolicy(yamlText);
          cap.revision = sha(`${lp(cap.revision)}${lp(yamlText)}`);
        }
      }
      seen.add(cap.name);
      out.push(cap);
    }
  }
  return out;
}

// Documented user/project roots only, in host precedence order. Omitted: Claude enterprise (managed
// settings dir), plugin and --add-dir/nested roots; Codex parent-dir .agents/skills, /etc/codex/skills,
// bundled system skills. Native inventory covers those.
export function skillRoots(host: Host, projectRoot: string, home: string): string[] {
  return host === 'claude-code'
    ? [join(home, '.claude', 'skills'), join(projectRoot, '.claude', 'skills')]
    : [join(projectRoot, '.agents', 'skills'), join(home, '.agents', 'skills')];
}
