// Copyright (c) 2026 Brendan Bank
// SPDX-License-Identifier: BSD-2-Clause

import { spawn } from 'node:child_process';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}: ${stderr}`));
    });
  });
}

export async function gitAvailable() {
  try {
    await run('git', ['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function initRepo(cwd) {
  // -b main so first-time users get the modern default branch name
  // without having to set init.defaultBranch globally.
  await run('git', ['init', '-b', 'main'], { cwd });
  await run('git', ['add', '.'], { cwd });
  // -n bypasses commit hooks (the freshly scaffolded repo has none
  // yet, but a parent .gitconfig-installed pre-commit could fire on
  // any subdirectory). --no-gpg-sign because the user hasn't decided
  // whether they want signing on this repo yet; they can amend the
  // initial commit if they do. Both stay non-interactive so the
  // scaffolder doesn't hang behind a pinentry prompt.
  await run('git', ['commit', '-n', '--no-gpg-sign', '-m', 'Initial scaffold'], {
    cwd,
    env: { ...process.env, GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? process.env.USER ?? 'scaffold', GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL ?? 'scaffold@local', GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? process.env.USER ?? 'scaffold', GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL ?? 'scaffold@local' },
  });
}
