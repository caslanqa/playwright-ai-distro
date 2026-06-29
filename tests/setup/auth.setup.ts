import { test as setup } from '@playwright/test';

import { authenticate, ensureAuthFile, getCredentials } from './auth.helper';

/**
 * Authentication setup for multi-worker parallel execution.
 *
 * This file runs BEFORE any test file (configured in playwright.config.ts).
 * It creates storage state files in .auth/ that are reused by test workers.
 *
 * To add a new app/role combination:
 * 1. Add credentials to testData/users.json
 * 2. Add baseUrl to env/environments.json
 * 3. Copy one of the setup blocks below and update appType/roleType
 * 4. Add the new auth setup as a dependency in playwright.config.ts
 */

// Example: MyApp QA user authentication
setup('authenticate myapp/qa', async ({ page, context }) => {
    const appType = 'myapp';
    const roleType = 'qa';

    await ensureAuthFile(context, appType, roleType, async () => {
        const creds = getCredentials(appType, roleType);
        await authenticate(page, creds, {
            // Customize these selectors for your application:
            loginPath: '/login',
            usernameSelector: 'input[name="email"]',
            passwordSelector: 'input[name="password"]',
            submitSelector: 'button[type="submit"]',
            successUrlPattern: /\/(dashboard|home)/,
        });
    });
});

// Example: MyApp Dev user authentication
setup('authenticate myapp/dev', async ({ page, context }) => {
    const appType = 'myapp';
    const roleType = 'dev';

    await ensureAuthFile(context, appType, roleType, async () => {
        const creds = getCredentials(appType, roleType);
        await authenticate(page, creds);
    });
});

// Add more app/role combinations as needed:
// setup('authenticate otherapp/admin', async ({ page, context }) => {
//   ...
// });
