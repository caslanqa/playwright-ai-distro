import type { Locator, Page } from '@playwright/test';

import { BasePage } from './BasePage';

/**
 * Login page object for the saucedemo.com demo app, used by the runnable session-auth example
 * (fixtures/auth.ts → loginSession, tests/example/authSession.spec.ts). It is a concrete example of
 * an app-specific login page object: selectors and the login flow are encapsulated here, not in the
 * fixture. Write your own app's login page object the same way, and delete this with the demo.
 */
export class SauceDemoLoginPage extends BasePage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    super(page, 'https://www.saucedemo.com/');
    this.usernameInput = page.locator('#user-name');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.locator('#login-button');
  }

  /**
   * Navigate to the login page, fill the credentials, submit, and wait for the inventory page.
   * Implements the fixtures' SessionLogin contract.
   */
  async signIn(username: string, password: string): Promise<void> {
    await this.goto();
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForURL(/\/inventory\.html/);
  }
}
