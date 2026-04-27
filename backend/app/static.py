# Copyright (c) 2026 Brendan Bank
# SPDX-License-Identifier: BSD-2-Clause

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles
from starlette.types import Scope


class SPAStaticFiles(StaticFiles):
    """Serve a built single-page app with React-Router-style fallback.

    Mirrors the nginx ``try_files $uri $uri/ /index.html;`` rule that
    the standalone web container used before atrium-backend and
    atrium-web were merged into one image. Any GET that doesn't resolve
    to a real file falls back to index.html so the SPA's client-side
    router takes over. Non-GET 404s still raise so a curl POST to an
    unknown path doesn't get a sea of HTML back.

    Also stamps long-lived cache headers on /assets/* (Vite hashes
    those filenames so they're safe to cache forever) and short-lived
    no-store on index.html itself (so a deploy ships immediately).
    """

    async def get_response(self, path: str, scope: Scope):
        try:
            response = await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404 and scope.get("method") == "GET":
                response = await super().get_response("index.html", scope)
            else:
                raise

        if path.startswith("assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path in ("", "index.html"):
            response.headers["Cache-Control"] = "no-store"

        return response
