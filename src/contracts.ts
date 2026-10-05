export type Host = 'claude-code' | 'codex';
export type Phase = 'general' | 'reproduce' | 'implement' | 'verify';
export type Availability = 'available' | 'unavailable' | 'unknown';
export type InvocationPolicy = 'implicit' | 'explicit-only' | 'disabled' | 'unknown';
export type Action = 'native-attach' | 'load-guidance' | 'tool-guidance';

export interface Capability {
  id: string;
  host: Host;
  projectId: string;
  kind: 'skill' | 'tool';
  name: string;
  description: string;
  terms: string[];
  phases: Phase[];
  policy: InvocationPolicy;
  availability: Availability;
  revision: string;
  source: string;
  target: string;
  action: Action;
}

export interface RouteRequest {
  host: Host;
  projectId: string;
  sessionId: string;
  turnId?: string;
  text: string;
  phase: Phase;
}

export interface RouteResult {
  status: 'selected' | 'abstain' | 'degraded';
  ids: string[];
  reasonCodes: string[];
  guidance: string;
  elapsedMs: number;
}

export interface AdapterInput {
  host: Host;
  event: string;
  cwd: string;
  projectId?: string;
  inventoryRevision?: string;
  sessionId: string;
  turnId?: string;
  eventId?: string;
  text?: string;
  toolName?: string;
  skillTarget?: string;
  nativeLoadTarget?: string;
  observedToolAvailable?: string;
  succeeded?: boolean;
}

export interface DiscoveryContext {
  host: Host;
  projectId: string;
  roots: string[];
  nativeInventory?: Capability[];
}

export interface Adapter {
  host: Host;
  normalize(raw: unknown, event: string): AdapterInput | null;
  discover(context: DiscoveryContext): Promise<Capability[]>;
  render(result: RouteResult, event: string): string;
  validateOutput(output: string, event: string): string | null;
  observe(input: AdapterInput, items: Capability[]): Observation | null;
}

export interface Observation {
  capabilityId: string;
  kind: 'native-load' | 'tool-call' | 'file-read' | 'guidance';
  succeeded: boolean | null;
}

export interface UsageRecord {
  host: Host;
  projectId: string;
  sessionId: string;
  capabilityId: string;
  capabilityName: string;
  event: 'selection' | Observation['kind'];
  result: 'success' | 'failure' | 'unknown';
  elapsedMs: number;
  atMs: number;
}

import type { DatabaseSync } from 'node:sqlite';

export interface Store {
  db: DatabaseSync;
  close(): void;
}

export interface RoutingPolicy {
  maxSelections: 3;
  minScore: number;
  maxGuidanceChars: number;
}

export interface SessionState {
  phase: Phase;
  signature: string;
}

export interface Patch {
  file: string;
  beforeHash: string;
  add: Array<{ event: string; entry: Record<string, unknown>; ownedId: string }>;
}

export interface SetupPlan {
  patches: Patch[];
  conflicts: string[];
}

export interface UninstallResult {
  files: Record<string, string>;
  conflicts: string[];
}
