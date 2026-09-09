#!/usr/bin/env node
/**
 * Builds the static export (out/) for hosts that can't run Next.js
 * SSR/Middleware (e.g. GitHub Pages, a plain CDN).
 *
 * Next.js hard-fails `next build` when `output: 'export'` is set and
 * middleware.ts exists ("Middleware cannot be used with output: export"),
 * regardless of what the middleware does. Since this project still wants
 * middleware for the SSR/Vercel build (`pnpm build`), we can't just delete
 * it — so this script moves middleware.ts aside for the duration of the
 * static build only, and restores it afterward (even on failure).
 *
 * Usage: pnpm build:static [-- --base-path=/some-other-subpath]
 *
 * Defaults to /comfydocs, matching the subpath this is actually
 * deployed under on the current webhost. Override with --base-path
 * (or NEXT_PUBLIC_BASE_PATH) if that ever changes, or pass an empty
 * string (--base-path=) for a root deployment.
 */
import { existsSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const middlewarePath = path.join(rootDir, 'middleware.ts');
const middlewareBackupPath = path.join(rootDir, 'middleware.ts.static-build-bak');

const DEFAULT_BASE_PATH = '/comfydocs';

const basePathArg = process.argv.find((arg) => arg.startsWith('--base-path='));
const basePath = basePathArg
  ? basePathArg.split('=')[1]
  : (process.env.NEXT_PUBLIC_BASE_PATH ?? DEFAULT_BASE_PATH);

const middlewareExisted = existsSync(middlewarePath);
if (middlewareExisted) {
  renameSync(middlewarePath, middlewareBackupPath);
}

let exitCode = 0;
try {
  const result = spawnSync('pnpm', ['exec', 'next', 'build'], {
    stdio: 'inherit',
    cwd: rootDir,
    env: {
      ...process.env,
      BUILD_MODE: 'static',
      NEXT_PUBLIC_BASE_PATH: basePath,
    },
  });
  exitCode = result.status ?? 1;
} finally {
  if (middlewareExisted) {
    renameSync(middlewareBackupPath, middlewarePath);
  }
}

process.exit(exitCode);
