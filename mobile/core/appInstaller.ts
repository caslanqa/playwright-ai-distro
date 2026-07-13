import { execFile } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { adbPath, androidEnv } from './android';
import type { DiscoveredDevice } from './types';

const execFileAsync = promisify(execFile);

// Apps installed during THIS run, keyed by device+source. Mobile runs serial in one worker process,
// so a module-level set installs the app once per run (not before every test) and resets each run.
const installed = new Set<string>();

/** Cache location for a downloaded artifact, keyed by URL hash (stable across a run). */
function cachePath(url: string): string {
  const ext = path.extname(new URL(url).pathname) || '.bin';
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 12);
  return path.join(os.tmpdir(), `pw-ai-app-${hash}${ext}`);
}

/** Download an http(s) artifact to the cache (skipped if already downloaded this run). */
async function download(url: string): Promise<string> {
  const dest = cachePath(url);
  if (fs.existsSync(dest)) {
    return dest;
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[mobile] app download failed (HTTP ${res.status}): ${url}`);
  }
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

/**
 * Resolve an app source (local path or http(s) URL) to a local artifact path. An iOS `.zip` (a zipped
 * `.app`, e.g. a CI artifact) is unzipped and the `.app` bundle inside it is returned.
 */
async function resolveArtifact(source: string): Promise<string> {
  let artifact = /^https?:\/\//.test(source) ? await download(source) : source;
  if (!fs.existsSync(artifact)) {
    throw new Error(`[mobile] app artifact not found: ${source}`);
  }
  if (artifact.endsWith('.zip')) {
    const out = `${artifact}.extracted`;
    if (!fs.existsSync(out)) {
      fs.mkdirSync(out, { recursive: true });
      await execFileAsync('unzip', ['-o', '-q', artifact, '-d', out]);
    }
    const { stdout } = await execFileAsync('find', [out, '-maxdepth', '3', '-name', '*.app']);
    const app = stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)[0];
    if (!app) {
      throw new Error(`[mobile] no .app bundle found inside ${source}`);
    }
    artifact = app;
  }
  return artifact;
}

/**
 * Install the app under test on `device` before a flow runs — once per run (serial worker). Android
 * uses `adb install -r`, which works on emulators AND real devices; iOS uses `xcrun simctl install`
 * (simulators). `source` is a local path or an http(s) URL (iOS URLs must be a `.zip` of the `.app`).
 * The Maestro flow then `launchApp`s the installed app by its `appId`.
 */
export async function ensureAppInstalled(device: DiscoveredDevice, source: string): Promise<void> {
  const key = `${device.id}::${source}`;
  if (installed.has(key)) {
    return;
  }
  const artifact = await resolveArtifact(source);
  if (device.platform === 'android') {
    await execFileAsync(adbPath(), ['-s', device.id, 'install', '-r', artifact], {
      env: androidEnv(),
      timeout: 300_000,
    });
  } else {
    await execFileAsync('xcrun', ['simctl', 'install', device.id, artifact], { timeout: 300_000 });
  }
  installed.add(key);
}
