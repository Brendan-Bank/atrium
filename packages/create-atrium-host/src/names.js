// Copyright (c) 2026 Brendan Bank
// SPDX-License-Identifier: BSD-2-Clause

// Name derivations and validators.
//
// `create-atrium-host casa-del-leone` should give:
//   hostName    = casa-del-leone     (CLI/image tag, lowercase, dash-separated)
//   hostPkg     = casa_del_leone     (Python module, lowercase, underscores)
//   brandName   = Casa Del Leone     (display, title-cased words)
//   brandPascal = CasaDelLeone       (component prefix in TSX)

const PYTHON_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
  'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
  'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
  'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
  'while', 'with', 'yield', 'match', 'case',
]);

// Atrium owns these top-level names — collisions break import resolution
// (`app` is the FastAPI app module; the others would shadow stdlib).
const RESERVED_PKGS = new Set(['app', 'alembic', 'fastapi', 'sqlalchemy', 'pydantic']);

export function validateHostName(name) {
  if (!name) return 'name is required';
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(name)) {
    return 'use lowercase letters, digits, and dashes (e.g. casa-del-leone). ' +
      'must start with a letter and end with a letter or digit.';
  }
  if (name.length > 50) return 'name is too long (max 50 chars)';
  if (name.includes('--')) return 'no consecutive dashes';
  return true;
}

export function validateHostPkg(pkg) {
  if (!pkg) return 'python module name is required';
  if (!/^[a-z][a-z0-9_]*$/.test(pkg)) {
    return 'use lowercase letters, digits, and underscores; must start with a letter';
  }
  if (PYTHON_KEYWORDS.has(pkg)) return `${pkg} is a Python keyword`;
  if (RESERVED_PKGS.has(pkg)) {
    return `${pkg} collides with a reserved name (atrium owns 'app'; others would shadow common libs)`;
  }
  return true;
}

export function validateBrandName(name) {
  if (!name) return 'brand name is required';
  if (name.length > 60) return 'brand name is too long (max 60 chars)';
  return true;
}

const MANTINE_COLORS = new Set([
  'dark', 'gray', 'red', 'pink', 'grape', 'violet', 'indigo', 'blue',
  'cyan', 'teal', 'green', 'lime', 'yellow', 'orange',
]);

export function validateBrandPrimary(value) {
  if (!value) return 'primary colour is required';
  if (!MANTINE_COLORS.has(value)) {
    return `must be a Mantine palette name (${[...MANTINE_COLORS].join(', ')})`;
  }
  return true;
}

export function defaultHostPkg(hostName) {
  return hostName.replace(/-/g, '_');
}

export function defaultBrandName(hostName) {
  return hostName
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function brandPascal(brandName) {
  // Strip non-alphanumeric, capitalize each word, drop spaces. The
  // brand name is human-friendly ("Casa del Leone") so we have to
  // re-derive a JSX-safe identifier from it.
  const cleaned = brandName.replace(/[^A-Za-z0-9 ]/g, ' ');
  const pascal = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  // Identifier can't start with a digit. Prepend "Host" if it does
  // (rare — would require a brand name starting with a digit).
  return /^[A-Za-z]/.test(pascal) ? pascal : `Host${pascal}`;
}
