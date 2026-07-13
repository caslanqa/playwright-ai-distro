import { shutdownEmulator } from './core/android';
import { shutdownSim } from './core/ios';
import { clearBootedDevices, readBootedDevices } from './core/session';

/**
 * Playwright `globalTeardown` for mobile runs. Shuts down the devices the framework AUTO-BOOTED this
 * run (recorded by DeviceManager) so emulators/simulators don't linger. Devices you booted yourself
 * are never recorded, so they're left running. Set `MOBILE_KEEP_DEVICES=1` to keep the auto-booted
 * ones too (faster iterative reruns — they're reused next run). Wired only for mobile runs, and a
 * no-op when nothing was booted.
 */
export default async function globalTeardown(): Promise<void> {
  const booted = readBootedDevices();
  if (booted.length === 0) {
    return;
  }
  if (!process.env.MOBILE_KEEP_DEVICES) {
    for (const device of booted) {
      if (device.platform === 'android') {
        await shutdownEmulator(device.id);
      } else {
        await shutdownSim(device.id);
      }
    }
  }
  clearBootedDevices();
}
