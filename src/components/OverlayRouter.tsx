'use client';

import { useEffect, useState } from 'react';
import { ActionMenuOverlay } from './ActionMenuOverlay';
import { SettingsOverlay } from './SettingsOverlay';
import { ChatOverlay } from './ChatOverlay';

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
      return <ActionMenuOverlay />;
    case 'settings':
      return <SettingsOverlay />;
    case 'chat':
      return <ChatOverlay />;
    default:
      return null;
  }
}
