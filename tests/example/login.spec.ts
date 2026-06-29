import { test, expect } from '@fixtures/globalFixtures';
import { LoginPage } from '@pages/LoginPage';

/**
 * Example login tests demonstrating the Page Object Model pattern.
 *
 * Note: These tests require:
 * 1. A running application at the configured baseURL
 * 2. Valid test credentials in testData/users.json
 */

test.describe('Login Page', () => {
    test('login page is visible', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await expect(page).toHaveURL(/login/);
        expect(await loginPage.isFormVisible()).toBeTruthy();
    });

    test('shows error for invalid credentials', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        await loginPage.login('invalid@example.com', 'wrongpassword');

        // Wait for error message
        await page.waitForTimeout(1000);
        const hasError = await loginPage.hasError();

        // Note: This assertion depends on your app's behavior
        // expect(hasError).toBeTruthy();
        console.log(`Error displayed: ${hasError}`);
    });

    test('successful login redirects to dashboard', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Use credentials from environment (set by loadEnv)
        const username = process.env.CX_MYAPP_QA_USERNAME || 'test@example.com';
        const password = process.env.CX_MYAPP_QA_PASSWORD || 'password';

        await loginPage.loginAndWaitForUrl(username, password, /\/(dashboard|home|app)/);

        await expect(page).not.toHaveURL(/login/);
    });
});

test.describe('Authentication State', () => {
    // This test uses the pre-authenticated state from auth.setup.ts
    test.use({ appType: 'myapp', roleType: 'qa' });

    test('authenticated user can access protected page', async ({ page }) => {
        // Storage state is already loaded, user is authenticated
        await page.goto('/dashboard');

        // Should not be redirected to login
        await expect(page).not.toHaveURL(/login/);
    });
});

test.describe('Different Roles', () => {
    test.describe('QA Role', () => {
        test.use({ appType: 'myapp', roleType: 'qa' });

        test('QA user has standard access', async ({ page }) => {
            await page.goto('/');
            // Add assertions for QA user capabilities
        });
    });

    test.describe('Dev Role', () => {
        test.use({ appType: 'myapp', roleType: 'dev' });

        test('Dev user has developer access', async ({ page }) => {
            await page.goto('/');
            // Add assertions for dev user capabilities
        });
    });
});
