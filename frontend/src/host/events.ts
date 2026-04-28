// Copyright (c) 2026 Brendan Bank
// SPDX-License-Identifier: BSD-2-Clause

/**
 * Atrium host event bus.
 *
 * Atrium owns one ``EventSource('/notifications/stream')`` per tab —
 * the bell uses it to refresh on push, and host bundles use this bus
 * to route ``{kind, payload}`` events at their own React Query cache
 * invalidations. One connection, fanned out in-process to any number
 * of subscribers.
 *
 * Lifecycle: handlers register at host-bundle import time (before the
 * EventSource opens) and stay registered across login / logout
 * cycles. The connection itself is opened by ``useNotificationStream``
 * while the user is logged in; events flow through the bus only when
 * the connection is live, so a logged-out tab is silent without each
 * subscriber having to know.
 *
 * A faulty handler must not poison the rest of the fan-out: each
 * dispatch call is wrapped in try/catch and the failure surfaces as a
 * single console warning. Same convention as the per-kind
 * notification renderers in ``registry.ts``.
 */

/** Wire shape of the SSE ``notification`` event published by
 *  ``app.services.notifications.notify_user``. ``kind`` is the same
 *  free-form string carried on the ``notifications`` row; ``payload``
 *  is the same JSON dict. */
export type AtriumEvent = {
  kind: string;
  payload: Record<string, unknown>;
};

export type AtriumEventHandler = (event: AtriumEvent) => void;

const handlers = new Map<string, Set<AtriumEventHandler>>();

/** Register ``handler`` for events whose ``kind`` matches exactly.
 *
 *  Returns an ``unsubscribe`` function — call it on unmount, route
 *  change, or whenever the handler should stop firing. The same
 *  ``handler`` reference can be subscribed multiple times for the
 *  same kind (each subscription is independent and unsubscribes
 *  separately), but doing so is almost certainly a bug; the bus does
 *  not de-duplicate. */
export function subscribeEvent(
  kind: string,
  handler: AtriumEventHandler,
): () => void {
  let set = handlers.get(kind);
  if (!set) {
    set = new Set();
    handlers.set(kind, set);
  }
  set.add(handler);
  return () => {
    const live = handlers.get(kind);
    if (!live) return;
    live.delete(handler);
    if (live.size === 0) handlers.delete(kind);
  };
}

/** Fan ``event`` out to every handler registered for ``event.kind``.
 *  Unhandled kinds are dropped silently — the bell handler in
 *  ``useNotificationStream`` runs separately and refreshes regardless
 *  of whether anything else is listening. */
export function dispatchAtriumEvent(event: AtriumEvent): void {
  const set = handlers.get(event.kind);
  if (!set || set.size === 0) return;
  // Snapshot so a handler that unsubscribes mid-fan-out doesn't mutate
  // the iterator we're walking.
  const snapshot = Array.from(set);
  for (const h of snapshot) {
    try {
      h(event);
    } catch (err) {
      console.warn(
        `[atrium-events] handler for kind "${event.kind}" threw; ` +
          `other subscribers were unaffected`,
        err,
      );
    }
  }
}

/** Decode the SSE ``data:`` payload into an ``AtriumEvent``. Returns
 *  ``null`` for malformed JSON, missing/non-string ``kind``, or any
 *  other shape mismatch — callers (notably ``useNotificationStream``)
 *  treat ``null`` as "skip the bus dispatch but still refresh the
 *  bell", because the presence of an event is enough to drive the
 *  unconditional list / unread-count refetch even when the body
 *  doesn't parse. */
export function parseAtriumEvent(raw: string): AtriumEvent | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.kind !== 'string') return null;
  const rawPayload = obj.payload;
  const payload =
    rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
      ? (rawPayload as Record<string, unknown>)
      : {};
  return { kind: obj.kind, payload };
}

/** Test-only: drop every subscription. Production code never calls
 *  this — host bundles register once at boot and stay. */
export function __resetEventBusForTests(): void {
  handlers.clear();
}

/** Test-only: handler count for a specific kind. Used by registry
 *  tests to assert subscribe/unsubscribe wiring without reaching into
 *  the module-level state directly. */
export function __eventBusSubscriberCountForTests(kind: string): number {
  return handlers.get(kind)?.size ?? 0;
}
