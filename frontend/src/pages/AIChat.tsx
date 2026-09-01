import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, Loader2, RefreshCw, Send, User } from 'lucide-react';
import {
  fetchAIConfig,
  getErrorMessage,
  sendChatMessage,
  type AIStatusResponse,
  type ChatMessage,
} from '../services/ai';

export default function AIChat() {
  const [config, setConfig] = useState<AIStatusResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'You are a helpful AI assistant for a security-awareness phishing simulation platform.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, error]);

  async function loadStatus() {
    try {
      const status = await fetchAIConfig();
      setConfig(status);
      setConfigError(null);
    } catch (err) {
      setConfig({ status: 'not_configured', provider: null, model: null, endpoint: null });
      setConfigError(getErrorMessage(err));
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const reply = await sendChatMessage(nextMessages);
      // Preserve reasoning_details so reasoning models continue from where they left off.
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: reply.content,
          ...(reply.reasoning_details !== undefined
            ? { reasoning_details: reply.reasoning_details }
            : {}),
        },
      ]);
    } catch (err) {
      setError(getErrorMessage(err));
      // Remove the user message on error so the conversation stays consistent
      // and the user can retry cleanly.
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    setError(null);
  }

  const visibleMessages = messages.filter((m) => m.role !== 'system');
  const isConfigured = config?.status === 'configured';

  return (
    <div className="py-page py-dashboard" style={{ maxWidth: 900 }}>
      <section className="py-command-hero" style={{ padding: '36px' }}>
        <div className="py-command-copy">
          <p className="py-eyebrow">AI WORKSPACE</p>
          <h1 className="py-title">AI Chat</h1>
          <p className="py-lede">
            Send messages directly to the configured LLM provider. This is a live connection —
            responses come from the real model, not mock data.
          </p>
        </div>
      </section>

      {!isConfigured && (
        <div
          style={{
            marginTop: 24,
            padding: 18,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <AlertTriangle size={22} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>AI not configured</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              Configure the LLM provider, model, endpoint and API key in Settings → Integrations,
              then test the connection.
            </p>
          </div>
        </div>
      )}

      {configError && isConfigured && (
        <div
          style={{
            marginTop: 24,
            padding: 18,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <AlertTriangle size={22} color="var(--accent)" />
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{configError}</p>
          <button type="button" onClick={loadStatus} style={{ marginLeft: 'auto' }}>
            <RefreshCw size={16} />
          </button>
        </div>
      )}

      <section
        style={{
          marginTop: 24,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 340px)',
          minHeight: 420,
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {visibleMessages.length === 0 && (
            <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--muted)', fontSize: 14 }}>
              Start the conversation by typing a message below.
            </div>
          )}

          {visibleMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  gap: 12,
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={16} />
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: 14,
                    background: isUser ? 'var(--ink)' : 'var(--bg-2)',
                    color: isUser ? 'var(--bg)' : 'var(--ink)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
                {isUser && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--bg-2)',
                      color: 'var(--ink)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <User size={16} />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Bot size={16} />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: 'var(--bg-2)',
                  color: 'var(--muted)',
                  fontSize: 13,
                }}
              >
                <Loader2 size={16} className="animate-spin" />
                AI is thinking…
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                background: 'var(--accent-soft)',
                border: '1px solid var(--line)',
              }}
            >
              <AlertTriangle size={18} color="var(--accent)" />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Could not get a response</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>{error}</p>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <RefreshCw size={14} /> Dismiss
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid var(--line)',
            background: 'var(--bg-2)',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isConfigured ? 'Type a message…' : 'Configure AI to start chatting'}
              disabled={!isConfigured || loading}
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                maxHeight: 140,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                fontSize: 14,
                lineHeight: 1.5,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!isConfigured || loading || !input.trim()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                border: 'none',
                background: 'var(--ink)',
                color: 'var(--bg)',
                display: 'grid',
                placeItems: 'center',
                opacity: !isConfigured || loading || !input.trim() ? 0.5 : 1,
              }}
              aria-label="Send message"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
