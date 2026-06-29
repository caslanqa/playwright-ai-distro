import * as fs from 'fs';
import * as path from 'path';

import type { BrowserContext, Page } from '@playwright/test';

import { loadEnv } from '@config/loadEnv';

loadEnv();

const AUTH_DIR = path.resolve(process.cwd(), '.auth');

/**
 * Auth helper for multi-worker safe authentication with file-based mutex.
 *
 * Strategy templates:
 * 1. Form-based: Fill login form, submit, wait for redirect
 * 2. OAuth: Navigate to /auth, wait for OAuth redirect, save state
 * 3. Token-based: POST to API, set localStorage/cookie
 * 4. MFA-aware: Handle OTP/2FA step if present
 *
 * Usage:
 * @example
 * // In setup/auth.setup.ts:
 * test('authenticate as qa', async ({ page, context }) => {
 *   const appType = 'myapp';
 *   const roleType = 'qa';
 *   await ensureAuthFile(context, appType, roleType, async () => {
 *     const creds = getCredentials(appType, roleType);
 *     await authenticate(page, creds);
 *   });
 * });
 */

/**
 * Get storage state file path for a given app and role
 */
export function getAuthFilePath(appType: string, roleType: string): string {
    return path.join(AUTH_DIR, `${appType}_${roleType}.json`);
}

/**
 * Check if auth file exists and is not empty
 */
export function authFileExists(appType: string, roleType: string): boolean {
    const filePath = getAuthFilePath(appType, roleType);
    if (!fs.existsSync(filePath)) {
        return false;
    }
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const state = JSON.parse(content);
        // Check if state has cookies or localStorage
        return (state.cookies?.length > 0) || (Object.keys(state.origins?.[0]?.localStorage ?? {}).length > 0);
    } catch {
        return false;
    }
}

/**
 * Multi-worker safe auth file creation using file-based mutex.
 * Only one worker will run the auth flow; others wait and reuse.
 *
 * @param context - Browser context to save state from
 * @param appType - Application type (e.g., 'myapp')
 * @param roleType - Role type (e.g., 'qa', 'admin')
 * @param authFn - Async function that performs the actual login
 */
export async function ensureAuthFile(
    context: BrowserContext,
    appType: string,
    roleType: string,
    authFn: () => Promise<void>
): Promise<void> {
    const authFile = getAuthFilePath(appType, roleType);
    const lockDir = `${authFile}.lock`;

    // Ensure auth directory exists
    if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    // Try to acquire lock by creating a directory (atomic operation)
    let acquired = false;
    try {
        fs.mkdirSync(lockDir);
        acquired = true;
    } catch {
        // Lock exists, another worker is authenticating
        acquired = false;
    }

    if (acquired) {
        // We have the lock - perform authentication
        try {
            console.log(`[auth] Worker acquired lock, authenticating ${appType}/${roleType}`);
            await authFn();
            await context.storageState({ path: authFile });
            console.log(`[auth] Saved auth state to ${authFile}`);
        } finally {
            // Release lock
            try {
                fs.rmdirSync(lockDir);
            } catch {
                // Lock already removed
            }
        }
    } else {
        // Wait for the other worker to finish
        console.log(`[auth] Waiting for auth file from another worker: ${authFile}`);
        const maxWait = 60000; // 60 seconds
        const interval = 500;
        let waited = 0;

        while (waited < maxWait) {
            // Check if lock is released and file exists
            if (!fs.existsSync(lockDir) && authFileExists(appType, roleType)) {
                console.log(`[auth] Auth file ready, loading state`);
                return;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
            waited += interval;
        }

        throw new Error(`[auth] Timeout waiting for auth file: ${authFile}`);
    }
}

/**
 * Get credentials from environment variables.
 * Variables should be set by loadEnv from environments.json:
 * CX_<APP>_<ROLE>_USERNAME, CX_<APP>_<ROLE>_PASSWORD, CX_<APP>_<ROLE>_HOST
 */
export function getCredentials(appType: string, roleType: string): {
    username: string;
    password: string;
    baseUrl: string;
} {
    const prefix = `CX_${appType.toUpperCase()}_${roleType.toUpperCase()}`;

    const username = process.env[`${prefix}_USERNAME`];
    const password = process.env[`${prefix}_PASSWORD`];
    const baseUrl = process.env[`${prefix}_HOST`];

    if (!username || !password || !baseUrl) {
        throw new Error(
            `[auth] Missing credentials for ${appType}/${roleType}. ` +
            `Expected env vars: ${prefix}_USERNAME, ${prefix}_PASSWORD, ${prefix}_HOST. ` +
            `Check your env/environments.json and testData/users.json configuration.`
        );
    }

    return { username, password, baseUrl };
}

/**
 * Template: Form-based authentication.
 * Customize selectors and flow for your application.
 *
 * @param page - Playwright page
 * @param creds - Credentials object from getCredentials
 * @param options - Optional customization
 */
export async function authenticate(
    page: Page,
    creds: { username: string; password: string; baseUrl: string },
    options?: {
        loginPath?: string;
        usernameSelector?: string;
        passwordSelector?: string;
        submitSelector?: string;
        successUrlPattern?: string | RegExp;
    }
): Promise<void> {
    const {
        loginPath = '/login',
        usernameSelector = 'input[name="email"], input[name="username"], input[type="email"]',
        passwordSelector = 'input[name="password"], input[type="password"]',
        submitSelector = 'button[type="submit"], input[type="submit"]',
        successUrlPattern = /\/(dashboard|home|app)/,
    } = options ?? {};

    // Navigate to login page
    await page.goto(`${creds.baseUrl}${loginPath}`);

    // Fill credentials
    await page.locator(usernameSelector).first().fill(creds.username);
    await page.locator(passwordSelector).first().fill(creds.password);

    // Submit and wait for navigation
    await Promise.all([
        page.waitForURL(successUrlPattern, { timeout: 30000 }),
        page.locator(submitSelector).first().click(),
    ]);

    console.log(`[auth] Successfully authenticated as ${creds.username}`);
}

/**
 * Template: Token-based API authentication.
 * Use when authentication is done via API calls.
 */
export async function authenticateViaAPI(
    page: Page,
    creds: { username: string; password: string; baseUrl: string },
    options?: {
        authEndpoint?: string;
        tokenStorageKey?: string;
    }
): Promise<void> {
    const {
        authEndpoint = '/api/auth/login',
        tokenStorageKey = 'authToken',
    } = options ?? {};

    // Make API request to get token
    const response = await page.request.post(`${creds.baseUrl}${authEndpoint}`, {
        data: {
            email: creds.username,
            password: creds.password,
        },
    });

    if (!response.ok()) {
        throw new Error(`[auth] API authentication failed: ${response.status()}`);
    }

    const data = await response.json();
    const token = data.token || data.accessToken || data.access_token;

    if (!token) {
        throw new Error('[auth] No token in API response');
    }

    // Navigate to app and set token in localStorage
    await page.goto(creds.baseUrl);
    await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: tokenStorageKey, value: token }
    );

    // Reload to apply authentication
    await page.reload();
    console.log(`[auth] Successfully authenticated via API as ${creds.username}`);
}
