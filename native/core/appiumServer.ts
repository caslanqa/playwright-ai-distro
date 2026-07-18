import { execFileSync, spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

import type { NativePlatform } from './types';

const DEFAULT_URL = 'http://127.0.0.1:4723';

// A server we spawned ourselves and reuse across this worker's tests (Playwright workers are separate
// processes, so a module-level handle is per-worker). Killed on process exit so it never lingers.
let spawned: ChildProcess | undefined;

/** Only ever auto-start a server for a local target — a remote URL is the user's to run. */
function isLocal(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

/** Whether an Appium server answers `GET /status` at `baseUrl` within `timeoutMs`. */
async function isReachable(baseUrl: string, timeoutMs = 2000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/status`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve the project-local `appium` bin (installed as a devDependency), or `undefined`. */
function appiumBin(): string | undefined {
  const bin = process.platform === 'win32' ? 'appium.cmd' : 'appium';
  const local = path.join(process.cwd(), 'node_modules', '.bin', bin);
  return fs.existsSync(local) ? local : undefined;
}

function killSpawned(): void {
  if (spawned && !spawned.killed) {
    try {
      spawned.kill();
    } catch {
      // best-effort; the process may already be gone
    }
  }
  spawned = undefined;
}

/**
 * Ensure an Appium server is reachable and return its base URL, or `null` when none is available and
 * we can't start one (the fixture then SKIPS the test — mirrors mobile's "no device → skip"). Order:
 * 1. if the target URL already answers `GET /status`, use it (a server you started yourself);
 * 2. otherwise, for a LOCAL target, best-effort spawn the project's `appium` bin once and reuse it
 *    across the worker's tests (killed on process exit);
 * 3. if `appium` isn't installed, or a remote target is down, return `null`.
 */
export async function ensureAppiumServer(url?: string): Promise<string | null> {
  const baseUrl = (url || process.env.NATIVE_SERVER_URL || DEFAULT_URL).replace(/\/+$/, '');
  if (await isReachable(baseUrl)) {
    return baseUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return null;
  }
  if (!isLocal(parsed.hostname)) {
    return null;
  }
  // Reuse a server we already spawned in this worker (a previous test's start).
  if (spawned && (await isReachable(baseUrl))) {
    return baseUrl;
  }
  const bin = appiumBin();
  if (!bin) {
    return null;
  }

  const port = parsed.port || '4723';
  spawned = spawn(bin, ['--address', '127.0.0.1', '--port', String(port), '--log-level', 'error'], {
    stdio: 'ignore',
  });
  // Never leak the server past this process.
  process.once('exit', killSpawned);
  process.once('SIGINT', killSpawned);
  process.once('SIGTERM', killSpawned);

  // Poll until it answers (a cold start is a couple of seconds), giving up after ~30s.
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await isReachable(baseUrl)) {
      return baseUrl;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  killSpawned();
  return null;
}

/** Map the resolved native platform to its Appium driver name. */
function driverForPlatform(platform: NativePlatform): string {
  return platform === 'windows' ? 'windows' : 'mac2';
}

// Drivers already verified/installed in this worker process — the check + install runs at most once
// per driver per worker (Playwright workers are separate processes, so a module-level Set is per-worker).
const ensuredDrivers = new Set<string>();

/**
 * Best-effort ensure the Appium driver for `platform` is installed, using the project-local `appium`
 * bin, so a native test "just works" without a manual `appium driver install`. Returns:
 * - `true`  the driver is already installed, or we installed it just now;
 * - `false` it isn't and we can't install it (appium not installed, wrong OS for the driver, or the
 *           install failed) — the fixture then SKIPS, mirroring the no-server path.
 *
 * The mac2 driver only runs on macOS and the windows driver only on Windows, so we never try to install
 * the one that can't run here. Cached per worker, so after the first call it costs one quick
 * `driver list`. The install is a cold npm download — capped at 2 min, then we give up and skip.
 */
export async function ensureAppiumDriver(platform: NativePlatform): Promise<boolean> {
  const driver = driverForPlatform(platform);
  if (ensuredDrivers.has(driver)) {
    return true;
  }
  const osOk =
    (driver === 'mac2' && process.platform === 'darwin') ||
    (driver === 'windows' && process.platform === 'win32');
  if (!osOk) {
    return false;
  }
  const bin = appiumBin();
  if (!bin) {
    return false;
  }
  // Already installed? (`appium driver list --installed` prints the installed driver names.)
  try {
    const installed = execFileSync(bin, ['driver', 'list', '--installed'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20_000,
    });
    if (installed.includes(driver)) {
      ensuredDrivers.add(driver);
      return true;
    }
  } catch {
    // `appium` couldn't list drivers — fall through and try to install it anyway.
  }
  try {
    execFileSync(bin, ['driver', 'install', driver], { stdio: 'ignore', timeout: 120_000 });
    ensuredDrivers.add(driver);
    return true;
  } catch {
    return false;
  }
}
