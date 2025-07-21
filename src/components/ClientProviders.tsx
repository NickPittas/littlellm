'use client';

import { useEffect } from 'react';
import SquircleWindow from '@/components/SquircleWindow';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TransparencyProvider } from '@/contexts/TransparencyContext';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Set document title and meta description for client-side rendering
    if (typeof document !== 'undefined') {
      document.title = 'LittleLLM Chat';
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', 'A simple chat interface for LittleLLM');
      } else {
        const meta = document.createElement('meta');
        meta.name = 'description';
        meta.content = 'A simple chat interface for LittleLLM';
        document.head.appendChild(meta);
      }
    }
  }, []);

  return (
    <ThemeProvider>
      <TransparencyProvider>
        <SquircleWindow cornerRadius={32} cornerSmoothing={0.9} enabled={false}>
          {children}
        </SquircleWindow>
      </TransparencyProvider>
    </ThemeProvider>
  );
}
