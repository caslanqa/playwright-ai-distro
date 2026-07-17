import { expect, test } from '@fixtures/desktopFixtures';

// The bundled example app (desktop/apps.ts → 'example'), which is also the DESKTOP_APP default.
// Point this at your own app once you're ready — add it to desktop/apps.ts, then `app: '<name>'`.
test.use({ desktop: { app: 'example' } });

test.describe('Desktop (Electron) — example app', () => {
  test('the window renders and reacts to a click', async ({ window, electron }) => {
    // `window` is a real Playwright Page — the full web API works on the Electron window.
    await expect(window).toHaveTitle('Playwright AI Desktop Example');
    await expect(window.getByRole('heading', { level: 1 })).toHaveText(
      'Playwright AI Desktop Example'
    );

    await expect(window.locator('#status')).toHaveText('Ready');
    await window.getByRole('button', { name: 'Greet' }).click();
    await expect(window.locator('#status')).toHaveText('Hello from Electron!');

    // The ElectronApplication handle runs code in the app's MAIN process (not the renderer).
    const isPackaged = await electron.app.evaluate(({ app }) => app.isPackaged);
    expect(isPackaged).toBe(false);
  });
});
