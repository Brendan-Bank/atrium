// Copyright (c) 2026 Brendan Bank
// SPDX-License-Identifier: BSD-2-Clause

import { QueryClient } from '@tanstack/react-query';

/** Single QueryClient shared across the home widget, the dedicated
 *  page, and the admin tab. Each one wraps its element in a
 *  QueryClientProvider that points at this client so they share the
 *  cache for ``['hello', 'state']``.
 *
 *  Freshness is driven by the SSE event bus, not a polling interval —
 *  ``main.tsx`` calls ``subscribeEvent('hello.toggled', ...)`` which
 *  invalidates this client the moment a toggle lands. ``staleTime``
 *  bounds how long a fresh fetch is reused for sibling components
 *  mounting back-to-back. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2_000,
      retry: 1,
    },
  },
});
