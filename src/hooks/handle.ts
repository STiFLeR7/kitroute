import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Host } from '../contracts.js';
import { claudeCode } from '../adapters/claude-code.js';
import { codex } from '../adapters/codex.js';

export function runWorker(
  workerPath: string, host: Host, event: string, input: string,
  validateOutput: (raw: string) => string | null, deadlineMs = 2500
): Promise<string> {
  if (Buffer.byteLength(input) > 1024 * 1024) return Promise.resolve('');
  return new Promise(resolve => {
    const child = spawn(process.execPath, [workerPath, host, event], {
      stdio: ['pipe', 'pipe', 'pipe'], shell: false
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const finish = (output: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(output);
    };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(''); }, deadlineMs);
    child.stderr.resume();
    child.stdin.on('error', () => { child.kill('SIGKILL'); finish(''); });
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 65536) { child.kill('SIGKILL'); finish(''); return; }
      if (!settled) chunks.push(chunk);
    });
    child.once('error', () => finish(''));
    child.once('close', code => {
      if (code !== 0) { finish(''); return; }
      try { finish(validateOutput(Buffer.concat(chunks).toString('utf8')) ?? ''); }
      catch { finish(''); }
    });
    child.stdin.end(input);
  });
}

const DEFAULT_WORKER = fileURLToPath(new URL('./worker.js', import.meta.url));

export async function handleHook(
  host: Host, event: string, input: string, workerPath = DEFAULT_WORKER, deadlineMs?: number
): Promise<string> {
  const adapter = host === 'claude-code' ? claudeCode : codex;
  try {
    return await runWorker(workerPath, host, event, input, raw => adapter.validateOutput(raw, event), deadlineMs);
  } catch { return ''; }
}
