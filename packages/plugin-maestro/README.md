# @pwtap/plugin-maestro

Mobile testing for the [Playwright Test Automation Platform](https://www.npmjs.com/package/@pwtap/create) via [Maestro](https://maestro.mobile.dev) — Android + iOS simulator, macOS-first. One `maestro` fixture, two authoring styles you can mix in a single test.

[![npm](https://img.shields.io/npm/v/@pwtap/plugin-maestro)](https://www.npmjs.com/package/@pwtap/plugin-maestro)

## Install

Into a `@pwtap` project (wires the fixture, an env-gated `maestro` project, env keys, and examples):

```bash
npx create-pwtap add maestro
```

## Two styles, mixable

```ts
import { test, expect } from '@fixtures';
import { devices } from '@pwtap/plugin-maestro';

test.use({ mobile: devices.android }); // or { platform: 'android', device: 'Pixel_API_35' }

// Imperative (Playwright-style) — each call is one Maestro command against a warm device driver:
test('sign in', async ({ maestro }) => {
  await maestro.launchApp('com.example.app');
  await maestro.tapOn('Login');
  await maestro.inputText('cihan');
  if (await maestro.isVisible('Cookie banner')) await maestro.tapOn('Accept');
  await maestro.assertVisible('Dashboard');
});

// Batch YAML — run an authored flow file:
test('smoke flow', async ({ maestro }) => {
  await maestro.run('tests/maestro/flows/android/login.yaml');
});
```

The imperative surface covers `launchApp`, `tapOn`/`doubleTapOn`/`longPressOn`, `inputText`/`eraseText`, `assertVisible`/`assertNotVisible`, `isVisible` (branch in TS — never fails), `scroll`/`scrollUntilVisible`/`swipe`, `back`/`pressKey`/`hideKeyboard`, `takeScreenshot`, `inspectScreen`, and `rowValue`. Each command shows as a native Playwright step; YAML flows are replayed step-by-step in the report too.

## Running

```bash
npm run test:maestro          # MAESTRO=1 playwright test --project=maestro
```

A bare `npm test` stays UI + API — the `maestro` project is gated behind `MAESTRO=1`.

## Devices

Select with `test.use({ mobile })`: a named `device` (Android AVD / iOS simulator name or UDID) auto-boots if not running; omit it to use any booted device. **When no matching device is available the test skips (never fails).** Create one from your installed SDK/Xcode:

```bash
npm run mobile:create-device      # interactive
npm run mobile:stop-devices       # shut down the ones the framework auto-booted
```

Parallel: give each test its device and pass `--workers=N` — same device serializes (a cross-process lock), different devices run in parallel.

## Requirements

- **Maestro CLI** + a **JDK 17+**.
- **Android**: Android SDK (`ANDROID_HOME`) + an emulator. **iOS**: Xcode + a simulator (simulator-only; real iOS devices are not yet supported).
- Node ≥ 20.19. `create-pwtap add maestro` runs an advisory host check for these.

## License

MIT
