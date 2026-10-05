/** Read a stream as UTF-8; setEncoding keeps multibyte characters intact across chunk boundaries. */
export async function readAll(s: NodeJS.ReadableStream): Promise<string> {
  s.setEncoding('utf8');
  let raw = '';
  for await (const c of s) raw += c;
  return raw;
}

export const writeStdout = (s: string): Promise<void> =>
  new Promise((res, rej) => process.stdout.write(s, e => (e ? rej(e) : res())));

/** Write guidance first and commit dedupe state / usage rows only after the write succeeded, so a missed
 *  deadline or failed write never suppresses later identical guidance.
 *  Residual window: a kill after the write but before the parent hook reads it still loses that guidance
 *  while the state is saved (or not yet saved, if killed during commit); the next change re-emits. */
export async function emitThenCommit(out: string, write: (s: string) => Promise<void>, commit: () => void): Promise<void> {
  if (out !== '') {
    try { await write(out); } catch { return; }
  }
  commit();
}
