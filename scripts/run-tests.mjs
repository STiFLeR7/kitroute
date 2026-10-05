import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function collect(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await collect(path));
    else if (entry.name.endsWith('.test.js')) result.push(path);
  }
  return result;
}
const files = (await collect('dist/tests')).sort();
if (!files.length) throw new Error('NO_TEST_FILES');
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
if (result.error) throw new Error('TEST_RUNNER_FAILED');
process.exitCode = result.status ?? 1;
