# Copyright (c) 2026 Brendan Bank
# SPDX-License-Identifier: BSD-2-Clause

# Hello World host extension image. Two stages:
#
#   1. frontend-builder — node + pnpm, builds the host SPA bundle
#      (a single main.js dynamic-imported by atrium at runtime).
#   2. runtime — FROM the published atrium image, pip-installs the
#      host backend package into atrium's venv, and copies the host
#      bundle into /opt/atrium/static/host so atrium serves it at
#      /host/main.js (same origin as the SPA, no CORS).
#
# Built from the repo root so COPY can reach examples/hello-world/.
# The compose file does this for you.

# Global ARG — must be declared before the first FROM to be usable as
# the base image of a later stage.
ARG ATRIUM_IMAGE=ghcr.io/brendan-bank/atrium:latest

# ---- frontend-builder ----
FROM node:25-alpine AS frontend-builder
WORKDIR /app
RUN npm install -g pnpm@10.33.1
COPY examples/hello-world/frontend/package.json examples/hello-world/frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install
COPY examples/hello-world/frontend/ ./
# Same default as the unified atrium image — bundle calls relative
# paths (`/hello/state`, `/hello/toggle`) so it lands on whatever
# origin the SPA was loaded from.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN pnpm build

# ---- runtime ----
FROM ${ATRIUM_IMAGE} AS runtime

USER root
COPY examples/hello-world/backend /opt/host_app
# atrium's runtime image uses uv to build the venv but doesn't install
# pip into it (uv installs deps directly). Bootstrap pip via ensurepip
# so we can pip-install the host package — slightly slower than uv but
# avoids adding uv to the runtime image just for this one install.
RUN /opt/venv/bin/python -m ensurepip --upgrade \
 && /opt/venv/bin/python -m pip install --no-cache-dir /opt/host_app

# Bake the host bundle into atrium's static dir at /host/main.js.
COPY --from=frontend-builder /app/dist /opt/atrium/static/host

USER app
