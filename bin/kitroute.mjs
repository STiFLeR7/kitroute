#!/usr/bin/env node
import { runCli } from '../dist/src/cli.js';

try {
  let input = '';
  if (['route', 'hook'].includes(process.argv[2])) {
    let bytes = 0;
    const chunks = [];
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) throw new Error('INPUT_TOO_LARGE');
      chunks.push(chunk);
    }
    input = Buffer.concat(chunks).toString('utf8');
  }
  process.stdout.write(await runCli(process.argv.slice(2), input));
} catch {
  if (process.argv[2] !== 'hook') {
    process.stderr.write('KITROUTE_COMMAND_FAILED\n');
    process.exitCode = 1;
  }
}
