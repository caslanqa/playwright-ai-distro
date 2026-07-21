import path from 'node:path';

import type { PluginManifest } from '../manifest.js';
import { readText, writeText } from '../util/fs.js';
import { addToRegion, hasRegion, removeFromRegion } from '../util/markers.js';

function barrelPath(clientDir: string): string {
  return path.join(clientDir, 'fixtures', 'index.ts');
}

function importLine(f: NonNullable<PluginManifest['fixture']>): string {
  const testExport = f.testExport ?? 'test';
  const parts = [`${testExport} as ${f.testAlias}`];
  if (f.expectExport && f.expectAlias) {
    parts.push(`${f.expectExport} as ${f.expectAlias}`);
  }
  return `import { ${parts.join(', ')} } from '${f.importFrom}';`;
}

/**
 * Splice a plugin's fixture into fixtures/index.ts: its import, its `mergeTests` arg, and (if it
 * ships matchers) its `mergeExpects` arg. Returns false if a managed marker is missing so the caller
 * can print a paste block instead of half-editing.
 */
export function applyFixture(clientDir: string, m: PluginManifest): boolean {
  const f = m.fixture;
  if (!f) {
    return true;
  }
  const file = barrelPath(clientDir);
  let src = readText(file);
  if (!hasRegion(src, 'plugins:imports') || !hasRegion(src, 'plugins:tests')) {
    return false;
  }
  src = addToRegion(src, 'plugins:imports', importLine(f), f.importFrom);
  src = addToRegion(src, 'plugins:tests', `  ${f.testAlias},`, `${f.testAlias},`);
  if (f.expectAlias) {
    src = addToRegion(src, 'plugins:expects', `  ${f.expectAlias},`, `${f.expectAlias},`);
  }
  writeText(file, src);
  return true;
}

/** Reverse applyFixture. */
export function removeFixture(clientDir: string, m: PluginManifest): void {
  const f = m.fixture;
  if (!f) {
    return;
  }
  const file = barrelPath(clientDir);
  let src = readText(file);
  src = removeFromRegion(src, 'plugins:imports', f.importFrom);
  src = removeFromRegion(src, 'plugins:tests', `${f.testAlias},`);
  if (f.expectAlias) {
    src = removeFromRegion(src, 'plugins:expects', `${f.expectAlias},`);
  }
  writeText(file, src);
}
