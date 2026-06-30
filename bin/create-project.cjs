#!/usr/bin/env node

/**
 * CLI tool to scaffold a new Playwright AI Distro project.
 *
 * Mirrors the official Playwright install experience:
 *
 *   npm  init  @caslanqa/playwright-ai@latest my-project
 *   npm  create @caslanqa/playwright-ai@latest my-project
 *   npx  @caslanqa/create-playwright-ai my-project
 *   yarn create @caslanqa/playwright-ai my-project
 *   pnpm create @caslanqa/playwright-ai my-project
 *
 * Runs an interactive menu (when stdin is a TTY) to choose the project
 * directory, GitHub Actions workflow, and install options — like the official
 * `npm init playwright@latest`. In non-TTY contexts (CI, piped input) it skips
 * the prompts and uses defaults, so it never hangs.
 *
 * Flags (override the interactive prompts):
 *   --no-install    Skip "npm install" in the new project
 *   --no-browsers   Skip "npx playwright install" (browser binaries)
 *   --no-gha        Skip the GitHub Actions workflow
 *   -y, --yes       Accept all defaults without prompting
 *   -h, --help      Show usage
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const PACKAGE_NAME = '@caslanqa/create-playwright-ai';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = {
  info: msg => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: msg => console.log(`${colors.green}✔${colors.reset} ${msg}`),
  warn: msg => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: msg => console.log(`${colors.red}✖${colors.reset} ${msg}`),
  step: msg => console.log(`${colors.cyan}→${colors.reset} ${msg}`),
};

// Template files to copy (relative to package root). Note: dotfiles that npm
// renames on publish (e.g. .gitignore -> .npmignore) are handled separately
// from the templates/ directory below.
const FILES_TO_COPY = [
  'config/envUtils.ts',
  'config/index.ts',
  'config/loadEnv.ts',
  'env/environments.example.json',
  'fixtures/globalFixtures.ts',
  'fixtures/index.ts',
  'pages/BasePage.ts',
  'pages/index.ts',
  'pages/LoginPage.ts',
  'scripts/ci/judge-services.sh',
  'testData/users.example.json',
  'tests/setup/auth.helper.ts',
  'tests/setup/auth.setup.ts',
  'tests/example/aiJudge.spec.ts',
  'tests/example/login.spec.ts',
  'utils/aiJudge.ts',
  'utils/apiUtils.ts',
  'utils/dateUtils.ts',
  'utils/index.ts',
  'utils/stringUtils.ts',
  'utils/types.ts',
  'utils/uiUtils.ts',
  'utils/validationUtils.ts',
  'utils/waitUtils.ts',
  'docs/AI_JUDGE.md',
  '.github/workflows/ci.yml',
  'playwright.config.ts',
  'tsconfig.json',
  'eslint.config.js',
  '.prettierrc',
  '.commitlintrc.json',
];

// package.json for the generated project. devDependencies are read from THIS
// package's own package.json so the copied configs (eslint/prettier/playwright)
// always get matching, complete dependencies — single source of truth, no drift.
const createPackageJson = (projectName, devDependencies) => ({
  name: projectName,
  version: '1.0.0',
  description: 'Playwright test automation with AI Judge capabilities',
  // The copied configs (eslint.config.js, playwright.config.ts) use ESM syntax,
  // so the project must be an ES module package.
  type: 'module',
  scripts: {
    test: 'playwright test',
    'test:ui': 'playwright test --ui',
    'test:headed': 'playwright test --headed',
    'test:debug': 'playwright test --debug',
    'test:chromium': 'playwright test --project=chromium',
    'test:firefox': 'playwright test --project=firefox',
    'test:webkit': 'playwright test --project=webkit',
    report: 'playwright show-report',
    'allure:generate': 'allure generate allure-results -o allure-report --clean',
    'allure:open': 'allure open allure-report',
    lint: 'eslint .',
    'lint:fix': 'eslint . --fix',
    format: 'prettier --write "**/*.{ts,js,json,md}"',
    'format:check': 'prettier --check "**/*.{ts,js,json,md}"',
    'type-check': 'tsc --noEmit',
    prepare: 'husky',
    'judge:start': './scripts/ci/judge-services.sh start',
    'judge:stop': './scripts/ci/judge-services.sh stop',
    'judge:status': './scripts/ci/judge-services.sh status',
    'judge:warm': './scripts/ci/judge-services.sh warm',
  },
  devDependencies,
  'lint-staged': {
    '*.{ts,tsx,js}': ['eslint --fix', 'prettier --write'],
    '*.{json,md}': ['prettier --write'],
  },
});

// Get the installed package root. When run via npx/npm-init the bin lives at
// <packageRoot>/bin/create-project.cjs, so the root is one level up.
function getPackageRoot() {
  let dir = __dirname;

  if (fs.existsSync(path.join(dir, '..', 'package.json'))) {
    return path.join(dir, '..');
  }

  // Fallback: walk up looking for the installed package under node_modules
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'node_modules', PACKAGE_NAME);
    if (fs.existsSync(pkgPath)) {
      return pkgPath;
    }
    dir = path.dirname(dir);
  }

  return path.join(__dirname, '..');
}

// Read this package's own devDependencies — used as the template for the
// generated project so the copied configs have everything they need.
function readTemplateDevDependencies(packageRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    return pkg.devDependencies || {};
  } catch {
    return {};
  }
}

// Copy a single file, creating parent directories as needed.
function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

// Run a child command in the target dir. npm_* env vars leaked from the parent
// `npm init`/`npx` process can break a nested `npm install`, so strip them.
function run(command, cwd) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('npm_')) {
      delete env[key];
    }
  }
  execSync(command, { cwd, stdio: 'inherit', env });
}

// Minimal readline-based prompts (zero dependencies). Used only when stdin is a
// TTY; otherwise callers fall back to defaults so the scaffolder never hangs.
function createPrompter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = q => new Promise(resolve => rl.question(q, resolve));
  return {
    async text(label, def) {
      const suffix = def ? ` ${colors.reset}(${def})` : '';
      const ans = (await question(`${colors.cyan}?${colors.reset} ${label}${suffix}: `)).trim();
      return ans || def || '';
    },
    async confirm(label, def = true) {
      const hint = def ? 'Y/n' : 'y/N';
      const ans = (await question(`${colors.cyan}?${colors.reset} ${label} (${hint}) `)).trim().toLowerCase();
      if (!ans) {
        return def;
      }
      return ans[0] === 'y';
    },
    close() {
      rl.close();
    },
  };
}

function printHelp() {
  console.log(`
${colors.cyan}@caslanqa/create-playwright-ai${colors.reset} — scaffold a Playwright + AI Judge project

${colors.cyan}Usage:${colors.reset}
  npm init @caslanqa/playwright-ai@latest ${colors.cyan}[project-dir]${colors.reset}
  npx @caslanqa/create-playwright-ai ${colors.cyan}[project-dir]${colors.reset}

${colors.cyan}Options:${colors.reset}
  --no-install     Skip installing npm dependencies
  --no-browsers    Skip installing Playwright browser binaries
  --no-gha         Skip the GitHub Actions workflow
  -y, --yes        Accept all defaults without prompting (no interactive menu)
  -h, --help       Show this help
`);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    return;
  }

  // Explicit flags always win over the interactive menu.
  const flagNoInstall = argv.includes('--no-install');
  const flagNoBrowsers = argv.includes('--no-browsers');
  const flagNoGha = argv.includes('--no-gha');
  const flagYes = argv.includes('--yes') || argv.includes('-y');
  // First non-flag argument is the project directory.
  const positional = argv.find(a => !a.startsWith('-'));

  // Interactive only when attached to a real terminal and not in --yes mode.
  const interactive = Boolean(process.stdin.isTTY) && !flagYes;

  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════╗
║     🎭 Playwright AI Distro - Project Scaffolder 🤖    ║
╚═══════════════════════════════════════════════════════╝${colors.reset}
`);

  // --- Interactive menu (like official create-playwright) ---
  let projectName = positional;
  let includeGha = !flagNoGha;
  let doInstall = !flagNoInstall;
  let doBrowsers = !flagNoBrowsers;

  if (interactive) {
    const prompt = createPrompter();
    try {
      if (!projectName) {
        projectName = await prompt.text("Project directory name ('.' for current dir)", '.');
      }
      if (!flagNoGha) {
        includeGha = await prompt.confirm('Add a GitHub Actions workflow?', true);
      }
      if (!flagNoInstall) {
        doInstall = await prompt.confirm('Install npm dependencies now?', true);
      }
      if (!flagNoBrowsers && doInstall) {
        doBrowsers = await prompt.confirm('Install Playwright browsers?', true);
      }
    } finally {
      prompt.close();
    }
  }

  if (!projectName) {
    projectName = '.';
  }
  // Browsers can only be installed if dependencies are installed.
  if (!doInstall) {
    doBrowsers = false;
  }

  const isCurrentDir = projectName === '.' || projectName === './';
  const targetDir = isCurrentDir
    ? process.cwd()
    : path.resolve(process.cwd(), projectName);

  // Refuse to scaffold into an existing, non-empty named directory.
  if (!isCurrentDir && fs.existsSync(targetDir)) {
    const entries = fs.readdirSync(targetDir).filter(e => e !== '.git');
    if (entries.length > 0) {
      log.error(`Directory "${projectName}" already exists and is not empty.`);
      process.exit(1);
    }
  }

  const displayName = isCurrentDir ? path.basename(targetDir) : projectName;
  log.info(`Creating project: ${colors.cyan}${displayName}${colors.reset}`);

  fs.mkdirSync(targetDir, { recursive: true });
  if (!isCurrentDir) {
    log.success('Created project directory');
  }

  const packageRoot = getPackageRoot();
  log.step('Copying files from template...');

  // Drop the GitHub Actions workflow when the user opted out.
  const filesToCopy = includeGha
    ? FILES_TO_COPY
    : FILES_TO_COPY.filter(f => !f.startsWith('.github/'));

  let copiedCount = 0;
  for (const file of filesToCopy) {
    const src = path.join(packageRoot, file);
    const dest = path.join(targetDir, file);

    if (copyFile(src, dest)) {
      copiedCount++;
    } else {
      log.warn(`File not found: ${file}`);
    }
  }
  log.success(`Copied ${copiedCount} files`);

  // .gitignore is shipped as templates/gitignore because npm renames a literal
  // .gitignore to .npmignore when publishing. Write it back out with the dot.
  const gitignoreSrc = path.join(packageRoot, 'templates', 'gitignore');
  if (fs.existsSync(gitignoreSrc)) {
    fs.copyFileSync(gitignoreSrc, path.join(targetDir, '.gitignore'));
    log.success('Created .gitignore');
  } else {
    log.warn('Template gitignore not found; skipping .gitignore');
  }

  // package.json (devDependencies derived from this package — single source of truth)
  const devDependencies = readTemplateDevDependencies(packageRoot);
  const pkgName = isCurrentDir ? path.basename(targetDir) : projectName;
  const pkgJson = createPackageJson(pkgName, devDependencies);
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n');
  log.success('Created package.json');

  // README.md
  const readme = `# ${pkgName}

Playwright test automation project with AI Judge capabilities.

## Quick Start

\`\`\`bash
# Copy environment config (already created by the scaffolder)
# Edit env/environments.json and testData/users.json for your app

# Run tests
npm test
\`\`\`

## AI Judge

\`\`\`bash
# Start Ollama (for local AI Judge)
npm run judge:start

# Run AI Judge tests
npx playwright test tests/example/aiJudge.spec.ts
\`\`\`

See [docs/AI_JUDGE.md](docs/AI_JUDGE.md) for detailed documentation.
`;
  fs.writeFileSync(path.join(targetDir, 'README.md'), readme);
  log.success('Created README.md');

  // .auth directory (auth state is generated at runtime)
  fs.mkdirSync(path.join(targetDir, '.auth'), { recursive: true });
  log.success('Created .auth directory');

  // Materialize the real (non-.example) config files
  const envSrc = path.join(targetDir, 'env/environments.example.json');
  const envDest = path.join(targetDir, 'env/environments.json');
  if (fs.existsSync(envSrc)) {
    fs.copyFileSync(envSrc, envDest);
  }

  const usersSrc = path.join(targetDir, 'testData/users.example.json');
  const usersDest = path.join(targetDir, 'testData/users.json');
  if (fs.existsSync(usersSrc)) {
    fs.copyFileSync(usersSrc, usersDest);
  }
  log.success('Created environment config files');

  // Make the judge helper script executable
  const scriptPath = path.join(targetDir, 'scripts/ci/judge-services.sh');
  if (fs.existsSync(scriptPath)) {
    try {
      fs.chmodSync(scriptPath, '755');
    } catch {
      // Ignore chmod errors (e.g. on Windows)
    }
  }

  // --- Match official create-playwright: install deps + browsers per choices ---
  let installed = false;
  if (doInstall) {
    try {
      log.step('Installing dependencies (npm install)...');
      run('npm install', targetDir);
      installed = true;
      log.success('Installed dependencies');
    } catch {
      log.warn('npm install failed — run it manually in the project directory.');
    }
  }

  if (doBrowsers && installed) {
    try {
      log.step('Installing Playwright browsers (npx playwright install)...');
      run('npx playwright install', targetDir);
      log.success('Installed Playwright browsers');
    } catch {
      log.warn('Browser install failed — run "npx playwright install" manually.');
    }
  }

  // --- Next steps: only show what the user still needs to run ---
  const steps = [];
  if (!isCurrentDir) {
    steps.push(`cd ${projectName}`);
  }
  if (!installed) {
    steps.push('npm install');
  }
  if (!doBrowsers || !installed) {
    steps.push('npx playwright install');
  }
  steps.push('npm test');
  const manualSteps = steps.map(s => `\n  ${colors.yellow}${s}${colors.reset}`).join('');

  console.log(`
${colors.green}✨ Project created successfully!${colors.reset}

${colors.cyan}Next steps:${colors.reset}${manualSteps}

${colors.cyan}For AI Judge:${colors.reset}

  1. Install Ollama: ${colors.blue}https://ollama.com${colors.reset}
  2. ${colors.yellow}npm run judge:start${colors.reset}
  3. ${colors.yellow}npx playwright test tests/example/aiJudge.spec.ts${colors.reset}

${colors.cyan}Documentation:${colors.reset}
  - AI Judge Guide: ${colors.blue}docs/AI_JUDGE.md${colors.reset}
  - Playwright Docs: ${colors.blue}https://playwright.dev${colors.reset}

Happy testing! 🎭
`);
}

main().catch(err => {
  log.error(err.message);
  process.exit(1);
});
