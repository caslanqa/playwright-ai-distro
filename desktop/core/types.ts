/** Desktop-testing domain types. The desktop engine is Electron, driven natively by Playwright. */

/**
 * Desktop app selection / launch config. Set per file/describe with
 * `test.use({ desktop: { app: 'example' } })`, or point at your own build. Resolution order for what
 * to launch: `executablePath` (a packaged app) → `main` (an Electron main script, launched with the
 * installed `electron` binary) → the named `app` entry in the catalog (desktop/apps.ts).
 */
export interface DesktopAppConfig {
  /** A named entry in the app catalog (desktop/apps.ts), e.g. `'example'`. Falls back to `DESKTOP_APP`. */
  app?: string;
  /** Path to a packaged Electron executable. Overrides `app` / `main`. */
  executablePath?: string;
  /** Path (project-relative) to the app's Electron main script — launched via the installed `electron`. */
  main?: string;
  /** Extra CLI args passed to the app. */
  args?: string[];
  /** Working directory for the launched process. */
  cwd?: string;
  /** Extra environment variables (merged onto the current process env). */
  env?: Record<string, string>;
}

/** A fully-resolved launch spec handed to Playwright's `_electron.launch`. */
export interface LaunchSpec {
  /** Set for a packaged app; omitted when launching a `main` script with the bundled `electron`. */
  executablePath?: string;
  /** Positional args: for a `main` script this is `[<abs main path>, ...extraArgs]`. */
  args: string[];
  cwd?: string;
  /** Full env map (process env + overrides), or `undefined` to inherit the current env. */
  env?: Record<string, string>;
}
