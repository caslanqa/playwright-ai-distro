import { readFileSync } from 'fs';

import { ChatCompletionResponse, JudgeInput, JudgeVerdict } from './types';

const DEFAULT_MODEL = 'local/qwen3.5:9b';
const OLLAMA_PREFIXES = ['local/'];

const SYSTEM_PROMPT =
    'You are a strict QA judge. Evaluate the provided material — the bot response text and/or ' +
    'the attached image — ONLY against the rubric. When only an image is provided, judge the ' +
    'image against the rubric and do NOT penalize the absence of text. ' +
    'Reply with ONLY a JSON object: {"pass": boolean, "score": number 0-100, "reasoning": string}. ' +
    'Do not include any text outside the JSON.';

/**
 * Build the user message text. Omits empty sections and, for image-only judging (no bot text
 * but an image present), points the judge at the image so it does not treat the missing text
 * as "no content to evaluate".
 */
function buildUserText(input: JudgeInput): string {
    const parts = [`RUBRIC:\n${input.rubric}`];
    if (input.userMessage) {
        parts.push(`USER MESSAGE:\n${input.userMessage}`);
    }
    if (input.botResponse) {
        parts.push(`BOT RESPONSE:\n${input.botResponse}`);
    } else if (input.image !== undefined) {
        parts.push('MATERIAL TO EVALUATE: the attached image (there is no text response).');
    }

    return parts.join('\n\n');
}

/** Raw base64 (no data: prefix) — the format Ollama's native API expects in `images`. */
function imageToBase64(image: string | Buffer): string {
    if (Buffer.isBuffer(image)) {
        return image.toString('base64');
    }
    if (image.startsWith('data:')) {
        return image.replace(/^data:[^;]+;base64,/, '');
    }

    return readFileSync(image).toString('base64');
}

/** Data URI — the format an OpenAI-style `image_url` content part expects. */
function imageToDataUri(image: string | Buffer): string {
    if (Buffer.isBuffer(image)) {
        return `data:image/png;base64,${image.toString('base64')}`;
    }
    if (image.startsWith('data:')) {
        return image;
    }

    const ext = image.split('.').pop()?.toLowerCase();
    const mime =
        ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'webp'
                ? 'image/webp'
                : ext === 'gif'
                    ? 'image/gif'
                    : 'image/png';

    return `data:${mime};base64,${readFileSync(image).toString('base64')}`;
}

/** Strip an optional ```json ... ``` fence, then parse the verdict JSON. */
function parseVerdict(raw: string): JudgeVerdict {
    const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

    try {
        return JSON.parse(json) as JudgeVerdict;
    } catch {
        throw new Error(`[ai-judge] model did not return valid JSON: ${raw.slice(0, 300)}`);
    }
}

/** Strip a trailing /v1 from JUDGE_OLLAMA_BASE_URL to reach Ollama's native API root. */
function ollamaApiBase(): string {
    const v1 = process.env.JUDGE_OLLAMA_BASE_URL;
    if (v1 === undefined || v1.length === 0) {
        throw new Error('[ai-judge] JUDGE_OLLAMA_BASE_URL is not set (env/environments.json)');
    }

    return v1.replace(/\/v1\/?$/, '');
}

/**
 * Judge via local Ollama using the NATIVE /api/chat endpoint with `think: false`. This is
 * essential for thinking models (qwen3.x): leaving thinking on costs ~40s+ per call, and the
 * OpenAI-compatible /v1 endpoint cannot disable it. Images go as raw base64 in `images`.
 */
async function judgeViaOllama(
    model: string,
    userText: string,
    image: string | Buffer | undefined
): Promise<JudgeVerdict> {
    const userMessage: Record<string, unknown> = { role: 'user', content: userText };
    if (image !== undefined) {
        userMessage.images = [imageToBase64(image)];
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
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, userMessage],
        }),
    });

    if (!response.ok) {
        throw new Error(`[ai-judge] Ollama ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };

    return parseVerdict(data.message?.content ?? '');
}

/** Judge via the 9Router gateway using the OpenAI-compatible /chat/completions endpoint. */
async function judgeVia9Router(
    model: string,
    userText: string,
    image: string | Buffer | undefined
): Promise<JudgeVerdict> {
    const baseUrl = process.env.JUDGE_BASE_URL;
    if (baseUrl === undefined || baseUrl.length === 0) {
        throw new Error('[ai-judge] JUDGE_BASE_URL is not set (env/environments.json)');
    }

    const apiKey = process.env.JUDGE_API_KEY;
    if (apiKey === undefined || apiKey.length === 0) {
        throw new Error('[ai-judge] JUDGE_API_KEY is not set (required for the 9Router gateway)');
    }

    // Plain string for text-only judging; an OpenAI-style multimodal array when an image is given.
    const userContent =
        image === undefined
            ? userText
            : [
                { type: 'text', text: userText },
                { type: 'image_url', image_url: { url: imageToDataUri(image) } },
            ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            stream: false,
            temperature: 0,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userContent },
            ],
        }),
    });

    if (!response.ok) {
        throw new Error(
            `[ai-judge] judge backend ${response.status} (${baseUrl}): ${await response.text()}`
        );
    }

    const data = (await response.json()) as ChatCompletionResponse;

    return parseVerdict(data.choices?.[0]?.message?.content ?? '');
}

/**
 * Grade a chatbot response (and optionally an image) against a rubric using an LLM judge.
 * Routes by the selected model's prefix: "local/" → local Ollama
 * (native /api/chat, no key); anything else → the 9Router gateway (OpenAI /v1, API key).
 *
 * @param input The user message, bot response, rubric, optional image, and optional model.
 * @returns The parsed pass/fail verdict.
 * @example
 * <code>
 * const verdict = await judgeResponse({
 *   userMessage: 'What time do you open?',
 *   botResponse: 'We open at 9am every day.',
 *   rubric: 'Must state the store opens at 9am.',
 * });
 * expect(verdict.pass, verdict.reasoning).toBeTruthy();
 * </code>
 */
export async function judgeResponse(input: JudgeInput): Promise<JudgeVerdict> {
    const selected = input.model ?? process.env.JUDGE_MODEL ?? DEFAULT_MODEL;
    const ollamaPrefix = OLLAMA_PREFIXES.find(prefix => selected.startsWith(prefix));
    const userText = buildUserText(input);

    if (ollamaPrefix !== undefined) {
        return judgeViaOllama(selected.slice(ollamaPrefix.length), userText, input.image);
    }

    return judgeVia9Router(selected, userText, input.image);
}
