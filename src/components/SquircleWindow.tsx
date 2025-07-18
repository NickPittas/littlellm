'use client';

import { useEffect } from 'react';
import { useWindowSquircle } from '@/hooks/useSquircle';

interface SquircleWindowProps {
  cornerRadius?: number;
  cornerSmoothing?: number;
  enabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Component that applies squircle styling to the entire window
 * This should be placed at the root level of your application
 */
export function SquircleWindow({
  cornerRadius = 12,
  cornerSmoothing = 0.6,
  enabled = true,
  children,
}: SquircleWindowProps) {
  // Apply squircle styling to window elements
  useWindowSquircle({
    cornerRadius,
    cornerSmoothing,
    enabled,
  });

  // Inject additional CSS for better cross-platform support
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const styleId = 'squircle-window-global';
    
    // Remove existing style if it exists
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create comprehensive squircle CSS
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Enhanced squircle styling for Electron windows */
      html, body, #__next {
        border-radius: ${cornerRadius}px !important;
        -electron-corner-smoothing: ${Math.round(cornerSmoothing * 100)}% !important;
        overflow: hidden !important;
      }

      /* Fallback masking for non-Electron environments */
      @supports not (-electron-corner-smoothing: 60%) {
        html, body, #__next {
          -webkit-mask-image: 
            radial-gradient(circle at ${cornerRadius}px ${cornerRadius}px, transparent ${cornerRadius}px, black ${cornerRadius}px),
            radial-gradient(circle at calc(100% - ${cornerRadius}px) ${cornerRadius}px, transparent ${cornerRadius}px, black ${cornerRadius}px),
            radial-gradient(circle at ${cornerRadius}px calc(100% - ${cornerRadius}px), transparent ${cornerRadius}px, black ${cornerRadius}px),
            radial-gradient(circle at calc(100% - ${cornerRadius}px) calc(100% - ${cornerRadius}px), transparent ${cornerRadius}px, black ${cornerRadius}px);
          -webkit-mask-size: ${cornerRadius * 2}px ${cornerRadius * 2}px;
          -webkit-mask-position: top left, top right, bottom left, bottom right;
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-composite: intersect;
        }
      }

      /* Ensure all child elements respect the rounded container */
      #__next {
        overflow: hidden !important;
      }

      #__next > * {
        border-radius: inherit;
      }

      /* Special handling for dialogs and overlays */
      [data-radix-dialog-content],
      [data-radix-popover-content],
      [data-radix-select-content] {
        border-radius: ${Math.min(cornerRadius, 8)}px !important;
        -electron-corner-smoothing: ${Math.round(cornerSmoothing * 100)}% !important;
      }

      /* Smooth transitions for dynamic content */
      * {
        transition: border-radius 0.2s ease-out;
      }
    `;

    document.head.appendChild(style);

    // Cleanup function
    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [cornerRadius, cornerSmoothing, enabled]);

  // Force a repaint to ensure styles are applied
  useEffect(() => {
    if (!enabled) return;
    
    const forceRepaint = () => {
      const elements = [
        document.documentElement,
        document.body,
        document.getElementById('__next'),
      ].filter(Boolean);

      elements.forEach((element) => {
        if (element) {
          const display = element.style.display;
          element.style.display = 'none';
          void element.offsetHeight; // Trigger reflow
          element.style.display = display;
        }
      });
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(forceRepaint, 100);
    
    return () => clearTimeout(timer);
  }, [enabled]);

  return <>{children}</>;
}

export default SquircleWindow;
