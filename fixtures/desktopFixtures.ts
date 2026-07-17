import { test as base, expect, type ElectronApplication, type Page } from '@playwright/test';

import { loadEnv } from '@config/loadEnv';
import { ElectronSession } from '@desktop/core/ElectronSession';
import type { DesktopAppConfig } from '@desktop/core/types';

// Load the selected environment (DESKTOP_APP → process.env) before any test runs.
loadEnv();

/** Options this test object adds. */
export interface DesktopOptions {
  /**
   * Desktop app selection. Set per file/describe with `test.use({ desktop: { app: 'example' } })`.
   * - `app` names a catalogued app (desktop/apps.ts); falls back to the `DESKTOP_APP` env var.
   * - `executablePath` points at a packaged Electron build; `main` at an Electron main script
   *   (launched with the installed `electron` binary). Either overrides `app`.
   * - `args` / `cwd` / `env` are passed through to the launched process.
   *
   * The launched window is a Playwright `Page` — the full web API (locators, `expect`, POMs) works on
   * it, and `expectAi` can judge a screenshot of it. See docs/DESKTOP_TESTING.md.
   */
  desktop: DesktopAppConfig | undefined;
}

/** The desktop-run facade: the Electron app, its first window (a Page), and a screenshot helper. */
export interface DesktopFixture {
  /** The Electron application handle — main-process `evaluate`, multi-window access, lifecycle. */
  app: ElectronApplication;
  /** The app's first window as a Playwright `Page` — full Page API (`click`/`fill`/`locator`/`expect`). */
  window: Page;
  /**
   * Screenshot the window, attach it to the report as `<name>`, and return the file path — pipe it
   * into the AI judge: `expectAi({ image: await electron.screenshot('home'), rubric })`.
   */
  screenshot(name: string): Promise<string>;
}

interface DesktopFixtures {
  electron: DesktopFixture;
  window: Page;
}

/** Merge the per-test `desktop` option with the `DESKTOP_APP` env fallback. */
function resolveConfig(option: DesktopOptions['desktop']): DesktopAppConfig {
  const config: DesktopAppConfig = { ...(option ?? {}) };
  if (!config.app && !config.executablePath && !config.main) {
    config.app = process.env.DESKTOP_APP || undefined;
  }
  return config;
}

/**
 * Desktop test object. Adds a `desktop` selection option and an `electron` fixture that launches an
 * Electron app via Playwright's native `_electron` and bridges a real trace + failure screenshot into
 * the report. Extends the plain Playwright base (no browser project needed). The `window` fixture is
 * the app's first window as a `Page`, so authoring is identical to a web test. Import directly:
 * `import { test, expect } from '@fixtures/desktopFixtures'`.
 */
export const test = base.extend<DesktopOptions & DesktopFixtures>({
  desktop: [undefined, { option: true }],

  // `box: true` hides this fixture from the report's Before/After Hooks — the test shows just its own
  // steps, not a `fixture: electron` section, matching how the mobile `maestro` fixture is boxed.
  electron: [
    async ({ desktop }, use, testInfo) => {
      const session = new ElectronSession({
        outputDir: testInfo.outputDir,
        report: (name, attachment) => testInfo.attach(name, attachment),
      });
      try {
        const { app, window } = await session.launch(resolveConfig(desktop));
        await use({
          app,
          window,
          screenshot: name => session.screenshot(name),
        });
      } finally {
        // Stop tracing (attaching a real trace + failure screenshot on failure) and close the app.
        await session.close(testInfo);
      }
    },
    { box: true },
  ],

  // Convenience: the app's first window as a top-level `Page` fixture, so tests read like web tests
  // (`async ({ window }) => { await window.click(...) }`). Same object as `electron.window`.
  window: async ({ electron }, use) => {
    await use(electron.window);
  },
});

export { expect };
