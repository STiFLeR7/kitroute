import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSkill, discoverSkills, skillRoots } from '../../src/discovery/skills.js';
import { projectScopeId } from '../../src/paths.js';
import type { Capability } from '../../src/contracts.js';

const fixtures = fileURLToPath(new URL('../../../tests/fixtures/skills/', import.meta.url));
const fx = (n: string) => readFile(join(fixtures, n, 'SKILL.md'), 'utf8');
const md = (name: string, extra = '', desc = 'Does a thing') =>
  `---\nname: ${name}\ndescription: ${desc}\n${extra}---\nBody.`;

async function tmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'kitroute-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function skill(root: string, dir: string, text: string, extraFiles: Record<string, string> = {}) {
  await mkdir(join(root, dir), { recursive: true });
  await writeFile(join(root, dir, 'SKILL.md'), text);
  for (const [f, c] of Object.entries(extraFiles)) {
    await mkdir(join(root, dir, f, '..'), { recursive: true });
    await writeFile(join(root, dir, f), c);
  }
}

test('explicit-only frontmatter stays explicit-only', () => {
  const text = '---\nname: publish\ndescription: Publish a package\ndisable-model-invocation: true\n---\nPublish.';
  const result = parseSkill(text, '/synthetic/publish/SKILL.md', 'claude-code', 'project-a');
  assert.equal(result.policy, 'explicit-only');
});

test('valid fixture parses with implicit policy', async () => {
  const c = parseSkill(await fx('valid'), '/s/valid/SKILL.md', 'claude-code', 'p');
  assert.equal(c.name, 'valid-skill');
  assert.equal(c.kind, 'skill');
  assert.equal(c.policy, 'implicit');
  assert.equal(c.availability, 'available');
  assert.equal(c.action, 'load-guidance');
  assert.deepEqual(c.terms, ['does', 'thing', 'valid', 'valid-skill']);
  assert.equal(c.phases.length, 4);
});

test('explicit-only fixture', async () => {
  assert.equal(parseSkill(await fx('explicit-only'), '/s/SKILL.md', 'claude-code', 'p').policy, 'explicit-only');
});

test('malformed metadata throws a fixed code and is excluded from discovery', async () => {
  const bad = await fx('malformed');
  assert.throws(() => parseSkill(bad, '/s/SKILL.md', 'claude-code', 'p'), (e: Error) => e.message === 'INVALID_SKILL_METADATA');
  assert.throws(() => parseSkill('no frontmatter', '/s', 'claude-code', 'p'), /INVALID_SKILL_METADATA/);
  assert.throws(() => parseSkill(md('x', '', '""'), '/s', 'claude-code', 'p'), /INVALID_SKILL_METADATA/);
  assert.throws(() => parseSkill(md('123'), '/s', 'claude-code', 'p'), /INVALID_SKILL_METADATA/);
  const found = await discoverSkills({ host: 'claude-code', projectId: 'p', roots: [fixtures] });
  assert.deepEqual(found.map((c) => c.name).sort(), ['publish', 'valid-skill']);
});

test('non-boolean disable flag is unknown, false is implicit', () => {
  const p = (v: string) => parseSkill(md('x', `disable-model-invocation: ${v}\n`), '/s', 'claude-code', 'p').policy;
  assert.equal(p('"true"'), 'unknown');
  assert.equal(p('yes-please'), 'unknown');
  assert.equal(p('false'), 'implicit');
});

test('codex openai.yaml controls policy', async () => {
  await tmp(async (root) => {
    await skill(root, 'a', md('a'), { 'agents/openai.yaml': 'policy:\n  allow_implicit_invocation: false\n' });
    await skill(root, 'b', md('b'), { 'agents/openai.yaml': 'policy: [oops\n' });
    await skill(root, 'c', md('c'), { 'agents/openai.yaml': 'policy:\n  allow_implicit_invocation: "no"\n' });
    await skill(root, 'd', md('d'));
    await skill(root, 'e', md('e'), { 'agents/openai.yaml': 'policy:\n  allow_implicit_invocation: true\n' });
    const r = await discoverSkills({ host: 'codex', projectId: 'p', roots: [root] });
    const pol = Object.fromEntries(r.map((c) => [c.name, c.policy]));
    assert.deepEqual(pol, { a: 'explicit-only', b: 'unknown', c: 'unknown', d: 'implicit', e: 'implicit' });
  });
});

test('same skill in two projects gets different id and projectId', () => {
  const a = parseSkill(md('x'), '/s/SKILL.md', 'claude-code', 'project-a');
  const b = parseSkill(md('x'), '/s/SKILL.md', 'claude-code', 'project-b');
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.projectId, b.projectId);
});

test('two profiles sharing a project root get different ids', () => {
  const a = parseSkill(md('x'), '/s/SKILL.md', 'codex', projectScopeId('/proj', 'work'));
  const b = parseSkill(md('x'), '/s/SKILL.md', 'codex', projectScopeId('/proj', 'personal'));
  assert.notEqual(a.id, b.id);
});

test('root not in context.roots is never read', async () => {
  await tmp(async (dir) => {
    await skill(join(dir, 'active'), 'a', md('a'));
    await skill(join(dir, 'inactive'), 'b', md('b'));
    const r = await discoverSkills({ host: 'claude-code', projectId: 'p', roots: [join(dir, 'active'), join(dir, 'missing')] });
    assert.deepEqual(r.map((c) => c.name), ['a']);
  });
});

test('duplicate name: first root wins; scan is one level only', async () => {
  await tmp(async (dir) => {
    await skill(join(dir, 'r1'), 'dup', md('dup', '', 'first'));
    await skill(join(dir, 'r2'), 'dup', md('dup', '', 'second'));
    await skill(join(dir, 'r2'), 'nested/deep', md('deep'));
    const r = await discoverSkills({ host: 'claude-code', projectId: 'p', roots: [join(dir, 'r1'), join(dir, 'r2')] });
    assert.equal(r.length, 1);
    assert.equal(r[0]!.description, 'first');
  });
});

test('native inventory wins; unknown native tool stays unknown; no file tools', async () => {
  await tmp(async (dir) => {
    await skill(dir, 'x', md('x', '', 'from file'));
    await skill(dir, 'y', md('y'));
    const base = parseSkill(md('x', '', 'native'), '/n', 'claude-code', 'p');
    const tool: Capability = { ...base, id: 't', kind: 'tool', name: 'mcp-thing', availability: 'unknown', action: 'tool-guidance' };
    const r = await discoverSkills({ host: 'claude-code', projectId: 'p', roots: [dir], nativeInventory: [base, tool] });
    assert.deepEqual(r.map((c) => c.name), ['x', 'mcp-thing', 'y']);
    assert.equal(r[0]!.description, 'native');
    assert.equal(r[1]!.availability, 'unknown');
    assert.equal(r.filter((c) => c.kind === 'tool').length, 1);
  });
});

test('revision changes when metadata changes (and codex yaml)', async () => {
  const a = parseSkill(md('x', '', 'one'), '/s', 'claude-code', 'p');
  const b = parseSkill(md('x', '', 'two'), '/s', 'claude-code', 'p');
  assert.notEqual(a.revision, b.revision);
  assert.equal(a.revision, parseSkill(md('x', '', 'one') + ' more body', '/s', 'claude-code', 'p').revision);
  await tmp(async (root) => {
    await skill(root, 'a', md('a'), { 'agents/openai.yaml': 'policy:\n  allow_implicit_invocation: true\n' });
    const r1 = (await discoverSkills({ host: 'codex', projectId: 'p', roots: [root] }))[0]!;
    await writeFile(join(root, 'a', 'agents', 'openai.yaml'), 'policy:\n  allow_implicit_invocation: false\n');
    const r2 = (await discoverSkills({ host: 'codex', projectId: 'p', roots: [root] }))[0]!;
    assert.notEqual(r1.revision, r2.revision);
  });
});

test('CRLF frontmatter parses', () => {
  const c = parseSkill('---\r\nname: crlf\r\ndescription: Windows file\r\ndisable-model-invocation: true\r\n---\r\nBody', '/s', 'claude-code', 'p');
  assert.equal(c.name, 'crlf');
  assert.equal(c.policy, 'explicit-only');
});

test('skillRoots returns documented roots in precedence order', () => {
  assert.deepEqual(skillRoots('claude-code', '/p', '/h'), [join('/h', '.claude', 'skills'), join('/p', '.claude', 'skills')]);
  assert.deepEqual(skillRoots('codex', '/p', '/h'), [join('/p', '.agents', 'skills'), join('/h', '.agents', 'skills')]);
});
