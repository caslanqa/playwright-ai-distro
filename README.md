# Playwright AI Distro

A production-ready, standalone Playwright test automation framework with built-in **AI Judge** capabilities for LLM-powered response evaluation.

## 🚀 Key Features

- **AI Judge System** - Evaluate chatbot/LLM responses using local or cloud models
- **Dual LLM Routing** - Ollama (local, free) or 9Router gateway (Claude, GPT)
- **Multi-Worker Auth** - File-based mutex for parallel authentication
- **Page Object Model** - Clean, maintainable test structure
- **Environment-Driven** - JSON-based configuration, zero hardcoded values
- **Full CI/CD** - GitHub Actions with Ollama setup

## 📦 Installation

```bash
# Clone the repository
git clone <repo-url>
cd playwright-ai-distro

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install --with-deps

# Copy example configuration files
cp env/environments.example.json env/environments.json
cp testData/users.example.json testData/users.json
```

## 🔧 Configuration

### Environment Setup

Edit `env/environments.json` to configure your test environments:

```json
{
  "common": {
    "DEFAULT_TEST_ENV": "dev",
    "JUDGE_MODEL": "local/qwen3.5:9b"
  },
  "environments": {
    "dev": {
      "API_HOST": "http://localhost:3000",
      "myapp": {
        "baseUrl": "http://localhost:3000"
      }
    }
  }
}
```

### User Credentials

Edit `testData/users.json` for test user credentials:

```json
{
  "environments": {
    "dev": {
      "apptype": {
        "myapp": {
          "roleType": {
            "qa": {
              "username": "qa@example.com",
              "password": "your_password"
            }
          }
        }
      }
    }
  }
}
```

## 🧪 Running Tests

```bash
# Run all tests
npx playwright test

# Run specific browser
npx playwright test --project=chromium

# Run with specific environment
TEST_ENV=staging npx playwright test

# Run tests with tag
npx playwright test --grep @smoke

# Run in UI mode (debugging)
npx playwright test --ui

# Generate report
npx playwright show-report
```

## 🤖 AI Judge System

The AI Judge evaluates chatbot/LLM responses against rubrics. See [docs/AI_JUDGE.md](docs/AI_JUDGE.md) for detailed documentation.

### Quick Start

```typescript
import { judgeResponse } from '@utils/aiJudge';

test('chatbot responds correctly', async () => {
  const verdict = await judgeResponse({
    userMessage: 'What time do you open?',
    botResponse: 'We open at 9am every day.',
    rubric: 'Must state the store opens at 9am.',
  });

  expect(verdict.pass, verdict.reasoning).toBeTruthy();
});
```

### Model Options

| Model | Cost | Speed | Best For |
|-------|------|-------|----------|
| `local/qwen3.5:9b` | Free | ~2-3s | Default, local testing |
| `local/llama3.1:8b` | Free | ~2s | Fast local eval |
| `gh/claude-sonnet-4-20250514` | Paid | ~1-2s | High accuracy |
| `gh/gpt-4o` | Paid | ~1-2s | Alternative cloud |

## 📁 Project Structure

```
playwright-ai-distro/
├── .auth/                    # Storage state files (gitignored)
├── .github/workflows/        # CI/CD pipelines
├── config/                   # Environment loading
│   ├── loadEnv.ts
│   └── envUtils.ts
├── docs/                     # Documentation
│   └── AI_JUDGE.md
├── env/                      # Environment config
│   └── environments.json
├── fixtures/                 # Playwright fixtures
│   └── globalFixtures.ts
├── pages/                    # Page Object Models
│   ├── BasePage.ts
│   └── LoginPage.ts
├── scripts/ci/               # CI scripts
│   └── judge-services.sh
├── testData/                 # Test data
│   └── users.json
├── tests/
│   ├── setup/                # Auth setup
│   │   ├── auth.helper.ts
│   │   └── auth.setup.ts
│   └── example/              # Example tests
├── utils/                    # Utilities
│   ├── aiJudge.ts            # AI Judge core
│   ├── types.ts              # TypeScript types
│   ├── apiUtils.ts
│   ├── dateUtils.ts
│   └── ...
└── playwright.config.ts
```

## 🔐 Authentication

The framework uses multi-worker safe authentication with file-based mutex:

```typescript
// tests/setup/auth.setup.ts
setup('authenticate myapp/qa', async ({ page, context }) => {
  await ensureAuthFile(context, 'myapp', 'qa', async () => {
    const creds = getCredentials('myapp', 'qa');
    await authenticate(page, creds);
  });
});
```

## 📊 Reporters

- **HTML Report**: `playwright-report/`
- **Allure Report**: `allure-results/`
- **JSON Results**: `test-results/results.json`

Generate Allure report:

```bash
npx allure generate allure-results -o allure-report --clean
npx allure open allure-report
```

## 🛠️ Development

```bash
# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format

# Type check
npx tsc --noEmit
```

## 📝 Writing Tests

### Basic Test

```typescript
import { test, expect } from '@fixtures/globalFixtures';
import { LoginPage } from '@pages/LoginPage';

test('user can view dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
```

### Test with Different Role

```typescript
test.use({ appType: 'myapp', roleType: 'admin' });

test('admin can access settings', async ({ page }) => {
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/settings/);
});
```

### AI Judge Test

```typescript
import { judgeResponse } from '@utils/aiJudge';

test('AI provides helpful response', async ({ page }) => {
  // Interact with chatbot
  await page.fill('[data-testid="chat-input"]', 'How do I reset my password?');
  await page.click('[data-testid="send-button"]');

  // Get bot response
  const response = await page.locator('[data-testid="bot-message"]').last().textContent();

  // Judge the response
  const verdict = await judgeResponse({
    userMessage: 'How do I reset my password?',
    botResponse: response || '',
    rubric: 'Must explain password reset process with clear steps.',
  });

  expect(verdict.pass, verdict.reasoning).toBeTruthy();
  expect(verdict.score).toBeGreaterThan(70);
});
```

## 🌐 CI/CD

GitHub Actions workflow includes:

- Automatic Ollama setup for AI Judge
- Multi-browser testing
- Allure report generation
- Artifact uploads

Trigger manually with custom options:

```yaml
workflow_dispatch:
  inputs:
    environment: dev|staging|production
    judge_model: local/qwen3.5:9b
    browser: chromium|firefox|webkit|all
```

## 📚 Documentation

- [AI Judge Guide](docs/AI_JUDGE.md) - Detailed AI Judge documentation
- [Playwright Docs](https://playwright.dev/docs/intro) - Official Playwright docs

## 📄 License

MIT
