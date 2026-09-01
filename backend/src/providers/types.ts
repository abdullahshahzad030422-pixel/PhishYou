export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Provider-specific reasoning payload (e.g. OpenRouter reasoning_details) passed back unmodified. */
  reasoning_details?: unknown;
}

export interface ChatResponse {
  content: string;
  /** Provider reasoning payload to pass back unmodified on subsequent turns. */
  reasoning_details?: unknown;
}

export interface AIProvider {
  /** Human-readable provider name. */
  readonly name: string;

  /**
   * Perform a lightweight real call to verify the provider is reachable and
   * credentials are valid. Must return a rejected promise on failure.
   */
  testConnection(): Promise<void>;

  /**
   * Send a conversation to the LLM and return the assistant's reply.
   */
  chat(messages: ChatMessage[]): Promise<ChatResponse>;
}
