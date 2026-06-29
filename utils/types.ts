/**
 * A single table-driven case for judging a chatbot response against a rubric.
 * Lets specs declare many scenarios as data and loop over them instead of
 * copy-pasting near-identical test bodies.
 * @example
 * <code>
 * const cases: ChatJudgeCase[] = [
 *   { name: 'greeting', userMessage: '', rubric: 'Bot greets the user.' },
 *   { name: 'no hours', userMessage: 'When do you open?', rubric: 'States 9am.', expectPass: false },
 * ];
 * for (const c of cases) {
 *   test(c.name, async () => { ... });
 * }
 * </code>
 */
export interface ChatJudgeCase {
  /** Human-readable case name, used as the test title. */
  name: string;
  /** The message sent to the chatbot ('' when the bot speaks first, e.g. a greeting). */
  userMessage: string;
  /** Plain-language criteria the bot response must satisfy. */
  rubric: string;
  /** Expected judge outcome. Defaults to true (the case should pass) when omitted. */
  expectPass?: boolean;
}

/** A judged case: the input case paired with the verdict the judge returned. */
export interface JudgedCase {
  case: ChatJudgeCase;
  verdict: JudgeVerdict;
}

/** Structured verdict returned by the judge model. */
export interface JudgeVerdict {
  /** Whether the bot response satisfies the rubric. */
  pass: boolean;
  /** Quality score 0-100. */
  score: number;
  /** Short justification for the verdict. */
  reasoning: string;
}

/** Input for a single judging call. */
export interface JudgeInput {
  /** The message the user sent to the chatbot. */
  userMessage: string;
  /** The chatbot response under test. */
  botResponse: string;
  /** Plain-language criteria describing what a correct response must contain. */
  rubric: string;
  /** Override the judge model for this call (defaults to JUDGE_MODEL). */
  model?: string;
  /**
   * Optional image to evaluate alongside the text (multimodal judging). Accepts a Playwright
   * screenshot Buffer, a data URI ("data:image/png;base64,..."), or a file path. Requires a
   * vision-capable judge model (e.g. gh/claude-*, gh/gemini-*, a local qwen3.5).
   */
  image?: string | Buffer;
}

/** Minimal shape of the OpenAI-compatible chat completion response we consume. */
export interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}
