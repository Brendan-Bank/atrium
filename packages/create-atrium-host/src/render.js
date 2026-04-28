// Copyright (c) 2026 Brendan Bank
// SPDX-License-Identifier: BSD-2-Clause

// Walk the template tree, substitute placeholders in both file paths
// and file contents, write into the destination.
//
// Placeholder convention is `__UPPER_SNAKE__` so a `grep -r __HOST_`
// inside the emitted repo finds anything we forgot to substitute.
// Binary files are passed through unchanged.

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.woff', '.woff2',
  '.ttf', '.otf', '.eot', '.pdf',
]);

function isBinaryPath(path) {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return false;
  return BINARY_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

export function substitute(text, vars) {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    // Match the literal placeholder. Using split+join sidesteps regex
    // escaping; the placeholder set is tiny so the cost is negligible.
    out = out.split(`__${key}__`).join(value);
  }
  return out;
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

export async function renderTemplate({ templateDir, outDir, vars }) {
  const written = [];
  for await (const srcPath of walk(templateDir)) {
    const relPath = relative(templateDir, srcPath);
    const renamedRel = substitute(relPath, vars);
    const destPath = join(outDir, renamedRel);
    await mkdir(dirname(destPath), { recursive: true });
    if (isBinaryPath(srcPath)) {
      // Copy binary as-is.
      const data = await readFile(srcPath);
      await writeFile(destPath, data);
    } else {
      const content = await readFile(srcPath, 'utf8');
      await writeFile(destPath, substitute(content, vars));
    }
    written.push(renamedRel);
  }
  return written;
}

export async function ensureEmptyDir(dir) {
  try {
    const entries = await readdir(dir);
    if (entries.length > 0) {
      throw new Error(`destination ${dir} is not empty`);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      await mkdir(dir, { recursive: true });
      return;
    }
    throw err;
  }
}

export async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}
