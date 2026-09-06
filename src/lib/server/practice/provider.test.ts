import { afterEach, expect, it, vi } from 'vitest';
import { configFrom, MAX_OUTPUT } from './budget';
import { gemini, ProviderResponseError, validateProviderInput } from './provider';

afterEach(() => vi.unstubAllGlobals());
it('reviews text and images together in one bounded request and counts thinking usage', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 200,
          thoughtsTokenCount: 300
        },
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    verdict: 'accepted',
                    summary: 'Works',
                    strengths: [],
                    findings: [],
                    nextStep: 'Continue'
                  })
                }
              ]
            }
          }
        ]
      })
    )
  );
  vi.stubGlobal('fetch', fetcher);
  const config = configFrom({ GEMINI_API_KEY: 'test-secret' });
  const result = await gemini.generate(config, {
    system: 'Policy',
    text: 'My design',
    images: [{ mime: 'image/jpeg', data: 'base64-image' }],
    kind: 'review'
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).not.toContain('test-secret');
  const body = JSON.parse(options.body);
  expect(body.contents[0].parts).toEqual([
    { text: 'My design' },
    { inlineData: { mimeType: 'image/jpeg', data: 'base64-image' } }
  ]);
  expect(body.generationConfig.maxOutputTokens).toBe(MAX_OUTPUT);
  expect(body.generationConfig).not.toHaveProperty('candidateCount');
  expect(result.charged).toBe(1950);
});
it('retries temporary 503 responses and reports explicit rejections as uncharged', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(new Response('', { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  const failure = await gemini
    .generate(configFrom({ GEMINI_API_KEY: 'test-secret' }), {
      system: 'Policy',
      text: 'Question',
      images: [],
      kind: 'clarify'
    })
    .catch((error) => error);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(failure).toBeInstanceOf(ProviderResponseError);
  expect(failure).toMatchObject({ providerStatus: 503, charged: 0 });
});
it('does not treat truncated or malformed output as acceptance', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, thoughtsTokenCount: 0 },
          candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }]
        })
      )
    )
  );
  const result = await gemini.generate(configFrom({}), {
    system: '',
    text: 'test',
    images: [],
    kind: 'review'
  });
  expect(result.value).toBeNull();
  expect(result.charged).toBeGreaterThan(0);
  expect(() =>
    validateProviderInput({ system: 'a'.repeat(80001), text: '', images: [], kind: 'review' })
  ).toThrow();
});
