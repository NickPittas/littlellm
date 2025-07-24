'use client';

import { useState, useEffect } from 'react';
import { VoilaInterface } from '../components/VoilaInterface';
import { OverlayRouter } from '../components/OverlayRouter';

// Import test utilities for development
import '../utils/testInternalCommands';
import '../utils/readDebugLog';
import '../utils/autoDebugReader';

export default function Home() {
  // Home component rendering
  const [isOverlay, setIsOverlay] = useState(false);

  useEffect(() => {
    console.log('Home component mounted');
    // Check if this is an overlay window
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setIsOverlay(urlParams.has('overlay'));
    }
  }, []);

  if (isOverlay) {
    return (
      <div className="h-full w-full bg-background" style={{ width: '100vw', height: '100vh' }}>
        <OverlayRouter />
      </div>
    );
  }

  return (
    <VoilaInterface />
  );
}
