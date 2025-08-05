'use client';

import { useEffect } from 'react';
import { debugLogger } from '../services/debugLogger';

/**
 * Simple window dragging hook using Electron's built-in web API
 * This avoids high DPI scaling issues by using CSS -webkit-app-region
 */
export function useEnhancedWindowDrag() {
  // This hook now uses CSS-based dragging only

  useEffect(() => {
    // Only enable in Electron environment
    if (typeof window === 'undefined' || !window.electronAPI) {
      return;
    }

    // Scoped strategy: ensure root elements have no app-region so component-level regions work
    document.documentElement.style.removeProperty('-webkit-app-region');
    document.body.style.removeProperty('-webkit-app-region');

    // Debug computed styles to verify correct regions
    try {
      const logRegion = (label: string, el: Element | null) => {
        if (!el) return;
        const cs = getComputedStyle(el as HTMLElement) as CSSStyleDeclaration;
        // Access vendor property without using 'any'
        const region =
          (cs as unknown as Record<string, string>)['-webkit-app-region'] ||
          (cs.getPropertyValue && cs.getPropertyValue('-webkit-app-region')) ||
          'unset';
        debugLogger.debug(`EnhancedWindowDrag: ${label} app-region=${region}`);
      };
      logRegion('html', document.documentElement);
      logRegion('body', document.body);
      const header = document.querySelector('.draggable-title-bar');
      logRegion('.draggable-title-bar', header);
    } catch {
      // ignore logging errors
    }

    return () => {
      // leave root without app-region
      document.documentElement.style.removeProperty('-webkit-app-region');
      document.body.style.removeProperty('-webkit-app-region');
    };
  }, []);

  return {
    isDragging: false // CSS-based dragging doesn't need state tracking
  };
}
