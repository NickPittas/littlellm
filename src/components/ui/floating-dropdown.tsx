'use client';

import React, { useState, useRef, useEffect } from 'react';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../../services/debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}
interface FloatingDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function FloatingDropdown({ trigger, children, className = '', disabled = false }: FloatingDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isElectron = typeof window !== 'undefined' && window.electronAPI;

  const openDropdown = async () => {
    if (!isElectron || !triggerRef.current) {
      setIsOpen(true);
      return;
    }

    // Get trigger button position relative to window
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 200; // Default width
    const dropdownHeight = 300; // Default height

    // Calculate position below the trigger
    const x = rect.left;
    const y = rect.bottom + 4; // 4px gap

    // Generate HTML content for dropdown
    const content = generateDropdownHTML(children);

    try {
      await window.electronAPI.openDropdown(x, y, dropdownWidth, dropdownHeight, content);
      setIsOpen(true);
    } catch (error) {
      safeDebugLog('error', 'FLOATING_DROPDOWN', 'Failed to open floating dropdown:', error);
      setIsOpen(true); // Fallback to regular dropdown
    }
  };

  const closeDropdown = async () => {
    if (isElectron) {
      try {
        await window.electronAPI.closeDropdown();
      } catch (error) {
        safeDebugLog('error', 'FLOATING_DROPDOWN', 'Failed to close floating dropdown:', error);
      }
    }
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    if (disabled) return;
    
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  // Close dropdown when clicking outside (for non-Electron fallback)
  useEffect(() => {
    if (!isElectron && isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, isElectron]);

  // For non-Electron environments, render regular dropdown
  if (!isElectron) {
    return (
      <div className={`relative ${className}`}>
        <button
          ref={triggerRef}
          onClick={toggleDropdown}
          disabled={disabled}
          className="flex items-center gap-2 w-full"
        >
          {trigger}
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 min-w-full">
            {children}
          </div>
        )}
      </div>
    );
  }

  // For Electron, render just the trigger (dropdown is handled by native window)
  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        onClick={toggleDropdown}
        disabled={disabled}
        className="flex items-center gap-2 w-full"
      >
        {trigger}
      </button>
    </div>
  );
}

// Helper function to convert React children to HTML string
function generateDropdownHTML(children: React.ReactNode): string {
  // This is a simplified conversion - in a real implementation,
  // you might want to use a more sophisticated React-to-HTML converter
  if (typeof children === 'string') {
    return `<div class="dropdown-item">${children}</div>`;
  }

  // For now, return a placeholder - this would need to be enhanced
  // to properly convert React elements to HTML
  return `
    <div class="dropdown-item">Provider 1</div>
    <div class="dropdown-item">Provider 2</div>
    <div class="dropdown-item">Provider 3</div>
  `;
}
