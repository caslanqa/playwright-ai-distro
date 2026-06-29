import fs from 'fs';
import path from 'path';

// Single source of truth for environment loading. Every consumer (envUtils,
// auth.helper, globalFixtures) goes through loadEnv() so switching environments
// is a single variable change instead of hand-editing an env file.
//
// All config lives in one JSON file, env/environments.json, with three blocks:
//   {
//     "common":       { ...shared keys, may contain ${TEST_ENV.X} tokens... },
//     "environments": { "<env>": { "API_HOST": "...", "<app>": { "baseUrl": "..." } } }
//   }
// User credentials/profile test data lives in testData/users.json with environment
// specific values only:
//   {
//     "environments": { "<env>": { "apptype": { ... } } }
//   }
// The environment is selected via TEST_ENV (falls back to common.DEFAULT_TEST_ENV).
// loadEnv FLATTENS the nested shape into the legacy flat keys the rest of the code
// already consumes:
//   environments[env][app].baseUrl              -> CX_<APP>_<ROLE>_HOST   (per role)
//   users.environments[env].apptype...          -> CX_<APP>_<ROLE>_<K>
//   common.K (string)                           -> K   (with ${TEST_ENV.X} resolved)

const ENV_FILE = 'environments.json';
const USERS_FILE = 'users.json';

// Matches ${TEST_ENV.SOME_KEY} placeholders inside common string values; the key
// is resolved against the selected environment block (e.g. ${TEST_ENV.API_HOST}).
const TEST_ENV_TOKEN = /\$\{TEST_ENV\.([A-Za-z0-9_]+)\}/g;

let loaded = false;
let resolvedEnv = '';

interface CredentialsConfig {
    apptype?: Record<string, { roleType?: Record<string, Record<string, string>> }>;
}

interface EnvConfig {
    common?: Record<string, unknown>;
    environments: Record<string, Record<string, unknown>>;
    credentials?: CredentialsConfig;
}

interface UsersConfig {
    environments?: Record<string, CredentialsConfig>;
}

interface RoleMap {
    [role: string]: Record<string, string>;
}

interface AppRoleMap {
    [app: string]: RoleMap;
}

/**
 * Convert a config sub-key to its flat env-var form: camelCase becomes
 * SCREAMING_SNAKE_CASE (e.g. "supabaseUrl" -> "SUPABASE_URL") and an already
 * upper/snake key is left unchanged (e.g. "PHONE_NUMBER" -> "PHONE_NUMBER").
 */
function toEnvKey(key: string): string {
    return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

/**
 * Set a process.env key unless it is a documentation key (leading "_"/"$") or was
 * already defined explicitly (e.g. an exported CI secret), so an explicit value
 * always wins over the file.
 */
function setEnv(key: string, value: string): void {
    if (key.startsWith('_') || key.startsWith('$')) {
        return;
    }
    if (process.env[key] === undefined) {
        process.env[key] = value;
    }
}

/**
 * Replace ${TEST_ENV.X} tokens in a string with the matching scalar from the selected
 * environment block. An unknown/missing key resolves to an empty string so a malformed
 * template degrades visibly rather than crashing the run.
 */
function resolveTokens(value: string, envBlock: Record<string, unknown>): string {
    return value.replace(TEST_ENV_TOKEN, (_match, key: string) => {
        const resolved = envBlock[key];
        return typeof resolved === 'string' ? resolved : '';
    });
}

/** Read testData/users.json if present, otherwise return null for legacy fallback. */
function readUsersConfig(): UsersConfig | null {
    const file = path.join(process.cwd(), 'testData', USERS_FILE);
    if (!fs.existsSync(file)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8')) as UsersConfig;
}

/**
 * Load env/environments.json and (optionally) testData/users.json, flattening the
 * nested structure into process.env keys. Idempotent — safe to call multiple times.
 *
 * Environment selection: TEST_ENV env var > common.DEFAULT_TEST_ENV fallback.
 *
 * @returns The name of the selected environment for logging/debugging.
 */
export function loadEnv(): string {
    if (loaded) {
        return resolvedEnv;
    }
    loaded = true;

    const file = path.join(process.cwd(), 'env', ENV_FILE);
    if (!fs.existsSync(file)) {
        console.warn(`[loadEnv] ${file} not found — skipping.`);
        return '';
    }

    const config = JSON.parse(fs.readFileSync(file, 'utf8')) as EnvConfig;
    const common = config.common ?? {};

    // Determine environment: explicit TEST_ENV wins, else fallback from common.
    resolvedEnv = process.env.TEST_ENV ?? (common.DEFAULT_TEST_ENV as string) ?? '';

    const envBlock = config.environments?.[resolvedEnv] ?? {};

    // 1. Flatten common values (resolve ${TEST_ENV.X} tokens against the env block).
    for (const [key, val] of Object.entries(common)) {
        if (typeof val === 'string') {
            setEnv(toEnvKey(key), resolveTokens(val, envBlock));
        }
    }

    // 2. Flatten the selected environment block (top-level scalars and app/baseUrl).
    for (const [key, val] of Object.entries(envBlock)) {
        if (typeof val === 'string') {
            setEnv(toEnvKey(key), val);
        } else if (val && typeof val === 'object') {
            // App block: { baseUrl, ... } → CX_<APP>_<ROLE>_HOST for each role (defaulting
            // to the app-level baseUrl). The rest of the creds come from users.json.
            const appBlock = val as Record<string, unknown>;
            const baseUrl = appBlock.baseUrl as string | undefined;
            if (baseUrl) {
                // Set a per-role HOST; roles are discovered from the users file later, so here
                // we just set a single-app fallback keyed by the app name in uppercase.
                for (const role of ['qa', 'dev', 'admin', 'user']) {
                    setEnv(`CX_${key.toUpperCase()}_${role.toUpperCase()}_HOST`, baseUrl);
                }
            }
            // Other scalar keys in the app block (e.g. supabaseUrl) become CX_<APP>_<KEY>.
            for (const [subKey, subVal] of Object.entries(appBlock)) {
                if (typeof subVal === 'string' && subKey !== 'baseUrl') {
                    setEnv(`CX_${key.toUpperCase()}_${toEnvKey(subKey)}`, subVal);
                }
            }
        }
    }

    // 3. Flatten user credentials from testData/users.json (or legacy credentials block).
    const usersConfig = readUsersConfig();
    const credsSource: CredentialsConfig | undefined =
        usersConfig?.environments?.[resolvedEnv] ?? config.credentials;

    if (credsSource?.apptype) {
        for (const [app, appData] of Object.entries(credsSource.apptype)) {
            if (!appData.roleType) continue;
            for (const [role, userData] of Object.entries(appData.roleType)) {
                for (const [userKey, userVal] of Object.entries(userData)) {
                    setEnv(`CX_${app.toUpperCase()}_${role.toUpperCase()}_${toEnvKey(userKey)}`, userVal);
                }
            }
        }
    }

    console.info(`[loadEnv] Loaded environment: ${resolvedEnv}`);
    return resolvedEnv;
}
