import { test, expect } from '@fixtures/globalFixtures';
import { authState, ensureSession } from '@fixtures/auth';
import { LoginPage } from '@pages/LoginPage';

/**
 * Example login / authenticated-session tests.
 *
 * Auth model: the `setup` project logs in each session declared in testData/users.json and saves
 * `.auth/<key>.json`. A test or describe opts into a session with `test.use({ session: '<key>' })`;
 * unauthenticated tests set nothing. These templates require a running app at the configured
 * baseURL (API_HOST) — customize selectors in pages/LoginPage.ts.
 */

test.describe('Login page', () => {
    test('renders the login form', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await expect(page).toHaveURL(/login/);
        expect(await loginPage.isFormVisible()).toBeTruthy();
    });

    test('shows an error for invalid credentials', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await loginPage.login('invalid@example.com', 'wrongpassword');
        await expect(loginPage.errorMessage).toBeVisible();
    });
});

test.describe('Authenticated session', () => {
    // Reuse the 'admin' session — logged in lazily on first use, then cached to .auth/admin.json.
    test.use({ session: 'admin' });

    test('reaches a protected page without redirecting to login', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page).not.toHaveURL(/login/);
    });
});

test.describe('Two roles in one test', () => {
    // For cross-role interactions, open independent contexts via authState(key).
    test('admin and customer side by side', async ({ browser }) => {
        // Ensure both sessions are logged in and cached (lazy — logs in only on first use).
        await ensureSession(browser, 'admin');
        await ensureSession(browser, 'customer');

        const adminCtx = await browser.newContext({ storageState: authState('admin') });
        const customerCtx = await browser.newContext({ storageState: authState('customer') });

        const adminPage = await adminCtx.newPage();
        const customerPage = await customerCtx.newPage();

        await adminPage.goto('/');
        await customerPage.goto('/');
        // ...drive adminPage and customerPage against each other...

        await adminCtx.close();
        await customerCtx.close();
    });
});
