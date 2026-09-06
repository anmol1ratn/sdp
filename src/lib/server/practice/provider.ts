import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { type AIConfig, cost, MAX_INPUT_BYTES, MAX_OUTPUT } from './budget';

const finding = z.object({
  kind: z.enum(['incorrect', 'missing-explanation', 'unknown-requirement', 'unreadable']),
  ruleId: z.string().nullable(),
  text: z.string().max(3000)
});
export const reviewSchema = z.object({
  verdict: z.enum(['accepted', 'needs-revision', 'clarification-needed']),
  summary: z.string().max(4000),
  strengths: z.array(z.string().max(1500)).max(6),
  findings: z.array(finding).max(10),
  nextStep: z.string().max(3000)
});
export const clarificationSchema = z.object({
  text: z.string().min(1).max(6000),
  ruleIds: z.array(z.string()).max(10),
  assumptions: z.array(z.string().max(500)).max(8),
  platformCorrection: z.boolean()
});
export interface ProviderRequest {
  system: string;
  text: string;
  images: { mime: string; data: string }[];
  kind: 'clarify' | 'review' | 'challenge';
}
export interface ProviderResult {
  value: unknown;
  charged: number | null;
}
export interface ReviewProvider {
  generate(config: AIConfig, request: ProviderRequest): Promise<ProviderResult>;
}
export class ProviderResponseError extends Error {
  readonly charged = 0;
  constructor(readonly providerStatus: number) {
    super(
      providerStatus === 503
        ? 'Gemini is temporarily unavailable after retrying (503). Your question is preserved; try again in a moment.'
        : `Gemini rejected the request (${providerStatus}). Your work is preserved and no AI allowance was spent.`
    );
  }
}
export function validateProviderInput(request: ProviderRequest) {
  if (new TextEncoder().encode(request.system + request.text).length > MAX_INPUT_BYTES)
    error(
      413,
      'The conversation is too long for a bounded review. Shorten the draft or start with fewer details.'
    );
}
// No SDK retries: every generation must have its own durable reservation.
export const gemini: ReviewProvider = {
  async generate(config, request) {
    validateProviderInput(request);
    const schema = request.kind === 'clarify' ? clarificationSchema : reviewSchema;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: request.text },
              ...request.images.map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } }))
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT,
          thinkingConfig: { thinkingLevel: 'LOW' },
          responseMimeType: 'application/json',
          responseJsonSchema: z.toJSONSchema(schema)
        }
      })
    } satisfies RequestInit;
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(url, { ...options, signal: AbortSignal.timeout(65000) });
      if (response.status !== 503 || attempt === 2) break;
      await response.arrayBuffer();
      await new Promise((resolve) =>
        setTimeout(resolve, 500 * 2 ** attempt + Math.floor(Math.random() * 250))
      );
    }
    if (!response?.ok) throw new ProviderResponseError(response?.status ?? 503);
    const data = (await response.json()) as {
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        thoughtsTokenCount?: number;
      };
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string; thought?: boolean }[] };
      }[];
    };
    const usage = data.usageMetadata;
    const charged =
      usage &&
      typeof usage.promptTokenCount === 'number' &&
      typeof usage.candidatesTokenCount === 'number'
        ? cost(
            usage.promptTokenCount,
            usage.candidatesTokenCount + (usage.thoughtsTokenCount ?? 0),
            config
          )
        : null;
    const candidate = data.candidates?.[0];
    let value: unknown = null;
    if (candidate?.finishReason === 'STOP') {
      try {
        value = schema.parse(
          JSON.parse(
            candidate.content?.parts
              ?.filter((p) => !p.thought)
              .map((p) => p.text ?? '')
              .join('') ?? ''
          )
        );
      } catch {
        /* Invalid/truncated responses never advance progress. */
      }
    }
    return { value, charged };
  }
};
