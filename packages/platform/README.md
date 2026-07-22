# @pwtap/platform

macOS-first **platform seam** for [Playwright Test Automation Platform](https://www.npmjs.com/package/@pwtap/create) plugins — one place for OS paths, shell, device discovery/boot, and a cross-process device lock.

[![npm](https://img.shields.io/npm/v/@pwtap/platform)](https://www.npmjs.com/package/@pwtap/platform)

> You normally **don't install this directly.** It arrives as a runtime dependency of the plugins that need device/OS access (e.g. the mobile engines). Start a project with `npm init @pwtap@latest`.

## Why

Every OS-specific command (Android SDK paths, `adb`, `simctl`, emulator boot, device locking) lives behind one interface, so engines stay OS-agnostic and new platforms are additive rather than scattered `if (process.platform)` branches.

```ts
import { getPlatform } from '@pwtap/platform';

const platform = getPlatform(); // MacPlatform today; throws on unsupported OS with guidance
platform.os; // 'macos'
```

## Surface

- `getPlatform()` → `Platform` (paths + shell helpers).
- Device discovery + boot for Android AVDs and iOS simulators.
- `deviceLock` — an OS-agnostic cross-process lock so two runs never boot or claim the same device.

macOS is implemented today; other OSes throw a clear "add this file" error rather than silently misbehaving.

## License

MIT
