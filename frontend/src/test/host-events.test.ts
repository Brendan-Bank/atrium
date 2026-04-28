// Copyright (c) 2026 Brendan Bank
// SPDX-License-Identifier: BSD-2-Clause

/**
 * Vitest coverage for the host event bus.
 *
 * Pins down the contract host bundles rely on: subscribe returns an
 * unsubscribe handle, kinds are matched exactly (no glob), unhandled
 * kinds are silent, throwing handlers don't poison the rest of the
 * fan-out.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  __eventBusSubscriberCountForTests,
  __resetEventBusForTests,
  dispatchAtriumEvent,
  parseAtriumEvent,
  subscribeEvent,
} from '@/host/events';

describe('host event bus', () => {
  beforeEach(() => {
    __resetEventBusForTests();
  });

  it('dispatch fans out to every subscriber for the matching kind', () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeEvent('booking.created', a);
    subscribeEvent('booking.created', b);

    dispatchAtriumEvent({ kind: 'booking.created', payload: { id: 7 } });

    expect(a).toHaveBeenCalledWith({
      kind: 'booking.created',
      payload: { id: 7 },
    });
    expect(b).toHaveBeenCalledWith({
      kind: 'booking.created',
      payload: { id: 7 },
    });
  });

  it('dispatch ignores subscribers registered for a different kind', () => {
    const block = vi.fn();
    const booking = vi.fn();
    subscribeEvent('block.updated', block);
    subscribeEvent('booking.created', booking);

    dispatchAtriumEvent({ kind: 'booking.created', payload: { id: 1 } });

    expect(block).not.toHaveBeenCalled();
    expect(booking).toHaveBeenCalledOnce();
  });

  it('dispatch is silent for kinds with no subscribers', () => {
    expect(() =>
      dispatchAtriumEvent({ kind: 'nobody.cares', payload: {} }),
    ).not.toThrow();
  });

  it('unsubscribe stops further fan-out for that handler only', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeEvent('booking.created', a);
    subscribeEvent('booking.created', b);

    offA();
    dispatchAtriumEvent({ kind: 'booking.created', payload: { id: 1 } });

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });

  it('unsubscribe of the last handler clears the kind from the table', () => {
    const off = subscribeEvent('booking.created', () => {});
    expect(__eventBusSubscriberCountForTests('booking.created')).toBe(1);
    off();
    expect(__eventBusSubscriberCountForTests('booking.created')).toBe(0);
  });

  it('a handler that throws does not poison other subscribers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const exploding = vi.fn(() => {
        throw new Error('boom');
      });
      const ok = vi.fn();
      subscribeEvent('booking.created', exploding);
      subscribeEvent('booking.created', ok);

      dispatchAtriumEvent({ kind: 'booking.created', payload: {} });

      expect(exploding).toHaveBeenCalledOnce();
      expect(ok).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it('a handler that unsubscribes mid-fan-out does not skip its sibling', () => {
    // Snapshot semantics: dispatch iterates over a copy of the
    // subscriber set, so a handler removing itself (or another) does
    // not corrupt the iteration.
    const calls: string[] = [];
    let offA: (() => void) | null = null;
    const a = vi.fn(() => {
      calls.push('a');
      offA?.();
    });
    const b = vi.fn(() => {
      calls.push('b');
    });
    offA = subscribeEvent('booking.created', a);
    subscribeEvent('booking.created', b);

    dispatchAtriumEvent({ kind: 'booking.created', payload: {} });

    expect(calls).toEqual(['a', 'b']);
  });

  it('the same handler subscribed twice for one kind fires once per dispatch', () => {
    // Set semantics — adding the same reference twice is a no-op.
    const handler = vi.fn();
    subscribeEvent('booking.created', handler);
    subscribeEvent('booking.created', handler);

    dispatchAtriumEvent({ kind: 'booking.created', payload: {} });

    expect(handler).toHaveBeenCalledOnce();
  });
});

describe('parseAtriumEvent', () => {
  it('decodes the canonical {kind, payload} wire format', () => {
    const evt = parseAtriumEvent(
      JSON.stringify({ kind: 'booking.created', payload: { id: 7 } }),
    );
    expect(evt).toEqual({
      kind: 'booking.created',
      payload: { id: 7 },
    });
  });

  it('treats a missing payload as an empty object', () => {
    const evt = parseAtriumEvent(JSON.stringify({ kind: 'block.updated' }));
    expect(evt).toEqual({ kind: 'block.updated', payload: {} });
  });

  it('treats a non-object payload as an empty object', () => {
    // Defensive: backend should never ship a non-object payload, but
    // a misbehaving host (or future schema drift) shouldn't break the
    // dispatcher.
    const evt = parseAtriumEvent(
      JSON.stringify({ kind: 'block.updated', payload: ['not', 'an', 'object'] }),
    );
    expect(evt).toEqual({ kind: 'block.updated', payload: {} });
  });

  it('returns null for malformed JSON', () => {
    expect(parseAtriumEvent('not json')).toBeNull();
  });

  it('returns null when kind is missing', () => {
    expect(parseAtriumEvent(JSON.stringify({ payload: {} }))).toBeNull();
  });

  it('returns null when kind is not a string', () => {
    expect(
      parseAtriumEvent(JSON.stringify({ kind: 42, payload: {} })),
    ).toBeNull();
  });

  it('returns null when the message is not an object', () => {
    expect(parseAtriumEvent(JSON.stringify('refresh'))).toBeNull();
    expect(parseAtriumEvent(JSON.stringify(null))).toBeNull();
  });
});
