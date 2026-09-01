import type { AIProvider, ChatMessage, ChatResponse } from './types.js';

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
      throw new Error(`[${response.status}] ${safeErrorMessage(payload) || `Provider HTTP ${response.status}`}`);
    }

    const message = payload.choices?.[0]?.message;
    const content = message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('Provider returned an empty response');
    }
    return { content, reasoning_details: message?.reasoning_details };
  }

  async testConnection(): Promise<void> {
    // Reasoning models may spend part of the token budget on reasoning,
    // so allow enough tokens for both reasoning and a visible reply.
    await this.call(
      [
        { role: 'system', content: 'You are a helpful assistant. Reply with only the word OK.' },
        { role: 'user', content: 'Ping' },
      ],
      256,
    );
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    // Reasoning models consume part of this budget on internal reasoning,
    // so keep it generous enough to still produce a visible reply.
    const { content, reasoning_details } = await this.call(messages, 8192);
    return { content, reasoning_details };
  }
}
