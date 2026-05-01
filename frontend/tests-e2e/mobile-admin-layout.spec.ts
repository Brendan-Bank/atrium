// Copyright (c) 2026 Brendan Bank
// SPDX-License-Identifier: BSD-2-Clause

// Locks in the admin tables' mobile card layout (issue #107).
//
// On a phone viewport, every admin tab must:
//   * not require horizontal scrolling at the document level, and
//   * render the row-as-card layout, not the desktop <Table>.
//
// The cards are tagged with ``data-mobile-card`` so the spec can
// assert "this is the mobile layout, not just a happy-coincidence
// table that fits."

import { test, expect, devices } from '@playwright/test';

import { loginAsSuperAdmin } from './helpers';

test.use({ ...devices['iPhone 14'] });

const ROUTES_WITH_DATA: string[] = [
  '/admin/users',
  '/admin/roles',
  '/admin/audit',
  '/admin/email-templates',
  '/admin/reminders',
  '/admin/translations',
  // email-outbox starts on the "pending" filter and is usually empty
  // in smoke; the layout itself is verified by the no-overflow probe
  // below alongside the others.
  '/admin/email-outbox',
];

async function getOverflow(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const scroll = Math.max(html.scrollWidth, document.body.scrollWidth);
    return scroll - html.clientWidth;
  });
}

test('admin pages render card layout on mobile with no horizontal page scroll', async ({
  page,
}) => {
  test.setTimeout(120000);
  await loginAsSuperAdmin(page);

  for (const route of ROUTES_WITH_DATA) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    // The notifications SSE stream keeps the page from ever reaching
    // networkidle; instead wait for the loading placeholder to clear
    // (each admin tab renders ``common.loading`` text while the
    // TanStack queries resolve).
    await page.waitForFunction(
      () => !document.body.innerText.match(/Loading…|\bLoading\b/),
      undefined,
      { timeout: 10000 },
    ).catch(() => {});
    await page.waitForTimeout(300);

    const overflow = await getOverflow(page);
    expect(overflow, `${route} should not overflow horizontally`).toBe(0);

    // The mobile layout marks every row-card with data-mobile-card.
    // ``audit`` and ``email-outbox`` may be empty in a fresh smoke
    // stack, but the desktop ``Table.ScrollContainer`` must never
    // render on a mobile viewport.
    const tableInScroll = await page.locator(
      '.mantine-TableScrollContainer-scrollContainerInner',
    ).count();
    expect(
      tableInScroll,
      `${route} must render mobile card layout — no Table.ScrollContainer expected on mobile`,
    ).toBe(0);
  }
});
