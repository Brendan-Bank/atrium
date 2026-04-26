import { expect, test } from '@playwright/test';

import {
  API_URL,
  loginAndPassTOTP,
  loginAsUser,
} from './helpers';

/**
 * Phase 10 — ``users.preferred_language`` on the profile page.
 *
 * Two tests:
 *
 *   1. A user can pick a preferred language on /profile, log out and
 *      back in, and see the UI render in that language straight away.
 *      This pins down both the persistence (PATCH /users/me) and the
 *      bootstrap (i18n init reads the saved value via /users/me on
 *      next mount).
 *
 *   2. After the profile save lands, the header language Select also
 *      reflects the new locale — without a reload — because
 *      ``updateProfile.onSuccess`` calls ``i18n.changeLanguage``.
 */

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const adminTotpSecret = process.env.E2E_ADMIN_TOTP_SECRET;

test.describe('Phase 10 — profile preferred_language', () => {
  test.skip(
    !adminEmail || !adminPassword || !adminTotpSecret,
    'E2E_ADMIN_* env vars not set; run via `make smoke`.',
  );

  test('user can pick a preferred language and it persists across sessions', async ({
    page,
    context,
  }) => {
    const user = await loginAsUser(page);
    await page.goto('/profile');

    // The Select for ``preferred_language`` lives under "Language" /
    // "Taal" — same i18n key as the header switcher. We disambiguate
    // by querying inside the profile <form>, which contains exactly
    // one such control.
    const profileLang = page
      .locator('form')
      .first()
      .getByLabel(/Language|Taal/i);
    await profileLang.click();
    await page.getByRole('option', { name: /Nederlands/ }).click();

    // Save — the button is the first one inside the profile form.
    const savePromise = page.waitForResponse(
      (resp) =>
        resp.url().endsWith('/users/me') &&
        resp.request().method() === 'PATCH' &&
        resp.ok(),
    );
    // Profile uses ``t('common.save')`` — match both EN ("Save") and
    // NL ("Opslaan") so we don't rely on the pre-save locale.
    await page
      .locator('form')
      .first()
      .getByRole('button', { name: /^Save$|^Opslaan$/ })
      .click();
    await savePromise;

    // Log out, then back in — fresh session has no cached i18n state.
    const logoutResp = await page.request.post(`${API_URL}/auth/jwt/logout`);
    expect([200, 204].includes(logoutResp.status())).toBe(true);
    await context.clearCookies();

    await loginAndPassTOTP(page, user.email, user.password, user.totpSecret);

    // Welcome heading should now render in Dutch.
    await expect(
      page.getByRole('heading', { name: /Welkom/ }),
    ).toBeVisible();
  });

  test('language change updates the header switcher selection', async ({
    page,
  }) => {
    await loginAsUser(page);
    await page.goto('/profile');

    const profileLang = page
      .locator('form')
      .first()
      .getByLabel(/Language|Taal/i);
    await profileLang.click();
    await page.getByRole('option', { name: /Nederlands/ }).click();

    const savePromise = page.waitForResponse(
      (resp) =>
        resp.url().endsWith('/users/me') &&
        resp.request().method() === 'PATCH' &&
        resp.ok(),
    );
    await page
      .locator('form')
      .first()
      .getByRole('button', { name: /^Save$|^Opslaan$/ })
      .click();
    await savePromise;

    // The header Select shows the upper-cased locale code as its
    // displayed value (``code.toUpperCase()``). Mantine's
    // ``Select.input`` is the visible <input> the user clicks; assert
    // the value via expect.poll because the i18n change runs after
    // the mutation resolves.
    const headerLang = page.getByLabel(/Language|Taal/i).first();
    await expect.poll(async () => headerLang.inputValue()).toBe('NL');
  });
});
