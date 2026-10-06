import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Host } from '../contracts.js';

/** Tested floors from the P01 host-feasibility evidence. */
export const FLOORS: Record<Host, string> = { 'claude-code': '2.1.289', codex: '0.157.1' };
const DIRS: Record<Host, string> = { 'claude-code': '.claude', codex: '.codex' };
const BINS: Record<Host, string> = { 'claude-code': 'claude', codex: 'codex' };
export type Probe = (host: Host) => Promise<string | null>;
export interface HostStatus { host: Host; present: boolean; version: string | null; supported: boolean; note: string }

const semver = (s: string) => /(\d+)\.(\d+)\.(\d+)/.exec(s)?.slice(1).map(Number) ?? null;
const below = (v: number[], floor: string) => {
  const f = semver(floor)!;
  for (let i = 0; i < 3; i++) if (v[i]! !== f[i]!) return v[i]! < f[i]!;
  return false;
};

// shell:false, 3 s timeout.
// On win32 the npm .cmd shim runs through cmd.exe with fixed args; the binary name is a constant.
const defaultProbe: Probe = host => new Promise(resolve => {
  const win = process.platform === 'win32';
  const file = win ? process.env['ComSpec'] || 'cmd.exe' : BINS[host];
  const args = win ? ['/d', '/s', '/c', `${BINS[host]} --version`] : ['--version'];
  execFile(file, args, { timeout: 3000, shell: false, windowsHide: true }, (err, out) =>
    resolve(err ? null : (semver(String(out))?.join('.') ?? null)));
});

export async function detectStatus(homeRoot: string, probe: Probe = defaultProbe): Promise<HostStatus[]> {
  const result: HostStatus[] = [];
  for (const host of ['claude-code', 'codex'] as Host[]) {
    const present = existsSync(join(homeRoot, DIRS[host]));
    if (!present) { result.push({ host, present, version: null, supported: false, note: 'not installed (no config directory)' }); continue; }
    const raw = await probe(host).catch(() => null);
    const v = raw ? semver(raw) : null;
    const version = v ? v.join('.') : null;
    if (!v) result.push({ host, present, version, supported: true, note: `version unknown; tested floor is ${FLOORS[host]}` });
    else if (below(v, FLOORS[host])) result.push({ host, present, version, supported: false, note: `unsupported: ${version} is below tested floor ${FLOORS[host]}` });
    else result.push({ host, present, version, supported: true, note: 'supported' });
  }
  return result;
}

export async function detectHosts(homeRoot: string, probe?: Probe): Promise<Host[]> {
  return (await detectStatus(homeRoot, probe)).filter(s => s.present && s.supported).map(s => s.host);
}
