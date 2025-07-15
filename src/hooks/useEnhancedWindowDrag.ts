'use client';

import { useEffect, useRef, useCallback } from 'react';

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Enhanced window dragging hook that makes the entire window draggable
 * while preserving all interactive element functionality
 */
export function useEnhancedWindowDrag() {
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0
  });

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

  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return;

    const target = e.target as Element;
    
    // Don't start dragging if clicking on interactive elements
    if (isInteractiveElement(target)) {
      return;
    }

    // Don't start dragging if the target has explicit no-drag styling
    const computedStyle = window.getComputedStyle(target);
    if (computedStyle.getPropertyValue('-webkit-app-region') === 'no-drag') {
      return;
    }

    // Start drag operation
    e.preventDefault();
    
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.startDrag().then((dragInfo: { offsetX: number; offsetY: number } | null) => {
        if (dragInfo) {
          dragStateRef.current = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            offsetX: dragInfo.offsetX,
            offsetY: dragInfo.offsetY
          };

          // Add visual feedback
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
        }
      }).catch(console.error);
    }
  }, [isInteractiveElement]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStateRef.current.isDragging) return;

    e.preventDefault();
    
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.dragWindow(
        e.screenX,
        e.screenY,
        dragStateRef.current.offsetX,
        dragStateRef.current.offsetY
      ).catch(console.error);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragStateRef.current.isDragging) return;

    dragStateRef.current.isDragging = false;

    // Remove visual feedback
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Handle mouse leave to stop dragging when cursor leaves window
  const handleMouseLeave = useCallback(() => {
    if (dragStateRef.current.isDragging) {
      dragStateRef.current.isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, []);

  useEffect(() => {
    // Only enable in Electron environment
    if (typeof window === 'undefined' || !window.electronAPI) {
      return;
    }

    // Add event listeners to document for global dragging
    document.addEventListener('mousedown', handleMouseDown, { passive: false });
    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp, { passive: false });
    document.addEventListener('mouseleave', handleMouseLeave, { passive: false });

    // Cleanup function
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
      
      // Reset any lingering styles
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave]);

  return {
    isDragging: dragStateRef.current.isDragging
  };
}
