import { test, expect } from '@fixtures/globalFixtures';
import { judgeResponse } from '@utils/aiJudge';
import type { ChatJudgeCase } from '@utils/types';

/**
 * Example AI Judge tests demonstrating various use cases.
 *
 * Prerequisites:
 * 1. Ollama installed and running: ollama serve
 * 2. Model pulled: ollama pull qwen3.5:9b
 * 3. Or use: ./scripts/ci/judge-services.sh start
 */

test.describe('AI Judge Examples', () => {
    test('basic response evaluation', async () => {
        const verdict = await judgeResponse({
            userMessage: 'What are your store hours?',
            botResponse: 'We are open Monday to Friday from 9am to 5pm, and Saturday from 10am to 2pm.',
            rubric: 'Response must include weekday hours and weekend hours.',
        });

        expect(verdict.pass, verdict.reasoning).toBeTruthy();
        expect(verdict.score).toBeGreaterThan(70);
    });

    test('response with missing information', async () => {
        const verdict = await judgeResponse({
            userMessage: 'What are your store hours?',
            botResponse: 'We are open during business hours.',
            rubric: 'Response must include specific opening and closing times.',
        });

        // This should fail because no specific times are given
        expect(verdict.pass).toBeFalsy();
        expect(verdict.score).toBeLessThan(50);
    });

    test('multimodal evaluation with screenshot', async ({ page }) => {
        // Navigate to a page with visual content
        await page.goto('https://example.com');

        // Take screenshot for visual evaluation
        const screenshot = await page.screenshot();

        const verdict = await judgeResponse({
            userMessage: 'Show me the example page',
            botResponse: '', // Image-only evaluation
            rubric: 'The page should display "Example Domain" as the main heading.',
            image: screenshot,
        });

        expect(verdict.pass, verdict.reasoning).toBeTruthy();
    });

    test('model override for specific test', async () => {
        const verdict = await judgeResponse({
            userMessage: 'Explain quantum computing',
            botResponse:
                'Quantum computing uses quantum bits (qubits) that can exist in multiple states simultaneously through superposition.',
            rubric: 'Must mention qubits and superposition.',
            // Override model for this specific test
            model: 'local/qwen3.5:9b',
        });

        expect(verdict.pass, verdict.reasoning).toBeTruthy();
    });
});

test.describe('Table-Driven AI Judge Tests', () => {
    const testCases: ChatJudgeCase[] = [
        {
            name: 'greeting response',
            userMessage: '',
            rubric: 'Bot should provide a friendly greeting.',
            expectPass: true,
        },
        {
            name: 'product inquiry - valid',
            userMessage: 'Do you sell laptops?',
            rubric: 'Response should confirm or deny laptop availability.',
            expectPass: true,
        },
        {
            name: 'return policy',
            userMessage: 'What is your return policy?',
            rubric: 'Must mention return window (number of days) and conditions.',
            expectPass: true,
        },
    ];

    // Mock bot responses for demonstration
    const mockResponses: Record<string, string> = {
        greeting: 'Hello! Welcome to our store. How can I help you today?',
        'product inquiry - valid': 'Yes, we carry a wide selection of laptops from various brands.',
        'return policy':
            'You can return items within 30 days of purchase with receipt. Items must be unused.',
    };

    for (const c of testCases) {
        test(c.name, async () => {
            const botResponse = mockResponses[c.name] || 'I apologize, I cannot help with that.';

            const verdict = await judgeResponse({
                userMessage: c.userMessage,
                botResponse,
                rubric: c.rubric,
            });

            if (c.expectPass !== false) {
                expect(verdict.pass, `Failed: ${verdict.reasoning}`).toBeTruthy();
            } else {
                expect(verdict.pass, `Expected failure but passed: ${verdict.reasoning}`).toBeFalsy();
            }

            // Log for debugging
            console.log(`[${c.name}] Score: ${verdict.score}, Pass: ${verdict.pass}`);
        });
    }
});

test.describe('Score Threshold Tests', () => {
    test('high quality response scores above 80', async () => {
        const verdict = await judgeResponse({
            userMessage: 'How do I reset my password?',
            botResponse: `To reset your password:
1. Go to the login page
2. Click "Forgot Password"
3. Enter your email address
4. Check your email for the reset link
5. Click the link and create a new password

The link expires in 24 hours. Contact support if you need help.`,
            rubric: 'Must provide clear step-by-step instructions for password reset.',
        });

        expect(verdict.pass).toBeTruthy();
        expect(verdict.score).toBeGreaterThan(80);
    });

    test('minimal response scores below 60', async () => {
        const verdict = await judgeResponse({
            userMessage: 'How do I reset my password?',
            botResponse: 'Click forgot password.',
            rubric: 'Must provide clear step-by-step instructions for password reset.',
        });

        // Minimal response should score lower
        expect(verdict.score).toBeLessThan(60);
    });
});
