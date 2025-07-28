'use client';

import { useState, useEffect } from 'react';
import { VoilaInterface } from '../components/VoilaInterface';
import { OverlayRouter } from '../components/OverlayRouter';
import { ModernChatInterface } from '../components/modern-ui/ModernChatInterface';

// Test utilities removed - clean production build

export default function Home() {
  // Home component rendering
  const [isOverlay, setIsOverlay] = useState(false);
  const [useModernUI, setUseModernUI] = useState(false);

  useEffect(() => {
    // Check if this is an overlay window or modern UI
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const overlay = urlParams.has('overlay');
      const modern = urlParams.has('modern');
      setIsOverlay(overlay);
      setUseModernUI(modern);
    }
  }, []);

  if (isOverlay) {
    return (
      <div className="h-full w-full bg-background" style={{ width: '100vw', height: '100vh' }}>
        <OverlayRouter />
      </div>
    );
  }

  if (useModernUI) {
    return (
      <div className="h-screen w-screen bg-gray-950 overflow-hidden modern-chat-interface">
        <ModernChatInterface />
      </div>
    );
  }

  // During development, default to modern UI to prevent VoilaInterface conflicts
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment) {
    return (
      <div className="h-screen w-screen bg-gray-950 overflow-hidden modern-chat-interface">
        <ModernChatInterface />
      </div>
    );
  }

  return (
    <VoilaInterface />
  );
}
