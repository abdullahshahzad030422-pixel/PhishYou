import type { AIProvider, ChatMessage, ChatResponse } from './types.js';
// v2 — handles reasoning models that return empty content

interface OpenAICompatibleChoice {
  message?: {
    content?: string | null;
    reasoning_details?: unknown;
  };
}

interface OpenAICompatibleResponse {
  choices?: OpenAICompatibleChoice[];
  error?: { message?: string };
}

function safeErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'Unknown provider error';
  const p = payload as Record<string, unknown>;
  if (p.error && typeof p.error === 'object') {
    const e = p.error as { message?: string };
    return e.message ?? 'Provider error';
  }
  if (typeof p.message === 'string') return p.message;
  return 'Unknown provider error';
}

export class QwenProvider implements AIProvider {
  readonly name = 'qwen';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly endpoint: string,
  ) {}

  private async call(
    messages: ChatMessage[],
    maxTokens: number,
  ): Promise<{ content: string; reasoning_details?: unknown }> {
    if (!this.apiKey || this.apiKey.trim().length < 8) {
      throw new Error('Missing or invalid LLM API key');
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        // OpenRouter requires these headers for attribution on free-tier models.
        'HTTP-Referer': 'https://phishyou.app',
        'X-Title': 'PhishYou',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: maxTokens,
      }),
    });

    let payload: OpenAICompatibleResponse;
    try {
      payload = (await response.json()) as OpenAICompatibleResponse;
    } catch {
      throw new Error(response.ok ? 'Empty or invalid provider response' : `Provider HTTP ${response.status}`);
    }

    if (!response.ok) {
      const raw = JSON.stringify(payload);
      // Log the full provider response to the backend console for diagnosis.
      console.error(`[LLM] Provider error ${response.status}:`, raw);
      throw new Error(`[${response.status}] ${safeErrorMessage(payload) || `Provider HTTP ${response.status}`}`);
    }

    const message = payload.choices?.[0]?.message;
    const content = message?.content;
    // Some reasoning models (e.g. Nemotron free tier) return an empty content
    // field but put their reply inside reasoning_details. Accept either.
    const reasoningText =
      message?.reasoning_details &&
      typeof (message.reasoning_details as Record<string, unknown>).content === 'string'
        ? (message.reasoning_details as Record<string, unknown>).content as string
        : null;

    const finalContent = (typeof content === 'string' && content.length > 0)
      ? content
      : (reasoningText ?? '');

    // Log for debugging
    console.log('[LLM] Response debug:', {
      hasChoices: !!payload.choices?.length,
      hasMessage: !!message,
      contentType: typeof content,
      contentLength: typeof content === 'string' ? content.length : 0,
      hasReasoningDetails: !!message?.reasoning_details,
      finalContentLength: finalContent.length
    });

    if (!finalContent) {
      throw new Error('Provider returned an empty response');
    }
    return { content: finalContent, reasoning_details: message?.reasoning_details };
  }

  async testConnection(): Promise<void> {
    // Reasoning models spend most of their token budget on internal reasoning
    // before producing visible output. Use a generous limit so testConnection
    // doesn't fail with an empty response on free-tier reasoning models.
    await this.call(
      [
        { role: 'user', content: 'Say OK' },
      ],
      4096,
    );
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    // Reasoning models consume part of this budget on internal reasoning,
    // so keep it generous enough to still produce a visible reply.
    const { content, reasoning_details } = await this.call(messages, 16384);
    return { content, reasoning_details };
  }
}
