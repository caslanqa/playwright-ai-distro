import { aiJudgeConfig } from '@config/aiJudge.config';
import { expectAi } from '@fixtures/aiExpect';
import { expect, test } from '@fixtures/desktopFixtures';
import { getRegistry } from '@utils/ai/registry/providerRegistry';

// The bundled example app (desktop/apps.ts → 'example').
test.use({ desktop: { app: 'example' } });

test.describe('Desktop AI-judge — Electron', () => {
  // Skip cleanly when no vision-capable AI provider is configured (an Ollama vision model, or an
  // OpenAI key), so the suite stays green on machines without one. `getRegistry` discovers the
  // available models and degrades gracefully when a provider is down.
  test.beforeEach(async () => {
    const registry = await getRegistry(aiJudgeConfig);
    test.skip(
      !registry.models.some(model => model.supportsVision),
      'no vision-capable AI provider — start an Ollama vision model (JUDGE_OLLAMA_BASE_URL) or set OPENAI_API_KEY'
    );
  });

  // The unified-QA payoff: drive a native desktop window with Playwright, then judge a screenshot of
  // it with the SAME multimodal AI judge used for web and mobile (see docs/AI_JUDGE.md).
  test('the window is judged against a rubric', async ({ window, electron }) => {
    await expect(window.getByRole('heading', { level: 1 })).toBeVisible();

    const shot = await electron.screenshot('window');
    await expectAi({
      image: shot,
      rubric:
        'A desktop application window for a "Playwright AI Desktop Example" — it shows a heading, a ' +
        'short description, and a button. A well-formed app screen, not an error page or blank window.',
    }).toPassRubric({ minScore: 60 });
  });
});
