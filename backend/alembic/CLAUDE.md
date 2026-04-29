# backend/alembic/ — atrium migrations

Notes the root `CLAUDE.md` would otherwise need a paragraph for. If
you're adding or reading a migration, this is the orientation.

## Chain layout

One linear chain. Never branch. Filenames are `YYYY_MM_DD_NNNN-NNNN_<slug>.py`
where `NNNN` is the four-digit revision id; `revision` and `down_revision`
in the file body are the canonical references.

Current head is whichever `0NNN_<slug>` has no `down_revision` pointing
at it from another file — `ls versions/ | tail -1` is the fastest way
to find it. Don't trust this README's prose to be current; the
filesystem is.

The standard atrium worker container runs `alembic upgrade head` on
boot, so a host migration that lands here lands automatically on the
next deploy. Out-of-band runners (some CI pipelines, hand-managed
prod boxes) need to add it.

## Conventions

- **Both `upgrade()` and `downgrade()`** — even when the downgrade
  is lossy (e.g. dropping a not-null column with no default), document
  the data-loss in the docstring and write the body anyway. Migrations
  with no downgrade are a footgun in the rollback path.
- **No seed migrations for `app_settings` namespaces.** Defaults come
  from the Pydantic model registered with `register_namespace(...)`;
  rows materialise on the first PUT. Adding a new field to a
  `BrandConfig` / `AuthConfig` etc. needs **no** alembic change —
  `model_validate` re-applies the default on read. Migrations are for
  table shape changes, FK reshapes, permission seeds (see below), and
  template bulk-inserts.
- **Permissions seed via `INSERT IGNORE`.** New permissions added in
  later migrations need to be granted to existing roles too — the
  cross-join in `0001` only fires once. The pattern:
  ```sql
  INSERT IGNORE INTO permissions (code, description) VALUES (...);
  INSERT IGNORE INTO role_permissions (role_id, permission_code)
  SELECT r.id, '<new_perm>' FROM roles r
  WHERE r.code IN ('super_admin', 'admin');
  ```
  See `0006_email_outbox_perm` for the canonical worked example.
- **Async vs sync.** `alembic/env.py` builds an async engine (because
  the runtime DSN is `mysql+aiomysql://...`), but the migration body
  uses sync `op.execute(...)` / `op.bulk_insert(...)` as usual —
  alembic handles the bridge.
- **MySQL DDL gotchas.** `ALTER TABLE ... DROP PRIMARY KEY` then
  `ADD PRIMARY KEY` is the canonical PK reshape — see
  `0005_email_template_per_locale` for the dance, including the
  reminder_rules FK introspection needed before dropping the
  referenced PK.
- **`RUF001` / `RUF003`.** Source files are ASCII — em-dashes etc.
  belong in user-facing strings, not migration prose.

## Host-app migrations

Atrium owns `alembic_version`; host apps own `alembic_version_app`
(separate table). Host migrations live in the host repo's own
`alembic/versions/` and run via the host's `alembic_app.ini` against
the host's `app.host_sdk.alembic` Base. Two heads advance
independently — see `docs/published-images.md` for the contract.

## Test fixture interaction

The pytest conftest TRUNCATEs most tables between tests but **preserves**
`app_settings`, `email_templates`, and `permissions` (those are
invariant across tests). `roles` + `role_permissions` ARE truncated
and re-seeded per test (`_reseed_rbac` in conftest). If you add a
permission via a migration, no test fixture change is needed —
re-seeding via `_reseed_rbac` cross-joins all existing permissions
to admin / super_admin.
