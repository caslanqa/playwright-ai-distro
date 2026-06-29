#!/usr/bin/env node

/**
 * CLI tool to scaffold a new Playwright AI Distro project
 *
 * Usage:
 *   npx create-playwright-ai-distro my-project
 *   npm init playwright-ai-distro my-project
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_NAME = 'playwright-ai-distro';

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

// Files to copy (relative to package root)
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
  '.gitignore',
];

// Template for package.json (will be customized per project)
const createPackageJson = projectName => ({
  name: projectName,
  version: '1.0.0',
  description: 'Playwright test automation with AI Judge capabilities',
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
    prepare: 'husky',
    'judge:start': './scripts/ci/judge-services.sh start',
    'judge:stop': './scripts/ci/judge-services.sh stop',
    'judge:status': './scripts/ci/judge-services.sh status',
    'judge:warm': './scripts/ci/judge-services.sh warm',
  },
  devDependencies: {
    '@commitlint/cli': '^21.0.1',
    '@commitlint/config-conventional': '^21.0.1',
    '@playwright/test': '^1.52.0',
    '@types/node': '^22.15.21',
    '@typescript-eslint/eslint-plugin': '^8.32.1',
    '@typescript-eslint/parser': '^8.32.1',
    'allure-playwright': '^3.2.2',
    eslint: '^9.27.0',
    'eslint-config-prettier': '^10.1.5',
    'eslint-plugin-playwright': '^2.2.0',
    husky: '^9.1.7',
    'lint-staged': '^16.1.0',
    prettier: '^3.5.3',
    typescript: '^5.8.3',
  },
  'lint-staged': {
    '*.{ts,js}': ['eslint --fix', 'prettier --write'],
    '*.{json,md}': ['prettier --write'],
  },
});

// Get package root directory
function getPackageRoot() {
  // When installed as npm package, __dirname is in node_modules/playwright-ai-distro/bin
  // We need to go up to find the package root
  let dir = __dirname;

  // Check if we're in a development environment or installed package
  if (fs.existsSync(path.join(dir, '..', 'package.json'))) {
    return path.join(dir, '..');
  }

  // Fallback: look for node_modules
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'node_modules', PACKAGE_NAME);
    if (fs.existsSync(pkgPath)) {
      return pkgPath;
    }
    dir = path.dirname(dir);
  }

  // If running from the package itself
  return path.join(__dirname, '..');
}

// Copy file with directory creation
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

// Main function
async function main() {
  const args = process.argv.slice(2);
  const projectName = args[0];

  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════╗
║     🎭 Playwright AI Distro - Project Scaffolder 🤖    ║
╚═══════════════════════════════════════════════════════╝${colors.reset}
`);

  // Validate project name
  if (!projectName) {
    log.error('Please specify a project name:');
    console.log(`  npx create-${PACKAGE_NAME} ${colors.cyan}my-project${colors.reset}`);
    console.log(`  npm init ${PACKAGE_NAME} ${colors.cyan}my-project${colors.reset}`);
    process.exit(1);
  }

  // Check if directory already exists
  const targetDir = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(targetDir)) {
    log.error(`Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  log.info(`Creating project: ${colors.cyan}${projectName}${colors.reset}`);

  // Create project directory
  fs.mkdirSync(targetDir, { recursive: true });
  log.success('Created project directory');

  // Get package root
  const packageRoot = getPackageRoot();
  log.step(`Copying files from template...`);

  // Copy all template files
  let copiedCount = 0;
  for (const file of FILES_TO_COPY) {
    const src = path.join(packageRoot, file);
    const dest = path.join(targetDir, file);

    if (copyFile(src, dest)) {
      copiedCount++;
    } else {
      log.warn(`File not found: ${file}`);
    }
  }
  log.success(`Copied ${copiedCount} files`);

  // Create package.json
  const pkgJson = createPackageJson(projectName);
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  log.success('Created package.json');

  // Create README.md
  const readme = `# ${projectName}

Playwright test automation project with AI Judge capabilities.

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install --with-deps

# Copy environment config
cp env/environments.example.json env/environments.json
cp testData/users.example.json testData/users.json

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

  // Create .auth directory
  fs.mkdirSync(path.join(targetDir, '.auth'), { recursive: true });
  log.success('Created .auth directory');

  // Copy environment files (without .example suffix)
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

  // Make scripts executable
  const scriptPath = path.join(targetDir, 'scripts/ci/judge-services.sh');
  if (fs.existsSync(scriptPath)) {
    try {
      fs.chmodSync(scriptPath, '755');
    } catch {
      // Ignore chmod errors on Windows
    }
  }

  console.log(`
${colors.green}✨ Project created successfully!${colors.reset}

${colors.cyan}Next steps:${colors.reset}

  1. ${colors.yellow}cd ${projectName}${colors.reset}
  2. ${colors.yellow}npm install${colors.reset}
  3. ${colors.yellow}npx playwright install --with-deps${colors.reset}
  4. ${colors.yellow}npm test${colors.reset}

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
