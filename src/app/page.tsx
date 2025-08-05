'use client';

import { useState, useEffect } from 'react';
import { OverlayRouter } from '../components/OverlayRouter';
import { ModernChatInterface } from '../components/modern-ui/ModernChatInterface';

// Test utilities removed - clean production build

export default function Home() {
  // Home component rendering
  const [isOverlay, setIsOverlay] = useState(false);

  useEffect(() => {
    // Check if this is an overlay window
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const overlay = urlParams.has('overlay');
      setIsOverlay(overlay);
    }
  }, []);

  // If this is an overlay window, render the overlay router
  if (isOverlay) {
    return (
      <div className="h-full w-full bg-background" style={{ width: '100vw', height: '100vh' }}>
        <OverlayRouter />
      </div>
    );
  }

  // Default to modern UI for all cases (development and production)
  return (
    <div className="h-screen w-screen bg-gray-950 overflow-hidden modern-chat-interface">
      <ModernChatInterface />
    </div>
  );
}
