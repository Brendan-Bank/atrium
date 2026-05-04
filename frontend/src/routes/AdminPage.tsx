// Copyright (c) 2026 Brendan Bank
// SPDX-License-Identifier: BSD-2-Clause

import { Stack, Text, Title } from '@mantine/core';
import { useEffect, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  useAdminSectionItems,
  useSettingsSectionItems,
  type SectionItem,
} from '@/admin/sections';

interface Props {
  /** Sidebar bucket this route renders. ``admin`` is the historical
   *  catch-all (atrium tabs + host admin tooling); ``settings`` is the
   *  parallel host-only group above it. */
  bucket: 'admin' | 'settings';
}

/** Single page that drives both ``/admin/:section?`` and
 *  ``/settings/:section?``. The horizontal Tabs strip is gone — the
 *  sidebar is now the navigation surface — and each section is its
 *  own URL so deep-links and back-button work naturally. */
export function SectionPage({ bucket }: Props) {
  const { t } = useTranslation();
  const params = useParams<{ section?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const adminItems = useAdminSectionItems();
  const settingsItems = useSettingsSectionItems();
  const items = bucket === 'admin' ? adminItems : settingsItems;

  // Renderable leaves are the items SectionPage actually mounts at
  // ``/admin/:section`` / ``/settings/:section``. Host-registered
  // groups don't render here — their children point at host routes
  // outside the bucket URL space — so they're filtered out of the
  // lookup and redirect-to-first.
  const leaves = items.filter(
    (item): item is SectionItem & { render: () => ReactElement } =>
      typeof item.render === 'function',
  );

  // Pick the first nav target the bucket parent should bounce to. A
  // group at the head of the list resolves to its first child's
  // ``to`` so the sidebar's "Admin" / "Settings" parent link still
  // lands on a real page when the bucket has no flat leaves of its
  // own.
  const firstTarget: string | null = (() => {
    for (const item of items) {
      if (item.children && item.children.length > 0) {
        const child = item.children[0];
        if (child) return child.to ?? `/${bucket}/${child.key}`;
        continue;
      }
      if (typeof item.render === 'function') {
        return `/${bucket}/${item.key}`;
      }
    }
    return null;
  })();

  // Redirect legacy ``?tab=key`` bookmarks (the pre-0.17 URL shape) to
  // the matching path so existing admin links don't 404. Drops the
  // search param on the replace so we don't loop.
  const legacyTab = new URLSearchParams(location.search).get('tab');
  useEffect(() => {
    if (!legacyTab || params.section) return;
    if (leaves.some((item) => item.key === legacyTab)) {
      navigate(`/${bucket}/${legacyTab}`, { replace: true });
    }
  }, [legacyTab, params.section, leaves, bucket, navigate]);

  const titleKey = bucket === 'admin' ? 'nav.admin' : 'nav.settings';

  if (items.length === 0 || firstTarget === null) {
    return (
      <Stack>
        <Title order={2}>{t(titleKey)}</Title>
        <Text c="dimmed" size="sm">
          {t(
            bucket === 'settings'
              ? 'settings.empty'
              : 'admin.noVisibleSections',
          )}
        </Text>
      </Stack>
    );
  }

  const requested = params.section ?? null;
  const active = requested
    ? leaves.find((item) => item.key === requested)
    : undefined;

  // No path param yet — bounce to the first available nav target so
  // the sidebar's parent link lands on a real page.
  if (!requested) {
    return <Navigate to={firstTarget} replace />;
  }

  // Path param doesn't match a renderable leaf (perm change, host tab
  // unregistered, typo, or the user manually typed a group key). Fall
  // back to the first nav target rather than a bare 404 — admin nav
  // UX is forgiving on purpose.
  if (!active) {
    return <Navigate to={firstTarget} replace />;
  }

  return (
    <Stack>
      <Title order={2}>{active.label}</Title>
      {active.render()}
    </Stack>
  );
}

/** Back-compat alias so existing imports keep working. */
export const AdminPage = (): ReturnType<typeof SectionPage> => (
  <SectionPage bucket="admin" />
);
