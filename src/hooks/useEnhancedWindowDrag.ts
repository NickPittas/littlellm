'use client';

import { useEffect, useCallback } from 'react';

/**
 * Simple window dragging hook using Electron's built-in web API
 * This avoids high DPI scaling issues by using CSS -webkit-app-region
 */
export function useEnhancedWindowDrag() {
  // Check if an element should be excluded from dragging
  const isInteractiveElement = useCallback((element: Element): boolean => {
    // List of interactive element types and attributes that should not trigger dragging
    const interactiveSelectors = [
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
      '.scrollbar-track'
    ];

    // Check if the element itself matches any interactive selector
    for (const selector of interactiveSelectors) {
      if (element.matches(selector)) {
        return true;
      }
    }

    // Check if any parent element up to 5 levels is interactive
    let parent = element.parentElement;
    let level = 0;
    while (parent && level < 5) {
      for (const selector of interactiveSelectors) {
        if (parent.matches(selector)) {
          return true;
        }
      }

      // Special check for elements with specific data attributes or classes
      if (parent.hasAttribute('data-interactive') ||
          parent.classList.contains('no-drag') ||
          parent.style.getPropertyValue('-webkit-app-region') === 'no-drag') {
        return true;
      }

      parent = parent.parentElement;
      level++;
    }

    return false;
  }, []);

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
        (element as HTMLElement).style.setProperty('-webkit-app-region', 'no-drag');
      });

      console.log('🎯 Applied CSS drag regions to', interactiveElements.length, 'interactive elements');
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
