/**
 * Telemetry stub. Per D-5:
 *  - Sentry SaaS for crash reports (opt-in only)
 *  - PostHog Cloud (or self-hosted) for usage metrics (opt-in only)
 *  - No PII, no pubkeys, no RPC URLs, no script source
 *  - Both toggles default off on first run
 *
 * This module defines the interface; concrete implementation is injected by
 * the Electron main process where the user's opt-in flags live.
 */

export interface TelemetryClient {
  /** User has opted into crash reporting. */
  crashEnabled: boolean;
  /** User has opted into anonymous usage stats. */
  usageEnabled: boolean;
  /** Report a captured exception (only sent if crashEnabled). */
  reportError(err: Error, context?: Record<string, unknown>): void;
  /** Record a feature-usage event (only sent if usageEnabled). */
  recordEvent(name: string, properties?: Record<string, unknown>): void;
  /** Tear down clients on shutdown. */
  shutdown(): Promise<void>;
}

export const NULL_TELEMETRY: TelemetryClient = {
  crashEnabled: false,
  usageEnabled: false,
  reportError: () => {},
  recordEvent: () => {},
  shutdown: async () => {},
};

/** Allowlist for properties — anything not in this set is dropped (D-5). */
const ALLOWED_PROPERTY_KEYS = new Set<string>([
  'phase',
  'durationMs',
  'success',
  'verdict',
  'feature',
  'count',
  'cuConsumed',
  'errorCode',
  'platform',
  'arch',
  'appVersion',
]);

export function scrubProperties(raw: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!raw) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (ALLOWED_PROPERTY_KEYS.has(k)) out[k] = v;
  }
  return out;
}
