import React, { useState } from 'react';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setInput('');
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
          <div className="p-4 border-b flex items-center justify-between bg-gray-50">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-600">AI Assistant</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              title="Close Chat"
            >
              &times;
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 ? (
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
                  {msg.text}
                </div>
              ))
            )}
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
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
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
