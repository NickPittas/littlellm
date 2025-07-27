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

    // Apply CSS-based dragging to non-interactive elements
    const applyDragRegions = () => {
      // Set the entire body as draggable by default
      document.body.style.setProperty('-webkit-app-region', 'drag');

      // Find all interactive elements and mark them as no-drag
      // BUT respect existing drag regions (don't override elements that are explicitly set to drag)
      const interactiveElements = document.querySelectorAll([
        'input',
        'textarea',
        'button',
        'select',
        'a',
        '[contenteditable]',
        '[role="button"]',
        '[role="textbox"]',
        '[role="combobox"]',
        '[role="listbox"]',
        '[role="option"]',
        '[role="menuitem"]',
        '[role="tab"]',
        '[role="slider"]',
        '[role="spinbutton"]',
        '.cursor-pointer',
        '.cursor-text',
        '[data-radix-select-trigger]',
        '[data-radix-select-content]',
        '[data-radix-select-item]',
        '[data-radix-popover-trigger]',
        '[data-radix-popover-content]',
        '[data-radix-dialog-trigger]',
        '[data-radix-dialog-content]',
        '.scrollbar-thumb',
        '.scrollbar-track',
        '[data-interactive]'
      ].join(', '));

      interactiveElements.forEach(element => {
        const htmlElement = element as HTMLElement;

        // Check if the element or its parent has an explicit drag region set
        const hasExplicitDragRegion = htmlElement.style.getPropertyValue('-webkit-app-region') === 'drag' ||
                                     htmlElement.closest('[style*="-webkit-app-region: drag"]');

        // Only set to no-drag if it doesn't have an explicit drag region
        if (!hasExplicitDragRegion) {
          htmlElement.style.setProperty('-webkit-app-region', 'no-drag');
        }
      });

      debugLogger.debug('Applied CSS drag regions to', interactiveElements.length, 'interactive elements');
    };

    // Apply drag regions immediately
    applyDragRegions();

    // Reapply when DOM changes (for dynamically added elements)
    const observer = new MutationObserver(() => {
      applyDragRegions();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-interactive']
    });

    // Cleanup function
    return () => {
      observer.disconnect();
      // Reset drag regions
      document.body.style.removeProperty('-webkit-app-region');
      const allElements = document.querySelectorAll('[style*="-webkit-app-region"]');
      allElements.forEach(element => {
        (element as HTMLElement).style.removeProperty('-webkit-app-region');
      });
    };
  }, []);

  return {
    isDragging: false // CSS-based dragging doesn't need state tracking
  };
}
