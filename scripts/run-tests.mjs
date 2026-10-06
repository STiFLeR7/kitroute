import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = join(root, '.local', 'tmp');
const cache = join(root, '.local', 'npm-cache');
await mkdir(temporary, { recursive: true });
await mkdir(cache, { recursive: true });
const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: {
    ...process.env,
    TEMP: temporary, TMP: temporary, TMPDIR: temporary,
    KITROUTE_HOME: join(root, '.local', 'kitroute-data'),
    npm_config_cache: cache
  }
});
if (result.error) throw new Error('TEST_RUNNER_FAILED');
process.exitCode = result.status ?? 1;
