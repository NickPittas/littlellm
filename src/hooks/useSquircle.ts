import { useEffect, useRef } from 'react';
import { applySquircleStyle, generateSquircleClipPath } from '@/utils/squircle';

interface UseSquircleOptions {
  cornerRadius?: number;
  cornerSmoothing?: number;
  enabled?: boolean;
  responsive?: boolean;
}

/**
 * React hook to apply squircle styling to an element
 * @param options - Configuration options for the squircle effect
 * @returns Ref to attach to the target element
 */
export function useSquircle<T extends HTMLElement = HTMLDivElement>(
  options: UseSquircleOptions = {}
) {
  const {
    cornerRadius = 12,
    cornerSmoothing = 0.6,
    enabled = true,
    responsive = true,
  } = options;

  const elementRef = useRef<T>(null);

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;
    
    // Apply initial squircle styling
    applySquircleStyle(element, cornerRadius, cornerSmoothing);

    // Set up responsive behavior if enabled
    let resizeObserver: ResizeObserver | null = null;
    
    if (responsive && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          
          if (width > 0 && height > 0) {
            const clipPath = generateSquircleClipPath(
              cornerRadius,
              cornerSmoothing,
              width,
              height
            );
            
            if (clipPath !== 'none') {
              element.style.clipPath = clipPath;
            }
          }
        }
      });
      
      resizeObserver.observe(element);
    }

    // Cleanup function
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [cornerRadius, cornerSmoothing, enabled, responsive]);

  return elementRef;
}

/**
 * Hook to apply squircle styling to the window/body element
 * @param options - Configuration options for the squircle effect
 */
export function useWindowSquircle(options: UseSquircleOptions = {}) {
  const {
    cornerRadius = 12,
    cornerSmoothing = 0.6,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Apply to html and body elements
    const htmlElement = document.documentElement;
    const bodyElement = document.body;

    if (htmlElement) {
      applySquircleStyle(htmlElement, cornerRadius, cornerSmoothing);
    }
    
    if (bodyElement) {
      applySquircleStyle(bodyElement, cornerRadius, cornerSmoothing);
    }

    // Apply to Next.js root element
    const nextRoot = document.getElementById('__next');
    if (nextRoot) {
      applySquircleStyle(nextRoot, cornerRadius, cornerSmoothing);
    }

  }, [cornerRadius, cornerSmoothing, enabled]);
}

/**
 * Hook to inject squircle CSS dynamically
 * @param className - CSS class name to create
 * @param options - Configuration options for the squircle effect
 */
export function useSquircleCSS(
  className: string,
  options: UseSquircleOptions = {}
) {
  const {
    cornerRadius = 12,
    cornerSmoothing = 0.6,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const styleId = `squircle-${className}`;
    
    // Remove existing style if it exists
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create new style element
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .${className} {
        border-radius: ${cornerRadius}px;
        -electron-corner-smoothing: ${Math.round(cornerSmoothing * 100)}%;
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
  }, [className, cornerRadius, cornerSmoothing, enabled]);
}
