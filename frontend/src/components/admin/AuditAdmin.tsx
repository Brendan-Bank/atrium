// Copyright (c) 2026 Brendan Bank
// SPDX-License-Identifier: BSD-2-Clause

import { Fragment, useState } from 'react';
import {
  Badge,
  Code,
  Group,
  Pagination,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import { useAuditLog, type AuditEntry } from '@/hooks/useAudit';

const PAGE_SIZE = 50;

const ACTION_COLORS: Record<string, string> = {
  create: 'teal',
  update: 'blue',
  delete: 'red',
  cancel: 'orange',
  login: 'gray',
};

export function AuditAdmin() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState<string | null>(null);
  const isMobile =
    useMediaQuery('(max-width: 48em)', false, { getInitialValueInEffect: false });

  const { data, isLoading } = useAuditLog({
    entity: entity ?? undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>{t('audit.title')}</Title>
        <TextInput
          placeholder={t('audit.filterEntity')}
          w={220}
          value={entity ?? ''}
          onChange={(e) => {
            const v = e.currentTarget.value.trim();
            setEntity(v.length ? v : null);
            setPage(1);
          }}
        />
      </Group>

      {isMobile ? (
        <Stack gap="xs">
          {isLoading && <Text c="dimmed">{t('common.loading')}</Text>}
          {!isLoading && (data?.items.length ?? 0) === 0 && (
            <Text c="dimmed">{t('audit.empty')}</Text>
          )}
          {data?.items.map((e) => <AuditRow key={e.id} entry={e} mobile />)}
        </Stack>
      ) : (
        <Paper withBorder>
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing="sm" highlightOnHover style={{ whiteSpace: 'nowrap' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={24}></Table.Th>
                  <Table.Th>{t('audit.when')}</Table.Th>
                  <Table.Th>{t('audit.actor')}</Table.Th>
                  <Table.Th>{t('audit.entity')}</Table.Th>
                  <Table.Th>{t('audit.action')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoading && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Text c="dimmed">{t('common.loading')}</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {!isLoading && (data?.items.length ?? 0) === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Text c="dimmed">{t('audit.empty')}</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {data?.items.map((e) => <AuditRow key={e.id} entry={e} />)}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

      {data && data.total > PAGE_SIZE && (
        <Group justify="center">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
}

function AuditRow({ entry, mobile }: { entry: AuditEntry; mobile?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const when = new Date(entry.created_at + (entry.created_at.endsWith('Z') ? '' : 'Z'));
  const hasDiff = entry.diff != null;
  const { t } = useTranslation();

  if (mobile) {
    const header = (
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap={6} wrap="nowrap">
          {hasDiff &&
            (expanded ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            ))}
          <Text size="xs" c="dimmed">{when.toLocaleString()}</Text>
        </Group>
        <Badge
          color={ACTION_COLORS[entry.action] ?? 'gray'}
          variant="light"
          size="sm"
        >
          {entry.action}
        </Badge>
      </Group>
    );

    return (
      <Paper withBorder p="sm" data-mobile-card>
        <Stack gap={6}>
          {hasDiff ? (
            <UnstyledButton onClick={() => setExpanded((x) => !x)}>
              {header}
            </UnstyledButton>
          ) : (
            header
          )}
          <Group gap={6} wrap="nowrap" align="baseline">
            <Text size="xs" c="dimmed" style={{ minWidth: 56 }}>
              {t('audit.actor')}
            </Text>
            <Text size="sm" style={{ wordBreak: 'break-all' }}>
              {entry.actor_email ?? '—'}
            </Text>
          </Group>
          <Group gap={6} wrap="nowrap" align="baseline">
            <Text size="xs" c="dimmed" style={{ minWidth: 56 }}>
              {t('audit.entity')}
            </Text>
            <Text size="sm">
              {entry.entity} #{entry.entity_id}
            </Text>
          </Group>
          {hasDiff && expanded && (
            <Code
              block
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 11 }}
            >
              {JSON.stringify(entry.diff, null, 2)}
            </Code>
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <Fragment>
      <Table.Tr
        onClick={hasDiff ? () => setExpanded((x) => !x) : undefined}
        style={{ cursor: hasDiff ? 'pointer' : 'default' }}
      >
        <Table.Td w={24}>
          {hasDiff &&
            (expanded ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            ))}
        </Table.Td>
        <Table.Td>
          <Text size="xs">{when.toLocaleString()}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{entry.actor_email ?? '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">
            {entry.entity} #{entry.entity_id}
          </Text>
        </Table.Td>
        <Table.Td>
          <Badge
            color={ACTION_COLORS[entry.action] ?? 'gray'}
            variant="light"
            size="sm"
          >
            {entry.action}
          </Badge>
        </Table.Td>
      </Table.Tr>
      {hasDiff && expanded && (
        <Table.Tr>
          <Table.Td></Table.Td>
          <Table.Td colSpan={4}>
            <Code block>{JSON.stringify(entry.diff, null, 2)}</Code>
          </Table.Td>
        </Table.Tr>
      )}
    </Fragment>
  );
}
