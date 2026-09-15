import React, { useState, useEffect } from 'react';
import { marked } from 'marked';

const Docs = () => {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const res = await fetch('/docs/howto.md');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const md = await res.text();
        setHtml(marked.parse(md));
      } catch (e: any) {
        setError(e.message || 'Failed to load docs');
      } finally {
        setLoading(false);
      }
    };
    loadDocs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Loading docs…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">Could not load docs: {error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-6 overflow-y-auto h-full">
      <div
        className="prose prose-gray max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

export default Docs;
