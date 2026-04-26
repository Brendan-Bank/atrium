/**
 * Playwright config for the Hello World smoke spec.
 *
 * Lives inside ``examples/hello-world/frontend`` so Playwright's
 * module resolver can find both the dev deps (Playwright, otplib)
 * and the spec's helpers from a single ``node_modules`` tree.
 * Pointed at the dev SPA on :5173 by default; override with
 * E2E_BASE_URL for a different port.
 *
 * Timeouts are deliberately tight — the example runs in ~20 s end to
 * end when healthy, so a single slow assertion is a real failure
 * rather than something to wait out. Failure feedback over wait
 * tolerance: if any of these prove too tight in practice, raise the
 * specific ``test.setTimeout`` for the offending case rather than
 * lifting the global ceiling.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // No retries — a flake re-run doubles the failure-feedback time and
  // hides instability. Fix the underlying issue when something breaks.
  retries: 0,
  workers: 1,
  // Per-test ceiling. The toggle case is the longest at ~16 s; keep
  // headroom for cold-cache CI runs without letting a hang go silent.
  timeout: 30_000,
  expect: {
    // Polled assertions like toBeVisible/toHaveText fail in ~3 s.
    // Atrium's home widget renders well under a second once the host
    // bundle has loaded; 3 s is comfortably above that.
    timeout: 3_000,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    // Per-action ceilings so a hung click or fetch doesn't sit at the
    // 30 s test ceiling.
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
