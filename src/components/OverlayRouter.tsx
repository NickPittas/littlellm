'use client';

import { useEffect, useState, Suspense, lazy } from 'react';
import { debugLogger } from '../services/debugLogger';

// Lazy load heavy components for better performance
const ActionMenuOverlay = lazy(() => import('./ActionMenuOverlay').then(module => ({ default: module.ActionMenuOverlay })));
const SettingsOverlay = lazy(() => import('./SettingsOverlay').then(module => ({ default: module.SettingsOverlay })));
const ChatOverlay = lazy(() => import('./ChatOverlay').then(module => ({ default: module.ChatOverlay })));

export function OverlayRouter() {
  const [overlayType, setOverlayType] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Check URL parameters to determine overlay type
    const urlParams = new URLSearchParams(window.location.search);
    const overlay = urlParams.get('overlay');
    setOverlayType(overlay);
  }, []);

  if (!isClient || !overlayType) {
    return null;
  }

  switch (overlayType) {
    case 'action-menu':
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
          <ActionMenuOverlay />
        </Suspense>
      );
    case 'settings':
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
          <SettingsOverlay />
        </Suspense>
      );
    case 'chat':
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
          <ChatOverlay />
        </Suspense>
      );
    default:
      return null;
  }
}
