import React, { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: string; // base64 data URL for attached image
}

interface Attachment {
  file: File;
  preview: string; // data URL for images, null for text
  textContent?: string; // for .md/.txt files
}

interface PromptItem {
  id: string;
  name: string;
}

const STORAGE_KEY = 'chat-history';
const PROMPT_KEY = 'chat-system-prompt';
const SESSION_ID = 'bionic-chat';

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }) => {
  const { backend } = useSettingsStore();
  const baseUrl = backend?.apiUrl || 'http://127.0.0.1:8000';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('none');
  const [activePromptContent, setActivePromptContent] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
      const savedPrompt = localStorage.getItem(PROMPT_KEY);
      if (savedPrompt) {
        setSelectedPrompt(savedPrompt);
        if (savedPrompt !== 'none') {
          fetchPromptContent(savedPrompt);
        }
      }
    } catch { /* ignore */ }

    // Fetch available prompts
    fetch(`${baseUrl}/systemprompts/`)
      .then(r => r.ok ? r.json() : [])
      .then(setPrompts)
      .catch(() => {});
  }, [baseUrl]);

  // Persist messages
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const fetchPromptContent = async (filename: string) => {
    try {
      const res = await fetch(`${baseUrl}/systemprompts/${filename}`);
      if (res.ok) {
        const data = await res.json();
        setActivePromptContent(data.content);
      }
    } catch { /* ignore */ }
  };

  const handlePromptChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedPrompt(value);
    localStorage.setItem(PROMPT_KEY, value);

    if (value === 'none') {
      setActivePromptContent(null);
      fetch(`${baseUrl}/chat/clear?session_id=${SESSION_ID}`, { method: 'POST' }).catch(() => {});
      // Inject a reset message so the LLM drops the old system prompt's influence
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '[System prompt cleared. I will now respond without any special instructions.]',
      }]);
    } else {
      await fetchPromptContent(value);
    }
  };

  const handleClear = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    setSelectedPrompt('none');
    setActivePromptContent(null);
    localStorage.setItem(PROMPT_KEY, 'none');
    fetch(`${baseUrl}/chat/clear?session_id=${SESSION_ID}`, { method: 'POST' }).catch(() => {});
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isText = /\.(md|txt)$/i.test(file.name);

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachment({ file, preview: reader.result as string });
      };
      reader.readAsDataURL(file);
    } else if (isText) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachment({ file, preview: '', textContent: reader.result as string });
      };
      reader.readAsText(file);
    } else {
      console.warn('[Chat] Unsupported file type:', file.type);
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !attachment) || isThinking) return;

    // Build message content with attachment
    let content = text;
    let image: string | undefined;
    if (attachment) {
      if (attachment.preview) {
        image = attachment.preview;
        if (!content) content = '[Image attached]';
      } else if (attachment.textContent) {
        content = content
          ? `${content}\n\n---\n[Attached file: ${attachment.file.name}]\n${attachment.textContent}`
          : `[Attached file: ${attachment.file.name}]\n${attachment.textContent}`;
      }
    }

    const userMsg: ChatMessage = { role: 'user', content, image };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setAttachment(null);
    setIsThinking(true);

    try {
      const spToSend = activePromptContent === null ? '__CLEAR__' : activePromptContent;
      console.log('[Chat] sending system_prompt:', spToSend === '__CLEAR__' ? 'CLEAR' : spToSend?.substring(0, 50));
      const res = await fetch(`${baseUrl}/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: SESSION_ID,
          messages: updatedMessages,
          system_prompt: spToSend,
        }),
      });

      const data = await res.json();
      if (data.status === 'success') {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.details}` }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err}` }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      {/* Drawer tab (visible when closed) */}
      {!isOpen && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-chat'))}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-24 bg-accent text-accent-foreground rounded-l-lg flex items-center justify-center shadow-lg hover:opacity-90 transition-colors z-50"
          title="Open Chat"
        >
          <span className="text-xs font-bold" style={{ writingMode: 'vertical-rl' }}>CHAT</span>
        </button>
      )}

      {/* Panel (visible when open) */}
      {isOpen && (
        <aside className="w-1/4 border-l border-border bg-card flex flex-col h-full shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">AI Assistant</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClear}
                  className="text-xs px-2 py-1 rounded bg-destructive text-white hover:opacity-90 transition-colors"
                  title="Clear all messages"
                >
                  Clear
                </button>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground text-xl leading-none"
                  title="Close Chat"
                >
                  &times;
                </button>
              </div>
            </div>
            <select
              value={selectedPrompt}
              onChange={handlePromptChange}
              className="w-full p-2 border border-border rounded text-sm bg-card text-foreground"
            >
              <option value="none">No System Prompt</option>
              {prompts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && !isThinking ? (
              <p className="text-muted-foreground italic text-sm text-center mt-8">
                Chat with your AI assistant. Messages will appear here.
              </p>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] p-3 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-accent-soft text-accent self-end'
                      : 'bg-muted text-foreground self-start'
                  }`}
                >
                  {msg.image && (
                    <img src={msg.image} alt="attachment" className="mb-2 max-h-48 rounded" />
                  )}
                  {msg.content}
                </div>
              ))
            )}
            {isThinking && (
              <div className="bg-muted self-start p-3 rounded-lg text-sm text-muted-foreground italic">
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-border">
            {/* Attachment preview */}
            {attachment && (
              <div className="mb-2 flex items-center gap-2">
                {attachment.preview ? (
                  <img src={attachment.preview} alt="attachment" className="h-16 rounded border border-border" />
                ) : (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                    📄 {attachment.file.name}
                  </span>
                )}
                <button
                  onClick={() => setAttachment(null)}
                  className="text-xs text-destructive hover:opacity-80"
                  title="Remove attachment"
                >
                  &times;
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.md,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isThinking}
                className="p-2 border border-border rounded text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                title="Attach file"
              >
                📎
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 p-2 border border-border rounded text-sm bg-card text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={handleSend}
                disabled={isThinking}
                className={`px-4 py-2 rounded text-sm transition-colors ${
                  isThinking
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-accent text-accent-foreground hover:opacity-90'
                }`}
              >
                Send
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
};

export default ChatPanel;
