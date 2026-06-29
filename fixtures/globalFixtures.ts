import { test as base, type BrowserContext, type Page } from '@playwright/test';

import { loadEnv } from '@config/loadEnv';
import { getAuthFilePath } from '@tests/setup/auth.helper';

// Load environment configuration before tests run
loadEnv();

/**
 * Fixture options for selecting app and role.
 * These determine which storage state file to load.
 */
export interface FixtureOptions {
    appType: string;
    roleType: string;
}

/**
 * Extended test fixtures with app/role selection.
 *
 * @example
 * // Use default app/role (myapp/qa):
 * test('basic test', async ({ page }) => {
 *   await page.goto('/');
 * });
 *
 * // Override app/role for specific test:
 * test.use({ appType: 'myapp', roleType: 'admin' });
 * test('admin test', async ({ page }) => {
 *   await page.goto('/admin');
 * });
 */
export const test = base.extend<FixtureOptions & { context: BrowserContext; page: Page }>({
    // Default app type - override with test.use({ appType: 'other' })
    appType: ['myapp', { option: true }],

    // Default role type - override with test.use({ roleType: 'admin' })
    roleType: ['qa', { option: true }],

    // Context with storage state loaded based on app/role
    context: async ({ browser, appType, roleType }, use) => {
        const authFile = getAuthFilePath(appType, roleType);

        const context = await browser.newContext({
            storageState: authFile,
        });

        await use(context);
        await context.close();
    },

    // Page from the authenticated context
    page: async ({ context }, use) => {
        const page = await context.newPage();
        await use(page);
        await page.close();
    },
});

export { expect } from '@playwright/test';
