# Community Release Implementation Plan

> For agentic workers: Use superpowers:executing-plans, or superpowers:subagent-driven-development when the user chooses delegation. Complete task tests before advancing.

Goal: Release a tested free local package through the community channel after M5 passes.

Architecture: Publish compiled code and agent-specific setup metadata in one installable package. Official directory listings follow separately.

Tech Stack: npm package tooling, Node.js, TypeScript build output, and the tested adapters.

Spec: [MVP scope](../../delivery/08_mvp_scope.md), [milestones](../13_milestones.md), and [release ADR](../adrs/27_adr_007_evaluation_release.md).

## Global constraints

Local routing remains free. Windows and Fedora are the tested support targets. Publishing and official submissions require explicit maintainer authorization after the package is reviewable.

## Review focus

The tarball must not contain local databases, user records, or development credentials. Setup must work outside the repository. Public support claims must match recorded versions.

## Task P06.T1: Package content and clean installation

Files: modify package.json, README.md, and .github/workflows/ci.yml; create tests/integration/release-package.test.ts and .npmignore if needed.

Interfaces: use an explicit package files allowlist and a bin entry pointing to compiled code. Preserve the supported runtime floor recorded by the foundation tests.

- [ ] Write a package-manifest test rejecting database files, evaluation results, home directories, and private metadata:

```typescript
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// Invoke the resolved npm CLI with Node to avoid platform-specific npm shell wrappers.
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('RUN_VIA_NPM_TEST');
const packed = spawnSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json'], {
  encoding: 'utf8', shell: false
});
assert.equal(packed.status, 0);
const manifests: Array<{ files: Array<{ path: string }> }> = JSON.parse(packed.stdout);
const packedPaths = manifests.flatMap(manifest => manifest.files.map(file => file.path));
for (const path of packedPaths) {
  assert.equal(/(?:\.db(?:-wal|-shm)?$|evaluation\/results|\.env$)/u.test(path), false);
}
assert.ok(packedPaths.includes('dist/src/cli.js'));
```

Run this test through npm test so npm_execpath identifies the npm CLI. Parse package output as data.

- [ ] Set package files to compiled src, bin wrapper, adapter distribution metadata, README, and the selected license. Exclude compiled tests and evaluation code.
- [ ] Run npm ci, npm test, and npm pack --dry-run --json. Inspect the actual allowlist and record its result.
- [ ] Install the local tarball into a clean temporary prefix on Windows and Fedora. Run doctor, setup preview/apply, an ordinary host request, and uninstall.
- [ ] Commit with build: prepare tested community package.

## Task P06.T2: Community documentation and release record

Files: modify README.md and the compatibility report; create CHANGELOG.md, SUPPORT.md, and the repository license selected by the maintainer.

Interfaces: installation instructions use the single setup command, documented native trust steps, default history retention, and tested host versions.

- [ ] Write installation, setup preview, ordinary usage, history, diagnosis, and uninstall instructions for both systems.
- [ ] State discovery and observation limits. Do not promise automatic loading where only guidance is supported.
- [ ] Document no-background-service behavior, SQLite location, 30-day history, and exclusion of prompts/project code from basic records.
- [ ] Confirm package namespace ownership and availability before replacing the private development package name. Confirm an explicit license before publishing the repository as an open-source project.
- [ ] Record M1-M5 evidence links, package checksum, intended version, support matrix, known limitations, and rollback instructions in the release record.
- [ ] Review the complete package and release documentation. Commit with docs: prepare community release documentation.

## Task P06.T3: Authorized publication and follow-up

Files: update CHANGELOG.md and the numbered release evidence report after publication.

Interfaces: public repository and package publication are separate external actions. The user must authorize the concrete release. Do not infer publication permission from this plan-writing request.

- [ ] Present the package, release record, and test evidence for review before asking for publication authorization.
- [ ] After explicit authorization, publish the reviewed version and record its immutable package identity and repository tag.
- [ ] Install that public version on both systems and run doctor plus setup preview. Record failures before declaring M6 complete.
- [ ] Check current official directory rules against the final adapter packages. Submit only eligible packages after separate authorization.
- [ ] Keep local routing free. Evaluate later paid features from evidence rather than adding them to the first release.

## Milestone M6

M6 is complete only after authorized publication and public-package smoke tests. Preparing a tarball does not mean the product is released. Official directory acceptance remains a later step.
