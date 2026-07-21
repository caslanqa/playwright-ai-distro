import { createRequire } from 'node:module';
import path from 'node:path';

import type { PluginManifest } from '../manifest.js';
import { copyDir, ensureDir, exists } from '../util/fs.js';

/** Absolute root of an installed package, or null when it can't be resolved from the client. */
function packageRoot(clientDir: string, pkg: string): string | null {
  try {
    const require = createRequire(`${clientDir}/`);
    return path.dirname(require.resolve(`${pkg}/package.json`, { paths: [clientDir] }));
  } catch {
    return null;
  }
}

/** Copy a plugin's example tests/flows into the client once — never overwriting existing files. */
export function copyExamples(clientDir: string, m: PluginManifest): void {
  copyAssets(clientDir, m, m.examples);
}

/** Copy a plugin's docs into the client (e.g. docs/MAESTRO.md). */
export function copyDocs(clientDir: string, m: PluginManifest): void {
  copyAssets(clientDir, m, m.docs);
}

function copyAssets(
  clientDir: string,
  m: PluginManifest,
  assets: Array<{ src: string; dest: string }> | undefined,
): void {
  if (!assets?.length) {
    return;
  }
  const root = packageRoot(clientDir, m.name);
  if (!root) {
    return;
  }
  for (const { src, dest } of assets) {
    const from = path.join(root, src);
    const to = path.join(clientDir, dest);
    if (!exists(from) || exists(to)) {
      continue; // skip missing sources and never overwrite user files
    }
    ensureDir(path.dirname(to));
    copyDir(from, to);
  }
}
