# AI Judge System

The AI Judge system enables LLM-powered evaluation of chatbot/LLM responses against rubrics. It supports both local (Ollama) and cloud (9Router gateway) models.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         judgeResponse()                         │
│                              │                                  │
│              ┌───────────────┴───────────────┐                  │
│              │                               │                  │
│       local/* prefix?               Other models                │
│              │                               │                  │
│              ▼                               ▼                  │
│   ┌──────────────────┐           ┌──────────────────┐          │
│   │  judgeViaOllama  │           │ judgeVia9Router  │          │
│   │                  │           │                  │          │
│   │  Native /api/chat│           │ OpenAI-compatible│          │
│   │  think: false    │           │ /chat/completions│          │
│   │  No API key      │           │ Bearer API key   │          │
│   └────────┬─────────┘           └────────┬─────────┘          │
│            │                               │                    │
│            ▼                               ▼                    │
│   ┌──────────────────┐           ┌──────────────────┐          │
│   │     Ollama       │           │    9Router       │          │
│   │  localhost:11434 │           │   Gateway        │          │
│   │  (qwen3.5, etc.) │           │ (Claude, GPT)    │          │
│   └──────────────────┘           └──────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

### 2. Start Ollama and Pull Model

```bash
# Start Ollama server
ollama serve

# In another terminal, pull the default model
ollama pull qwen3.5:9b

# Or use the helper script
./scripts/ci/judge-services.sh start local/qwen3.5:9b
```

### 3. Configure Environment

Edit `env/environments.json`:

```json
{
  "common": {
    "JUDGE_MODEL": "local/qwen3.5:9b",
    "JUDGE_OLLAMA_BASE_URL": "http://127.0.0.1:11434/v1",
    "JUDGE_OLLAMA_KEEP_ALIVE": "30m"
  }
}
```

### 4. Write Your First AI Judge Test

```typescript
import { test, expect } from '@fixtures/globalFixtures';
import { judgeResponse } from '@utils/aiJudge';

test('chatbot provides accurate store hours', async ({ page }) => {
  // Get chatbot response (example)
  const botResponse = 'We are open Monday to Friday, 9am to 5pm.';

  // Judge the response
  const verdict = await judgeResponse({
    userMessage: 'What are your store hours?',
    botResponse: botResponse,
    rubric: 'Must state operating hours. Should mention days and times.',
  });

  expect(verdict.pass, verdict.reasoning).toBeTruthy();
  expect(verdict.score).toBeGreaterThan(70);
});
```

## API Reference

### `judgeResponse(input: JudgeInput): Promise<JudgeVerdict>`

Main function to judge a response.

#### JudgeInput

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `userMessage` | `string` | Yes | The user's question/message |
| `botResponse` | `string` | Yes | The chatbot's response to evaluate |
| `rubric` | `string` | Yes | Criteria for evaluation |
| `model` | `string` | No | Override default model |
| `image` | `string \| Buffer` | No | Image for multimodal judging |

#### JudgeVerdict

| Property | Type | Description |
|----------|------|-------------|
| `pass` | `boolean` | Whether the response satisfies the rubric |
| `score` | `number` | Quality score 0-100 |
| `reasoning` | `string` | Explanation for the verdict |

## Model Options

### Local Models (Ollama)

| Model | VRAM | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| `local/qwen3.5:9b` | ~6GB | ~2-3s | Good | Default, balanced |
| `local/qwen3.5:14b` | ~10GB | ~4-5s | Better | Higher accuracy |
| `local/llama3.1:8b` | ~5GB | ~2s | Good | Fast evaluation |
| `local/gemma2:9b` | ~6GB | ~3s | Good | Alternative |

### Cloud Models (9Router)

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| `gh/claude-sonnet-4-20250514` | ~1-2s | Excellent | $3/1M tokens |
| `gh/gpt-4o` | ~1-2s | Excellent | $5/1M tokens |
| `gh/gpt-4o-mini` | <1s | Good | $0.15/1M tokens |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JUDGE_MODEL` | `local/qwen3.5:9b` | Default judge model |
| `JUDGE_OLLAMA_BASE_URL` | `http://127.0.0.1:11434/v1` | Ollama API URL |
| `JUDGE_OLLAMA_KEEP_ALIVE` | `30m` | Model memory retention |
| `JUDGE_BASE_URL` | - | 9Router gateway URL |
| `JUDGE_API_KEY` | - | 9Router API key |

### Per-Test Model Override

```typescript
const verdict = await judgeResponse({
  userMessage: 'Complex question',
  botResponse: 'Complex response',
  rubric: 'Detailed rubric',
  model: 'gh/claude-sonnet-4-20250514', // Use Claude for this test
});
```

## Multimodal Judging

Judge images alongside text responses:

```typescript
test('visual response is correct', async ({ page }) => {
  // Take screenshot
  const screenshot = await page.screenshot();

  const verdict = await judgeResponse({
    userMessage: 'Show me the dashboard',
    botResponse: '', // No text, image only
    rubric: 'Dashboard should show a chart with sales data',
    image: screenshot, // Pass the screenshot buffer
  });

  expect(verdict.pass).toBeTruthy();
});
```

Supported image formats:
- `Buffer` (Playwright screenshot)
- Data URI (`data:image/png;base64,...`)
- File path (`./screenshots/test.png`)

## Table-Driven Tests

Use `ChatJudgeCase` for data-driven testing:

```typescript
import { ChatJudgeCase } from '@utils/types';

const cases: ChatJudgeCase[] = [
  {
    name: 'greeting',
    userMessage: '',
    rubric: 'Bot greets the user warmly',
    expectPass: true,
  },
  {
    name: 'store hours',
    userMessage: 'What time do you open?',
    rubric: 'States opening time is 9am',
    expectPass: true,
  },
  {
    name: 'wrong hours',
    userMessage: 'What time do you open?',
    rubric: 'States opening time is 8am',
    expectPass: false, // We expect this to fail
  },
];

for (const c of cases) {
  test(c.name, async ({ page }) => {
    // Get bot response for c.userMessage
    const botResponse = await getBotResponse(page, c.userMessage);

    const verdict = await judgeResponse({
      userMessage: c.userMessage,
      botResponse,
      rubric: c.rubric,
    });

    if (c.expectPass !== false) {
      expect(verdict.pass, verdict.reasoning).toBeTruthy();
    } else {
      expect(verdict.pass).toBeFalsy();
    }
  });
}
```

## Performance Tips

### 1. Warm Up the Model

```bash
# Before running tests
./scripts/ci/judge-services.sh warm local/qwen3.5:9b
```

### 2. Set Keep-Alive

Keep the model in memory between tests:

```json
{
  "common": {
    "JUDGE_OLLAMA_KEEP_ALIVE": "30m"
  }
}
```

### 3. Use Smaller Models for Smoke Tests

```typescript
// Fast smoke test
const verdict = await judgeResponse({
  ...input,
  model: 'local/llama3.1:8b', // Faster
});

// Detailed regression test
const verdict = await judgeResponse({
  ...input,
  model: 'gh/claude-sonnet-4-20250514', // More accurate
});
```

## CI/CD Integration

### GitHub Actions Setup

The workflow automatically:
1. Installs Ollama
2. Pulls the configured model
3. Warms up the model
4. Runs tests

```yaml
- name: Setup Ollama
  run: |
    curl -fsSL https://ollama.com/install.sh | sh
    ollama serve &
    sleep 5
    ollama pull qwen3.5:9b
```

### Self-Hosted Runner

For faster CI, use a self-hosted runner with:
- GPU for faster inference
- Pre-pulled models
- Persistent Ollama service

## Troubleshooting

### Model Not Responding

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
./scripts/ci/judge-services.sh stop
./scripts/ci/judge-services.sh start
```

### Slow Response Times

1. Check VRAM usage (model should fit in GPU memory)
2. Use `think: false` (already configured)
3. Increase `keep_alive` to avoid model reloading
4. Consider smaller model for CI

### Invalid JSON Response

The judge expects JSON output. If the model returns malformed JSON:
1. Try a different model
2. Check the model version
3. Verify the system prompt is being applied

## Best Practices

1. **Write Clear Rubrics** - Be specific about what constitutes a pass
2. **Use Appropriate Models** - Smaller for speed, larger for accuracy
3. **Warm Up Models** - Prevents first-test latency
4. **Set Reasonable Scores** - Use score thresholds (e.g., >70) not just pass/fail
5. **Include Reasoning** - Log `verdict.reasoning` for debugging
6. **Test the Judge** - Verify your rubrics with known pass/fail cases
