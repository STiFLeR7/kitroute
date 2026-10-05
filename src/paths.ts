import { realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function normalizeProject(root: string): string {
  let real: string;
  try {
    real = realpathSync.native(root);
  } catch {
    throw new Error('INVALID_PROJECT_ROOT');
  }
  let n = real.replaceAll('\\', '/');
  // keep a bare root such as "/" or "c:/"; strip any other trailing separator
  if (n.length > 1 && !/^[A-Za-z]:\/$/.test(n)) n = n.replace(/\/+$/, '');
  // NTFS is case-insensitive, so lower-case the whole path on Windows
  return process.platform === 'win32' ? n.toLowerCase() : n;
}

export function projectScopeId(normalizedRoot: string, profileId: string): string {
  const tuple = `${normalizedRoot.length}:${normalizedRoot}${profileId.length}:${profileId}`;
  return createHash('sha256').update(tuple).digest('hex');
}
