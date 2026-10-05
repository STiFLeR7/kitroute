export async function runCli(argv: string[], _input: string): Promise<string> {
  if (argv[0] !== 'doctor') throw new Error('UNKNOWN_COMMAND');
  let sqlite = false;
  try {
    await import('node:sqlite');
    sqlite = true;
  } catch {
    // sqlite stays false
  }
  return JSON.stringify({ command: 'doctor', runtime: process.version, sqlite });
}
