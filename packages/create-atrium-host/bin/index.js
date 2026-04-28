#!/usr/bin/env node
// Copyright (c) 2026 Brendan Bank
// SPDX-License-Identifier: BSD-2-Clause

// Thin shim that forwards into the CLI module. Lives separately so
// `package.json#bin` can stay pointed at a stable path while the
// implementation moves.
import('../src/cli.js').then(({ run }) => run(process.argv.slice(2)));
