import type { Page } from '@playwright/test';

import { BasePage } from './BasePage';

/**
 * Login Page Object - Generic template.
 * Customize selectors for your application.
 *
 * @example
 * test('user can login', async ({ page }) => {
 *   const loginPage = new LoginPage(page);
 *   await loginPage.goto();
 *   await loginPage.login('user@example.com', 'password');
 *   await expect(page).toHaveURL(/dashboard/);
 * });
 */
export class LoginPage extends BasePage {
    // Common selectors - customize for your app
    private readonly selectors = {
        usernameInput: 'input[name="email"], input[name="username"], input[type="email"]',
        passwordInput: 'input[name="password"], input[type="password"]',
        submitButton: 'button[type="submit"], input[type="submit"]',
        errorMessage: '[data-testid="error-message"], .error-message, .alert-error',
        rememberMeCheckbox: 'input[name="remember"], input[type="checkbox"][name*="remember"]',
        forgotPasswordLink: 'a[href*="forgot"], a[href*="reset"]',
        registerLink: 'a[href*="register"], a[href*="signup"]',
    };

    constructor(page: Page, loginPath: string = '/login') {
        super(page, loginPath);
    }

    /**
     * Get username/email input
     */
    get usernameInput() {
        return this.page.locator(this.selectors.usernameInput).first();
    }

    /**
     * Get password input
     */
    get passwordInput() {
        return this.page.locator(this.selectors.passwordInput).first();
    }

    /**
     * Get submit button
     */
    get submitButton() {
        return this.page.locator(this.selectors.submitButton).first();
    }

    /**
     * Get error message element
     */
    get errorMessage() {
        return this.page.locator(this.selectors.errorMessage).first();
    }

    /**
     * Get remember me checkbox
     */
    get rememberMeCheckbox() {
        return this.page.locator(this.selectors.rememberMeCheckbox).first();
    }

    /**
     * Get forgot password link
     */
    get forgotPasswordLink() {
        return this.page.locator(this.selectors.forgotPasswordLink).first();
    }

    /**
     * Get register/signup link
     */
    get registerLink() {
        return this.page.locator(this.selectors.registerLink).first();
    }

    /**
     * Fill username/email field
     */
    async fillUsername(username: string): Promise<void> {
        await this.usernameInput.fill(username);
    }

    /**
     * Fill password field
     */
    async fillPassword(password: string): Promise<void> {
        await this.passwordInput.fill(password);
    }

    /**
     * Click submit/login button
     */
    async submit(): Promise<void> {
        await this.submitButton.click();
    }

    /**
     * Complete login flow
     */
    async login(username: string, password: string): Promise<void> {
        await this.fillUsername(username);
        await this.fillPassword(password);
        await this.submit();
    }

    /**
     * Login and wait for specific URL pattern
     */
    async loginAndWaitForUrl(
        username: string,
        password: string,
        urlPattern: string | RegExp = /\/(dashboard|home|app)/
    ): Promise<void> {
        await this.fillUsername(username);
        await this.fillPassword(password);
        await Promise.all([
            this.page.waitForURL(urlPattern, { timeout: 30000 }),
            this.submit(),
        ]);
    }

    /**
     * Check remember me checkbox
     */
    async checkRememberMe(): Promise<void> {
        await this.rememberMeCheckbox.check();
    }

    /**
     * Click forgot password link
     */
    async clickForgotPassword(): Promise<void> {
        await this.forgotPasswordLink.click();
    }

    /**
     * Click register/signup link
     */
    async clickRegister(): Promise<void> {
        await this.registerLink.click();
    }

    /**
     * Get error message text
     */
    async getErrorText(): Promise<string> {
        if (await this.errorMessage.isVisible()) {
            return (await this.errorMessage.textContent()) ?? '';
        }
        return '';
    }

    /**
     * Check if error message is displayed
     */
    async hasError(): Promise<boolean> {
        return await this.errorMessage.isVisible();
    }

    /**
     * Check if login form is visible
     */
    async isFormVisible(): Promise<boolean> {
        return await this.usernameInput.isVisible();
    }
}
