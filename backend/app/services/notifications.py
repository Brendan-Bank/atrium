# Copyright (c) 2026 Brendan Bank
# SPDX-License-Identifier: BSD-2-Clause

"""In-app notification helper.

Writes a `notifications` row and pokes the user's SSE channel via
`event_hub` so the bell refetches and host bundles can route the
typed event to selective React Query cache invalidations. Caller
controls the transaction — this just `session.add`s.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ops import Notification
from app.services.event_hub import hub


def notify_user(
    session: AsyncSession,
    *,
    user_id: int,
    kind: str,
    payload: dict[str, Any],
) -> None:
    """Add a notification row and publish the matching SSE event.

    The published event mirrors the row: ``{"kind": kind, "payload":
    payload}``. The bell refetches on every event regardless of kind;
    host bundles use the kind to invalidate only their own affected
    query keys instead of fanning out a broad refresh.
    """
    session.add(Notification(user_id=user_id, kind=kind, payload=payload))
    hub.publish(user_id, {"kind": kind, "payload": payload})
