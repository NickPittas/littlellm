'use client';

import { useState, useEffect } from 'react';
import { VoilaInterface } from '../components/VoilaInterface';
import { OverlayRouter } from '../components/OverlayRouter';

export default function Home() {
  const [isOverlay, setIsOverlay] = useState(false);

  useEffect(() => {
    // Check if this is an overlay window
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setIsOverlay(urlParams.has('overlay'));
    }
  }, []);

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.closeWindow();
    }
  };

  const handleMinimize = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.maximizeWindow();
    }
  };

  if (isOverlay) {
    return (
      <div className="h-screen w-screen bg-background">
        <OverlayRouter />
      </div>
    );
  }

  return (
    <VoilaInterface />
  );
}
