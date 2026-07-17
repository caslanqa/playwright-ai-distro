/** A launchable desktop app in the project's catalog. */
export interface AppSpec {
  /** Path (project-relative) to the Electron main script; launched with the installed `electron` binary. */
  main?: string;
  /** Path to a packaged Electron executable (overrides `main`). */
  executablePath?: string;
  /** Extra CLI args. */
  args?: string[];
  /** Working directory. */
  cwd?: string;
  /** Extra environment variables (merged onto the current env). */
  env?: Record<string, string>;
}

/**
 * The project's desktop app catalog — the single place app launch configs live. Reference an entry
 * by name in a test:
 *
 * @example
 * import { test } from '@fixtures/desktopFixtures';
 * test.use({ desktop: { app: 'example' } }); // type-checked — only entries defined here are selectable
 *
 * Add your own app: point `main` at your Electron entry script (unpackaged), or `executablePath` at a
 * packaged build (e.g. `dist/mac/MyApp.app/Contents/MacOS/MyApp`). See docs/DESKTOP_TESTING.md.
 */
export const apps = {
  // The bundled, build-free example app — lets the desktop layer run green right after `npm i`.
  example: { main: 'desktop/example-app/main.cjs' },
} as const satisfies Record<string, AppSpec>;
