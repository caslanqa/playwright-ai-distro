import { imageToBase64 } from '../judge/judgePrompt';
import { parseVerdict } from '../judge/verdictParser';
import type { JudgeVerdict } from '../types';
import { type AIProvider, JudgeHttpError } from './provider';

/** Strip a trailing /v1 from JUDGE_OLLAMA_BASE_URL to reach Ollama's native API root. */
export function ollamaApiBase(): string {
  const v1 = process.env.JUDGE_OLLAMA_BASE_URL;
  if (v1 === undefined || v1.length === 0) {
    throw new Error('[ai-judge] JUDGE_OLLAMA_BASE_URL is not set (env/environments.json)');
  }

  return v1.replace(/\/v1\/?$/, '');
}

/**
 * Judge via local Ollama using the NATIVE /api/chat endpoint with `think: false`. This is
 * essential for thinking models (qwen3.x): leaving thinking on costs ~40s+ per call, and the
 * OpenAI-compatible /v1 endpoint cannot disable it. Images go as raw base64 in `images` (one entry
 * for single-image judging, [actual, reference] for compare mode).
 */
export const ollamaProvider: AIProvider = {
  async judge(model, systemPrompt, userText, images): Promise<JudgeVerdict> {
    const userMessage: Record<string, unknown> = { role: 'user', content: userText };
    if (images.length > 0) {
      userMessage.images = images.map(imageToBase64);
    }

    const response = await fetch(`${ollamaApiBase()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        think: false, // disable thinking → fast (qwen3.x reasoning adds ~40s/call otherwise)
        keep_alive: process.env.JUDGE_OLLAMA_KEEP_ALIVE ?? '30m', // keep model resident across the run
        options: { temperature: 0 },
        messages: [{ role: 'system', content: systemPrompt }, userMessage],
      }),
    });

    if (!response.ok) {
      throw new JudgeHttpError(
        response.status,
        `[ai-judge] Ollama ${response.status}: ${await response.text()}`
      );
    }

    const data = (await response.json()) as { message?: { content?: string } };

    return parseVerdict(data.message?.content ?? '');
  },
};
