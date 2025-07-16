"use client"

import * as React from "react"
import type { LLMProvider } from "../../services/llmService"

interface ProviderLogoProps {
  provider: LLMProvider
  className?: string
  size?: number
}

export function ProviderLogo({ provider, className = "", size = 20 }: ProviderLogoProps) {
  const [isDarkTheme, setIsDarkTheme] = React.useState(true)

  React.useEffect(() => {
    // Force dark theme - no dynamic detection
    setIsDarkTheme(true)
  }, [])

  // Convert relative URLs to absolute URLs for Electron compatibility
  const getAbsoluteUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${url}`;
    }
    return url;
  };

  const logoSrc = getAbsoluteUrl(isDarkTheme ? provider.logo : (provider.logoLight || provider.logo));

  return (
    <img
      src={logoSrc}
      alt={provider.name}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
      title={provider.name}
      onError={(e) => {
        console.log('Provider logo failed to load:', logoSrc, 'for provider:', provider.name);
        // Fallback to first letter if image fails to load
        const target = e.currentTarget;
        target.style.display = 'none';
        const fallback = document.createElement('div');
        fallback.className = `bg-muted rounded flex items-center justify-center text-xs font-bold ${className}`;
        fallback.style.width = `${size}px`;
        fallback.style.height = `${size}px`;
        fallback.textContent = provider.name.charAt(0).toUpperCase();
        target.parentNode?.appendChild(fallback);
      }}
    />
  )
}
