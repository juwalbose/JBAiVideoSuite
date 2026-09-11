import React, { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
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
          className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-24 bg-blue-600 text-white rounded-l-lg flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors z-50"
          title="Open Chat"
        >
          <span className="text-xs font-bold" style={{ writingMode: 'vertical-rl' }}>CHAT</span>
        </button>
      )}

      {/* Panel (visible when open) */}
      {isOpen && (
        <aside className="w-1/4 border-l bg-white flex flex-col h-full shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600">AI Assistant</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                title="Close Chat"
              >
                &times;
              </button>
            </div>
            <select
              value={selectedPrompt}
              onChange={handlePromptChange}
              className="w-full p-2 border rounded text-sm bg-white"
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
              <p className="text-gray-400 italic text-sm text-center mt-8">
                Chat with your AI assistant. Messages will appear here.
              </p>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] p-3 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-100 self-end'
                      : 'bg-gray-100 self-start'
                  }`}
                >
                  {msg.content}
                </div>
              ))
            )}
            {isThinking && (
              <div className="bg-gray-100 self-start p-3 rounded-lg text-sm text-gray-500 italic">
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-4 border-t flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 p-2 border rounded text-sm"
            />
            <button
              onClick={handleSend}
              disabled={isThinking}
              className={`px-4 py-2 rounded text-sm transition-colors ${
                isThinking
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Send
            </button>
          </div>
        </aside>
      )}
    </>
  );
};

export default ChatPanel;
