'use client';

import { useState, useEffect, Suspense, lazy } from 'react';
import { OverlayRouter } from '../components/OverlayRouter';

// Lazy load the heavy ModernChatInterface to reduce initial bundle size
const ModernChatInterface = lazy(() => import('../components/modern-ui/ModernChatInterface').then(m => ({ default: m.ModernChatInterface })));

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
      <Suspense fallback={
        <div className="h-full w-full flex items-center justify-center bg-gray-950">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading LittleLLM...</p>
          </div>
        </div>
      }>
        <ModernChatInterface />
      </Suspense>
    </div>
  );
}
