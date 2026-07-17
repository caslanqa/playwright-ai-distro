import fs from 'fs';
import path from 'path';

import {
  _electron as electron,
  type ElectronApplication,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { apps, type AppSpec } from '../apps';
import type { DesktopAppConfig, LaunchSpec } from './types';

/** How the fixture lets the session write evidence into the Playwright report. */
export interface DesktopSessionHooks {
  /** Directory for this test's artifacts (screenshots, trace). */
  outputDir: string;
  /** Attach a file/body to the report — bound to the current step (usually `testInfo.attach`). */
  report(
    name: string,
    attachment: { path?: string; body?: Buffer | string; contentType: string }
  ): Promise<void>;
}

/** Build a full string env from the current process env plus overrides, or `undefined` to inherit. */
function mergeEnv(extra?: Record<string, string>): Record<string, string> | undefined {
  if (!extra || Object.keys(extra).length === 0) {
    return undefined;
  }
  const base: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      base[key] = value;
    }
  }
  return { ...base, ...extra };
}

/**
 * Layer-1 desktop adapter: launches an Electron app with Playwright's native `_electron`, records a
 * **real** Chromium trace, and bridges failure evidence into the report. The launched window IS a
 * Playwright `Page`, so the existing web POM patterns, `expect`, and `expectAi` all work unchanged —
 * and unlike the mobile engine the trace/screenshot are genuine, not empty. One session per test.
 */
export class ElectronSession {
  private app?: ElectronApplication;
  private window?: Page;
  private tracing = false;

  constructor(private readonly hooks: DesktopSessionHooks) {}

  /** Resolve the config to a launch spec (explicit executable, a `main` script, or a catalog entry). */
  private resolve(config: DesktopAppConfig | undefined): LaunchSpec {
    const spec: AppSpec | undefined = config?.app
      ? apps[config.app as keyof typeof apps]
      : undefined;
    if (config?.app && !spec) {
      throw new Error(
        `[desktop] unknown app '${config.app}' — add it to desktop/apps.ts (known: ${Object.keys(apps).join(', ')})`
      );
    }
    const executablePath = config?.executablePath ?? spec?.executablePath;
    const main = config?.main ?? spec?.main;
    const extraArgs = config?.args ?? spec?.args ?? [];
    const cwd = config?.cwd ?? spec?.cwd;
    const env = mergeEnv({ ...(spec?.env ?? {}), ...(config?.env ?? {}) });

    if (executablePath) {
      return { executablePath, args: extraArgs, cwd, env };
    }
    if (main) {
      return { args: [path.resolve(process.cwd(), main), ...extraArgs], cwd, env };
    }
    throw new Error(
      "[desktop] no app to launch — set test.use({ desktop: { app: 'example' } }), pass " +
        'executablePath/main, or set DESKTOP_APP in env/environments.json. See docs/DESKTOP_TESTING.md'
    );
  }

  /** Launch the app and return the app handle + its first window (a Playwright `Page`). */
  async launch(
    config: DesktopAppConfig | undefined
  ): Promise<{ app: ElectronApplication; window: Page }> {
    const spec = this.resolve(config);
    try {
      this.app = await electron.launch({
        executablePath: spec.executablePath,
        args: spec.args,
        cwd: spec.cwd,
        env: spec.env,
      });
    } catch (error) {
      // The most common failure by far: `electron` isn't installed. Surface the fix, not a stack.
      const detail = (error as Error).message;
      throw new Error(
        `[desktop] failed to launch Electron — is it installed? Run \`npm i -D electron\`.\n${detail}`
      );
    }
    // Real Chromium trace over the Electron context — attached on failure in close().
    try {
      await this.app.context().tracing.start({ screenshots: true, snapshots: true });
      this.tracing = true;
    } catch {
      // Tracing is best-effort; never block the test if it can't start.
    }
    this.window = await this.app.firstWindow();
    return { app: this.app, window: this.window };
  }

  /** Screenshot the current window into the output dir, attach it, and return the file path. */
  async screenshot(name: string): Promise<string> {
    if (!this.window) {
      throw new Error('[desktop] screenshot() called before the app window was ready');
    }
    const file = path.join(this.hooks.outputDir, `${name}.png`);
    await this.window.screenshot({ path: file });
    await this.hooks.report(name, { path: file, contentType: 'image/png' });
    return file;
  }

  /**
   * Tear down: on failure, stop the trace into the output dir + attach it and a final screenshot; on
   * success, stop tracing without saving. Always closes the app. Safe to call more than once.
   */
  async close(testInfo: TestInfo): Promise<void> {
    if (!this.app) {
      return;
    }
    const failed = testInfo.status !== testInfo.expectedStatus;
    try {
      if (this.tracing) {
        if (failed) {
          const tracePath = path.join(this.hooks.outputDir, 'trace.zip');
          await this.app.context().tracing.stop({ path: tracePath });
          if (fs.existsSync(tracePath)) {
            // Named 'trace' so the HTML report renders its "View trace" button.
            await this.hooks.report('trace', { path: tracePath, contentType: 'application/zip' });
          }
        } else {
          await this.app.context().tracing.stop();
        }
        this.tracing = false;
      }
      if (failed && this.window) {
        try {
          const shot = path.join(this.hooks.outputDir, 'failure.png');
          await this.window.screenshot({ path: shot });
          await this.hooks.report('failure', { path: shot, contentType: 'image/png' });
        } catch {
          // The window may already be gone on a crash — failure evidence is best-effort.
        }
      }
    } finally {
      try {
        await this.app.close();
      } catch {
        // The app may have exited already.
      }
      this.app = undefined;
      this.window = undefined;
    }
  }
}
