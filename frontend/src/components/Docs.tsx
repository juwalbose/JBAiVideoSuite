import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { useSettingsStore } from '../store/settingsStore';

const Docs = () => {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const backendUrl = useSettingsStore((s) => s.backend.apiUrl);

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const res = await fetch(`${backendUrl}/docs`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.content) throw new Error('No docs content returned');
        setHtml(await marked.parse(data.content));
      } catch (e: any) {
        setError(e.message || 'Failed to load docs');
      } finally {
        setLoading(false);
      }
    };
    loadDocs();
  }, [backendUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading docs…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Could not load docs: {error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-6 overflow-y-auto h-full">
      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

export default Docs;
