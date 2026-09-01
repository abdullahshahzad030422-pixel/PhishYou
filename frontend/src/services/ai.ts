import { apiFetch, ApiError } from './api';

export type AIStatus = 'not_configured' | 'configured' | 'testing' | 'connected' | 'error';

export interface AIConfig {
  provider: string;
  model: string;
  endpoint: string;
  apiKey: string;
}

export interface AIStatusResponse {
  status: 'not_configured' | 'configured';
  provider: string | null;
  model: string | null;
  endpoint: string | null;
}

export interface TestConnectionResponse {
  success: boolean;
  status: AIStatus;
  message?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** Provider reasoning payload (e.g. OpenRouter reasoning_details) passed back unmodified. */
  reasoning_details?: unknown;
}

export interface ChatResponse {
  content: string;
  reasoning_details?: unknown;
}

export function fetchAIConfig(): Promise<AIStatusResponse> {
  return apiFetch<AIStatusResponse>('/api/v1/ai/config');
}

export function saveAIConfig(config: AIConfig): Promise<AIStatusResponse> {
  return apiFetch<AIStatusResponse>('/api/v1/ai/config', {
    method: 'POST',
    body: config,
  });
}

export function testAIConnection(): Promise<TestConnectionResponse> {
  return apiFetch<TestConnectionResponse>('/api/v1/ai/test-connection', { method: 'POST' });
}

export function sendChatMessage(messages: ChatMessage[]): Promise<ChatResponse> {
  return apiFetch<ChatResponse>('/api/v1/ai/chat', {
    method: 'POST',
    body: { messages },
    // Reasoning models can take noticeably longer to produce a reply.
    timeoutMs: 120000,
  });
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}
