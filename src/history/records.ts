import type { AdapterInput, Observation, Store, UsageRecord } from '../contracts.js';
import { storeError, withTransaction } from '../storage/database.js';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function toUsageRecord(value: unknown): UsageRecord {
  const invalid = () => new Error('INVALID_USAGE_RECORD');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const row = value as Record<string, unknown>;
  for (const field of ['projectId', 'sessionId', 'capabilityId', 'capabilityName']) {
    if (typeof row[field] !== 'string' || !row[field].trim()) throw invalid();
  }
  if (!['claude-code', 'codex'].includes(row.host as string)) throw invalid();
  if (!['selection', 'native-load', 'tool-call', 'file-read', 'guidance']
    .includes(row.event as string)) throw invalid();
  if (!['success', 'failure', 'unknown'].includes(row.result as string)) throw invalid();
  for (const field of ['elapsedMs', 'atMs']) {
    if (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || row[field] < 0) throw invalid();
  }
  return {
    host: row.host as UsageRecord['host'],
    projectId: row.projectId as string, sessionId: row.sessionId as string,
    capabilityId: row.capabilityId as string, capabilityName: row.capabilityName as string,
    event: row.event as UsageRecord['event'], result: row.result as UsageRecord['result'],
    elapsedMs: row.elapsedMs as number, atMs: row.atMs as number
  };
}

export function appendUsage(store: Store, record: UsageRecord): void {
  const r = toUsageRecord(record);
  try {
    store.db.prepare(`INSERT INTO usage (host, project_id, session_id, capability_id, capability_name,
      event, result, elapsed_ms, at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(r.host, r.projectId, r.sessionId, r.capabilityId, r.capabilityName, r.event, r.result, r.elapsedMs, r.atMs);
  } catch (e) {
    throw storeError(e, 'STORE_WRITE_FAILED');
  }
}

/** Delete rows older than 30 days (boundary kept). Returns the number deleted. */
export function pruneUsage(store: Store, nowMs: number): number {
  try {
    store.db.prepare('DELETE FROM observed_events WHERE at_ms < ?').run(nowMs - RETENTION_MS);
    store.db.prepare('DELETE FROM session_state WHERE updated_at < ?').run(nowMs - RETENTION_MS);
    return Number(store.db.prepare('DELETE FROM usage WHERE at_ms < ?').run(nowMs - RETENTION_MS).changes);
  } catch (e) {
    throw storeError(e, 'STORE_WRITE_FAILED');
  }
}

/** Newest first. */
export function listUsage(store: Store, limit = 200): UsageRecord[] {
  try {
    return store.db.prepare(`SELECT host, project_id AS projectId, session_id AS sessionId,
      capability_id AS capabilityId, capability_name AS capabilityName, event, result,
      elapsed_ms AS elapsedMs, at_ms AS atMs FROM usage ORDER BY at_ms DESC LIMIT ?`)
      .all(limit) as unknown as UsageRecord[];
  } catch (e) {
    throw storeError(e, 'STORE_READ_FAILED');
  }
}

/**
 * Save one observed event. With a host event id, a repeat delivery returns false and writes nothing.
 * ponytail: without an id nothing can be deduped (distinct calls must not be guessed away).
 */
export function recordObservation(
  store: Store, input: AdapterInput, obs: Observation, capabilityName: string, nowMs: number
): boolean {
  return withTransaction(store, () => {
    if (input.eventId !== undefined) {
      const r = store.db.prepare('INSERT OR IGNORE INTO observed_events (host, session_id, event_id, at_ms) VALUES (?, ?, ?, ?)')
        .run(input.host, input.sessionId, input.eventId, nowMs);
      if (Number(r.changes) === 0) return false;
    }
    appendUsage(store, {
      host: input.host, projectId: input.projectId as string, sessionId: input.sessionId,
      capabilityId: obs.capabilityId, capabilityName, event: obs.kind,
      result: obs.succeeded === true ? 'success' : obs.succeeded === false ? 'failure' : 'unknown',
      elapsedMs: 0, atMs: nowMs
    });
    return true;
  });
}

export function observedUse(event: Observation): boolean {
  return event.kind === 'native-load' || event.kind === 'tool-call';
}
